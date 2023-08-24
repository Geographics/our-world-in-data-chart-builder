import cheerio from "cheerio"
import { isArray } from "lodash"
import { match } from "ts-pattern"
import { checkIsPlainObjectWithGuard } from "@ourworldindata/utils"
import { getAlgoliaClient } from "./configureAlgolia.js"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { Pageview } from "../../db/model/Pageview.js"
import { chunkParagraphs } from "../chunk.js"

type ExplorerBlockLineChart = {
    type: "LineChart"
    title: string
    subtitle: string
}

type ExplorerBlockColumns = {
    type: "columns"
    block: { name: string; additionalInfo?: string }[]
}

type ExplorerBlockGraphers = {
    type: "graphers"
    block: {
        title: string
        subtitle?: string
    }[]
}

type ExplorerEntry = {
    slug: string
    title: string
    subtitle: string
    views_7d: number
    blocks: string // (ExplorerBlockLineChart | ExplorerBlockColumns | ExplorerBlockGraphers)[]
}

type ExplorerRecord = {
    slug: string
    title: string
    subtitle: string
    views_7d: number
    text: string
}

function extractTextFromExplorer(blocksString: string): string {
    const blockText = new Set<string>()
    const blocks = JSON.parse(blocksString)

    if (isArray(blocks)) {
        for (const block of blocks) {
            if (checkIsPlainObjectWithGuard(block) && "type" in block) {
                match(block)
                    .with(
                        { type: "LineChart" },
                        (lineChart: ExplorerBlockLineChart) => {
                            blockText.add(lineChart.title)
                            blockText.add(lineChart.subtitle)
                        }
                    )
                    .with(
                        { type: "columns" },
                        (columns: ExplorerBlockColumns) => {
                            columns.block.forEach(
                                ({ name = "", additionalInfo = "" }) => {
                                    blockText.add(name)
                                    blockText.add(additionalInfo)
                                }
                            )
                        }
                    )
                    .with(
                        { type: "graphers" },
                        (graphers: ExplorerBlockGraphers) => {
                            graphers.block.forEach(
                                ({ title = "", subtitle = "" }) => {
                                    blockText.add(title)
                                    blockText.add(subtitle)
                                }
                            )
                        }
                    )
                    .otherwise(() => {
                        // type: "tables"
                        // do nothing
                    })
            }
        }
    }

    return [...blockText].join(" ")
}

function getNullishJSONValueAsPlaintext(value: string): string {
    return value !== "null" ? cheerio.load(value)("body").text() : ""
}

const getExplorerRecords = async (): Promise<ExplorerRecord[]> => {
    const pageviews = await Pageview.getViewsByUrlObj()

    const explorerRecords = await db
        .queryMysql(
            `
    SELECT slug,
        COALESCE(config->>"$.explorerSubtitle", "null")     AS subtitle,
        COALESCE(config->>"$.explorerTitle", "null")        AS title,
        COALESCE(config->>"$.blocks", "null")               AS blocks
    FROM explorers
    WHERE isPublished = true
    `
        )
        .then((results: ExplorerEntry[]) =>
            results.flatMap(({ slug, title, subtitle, blocks }) => {
                const textFromExplorer = extractTextFromExplorer(blocks)
                const uniqueTextTokens = new Set([
                    ...textFromExplorer.split(" "),
                ])
                const textChunks = chunkParagraphs(
                    [...uniqueTextTokens].join(" "),
                    1000
                )
                const explorerRecords = []
                let i = 0
                for (const chunk of textChunks) {
                    explorerRecords.push({
                        slug,
                        title: getNullishJSONValueAsPlaintext(title),
                        subtitle: getNullishJSONValueAsPlaintext(subtitle),
                        views_7d:
                            pageviews[`/explorers/${slug}`]?.views_7d || 0,
                        text: chunk,
                        objectID: `${slug}-${i}`,
                    })
                    i++
                }
                return explorerRecords
            })
        )

    return explorerRecords
}

const indexChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing charts (Algolia client not initialized)`)
        return
    }

    try {
        const index = client.initIndex("explorers-test")

        await db.getConnection()
        const records = await getExplorerRecords()
        await index.replaceAllObjects(records)

        await db.closeTypeOrmAndKnexConnections()
    } catch (e) {
        console.log("Error indexing explorers to Algolia: ", e)
    }
}

indexChartsToAlgolia()
