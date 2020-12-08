import { Router, Request, Response } from "express"
import {
    GIT_DEFAULT_USERNAME,
    GIT_DEFAULT_EMAIL,
} from "../settings/clientSettings"
import simpleGit, { SimpleGit } from "simple-git"
import {
    writeFile,
    existsSync,
    readFile,
    unlink,
    readFileSync,
    mkdirSync,
} from "fs-extra"
import {
    GIT_CMS_DIR,
    GIT_CMS_FILE_ROUTE,
    GitCmsResponse,
    GitCmsReadResponse,
    WriteRequest,
    ReadRequest,
    DeleteRequest,
    GIT_CMS_PULL_ROUTE,
    GitPullResponse,
    GlobRequest,
    GIT_CMS_GLOB_ROUTE,
    GitCmsGlobResponse,
} from "./GitCmsConstants"
import { sync } from "glob"

// todo: cleanup typings
interface ResponseWithUserInfo extends Response {
    locals: { user: any; session: any }
}

export class GitCmsServer {
    private baseDir: string
    constructor(baseDir: string) {
        this.baseDir = baseDir
    }

    private _git?: SimpleGit
    private get git() {
        if (!this._git)
            this._git = simpleGit({
                baseDir: this.baseDir,
                binary: "git",
                maxConcurrentProcesses: 1,
            })
        return this._git
    }

    async createDirAndInitIfNeeded() {
        const { baseDir } = this
        if (!existsSync(baseDir)) mkdirSync(baseDir)
        await this.git.init()
        return this
    }

    private async saveFileToGitContentDirectory(
        filename: string,
        content: string,
        authorName = GIT_DEFAULT_USERNAME,
        authorEmail = GIT_DEFAULT_EMAIL,
        commitMsg?: string
    ) {
        const path = GIT_CMS_DIR + "/" + filename
        await writeFile(path, content, "utf8")

        commitMsg = commitMsg
            ? commitMsg
            : existsSync(path)
            ? `Updating ${filename}`
            : `Adding ${filename}`

        return this.commitFile(filename, commitMsg, authorName, authorEmail)
    }

    private async deleteFileFromGitContentDirectory(
        filename: string,
        authorName = GIT_DEFAULT_USERNAME,
        authorEmail = GIT_DEFAULT_EMAIL
    ) {
        const path = GIT_CMS_DIR + "/" + filename
        await unlink(path)
        return this.commitFile(
            filename,
            `Deleted ${filename}`,
            authorName,
            authorEmail
        )
    }

    private async pull() {
        return await this.git.pull()
    }

    private async commitFile(
        filename: string,
        commitMsg: string,
        authorName: string,
        authorEmail: string
    ) {
        await this.git.add(filename)
        return await this.git.commit(commitMsg, filename, {
            "--author": `${authorName} <${authorEmail}>`,
        })
    }

    private async autopush() {
        if (await this.shouldAutoPush()) this.git.push()
    }

    private async shouldAutoPush() {
        const branches = await this.git.branchLocal()
        const gitCmsBranchName = await branches.current
        return this.branchesToAutoPush.has(gitCmsBranchName)
    }

    // Push if on owid.cloud or staging. Do not push if on a differen branch (so you can set your local dev branch to something else to not push changes automatically)
    // todo: probably want a better stragegy?
    private branchesToAutoPush = new Set(["master", "staging"])

    async pullCommand() {
        try {
            const res = await this.pull()
            return {
                success: true,
                stdout: JSON.stringify(res.summary, null, 2),
            } as GitPullResponse
        } catch (error) {
            console.log(error)
            return { success: false, error }
        }
    }

    async getFileCommand(rawFilepath: string) {
        const filepath = `/${rawFilepath.replace(/\~/g, "/")}`
        try {
            validateFilePath(filepath)

            const path = GIT_CMS_DIR + filepath
            const exists = existsSync(path)
            if (!exists) throw new Error(`File '${filepath}' not found`)
            const content = await readFile(path, "utf8")
            return { success: true, content }
        } catch (error) {
            console.log(error)
            return {
                success: false,
                error,
                content: "",
            }
        }
    }

    async globCommand(globStr: string, folder: string) {
        const query = globStr.replace(/[^a-zA-Z\*]/, "")
        const cwd = GIT_CMS_DIR + "/" + folder
        const results = sync(query, {
            cwd,
        })

        const files = results.map((filename) => {
            return {
                filename,
                content: readFileSync(cwd + "/" + filename, "utf8"),
            }
        })

        return { success: true, files }
    }

    async deleteFileCommand(
        rawFilepath: string,
        username: string,
        email: string
    ) {
        const filepath = rawFilepath.replace(/\~/g, "/")
        try {
            validateFilePath(filepath)
            await this.deleteFileFromGitContentDirectory(
                filepath,
                username,
                email
            )
            await this.autopush()
            return { success: true }
        } catch (error) {
            console.log(error)
            return { success: false, error }
        }
    }

    async writeFileCommand(
        filepath: string,
        content: string,
        userName: string,
        email: string,
        commitMessage: string
    ) {
        try {
            validateFilePath(filepath)
            await this.saveFileToGitContentDirectory(
                filepath,
                content,
                userName,
                email,
                commitMessage
            )

            await this.autopush()
            return { success: true }
        } catch (error) {
            console.log(error)
            return { success: false, error }
        }
    }
}

const validateFilePath = (filename: string) => {
    if (filename.includes(".."))
        throw new Error(`Invalid filepath: ${filename}`)
}

export const addGitCmsApiRoutes = (app: Router) => {
    const server = new GitCmsServer(GIT_CMS_DIR)
    server.createDirAndInitIfNeeded()

    // Update/create file, commit, and push(unless on local dev brach)
    app.post(
        GIT_CMS_FILE_ROUTE,
        async (
            req: Request,
            res: ResponseWithUserInfo
        ): Promise<GitCmsResponse> => {
            const request = req.body as WriteRequest
            const { filepath, content, commitMessage } = request
            return server.writeFileCommand(
                filepath,
                content,
                res.locals.user.fullName,
                res.locals.user.email,
                commitMessage
            )
        }
    )

    // Pull latest from remote
    app.post(GIT_CMS_PULL_ROUTE, async () => await server.pullCommand())

    // Get file contents
    app.get(
        GIT_CMS_FILE_ROUTE,
        async (req: Request): Promise<GitCmsReadResponse> =>
            server.getFileCommand((req.query as ReadRequest).filepath)
    )

    // Get multiple file contents
    app.get(
        GIT_CMS_GLOB_ROUTE,
        async (req: Request): Promise<GitCmsGlobResponse> => {
            const request = req.query as GlobRequest
            return server.globCommand(request.glob, request.folder)
        }
    )

    // Delete file, commit, and and push(unless on local dev brach)
    app.delete(
        GIT_CMS_FILE_ROUTE,
        async (
            req: Request,
            res: ResponseWithUserInfo
        ): Promise<GitCmsResponse> => {
            const request = req.query as DeleteRequest
            return server.deleteFileCommand(
                request.filepath,
                res.locals.user.fullName,
                res.locals.user.email
            )
        }
    )
}
