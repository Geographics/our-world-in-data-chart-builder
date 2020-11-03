import {
    StackMode,
    GrapherTabOption,
    ScatterPointLabelStrategy,
    HighlightToggleConfig,
    RelatedQuestionsConfig,
    EntitySelectionMode,
    EntitySelection,
    ChartTypeName,
    FacetStrategy,
} from "./GrapherConstants"
import { AxisConfigInterface } from "grapher/axis/AxisConfigInterface"
import { LegacyChartDimensionInterface } from "coreTable/LegacyVariableCode"
import { TimeBound } from "grapher/utils/TimeBounds"
import { ComparisonLineConfig } from "grapher/scatterCharts/ComparisonLine"
import { LogoOption } from "grapher/captionedChart/Logos"
import { ColorScaleConfigInterface } from "grapher/color/ColorScaleConfig"
import { MapConfigInterface } from "grapher/mapCharts/MapConfig"
import { ColumnSlug, ColumnSlugs, Time } from "coreTable/CoreTableConstants"
import { omit } from "grapher/utils/Util"
import { EntityId, EntityName } from "coreTable/OwidTableConstants"
import { ColorSchemeName } from "grapher/color/ColorConstants"

// This configuration represents the entire persistent state of a grapher
// Ideally, this is also all of the interaction state: when a grapher is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export interface GrapherInterface {
    type?: ChartTypeName
    id?: number
    version?: number
    slug?: string
    title?: string
    subtitle?: string
    sourceDesc?: string
    note?: string
    hideTitleAnnotation?: boolean
    minTime?: TimeBound
    maxTime?: TimeBound
    timelineMinTime?: Time
    timelineMaxTime?: Time
    dimensions?: LegacyChartDimensionInterface[]
    addCountryMode?: EntitySelectionMode
    comparisonLines?: ComparisonLineConfig[]
    highlightToggle?: HighlightToggleConfig
    stackMode?: StackMode
    hideLegend?: boolean
    logo?: LogoOption
    hideLogo?: boolean
    hideRelativeToggle?: boolean
    entityType?: string
    entityTypePlural?: string
    hideTimeline?: boolean
    zoomToSelection?: boolean
    minPopulationFilter?: number
    showYearLabels?: boolean // Always show year in labels for bar charts
    hasChartTab?: boolean
    hasMapTab?: boolean
    tab?: GrapherTabOption
    overlay?: GrapherTabOption
    relatedQuestions?: RelatedQuestionsConfig[]
    internalNotes?: string
    variantName?: string
    originUrl?: string
    isPublished?: boolean
    baseColorScheme?: ColorSchemeName
    invertColorScheme?: boolean
    hideLinesOutsideTolerance?: boolean
    hideConnectedScatterLines?: boolean // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    compareEndPointsOnly?: boolean
    matchingEntitiesOnly?: boolean
    excludedEntities?: number[]
    selectedEntityNames?: EntityName[]
    selectedEntityIds?: EntityId[]
    facet?: FacetStrategy

    xAxis?: Partial<AxisConfigInterface>
    yAxis?: Partial<AxisConfigInterface>
    colorScale?: Partial<ColorScaleConfigInterface>
    map?: Partial<MapConfigInterface>

    // When we move graphers to Git, and remove dimensions, we can clean this up.
    ySlugs?: ColumnSlugs
    xSlug?: ColumnSlug
    sizeSlug?: ColumnSlug
    colorSlug?: ColumnSlug
}

export interface LegacyGrapherInterface extends GrapherInterface {
    selectedData?: EntitySelection[]
    data: any
}

export interface GrapherQueryParams {
    tab?: string
    overlay?: string
    stackMode?: string
    zoomToSelection?: string
    minPopulationFilter?: string
    xScale?: string
    yScale?: string
    time?: string
    region?: string
    country?: string
    shown?: string
    endpointsOnly?: string
}

export interface LegacyGrapherQueryParams extends GrapherQueryParams {
    year?: string
}

// Another approach we may want to try is this: https://github.com/mobxjs/serializr
export const grapherKeysToSerialize = [
    "type",
    "id",
    "version",
    "slug",
    "title",
    "subtitle",
    "sourceDesc",
    "note",
    "hideTitleAnnotation",
    "minTime",
    "maxTime",
    "timelineMinTime",
    "timelineMaxTime",
    "addCountryMode",
    "highlightToggle",
    "stackMode",
    "hideLegend",
    "logo",
    "hideLogo",
    "hideRelativeToggle",
    "entityType",
    "entityTypePlural",
    "hideTimeline",
    "zoomToSelection",
    "minPopulationFilter",
    "showYearLabels",
    "hasChartTab",
    "hasMapTab",
    "tab",
    "internalNotes",
    "variantName",
    "originUrl",
    "isPublished",
    "baseColorScheme",
    "invertColorScheme",
    "hideLinesOutsideTolerance",
    "hideConnectedScatterLines",
    "scatterPointLabelStrategy",
    "compareEndPointsOnly",
    "matchingEntitiesOnly",
    "xAxis",
    "yAxis",
    "colorScale",
    "map",
    "dimensions",
    "selectedEntityNames",
    "selectedEntityIds",
    "excludedEntities",
    "comparisonLines",
    "relatedQuestions",
]

export const legacyQueryParamsToCurrentQueryParams = (
    params: LegacyGrapherQueryParams
) => {
    const obj = omit(params, "year") as GrapherQueryParams
    if (params.year !== undefined) obj.time = obj.time ?? params.year
    return obj
}
