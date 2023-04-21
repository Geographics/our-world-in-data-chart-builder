import React from "react"
import { GrapherPage } from "../site/GrapherPage.js"
import { DataPage } from "../site/DataPage.js"
import { renderToHtmlPage } from "../baker/siteRenderers.js"
import {
    excludeUndefined,
    urlToSlug,
    without,
    deserializeJSONFromHTML,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
    uniq,
    retryPromise,
} from "@ourworldindata/utils"
import {
    getRelatedArticles,
    getRelatedCharts,
    isWordpressAPIEnabled,
    isWordpressDBEnabled,
} from "../db/wpdb.js"
import * as fs from "fs-extra"
import * as lodash from "lodash"
import { bakeGraphersToPngs } from "./GrapherImageBaker.js"
import {
    OPTIMIZE_SVG_EXPORTS,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    MAX_NUM_BAKE_PROCESSES,
    DATA_FILES_CHECKSUMS_DIRECTORY,
} from "../settings/serverSettings.js"
import * as db from "../db/db.js"
import * as glob from "glob"
import { isPathRedirectedToExplorer } from "../explorerAdminServer/ExplorerRedirects.js"
import { getPostBySlug } from "../db/model/Post.js"
import { GrapherInterface } from "@ourworldindata/grapher"
import workerpool from "workerpool"
import ProgressBar from "progress"
import {
    getVariableData,
    getOwidVariableDataAndMetadataPath,
    assertFileExistsInS3,
} from "../db/model/Variable.js"
import { GIT_CMS_DIR } from "../gitCms/GitCmsConstants.js"
import { logErrorAndMaybeSendToSlack } from "../serverUtils/slackLog.js"

/**
 *
 * Render a datapage if available, otherwise render a grapher page.
 *
 */
export const renderDataPageOrGrapherPage = async (
    grapher: GrapherInterface,
    isPreviewing: boolean = false
) => {
    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))
    // this shows that multi-metric charts are not really supported, and will
    // render a datapage corresponding to the first variable found.
    const id = variableIds[0]
    const fullPath = `${GIT_CMS_DIR}/datapages/${id}.json`
    let datapage
    try {
        const datapageJson = await fs.readFile(fullPath, "utf8")
        datapage = JSON.parse(datapageJson)
        if (
            // We only want to render datapages on selected charts, even if the
            // variable found on the chart has a datapage configuration.
            datapage.showDataPageOnChartIds?.includes(grapher.id) &&
            isPreviewing
            // todo: we're not ready to publish datapages yet, so we only want to
            // render them if we're previewing.
            // (datapage.status === "published" || isPreviewing)
        ) {
            return renderToHtmlPage(
                <DataPage
                    grapher={grapher}
                    datapage={datapage}
                    baseUrl={BAKED_BASE_URL}
                    baseGrapherUrl={BAKED_GRAPHER_URL}
                />
            )
        }
    } catch (e: any) {
        // Do not throw an error if the datapage JSON does not exist, but rather
        // if it does and it fails to parse or render.
        if (e.code !== "ENOENT") {
            logErrorAndMaybeSendToSlack(
                `Failed to render datapage ${fullPath}. Error: ${e}`
            )
        }
    }
    // fallback to regular grapher page
    return renderGrapherPage(grapher)
}

const renderGrapherPage = async (grapher: GrapherInterface) => {
    const postSlug = urlToSlug(grapher.originUrl || "")
    const post = postSlug ? await getPostBySlug(postSlug) : undefined
    const relatedCharts =
        post && isWordpressDBEnabled
            ? await getRelatedCharts(post.id)
            : undefined
    const relatedArticles =
        grapher.id && isWordpressAPIEnabled
            ? await getRelatedArticles(grapher.id)
            : undefined

    return renderToHtmlPage(
        <GrapherPage
            grapher={grapher}
            post={post}
            relatedCharts={relatedCharts}
            relatedArticles={relatedArticles}
            baseUrl={BAKED_BASE_URL}
            baseGrapherUrl={BAKED_GRAPHER_URL}
        />
    )
}

interface BakeVariableDataArguments {
    bakedSiteDir: string
    checksumsDir: string
    variableId: number
}

export const bakeVariableData = async (
    bakeArgs: BakeVariableDataArguments
): Promise<BakeVariableDataArguments> => {
    const { dataPath, metadataPath } = await getOwidVariableDataAndMetadataPath(
        bakeArgs.variableId
    )

    await retryPromise(() => assertFileExistsInS3(dataPath))
    await retryPromise(() => assertFileExistsInS3(metadataPath))

    return bakeArgs
}

const bakeGrapherPageAndVariablesPngAndSVGIfChanged = async (
    bakedSiteDir: string,
    grapher: GrapherInterface
) => {
    const htmlPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    let isSameVersion = false
    try {
        // If the chart is the same version, we can potentially skip baking the data and exports (which is by far the slowest part)
        const html = await fs.readFile(htmlPath, "utf8")
        const savedVersion = deserializeJSONFromHTML(html)
        isSameVersion = savedVersion?.version === grapher.version
    } catch (err) {
        if ((err as any).code !== "ENOENT") console.error(err)
    }

    // Always bake the html for every chart; it's cheap to do so
    const outPath = `${bakedSiteDir}/grapher/${grapher.slug}.html`
    await fs.writeFile(outPath, await renderDataPageOrGrapherPage(grapher))
    console.log(outPath)

    const variableIds = lodash.uniq(
        grapher.dimensions?.map((d) => d.variableId)
    )
    if (!variableIds.length) return

    try {
        await fs.mkdirp(`${bakedSiteDir}/grapher/exports/`)
        const svgPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.svg`
        const pngPath = `${bakedSiteDir}/grapher/exports/${grapher.slug}.png`
        if (
            !isSameVersion ||
            !fs.existsSync(svgPath) ||
            !fs.existsSync(pngPath)
        ) {
            const loadDataMetadataPromises: Promise<OwidVariableDataMetadataDimensions>[] =
                variableIds.map(getVariableData)
            const variableDataMetadata = await Promise.all(
                loadDataMetadataPromises
            )
            const variableDataMedadataMap = new Map(
                variableDataMetadata.map((item) => [item.metadata.id, item])
            )
            await bakeGraphersToPngs(
                `${bakedSiteDir}/grapher/exports`,
                grapher,
                variableDataMedadataMap,
                OPTIMIZE_SVG_EXPORTS
            )
            console.log(svgPath)
            console.log(pngPath)
        }
    } catch (err) {
        console.error(err)
    }
}

const deleteOldGraphers = async (bakedSiteDir: string, newSlugs: string[]) => {
    // Delete any that are missing from the database
    const oldSlugs = glob
        .sync(`${bakedSiteDir}/grapher/*.html`)
        .map((slug) =>
            slug.replace(`${bakedSiteDir}/grapher/`, "").replace(".html", "")
        )
    const toRemove = without(oldSlugs, ...newSlugs)
        // do not delete grapher slugs redirected to explorers
        .filter((slug) => !isPathRedirectedToExplorer(`/grapher/${slug}`))
    for (const slug of toRemove) {
        console.log(`DELETING ${slug}`)
        try {
            const paths = [
                `${bakedSiteDir}/grapher/${slug}.html`,
                `${bakedSiteDir}/grapher/exports/${slug}.png`,
            ] //, `${BAKED_SITE_DIR}/grapher/exports/${slug}.svg`]
            await Promise.all(paths.map((p) => fs.unlink(p)))
            paths.map((p) => console.log(p))
        } catch (err) {
            console.error(err)
        }
    }
}

export const bakeAllPublishedChartsVariableDataAndMetadata = async (
    bakedSiteDir: string,
    variableIds: number[],
    checksumsDir: string
) => {
    await fs.mkdirp(checksumsDir)

    const progressBar = new ProgressBar(
        "bake variable data/metadata json [:bar] :current/:total :elapseds :rate/s :etas :name\n",
        {
            width: 20,
            total: variableIds.length + 1,
        }
    )

    // NOTE: we don't bake data, just make sure it exists on S3
    await Promise.all(
        variableIds.map(async (variableId) => {
            await bakeVariableData({
                bakedSiteDir,
                variableId,
                checksumsDir,
            })
            progressBar.tick({ name: `variableid ${variableId}` })
        })
    )
}

export interface BakeSingleGrapherChartArguments {
    id: number
    config: string
    bakedSiteDir: string
    slug: string
}

export const bakeSingleGrapherChart = async (
    args: BakeSingleGrapherChartArguments
) => {
    const grapher: GrapherInterface = JSON.parse(args.config)
    grapher.id = args.id

    // Avoid baking paths that have an Explorer redirect.
    // Redirects take precedence.
    if (isPathRedirectedToExplorer(`/grapher/${grapher.slug}`)) {
        console.log(`⏩ ${grapher.slug} redirects to explorer`)
        return
    }

    await bakeGrapherPageAndVariablesPngAndSVGIfChanged(
        args.bakedSiteDir,
        grapher
    )
    return args
}

export const bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers =
    async (bakedSiteDir: string) => {
        const variablesToBake: { varId: number }[] =
            await db.queryMysql(`select distinct vars.varID as varId
            from
            charts c,
            json_table(c.config, '$.dimensions[*]' columns (varID integer path '$.variableId') ) as vars
            where JSON_EXTRACT(c.config, '$.isPublished')=true`)

        await bakeAllPublishedChartsVariableDataAndMetadata(
            bakedSiteDir,
            variablesToBake.map((v) => v.varId),
            DATA_FILES_CHECKSUMS_DIRECTORY
        )

        const rows: { id: number; config: string; slug: string }[] =
            await db.queryMysql(`
                SELECT
                    id, config, config->>'$.slug' as slug
                FROM charts WHERE JSON_EXTRACT(config, "$.isPublished")=true
                ORDER BY JSON_EXTRACT(config, "$.slug") ASC
                `)

        const newSlugs = rows.map((row) => row.slug)
        await fs.mkdirp(bakedSiteDir + "/grapher")
        const jobs: BakeSingleGrapherChartArguments[] = rows.map((row) => ({
            id: row.id,
            config: row.config,
            bakedSiteDir: bakedSiteDir,
            slug: row.slug,
        }))

        const progressBar = new ProgressBar(
            "bake grapher page [:bar] :current/:total :elapseds :rate/s :etas :name\n",
            {
                width: 20,
                total: rows.length + 1,
            }
        )

        if (MAX_NUM_BAKE_PROCESSES == 1) {
            await Promise.all(
                jobs.map(async (job) => {
                    await bakeSingleGrapherChart(job)
                    progressBar.tick({ name: `slug ${job.slug}` })
                })
            )
        } else {
            const poolOptions = {
                minWorkers: 2,
                maxWorkers: MAX_NUM_BAKE_PROCESSES,
            }
            const pool = workerpool.pool(__dirname + "/worker.js", poolOptions)
            try {
                await Promise.all(
                    jobs.map((job) =>
                        pool.exec("bakeSingleGrapherChart", [job]).then(() =>
                            progressBar.tick({
                                name: `Baked chart ${job.slug}`,
                            })
                        )
                    )
                )
            } finally {
                await pool.terminate(true)
            }
        }

        await deleteOldGraphers(bakedSiteDir, excludeUndefined(newSlugs))
        progressBar.tick({ name: `✅ Deleted old graphers` })
    }
