import { keyBy, mapValues, sortBy, memoize } from "lodash"
import parseArgs from "minimist"
import opener from "opener"
import { execWrapper } from "../db/execWrapper.js"
import { DeployTarget, ProdTarget } from "./DeployTarget.js"
import { dayjs } from "@ourworldindata/utils"

/**
 * Retrieves information about the deployed commit on a live or staging server.
 * Usage examples:
 * - `yarn fetchServerStatus` will retrieve information about the deployed commits for _all_ servers, and show a table
 * - `yarn fetchServerStatus live` will retrieve the commit that's live on https://ourworldindata.org and opens it in GitHub
 *   That's equivalent to `yarn fetchServerStatus live --open`
 * - `yarn fetchServerStatus staging --show` will `git show` information about the commit deployed on https://staging-owid.netlify.app
 * - `yarn fetchServerStatus --show --tree` will both show a git tree and a `git show` of the deployed commits on https://ourworldindata.org
 *
 * Note:
 *  For the local git commands to work you need to have that commit on your machine. Run a `git fetch` if you're getting a git error message.
 *  If it still doesn't work, the live commit is not pushed to GitHub yet. That should only happen on a staging server, never on live.
 */

const servers = Object.values(DeployTarget)

const args = parseArgs(process.argv.slice(2))

const showTree = args["tree"]
const showCommit = args["show"]
const openInBrowser = args["open"] || !(showCommit || showTree)

const getServerUrl = (server: string) =>
    server === ProdTarget
        ? "https://ourworldindata.org"
        : `https://${server}-owid.netlify.com`

const fetchCommitSha = async (server: string) =>
    fetch(`${getServerUrl(server)}/head.txt`)
        .then((res) => {
            if (res.ok) return res
            throw Error(`Request rejected with status ${res.status}`)
        })
        .then(async (resp) => ({
            commitSha: await resp.text(),
        }))

interface ServerCommitInformation {
    serverName: string
    commitSha: string | undefined
    commitDate: Date | undefined
    commitAuthor: string | undefined
    commitMessage: string | undefined
}

const fetchAll = async () => {
    const commits = await Promise.all(
        servers.map(async (serverName) => {
            let commitInformation = undefined
            try {
                commitInformation = await fetchCommitSha(serverName)
            } catch {
                commitInformation = undefined
            }

            return {
                serverName,
                ...commitInformation,
                commitDate: undefined,
                commitAuthor: undefined,
                commitMessage: undefined,
            } as ServerCommitInformation
        })
    )

    const _fetchGithubCommitInfo = async (commitSha: string) =>
        await fetch(
            `https://api.github.com/repos/owid/owid-grapher/git/commits/${commitSha}`,
            {
                headers: {
                    Accept: "application/vnd.github.v3",
                },
            }
        ).then((response) => response.json())

    // Memoize so as to not fetch information about the same commit twice
    const fetchGithubCommitInfo = memoize(_fetchGithubCommitInfo)

    const commitsWithInformation = await Promise.all(
        commits.map(async (commit) => {
            if (!commit.commitSha) return commit

            const response = await fetchGithubCommitInfo(commit.commitSha)

            return {
                ...commit,
                commitSha: commit.commitSha.substring(0, 7),
                commitDate:
                    response?.author?.date && new Date(response.author.date),
                commitAuthor: response?.author?.name,
                commitMessage: response?.message?.split("\n")?.[0],
            } as ServerCommitInformation
        })
    )

    return sortBy(commitsWithInformation, (c) => c.commitDate ?? 0).reverse()
}

if (args._[0]) {
    // fetch information for one specific server
    const server = args._[0]
    fetchCommitSha(server)
        .then(async ({ commitSha }) => {
            if (showTree)
                await execWrapper(
                    `git log -10 --graph --oneline --decorate --color=always ${commitSha}`
                )

            if (showTree && showCommit) console.log()

            if (showCommit)
                await execWrapper(`git show --stat --color=always ${commitSha}`)

            if (openInBrowser)
                opener(
                    `https://github.com/owid/owid-grapher/commit/${commitSha}`
                )
        })
        .catch((err) =>
            console.error(
                `Could not retrieve commit information from ${getServerUrl(
                    server
                )}. ${err}`
            )
        )
} else {
    // fetch information for _all_ servers
    void fetchAll().then((commitInformation) => {
        const data = mapValues(
            keyBy(
                commitInformation,
                (commitInformation) => commitInformation.serverName
            ),
            (commitInformation) => {
                const { commitSha, commitDate, commitAuthor, commitMessage } =
                    commitInformation

                return {
                    commitSha,
                    commitDate: commitDate && dayjs(commitDate).fromNow(),
                    commitAuthor,
                    commitMessage:
                        // truncate to 50 characters
                        commitMessage && commitMessage.length > 50
                            ? commitMessage?.substr(0, 50) + "…"
                            : commitMessage,
                }
            }
        )

        console.table(data)
    })
}
