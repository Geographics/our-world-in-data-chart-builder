/* eslint @typescript-eslint/no-unused-vars: [ "warn", { argsIgnorePattern: "^(res|req)$" } ] */

import * as lodash from "lodash"
import * as db from "../db/db.js"
import { imageStore } from "../db/model/Image.js"
import { GdocXImage } from "../db/model/GdocXImage.js"
import { DEPRECATEDgetTopics } from "../db/DEPRECATEDwpdb.js"
import {
    UNCATEGORIZED_TAG_ID,
    BAKE_ON_CHANGE,
    BAKED_BASE_URL,
    ADMIN_BASE_URL,
    DATA_API_URL,
} from "../settings/serverSettings.js"
import { expectInt, isValidSlug } from "../serverUtils/serverUtil.js"
import {
    OldChartFieldList,
    assignTagsForCharts,
    getChartConfigById,
    getChartSlugById,
    getGptTopicSuggestions,
    getRedirectsByChartId,
    oldChartFieldList,
    setChartTags,
} from "../db/model/Chart.js"
import { Request, CurrentUser } from "./authentication.js"
import {
    getMergedGrapherConfigForVariable,
    fetchS3MetadataByPath,
    fetchS3DataValuesByPath,
    searchVariables,
} from "../db/model/Variable.js"
import {
    applyPatch,
    BulkChartEditResponseRow,
    BulkGrapherConfigResponse,
    camelCaseProperties,
    chartBulkUpdateAllowedColumnNamesAndTypes,
    GdocsContentSource,
    GrapherConfigPatch,
    isEmpty,
    JsonError,
    OperationContext,
    OwidGdocJSON,
    OwidGdocPostInterface,
    parseIntOrUndefined,
    parseToOperation,
    DbRawPostWithGdocPublishStatus,
    SuggestedChartRevisionStatus,
    variableAnnotationAllowedColumnNamesAndTypes,
    VariableAnnotationsResponseRow,
    OwidVariableWithSource,
    OwidChartDimensionInterface,
    DimensionProperty,
    TaggableType,
    DbChartTagJoin,
    OwidGdoc,
    pick,
} from "@ourworldindata/utils"
import {
    DbPlainDatasetTag,
    GrapherInterface,
    OwidGdocType,
    DbPlainUser,
    UsersTableName,
    DbPlainTag,
    grapherKeysToSerialize,
    DbRawVariable,
    parseOriginsRow,
    PostsTableName,
    DbRawPost,
    DbRawSuggestedChartRevision,
    DbPlainChartSlugRedirect,
    DbRawChart,
    DbInsertChartRevision,
    serializeChartConfig,
    DbRawOrigin,
    DbRawPostGdoc,
    DbPlainDataset,
} from "@ourworldindata/types"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import { getDatasetById, setTagsForDataset } from "../db/model/Dataset.js"
import { getUserById, insertUser, updateUser } from "../db/model/User.js"
import { GdocPost } from "../db/model/Gdoc/GdocPost.js"
import { GdocBase, Tag as TagEntity } from "../db/model/Gdoc/GdocBase.js"
import {
    syncDatasetToGitRepo,
    removeDatasetFromGitRepo,
} from "./gitDataExport.js"
import { SuggestedChartRevision } from "../db/model/SuggestedChartRevision.js"
import { denormalizeLatestCountryData } from "../baker/countryProfiles.js"
import { References } from "../adminSiteClient/ChartEditor.js"
import { DeployQueueServer } from "../baker/DeployQueueServer.js"
import { FunctionalRouter } from "./FunctionalRouter.js"
import { escape } from "mysql"
import Papa from "papaparse"
import {
    postsTable,
    setTagsForPost,
    getTagsByPostId,
    getWordpressPostReferencesByChartId,
    getGdocsPostReferencesByChartId,
} from "../db/model/Post.js"
import {
    checkFullDeployFallback,
    checkHasChanges,
    checkIsLightningUpdate,
} from "../adminSiteClient/gdocsDeploy.js"
import { dataSource } from "../db/dataSource.js"
import { createGdocAndInsertOwidGdocPostContent } from "../db/model/Gdoc/archieToGdoc.js"
import { Link } from "../db/model/Link.js"
import { In } from "typeorm"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import { GdocFactory } from "../db/model/Gdoc/GdocFactory.js"
import {
    getRouteWithROTransaction,
    deleteRouteWithRWTransaction,
    putRouteWithRWTransaction,
    postRouteWithRWTransaction,
    patchRouteWithRWTransaction,
} from "./routerHelpers.js"

const apiRouter = new FunctionalRouter()

// Call this to trigger build and deployment of static charts on change
const triggerStaticBuild = async (user: CurrentUser, commitMessage: string) => {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    new DeployQueueServer().enqueueChange({
        timeISOString: new Date().toISOString(),
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage,
    })
}

const enqueueLightningChange = async (
    user: CurrentUser,
    commitMessage: string,
    slug: string
) => {
    if (!BAKE_ON_CHANGE) {
        console.log(
            "Not triggering static build because BAKE_ON_CHANGE is false"
        )
        return
    }

    return new DeployQueueServer().enqueueChange({
        timeISOString: new Date().toISOString(),
        authorName: user.fullName,
        authorEmail: user.email,
        message: commitMessage,
        slug,
    })
}

async function getLogsByChartId(
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<
    {
        userId: number
        config: string
        userName: string
        createdAt: Date
    }[]
> {
    const logs = await db.knexRaw<{
        userId: number
        config: string
        userName: string
        createdAt: Date
    }>(
        knex,
        `SELECT userId, config, fullName as userName, l.createdAt
        FROM chart_revisions l
        LEFT JOIN users u on u.id = userId
        WHERE chartId = ?
        ORDER BY l.id DESC
        LIMIT 50`,
        [chartId]
    )
    return logs
}

const getReferencesByChartId = async (
    chartId: number,
    knex: db.KnexReadonlyTransaction
): Promise<References> => {
    const postsWordpressPromise = getWordpressPostReferencesByChartId(
        chartId,
        knex
    )
    const postGdocsPromise = getGdocsPostReferencesByChartId(chartId, knex)
    const explorerSlugsPromise = db.queryMysql(
        `select distinct explorerSlug from explorer_charts where chartId = ?`,
        [chartId]
    )
    const [postsWordpress, postsGdocs, explorerSlugs] = await Promise.all([
        postsWordpressPromise,
        postGdocsPromise,
        explorerSlugsPromise,
    ])

    return {
        postsGdocs,
        postsWordpress,
        explorers: explorerSlugs.map(
            (row: { explorerSlug: string }) => row.explorerSlug
        ),
    }
}

const expectChartById = async (
    knex: db.KnexReadonlyTransaction,
    chartId: any
): Promise<GrapherInterface> => {
    const chart = await getChartConfigById(knex, expectInt(chartId))
    if (chart) return chart.config

    throw new JsonError(`No chart found for id ${chartId}`, 404)
}

const saveGrapher = async (
    knex: db.KnexReadWriteTransaction,
    user: CurrentUser,
    newConfig: GrapherInterface,
    existingConfig?: GrapherInterface,
    referencedVariablesMightChange = true // if the variables a chart uses can change then we need
    // to update the latest country data which takes quite a long time (hundreds of ms)
) => {
    // Slugs need some special logic to ensure public urls remain consistent whenever possible
    async function isSlugUsedInRedirect() {
        const rows = await db.knexRaw<DbPlainChartSlugRedirect>(
            knex,
            `SELECT * FROM chart_slug_redirects WHERE chart_id != ? AND slug = ?`,
            // -1 is a placeholder ID that will never exist; but we cannot use NULL because
            // in that case we would always get back an empty resultset
            [existingConfig ? existingConfig.id : -1, newConfig.slug]
        )
        return rows.length > 0
    }

    async function isSlugUsedInOtherGrapher() {
        const rows = await db.knexRaw<Pick<DbRawChart, "id">>(
            knex,
            `SELECT id FROM charts WHERE id != ? AND config->>"$.isPublished" = "true" AND JSON_EXTRACT(config, "$.slug") = ?`,
            // -1 is a placeholder ID that will never exist; but we cannot use NULL because
            // in that case we would always get back an empty resultset
            [existingConfig ? existingConfig.id : -1, newConfig.slug]
        )
        return rows.length > 0
    }

    // When a chart is published, check for conflicts
    if (newConfig.isPublished) {
        if (!isValidSlug(newConfig.slug))
            throw new JsonError(`Invalid chart slug ${newConfig.slug}`)
        else if (await isSlugUsedInRedirect())
            throw new JsonError(
                `This chart slug was previously used by another chart: ${newConfig.slug}`
            )
        else if (await isSlugUsedInOtherGrapher())
            throw new JsonError(
                `This chart slug is in use by another published chart: ${newConfig.slug}`
            )
        else if (
            existingConfig &&
            existingConfig.isPublished &&
            existingConfig.slug !== newConfig.slug
        ) {
            // Changing slug of an existing chart, delete any old redirect and create new one
            await db.knexRaw(
                knex,
                `DELETE FROM chart_slug_redirects WHERE chart_id = ? AND slug = ?`,
                [existingConfig.id, existingConfig.slug]
            )
            await db.knexRaw(
                knex,
                `INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`,
                [existingConfig.id, existingConfig.slug]
            )
        }
    }

    if (existingConfig)
        // Bump chart version, very important for cachebusting
        newConfig.version = existingConfig.version! + 1
    else if (newConfig.version)
        // If a chart is republished, we want to keep incrementing the old version number,
        // otherwise it can lead to clients receiving cached versions of the old data.
        newConfig.version += 1
    else newConfig.version = 1

    // Execute the actual database update or creation
    const now = new Date()
    let chartId = existingConfig && existingConfig.id
    const newJsonConfig = JSON.stringify(newConfig)
    if (existingConfig)
        await db.knexRaw(
            knex,
            `UPDATE charts SET config=?, updatedAt=?, lastEditedAt=?, lastEditedByUserId=? WHERE id = ?`,
            [newJsonConfig, now, now, user.id, chartId]
        )
    else {
        const result = await db.knexRawInsert(
            knex,
            `INSERT INTO charts (config, createdAt, updatedAt, lastEditedAt, lastEditedByUserId) VALUES (?)`,
            [[newJsonConfig, now, now, now, user.id]]
        )
        chartId = result.insertId
    }

    // Record this change in version history

    const chartRevisionLog = {
        chartId: chartId as number,
        userId: user.id,
        config: serializeChartConfig(newConfig),
        createdAt: new Date(),
        updatedAt: new Date(),
    } satisfies DbInsertChartRevision
    await db.knexRaw(
        knex,
        `INSERT INTO chart_revisions (chartId, userId, config, createdAt, updatedAt) VALUES (?)`,
        [
            [
                chartRevisionLog.chartId,
                chartRevisionLog.userId,
                chartRevisionLog.config,
                chartRevisionLog.createdAt,
                chartRevisionLog.updatedAt,
            ],
        ]
    )

    // Remove any old dimensions and store the new ones
    // We only note that a relationship exists between the chart and variable in the database; the actual dimension configuration is left to the json
    await db.knexRaw(knex, `DELETE FROM chart_dimensions WHERE chartId=?`, [
        chartId,
    ])

    const newDimensions = newConfig.dimensions ?? []
    for (const [i, dim] of newDimensions.entries()) {
        await db.knexRaw(
            knex,
            `INSERT INTO chart_dimensions (chartId, variableId, property, \`order\`) VALUES (?)`,
            [[chartId, dim.variableId, dim.property, i]]
        )
    }

    // So we can generate country profiles including this chart data
    if (newConfig.isPublished && referencedVariablesMightChange)
        // TODO: remove this ad hoc knex transaction context when we switch the function to knex
        await denormalizeLatestCountryData(
            knex,
            newDimensions.map((d) => d.variableId)
        )

    if (
        newConfig.isPublished &&
        (!existingConfig || !existingConfig.isPublished)
    ) {
        // Newly published, set publication info
        await db.knexRaw(
            knex,
            `UPDATE charts SET publishedAt=?, publishedByUserId=? WHERE id = ? `,
            [now, user.id, chartId]
        )
        await triggerStaticBuild(user, `Publishing chart ${newConfig.slug}`)
    } else if (
        !newConfig.isPublished &&
        existingConfig &&
        existingConfig.isPublished
    ) {
        // Unpublishing chart, delete any existing redirects to it
        await db.knexRaw(
            knex,
            `DELETE FROM chart_slug_redirects WHERE chart_id = ?`,
            [existingConfig.id]
        )
        await triggerStaticBuild(user, `Unpublishing chart ${newConfig.slug}`)
    } else if (newConfig.isPublished)
        await triggerStaticBuild(user, `Updating chart ${newConfig.slug}`)

    return chartId
}

getRouteWithROTransaction(apiRouter, "/charts.json", async (req, res, trx) => {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000
    const charts = await db.knexRaw<OldChartFieldList>(
        trx,
        `-- sql
        SELECT ${oldChartFieldList} FROM charts
        JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
        LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
        ORDER BY charts.lastEditedAt DESC LIMIT ?
    `,
        [limit]
    )

    await assignTagsForCharts(trx, charts)

    return { charts }
})

apiRouter.get("/charts.csv", async (req, res) => {
    const limit = parseIntOrUndefined(req.query.limit as string) ?? 10000

    // note: this query is extended from OldChart.listFields.
    const charts = await db.queryMysql(
        `
        SELECT
            charts.id,
            charts.config->>"$.version" AS version,
            CONCAT("${BAKED_BASE_URL}/grapher/", charts.config->>"$.slug") AS url,
            CONCAT("${ADMIN_BASE_URL}", "/admin/charts/", charts.id, "/edit") AS editUrl,
            charts.config->>"$.slug" AS slug,
            charts.config->>"$.title" AS title,
            charts.config->>"$.subtitle" AS subtitle,
            charts.config->>"$.sourceDesc" AS sourceDesc,
            charts.config->>"$.note" AS note,
            charts.config->>"$.type" AS type,
            charts.config->>"$.internalNotes" AS internalNotes,
            charts.config->>"$.variantName" AS variantName,
            charts.config->>"$.isPublished" AS isPublished,
            charts.config->>"$.tab" AS tab,
            JSON_EXTRACT(charts.config, "$.hasChartTab") = true AS hasChartTab,
            JSON_EXTRACT(charts.config, "$.hasMapTab") = true AS hasMapTab,
            charts.config->>"$.originUrl" AS originUrl,
            charts.lastEditedAt,
            charts.lastEditedByUserId,
            lastEditedByUser.fullName AS lastEditedBy,
            charts.publishedAt,
            charts.publishedByUserId,
            publishedByUser.fullName AS publishedBy
        FROM charts
        JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
        LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
        ORDER BY charts.lastEditedAt DESC
        LIMIT ?
    `,
        [limit]
    )
    // note: retrieving references is VERY slow.
    // await Promise.all(
    //     charts.map(async (chart: any) => {
    //         const references = await getReferencesByChartId(chart.id)
    //         chart.references = references.length
    //             ? references.map((ref) => ref.url)
    //             : ""
    //     })
    // )
    // await Chart.assignTagsForCharts(charts)
    res.setHeader("Content-disposition", "attachment; filename=charts.csv")
    res.setHeader("content-type", "text/csv")
    const csv = Papa.unparse(charts)
    return csv
})

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.config.json",
    async (req, res, trx) => expectChartById(trx, req.params.chartId)
)

apiRouter.get("/editorData/namespaces.json", async (req, res) => {
    const rows = (await db.queryMysql(
        `SELECT DISTINCT
                namespace AS name,
                namespaces.description AS description,
                namespaces.isArchived AS isArchived
            FROM active_datasets
            JOIN namespaces ON namespaces.name = active_datasets.namespace`
    )) as { name: string; description?: string; isArchived: boolean }[]

    return {
        namespaces: lodash
            .sortBy(rows, (row) => row.description)
            .map((namespace) => ({
                ...namespace,
                isArchived: !!namespace.isArchived,
            })),
    }
})

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.logs.json",
    async (req, res, trx) => ({
        logs: await getLogsByChartId(
            trx,
            parseInt(req.params.chartId as string)
        ),
    })
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.references.json",
    async (req, res, trx) => {
        const references = {
            references: await getReferencesByChartId(
                parseInt(req.params.chartId as string),
                trx
            ),
        }
        return references
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.redirects.json",
    async (req, res, trx) => ({
        redirects: await getRedirectsByChartId(
            trx,
            parseInt(req.params.chartId as string)
        ),
    })
)

getRouteWithROTransaction(
    apiRouter,
    "/charts/:chartId.pageviews.json",
    async (req, res, trx) => {
        const slug = await getChartSlugById(
            trx,
            parseInt(req.params.chartId as string)
        )
        if (!slug) return {}

        const pageviewsByUrl = await db.knexRawFirst(
            trx,
            "select * from analytics_pageviews where url = ?",
            [`https://ourworldindata.org/grapher/${slug}`]
        )

        return {
            pageviews: pageviewsByUrl ?? undefined,
        }
    }
)

apiRouter.get("/topics.json", async (req, res) => ({
    topics: await DEPRECATEDgetTopics(),
}))
getRouteWithROTransaction(
    apiRouter,
    "/editorData/variables.json",
    async (req, res, trx) => {
        const datasets = []
        const rows = await db.knexRaw<
            Pick<DbRawVariable, "name" | "id"> & {
                datasetId: number
                datasetName: string
                datasetVersion: string
            } & Pick<
                    DbPlainDataset,
                    "namespace" | "isPrivate" | "nonRedistributable"
                >
        >(
            trx,
            `-- sql
        SELECT
                v.name,
                v.id,
                d.id as datasetId,
                d.name as datasetName,
                d.version as datasetVersion,
                d.namespace,
                d.isPrivate,
                d.nonRedistributable
            FROM variables as v JOIN active_datasets as d ON v.datasetId = d.id
            ORDER BY d.updatedAt DESC
            `
        )

        let dataset:
            | {
                  id: number
                  name: string
                  version: string
                  namespace: string
                  isPrivate: boolean
                  nonRedistributable: boolean
                  variables: { id: number; name: string }[]
              }
            | undefined
        for (const row of rows) {
            if (!dataset || row.datasetName !== dataset.name) {
                if (dataset) datasets.push(dataset)

                dataset = {
                    id: row.datasetId,
                    name: row.datasetName,
                    version: row.datasetVersion,
                    namespace: row.namespace,
                    isPrivate: !!row.isPrivate,
                    nonRedistributable: !!row.nonRedistributable,
                    variables: [],
                }
            }

            dataset.variables.push({
                id: row.id,
                name: row.name ?? "",
            })
        }

        if (dataset) datasets.push(dataset)

        return { datasets: datasets }
    }
)

apiRouter.get("/data/variables/data/:variableStr.json", async (req, res) => {
    const variableStr = req.params.variableStr as string
    if (!variableStr) throw new JsonError("No variable id given")
    if (variableStr.includes("+"))
        throw new JsonError(
            "Requesting multiple variables at the same time is no longer supported"
        )
    const variableId = parseInt(variableStr)
    if (isNaN(variableId)) throw new JsonError("Invalid variable id")
    return await fetchS3DataValuesByPath(
        getVariableDataRoute(DATA_API_URL, variableId) + "?nocache"
    )
})

apiRouter.get(
    "/data/variables/metadata/:variableStr.json",
    async (req, res) => {
        const variableStr = req.params.variableStr as string
        if (!variableStr) throw new JsonError("No variable id given")
        if (variableStr.includes("+"))
            throw new JsonError(
                "Requesting multiple variables at the same time is no longer supported"
            )
        const variableId = parseInt(variableStr)
        if (isNaN(variableId)) throw new JsonError("Invalid variable id")
        return await fetchS3MetadataByPath(
            getVariableMetadataRoute(DATA_API_URL, variableId) + "?nocache"
        )
    }
)

postRouteWithRWTransaction(apiRouter, "/charts", async (req, res, trx) => {
    const chartId = await saveGrapher(trx, res.locals.user, req.body)

    return { success: true, chartId: chartId }
})

postRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId/setTags",
    async (req, res, trx) => {
        const chartId = expectInt(req.params.chartId)

        await setChartTags(trx, chartId, req.body.tags)

        return { success: true }
    }
)

putRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId",
    async (req, res, trx) => {
        const existingConfig = await expectChartById(trx, req.params.chartId)

        await saveGrapher(trx, res.locals.user, req.body, existingConfig)

        const logs = await getLogsByChartId(trx, existingConfig.id as number)
        return { success: true, chartId: existingConfig.id, newLog: logs[0] }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId",
    async (req, res, trx) => {
        const chart = await expectChartById(trx, req.params.chartId)
        const links = await Link.getPublishedLinksTo([chart.slug!])
        if (links.length) {
            const sources = links.map((link) => link.source.slug).join(", ")
            throw new Error(
                `Cannot delete chart in-use in the following published documents: ${sources}`
            )
        }

        await db.knexRaw(trx, `DELETE FROM chart_dimensions WHERE chartId=?`, [
            chart.id,
        ])
        await db.knexRaw(
            trx,
            `DELETE FROM chart_slug_redirects WHERE chart_id=?`,
            [chart.id]
        )
        await db.knexRaw(
            trx,
            `DELETE FROM suggested_chart_revisions WHERE chartId=?`,
            [chart.id]
        )
        await db.knexRaw(trx, `DELETE FROM charts WHERE id=?`, [chart.id])

        if (chart.isPublished)
            await triggerStaticBuild(
                res.locals.user,
                `Deleting chart ${chart.slug}`
            )

        return { success: true }
    }
)

apiRouter.get("/suggested-chart-revisions", async (req, res) => {
    const isValidSortBy = (sortBy: string) => {
        return [
            "updatedAt",
            "createdAt",
            "suggestedReason",
            "id",
            "chartId",
            "status",
            "variableId",
            "chartUpdatedAt",
            "chartCreatedAt",
        ].includes(sortBy)
    }
    const isValidSortOrder = (sortOrder: string) => {
        return (
            sortOrder !== undefined &&
            sortOrder !== null &&
            ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        )
    }
    const limit =
        req.query.limit !== undefined ? expectInt(req.query.limit) : 10000
    const offset =
        req.query.offset !== undefined ? expectInt(req.query.offset) : 0
    const sortBy = isValidSortBy(req.query.sortBy as string)
        ? req.query.sortBy
        : "updatedAt"
    const sortOrder = isValidSortOrder(req.query.sortOrder as string)
        ? (req.query.sortOrder as string).toUpperCase()
        : "DESC"
    const status = SuggestedChartRevision.isValidStatus(
        req.query.status as SuggestedChartRevisionStatus
    )
        ? req.query.status
        : null

    let orderBy
    if (sortBy === "variableId") {
        orderBy =
            "CAST(scr.suggestedConfig->>'$.dimensions[0].variableId' as SIGNED)"
    } else if (sortBy === "chartUpdatedAt") {
        orderBy = "c.updatedAt"
    } else if (sortBy === "chartCreatedAt") {
        orderBy = "c.createdAt"
    } else {
        orderBy = `scr.${sortBy}`
    }

    const suggestedChartRevisions = await db.queryMysql(
        `-- sql
            SELECT scr.id, scr.chartId, scr.updatedAt, scr.createdAt,
                scr.suggestedReason, scr.decisionReason, scr.status,
                scr.suggestedConfig, scr.originalConfig, scr.changesInDataSummary,
                scr.experimental,
                createdByUser.id as createdById,
                updatedByUser.id as updatedById,
                createdByUser.fullName as createdByFullName,
                updatedByUser.fullName as updatedByFullName,
                c.config as existingConfig, c.updatedAt as chartUpdatedAt,
                c.createdAt as chartCreatedAt
            FROM suggested_chart_revisions as scr
            LEFT JOIN charts c on c.id = scr.chartId
            LEFT JOIN users createdByUser on createdByUser.id = scr.createdBy
            LEFT JOIN users updatedByUser on updatedByUser.id = scr.updatedBy
            ${status ? "WHERE scr.status = ?" : ""}
            ORDER BY ${orderBy} ${sortOrder}
            LIMIT ? OFFSET ?
        `,
        status ? [status, limit, offset] : [limit, offset]
    )

    let numTotalRows = (
        await db.queryMysql(
            `
                SELECT COUNT(*) as count
                FROM suggested_chart_revisions
                ${status ? "WHERE status = ?" : ""}
            `,
            status ? [status] : []
        )
    )[0].count
    numTotalRows = numTotalRows ? parseInt(numTotalRows) : numTotalRows

    suggestedChartRevisions.map(
        (suggestedChartRevision: SuggestedChartRevision) => {
            suggestedChartRevision.suggestedConfig = JSON.parse(
                suggestedChartRevision.suggestedConfig
            )
            suggestedChartRevision.existingConfig = JSON.parse(
                suggestedChartRevision.existingConfig
            )
            suggestedChartRevision.originalConfig = JSON.parse(
                suggestedChartRevision.originalConfig
            )
            suggestedChartRevision.experimental = JSON.parse(
                suggestedChartRevision.experimental
            )
            suggestedChartRevision.canApprove =
                SuggestedChartRevision.checkCanApprove(suggestedChartRevision)
            suggestedChartRevision.canReject =
                SuggestedChartRevision.checkCanReject(suggestedChartRevision)
            suggestedChartRevision.canFlag =
                SuggestedChartRevision.checkCanFlag(suggestedChartRevision)
            suggestedChartRevision.canPending =
                SuggestedChartRevision.checkCanPending(suggestedChartRevision)
        }
    )

    return {
        suggestedChartRevisions: suggestedChartRevisions,
        numTotalRows: numTotalRows,
    }
})

apiRouter.post("/suggested-chart-revisions", async (req, res) => {
    const messages: any[] = []
    const status = SuggestedChartRevisionStatus.pending
    const suggestedReason = req.body.suggestedReason
        ? String(req.body.suggestedReason)
        : null
    const changesInDataSummary = req.body.changesInDataSummary
        ? String(req.body.changesInDataSummary)
        : null
    const convertStringsToNull =
        typeof req.body.convertStringsToNull === "boolean"
            ? req.body.convertStringsToNull
            : true
    const suggestedConfigs = req.body.suggestedConfigs as any[]

    // suggestedConfigs must be an array of length > 0
    if (!(Array.isArray(suggestedConfigs) && suggestedConfigs.length > 0)) {
        throw new JsonError(
            "POST body must contain a `suggestedConfigs` property, which must be an Array with length > 0."
        )
    }

    // tries to convert each config field to json (e.g. the `map` field
    // should be converted to json if it is present).
    suggestedConfigs.map((config) => {
        Object.keys(config).map((k) => {
            try {
                const json = JSON.parse(config[k])
                config[k] = json
            } catch (error) {
                // do nothing.
            }
        })
    })

    // checks for required keys
    const requiredKeys = ["id", "version"]
    suggestedConfigs.map((config) => {
        requiredKeys.map((k) => {
            if (!config.hasOwnProperty(k)) {
                throw new JsonError(
                    `The "${k}" field is required, but one or more chart configs in the POST body does not contain it.`
                )
            }
        })
    })

    // safely sets types of keys that are used in db queries below.
    const typeConversions = [
        { key: "id", expectedType: "number", f: expectInt },
        { key: "version", expectedType: "number", f: expectInt },
    ]
    suggestedConfigs.map((config) => {
        typeConversions.map((obj) => {
            config[obj.key] = obj.f(config[obj.key])
            if (
                config[obj.key] !== null &&
                config[obj.key] !== undefined &&
                typeof config[obj.key] !== obj.expectedType
            ) {
                throw new JsonError(
                    `Expected all "${obj.key}" values to be non-null and of ` +
                        `type "${obj.expectedType}", but one or more chart ` +
                        `configs contains a "${obj.key}" value that does ` +
                        `not meet this criteria.`
                )
            }
        })
    })

    // checks for invalid keys
    const uniqKeys = new Set()
    suggestedConfigs.map((config) => {
        Object.keys(config).forEach((item) => {
            uniqKeys.add(item)
        })
    })
    const invalidKeys = [...uniqKeys].filter(
        (v) => !grapherKeysToSerialize.includes(v as string)
    )
    if (invalidKeys.length > 0) {
        throw new JsonError(
            `The following fields are not valid chart config fields: ${invalidKeys}`
        )
    }

    // checks that no duplicate chart ids are present.
    const chartIds = suggestedConfigs.map((config) => config.id)
    if (new Set(chartIds).size !== chartIds.length) {
        throw new JsonError(
            `Found one or more duplicate chart ids in POST body.`
        )
    }

    // converts some strings to null
    if (convertStringsToNull) {
        const isNullString = (value: string): boolean => {
            const nullStrings = ["nan", "na"]
            return nullStrings.includes(value.toLowerCase())
        }
        suggestedConfigs.map((config) => {
            for (const key of Object.keys(config)) {
                if (
                    typeof config[key] === "string" &&
                    isNullString(config[key])
                ) {
                    config[key] = null
                }
            }
        })
    }

    // empty strings mean that the field should NOT be overwritten, so we
    // remove key-value pairs where value === ""
    suggestedConfigs.map((config) => {
        for (const key of Object.keys(config)) {
            if (config[key] === "") {
                delete config[key]
            }
        }
    })

    await db.transaction(async (t) => {
        const whereCond1 = suggestedConfigs
            .map(
                (config) =>
                    `(id = ${escape(
                        config.id
                    )} AND config->"$.version" = ${escape(config.version)})`
            )
            .join(" OR ")
        const whereCond2 = suggestedConfigs
            .map(
                (config) =>
                    `(chartId = ${escape(
                        config.id
                    )} AND config->"$.version" = ${escape(config.version)})`
            )
            .join(" OR ")
        // retrieves original chart configs
        let rows: any[] = await t.query(
            `
                SELECT id, config, 1 as priority
                FROM charts
                WHERE ${whereCond1}

                UNION

                SELECT chartId as id, config, 2 as priority
                FROM chart_revisions
                WHERE ${whereCond2}

                ORDER BY priority
                `
        )

        rows.map((row) => {
            row.config = JSON.parse(row.config)
        })

        // drops duplicate id-version rows (keeping the row from the
        // `charts` table when available).
        rows = rows.filter(
            (v, i, a) =>
                a.findIndex(
                    (el) =>
                        el.id === v.id && el.config.version === v.config.version
                ) === i
        )
        if (rows.length < suggestedConfigs.length) {
            // identifies which particular chartId-version combinations have
            // not been found in the DB
            const missingConfigs = suggestedConfigs.filter((config) => {
                const i = rows.findIndex((row) => {
                    return (
                        row.id === config.id &&
                        row.config.version === config.version
                    )
                })
                return i === -1
            })
            throw new JsonError(
                `Failed to retrieve the following chartId-version combinations:\n${missingConfigs
                    .map((c) => {
                        return JSON.stringify({
                            id: c.id,
                            version: c.version,
                        })
                    })
                    .join(
                        "\n"
                    )}\nPlease check that each chartId and version exists.`
            )
        } else if (rows.length > suggestedConfigs.length) {
            throw new JsonError(
                "Retrieved more chart configs than expected. This may be due to a bug on the server."
            )
        }
        const originalConfigs: Record<string, GrapherInterface> = rows.reduce(
            (obj: any, row: any) => ({
                ...obj,
                [row.id]: row.config,
            }),
            {}
        )

        // some chart configs do not have an `id` field, so we check for it
        // and insert the id here as needed. This is important for the
        // lodash.isEqual condition later on.
        for (const [id, config] of Object.entries(originalConfigs)) {
            if (config.id === null || config.id === undefined) {
                config.id = parseInt(id)
            }
        }

        // sanity check that each original config also has the required keys.
        Object.values(originalConfigs).map((config) => {
            requiredKeys.map((k) => {
                if (!config.hasOwnProperty(k)) {
                    throw new JsonError(
                        `The "${k}" field is required, but one or more ` +
                            `chart configs in the database does not ` +
                            `contain it. Please report this issue to a ` +
                            `developer.`
                    )
                }
            })
        })

        // if a field is null in the suggested config and the field does not
        // exist in the original config, then we can delete the field from
        // the suggested config b/c the non-existence of the field on the
        // original config is equivalent to null.
        suggestedConfigs.map((config: any) => {
            const chartId = config.id as number
            const originalConfig = originalConfigs[chartId]
            for (const key of Object.keys(config)) {
                if (
                    config[key] === null &&
                    !originalConfig.hasOwnProperty(key)
                ) {
                    delete config[key]
                }
            }
        })

        // constructs array of suggested chart revisions to insert.
        const values: any[] = []
        suggestedConfigs.map((config) => {
            const chartId = config.id as number
            const originalConfig = originalConfigs[chartId]
            const suggestedConfig: GrapherInterface = Object.assign(
                {},
                JSON.parse(JSON.stringify(originalConfig)),
                config
            )
            if (!lodash.isEqual(suggestedConfig, originalConfig)) {
                if (suggestedConfig.version) {
                    suggestedConfig.version += 1
                }
                values.push([
                    chartId,
                    JSON.stringify(suggestedConfig),
                    JSON.stringify(originalConfig),
                    suggestedReason,
                    changesInDataSummary,
                    status,
                    res.locals.user.id,
                    new Date(),
                    new Date(),
                ])
            }
        })

        // inserts suggested chart revisions
        const result = await t.execute(
            `
                INSERT INTO suggested_chart_revisions
                (chartId, suggestedConfig, originalConfig, suggestedReason, changesInDataSummary, status, createdBy, createdAt, updatedAt)
                VALUES
                ?
                `,
            [values]
        )
        if (result.affectedRows > 0) {
            messages.push({
                type: "success",
                text: `${result.affectedRows} chart revisions have been queued for approval.`,
            })
        }
        if (suggestedConfigs.length - result.affectedRows > 0) {
            messages.push({
                type: "warning",
                text: `${
                    suggestedConfigs.length - result.affectedRows
                } chart revisions have not been queued for approval (e.g. because the chart revision does not contain any changes).`,
            })
        }
    })

    return { success: true, messages }
})

apiRouter.get(
    "/suggested-chart-revisions/:suggestedChartRevisionId",
    async (req, res) => {
        const suggestedChartRevisionId = expectInt(
            req.params.suggestedChartRevisionId
        )

        const suggestedChartRevision = await db.mysqlFirst(
            `-- sql
            SELECT scr.id, scr.chartId, scr.updatedAt, scr.createdAt,
                scr.suggestedReason, scr.decisionReason, scr.status,
                scr.suggestedConfig, scr.changesInDataSummary, scr.originalConfig,
                createdByUser.id as createdById,
                updatedByUser.id as updatedById,
                createdByUser.fullName as createdByFullName,
                updatedByUser.fullName as updatedByFullName,
                c.config as existingConfig, c.updatedAt as chartUpdatedAt,
                c.createdAt as chartCreatedAt
            FROM suggested_chart_revisions as scr
            LEFT JOIN charts c on c.id = scr.chartId
            LEFT JOIN users createdByUser on createdByUser.id = scr.createdBy
            LEFT JOIN users updatedByUser on updatedByUser.id = scr.updatedBy
            WHERE scr.id = ?
        `,
            [suggestedChartRevisionId]
        )

        if (!suggestedChartRevision) {
            throw new JsonError(
                `No suggested chart revision by id '${suggestedChartRevisionId}'`,
                404
            )
        }

        suggestedChartRevision.suggestedConfig = JSON.parse(
            suggestedChartRevision.suggestedConfig
        )
        suggestedChartRevision.originalConfig = JSON.parse(
            suggestedChartRevision.originalConfig
        )
        suggestedChartRevision.existingConfig = JSON.parse(
            suggestedChartRevision.existingConfig
        )
        suggestedChartRevision.canApprove =
            SuggestedChartRevision.checkCanApprove(suggestedChartRevision)
        suggestedChartRevision.canReject =
            SuggestedChartRevision.checkCanReject(suggestedChartRevision)
        suggestedChartRevision.canFlag = SuggestedChartRevision.checkCanFlag(
            suggestedChartRevision
        )
        suggestedChartRevision.canPending =
            SuggestedChartRevision.checkCanPending(suggestedChartRevision)

        return {
            suggestedChartRevision: suggestedChartRevision,
        }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/suggested-chart-revisions/:suggestedChartRevisionId/update",
    async (req, res, trx) => {
        const suggestedChartRevisionId = expectInt(
            req.params.suggestedChartRevisionId
        )

        const { suggestedConfig, status, decisionReason } = req.body as {
            suggestedConfig: GrapherInterface
            status: string
            decisionReason: string
        }

        // TODO: remove the :any type when the code below is refactored
        const suggestedChartRevision: any = await db.knexRawFirst<
            Pick<
                DbRawSuggestedChartRevision,
                "id" | "chartId" | "suggestedConfig" | "originalConfig"
            >
        >(
            trx,
            `SELECT id, chartId, suggestedConfig, originalConfig, status FROM suggested_chart_revisions WHERE id=?`,
            [suggestedChartRevisionId]
        )
        if (!suggestedChartRevision) {
            throw new JsonError(
                `No suggested chart revision found for id '${suggestedChartRevisionId}'`,
                404
            )
        }
        if (suggestedConfig !== undefined && suggestedConfig !== null) {
            suggestedChartRevision.suggestedConfig = suggestedConfig
        } else {
            suggestedChartRevision.suggestedConfig = JSON.parse(
                suggestedChartRevision.suggestedConfig
            )
        }
        suggestedChartRevision.originalConfig = JSON.parse(
            suggestedChartRevision.originalConfig
        )
        suggestedChartRevision.existingConfig = await expectChartById(
            trx,
            suggestedChartRevision.chartId
        )

        const canApprove = SuggestedChartRevision.checkCanApprove(
            suggestedChartRevision
        )
        const canReject = SuggestedChartRevision.checkCanReject(
            suggestedChartRevision
        )
        const canFlag = SuggestedChartRevision.checkCanFlag(
            suggestedChartRevision
        )
        const canPending = SuggestedChartRevision.checkCanPending(
            suggestedChartRevision
        )

        const canUpdate =
            (status === "approved" && canApprove) ||
            (status === "rejected" && canReject) ||
            (status === "pending" && canPending) ||
            (status === "flagged" && canFlag)
        if (!canUpdate) {
            throw new JsonError(
                `Suggest chart revision ${suggestedChartRevisionId} cannot be ` +
                    `updated with status="${status}".`,
                404
            )
        }

        await db.knexRaw(
            trx,
            `
                UPDATE suggested_chart_revisions
                SET status=?, decisionReason=?, updatedAt=?, updatedBy=?
                WHERE id = ?
                `,
            [
                status,
                decisionReason,
                new Date(),
                res.locals.user.id,
                suggestedChartRevisionId,
            ]
        )

        // Update config ONLY when APPROVE button is clicked
        // Makes sense when the suggested config is a sugegstion by GPT, otherwise is redundant but we are cool with it
        if (status === SuggestedChartRevisionStatus.approved) {
            await db.knexRaw(
                trx,
                `
                    UPDATE suggested_chart_revisions
                    SET suggestedConfig=?
                    WHERE id = ?
                    `,
                [
                    JSON.stringify(suggestedChartRevision.suggestedConfig),
                    suggestedChartRevisionId,
                ]
            )
        }
        // note: the calls to saveGrapher() below will never overwrite a config
        // that has been changed since the suggestedConfig was created, because
        // if the config has been changed since the suggestedConfig was created
        // then canUpdate will be false (so an error would have been raised
        // above).

        if (status === "approved" && canApprove) {
            await saveGrapher(
                trx,
                res.locals.user,
                suggestedChartRevision.suggestedConfig,
                suggestedChartRevision.existingConfig
            )
        } else if (
            status === "rejected" &&
            canReject &&
            suggestedChartRevision.status === "approved"
        ) {
            await saveGrapher(
                trx,
                res.locals.user,
                suggestedChartRevision.originalConfig,
                suggestedChartRevision.existingConfig
            )
        }

        return { success: true }
    }
)

getRouteWithROTransaction(apiRouter, "/users.json", async (req, res, trx) => ({
    users: await trx
        .select(
            "id" satisfies keyof DbPlainUser,
            "email" satisfies keyof DbPlainUser,
            "fullName" satisfies keyof DbPlainUser,
            "isActive" satisfies keyof DbPlainUser,
            "isSuperuser" satisfies keyof DbPlainUser,
            "createdAt" satisfies keyof DbPlainUser,
            "updatedAt" satisfies keyof DbPlainUser,
            "lastLogin" satisfies keyof DbPlainUser,
            "lastSeen" satisfies keyof DbPlainUser
        )
        .from<DbPlainUser>(UsersTableName)
        .orderBy("lastSeen", "desc"),
}))

getRouteWithROTransaction(
    apiRouter,
    "/users/:userId.json",
    async (req, res, trx) => {
        const id = parseIntOrUndefined(req.params.userId)
        if (!id) throw new JsonError("No user id given")
        const user = await getUserById(trx, id)
        return { user }
    }
)

apiRouter.delete("/users/:userId", async (req, res) => {
    if (!res.locals.user.isSuperuser)
        throw new JsonError("Permission denied", 403)

    const userId = expectInt(req.params.userId)
    await db.transaction(async (t) => {
        await t.execute(`DELETE FROM users WHERE id=?`, [userId])
    })

    return { success: true }
})

putRouteWithRWTransaction(
    apiRouter,
    "/users/:userId",
    async (req, res, trx: db.KnexReadWriteTransaction) => {
        if (!res.locals.user.isSuperuser)
            throw new JsonError("Permission denied", 403)

        const userId = parseIntOrUndefined(req.params.userId)
        const user =
            userId !== undefined ? await getUserById(trx, userId) : null
        if (!user) throw new JsonError("No such user", 404)

        user.fullName = req.body.fullName
        user.isActive = req.body.isActive

        await updateUser(trx, userId!, pick(user, ["fullName", "isActive"]))

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/users/add",
    async (req, res, trx: db.KnexReadWriteTransaction) => {
        if (!res.locals.user.isSuperuser)
            throw new JsonError("Permission denied", 403)

        const { email, fullName } = req.body

        await insertUser(trx, {
            email,
            fullName,
        })

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/variables.json",
    async (req, res, trx) => {
        const limit = parseIntOrUndefined(req.query.limit as string) ?? 50
        const query = req.query.search as string
        return await searchVariables(query, limit, trx)
    }
)

apiRouter.get(
    "/chart-bulk-update",
    async (
        req
    ): Promise<BulkGrapherConfigResponse<BulkChartEditResponseRow>> => {
        const context: OperationContext = {
            grapherConfigFieldName: "config",
            whitelistedColumnNamesAndTypes:
                chartBulkUpdateAllowedColumnNamesAndTypes,
        }
        const filterSExpr =
            req.query.filter !== undefined
                ? parseToOperation(req.query.filter as string, context)
                : undefined

        const offset = parseIntOrUndefined(req.query.offset as string) ?? 0

        // Note that our DSL generates sql here that we splice directly into the SQL as text
        // This is a potential for a SQL injection attack but we control the DSL and are
        // careful there to only allow carefully guarded vocabularies from being used, not
        // arbitrary user input
        const whereClause = filterSExpr?.toSql() ?? "true"
        const resultsWithStringGrapherConfigs =
            await db.queryMysql(`SELECT charts.id as id,
            charts.config as config,
            charts.createdAt as createdAt,
            charts.updatedAt as updatedAt,
            charts.lastEditedAt as lastEditedAt,
            charts.publishedAt as publishedAt,
            lastEditedByUser.fullName as lastEditedByUser,
            publishedByUser.fullName as publishedByUser
FROM charts
LEFT JOIN users lastEditedByUser ON lastEditedByUser.id=charts.lastEditedByUserId
LEFT JOIN users publishedByUser ON publishedByUser.id=charts.publishedByUserId
WHERE ${whereClause}
ORDER BY charts.id DESC
LIMIT 50
OFFSET ${offset.toString()}`)

        const results = resultsWithStringGrapherConfigs.map((row: any) => ({
            ...row,
            config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
        }))
        const resultCount = await db.queryMysql(`SELECT count(*) as count
FROM charts
WHERE ${whereClause}`)
        return { rows: results, numTotalRows: resultCount[0].count }
    }
)

patchRouteWithRWTransaction(
    apiRouter,
    "/chart-bulk-update",
    async (req, res, trx) => {
        const patchesList = req.body as GrapherConfigPatch[]
        const chartIds = new Set(patchesList.map((patch) => patch.id))

        const configsAndIds = await db.knexRaw<
            Pick<DbRawChart, "id" | "config">
        >(trx, `SELECT id, config FROM charts where id IN (?)`, [
            [...chartIds.values()],
        ])
        const configMap = new Map<number, GrapherInterface>(
            configsAndIds.map((item: any) => [
                item.id,
                // make sure that the id is set, otherwise the update behaviour is weird
                // TODO: discuss if this has unintended side effects
                item.config ? { ...JSON.parse(item.config), id: item.id } : {},
            ])
        )
        const oldValuesConfigMap = new Map(configMap)
        // console.log("ids", configsAndIds.map((item : any) => item.id))
        for (const patchSet of patchesList) {
            const config = configMap.get(patchSet.id)
            configMap.set(patchSet.id, applyPatch(patchSet, config))
        }

        for (const [id, newConfig] of configMap.entries()) {
            await saveGrapher(
                trx,
                res.locals.user,
                newConfig,
                oldValuesConfigMap.get(id),
                false
            )
        }

        return { success: true }
    }
)

apiRouter.get(
    "/variable-annotations",
    async (
        req
    ): Promise<BulkGrapherConfigResponse<VariableAnnotationsResponseRow>> => {
        const context: OperationContext = {
            grapherConfigFieldName: "grapherConfigAdmin",
            whitelistedColumnNamesAndTypes:
                variableAnnotationAllowedColumnNamesAndTypes,
        }
        const filterSExpr =
            req.query.filter !== undefined
                ? parseToOperation(req.query.filter as string, context)
                : undefined

        const offset = parseIntOrUndefined(req.query.offset as string) ?? 0

        // Note that our DSL generates sql here that we splice directly into the SQL as text
        // This is a potential for a SQL injection attack but we control the DSL and are
        // careful there to only allow carefully guarded vocabularies from being used, not
        // arbitrary user input
        const whereClause = filterSExpr?.toSql() ?? "true"
        const resultsWithStringGrapherConfigs =
            await db.queryMysql(`SELECT variables.id as id,
            variables.name as name,
            variables.grapherConfigAdmin as config,
            d.name as datasetname,
            namespaces.name as namespacename,
            variables.createdAt as createdAt,
            variables.updatedAt as updatedAt,
            variables.description as description
FROM variables
LEFT JOIN active_datasets as d on variables.datasetId = d.id
LEFT JOIN namespaces on d.namespace = namespaces.name
WHERE ${whereClause}
ORDER BY variables.id DESC
LIMIT 50
OFFSET ${offset.toString()}`)

        const results = resultsWithStringGrapherConfigs.map((row: any) => ({
            ...row,
            config: lodash.isNil(row.config) ? null : JSON.parse(row.config),
        }))
        const resultCount = await db.queryMysql(`SELECT count(*) as count
FROM variables
LEFT JOIN active_datasets as d on variables.datasetId = d.id
LEFT JOIN namespaces on d.namespace = namespaces.name
WHERE ${whereClause}`)
        return { rows: results, numTotalRows: resultCount[0].count }
    }
)

apiRouter.patch("/variable-annotations", async (req) => {
    const patchesList = req.body as GrapherConfigPatch[]
    const variableIds = new Set(patchesList.map((patch) => patch.id))

    await db.transaction(async (manager) => {
        const configsAndIds = await manager.query(
            `SELECT id, grapherConfigAdmin FROM variables where id IN (?)`,
            [[...variableIds.values()]]
        )
        const configMap = new Map(
            configsAndIds.map((item: any) => [
                item.id,
                item.grapherConfigAdmin ? JSON.parse(item.grapherConfig) : {},
            ])
        )
        // console.log("ids", configsAndIds.map((item : any) => item.id))
        for (const patchSet of patchesList) {
            const config = configMap.get(patchSet.id)
            configMap.set(patchSet.id, applyPatch(patchSet, config))
        }

        for (const [variableId, newConfig] of configMap.entries()) {
            await manager.execute(
                `UPDATE variables SET grapherConfigAdmin = ? where id = ?`,
                [JSON.stringify(newConfig), variableId]
            )
        }
    })

    return { success: true }
})

apiRouter.get("/variables.usages.json", async (req) => {
    const query = `SELECT variableId, COUNT(DISTINCT chartId) AS usageCount
FROM chart_dimensions
GROUP BY variableId
ORDER BY usageCount DESC`

    const rows = await db.queryMysql(query)

    return rows
})

// Used in VariableEditPage
getRouteWithROTransaction(
    apiRouter,
    "/variables/:variableId.json",
    async (req, res, trx) => {
        const variableId = expectInt(req.params.variableId)

        const variable = await fetchS3MetadataByPath(
            getVariableMetadataRoute(DATA_API_URL, variableId) + "?nocache"
        )

        // XXX: Patch shortName onto the end of catalogPath when it's missing,
        //      a temporary hack since our S3 metadata is out of date with our DB.
        //      See: https://github.com/owid/etl/issues/2135
        if (variable.catalogPath && !variable.catalogPath.includes("#")) {
            variable.catalogPath += `#${variable.shortName}`
        }

        const charts = await db.knexRaw<OldChartFieldList>(
            trx,
            `
            SELECT ${oldChartFieldList}
            FROM charts
            JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
            LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
            JOIN chart_dimensions cd ON cd.chartId = charts.id
            WHERE cd.variableId = ?
            GROUP BY charts.id
            `,
            [variableId]
        )

        await assignTagsForCharts(trx, charts)

        const grapherConfig = await getMergedGrapherConfigForVariable(
            variableId,
            trx
        )
        if (
            grapherConfig &&
            (!grapherConfig.dimensions || grapherConfig.dimensions.length === 0)
        ) {
            const dimensions: OwidChartDimensionInterface[] = [
                {
                    variableId: variableId,
                    property: DimensionProperty.y,
                    display: variable.display,
                },
            ]
            grapherConfig.dimensions = dimensions
        }

        const variablesWithCharts: OwidVariableWithSource & {
            charts: Record<string, any>
            grapherConfig: GrapherInterface | undefined
        } = {
            ...variable,
            charts,
            grapherConfig,
        }

        return {
            variable: variablesWithCharts,
        } /*, vardata: await getVariableData([variableId]) }*/
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/datasets.json",
    async (req, res, trx) => {
        const datasets = await db.knexRaw<Record<string, any>>(
            trx,
            `
        WITH variable_counts AS (
            SELECT
                v.datasetId,
                COUNT(DISTINCT cd.chartId) as numCharts
            FROM chart_dimensions cd
            JOIN variables v ON cd.variableId = v.id
            GROUP BY v.datasetId
        )
        SELECT
            ad.id,
            ad.namespace,
            ad.name,
            d.shortName,
            ad.description,
            ad.dataEditedAt,
            du.fullName AS dataEditedByUserName,
            ad.metadataEditedAt,
            mu.fullName AS metadataEditedByUserName,
            ad.isPrivate,
            ad.nonRedistributable,
            d.version,
            vc.numCharts
        FROM active_datasets ad
        LEFT JOIN variable_counts vc ON ad.id = vc.datasetId
        JOIN users du ON du.id=ad.dataEditedByUserId
        JOIN users mu ON mu.id=ad.metadataEditedByUserId
        JOIN datasets d ON d.id=ad.id
        ORDER BY ad.dataEditedAt DESC
    `
        )

        const tags = await db.knexRaw<
            Pick<DbPlainTag, "id" | "name"> &
                Pick<DbPlainDatasetTag, "datasetId">
        >(
            trx,
            `
        SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
        JOIN tags t ON dt.tagId = t.id
    `
        )
        const tagsByDatasetId = lodash.groupBy(tags, (t) => t.datasetId)
        for (const dataset of datasets) {
            dataset.tags = (tagsByDatasetId[dataset.id] || []).map((t) =>
                lodash.omit(t, "datasetId")
            )
        }
        /*LEFT JOIN variables AS v ON v.datasetId=d.id
    GROUP BY d.id*/

        return { datasets: datasets }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/datasets/:datasetId.json",
    async (req: Request, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        const dataset = await db.knexRawFirst<Record<string, any>>(
            trx,
            `
        SELECT d.id,
            d.namespace,
            d.name,
            d.shortName,
            d.version,
            d.description,
            d.updatedAt,
            d.dataEditedAt,
            d.dataEditedByUserId,
            du.fullName AS dataEditedByUserName,
            d.metadataEditedAt,
            d.metadataEditedByUserId,
            mu.fullName AS metadataEditedByUserName,
            d.isPrivate,
            d.isArchived,
            d.nonRedistributable,
            d.updatePeriodDays
        FROM datasets AS d
        JOIN users du ON du.id=d.dataEditedByUserId
        JOIN users mu ON mu.id=d.metadataEditedByUserId
        WHERE d.id = ?
    `,
            [datasetId]
        )

        if (!dataset)
            throw new JsonError(`No dataset by id '${datasetId}'`, 404)

        const zipFile = await db.knexRawFirst<{ filename: string }>(
            trx,
            `SELECT filename FROM dataset_files WHERE datasetId=?`,
            [datasetId]
        )
        if (zipFile) dataset.zipFile = zipFile

        const variables = await db.knexRaw<
            Pick<
                DbRawVariable,
                "id" | "name" | "description" | "display" | "catalogPath"
            >
        >(
            trx,
            `
        SELECT v.id, v.name, v.description, v.display, v.catalogPath
        FROM variables AS v
        WHERE v.datasetId = ?
    `,
            [datasetId]
        )

        for (const v of variables) {
            v.display = JSON.parse(v.display)
        }

        dataset.variables = variables

        // add all origins
        const origins: DbRawOrigin[] = await db.knexRaw<DbRawOrigin>(
            trx,
            `
        select distinct
            o.*
        from origins_variables as ov
        join origins as o on ov.originId = o.id
        join variables as v on ov.variableId = v.id
        where v.datasetId = ?
    `,
            [datasetId]
        )

        const parsedOrigins = origins.map(parseOriginsRow)

        dataset.origins = parsedOrigins

        const sources = await db.knexRaw<{
            id: number
            name: string
            description: string
        }>(
            trx,
            `
        SELECT s.id, s.name, s.description
        FROM sources AS s
        WHERE s.datasetId = ?
        ORDER BY s.id ASC
    `,
            [datasetId]
        )

        // expand description of sources and add to dataset as variableSources
        dataset.variableSources = sources.map((s: any) => {
            return {
                id: s.id,
                name: s.name,
                ...JSON.parse(s.description),
            }
        })

        const charts = await db.knexRaw<OldChartFieldList>(
            trx,
            `
        SELECT ${oldChartFieldList}
        FROM charts
        JOIN chart_dimensions AS cd ON cd.chartId = charts.id
        JOIN variables AS v ON cd.variableId = v.id
        JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
        LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
        WHERE v.datasetId = ?
        GROUP BY charts.id
    `,
            [datasetId]
        )

        dataset.charts = charts

        await assignTagsForCharts(trx, charts)

        const tags = await db.knexRaw<{ id: number; name: string }>(
            trx,
            `
        SELECT t.id, t.name
        FROM tags t
        JOIN dataset_tags dt ON dt.tagId = t.id
        WHERE dt.datasetId = ?
    `,
            [datasetId]
        )
        dataset.tags = tags

        const availableTags = await db.knexRaw<{
            id: number
            name: string
            parentName: string
        }>(
            trx,
            `
        SELECT t.id, t.name, p.name AS parentName
        FROM tags AS t
        JOIN tags AS p ON t.parentId=p.id
        WHERE p.isBulkImport IS FALSE
    `
        )
        dataset.availableTags = availableTags

        return { dataset: dataset }
    }
)

putRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId",
    async (req, res, trx) => {
        // Only updates `nonRedistributable` and `tags`, other fields come from ETL
        // and are not editable
        const datasetId = expectInt(req.params.datasetId)
        const dataset = await getDatasetById(trx, datasetId)
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        const newDataset = (req.body as { dataset: any }).dataset
        await db.knexRaw(
            trx,
            `
            UPDATE datasets
            SET
                nonRedistributable=?,
                metadataEditedAt=?,
                metadataEditedByUserId=?
            WHERE id=?
            `,
            [
                newDataset.nonRedistributable,
                new Date(),
                res.locals.user.id,
                datasetId,
            ]
        )

        const tagRows = newDataset.tags.map((tag: any) => [tag.id, datasetId])
        await db.knexRaw(trx, `DELETE FROM dataset_tags WHERE datasetId=?`, [
            datasetId,
        ])
        if (tagRows.length)
            await db.knexRaw(
                trx,
                `INSERT INTO dataset_tags (tagId, datasetId) VALUES ?`,
                [tagRows]
            )

        try {
            await syncDatasetToGitRepo(trx, datasetId, {
                oldDatasetName: dataset.name,
                commitName: res.locals.user.fullName,
                commitEmail: res.locals.user.email,
            })
        } catch (err) {
            logErrorAndMaybeSendToBugsnag(err, req)
            // Continue
        }

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId/setArchived",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)
        const dataset = await getDatasetById(trx, datasetId)
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        await db.knexRaw(trx, `UPDATE datasets SET isArchived = 1 WHERE id=?`, [
            datasetId,
        ])
        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId/setTags",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        await setTagsForDataset(trx, datasetId, req.body.tagIds)

        return { success: true }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        const dataset = await getDatasetById(trx, datasetId)
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        await db.knexRaw(
            trx,
            `DELETE d FROM country_latest_data AS d JOIN variables AS v ON d.variable_id=v.id WHERE v.datasetId=?`,
            [datasetId]
        )
        await db.knexRaw(trx, `DELETE FROM dataset_files WHERE datasetId=?`, [
            datasetId,
        ])
        await db.knexRaw(trx, `DELETE FROM variables WHERE datasetId=?`, [
            datasetId,
        ])
        await db.knexRaw(trx, `DELETE FROM sources WHERE datasetId=?`, [
            datasetId,
        ])
        await db.knexRaw(trx, `DELETE FROM datasets WHERE id=?`, [datasetId])

        try {
            await removeDatasetFromGitRepo(dataset.name, dataset.namespace, {
                commitName: res.locals.user.fullName,
                commitEmail: res.locals.user.email,
            })
        } catch (err: any) {
            logErrorAndMaybeSendToBugsnag(err, req)
            // Continue
        }

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/datasets/:datasetId/charts",
    async (req, res, trx) => {
        const datasetId = expectInt(req.params.datasetId)

        const dataset = await getDatasetById(trx, datasetId)
        if (!dataset) throw new JsonError(`No dataset by id ${datasetId}`, 404)

        if (req.body.republish) {
            await db.knexRaw(
                trx,
                `
            UPDATE charts
            SET config = JSON_SET(config, "$.version", config->"$.version" + 1)
            WHERE id IN (
                SELECT DISTINCT chart_dimensions.chartId
                FROM chart_dimensions
                JOIN variables ON variables.id = chart_dimensions.variableId
                WHERE variables.datasetId = ?
            )
            `,
                [datasetId]
            )
        }

        await triggerStaticBuild(
            res.locals.user,
            `Republishing all charts in dataset ${dataset.name} (${dataset.id})`
        )

        return { success: true }
    }
)

// Get a list of redirects that map old slugs to charts
apiRouter.get("/redirects.json", async (req, res) => ({
    redirects: await db.queryMysql(`
        SELECT r.id, r.slug, r.chart_id as chartId, JSON_UNQUOTE(JSON_EXTRACT(charts.config, "$.slug")) AS chartSlug
        FROM chart_slug_redirects AS r JOIN charts ON charts.id = r.chart_id
        ORDER BY r.id DESC`),
}))

getRouteWithROTransaction(
    apiRouter,
    "/tags/:tagId.json",
    async (req, res, trx) => {
        const tagId = expectInt(req.params.tagId) as number | null

        // NOTE (Mispy): The "uncategorized" tag is special -- it represents all untagged stuff
        // Bit fiddly to handle here but more true to normalized schema than having to remember to add the special tag
        // every time we create a new chart etcs
        const uncategorized = tagId === UNCATEGORIZED_TAG_ID

        // TODO: when we have types for our endpoints, make tag of that type instead of any
        const tag: any = await db.knexRawFirst<
            Pick<
                DbPlainTag,
                | "id"
                | "name"
                | "specialType"
                | "updatedAt"
                | "parentId"
                | "slug"
                | "isBulkImport"
            >
        >(
            trx,
            `-- sql
        SELECT t.id, t.name, t.specialType, t.updatedAt, t.parentId, t.slug, p.isBulkImport
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.id = ?
    `,
            [tagId]
        )

        // Datasets tagged with this tag
        const datasets = await db.knexRaw<
            Pick<
                DbPlainDataset,
                | "id"
                | "namespace"
                | "name"
                | "description"
                | "createdAt"
                | "updatedAt"
                | "dataEditedAt"
                | "isPrivate"
                | "nonRedistributable"
            > & { dataEditedByUserName: string }
        >(
            trx,
            `-- sql
        SELECT
            d.id,
            d.namespace,
            d.name,
            d.description,
            d.createdAt,
            d.updatedAt,
            d.dataEditedAt,
            du.fullName AS dataEditedByUserName,
            d.isPrivate,
            d.nonRedistributable
        FROM active_datasets d
        JOIN users du ON du.id=d.dataEditedByUserId
        LEFT JOIN dataset_tags dt ON dt.datasetId = d.id
        WHERE dt.tagId ${uncategorized ? "IS NULL" : "= ?"}
        ORDER BY d.dataEditedAt DESC
    `,
            uncategorized ? [] : [tagId]
        )
        tag.datasets = datasets

        // The other tags for those datasets
        if (tag.datasets.length) {
            if (uncategorized) {
                for (const dataset of tag.datasets) dataset.tags = []
            } else {
                const datasetTags = await db.knexRaw<{
                    datasetId: number
                    id: number
                    name: string
                }>(
                    trx,
                    `-- sql
                SELECT dt.datasetId, t.id, t.name FROM dataset_tags dt
                JOIN tags t ON dt.tagId = t.id
                WHERE dt.datasetId IN (?)
            `,
                    [tag.datasets.map((d: any) => d.id)]
                )
                const tagsByDatasetId = lodash.groupBy(
                    datasetTags,
                    (t) => t.datasetId
                )
                for (const dataset of tag.datasets) {
                    dataset.tags = tagsByDatasetId[dataset.id].map((t) =>
                        lodash.omit(t, "datasetId")
                    )
                }
            }
        }

        // Charts using datasets under this tag
        const charts = await db.knexRaw<OldChartFieldList>(
            trx,
            `-- sql
        SELECT ${oldChartFieldList} FROM charts
        LEFT JOIN chart_tags ct ON ct.chartId=charts.id
        JOIN users lastEditedByUser ON lastEditedByUser.id = charts.lastEditedByUserId
        LEFT JOIN users publishedByUser ON publishedByUser.id = charts.publishedByUserId
        WHERE ct.tagId ${tagId === UNCATEGORIZED_TAG_ID ? "IS NULL" : "= ?"}
        GROUP BY charts.id
        ORDER BY charts.updatedAt DESC
    `,
            uncategorized ? [] : [tagId]
        )
        tag.charts = charts

        await assignTagsForCharts(trx, charts)

        // Subcategories
        const children = await db.knexRaw<{ id: number; name: string }>(
            trx,
            `-- sql
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId = ?
    `,
            [tag.id]
        )
        tag.children = children

        // Possible parents to choose from
        const possibleParents = await db.knexRaw<{ id: number; name: string }>(
            trx,
            `-- sql
        SELECT t.id, t.name FROM tags t
        WHERE t.parentId IS NULL AND t.isBulkImport IS FALSE
    `
        )
        tag.possibleParents = possibleParents

        return {
            tag,
        }
    }
)

putRouteWithRWTransaction(
    apiRouter,
    "/tags/:tagId",
    async (req: Request, res, trx) => {
        const tagId = expectInt(req.params.tagId)
        const tag = (req.body as { tag: any }).tag
        await db.knexRaw(
            trx,
            `UPDATE tags SET name=?, updatedAt=?, parentId=?, slug=? WHERE id=?`,
            [tag.name, new Date(), tag.parentId, tag.slug, tagId]
        )
        if (tag.slug) {
            // See if there's a published gdoc with a matching slug.
            // We're not enforcing that the gdoc be a topic page, as there are cases like /human-development-index,
            // where the page for the topic is just an article.
            const gdoc = await db.knexRaw<Pick<DbRawPostGdoc, "slug">>(
                trx,
                `SELECT slug FROM posts_gdocs pg
             WHERE EXISTS (
                    SELECT 1
                    FROM posts_gdocs_x_tags gt
                    WHERE pg.id = gt.gdocId AND gt.tagId = ?
            ) AND pg.published = TRUE`,
                [tag.id]
            )
            if (!gdoc.length) {
                return {
                    success: true,
                    tagUpdateWarning: `The tag's slug has been updated, but there isn't a published Gdoc page with the same slug.

Are you sure you haven't made a typo?`,
                }
            }
        }
        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/tags/new",
    async (req: Request, res, trx) => {
        const tag = (req.body as { tag: any }).tag
        const now = new Date()
        const result = await db.knexRawInsert(
            trx,
            `INSERT INTO tags (parentId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)`,
            [tag.parentId, tag.name, now, now]
        )
        return { success: true, tagId: result.insertId }
    }
)

getRouteWithROTransaction(apiRouter, "/tags.json", async (req, res, trx) => {
    const tags = await db.knexRaw(
        trx,
        `-- sql
        SELECT t.id, t.name, t.parentId, t.specialType
        FROM tags t LEFT JOIN tags p ON t.parentId=p.id
        WHERE t.isBulkImport IS FALSE AND (t.parentId IS NULL OR p.isBulkImport IS FALSE)
        ORDER BY t.name ASC
    `
    )

    return {
        tags,
    }
})

deleteRouteWithRWTransaction(
    apiRouter,
    "/tags/:tagId/delete",
    async (req, res, trx) => {
        const tagId = expectInt(req.params.tagId)

        await db.knexRaw(trx, `DELETE FROM tags WHERE id=?`, [tagId])

        return { success: true }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/charts/:chartId/redirects/new",
    async (req: Request, res, trx) => {
        const chartId = expectInt(req.params.chartId)
        const fields = req.body as { slug: string }
        const result = await db.knexRawInsert(
            trx,
            `INSERT INTO chart_slug_redirects (chart_id, slug) VALUES (?, ?)`,
            [chartId, fields.slug]
        )
        const redirectId = result.insertId
        const redirect = await db.knexRaw<DbPlainChartSlugRedirect>(
            trx,
            `SELECT * FROM chart_slug_redirects WHERE id = ?`,
            [redirectId]
        )
        return { success: true, redirect: redirect }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/redirects/:id",
    async (req, res, trx) => {
        const id = expectInt(req.params.id)

        const redirect = await db.knexRawFirst<DbPlainChartSlugRedirect>(
            trx,
            `SELECT * FROM chart_slug_redirects WHERE id = ?`,
            [id]
        )

        if (!redirect)
            throw new JsonError(`No redirect found for id ${id}`, 404)

        await db.knexRaw(trx, `DELETE FROM chart_slug_redirects WHERE id=?`, [
            id,
        ])
        await triggerStaticBuild(
            res.locals.user,
            `Deleting redirect from ${redirect.slug}`
        )

        return { success: true }
    }
)

apiRouter.get("/posts.json", async (req) => {
    const raw_rows = await db.queryMysql(
        `-- sql
        with posts_tags_aggregated as (
            select post_id, if(count(tags.id) = 0, json_array(), json_arrayagg(json_object("id", tags.id, "name", tags.name))) as tags
            from post_tags
            left join tags on tags.id = post_tags.tag_id
            group by post_id
        ), post_gdoc_slug_successors as (
            select posts.id, if (count(gdocSlugSuccessor.id) = 0, json_array(), json_arrayagg(json_object("id", gdocSlugSuccessor.id, "published", gdocSlugSuccessor.published ))) as gdocSlugSuccessors
            from posts
            left join posts_gdocs gdocSlugSuccessor on gdocSlugSuccessor.slug = posts.slug
            group by posts.id
        )
        select
             posts.id as id,
             posts.title as title,
             posts.type as type,
             posts.slug as slug,
             status,
             updated_at_in_wordpress,
             posts.authors,
             posts_tags_aggregated.tags as tags,
             gdocSuccessorId,
             gdocSuccessor.published as isGdocSuccessorPublished,
             -- posts can either have explict successors via the gdocSuccessorId column
             -- or implicit successors if a gdoc has been created that uses the same slug
             -- as a Wp post (the gdoc one wins once it is published)
             post_gdoc_slug_successors.gdocSlugSuccessors as gdocSlugSuccessors
         from posts
         left join post_gdoc_slug_successors on post_gdoc_slug_successors.id = posts.id
         left join posts_gdocs gdocSuccessor on gdocSuccessor.id = posts.gdocSuccessorId
         left join posts_tags_aggregated on posts_tags_aggregated.post_id = posts.id
         order by updated_at_in_wordpress desc`,
        []
    )
    const rows = raw_rows.map((row: any) => ({
        ...row,
        tags: JSON.parse(row.tags),
        isGdocSuccessorPublished: !!row.isGdocSuccessorPublished,
        gdocSlugSuccessors: JSON.parse(row.gdocSlugSuccessors),
        authors: JSON.parse(row.authors),
    }))

    return { posts: rows }
})

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/setTags",
    async (req, res, trx) => {
        const postId = expectInt(req.params.postId)

        await setTagsForPost(trx, postId, req.body.tagIds)

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/posts/:postId.json",
    async (req, res, trx) => {
        const postId = expectInt(req.params.postId)
        const post = (await trx
            .table(PostsTableName)
            .where({ id: postId })
            .select("*")
            .first()) as DbRawPost | undefined
        return camelCaseProperties({ ...post })
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/createGdoc",
    async (req: Request, res, trx) => {
        const postId = expectInt(req.params.postId)
        const allowRecreate = !!req.body.allowRecreate
        const post = (await trx
            .table("posts_with_gdoc_publish_status")
            .where({ id: postId })
            .select("*")
            .first()) as DbRawPostWithGdocPublishStatus | undefined

        if (!post) throw new JsonError(`No post found for id ${postId}`, 404)
        const existingGdocId = post.gdocSuccessorId
        if (!allowRecreate && existingGdocId)
            throw new JsonError("A gdoc already exists for this post", 400)
        if (allowRecreate && existingGdocId && post.isGdocPublished) {
            throw new JsonError(
                "A gdoc already exists for this post and it is already published",
                400
            )
        }
        if (post.archieml === null)
            throw new JsonError(
                `ArchieML was not present for post with id ${postId}`,
                500
            )
        const tagsByPostId = await getTagsByPostId(trx)
        const tags =
            tagsByPostId
                .get(postId)
                ?.map(({ id }) => TagEntity.create({ id })) || []
        const archieMl = JSON.parse(
            // Google Docs interprets &region in grapher URLS as ®ion
            // So we escape them here
            post.archieml.replaceAll("&", "&amp;")
        ) as OwidGdocPostInterface
        const gdocId = await createGdocAndInsertOwidGdocPostContent(
            archieMl.content,
            post.gdocSuccessorId
        )
        // If we did not yet have a gdoc associated with this post, we need to register
        // the gdocSuccessorId and create an entry in the posts_gdocs table. Otherwise
        // we don't need to make changes to the DB (only the gdoc regeneration was required)
        if (!existingGdocId) {
            post.gdocSuccessorId = gdocId
            // This is not ideal - we are using knex for on thing and typeorm for another
            // which means that we can't wrap this in a transaction. We should probably
            // move posts to use typeorm as well or at least have a typeorm alternative for it
            await trx
                .table(postsTable)
                .where({ id: postId })
                .update("gdocSuccessorId", gdocId)

            const gdoc = new GdocPost(gdocId)
            gdoc.slug = post.slug
            gdoc.tags = tags
            gdoc.content.title = post.title
            gdoc.content.type = archieMl.content.type || OwidGdocType.Article
            gdoc.published = false
            gdoc.createdAt = new Date()
            gdoc.publishedAt = post.published_at
            await dataSource.getRepository(GdocPost).save(gdoc)
        }

        return { googleDocsId: gdocId }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/posts/:postId/unlinkGdoc",
    async (req: Request, res, trx) => {
        const postId = expectInt(req.params.postId)
        const post = (await trx
            .table("posts_with_gdoc_publish_status")
            .where({ id: postId })
            .select("*")
            .first()) as DbRawPostWithGdocPublishStatus | undefined

        if (!post) throw new JsonError(`No post found for id ${postId}`, 404)
        const existingGdocId = post.gdocSuccessorId
        if (!existingGdocId)
            throw new JsonError("No gdoc exists for this post", 400)
        if (existingGdocId && post.isGdocPublished) {
            throw new JsonError(
                "The GDoc is already published - you can't unlink it",
                400
            )
        }
        // This is not ideal - we are using knex for on thing and typeorm for another
        // which means that we can't wrap this in a transaction. We should probably
        // move posts to use typeorm as well or at least have a typeorm alternative for it
        await trx
            .table(postsTable)
            .where({ id: postId })
            .update("gdocSuccessorId", null)

        await dataSource.getRepository(GdocPost).delete(existingGdocId)

        return { success: true }
    }
)

getRouteWithROTransaction(
    apiRouter,
    "/sources/:sourceId.json",
    async (req: Request, res, trx) => {
        const sourceId = expectInt(req.params.sourceId)

        const source = await db.knexRawFirst<Record<string, any>>(
            trx,
            `
        SELECT s.id, s.name, s.description, s.createdAt, s.updatedAt, d.namespace
        FROM sources AS s
        JOIN active_datasets AS d ON d.id=s.datasetId
        WHERE s.id=?`,
            [sourceId]
        )
        if (!source) throw new JsonError(`No source by id '${sourceId}'`, 404)
        source.variables = await db.knexRaw(
            trx,
            `SELECT id, name, updatedAt FROM variables WHERE variables.sourceId=?`,
            [sourceId]
        )

        return { source: source }
    }
)

apiRouter.get("/deploys.json", async () => ({
    deploys: await new DeployQueueServer().getDeploys(),
}))

apiRouter.put("/deploy", async (req, res) => {
    triggerStaticBuild(res.locals.user, "Manually triggered deploy")
})

apiRouter.get("/gdocs", async () => {
    // orderBy was leading to a sort buffer overflow (ER_OUT_OF_SORTMEMORY) with MySQL's default sort_buffer_size
    // when the posts_gdocs table got larger than 9MB, so we sort in memory
    return GdocPost.find({ relations: ["tags"] }).then((gdocs) =>
        gdocs.sort((a, b) => {
            if (!a.updatedAt || !b.updatedAt) return 0
            return b.updatedAt.getTime() - a.updatedAt.getTime()
        })
    )
})

apiRouter.get("/gdocs/:id", async (req, res) => {
    const id = req.params.id
    const contentSource = req.query.contentSource as
        | GdocsContentSource
        | undefined

    try {
        const gdoc = await GdocFactory.load(id, contentSource)

        if (!gdoc.published) {
            await gdoc.save()
        }

        res.set("Cache-Control", "no-store")
        res.send(gdoc)
    } catch (error) {
        console.error("Error fetching gdoc", error)
        res.status(500).json({ error: { message: String(error), status: 500 } })
    }
})

/**
 * Only supports creating a new empty Gdoc or updating an existing one. Does not
 * support creating a new Gdoc from an existing one. Relevant updates will
 * trigger a deploy.
 */
apiRouter.put("/gdocs/:id", async (req, res) => {
    const { id } = req.params
    const nextGdocJSON: OwidGdocJSON = req.body

    if (isEmpty(nextGdocJSON)) {
        // Check to see if the gdoc already exists in the database
        const existingGdoc = await GdocBase.findOneBy({ id })
        if (existingGdoc) {
            return GdocFactory.load(id, GdocsContentSource.Gdocs)
        } else {
            return GdocFactory.create(id)
        }
    }

    const prevGdoc = await GdocFactory.load(id)
    if (!prevGdoc) throw new JsonError(`No Google Doc with id ${id} found`)

    const nextGdoc = GdocFactory.fromJSON(nextGdocJSON)
    await nextGdoc.loadState()

    // Deleting and recreating these is simpler than tracking orphans over the next code block
    await GdocXImage.delete({ gdocId: id })
    const filenames = nextGdoc.filenames

    // The concept of a "published gdoc" is looser here than in
    // Gdoc.getPublishedGdocs(), where published gdoc fragments are filtered out.
    // Here, published fragments are captured by nextGdoc.published, which
    // allows images in published fragments (in particular data pages) to be
    // synced to S3 and ultimately baked in bakeDriveImages().
    if (filenames.length && nextGdoc.published) {
        await imageStore.fetchImageMetadata(filenames)
        const images = await imageStore.syncImagesToS3()
        for (const image of images) {
            if (image) {
                try {
                    await GdocXImage.save({
                        gdocId: nextGdoc.id,
                        imageId: image.id,
                    })
                } catch (e) {
                    console.error(
                        `Error tracking image reference ${image.filename} with Google ID ${nextGdoc.id}`,
                        e
                    )
                }
            }
        }
    }

    await Link.delete({
        source: {
            id: id,
        },
    })
    if (nextGdoc.published) {
        await dataSource.getRepository(Link).save(nextGdoc.links)
    }

    //todo #gdocsvalidationserver: run validation before saving published
    //articles, in addition to the first pass performed in front-end code (see
    //#gdocsvalidationclient)

    // If the deploy fails, the article would still be considered "published".
    // Saving the article after enqueueing the change for deploy wouldn't solve
    // this issue since the deploy queue runs indenpendently. It would simply
    // prevent the change to be saved in the DB in case the enqueueing fails,
    // which is unlikely. On the other hand, reversing the order "save then
    // enqueue" might run the risk of a race condition, by which the deploy
    // queue picks up the deploy before the store is updated, thus re-publishing
    // the current unmodified version.

    // Neither of these scenarios is very likely (race condition or failure to
    // enqueue), so I opted for the version that matches the closest the current
    // baking model, which is "bake what is persisted in the DB". Ultimately, a
    // full sucessful deploy would resolve the state discrepancy either way.
    await nextGdoc.save()

    const hasChanges = checkHasChanges(prevGdoc, nextGdoc)
    const prevJson = prevGdoc.toJSON<OwidGdoc>()
    const nextJson = nextGdoc.toJSON<OwidGdoc>()
    if (checkIsLightningUpdate(prevJson, nextJson, hasChanges)) {
        await enqueueLightningChange(
            res.locals.user,
            `Lightning update ${nextJson.slug}`,
            nextJson.slug
        )
    } else if (checkFullDeployFallback(prevJson, nextJson, hasChanges)) {
        const action =
            prevJson.published && nextJson.published
                ? "Updating"
                : !prevJson.published && nextJson.published
                ? "Publishing"
                : "Unpublishing"
        await triggerStaticBuild(res.locals.user, `${action} ${nextJson.slug}`)
    }

    return nextGdoc
})

deleteRouteWithRWTransaction(apiRouter, "/gdocs/:id", async (req, res, trx) => {
    const { id } = req.params

    const gdoc = await GdocPost.findOneBy({ id })
    if (!gdoc) throw new JsonError(`No Google Doc with id ${id} found`)

    await trx
        .table("posts")
        .where({ gdocSuccessorId: gdoc.id })
        .update({ gdocSuccessorId: null })

    await Link.delete({
        source: {
            id,
        },
    })
    await GdocXImage.delete({ gdocId: id })
    await GdocPost.delete({ id })
    await triggerStaticBuild(res.locals.user, `Deleting ${gdoc.slug}`)
    return {}
})

apiRouter.post("/gdocs/:gdocId/setTags", async (req, res) => {
    const { gdocId } = req.params
    const { tagIds } = req.body

    const gdoc = await GdocPost.findOneBy({ id: gdocId })
    if (!gdoc) return Error(`Unable to find Gdoc with ID: ${gdocId}`)
    const tags = await dataSource
        .getRepository(TagEntity)
        .findBy({ id: In(tagIds) })
    gdoc.tags = tags
    await gdoc.save()
    return { success: true }
})

getRouteWithROTransaction(
    apiRouter,
    `/gpt/suggest-topics/${TaggableType.Charts}/:chartId.json`,
    async (
        req: Request,
        res,
        trx
    ): Promise<Record<"topics", DbChartTagJoin[]>> => {
        const chartId = parseIntOrUndefined(req.params.chartId)
        if (!chartId) throw new JsonError(`Invalid chart ID`, 400)

        const topics = await getGptTopicSuggestions(trx, chartId)

        if (!topics.length)
            throw new JsonError(
                `No GPT topic suggestions found for chart ${chartId}`,
                404
            )

        return {
            topics,
        }
    }
)

postRouteWithRWTransaction(
    apiRouter,
    "/explorer/:slug/tags",
    async (req, res, trx) => {
        const { slug } = req.params
        const { tagIds } = req.body
        const explorer = await trx.table("explorers").where({ slug }).first()
        if (!explorer)
            throw new JsonError(`No explorer found for slug ${slug}`, 404)

        await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
        for (const tagId of tagIds) {
            await trx
                .table("explorer_tags")
                .insert({ explorerSlug: slug, tagId })
        }

        return { success: true }
    }
)

deleteRouteWithRWTransaction(
    apiRouter,
    "/explorer/:slug/tags",
    async (req: Request, res, trx) => {
        const { slug } = req.params
        await trx.table("explorer_tags").where({ explorerSlug: slug }).delete()
        return { success: true }
    }
)

export { apiRouter }
