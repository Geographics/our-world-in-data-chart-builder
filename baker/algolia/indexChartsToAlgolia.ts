import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { isPathRedirectedToExplorer } from "../../explorerAdminServer/ExplorerRedirects.js"
import { ChartRecord, SearchIndexName } from "../../site/search/searchTypes.js"
import {
    KeyChartLevel,
    OwidGdocLinkType,
    excludeNullish,
    isNil,
    countries,
    orderBy,
    removeTrailingParenthetical,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { getAnalyticsPageviewsByUrlObj } from "../../db/model/Pageview.js"
import { getRelatedArticles } from "../../db/model/Post.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { getPublishedLinksTo } from "../../db/model/Link.js"

const computeScore = (record: Omit<ChartRecord, "score">): number => {
    const { numRelatedArticles, views_7d } = record
    return numRelatedArticles * 500 + views_7d
}

const processAvailableEntities = (availableEntities: string[] | null) => {
    if (!availableEntities) return []

    const countriesWithVariantNames = countries
        .filter((country) => country.variantNames?.length || country.shortName)
        .map((country) => country.name)

    // Algolia is a bit weird with synonyms:
    // If we have a synonym "USA" -> "United States", and we search for "USA",
    // then it seems that Algolia can only find that within `availableEntities`
    // if "USA" is within the first 100-or-so entries of the array.
    // So, the easy solution is to sort the entities to ensure that countries
    // with variant names are at the top.
    // - @marcelgerber, 2024-03-25
    return orderBy(
        availableEntities,
        [
            (entityName) =>
                countriesWithVariantNames.includes(
                    removeTrailingParenthetical(entityName)
                ),
            (entityName) => entityName,
        ],
        ["desc", "asc"]
    )
}

const getChartsRecords = async (
    knex: db.KnexReadonlyTransaction
): Promise<ChartRecord[]> => {
    const chartsToIndex = await db.knexRaw<{
        id: number
        slug: string
        title: string
        variantName: string
        subtitle: string
        numDimensions: string
        publishedAt: string
        updatedAt: string
        entityNames: string | string[]
        tags: string
        keyChartForTags: string | string[]
    }>(
        knex,
        `-- sql
        WITH indexable_charts_with_entity_names AS (
            SELECT c.id,
                   config ->> "$.slug"                    AS slug,
                   config ->> "$.title"                   AS title,
                   config ->> "$.variantName"             AS variantName,
                   config ->> "$.subtitle"                AS subtitle,
                   JSON_LENGTH(config ->> "$.dimensions") AS numDimensions,
                   c.publishedAt,
                   c.updatedAt,
                   JSON_ARRAYAGG(e.name)                  AS entityNames
            FROM charts c
                     LEFT JOIN charts_x_entities ce ON c.id = ce.chartId
                     LEFT JOIN entities e ON ce.entityId = e.id
            WHERE config ->> "$.isPublished" = 'true'
              AND is_indexable IS TRUE
            GROUP BY c.id
        )
        SELECT c.id,
               c.slug,
               c.title,
               c.variantName,
               c.subtitle,
               c.numDimensions,
               c.publishedAt,
               c.updatedAt,
               c.entityNames, -- this array may contain null values, will have to filter these out
               JSON_ARRAYAGG(t.name) AS tags,
               JSON_ARRAYAGG(IF(ct.keyChartLevel = ${KeyChartLevel.Top}, t.name, NULL)) AS keyChartForTags -- this results in an array that contains null entries, will have to filter them out
        FROM indexable_charts_with_entity_names c
                 LEFT JOIN chart_tags ct ON c.id = ct.chartId
                 LEFT JOIN tags t on ct.tagId = t.id
        GROUP BY c.id
        HAVING COUNT(t.id) >= 1
    `
    )

    for (const c of chartsToIndex) {
        if (c.entityNames !== null) {
            // This is a very rough way to check for the Algolia record size limit, but it's better than the update failing
            // because we exceed the 20KB record size limit
            if (c.entityNames.length < 12000)
                c.entityNames = excludeNullish(
                    JSON.parse(c.entityNames as string) as (string | null)[]
                ) as string[]
            else {
                console.info(
                    `Chart ${c.id} has too many entities, skipping its entities`
                )
                c.entityNames = []
            }
        }
        c.entityNames = processAvailableEntities(c.entityNames)

        c.tags = JSON.parse(c.tags)
        c.keyChartForTags = JSON.parse(c.keyChartForTags as string).filter(
            (t: string | null) => t
        )
    }

    const pageviews = await getAnalyticsPageviewsByUrlObj(knex)

    const records: ChartRecord[] = []
    for (const c of chartsToIndex) {
        // Our search currently cannot render explorers, so don't index them because
        // otherwise they will fail when rendered in the search results
        if (isPathRedirectedToExplorer(`/grapher/${c.slug}`)) continue

        const relatedArticles = (await getRelatedArticles(knex, c.id)) ?? []
        const linksFromGdocs = await getPublishedLinksTo(
            knex,
            [c.slug],
            OwidGdocLinkType.Grapher
        )

        const plaintextSubtitle = isNil(c.subtitle)
            ? undefined
            : new MarkdownTextWrap({
                  text: c.subtitle,
                  fontSize: 10, // doesn't matter, but is a mandatory field
              }).plaintext

        const record = {
            objectID: c.id.toString(),
            chartId: c.id,
            slug: c.slug,
            title: c.title,
            variantName: c.variantName,
            subtitle: plaintextSubtitle,
            availableEntities: c.entityNames as string[],
            numDimensions: parseInt(c.numDimensions),
            publishedAt: c.publishedAt,
            updatedAt: c.updatedAt,
            tags: c.tags as any as string[],
            keyChartForTags: c.keyChartForTags as string[],
            titleLength: c.title.length,
            // Number of references to this chart in all our posts and pages
            numRelatedArticles: relatedArticles.length + linksFromGdocs.length,
            views_7d: pageviews[`/grapher/${c.slug}`]?.views_7d ?? 0,
        }
        const score = computeScore(record)
        records.push({ ...record, score })
    }

    return records
}

const indexChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing charts (Algolia client not initialized)`)
        return
    }

    const index = client.initIndex(getIndexName(SearchIndexName.Charts))

    const records = await db.knexReadonlyTransaction(
        getChartsRecords,
        db.TransactionCloseMode.Close
    )
    await index.replaceAllObjects(records)
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexChartsToAlgolia()
