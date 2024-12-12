// Misc non-SPA views
import express, { Request, Response, Router } from "express"
import rateLimit from "express-rate-limit"
import filenamify from "filenamify"
import React from "react"
import { Writable } from "stream"
import { expectInt, renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { logInWithCredentials, logOut } from "./authentication.js"
import { LoginPage } from "./LoginPage.js"
import * as db from "../db/db.js"
import { writeDatasetCSV } from "../db/model/Dataset.js"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import {
    renderExplorerPage,
    renderGdoc,
    renderPreview,
} from "../baker/siteRenderers.js"
import { GitCmsServer } from "../gitCms/GitCmsServer.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import {
    getOwidGdocFromJSON,
    JsonError,
    OwidArticleBackportingStatistics,
    OwidGdocJSON,
    parseIntOrUndefined,
    slugify,
    stringifyUnknownError,
} from "@ourworldindata/utils"
import {
    DefaultNewExplorerSlug,
    EXPLORERS_PREVIEW_ROUTE,
    GetAllExplorersRoute,
    GetAllExplorersTagsRoute,
    ExplorerProgram,
    EXPLORER_FILE_SUFFIX,
} from "@ourworldindata/explorer"
import fs from "fs-extra"
import * as Post from "../db/model/Post.js"
import {
    renderDataPageV2,
    renderPreviewDataPageOrGrapherPage,
} from "../baker/GrapherBaker.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { getVariableMetadata } from "../db/model/Variable.js"
import { DbPlainDatasetFile, DbPlainDataset } from "@ourworldindata/types"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import { getMultiDimDataPageBySlug } from "../db/model/MultiDimDataPage.js"
import { renderMultiDimDataPageFromConfig } from "../baker/MultiDimBaker.js"

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("express-async-errors")

// Used for rate-limiting important endpoints (login, register) to prevent brute force attacks
const limiterMiddleware = (
    onFailRender: (req: Request, res: Response) => React.ReactElement
) =>
    rateLimit({
        windowMs: 60_000, // 1 minute
        max: 10, // max. 10 requests per minute
        handler: (req, res) =>
            res.status(429).send(renderToHtmlPage(onFailRender(req, res))),
    })

const adminRouter = Router()

// Parse incoming requests with JSON payloads http://expressjs.com/en/api.html
adminRouter.use(express.json({ limit: "50mb" }))

// None of these should be google indexed
adminRouter.use(async (req, res, next) => {
    res.set("X-Robots-Tag", "noindex")
    return next()
})

adminRouter.get("/", async (req, res) => {
    // Preview URLs generated by WP depend on the status of the post:
    // * PUBLISHED: owid.cloud/SLUG?preview=true --> run through WP singular.php
    //   and directly redirected to /admin/posts/preview/POST_ID
    // * DRAFT:
    //     - post: owid.cloud/?p=POST_ID&preview=true
    //     - page: owid.cloud/?page_id=PAGE_ID&preview=true
    //   --> "/" captured by NGINX and redirected here (/admin/)
    //
    // Ideally, the preview URL in WP would be pointing directly to
    // /admin/posts/preview/POST_ID (bypassing WP altogether, for published and
    // draft posts) but this is only partially possible for now, as the preview
    // URL of draft posts does not get rewritten by the preview_post_link filter
    // within Gutenberg.
    //
    // See:
    //  * https://github.com/WordPress/gutenberg/issues/13998
    //  * https://developer.wordpress.org/reference/hooks/preview_post_link/
    if (req.query.preview === "true" && (req.query.p || req.query.page_id)) {
        // HACK
        res.redirect(`/admin/posts/preview/${req.query.p || req.query.page_id}`)
    } else {
        res.redirect(`/admin/charts`)
    }
})

adminRouter.get("/login", async (req, res) => {
    res.send(renderToHtmlPage(<LoginPage next={req.query.next as string} />))
})
adminRouter.post(
    "/login",
    limiterMiddleware((req) => (
        <LoginPage
            errorMessage="Too many attempts, please try again in a minute."
            next={req.query.next as string}
        />
    )),
    async (req, res) => {
        try {
            const session = await logInWithCredentials(
                req.body.username,
                req.body.password
            )
            // secure cookie when using https
            // (our staging servers use http and passing insecure cookie wouldn't work)
            const secure = req.protocol === "https"

            res.cookie("sessionid", session.id, {
                httpOnly: true,
                sameSite: "lax",
                secure: secure,
            })
            res.redirect((req.query.next as string) || "/admin")
        } catch (err) {
            res.status(400).send(
                renderToHtmlPage(
                    <LoginPage
                        next={req.query.next as string}
                        errorMessage={stringifyUnknownError(err)}
                    />
                )
            )
        }
    }
)

adminRouter.get("/logout", logOut)

getPlainRouteWithROTransaction(
    adminRouter,
    "/datasets/:datasetId.csv",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        const datasetName = (
            await db.knexRawFirst<Pick<DbPlainDataset, "name">>(
                trx,
                `SELECT name FROM datasets WHERE id=?`,
                [datasetId]
            )
        )?.name

        res.attachment(filenamify(datasetName!) + ".csv")

        const writeStream = new Writable({
            write(chunk, encoding, callback) {
                res.write(chunk.toString())
                callback(null)
            },
        })
        await writeDatasetCSV(trx, datasetId, writeStream)
        res.end()
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    "/datasets/:datasetId/downloadZip",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        res.attachment("additional-material.zip")

        const file = await db.knexRawFirst<
            Pick<DbPlainDatasetFile, "filename" | "file">
        >(trx, `SELECT filename, file FROM dataset_files WHERE datasetId=?`, [
            datasetId,
        ])
        res.send(file?.file)
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    "/posts/preview/:postId",
    async (req, res, trx) => {
        const postId = expectInt(req.params.postId)
        const preview = await renderPreview(postId, trx)
        res.send(preview)
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    "/posts/compare/:postId",
    async (req, res, trx) => {
        const postId = expectInt(req.params.postId)

        const wpPage = await renderPreview(postId, trx)
        const archieMlText = await Post.select(
            "archieml",
            "archieml_update_statistics"
        ).from(trx(Post.postsTable).where({ id: postId }))

        if (
            archieMlText.length === 0 ||
            archieMlText[0].archieml === null ||
            archieMlText[0].archieml_update_statistics === null
        )
            throw new Error(
                `Could not compare posts because archieml was not present in the database for ${postId}`
            )
        const archieMlJson = JSON.parse(
            archieMlText[0].archieml
        ) as OwidGdocJSON
        const updateStatsJson = JSON.parse(
            archieMlText[0].archieml_update_statistics
        ) as OwidArticleBackportingStatistics

        const errorItems = updateStatsJson.errors.map(
            (error) => `<li>${error.details}</li>`
        )
        const errorList = `<ul>${errorItems.join("")}</ul>`

        const archieMl = getOwidGdocFromJSON(archieMlJson)
        const archieMlPage = renderGdoc(archieMl)

        res.send(`<!doctype html>
    <html>
        <head>
        </head>
        <body>
            <dialog id="error-dialog">
                <h3>Migration errors</h3>
                <p>${errorList}</p>
                <button onclick="document.getElementById('error-dialog').close()">Close</button>
            </dialog>

            <!-- Add the button that triggers the dialog -->
            <button onclick="document.getElementById('error-dialog').showModal()" title="${
                updateStatsJson.numErrors
            } errors">Show migrations errors</button>
            <div>
                <div style="width: 50%; float: left;">
                    <h1>WP</h1>
                    <iframe srcdoc="${wpPage.replaceAll(
                        '"',
                        "&quot;"
                    )}" style="width: 100%; height: 100vh;"></iframe>
                </div>
                <div style="width: 50%; float: left;">
                    <h1>ArchieML</h1>
                    <iframe srcdoc="${archieMlPage.replaceAll(
                        '"',
                        "&quot;"
                    )}" style="width: 100%; height: 100vh;"></iframe>
                </div>
            </div>
        </body>
    </html>`)
    }
)

adminRouter.get("/errorTest.csv", async (req, res) => {
    // Add `table /admin/errorTest.csv?code=404` to test fetch download failures
    const code = parseIntOrUndefined(req.query.code as string) ?? 400

    res.status(code)

    return `Simulating code ${code}`
})

adminRouter.get("/nodeVersion", (req, res) => {
    res.send(process.version)
})

const explorerAdminServer = new ExplorerAdminServer(GIT_CMS_DIR)

adminRouter.get(`/${GetAllExplorersRoute}`, async (req, res) => {
    res.send(await explorerAdminServer.getAllExplorersCommand())
})

getPlainRouteWithROTransaction(
    adminRouter,
    `/${GetAllExplorersTagsRoute}`,
    async (_, res, trx) => {
        return res.send({
            explorers: await db.getExplorerTags(trx),
        })
    }
)

getPlainRouteWithROTransaction(
    adminRouter,
    `/${EXPLORERS_PREVIEW_ROUTE}/:slug`,
    async (req, res, knex) => {
        const slug = slugify(req.params.slug)
        const filename = slug + EXPLORER_FILE_SUFFIX

        if (slug === DefaultNewExplorerSlug)
            return renderExplorerPage(
                new ExplorerProgram(DefaultNewExplorerSlug, ""),
                knex,
                { isPreviewing: true }
            )
        if (
            !slug ||
            !fs.existsSync(explorerAdminServer.absoluteFolderPath + filename)
        )
            return `File not found`
        const explorer = await explorerAdminServer.getExplorerFromFile(filename)
        const explorerPage = await renderExplorerPage(explorer, knex, {
            isPreviewing: true,
        })

        return res.send(explorerPage)
    }
)
getPlainRouteWithROTransaction(
    adminRouter,
    "/datapage-preview/:id",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.id)
        const variableMetadata = await getVariableMetadata(variableId)
        if (!variableMetadata) throw new JsonError("No such variable", 404)

        res.send(
            await renderDataPageV2(
                {
                    variableId,
                    variableMetadata,
                    isPreviewing: true,
                    useIndicatorGrapherConfigs: true,
                },
                trx
            )
        )
    }
)
getPlainRouteWithROTransaction(
    adminRouter,
    "/grapher/:slug",
    async (req, res, trx) => {
        const { slug } = req.params
        const chart = await getChartConfigBySlug(trx, slug).catch(
            () => undefined
        )
        if (chart) {
            const previewDataPageOrGrapherPage =
                await renderPreviewDataPageOrGrapherPage(chart.config, trx)
            res.send(previewDataPageOrGrapherPage)
            return
        }

        const mdd = await getMultiDimDataPageBySlug(trx, slug, {
            onlyPublished: false,
        })
        if (mdd) {
            const renderedPage = await renderMultiDimDataPageFromConfig(
                trx,
                slug,
                mdd.config,
                true
            )
            res.send(renderedPage)
            return
        }

        throw new JsonError("No such chart", 404)
    }
)

const gitCmsServer = new GitCmsServer({
    baseDir: GIT_CMS_DIR,
    shouldAutoPush: true,
})
void gitCmsServer.createDirAndInitIfNeeded()
gitCmsServer.addToRouter(adminRouter)

export { adminRouter }
