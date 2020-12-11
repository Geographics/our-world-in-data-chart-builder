import React from "react"
import { existsSync, readdir, writeFile, mkdirp, readFile } from "fs-extra"
import { dirname } from "path"
import { queryMysql } from "../db/db"
import { getGrapherById } from "../db/model/Chart"
import { getBlockContent } from "../db/wpdb"
import {
    EXPLORER_FILE_SUFFIX,
    ExplorerProgram,
} from "../explorer/ExplorerProgram"
import { Router } from "express"
import { ExplorerPage } from "../site/ExplorerPage"
import {
    EXPLORERS_GIT_CMS_FOLDER,
    EXPLORERS_PREVIEW_ROUTE,
    ExplorersRoute,
    ExplorersRouteGrapherConfigs,
    ExplorersRouteQueryParam,
    ExplorersRouteResponse,
    DefaultNewExplorerSlug,
    EXPLORERS_ROUTE_FOLDER,
} from "../explorer/ExplorerConstants"
import simpleGit, { SimpleGit } from "simple-git"
import { slugify } from "../clientUtils/Util"
import { GrapherInterface } from "../grapher/core/GrapherInterface"
import { Grapher, GrapherProgrammaticInterface } from "../grapher/core/Grapher"
import { GitCommit, JsonError } from "../clientUtils/owidTypes"
import ReactDOMServer from "react-dom/server"

export class ExplorerAdminServer {
    constructor(gitDir: string, baseUrl: string) {
        this.gitDir = gitDir
        this.baseUrl = baseUrl
    }

    private baseUrl: string
    private gitDir: string

    // we store explorers in a subdir of the gitcms for now. idea is we may store other things in there later.
    private get absoluteFolderPath() {
        return this.gitDir + "/" + EXPLORERS_GIT_CMS_FOLDER + "/"
    }

    private _simpleGit?: SimpleGit
    private get simpleGit() {
        if (!this._simpleGit)
            this._simpleGit = simpleGit({
                baseDir: this.gitDir,
                binary: "git",
                maxConcurrentProcesses: 1,
            })
        return this._simpleGit
    }

    private async getAllExplorersCommand() {
        // http://localhost:3030/admin/api/explorers.json
        // Download all explorers for the admin index page
        try {
            const explorers = await this.getAllExplorers()
            const branches = await this.simpleGit.branchLocal()
            const gitCmsBranchName = await branches.current
            const needsPull = false // todo: add

            return {
                success: true,
                gitCmsBranchName,
                needsPull,
                explorers: explorers.map((explorer) => explorer.toJson()),
            } as ExplorersRouteResponse
        } catch (err) {
            console.log(err)
            return {
                success: false,
                errorMessage: err,
            } as ExplorersRouteResponse
        }
    }

    private async getGrapherConfigsForExplorerCommand(grapherIds: number[]) {
        // Download all chart configs for Explorer create page
        const configs = []
        for (const grapherId of grapherIds) {
            try {
                configs.push(await getGrapherById(grapherId))
            } catch (err) {
                console.log(`Error with grapherId '${grapherId}'`)
            }
        }
        return configs
    }

    addMockBakedSiteRoutes(app: Router) {
        app.get(`/${EXPLORERS_ROUTE_FOLDER}/:slug`, async (req, res) => {
            // XXX add dev-prod parity for this
            res.set("Access-Control-Allow-Origin", "*")
            const explorers = await this.getAllPublishedExplorers()
            const explorerProgram = explorers.find(
                (program) => program.slug === req.params.slug
            )
            if (explorerProgram)
                res.send(await this.renderExplorerPage(explorerProgram))
            else
                throw new JsonError(
                    "A published explorer with that slug was not found",
                    404
                )
        })
    }

    addAdminRoutes(app: Router) {
        app.get("/errorTest.csv", async (req, res) => {
            // Add `table http://localhost:3030/admin/api/errorTest.csv?code=404` to test fetch download failures
            const code =
                req.query.code && !isNaN(parseInt(req.query.code))
                    ? req.query.code
                    : 400

            res.status(code)

            return `Simulating code ${code}`
        })

        app.get(`/${ExplorersRoute}`, async (req, res) => {
            res.send(this.getAllExplorersCommand())
        })

        app.get(`/${ExplorersRouteGrapherConfigs}`, async (req, res) => {
            res.send(
                this.getGrapherConfigsForExplorerCommand(
                    req.query[ExplorersRouteQueryParam].split(
                        "~"
                    ).map((id: string) => parseInt(id))
                )
            )
        })

        // i.e. http://localhost:3030/admin/explorers/preview/some-slug
        app.get(`/${EXPLORERS_PREVIEW_ROUTE}/:slug`, async (req, res) => {
            const slug = slugify(req.params.slug)
            const filename = slug + EXPLORER_FILE_SUFFIX
            if (slug === DefaultNewExplorerSlug)
                return res.send(
                    await this.renderExplorerPage(
                        new ExplorerProgram(DefaultNewExplorerSlug, "")
                    )
                )
            if (!slug || !existsSync(this.absoluteFolderPath + filename))
                return res.send(`File not found`)
            const explorer = await this.getExplorerFromFile(filename)
            return res.send(await this.renderExplorerPage(explorer))
        })
    }

    // todo: make private? once we remove covid legacy stuff?
    async getExplorerFromFile(filename: string) {
        const fullPath = this.absoluteFolderPath + filename
        const content = await readFile(fullPath, "utf8")
        const commits = await this.simpleGit.log({ file: fullPath, n: 1 })
        return new ExplorerProgram(
            filename.replace(EXPLORER_FILE_SUFFIX, ""),
            content,
            commits.latest as GitCommit
        )
    }

    async renderExplorerPage(program: ExplorerProgram) {
        const { requiredGrapherIds } = program.decisionMatrix
        let grapherConfigRows: any[] = []
        if (requiredGrapherIds.length)
            grapherConfigRows = await queryMysql(
                `SELECT id, config FROM charts WHERE id IN (?)`,
                [requiredGrapherIds]
            )

        const wpContent = program.wpBlockId
            ? await getBlockContent(program.wpBlockId)
            : undefined

        const grapherConfigs: GrapherInterface[] = grapherConfigRows.map(
            (row) => {
                const config: GrapherProgrammaticInterface = JSON.parse(
                    row.config
                )
                config.id = row.id // Ensure each grapher has an id
                config.manuallyProvideData = true
                return new Grapher(config).toObject()
            }
        )

        return (
            `<!doctype html>` +
            ReactDOMServer.renderToStaticMarkup(
                <ExplorerPage
                    grapherConfigs={grapherConfigs}
                    program={program}
                    wpContent={wpContent}
                    baseUrl={this.baseUrl}
                />
            )
        )
    }

    async bakeAllPublishedExplorers(outputFolder: string) {
        const published = await this.getAllPublishedExplorers()
        await this.bakeExplorersToDir(outputFolder, published)
    }

    private async getAllPublishedExplorers() {
        const explorers = await this.getAllExplorers()
        return explorers.filter((exp) => exp.isPublished)
    }

    private async getAllExplorers() {
        if (!existsSync(this.absoluteFolderPath)) return []
        const files = await readdir(this.absoluteFolderPath)
        const explorerFiles = files.filter((filename) =>
            filename.endsWith(EXPLORER_FILE_SUFFIX)
        )

        const explorers: ExplorerProgram[] = []
        for (const filename of explorerFiles) {
            const explorer = await this.getExplorerFromFile(filename)

            explorers.push(explorer)
        }
        return explorers
    }

    private async write(outPath: string, content: string) {
        await mkdirp(dirname(outPath))
        await writeFile(outPath, content)
        console.log(outPath)
    }

    private async bakeExplorersToDir(
        directory: string,
        explorers: ExplorerProgram[] = []
    ) {
        for (const explorer of explorers) {
            await this.write(
                `${directory}/${explorer.slug}.html`,
                await this.renderExplorerPage(explorer)
            )
        }
    }
}
