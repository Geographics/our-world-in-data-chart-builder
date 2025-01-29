import { Grapher } from "@ourworldindata/grapher"
import { OwidColumnDef } from "@ourworldindata/types"
import { StatusError } from "itty-router"
import { createZip, File } from "littlezipper"
import { assembleMetadata, getColumnsForMetadata } from "./metadataTools.js"
import { Env } from "./env.js"
import { GrapherIdentifier, initGrapher } from "./grapherTools.js"
import { TWITTER_OPTIONS } from "./imageOptions.js"
import { constructReadme } from "./readmeTools.js"

export async function fetchMetadataForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams
) {
    console.log("Initializing grapher")
    const { grapher, multiDimAvailableDimensions } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams ?? new URLSearchParams(""),
        env
    )

    await grapher.downloadLegacyDataFromOwidVariableIds()

    const fullMetadata = assembleMetadata(
        grapher,
        searchParams ?? new URLSearchParams(""),
        multiDimAvailableDimensions
    )

    return Response.json(fullMetadata)
}

export async function fetchZipForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams
) {
    console.log("preparing to generate zip file")
    const { grapher } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams ?? new URLSearchParams(""),
        env
    )
    await grapher.downloadLegacyDataFromOwidVariableIds()
    ensureDownloadOfDataAllowed(grapher)
    const metadata = assembleMetadata(grapher, searchParams)
    const readme = assembleReadme(grapher, searchParams)
    const csv = assembleCsv(grapher, searchParams)
    console.log("Fetched the parts, creating zip file")

    const zipContent: File[] = [
        {
            path: `${identifier.id}.metadata.json`,
            data: JSON.stringify(metadata, undefined, 2),
        },
        { path: `${identifier.id}.csv`, data: csv },
        { path: "readme.md", data: readme },
    ]
    const content = await createZip(zipContent)
    console.log("Generated content, returning response")
    return new Response(content, {
        headers: {
            "Content-Type": "application/zip",
        },
    })
}
function assembleCsv(grapher: Grapher, searchParams: URLSearchParams): string {
    const useShortNames = searchParams.get("useColumnShortNames") === "true"
    const fullTable = grapher.inputTable
    const filteredTable = grapher.isOnTableTab
        ? grapher.tableForDisplay
        : grapher.transformedTable
    const table =
        searchParams.get("csvType") === "filtered" ? filteredTable : fullTable
    return table.toPrettyCsv(useShortNames)
}

export async function fetchCsvForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams
) {
    const { grapher } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams ?? new URLSearchParams(""),
        env
    )
    await grapher.downloadLegacyDataFromOwidVariableIds()
    console.log("checking if download is allowed")
    ensureDownloadOfDataAllowed(grapher)
    console.log("data download is allowed")
    const csv = assembleCsv(grapher, searchParams ?? new URLSearchParams(""))
    return new Response(csv, {
        headers: {
            "Content-Type": "text/csv",
        },
    })
}
function ensureDownloadOfDataAllowed(grapher: Grapher) {
    if (
        grapher.inputTable.columnsAsArray.some(
            (col) => (col.def as OwidColumnDef).nonRedistributable
        )
    ) {
        throw new StatusError(
            403,
            "This chart contains non-redistributable data that we are not allowed to re-share and it therefore cannot be downloaded as a CSV."
        )
    }
}

export async function fetchReadmeForGrapher(
    identifier: GrapherIdentifier,
    env: Env,
    searchParams?: URLSearchParams
) {
    console.log("Initializing grapher")
    const { grapher, multiDimAvailableDimensions } = await initGrapher(
        identifier,
        TWITTER_OPTIONS,
        searchParams ?? new URLSearchParams(""),
        env
    )

    await grapher.downloadLegacyDataFromOwidVariableIds()

    const readme = assembleReadme(
        grapher,
        searchParams,
        multiDimAvailableDimensions
    )
    return new Response(readme, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
        },
    })
}

function assembleReadme(
    grapher: Grapher,
    searchParams: URLSearchParams,
    multiDimAvailableDimensions?: string[]
): string {
    const metadataCols = getColumnsForMetadata(grapher)
    return constructReadme(
        grapher,
        metadataCols,
        searchParams,
        multiDimAvailableDimensions
    )
}
