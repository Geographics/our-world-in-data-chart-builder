import { InvalidCell } from "./InvalidCells"
import { LegacyVariableDisplayConfigInterface } from "./LegacyVariableCode"

export type Integer = number
export type ColumnSlug = string // let's be very restrictive on valid column names to start.

export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export type ValueRange = [number, number]

export enum ColumnTypeNames {
    Numeric = "Numeric",
    String = "String",
    Region = "Region",
    SeriesAnnotation = "SeriesAnnotation",
    Categorical = "Categorical",
    Continent = "Continent",
    EntityName = "EntityName",
    EntityId = "EntityId",
    EntityCode = "EntityCode",
    Boolean = "Boolean",
    Currency = "Currency",
    Percentage = "Percentage",
    RelativePercentage = "RelativePercentage",
    DecimalPercentage = "DecimalPercentage",
    Integer = "Integer",
    Population = "Population",
    PopulationDensity = "PopulationDensity",
    PercentChangeOverTime = "PercentChangeOverTime",
    Age = "Age",
    Ratio = "Ratio",
    Year = "Year",
    Date = "Date",
    Color = "Color",
}

export interface CoreColumnDef {
    slug: ColumnSlug
    name?: string
    description?: string
    unit?: string
    shortUnit?: string
    fn?: ColumnFn
    values?: CoreValueType[] // Similar to Fn, but the already computed values.
    type?: ColumnTypeNames
    generator?: () => number // A function for generating synthetic data for testing
    growthRateGenerator?: () => number // A function for generating synthetic data for testing. Can probably combine with the above.
    display?: LegacyVariableDisplayConfigInterface // todo: move to OwidTable
    color?: Color // A column can have a color for use in charts.
}

export enum TransformType {
    // Table level ops
    Load = "Load",
    Transpose = "Transpose",
    Reload = "Reload",
    Concat = "Concat",
    Reduce = "Reduce",

    // Row ops
    FilterRows = "FilterRows",
    SortRows = "SortRows",
    AppendRows = "AppendRows", // todo: should this will also rerun any column transforms on the new rows?
    UpdateRows = "UpdateRows", // replace values in a row. For example: to prep columns for log scale, or testing messy runtime data scenarios.
    InverseFilterRows = "InverseFilterRows",

    // Column ops
    FilterColumns = "FilterColumns",
    SortColumns = "SortColumns",
    AppendColumns = "AppendColumns", // This will run column transform fns.
    UpdateColumnDefs = "UpdateColumnDefs", // do not use for updates that add a column transform fn.
    RenameColumns = "RenameColumns",
    InverseFilterColumns = "InverseFilterColumns",
}

export type Year = Integer
export type Color = string

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer
export type TimeRange = [Time, Time]
export type TimeTolerance = Integer

export interface CoreRow {
    [columnSlug: string]: any
}

export type PrimitiveType = number | string | boolean

export enum JsTypes {
    string = "string",
    boolean = "boolean",
    number = "number",
}

export type CsvString = string

export type CoreValueType = PrimitiveType | InvalidCell

/**
 * An Object Literal of Column Slugs and Primitives of the same type:
 * {
 *  score: [1, 2, 3],
 *  year: [2000, 2001]
 * }
 */
export type CoreColumnStore = {
    [columnSlug: string]: CoreValueType[]
}

export type CoreTableInputOption = CoreRow[] | CoreColumnStore | CsvString

// Every row will be checked against each column/value(s) pair.
export interface CoreQuery {
    [columnSlug: string]: PrimitiveType | PrimitiveType[]
}

// todo: remove index param?
// todo: improve typings on this
export type ColumnFn = (row: CoreRow, index?: Integer) => any
