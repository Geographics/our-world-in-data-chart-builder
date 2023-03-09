import _ from "lodash"
import { Writable } from "stream"
import * as db from "../db.js"
import https from "https"
import {
    OwidChartDimensionInterface,
    OwidVariableDisplayConfigInterface,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    DataValueQueryArgs,
    DataValueResult,
    OwidVariableWithSourceAndDimension,
    OwidVariableId,
    OwidVariableWithSourceAndType,
    OwidVariableTypeOptions,
    omitNullableValues,
    OwidSource,
    retryPromise,
} from "@ourworldindata/utils"
import fetch from "node-fetch"
import pl from "nodejs-polars"

export interface VariableRow {
    id: number
    name: string
    shortName?: string
    code: string | null
    unit: string
    shortUnit: string | null
    description: string | null
    createdAt: Date
    updatedAt: Date
    datasetId: number
    sourceId: number
    display: OwidVariableDisplayConfigInterface
    coverage?: string
    timespan?: string
    columnOrder?: number
    catalogPath?: string
    dataPath?: string
    dimensions?: Dimensions
}

interface Dimensions {
    originalName: string
    originalShortName: string
    filters: {
        name: string
        value: string
    }[]
}

export type UnparsedVariableRow = Omit<VariableRow, "display"> & {
    display: string
}

export type VariableQueryRow = Readonly<
    Omit<UnparsedVariableRow, "dimensions"> & {
        display: string
        datasetName: string
        nonRedistributable: number
        sourceName: string
        sourceDescription: string
        dimensions: string
    }
>

export type Field = keyof VariableRow

export const variableTable = "variables"

export function parseVariableRows(
    plainRows: UnparsedVariableRow[]
): VariableRow[] {
    for (const row of plainRows) {
        row.display = row.display ? JSON.parse(row.display) : undefined
    }
    return plainRows as VariableRow[]
}

export async function getVariableData(
    variableId: number
): Promise<OwidVariableDataMetadataDimensions> {
    const data = await fetchS3Values(variableId)

    // NOTE: we could be fetching metadata from S3, but there's a latency that could
    // cause problems with admin. It's safer to fetch it directly from the database.
    // In the future when we isolate ETL from admin and use variable fallbacks (i.e.
    // metadataPath would be only editable by ETL), it should be safe to fetch from S3.
    // The only thing preventing us from doing so is that we allow editing non-ETL variables
    // (in owid namespace). These are pretty rarely edited anyway.
    // const metadata = await fetchS3MetadataByPath(metadataPath)
    const metadata = await getVariableMetadataFromMySQL(variableId, data)

    return {
        data: data,
        metadata: metadata,
    }
}

export async function getVariableMetadataFromMySQL(
    variableId: number,
    variableData: OwidVariableMixedData
): Promise<OwidVariableWithSourceAndDimension> {
    const variableQuery: Promise<VariableQueryRow | undefined> = db.mysqlFirst(
        `
        SELECT
            variables.*,
            datasets.name AS datasetName,
            datasets.nonRedistributable AS nonRedistributable,
            sources.name AS sourceName,
            sources.description AS sourceDescription
        FROM variables
        JOIN datasets ON variables.datasetId = datasets.id
        JOIN sources ON variables.sourceId = sources.id
        WHERE variables.id = ?
        `,
        [variableId]
    )

    const row = await variableQuery
    if (row === undefined) throw new Error(`Variable ${variableId} not found`)

    const {
        sourceId,
        sourceName,
        sourceDescription,
        nonRedistributable,
        display: displayJson,
        ...variable
    } = row
    const display = JSON.parse(displayJson)
    const partialSource: OwidSource = JSON.parse(sourceDescription)
    const variableMetadata: OwidVariableWithSourceAndType = {
        ...omitNullableValues(variable),
        type: detectValuesType(variableData.values),
        nonRedistributable: Boolean(nonRedistributable),
        display,
        source: {
            id: sourceId,
            name: sourceName,
            dataPublishedBy: partialSource.dataPublishedBy || "",
            dataPublisherSource: partialSource.dataPublisherSource || "",
            link: partialSource.link || "",
            retrievedDate: partialSource.retrievedDate || "",
            additionalInfo: partialSource.additionalInfo || "",
        },
    }

    const entities = await loadEntitiesInfo(variableData.entities)
    const years = _.uniq(variableData.years).map((year) => ({ id: year }))

    return {
        ...variableMetadata,
        dimensions: {
            years: { values: years },
            entities: { values: entities },
        },
    }
}

async function loadEntitiesInfo(entityIds: number[]): Promise<any> {
    if (entityIds.length === 0) return []
    return db.queryMysql(
        `
        SELECT
            id,
            name,
            code
        FROM entities WHERE id in (?) ORDER BY name ASC
        `,
        [_.uniq(entityIds)]
    )
}

export function detectValuesType(
    values: (string | number)[]
): OwidVariableTypeOptions {
    let encounteredFloatDataValues = false
    let encounteredIntDataValues = false
    let encounteredStringDataValues = false

    for (const value of values) {
        if (Number.isInteger(value)) {
            encounteredIntDataValues = true
        } else if (typeof value === "number") {
            encounteredFloatDataValues = true
        } else {
            encounteredStringDataValues = true
        }
    }

    if (
        (encounteredFloatDataValues || encounteredIntDataValues) &&
        encounteredStringDataValues
    ) {
        return "mixed"
    } else if (encounteredFloatDataValues) {
        return "float"
    } else if (encounteredIntDataValues) {
        return "int"
    } else if (encounteredStringDataValues) {
        return "string"
    } else {
        return "mixed"
    }
}

export async function getDataForMultipleVariables(
    variableIds: number[]
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const promises = variableIds.map(
        async (id) => await getVariableData(id as number)
    )
    const allVariablesDataAndMetadata = await Promise.all(promises)
    const allVariablesDataAndMetadataMap = new Map(
        allVariablesDataAndMetadata.map((item) => [item.metadata.id, item])
    )
    return allVariablesDataAndMetadataMap
}

export async function writeVariableCSV(
    variableIds: number[],
    stream: Writable
): Promise<void> {
    // get variables as dataframe
    const variablesDF = (
        await readSQLasDF(
            `
        SELECT
            id as variableId,
            name as variableName,
            columnOrder
        FROM variables v
        WHERE id IN (?)`,
            [variableIds]
        )
    ).withColumn(pl.col("variableId").cast(pl.Int32))

    // Throw an error if not all variables exist
    if (variablesDF.shape.height !== variableIds.length) {
        const fetchedVariableIds = variablesDF.getColumn("variableId").toArray()
        const missingVariables = _.difference(variableIds, fetchedVariableIds)
        throw Error(`Variable IDs do not exist: ${missingVariables.join(", ")}`)
    }

    // get data values as dataframe
    const dataValuesDF = await dataAsDF(
        variablesDF.getColumn("variableId").toArray()
    )

    dataValuesDF
        .join(variablesDF, { on: "variableId" })
        .sort(["columnOrder", "variableId"])
        // variables as columns
        .pivot("value", {
            index: ["entityName", "year"],
            columns: "variableName",
        })
        .sort(["entityName", "year"])
        .rename({ entityName: "Entity", year: "Year" })
        .writeCSV(stream)
}

export const getDataValue = async ({
    variableId,
    entityId,
    year,
}: DataValueQueryArgs): Promise<DataValueResult | undefined> => {
    if (!variableId || !entityId) return

    let df = (await dataAsDF([variableId])).filter(
        pl.col("entityId").eq(entityId)
    )

    const unit = (
        await db.mysqlFirst(
            `
        SELECT unit FROM variables
        WHERE id = ?
        `,
            [variableId]
        )
    ).unit

    if (year) {
        df = df.filter(pl.col("year").eq(year))
    } else {
        df = df.sort(["year"], true).limit(1)
    }

    if (df.shape.height == 0) return
    if (df.shape.height > 1) {
        throw new Error(
            `More than one data value found for variable ${variableId}, entity ${entityId}, year ${year}`
        )
    }

    const row = df.toRecords()[0]

    return {
        value: Number(row.value),
        year: Number(row.year),
        unit: unit,
        entityName: row.entityName,
    }
}

export const getOwidChartDimensionConfigForVariable = async (
    variableId: OwidVariableId,
    chartId: number
): Promise<OwidChartDimensionInterface | undefined> => {
    const row = await db.mysqlFirst(
        `
        SELECT config->"$.dimensions" AS dimensions
        FROM charts
        WHERE id = ?
        `,
        [chartId]
    )
    if (!row.dimensions) return
    const dimensions = JSON.parse(row.dimensions)
    return dimensions.find(
        (dimension: OwidChartDimensionInterface) =>
            dimension.variableId === variableId
    )
}

export const getOwidVariableDisplayConfig = async (
    variableId: OwidVariableId
): Promise<OwidVariableDisplayConfigInterface | undefined> => {
    const row = await db.mysqlFirst(
        `SELECT display FROM variables WHERE id = ?`,
        [variableId]
    )
    if (!row.display) return
    return JSON.parse(row.display)
}

export const entitiesAsDF = async (
    entityIds: number[]
): Promise<pl.DataFrame> => {
    return (
        await readSQLasDF(
            `
        SELECT
            id AS entityId,
            name AS entityName,
            code AS entityCode
        FROM entities WHERE id in (?)
        `,
            [_.uniq(entityIds)]
        )
    ).select(
        pl.col("entityId").cast(pl.Int32),
        pl.col("entityName").cast(pl.Utf8),
        pl.col("entityCode").cast(pl.Utf8)
    )
}

const _castDataDF = (df: pl.DataFrame): pl.DataFrame => {
    return df.select(
        pl.col("variableId").cast(pl.Int32),
        pl.col("entityId").cast(pl.Int32),
        pl.col("entityName").cast(pl.Utf8),
        pl.col("entityCode").cast(pl.Utf8),
        pl.col("year").cast(pl.Int32),
        pl.col("value").cast(pl.Utf8)
    )
}

export const assertFileExistsInS3 = async (dataPath: string): Promise<void> => {
    const resp = await fetch(dataPath, { method: "HEAD", agent: httpsAgent })
    if (resp.status !== 200) {
        throw new Error("URL not found on S3: " + dataPath)
    }
}

const emptyDataDF = (): pl.DataFrame => {
    return _castDataDF(
        pl.DataFrame({
            variableId: [],
            entityId: [],
            entityName: [],
            entityCode: [],
            year: [],
            value: [],
        })
    )
}

export const _dataAsDFfromS3 = async (
    variableIds: OwidVariableId[]
): Promise<pl.DataFrame> => {
    if (variableIds.length == 0) {
        return emptyDataDF()
    }

    const dfs = await Promise.all(
        variableIds.map(async (variableId) => {
            const s3values = await fetchS3Values(variableId)
            return createDataFrame(s3values)
                .rename({
                    values: "value",
                    entities: "entityId",
                    years: "year",
                })
                .select(
                    pl.col("entityId").cast(pl.Int32),
                    pl.col("year").cast(pl.Int32),
                    pl.col("value").cast(pl.Utf8),
                    pl.lit(variableId).cast(pl.Int32).alias("variableId")
                )
        })
    )

    const df = pl.concat(dfs)

    if (df.height == 0) {
        return emptyDataDF()
    }

    const entityDF = await entitiesAsDF(df.getColumn("entityId").toArray())

    return _castDataDF(df.join(entityDF, { on: "entityId" }))
}

export const dataAsDF = async (
    variableIds: OwidVariableId[]
): Promise<pl.DataFrame> => {
    // return variables values as a DataFrame from S3
    const rows = await db.queryMysql(
        `
    SELECT
        id,
        dataPath
    FROM variables
    WHERE id in (?)
    `,
        [variableIds]
    )

    // variables with dataPath are stored in S3
    const variableIdsWithDataPath = rows
        .filter((row: any) => row.dataPath)
        .map((row: any) => row.id)

    const variableIdsWithoutDataPath = rows
        .filter((row: any) => !row.dataPath)
        .map((row: any) => row.id)

    // variables without dataPath shouldn't exist!
    if (variableIdsWithoutDataPath.length > 0)
        throw new Error(
            `Variables ${variableIdsWithoutDataPath} are missing dataPath`
        )

    return _dataAsDFfromS3(variableIdsWithDataPath)
}

export const getOwidVariableDataAndMetadataPath = async (
    variableId: OwidVariableId
): Promise<{ dataPath: string; metadataPath: string }> => {
    // NOTE: refactor this with Variable object in TypeORM
    const row = await db.mysqlFirst(
        `SELECT dataPath, metadataPath FROM variables WHERE id = ?`,
        [variableId]
    )
    return { dataPath: row.dataPath, metadataPath: row.metadataPath }
}

// limit number of concurrent requests to 20 when fetching values from S3, otherwise
// we might get ECONNRESET errors
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 20,
})

export const fetchS3Values = async (
    variableId: OwidVariableId
): Promise<OwidVariableMixedData> => {
    const { dataPath, metadataPath } = await getOwidVariableDataAndMetadataPath(
        variableId
    )
    if (!dataPath) {
        throw new Error(`Missing dataPath for variable ${variableId}`)
    }
    if (!metadataPath) {
        throw new Error(`Missing metadataPath for variable ${variableId}`)
    }
    return fetchS3ValuesByPath(dataPath)
}

export const fetchS3ValuesByPath = async (
    dataPath: string
): Promise<OwidVariableMixedData> => {
    // avoid cache as Cloudflare worker caches up to 1 hour
    const resp = await retryPromise(() =>
        fetch(`${dataPath}?nocache`, { agent: httpsAgent })
    )
    if (!resp.ok) {
        throw new Error(
            `Error fetching data from S3 for ${dataPath}: ${resp.status} ${resp.statusText}`
        )
    }
    return resp.json()
}

export const fetchS3MetadataByPath = async (
    metadataPath: string
): Promise<OwidVariableWithSourceAndDimension> => {
    // avoid cache as Cloudflare worker caches up to 1 hour
    const resp = await retryPromise(() =>
        fetch(`${metadataPath}?nocache`, { agent: httpsAgent })
    )
    if (!resp.ok) {
        throw new Error(
            `Error fetching data from S3 for ${metadataPath}: ${resp.status} ${resp.statusText}`
        )
    }
    return resp.json()
}

export const createDataFrame = (data: any): pl.DataFrame => {
    if (Array.isArray(data)) {
        // transpose list of objects into object of lists because polars raises
        // an error when creating a dataframe with null values (see https://github.com/pola-rs/nodejs-polars/issues/20)
        // otherwise we'd just use pl.DataFrame(rows)
        const keys = _.keys(data[0])
        const values = _.map(keys, (key) => _.map(data, key))

        return pl.DataFrame(_.zipObject(keys, values))
    } else {
        return pl.DataFrame(data)
    }
}

export const readSQLasDF = async (
    sql: string,
    params: any[]
): Promise<pl.DataFrame> => {
    return createDataFrame(await db.queryMysql(sql, params))
}
