import React from "react"
import ReactDOMServer from "react-dom/server.js"
import * as Sentry from "@sentry/react"
import {
    observable,
    computed,
    action,
    autorun,
    runInAction,
    reaction,
} from "mobx"
import { bind } from "decko"
import {
    uniqWith,
    isEqual,
    uniq,
    slugify,
    lowerCaseFirstLetterUnlessAbbreviation,
    isMobile,
    next,
    sampleFrom,
    range,
    exposeInstanceOnWindow,
    findClosestTime,
    excludeUndefined,
    debounce,
    isInIFrame,
    differenceObj,
    QueryParams,
    MultipleOwidVariableDataDimensionsMap,
    Bounds,
    DEFAULT_BOUNDS,
    minTimeBoundFromJSONOrNegativeInfinity,
    maxTimeBoundFromJSONOrPositiveInfinity,
    TimeBounds,
    getTimeDomainFromQueryString,
    TimeBound,
    minTimeToJSON,
    maxTimeToJSON,
    timeBoundToTimeBoundString,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
    updatePersistables,
    strToQueryParams,
    queryParamsToStr,
    setWindowQueryStr,
    getWindowUrl,
    Url,
    EntityYearHighlight,
    ColumnSlug,
    DimensionProperty,
    SortBy,
    SortConfig,
    SortOrder,
    OwidChartDimensionInterface,
    firstOfNonEmptyArray,
    spansToUnformattedPlainText,
    EnrichedDetail,
    isEmpty,
    compact,
    getOriginAttributionFragments,
    sortBy,
    extractDetailsFromSyntax,
    omit,
    isTouchDevice,
    isArrayDifferentFromReference,
} from "@ourworldindata/utils"
import {
    MarkdownTextWrap,
    sumTextWrapHeights,
} from "@ourworldindata/components"
import {
    GrapherChartType,
    ScaleType,
    StackMode,
    EntitySelectionMode,
    ScatterPointLabelStrategy,
    RelatedQuestionsConfig,
    FacetStrategy,
    SeriesColorMap,
    FacetAxisDomain,
    AnnotationFieldsInTitle,
    MissingDataStrategy,
    SeriesStrategy,
    GrapherInterface,
    grapherKeysToSerialize,
    GrapherQueryParams,
    LegacyGrapherInterface,
    MapProjectionName,
    LogoOption,
    ComparisonLineConfig,
    ColumnSlugs,
    Time,
    EntityName,
    OwidColumnDef,
    OwidVariableRow,
    ColorSchemeName,
    AxisConfigInterface,
    GrapherStaticFormat,
    DetailsMarker,
    DetailDictionary,
    GrapherWindowType,
    Color,
    GRAPHER_QUERY_PARAM_KEYS,
    GrapherTooltipAnchor,
    GrapherTabName,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_OPTIONS,
    GRAPHER_TAB_NAMES,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherTabOption,
    SeriesName,
    ChartViewInfo,
} from "@ourworldindata/types"
import {
    BlankOwidTable,
    OwidTable,
    ColumnTypeMap,
    CoreColumn,
} from "@ourworldindata/core-table"
import {
    BASE_FONT_SIZE,
    CookieKey,
    ThereWasAProblemLoadingThisChart,
    DEFAULT_GRAPHER_WIDTH,
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_ENTITY_TYPE,
    DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL,
    STATIC_EXPORT_DETAIL_SPACING,
    GRAPHER_LOADED_EVENT_NAME,
    isContinentsVariableId,
    isPopulationVariableETLPath,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
    GRAPHER_FRAME_PADDING_VERTICAL,
    latestGrapherConfigSchema,
    GRAPHER_SQUARE_SIZE,
} from "../core/GrapherConstants"
import Cookies from "js-cookie"
import {
    ChartDimension,
    getDimensionColumnSlug,
    LegacyDimensionsManager,
} from "../chart/ChartDimension"
import { TooltipManager } from "../tooltip/TooltipProps"

import { DimensionSlot } from "../chart/DimensionSlot"
import {
    getFocusedSeriesNamesParam,
    getSelectedEntityNamesParam,
} from "./EntityUrlBuilder"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import { MapConfig } from "../mapCharts/MapConfig"
import { FullScreen } from "../fullScreen/FullScreen"
import { isOnTheMap } from "../mapCharts/EntitiesOnTheMap"
import { ChartManager } from "../chart/ChartManager"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons"
import { SettingsMenu, SettingsMenuManager } from "../controls/SettingsMenu"
import { TooltipContainer } from "../tooltip/Tooltip"
import {
    EntitySelectorModal,
    EntitySelectorModalManager,
} from "../modal/EntitySelectorModal"
import { DownloadModal, DownloadModalManager } from "../modal/DownloadModal"
import ReactDOM from "react-dom"
import { observer } from "mobx-react"
import "d3-transition"
import { SourcesModal, SourcesModalManager } from "../modal/SourcesModal"
import { DataTableManager } from "../dataTable/DataTable"
import { MapChartManager } from "../mapCharts/MapChartConstants"
import { MapChart } from "../mapCharts/MapChart"
import { DiscreteBarChartManager } from "../barCharts/DiscreteBarChartConstants"
import { Command, CommandPalette } from "../controls/CommandPalette"
import { ShareMenuManager } from "../controls/ShareMenu"
import { EmbedModalManager, EmbedModal } from "../modal/EmbedModal"
import {
    CaptionedChart,
    CaptionedChartManager,
    StaticCaptionedChart,
} from "../captionedChart/CaptionedChart"
import {
    TimelineController,
    TimelineManager,
} from "../timeline/TimelineController"
import Mousetrap from "mousetrap"
import { SlideShowController } from "../slideshowController/SlideShowController"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap"
import { Entity, SelectionArray } from "../selection/SelectionArray"
import {
    legacyToOwidTableAndDimensions,
    legacyToOwidTableAndDimensionsWithMandatorySlug,
} from "./LegacyToOwidTable"
import { ScatterPlotManager } from "../scatterCharts/ScatterPlotChartConstants"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    findValidChartTypeCombination,
    mapChartTypeNameToQueryParam,
    mapQueryParamToChartTypeName,
} from "../chart/ChartUtils"
import classnames from "classnames"
import { GrapherAnalytics } from "./GrapherAnalytics"
import { legacyToCurrentGrapherQueryParams } from "./GrapherUrlMigrations"
import { ChartInterface } from "../chart/ChartInterface"
import { MarimekkoChartManager } from "../stackedCharts/MarimekkoChartConstants"
import { FacetChartManager } from "../facetChart/FacetChartConstants"
import {
    StaticChartRasterizer,
    type GrapherExport,
} from "../captionedChart/StaticChartRasterizer.js"
import { SlopeChartManager } from "../slopeCharts/SlopeChart"
import { SidePanel } from "../sidePanel/SidePanel"
import {
    EntitySelector,
    type EntitySelectorState,
} from "../entitySelector/EntitySelector"
import { SlideInDrawer } from "../slideInDrawer/SlideInDrawer"
import { BodyDiv } from "../bodyDiv/BodyDiv"
import { grapherObjectToQueryParams } from "./GrapherUrl.js"
import { FocusArray } from "../focus/FocusArray"
import {
    GRAPHER_BACKGROUND_BEIGE,
    GRAPHER_BACKGROUND_DEFAULT,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "../color/ColorConstants"
import { FacetChart } from "../facetChart/FacetChart"

declare global {
    interface Window {
        details?: DetailDictionary
        admin?: any // TODO: use stricter type
    }
}

const DEFAULT_MS_PER_TICK = 100

// Exactly the same as GrapherInterface, but contains options that developers want but authors won't be touching.
export interface GrapherProgrammaticInterface extends GrapherInterface {
    owidDataset?: MultipleOwidVariableDataDimensionsMap // This is temporarily used for testing. Will be removed
    manuallyProvideData?: boolean // This will be removed.
    queryStr?: string
    bounds?: Bounds
    table?: OwidTable
    bakedGrapherURL?: string
    adminBaseUrl?: string
    dataApiUrl?: string
    env?: string
    dataApiUrlForAdmin?: string
    entityYearHighlight?: EntityYearHighlight
    baseFontSize?: number
    staticBounds?: Bounds
    staticFormat?: GrapherStaticFormat

    hideTitle?: boolean
    hideSubtitle?: boolean
    hideNote?: boolean
    hideOriginUrl?: boolean

    hideEntityControls?: boolean
    hideZoomToggle?: boolean
    hideNoDataAreaToggle?: boolean
    hideFacetYDomainToggle?: boolean
    hideXScaleToggle?: boolean
    hideYScaleToggle?: boolean
    hideMapProjectionMenu?: boolean
    hideTableFilterToggle?: boolean
    forceHideAnnotationFieldsInTitle?: AnnotationFieldsInTitle
    hasTableTab?: boolean
    hideChartTabs?: boolean
    hideShareButton?: boolean
    hideExploreTheDataButton?: boolean
    hideRelatedQuestion?: boolean
    isSocialMediaExport?: boolean

    getGrapherInstance?: (instance: Grapher) => void

    enableKeyboardShortcuts?: boolean
    bindUrlToWindow?: boolean
    isEmbeddedInAnOwidPage?: boolean
    isEmbeddedInADataPage?: boolean

    chartViewInfo?: Pick<
        ChartViewInfo,
        "parentChartSlug" | "queryParamsForParentChart"
    >

    manager?: GrapherManager
    instanceRef?: React.RefObject<Grapher>
}

export interface GrapherManager {
    canonicalUrl?: string
    embedDialogUrl?: string
    embedDialogAdditionalElements?: React.ReactElement
    selection?: SelectionArray
    focusArray?: FocusArray
    editUrl?: string
}

export class GrapherState {}

@observer
export class Grapher
    extends React.Component<GrapherProgrammaticInterface>
    implements
        TimelineManager,
        ChartManager,
        AxisManager,
        CaptionedChartManager,
        SourcesModalManager,
        DownloadModalManager,
        DiscreteBarChartManager,
        LegacyDimensionsManager,
        ShareMenuManager,
        EmbedModalManager,
        TooltipManager,
        DataTableManager,
        ScatterPlotManager,
        MarimekkoChartManager,
        FacetChartManager,
        EntitySelectorModalManager,
        SettingsMenuManager,
        MapChartManager,
        SlopeChartManager
{
    // #region SortConfig props
    @observable sortBy?: SortBy = SortBy.total
    @observable sortOrder?: SortOrder = SortOrder.desc
    @observable sortColumnSlug?: string
    // #endregion

    // #region GrapherInterface props
    @observable.ref $schema = latestGrapherConfigSchema
    @observable.ref chartTypes: GrapherChartType[] = [
        GRAPHER_CHART_TYPES.LineChart,
    ]
    @observable.ref id?: number = undefined
    @observable.ref version = 1
    @observable.ref slug?: string = undefined

    // Initializing text fields with `undefined` ensures that empty strings get serialised
    @observable.ref title?: string = undefined
    @observable.ref subtitle: string | undefined = undefined
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note?: string = undefined
    @observable hideAnnotationFieldsInTitle?: AnnotationFieldsInTitle =
        undefined

    @observable.ref minTime?: TimeBound = undefined
    @observable.ref maxTime?: TimeBound = undefined
    @observable.ref timelineMinTime?: Time = undefined
    @observable.ref timelineMaxTime?: Time = undefined
    @observable.ref dimensions: ChartDimension[] = []
    @observable.ref addCountryMode = EntitySelectionMode.MultipleEntities
    @observable comparisonLines?: ComparisonLineConfig[] = undefined // todo: Persistables?
    @observable.ref stackMode = StackMode.absolute
    @observable.ref showNoDataArea = true
    @observable.ref hideLegend?: boolean = false
    @observable.ref logo?: LogoOption = undefined
    @observable.ref hideLogo?: boolean = undefined
    @observable.ref hideRelativeToggle? = true
    @observable.ref entityType = DEFAULT_GRAPHER_ENTITY_TYPE
    @observable.ref entityTypePlural = DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL
    @observable.ref hideTimeline?: boolean = undefined
    @observable.ref zoomToSelection?: boolean = undefined
    @observable.ref showYearLabels?: boolean = undefined // Always show year in labels for bar charts
    @observable.ref hasMapTab = false
    @observable.ref tab: GrapherTabOption = GRAPHER_TAB_OPTIONS.chart
    @observable relatedQuestions?: RelatedQuestionsConfig[] = undefined // todo: Persistables?
    // Missing from GrapherInterface: details
    @observable.ref internalNotes?: string = undefined
    @observable.ref variantName?: string = undefined
    @observable.ref originUrl?: string = undefined
    @observable.ref isPublished?: boolean = undefined
    @observable.ref baseColorScheme?: ColorSchemeName = undefined
    @observable.ref invertColorScheme?: boolean = undefined
    @observable hideConnectedScatterLines?: boolean = undefined // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    @observable.ref hideScatterLabels?: boolean = undefined
    @observable
    scatterPointLabelStrategy?: ScatterPointLabelStrategy = undefined
    @observable.ref compareEndPointsOnly?: boolean = undefined
    @observable.ref matchingEntitiesOnly?: boolean = undefined
    /** Hides the total value label that is normally displayed for stacked bar charts */
    @observable.ref hideTotalValueLabel?: boolean = undefined
    @observable excludedEntities?: number[] = undefined
    /** IncludedEntities are usually empty which means use all available entities. When
        includedEntities is set it means "only use these entities". excludedEntities
        are evaluated afterwards and can still remove entities even if they were included before.
     */
    @observable includedEntities?: number[] = undefined
    @observable selectedEntityNames: EntityName[] = []
    @observable selectedEntityColors: {
        [entityName: string]: string | undefined
    } = {}

    @observable focusedSeriesNames: SeriesName[] = []
    @observable.ref missingDataStrategy?: MissingDataStrategy = undefined
    @observable.ref hideFacetControl?: boolean = undefined
    @observable.ref facettingLabelByYVariables = "metric"
    // the desired faceting strategy, which might not be possible if we change the data
    @observable selectedFacetStrategy?: FacetStrategy = undefined

    @observable.ref xAxis = new AxisConfig(undefined, this)
    @observable.ref yAxis = new AxisConfig(undefined, this)
    @observable colorScale = new ColorScaleConfig()
    @observable map = new MapConfig()

    @observable ySlugs?: ColumnSlugs = undefined
    @observable xSlug?: ColumnSlug = undefined
    @observable sizeSlug?: ColumnSlug = undefined
    @observable colorSlug?: ColumnSlug = undefined
    @observable tableSlugs?: ColumnSlugs = undefined

    // #endregion GrapherInterface properties

    // #region GrapherProgrammaticInterface props

    owidDataset?: MultipleOwidVariableDataDimensionsMap = undefined // This is used for passing data for testing
    manuallyProvideData? = false // This will be removed.
    @computed get queryStr(): string {
        return queryParamsToStr({
            ...this.changedParams,
            ...this.externalQueryParams,
        })
    }
    // bounds defined in interface but not on Grapher
    @computed get table(): OwidTable {
        return this.tableAfterAuthorTimelineFilter
    }

    @observable bakedGrapherURL = this.props.bakedGrapherURL
    adminBaseUrl = this.props.adminBaseUrl
    dataApiUrl =
        this.props.dataApiUrl ?? "https://api.ourworldindata.org/v1/indicators/"
    // env defined in interface but not on Grapher
    @computed get dataApiUrlForAdmin(): string | undefined {
        return this.props.dataApiUrlForAdmin
    }
    /**
     * Used to highlight an entity at a particular time in a line chart.
     * The sparkline in map tooltips makes use of this.
     */
    @observable.ref entityYearHighlight?: EntityYearHighlight = undefined

    @computed get baseFontSize(): number {
        if (this.isStaticAndSmall) {
            return this.computeBaseFontSizeFromHeight(this.staticBounds)
        }
        if (this.isStatic) return 18
        return this._baseFontSize
    }
    @observable private _baseFontSize = BASE_FONT_SIZE
    @computed get staticBounds(): Bounds {
        if (this.props.staticBounds) return this.props.staticBounds
        return this.getStaticBounds(this.staticFormat)
    }
    @observable.ref private _staticFormat = GrapherStaticFormat.landscape
    @observable hideTitle = false
    @observable hideSubtitle = false
    @observable hideNote = false
    @observable hideOriginUrl = false

    // For now I am only exposing this programmatically for the dashboard builder. Setting this to true
    // allows you to still use add country "modes" without showing the buttons in order to prioritize
    // another entity selector over the built in ones.
    @observable hideEntityControls = false

    // exposed programmatically for hiding interactive controls or tabs when desired
    // (e.g. used to hide Grapher chrome when a Grapher chart in a Gdoc article is in "read-only" mode)
    @observable hideZoomToggle = false
    @observable hideNoDataAreaToggle = false
    @observable hideFacetYDomainToggle = false
    @observable hideXScaleToggle = false
    @observable hideYScaleToggle = false
    @observable hideMapProjectionMenu = false
    @observable hideTableFilterToggle = false
    // enforces hiding an annotation, even if that means that a crucial piece of information is missing from the chart title
    @observable forceHideAnnotationFieldsInTitle: AnnotationFieldsInTitle = {
        entity: false,
        time: false,
        changeInPrefix: false,
    }
    @observable hasTableTab = true
    @observable hideChartTabs = false
    @observable hideShareButton = false
    @observable hideExploreTheDataButton = true
    @observable hideRelatedQuestion = false

    @observable.ref isSocialMediaExport = false
    // getGrapherInstance defined in interface but not on Grapher (as a property - it is set in the constructor)

    enableKeyboardShortcuts?: boolean

    bindUrlToWindow?: boolean

    isEmbeddedInAnOwidPage?: boolean = this.props.isEmbeddedInAnOwidPage
    isEmbeddedInADataPage?: boolean = this.props.isEmbeddedInADataPage

    chartViewInfo?: Pick<
        ChartViewInfo,
        "name" | "parentChartSlug" | "queryParamsForParentChart"
    > = undefined

    @computed private get manager(): GrapherManager | undefined {
        return this.props.manager
    }
    // instanceRef defined in interface but not on Grapher

    // #endregion GrapherProgrammaticInterface properties

    // #region Start TimelineManager propertes

    @computed get disablePlay(): boolean {
        return false
    }

    formatTimeFn(time: Time): string {
        return this.inputTable.timeColumn.formatTime(time)
    }

    @observable.ref isPlaying = false
    @observable.ref isTimelineAnimationActive = false // true if the timeline animation is either playing or paused but not finished

    @computed get times(): Time[] {
        const columnSlugs = this.isOnMapTab
            ? [this.mapColumnSlug]
            : this.yColumnSlugs

        // Generate the times only after the chart transform has been applied, so that we don't show
        // times on the timeline for which data may not exist, e.g. when the selected entity
        // doesn't contain data for all years in the table.
        // -@danielgavrilov, 2020-10-22
        return this.tableAfterAuthorTimelineAndActiveChartTransform.getTimesUniqSortedAscForColumns(
            columnSlugs
        )
    }
    @computed get startHandleTimeBound(): TimeBound {
        if (this.isSingleTimeSelectionActive) return this.endHandleTimeBound
        return this.timelineHandleTimeBounds[0]
    }
    @computed get endHandleTimeBound(): TimeBound {
        return this.timelineHandleTimeBounds[1]
    }

    @observable.ref areHandlesOnSameTimeBeforeAnimation?: boolean
    msPerTick = DEFAULT_MS_PER_TICK
    // missing from TimelineManager: onPlay
    @action.bound onTimelineClick(): void {
        const tooltip = this.tooltip?.get()
        if (tooltip) tooltip.dismiss?.()
    }
    // #endregion TimelineManager properties

    // #region ChartManager properties
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @computed get fontSize(): number {
        return this.props.baseFontSize ?? this.baseFontSize
    }
    // table defined in interface but not on Grapher

    @computed get transformedTable(): OwidTable {
        return this.tableAfterAllTransformsAndFilters
    }

    @observable.ref isExportingToSvgOrPng = false

    // comparisonLines defined previously
    @computed get showLegend(): boolean {
        // hide the legend for stacked bar charts
        // if the legend only ever shows a single entity
        if (this.isOnStackedBarTab) {
            const seriesStrategy =
                this.chartInstance.seriesStrategy ||
                autoDetectSeriesStrategy(this, true)
            const isEntityStrategy = seriesStrategy === SeriesStrategy.entity
            const hasSingleEntity = this.selection.numSelectedEntities === 1
            const hideLegend =
                this.hideLegend || (isEntityStrategy && hasSingleEntity)
            return !hideLegend
        }

        return !this.hideLegend
    }

    tooltip?: TooltipManager["tooltip"] = observable.box(undefined, {
        deep: false,
    })
    // baseColorScheme defined previously
    // invertColorScheme defined previously
    // compareEndPointsOnly defined previously
    // zoomToSelection defined previously
    // matchingEntitiesOnly defined previously
    // colorScale defined previously
    // colorScaleColumnOverride defined in interface but not on Grapher
    // colorScaleOverride defined in interface but not on Grapher
    // useValueBasedColorScheme defined in interface but not on Grapher

    @computed get yAxisConfig(): Readonly<AxisConfigInterface> {
        return this.yAxis.toObject()
    }

    @computed get xAxisConfig(): Readonly<AxisConfigInterface> {
        return this.xAxis.toObject()
    }

    @computed get yColumnSlugs(): string[] {
        return this.ySlugs
            ? this.ySlugs.split(" ")
            : this.dimensions
                  .filter((dim) => dim.property === DimensionProperty.y)
                  .map((dim) => dim.columnSlug)
    }

    @computed get yColumnSlug(): string | undefined {
        return this.ySlugs
            ? this.ySlugs.split(" ")[0]
            : this.getSlugForProperty(DimensionProperty.y)
    }

    @computed get xColumnSlug(): string | undefined {
        return this.xSlug ?? this.getSlugForProperty(DimensionProperty.x)
    }

    @computed get sizeColumnSlug(): string | undefined {
        return this.sizeSlug ?? this.getSlugForProperty(DimensionProperty.size)
    }

    @computed get colorColumnSlug(): string | undefined {
        return (
            this.colorSlug ?? this.getSlugForProperty(DimensionProperty.color)
        )
    }

    selection =
        this.manager?.selection ??
        new SelectionArray(
            this.props.selectedEntityNames ?? [],
            this.props.table?.availableEntities ?? []
        )
    // entityType defined previously
    // focusArray defined previously
    // hidePoints defined in interface but not on Grapher
    // startHandleTimeBound defined previously
    // hideNoDataSection defined in interface but not on Grapher
    @computed get startTime(): Time | undefined {
        return findClosestTime(this.times, this.startHandleTimeBound)
    }

    @computed get endTime(): Time | undefined {
        return findClosestTime(this.times, this.endHandleTimeBound)
    }
    // facetStrategy defined previously
    // seriesStrategy defined in interface but not on Grapher
    @computed get _sortConfig(): Readonly<SortConfig> {
        return {
            sortBy: this.sortBy ?? SortBy.total,
            sortOrder: this.sortOrder ?? SortOrder.desc,
            sortColumnSlug: this.sortColumnSlug,
        }
    }

    @computed get sortConfig(): SortConfig {
        const sortConfig = { ...this._sortConfig }
        // In relative mode, where the values for every entity sum up to 100%, sorting by total
        // doesn't make sense. It's also jumpy because of some rounding errors. For this reason,
        // we sort by entity name instead.
        // Marimekko charts are special and there we don't do this forcing of sort order
        if (
            !this.isMarimekko &&
            this.isRelativeMode &&
            sortConfig.sortBy === SortBy.total
        ) {
            sortConfig.sortBy = SortBy.entityName
            sortConfig.sortOrder = SortOrder.asc
        }
        return sortConfig
    }
    // showNoDataArea defined previously
    // externalLegendHoverBin defined in interface but not on Grapher
    @computed get disableIntroAnimation(): boolean {
        return this.isStatic
    }
    // missingDataStrategy defined previously
    @computed get isNarrow(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 420
    }

    @computed get isStatic(): boolean {
        return this.renderToStatic || this.isExportingToSvgOrPng
    }

    @computed get isSemiNarrow(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 550
    }

    @computed get isStaticAndSmall(): boolean {
        if (!this.isStatic) return false
        return this.areStaticBoundsSmall
    }
    // isExportingForSocialMedia defined previously
    @computed get backgroundColor(): Color {
        return this.isExportingForSocialMedia
            ? GRAPHER_BACKGROUND_BEIGE
            : GRAPHER_BACKGROUND_DEFAULT
    }

    @computed get shouldPinTooltipToBottom(): boolean {
        return this.isNarrow && this.isTouchDevice
    }

    // Used for superscript numbers in static exports
    @computed get detailsOrderedByReference(): string[] {
        if (typeof window === "undefined") return []

        // extract details from supporting text
        const subtitleDetails = !this.hideSubtitle
            ? extractDetailsFromSyntax(this.currentSubtitle)
            : []
        const noteDetails = !this.hideNote
            ? extractDetailsFromSyntax(this.note ?? "")
            : []

        // extract details from axis labels
        const yAxisDetails = extractDetailsFromSyntax(
            this.yAxisConfig.label || ""
        )
        const xAxisDetails = extractDetailsFromSyntax(
            this.xAxisConfig.label || ""
        )

        // text fragments are ordered by appearance
        const uniqueDetails = uniq([
            ...subtitleDetails,
            ...yAxisDetails,
            ...xAxisDetails,
            ...noteDetails,
        ])

        return uniqueDetails
    }

    @computed get detailsMarkerInSvg(): DetailsMarker {
        const { isStatic, shouldIncludeDetailsInStaticExport } = this
        return !isStatic
            ? "underline"
            : shouldIncludeDetailsInStaticExport
            ? "superscript"
            : "none"
    }
    // #endregion ChartManager properties

    // #region AxisManager
    // fontSize defined previously
    // detailsOrderedByReference defined previously
    // #endregion

    // CaptionedChartManager interface ommited (only used for testing)

    // #region SourcesModalManager props

    // Ready to go iff we have retrieved data for every variable associated with the chart
    @computed get isReady(): boolean {
        return this.whatAreWeWaitingFor === ""
    }
    // adminBaseUrl defined previously
    @computed get columnsWithSourcesExtensive(): CoreColumn[] {
        const { yColumnSlugs, xColumnSlug, sizeColumnSlug, colorColumnSlug } =
            this

        // sort y-columns by their display name
        const sortedYColumnSlugs = sortBy(
            yColumnSlugs,
            (slug) => this.inputTable.get(slug).titlePublicOrDisplayName.title
        )

        const columnSlugs = excludeUndefined([
            ...sortedYColumnSlugs,
            xColumnSlug,
            sizeColumnSlug,
            colorColumnSlug,
        ])

        return this.inputTable
            .getColumns(uniq(columnSlugs))
            .filter(
                (column) => !!column.source.name || !isEmpty(column.def.origins)
            )
    }

    @computed get showAdminControls(): boolean {
        return (
            this.isUserLoggedInAsAdmin ||
            this.isDev ||
            this.isLocalhost ||
            this.isStaging
        )
    }
    // isSourcesModalOpen defined previously

    @computed get frameBounds(): Bounds {
        return this.useIdealBounds
            ? new Bounds(0, 0, this.idealWidth, this.idealHeight)
            : new Bounds(0, 0, this.availableWidth, this.availableHeight)
    }

    // isEmbeddedInAnOwidPage defined previously
    // isNarrow defined previously
    // fontSize defined previously
    // #endregion

    // #region DownloadModalManager
    @computed get displaySlug(): string {
        return this.slug ?? slugify(this.displayTitle)
    }

    rasterize(): Promise<GrapherExport> {
        const { width, height } = this.staticBoundsWithDetails
        const staticSVG = this.generateStaticSvg()

        return new StaticChartRasterizer(staticSVG, width, height).render()
    }
    // staticBounds defined previously

    @computed get staticBoundsWithDetails(): Bounds {
        const includeDetails =
            this.shouldIncludeDetailsInStaticExport &&
            !isEmpty(this.detailRenderers)

        let height = this.staticBounds.height
        if (includeDetails) {
            height +=
                2 * this.framePaddingVertical +
                sumTextWrapHeights(
                    this.detailRenderers,
                    STATIC_EXPORT_DETAIL_SPACING
                )
        }

        return new Bounds(0, 0, this.staticBounds.width, height)
    }

    @computed get staticFormat(): GrapherStaticFormat {
        if (this.props.staticFormat) return this.props.staticFormat
        return this._staticFormat
    }

    @computed get baseUrl(): string | undefined {
        return this.isPublished
            ? `${this.bakedGrapherURL ?? "/grapher"}/${this.displaySlug}`
            : undefined
    }
    // queryStr defined previously
    // table defined previously
    // transformedTable defined previously

    // todo: remove when we remove dimensions
    @computed get yColumnsFromDimensionsOrSlugsOrAuto(): CoreColumn[] {
        return this.yColumnsFromDimensions.length
            ? this.yColumnsFromDimensions
            : this.table.getColumns(autoDetectYColumnSlugs(this))
    }
    // shouldIncludeDetailsInStaticExport defined previously
    // detailsOrderedByReference defined previously
    // isDownloadModalOpen defined previously
    // frameBounds defined previously

    @computed get captionedChartBounds(): Bounds {
        // if there's no panel, the chart takes up the whole frame
        if (!this.isEntitySelectorPanelActive) return this.frameBounds

        return new Bounds(
            0,
            0,
            // the chart takes up 9 columns in 12-column grid
            (9 / 12) * this.frameBounds.width,
            this.frameBounds.height - 2 // 2px accounts for the border
        )
    }

    @computed get isOnChartOrMapTab(): boolean {
        return this.isOnChartTab || this.isOnMapTab
    }
    // showAdminControls defined previously
    // isSocialMediaExport defined previously
    // isPublished defined previously
    // Columns that are used as a dimension in the currently active view
    @computed get activeColumnSlugs(): string[] {
        const { yColumnSlugs, xColumnSlug, sizeColumnSlug, colorColumnSlug } =
            this

        // sort y columns by their display name
        const sortedYColumnSlugs = sortBy(
            yColumnSlugs,
            (slug) => this.inputTable.get(slug).titlePublicOrDisplayName.title
        )

        return excludeUndefined([
            ...sortedYColumnSlugs,
            xColumnSlug,
            sizeColumnSlug,
            colorColumnSlug,
        ])
    }

    // #endregion

    // #region DiscreteBarChartManager props

    // showYearLabels defined previously
    // endTime defined previously

    @computed get isOnLineChartTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.LineChart
    }
    // #endregion

    // LegacyDimensionsManager omitted (only defines table)

    // #region ShareMenuManager props
    // slug defined previously

    @computed get currentTitle(): string {
        let text = this.displayTitle.trim()
        if (text.length === 0) return text

        // helper function to add an annotation fragment to the title
        // only adds a comma if the text does not end with a question mark
        const appendAnnotationField = (
            text: string,
            annotation: string
        ): string => {
            const separator = text.endsWith("?") ? "" : ","
            return `${text}${separator} ${annotation}`
        }

        if (this.shouldAddEntitySuffixToTitle) {
            const selectedEntityNames = this.selection.selectedEntityNames
            const entityStr = selectedEntityNames[0]
            if (entityStr?.length) text = appendAnnotationField(text, entityStr)
        }

        if (this.shouldAddChangeInPrefixToTitle)
            text = "Change in " + lowerCaseFirstLetterUnlessAbbreviation(text)

        if (this.shouldAddTimeSuffixToTitle && this.timeTitleSuffix)
            text = appendAnnotationField(text, this.timeTitleSuffix)

        return text.trim()
    }

    // Get the full url representing the canonical location of this grapher state
    @computed get canonicalUrl(): string | undefined {
        return (
            this.manager?.canonicalUrl ??
            this.canonicalUrlIfIsChartView ??
            (this.baseUrl ? this.baseUrl + this.queryStr : undefined)
        )
    }

    @computed get editUrl(): string | undefined {
        if (this.showAdminControls) {
            return `${this.adminBaseUrl}/admin/${
                this.manager?.editUrl ?? `charts/${this.id}/edit`
            }`
        }
        return undefined
    }
    // isEmbedModalOpen defined previously
    // #endregion

    // #region EmbedModalManager props
    // canonicalUrl defined previously
    @computed get embedUrl(): string | undefined {
        const url = this.manager?.embedDialogUrl ?? this.canonicalUrl
        if (!url) return

        // We want to preserve the tab in the embed URL so that if we change the
        // default view of the chart, it won't change existing embeds.
        // See https://github.com/owid/owid-grapher/issues/2805
        let urlObj = Url.fromURL(url)
        if (!urlObj.queryParams.tab) {
            urlObj = urlObj.updateQueryParams({ tab: this.allParams.tab })
        }
        return urlObj.fullUrl
    }

    @computed get embedDialogAdditionalElements():
        | React.ReactElement
        | undefined {
        return this.manager?.embedDialogAdditionalElements
    }
    // isEmbedModalOpen defined previously
    // frameBounds defined previously
    // #endregion

    // TooltipManager omitted (only defines tooltip)

    // #region DataTableManager props
    // table defined previously
    // table that is used for display in the table tab
    @computed get tableForDisplay(): OwidTable {
        let table = this.table

        if (!this.isReady || !this.isOnTableTab) return table

        if (this.chartInstance.transformTableForDisplay) {
            table = this.chartInstance.transformTableForDisplay(table)
        }

        if (
            this.forceShowSelectionOnlyInDataTable ||
            this.showSelectionOnlyInDataTable
        ) {
            table = table.filterByEntityNames(
                this.selection.selectedEntityNames
            )
        }

        return table
    }
    // entityType defined previously
    // endTime defined previously
    // startTime defined previously

    @computed get dataTableSlugs(): ColumnSlug[] {
        return this.tableSlugs ? this.tableSlugs.split(" ") : this.newSlugs
    }

    @observable.ref showSelectionOnlyInDataTable?: boolean = undefined

    @computed get entitiesAreCountryLike(): boolean {
        return !!this.entityType.match(/\bcountry\b/i)
    }
    // Small charts are rendered into 6 or 7 columns in a 12-column grid layout
    // (e.g. side-by-side charts or charts in the All Charts block)
    @computed get isSmall(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 740
    }

    // Medium charts are rendered into 8 columns in a 12-column grid layout
    // (e.g. stand-alone charts in the main text of an article)
    @computed get isMedium(): boolean {
        if (this.isStatic) return false
        return this.frameBounds.width <= 845
    }
    // isNarrow defined previoulsy
    // selection defined previously

    @computed get canChangeAddOrHighlightEntities(): boolean {
        return (
            this.canChangeEntity ||
            this.canAddEntities ||
            this.canHighlightEntities
        )
    }
    // hasMapTab defined previously
    @computed get hasChartTab(): boolean {
        return this.validChartTypes.length > 0
    }
    // #endregion DataTableManager props

    // #region ScatterPlotManager props
    // hideConnectedScatterLines defined previously
    // scatterPointLabelStrategy defined previously
    // addCountryMode defined previously

    // todo: this is only relevant for scatter plots and Marimekko. move to scatter plot class?
    // todo: remove this. Should be done as a simple column transform at the data level.
    // Possible to override the x axis dimension to target a special year
    // In case you want to graph say, education in the past and democracy today https://ourworldindata.org/grapher/correlation-between-education-and-democracy
    @computed get xOverrideTime(): number | undefined {
        return this.xDimension?.targetYear
    }
    // tableAfterAuthorTimelineAndActiveChartTransform defined below (together with other table transforms)

    /**
     * Uses some explicit and implicit information to decide whether a timeline is shown.
     */
    @computed get hasTimeline(): boolean {
        // we don't have more than one distinct time point in our data, so it doesn't make sense to show a timeline
        if (this.times.length <= 1) return false

        switch (this.tab) {
            // the map tab has its own `hideTimeline` option
            case GRAPHER_TAB_OPTIONS.map:
                return !this.map.hideTimeline

            // use the chart-level `hideTimeline` option
            case GRAPHER_TAB_OPTIONS.chart:
                return !this.hideTimeline

            // use the chart-level `hideTimeline` option for the table, with some exceptions
            case GRAPHER_TAB_OPTIONS.table:
                // always show the timeline for charts that plot time on the x-axis
                if (this.hasTimeDimension) return true
                return !this.hideTimeline

            default:
                return false
        }
    }

    @computed get isModalOpen(): boolean {
        return (
            this.isEntitySelectorModalOpen ||
            this.isSourcesModalOpen ||
            this.isEmbedModalOpen ||
            this.isDownloadModalOpen
        )
    }

    @computed get isSingleTimeScatterAnimationActive(): boolean {
        return (
            this.isTimelineAnimationActive &&
            this.isOnScatterTab &&
            !this.isRelativeMode &&
            !!this.areHandlesOnSameTimeBeforeAnimation
        )
    }

    @observable.ref animationStartTime?: Time
    @computed get animationEndTime(): Time {
        const { timeColumn } = this.tableAfterAuthorTimelineFilter
        if (this.timelineMaxTime) {
            return (
                findClosestTime(timeColumn.uniqValues, this.timelineMaxTime) ??
                timeColumn.maxTime
            )
        }
        return timeColumn.maxTime
    }
    // #endregion ScatterPlotManager props

    // #region MarimekkoChartManager props
    // endTime defined previously
    // excludedEntities defined previously
    // matchingEntitiesOnly defined previously
    // xOverrideTime defined previously
    // tableAfterAuthorTimelineAndActiveChartTransform defined below (together with other table transforms)
    // sortConfig defined previously
    // hideNoDataArea defined previously
    // includedEntities defined previously
    // #endregion

    // #region FacetChartManager

    @computed get canSelectMultipleEntities(): boolean {
        if (this.numSelectableEntityNames < 2) return false
        if (this.addCountryMode === EntitySelectionMode.MultipleEntities)
            return true

        // if the chart is currently faceted by entity, then use multi-entity
        // selection, even if the author specified single-entity selection
        if (
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.facetStrategy === FacetStrategy.entity
        )
            return true

        return false
    }

    // #endregion

    // #region EntitySelectorModalManager

    @observable entitySelectorState: Partial<EntitySelectorState> = {}
    // tableForSeleciton defined below (together with other table transforms)
    // selection defined previously
    // entityType defined previously
    // entityTypePlural defined previously
    // activeColumnSlugs defined previously
    // dataApiUrl defined previously

    @observable.ref isEntitySelectorModalOrDrawerOpen = false

    @computed get canChangeEntity(): boolean {
        return (
            this.hasChartTab &&
            !this.isOnScatterTab &&
            !this.canSelectMultipleEntities &&
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.numSelectableEntityNames > 1
        )
    }

    @computed get canHighlightEntities(): boolean {
        return (
            this.hasChartTab &&
            this.addCountryMode !== EntitySelectionMode.Disabled &&
            this.numSelectableEntityNames > 1 &&
            !this.canAddEntities &&
            !this.canChangeEntity
        )
    }

    focusArray = new FocusArray()

    // frameBounds defined previously
    // #endregion

    // #region SettingsMenuManager

    // stackMode defined previously

    @computed get relativeToggleLabel(): string {
        if (this.isOnScatterTab) return "Display average annual change"
        else if (this.isOnLineChartTab || this.isOnSlopeChartTab)
            return "Display relative change"
        return "Display relative values"
    }

    // showNoDataArea defined previously

    // facetStrategy defined previously
    // yAxis defined previously
    // zoomToSelection defined previously
    // showSelectedEntitiesOnly defined previously
    // entityTypePlural defined previously

    @computed get availableFacetStrategies(): FacetStrategy[] {
        return this.chartInstance.availableFacetStrategies?.length
            ? this.chartInstance.availableFacetStrategies
            : [FacetStrategy.none]
    }

    // entityType defined previously
    // facettingLabelByYVariables defined previously
    // hideFacetControl defined previously
    // hideRelativeToggle defined previously
    // hideEntityControls defined previously
    // hideZoomToggle defined previously
    // hideNoDataAreaToggle defined previously
    // hideFacetYDomainToggle defined previously
    // hideXScaleToggle defined previously
    // hideYScaleToggle defined previously
    // hideTableFilterToggle defined previously

    @computed get activeChartType(): GrapherChartType | undefined {
        if (!this.isOnChartTab) return undefined
        return this.activeTab as GrapherChartType
    }

    // NB: The timeline scatterplot in relative mode calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode(): boolean {
        // don't allow relative mode in some cases
        if (
            this.hasSingleMetricInFacets ||
            this.hasSingleEntityInFacets ||
            this.isStackedChartSplitByMetric
        )
            return false
        return this.stackMode === StackMode.relative
    }

    // selection defined previously
    // canChangeAddOrHighlightEntities defined previously

    @computed.struct get filledDimensions(): ChartDimension[] {
        return this.isReady ? this.dimensions : []
    }

    // xColumnSlug defined previously
    // xOverrideTime defined previously
    // hasTimeline defined previously
    @computed get canToggleRelativeMode(): boolean {
        const {
            isOnLineChartTab,
            isOnSlopeChartTab,
            hideRelativeToggle,
            areHandlesOnSameTime,
            yScaleType,
            hasSingleEntityInFacets,
            hasSingleMetricInFacets,
            xColumnSlug,
            isOnMarimekkoTab,
            isStackedChartSplitByMetric,
        } = this

        if (isOnLineChartTab || isOnSlopeChartTab)
            return (
                !hideRelativeToggle &&
                !areHandlesOnSameTime &&
                yScaleType !== ScaleType.log
            )

        // actually trying to exclude relative mode with just one metric or entity
        if (
            hasSingleEntityInFacets ||
            hasSingleMetricInFacets ||
            isStackedChartSplitByMetric
        )
            return false

        if (isOnMarimekkoTab && xColumnSlug === undefined) return false
        return !hideRelativeToggle
    }

    @computed get isOnChartTab(): boolean {
        return this.tab === GRAPHER_TAB_OPTIONS.chart
    }

    @computed get isOnMapTab(): boolean {
        return this.tab === GRAPHER_TAB_OPTIONS.map
    }

    @computed get isOnTableTab(): boolean {
        return this.tab === GRAPHER_TAB_OPTIONS.table
    }

    // yAxis defined previously
    // xAxis defined previously
    // compareEndPointsOnly defined previously

    // availableFacetStrategies defined previously
    // the actual facet setting used by a chart, potentially overriding selectedFacetStrategy
    @computed get facetStrategy(): FacetStrategy {
        if (
            this.selectedFacetStrategy &&
            this.availableFacetStrategies.includes(this.selectedFacetStrategy)
        )
            return this.selectedFacetStrategy

        if (
            this.addCountryMode === EntitySelectionMode.SingleEntity &&
            this.selection.selectedEntityNames.length > 1
        ) {
            return FacetStrategy.entity
        }

        return firstOfNonEmptyArray(this.availableFacetStrategies)
    }
    // entityType defined previously
    // facettingLabelByYVariables defined previously

    // hideFacetControl defined previously
    // hideRelativeToggle defined previously
    // hideEntityControls defined previously
    // hideZoomToggle defined previously
    // hideNoDataAreaToggle defined previously
    // hideFacetYDomainToggle defined previously
    // hideXScaleToggle defined previously
    // hideYScaleToggle defined previously
    // hideTableFilterToggle defined previously
    // activeChartType defined previously
    // isRelativeMode defined previously
    // selection defined previously
    // canChangeAddOrHighlightEntities defined previously
    // filledDimensions defined previously
    // xColumnSlug defined previously
    // xOverrideTime defined previously
    // hasTimeline defined previously
    // canToggleRelativeMode defined previously
    // isOnChartTab defined previously
    // isOnMapTab defined previously
    // isOnTableTab defined previously
    // yAxis defined previously
    // xAxis defined previously
    // compareEndPointsOnly defined previously

    // #endregion

    // #region MapChartManager props

    @computed get mapColumnSlug(): string {
        const mapColumnSlug = this.map.columnSlug
        // If there's no mapColumnSlug or there is one but it's not in the dimensions array, use the first ycolumn
        if (
            !mapColumnSlug ||
            !this.dimensions.some((dim) => dim.columnSlug === mapColumnSlug)
        )
            return this.yColumnSlug!
        return mapColumnSlug
    }

    @computed get mapIsClickable(): boolean {
        return (
            this.hasChartTab &&
            (this.hasLineChart || this.isScatter) &&
            !isMobile()
        )
    }

    // tab defined previously
    // type defined in interface but not on Grapher

    @computed get isLineChartThatTurnedIntoDiscreteBar(): boolean {
        if (!this.isLineChart) return false

        let { minTime, maxTime } = this

        // if we have a time dimension but the timeline is hidden,
        // we always want to use the authored `minTime` and `maxTime`,
        // irrespective of the time range the user might have selected
        // on the table tab
        if (this.hasTimeDimensionButTimelineIsHidden) {
            minTime = this.authorsVersion.minTime
            maxTime = this.authorsVersion.maxTime
        }

        // This is the easy case: minTime and maxTime are the same, no need to do
        // more fancy checks
        if (minTime === maxTime) return true

        // We can have cases where minTime = Infinity and/or maxTime = -Infinity,
        // but still only a single year is selected.
        // To check for that we need to look at the times array.
        const times = this.tableAfterAuthorTimelineFilter.timeColumn.uniqValues
        const closestMinTime = findClosestTime(times, minTime ?? -Infinity)
        const closestMaxTime = findClosestTime(times, maxTime ?? Infinity)
        return closestMinTime !== undefined && closestMinTime === closestMaxTime
    }

    // hasTimeline defined previously

    @action.bound resetHandleTimeBounds(): void {
        this.startHandleTimeBound = this.timelineMinTime ?? -Infinity
        this.endHandleTimeBound = this.timelineMaxTime ?? Infinity
    }

    @computed get mapConfig(): MapConfig {
        return this.map
    }

    // endTime defined previously
    // title defined previously
    // #endregion

    // #region SlopeChartManager props
    // canSelectMultipleEntities defined previously
    // hasTimeline defined previously
    // hideNoDataSection defined in interface but not on Grapher
    // #endregion

    // #region Observable props not in any interface

    @observable.ref _isInFullScreenMode = false

    @observable.ref windowInnerWidth?: number
    @observable.ref windowInnerHeight?: number
    @observable.ref chartTab?: GrapherChartType

    // TODO: Pass these 5 in as options, don't get them as globals.
    isDev = this.props.env === "development"
    analytics = new GrapherAnalytics(this.props.env ?? "")
    isEditor =
        typeof window !== "undefined" && (window as any).isEditor === true

    seriesColorMap: SeriesColorMap = new Map()
    @observable.ref externalQueryParams: QueryParams

    private framePaddingHorizontal = GRAPHER_FRAME_PADDING_HORIZONTAL
    private framePaddingVertical = GRAPHER_FRAME_PADDING_VERTICAL

    @observable.ref inputTable: OwidTable

    @observable.ref legacyConfigAsAuthored: Partial<LegacyGrapherInterface> = {}

    // stored on Grapher so state is preserved when switching to full-screen mode

    @observable.ref renderToStatic = false

    @observable.ref isSourcesModalOpen = false
    @observable.ref isDownloadModalOpen = false
    @observable.ref isEmbedModalOpen = false

    @observable
    private legacyVariableDataJson?: MultipleOwidVariableDataDimensionsMap
    @observable shouldIncludeDetailsInStaticExport = true
    private hasLoggedGAViewEvent = false
    @observable private hasBeenVisible = false
    @observable private uncaughtError?: Error
    @observable slideShow?: SlideShowController<any>
    @observable isShareMenuActive = false

    timelineController = new TimelineController(this)

    // #endregion

    @computed get activeTab(): GrapherTabName {
        if (this.tab === GRAPHER_TAB_OPTIONS.table)
            return GRAPHER_TAB_NAMES.Table
        if (this.tab === GRAPHER_TAB_OPTIONS.map)
            return GRAPHER_TAB_NAMES.WorldMap
        if (this.chartTab) return this.chartTab
        return this.chartType ?? GRAPHER_TAB_NAMES.LineChart
    }

    @computed get chartType(): GrapherChartType | undefined {
        return this.validChartTypes[0]
    }
    @computed get tableForSelection(): OwidTable {
        // This table specifies which entities can be selected in the charts EntitySelectorModal.
        // It should contain all entities that can be selected, and none more.
        // Depending on the chart type, the criteria for being able to select an entity are
        // different; e.g. for scatterplots, the entity needs to (1) not be excluded and
        // (2) needs to have data for the x and y dimension.
        let table = this.isScatter
            ? this.tableAfterAuthorTimelineAndActiveChartTransform
            : this.inputTable

        if (!this.isReady) return table

        // Some chart types (e.g. stacked area charts) choose not to show an entity
        // with incomplete data. Such chart types define a custom transform function
        // to ensure that the entity selector only offers entities that are actually plotted.
        if (this.chartInstance.transformTableForSelection) {
            table = this.chartInstance.transformTableForSelection(table)
        }

        return table
    }

    @computed private get showsAllEntitiesInChart(): boolean {
        return this.isScatter || this.isMarimekko
    }

    @computed private get settingsMenu(): SettingsMenu {
        return new SettingsMenu({ manager: this, top: 0, bottom: 0, right: 0 })
    }

    /**
     * If the table filter toggle isn't offered, then we default to
     * to showing only the selected entities – unless there is a view
     * that displays all data points, like a map or a scatter plot.
     */
    @computed get forceShowSelectionOnlyInDataTable(): boolean {
        return (
            !this.settingsMenu.showTableFilterToggle &&
            this.hasChartTab &&
            !this.showsAllEntitiesInChart &&
            !this.hasMapTab
        )
    }
    /**
     * Input table with color and size tolerance applied.
     *
     * This happens _before_ applying the author's timeline filter to avoid
     * accidentally dropping all color values before applying tolerance.
     * This is especially important for scatter plots and Marimekko charts,
     * where color and size columns are often transformed with infinite tolerance.
     *
     * Line and discrete bar charts also support a color dimension, but their
     * tolerance transformations run in their respective transformTable functions
     * since it's more efficient to run them on a table that has been filtered
     * by selected entities.
     */
    @computed get tableAfterColorAndSizeToleranceApplication(): OwidTable {
        let table = this.inputTable

        if (this.isScatter && this.sizeColumnSlug) {
            const tolerance =
                table.get(this.sizeColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                this.sizeColumnSlug,
                tolerance
            )
        }

        if ((this.isScatter || this.isMarimekko) && this.colorColumnSlug) {
            const tolerance =
                table.get(this.colorColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                this.colorColumnSlug,
                tolerance
            )
        }

        return table
    }

    // If an author sets a timeline filter run it early in the pipeline so to the charts it's as if the filtered times do not exist
    @computed get tableAfterAuthorTimelineFilter(): OwidTable {
        const table = this.tableAfterColorAndSizeToleranceApplication

        if (
            this.timelineMinTime === undefined &&
            this.timelineMaxTime === undefined
        )
            return table
        return table.filterByTimeRange(
            this.timelineMinTime ?? -Infinity,
            this.timelineMaxTime ?? Infinity
        )
    }

    @computed
    get tableAfterAuthorTimelineAndActiveChartTransform(): OwidTable {
        const table = this.tableAfterAuthorTimelineFilter
        if (!this.isReady || !this.isOnChartOrMapTab) return table

        const startMark = performance.now()

        const transformedTable = this.chartInstance.transformTable(table)

        this.createPerformanceMeasurement(
            "chartInstance.transformTable",
            startMark
        )
        return transformedTable
    }

    @computed get chartInstance(): ChartInterface {
        // Note: when timeline handles on a LineChart are collapsed into a single handle, the
        // LineChart turns into a DiscreteBar.

        return this.isOnMapTab
            ? new MapChart({ manager: this })
            : this.chartInstanceExceptMap
    }

    // When Map becomes a first-class chart instance, we should drop this
    @computed get chartInstanceExceptMap(): ChartInterface {
        const chartTypeName =
            this.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart

        const ChartClass =
            ChartComponentClassMap.get(chartTypeName) ?? DefaultChartClass
        return new ChartClass({ manager: this })
    }

    @computed get chartSeriesNames(): SeriesName[] {
        if (!this.isReady) return []

        // collect series names from all chart instances when faceted
        if (this.isFaceted) {
            const facetChartInstance = new FacetChart({ manager: this })
            return uniq(
                facetChartInstance.intermediateChartInstances.flatMap(
                    (chartInstance) =>
                        chartInstance.series.map((series) => series.seriesName)
                )
            )
        }

        return this.chartInstance.series.map((series) => series.seriesName)
    }

    @computed
    private get tableAfterAllTransformsAndFilters(): OwidTable {
        const { startTime, endTime } = this
        const table = this.tableAfterAuthorTimelineAndActiveChartTransform

        if (startTime === undefined || endTime === undefined) return table

        if (this.isOnMapTab)
            return table.filterByTargetTimes(
                [endTime],
                this.map.timeTolerance ??
                    table.get(this.mapColumnSlug).tolerance
            )

        if (
            this.isDiscreteBar ||
            this.isLineChartThatTurnedIntoDiscreteBar ||
            this.isMarimekko
        )
            return table.filterByTargetTimes(
                [endTime],
                table.get(this.yColumnSlugs[0]).tolerance
            )

        if (this.isOnSlopeChartTab)
            return table.filterByTargetTimes(
                [startTime, endTime],
                table.get(this.yColumnSlugs[0]).tolerance
            )

        return table.filterByTimeRange(startTime, endTime)
    }

    private get isStaging(): boolean {
        if (typeof location === "undefined") return false
        return location.host.includes("staging")
    }

    private get isLocalhost(): boolean {
        if (typeof location === "undefined") return false
        return location.host.includes("localhost")
    }

    /**
     * Whether the chart is rendered in an Admin context (e.g. on owid.cloud).
     */
    @computed get useAdminAPI(): boolean {
        if (typeof window === "undefined") return false
        return (
            window.admin !== undefined &&
            // Ensure that we're not accidentally matching on a DOM element with an ID of "admin"
            typeof window.admin.isSuperuser === "boolean"
        )
    }

    @computed get isUserLoggedInAsAdmin(): boolean {
        // This cookie is set by visiting ourworldindata.org/identifyadmin on the static site.
        // There is an iframe on owid.cloud to trigger a visit to that page.

        try {
            // Cookie access can be restricted by iframe sandboxing, in which case the below code will throw an error
            // see https://github.com/owid/owid-grapher/pull/2452

            return !!Cookies.get(CookieKey.isAdmin)
        } catch {
            return false
        }
    }

    @action.bound private applyOriginalFocusAsAuthored(): void {
        if (this.focusedSeriesNames?.length)
            this.focusArray.clearAllAndAdd(...this.focusedSeriesNames)
    }

    @computed get hasData(): boolean {
        return this.dimensions.length > 0 || this.newSlugs.length > 0
    }

    @computed get whatAreWeWaitingFor(): string {
        const { newSlugs, inputTable, dimensions } = this
        if (newSlugs.length || dimensions.length === 0) {
            const missingColumns = newSlugs.filter(
                (slug) => !inputTable.has(slug)
            )
            return missingColumns.length
                ? `Waiting for columns ${missingColumns.join(",")} in table '${
                      inputTable.tableSlug
                  }'. ${inputTable.tableDescription}`
                : ""
        }
        if (dimensions.length > 0 && this.loadingDimensions.length === 0)
            return ""
        return `Waiting for dimensions ${this.loadingDimensions.join(",")}.`
    }

    // If we are using new slugs and not dimensions, Grapher is ready.
    @computed get newSlugs(): string[] {
        const { xSlug, colorSlug, sizeSlug } = this
        const ySlugs = this.ySlugs ? this.ySlugs.split(" ") : []
        return excludeUndefined([...ySlugs, xSlug, colorSlug, sizeSlug])
    }

    @computed private get loadingDimensions(): ChartDimension[] {
        return this.dimensions.filter(
            (dim) => !this.inputTable.has(dim.columnSlug)
        )
    }

    @computed get isInIFrame(): boolean {
        return isInIFrame()
    }

    /**
     * Plots time on the x-axis.
     */
    @computed private get hasTimeDimension(): boolean {
        return this.isStackedBar || this.isStackedArea || this.isLineChart
    }

    @computed private get hasTimeDimensionButTimelineIsHidden(): boolean {
        return this.hasTimeDimension && !!this.hideTimeline
    }

    @computed private get validDimensions(): ChartDimension[] {
        const { dimensions } = this
        const validProperties = this.dimensionSlots.map((d) => d.property)
        let validDimensions = dimensions.filter((dim) =>
            validProperties.includes(dim.property)
        )

        this.dimensionSlots.forEach((slot) => {
            if (!slot.allowMultiple)
                validDimensions = uniqWith(
                    validDimensions,
                    (
                        a: OwidChartDimensionInterface,
                        b: OwidChartDimensionInterface
                    ) =>
                        a.property === slot.property &&
                        a.property === b.property
                )
        })

        return validDimensions
    }

    // todo: do we need this?
    @computed get originUrlWithProtocol(): string {
        if (!this.originUrl) return ""
        let url = this.originUrl
        if (!url.startsWith("http")) url = `https://${url}`
        return url
    }

    @computed get timelineHandleTimeBounds(): TimeBounds {
        if (this.isOnMapTab) {
            const time = maxTimeBoundFromJSONOrPositiveInfinity(this.map.time)
            return [time, time]
        }

        // If the timeline is hidden on the chart tab but displayed on the table tab
        // (which is the case for charts that plot time on the x-axis),
        // we always want to use the authored `minTime` and `maxTime` for the chart,
        // irrespective of the time range the user might have selected on the table tab
        if (this.isOnChartTab && this.hasTimeDimensionButTimelineIsHidden) {
            const { minTime, maxTime } = this.authorsVersion
            return [
                minTimeBoundFromJSONOrNegativeInfinity(minTime),
                maxTimeBoundFromJSONOrPositiveInfinity(maxTime),
            ]
        }

        return [
            // Handle `undefined` values in minTime/maxTime
            minTimeBoundFromJSONOrNegativeInfinity(this.minTime),
            maxTimeBoundFromJSONOrPositiveInfinity(this.maxTime),
        ]
    }

    @computed private get onlySingleTimeSelectionPossible(): boolean {
        return (
            this.isDiscreteBar ||
            this.isStackedDiscreteBar ||
            this.isOnMapTab ||
            this.isMarimekko
        )
    }

    @computed private get isSingleTimeSelectionActive(): boolean {
        return (
            this.onlySingleTimeSelectionPossible ||
            this.isSingleTimeScatterAnimationActive
        )
    }

    @computed get shouldLinkToOwid(): boolean {
        if (
            this.isEmbeddedInAnOwidPage ||
            this.isExportingToSvgOrPng ||
            !this.isInIFrame
        )
            return false

        return true
    }

    @computed.struct private get variableIds(): number[] {
        return uniq(this.dimensions.map((d) => d.variableId))
    }

    @computed get hasOWIDLogo(): boolean {
        return (
            !this.hideLogo && (this.logo === undefined || this.logo === "owid")
        )
    }

    // todo: did this name get botched in a merge?
    @computed get hasFatalErrors(): boolean {
        const { relatedQuestions = [] } = this
        return relatedQuestions.some(
            (question) => !!getErrorMessageRelatedQuestionUrl(question)
        )
    }

    // Get the dimension slots appropriate for this type of chart
    @computed get dimensionSlots(): DimensionSlot[] {
        const xAxis = new DimensionSlot(this, DimensionProperty.x)
        const yAxis = new DimensionSlot(this, DimensionProperty.y)
        const color = new DimensionSlot(this, DimensionProperty.color)
        const size = new DimensionSlot(this, DimensionProperty.size)

        if (this.isLineChart || this.isDiscreteBar) return [yAxis, color]
        else if (this.isScatter) return [yAxis, xAxis, size, color]
        else if (this.isMarimekko) return [yAxis, xAxis, color]
        return [yAxis]
    }

    // Used for static exports. Defined at this level because they need to
    // be accessed by CaptionedChart and DownloadModal
    @computed get detailRenderers(): MarkdownTextWrap[] {
        if (typeof window === "undefined") return []
        return this.detailsOrderedByReference.map((term, i) => {
            let text = `**${i + 1}.** `
            const detail: EnrichedDetail | undefined = window.details?.[term]
            if (detail) {
                const plainText = detail.text.map(({ value }) =>
                    spansToUnformattedPlainText(value)
                )
                plainText[0] = `**${plainText[0]}**:`

                text += `${plainText.join(" ")}`
            }

            // can't use the computed property here because Grapher might not currently be in static mode
            const baseFontSize = this.areStaticBoundsSmall
                ? this.computeBaseFontSizeFromHeight(this.staticBounds)
                : 18

            return new MarkdownTextWrap({
                text,
                fontSize: (11 / BASE_FONT_SIZE) * baseFontSize,
                // leave room for padding on the left and right
                maxWidth:
                    this.staticBounds.width - 2 * this.framePaddingHorizontal,
                lineHeight: 1.2,
                style: {
                    fill: this.secondaryColorInStaticCharts,
                },
            })
        })
    }

    @computed get hasProjectedData(): boolean {
        return this.inputTable.numericColumnSlugs.some(
            (slug) => this.inputTable.get(slug).isProjection
        )
    }

    @computed get validChartTypes(): GrapherChartType[] {
        const { chartTypes } = this

        // all single-chart Graphers are valid
        if (chartTypes.length <= 1) return chartTypes

        // find valid combination in a pre-defined list
        const validChartTypes = findValidChartTypeCombination(chartTypes)

        // if the given combination is not valid, then ignore all but the first chart type
        if (!validChartTypes) return chartTypes.slice(0, 1)

        // projected data is only supported for line charts
        const isLineChart = validChartTypes[0] === GRAPHER_CHART_TYPES.LineChart
        if (isLineChart && this.hasProjectedData) {
            return [GRAPHER_CHART_TYPES.LineChart]
        }

        return validChartTypes
    }

    @computed get validChartTypeSet(): Set<GrapherChartType> {
        return new Set(this.validChartTypes)
    }

    @computed get availableTabs(): GrapherTabName[] {
        const availableTabs: GrapherTabName[] = []
        if (this.hasTableTab) availableTabs.push(GRAPHER_TAB_NAMES.Table)
        if (this.hasMapTab) availableTabs.push(GRAPHER_TAB_NAMES.WorldMap)
        if (!this.hideChartTabs) availableTabs.push(...this.validChartTypes)
        return availableTabs
    }

    @computed get hasMultipleChartTypes(): boolean {
        return this.validChartTypes.length > 1
    }

    @computed get currentSubtitle(): string {
        const subtitle = this.subtitle
        if (subtitle !== undefined) return subtitle
        const yColumns = this.yColumnsFromDimensions
        if (yColumns.length === 1) return yColumns[0].def.descriptionShort ?? ""
        return ""
    }

    @computed get shouldAddEntitySuffixToTitle(): boolean {
        const selectedEntityNames = this.selection.selectedEntityNames
        const showEntityAnnotation = !this.hideAnnotationFieldsInTitle?.entity

        const seriesStrategy =
            this.chartInstance.seriesStrategy ||
            autoDetectSeriesStrategy(this, true)

        return !!(
            !this.forceHideAnnotationFieldsInTitle?.entity &&
            this.tab === GRAPHER_TAB_OPTIONS.chart &&
            (seriesStrategy !== SeriesStrategy.entity || !this.showLegend) &&
            selectedEntityNames.length === 1 &&
            (showEntityAnnotation ||
                this.canChangeEntity ||
                this.canSelectMultipleEntities)
        )
    }

    @computed get shouldAddTimeSuffixToTitle(): boolean {
        const showTimeAnnotation = !this.hideAnnotationFieldsInTitle?.time
        return (
            !this.forceHideAnnotationFieldsInTitle?.time &&
            this.isReady &&
            (showTimeAnnotation ||
                (this.hasTimeline &&
                    // chart types that refer to the current time only in the timeline
                    (this.isLineChartThatTurnedIntoDiscreteBar ||
                        this.isOnDiscreteBarTab ||
                        this.isOnStackedDiscreteBarTab ||
                        this.isOnMarimekkoTab ||
                        this.isOnMapTab)))
        )
    }

    @computed get shouldAddChangeInPrefixToTitle(): boolean {
        const showChangeInPrefix =
            !this.hideAnnotationFieldsInTitle?.changeInPrefix
        return (
            !this.forceHideAnnotationFieldsInTitle?.changeInPrefix &&
            (this.isOnLineChartTab || this.isOnSlopeChartTab) &&
            this.isRelativeMode &&
            showChangeInPrefix
        )
    }

    @computed private get areHandlesOnSameTime(): boolean {
        const times = this.tableAfterAuthorTimelineFilter.timeColumn.uniqValues
        const [start, end] = this.timelineHandleTimeBounds.map((time) =>
            findClosestTime(times, time)
        )
        return start === end
    }

    @computed get yColumnsFromDimensions(): CoreColumn[] {
        return this.filledDimensions
            .filter((dim) => dim.property === DimensionProperty.y)
            .map((dim) => dim.column)
    }

    @computed get yScaleType(): ScaleType | undefined {
        return this.yAxis.scaleType
    }

    @computed get xScaleType(): ScaleType | undefined {
        return this.xAxis.scaleType
    }

    @computed private get timeTitleSuffix(): string | undefined {
        const timeColumn = this.table.timeColumn
        if (timeColumn.isMissing) return undefined // Do not show year until data is loaded
        const { startTime, endTime } = this
        if (startTime === undefined || endTime === undefined) return undefined

        const time =
            startTime === endTime
                ? timeColumn.formatValue(startTime)
                : timeColumn.formatValue(startTime) +
                  " to " +
                  timeColumn.formatValue(endTime)

        return time
    }

    @computed get sourcesLine(): string {
        return this.sourceDesc ?? this.defaultSourcesLine
    }

    @computed get columnsWithSourcesCondensed(): CoreColumn[] {
        const { yColumnSlugs } = this

        const columnSlugs = [...yColumnSlugs]
        columnSlugs.push(...this.getColumnSlugsForCondensedSources())

        return this.inputTable
            .getColumns(uniq(columnSlugs))
            .filter(
                (column) => !!column.source.name || !isEmpty(column.def.origins)
            )
    }

    @computed private get defaultSourcesLine(): string {
        const attributions = this.columnsWithSourcesCondensed.flatMap(
            (column) => {
                const { presentation = {} } = column.def
                // if the variable metadata specifies an attribution on the
                // variable level then this is preferred over assembling it from
                // the source and origins
                if (
                    presentation.attribution !== undefined &&
                    presentation.attribution !== ""
                )
                    return [presentation.attribution]
                else {
                    const originFragments = getOriginAttributionFragments(
                        column.def.origins
                    )
                    return [column.source.name, ...originFragments]
                }
            }
        )

        const uniqueAttributions = uniq(compact(attributions))

        if (uniqueAttributions.length > 3)
            return `${uniqueAttributions[0]} and other sources`

        return uniqueAttributions.join("; ")
    }

    @computed private get axisDimensions(): ChartDimension[] {
        return this.filledDimensions.filter(
            (dim) =>
                dim.property === DimensionProperty.y ||
                dim.property === DimensionProperty.x
        )
    }

    @computed private get defaultTitle(): string {
        const yColumns = this.yColumnsFromDimensionsOrSlugsOrAuto

        if (this.isScatter)
            return this.axisDimensions
                .map(
                    (dimension) =>
                        dimension.column.titlePublicOrDisplayName.title
                )
                .join(" vs. ")

        const uniqueDatasetNames = uniq(
            excludeUndefined(
                yColumns.map((col) => (col.def as OwidColumnDef).datasetName)
            )
        )

        if (this.hasMultipleYColumns && uniqueDatasetNames.length === 1)
            return uniqueDatasetNames[0]

        if (yColumns.length === 2)
            return yColumns
                .map((col) => col.titlePublicOrDisplayName.title)
                .join(" and ")

        return yColumns
            .map((col) => col.titlePublicOrDisplayName.title)
            .join(", ")
    }

    @computed get displayTitle(): string {
        if (this.title) return this.title
        if (this.isReady) return this.defaultTitle
        return ""
    }

    // Returns an object ready to be serialized to JSON
    @computed get object(): GrapherInterface {
        return this.toObject()
    }

    @computed
    get typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart(): GrapherChartType {
        return this.isLineChartThatTurnedIntoDiscreteBarActive
            ? GRAPHER_CHART_TYPES.DiscreteBar
            : this.activeChartType ?? GRAPHER_CHART_TYPES.LineChart
    }

    @computed get isLineChart(): boolean {
        return (
            this.chartType === GRAPHER_CHART_TYPES.LineChart || !this.chartType
        )
    }
    @computed get isScatter(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.ScatterPlot
    }
    @computed get isStackedArea(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.StackedArea
    }
    @computed get isSlopeChart(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.SlopeChart
    }
    @computed get isDiscreteBar(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.DiscreteBar
    }
    @computed get isStackedBar(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.StackedBar
    }
    @computed get isMarimekko(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.Marimekko
    }
    @computed get isStackedDiscreteBar(): boolean {
        return this.chartType === GRAPHER_CHART_TYPES.StackedDiscreteBar
    }

    @computed get isLineChartThatTurnedIntoDiscreteBarActive(): boolean {
        return (
            this.isOnLineChartTab && this.isLineChartThatTurnedIntoDiscreteBar
        )
    }

    @computed get isOnScatterTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.ScatterPlot
    }
    @computed get isOnStackedAreaTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.StackedArea
    }
    @computed get isOnSlopeChartTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.SlopeChart
    }
    @computed get isOnDiscreteBarTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.DiscreteBar
    }
    @computed get isOnStackedBarTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.StackedBar
    }
    @computed get isOnMarimekkoTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.Marimekko
    }
    @computed get isOnStackedDiscreteBarTab(): boolean {
        return this.activeChartType === GRAPHER_CHART_TYPES.StackedDiscreteBar
    }

    @computed get hasLineChart(): boolean {
        return this.validChartTypeSet.has(GRAPHER_CHART_TYPES.LineChart)
    }
    @computed get hasSlopeChart(): boolean {
        return this.validChartTypeSet.has(GRAPHER_CHART_TYPES.SlopeChart)
    }

    @computed get supportsMultipleYColumns(): boolean {
        return !this.isScatter
    }

    @computed private get xDimension(): ChartDimension | undefined {
        return this.filledDimensions.find(
            (d) => d.property === DimensionProperty.x
        )
    }

    @computed get defaultBounds(): Bounds {
        return new Bounds(0, 0, DEFAULT_GRAPHER_WIDTH, DEFAULT_GRAPHER_HEIGHT)
    }

    @computed get hasYDimension(): boolean {
        return this.dimensions.some((d) => d.property === DimensionProperty.y)
    }

    @computed get cacheTag(): string {
        return this.version.toString()
    }

    // Filter data to what can be display on the map (across all times)
    @computed get mappableData(): OwidVariableRow<any>[] {
        return this.inputTable
            .get(this.mapColumnSlug)
            .owidRows.filter((row) => isOnTheMap(row.entityName))
    }

    @computed get isMobile(): boolean {
        return isMobile()
    }

    @computed get isTouchDevice(): boolean {
        return isTouchDevice()
    }

    @computed private get externalBounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get isPortrait(): boolean {
        return (
            this.externalBounds.width < this.externalBounds.height &&
            this.externalBounds.width < DEFAULT_GRAPHER_WIDTH
        )
    }

    @computed private get widthForDeviceOrientation(): number {
        return this.isPortrait ? 400 : 680
    }

    @computed private get heightForDeviceOrientation(): number {
        return this.isPortrait ? 640 : 480
    }

    @computed private get useIdealBounds(): boolean {
        const {
            isEditor,
            isExportingToSvgOrPng,
            externalBounds,
            widthForDeviceOrientation,
            heightForDeviceOrientation,
            isInIFrame,
            isInFullScreenMode,
            windowInnerWidth,
            windowInnerHeight,
        } = this

        // In full-screen mode, we usually use all space available to us
        // We use the ideal bounds only if the available space is very large
        if (isInFullScreenMode) {
            if (
                windowInnerHeight! > 2 * heightForDeviceOrientation &&
                windowInnerWidth! > 2 * widthForDeviceOrientation
            )
                return true
            return false
        }

        // For these, defer to the bounds that are set externally
        if (
            this.isEmbeddedInADataPage ||
            this.isEmbeddedInAnOwidPage ||
            this.props.manager ||
            isInIFrame
        )
            return false

        // If the user is using interactive version and then goes to export chart, use current bounds to maintain WYSIWYG
        if (isExportingToSvgOrPng) return false

        // In the editor, we usually want ideal bounds, except when we're rendering a static preview;
        // in that case, we want to use the given static bounds
        if (isEditor) return !this.renderToStatic

        // If the available space is very small, we use all of the space given to us
        if (
            externalBounds.height < heightForDeviceOrientation ||
            externalBounds.width < widthForDeviceOrientation
        )
            return false

        return true
    }

    // If we have a big screen to be in, we can define our own aspect ratio and sit in the center
    @computed private get scaleToFitIdeal(): number {
        return Math.min(
            (this.availableWidth * 0.95) / this.widthForDeviceOrientation,
            (this.availableHeight * 0.95) / this.heightForDeviceOrientation
        )
    }

    @computed private get fullScreenPadding(): number {
        const { windowInnerWidth } = this
        if (!windowInnerWidth) return 0
        return windowInnerWidth < 940 ? 0 : 40
    }

    @computed get hideFullScreenButton(): boolean {
        if (this.isInFullScreenMode) return false
        // hide the full screen button if the full screen height
        // is barely larger than the current chart height
        const fullScreenHeight = this.windowInnerHeight!
        return fullScreenHeight < this.frameBounds.height + 80
    }

    @computed private get availableWidth(): number {
        const {
            externalBounds,
            isInFullScreenMode,
            windowInnerWidth,
            fullScreenPadding,
        } = this

        return Math.floor(
            isInFullScreenMode
                ? windowInnerWidth! - 2 * fullScreenPadding
                : externalBounds.width
        )
    }

    @computed private get availableHeight(): number {
        const {
            externalBounds,
            isInFullScreenMode,
            windowInnerHeight,
            fullScreenPadding,
        } = this

        return Math.floor(
            isInFullScreenMode
                ? windowInnerHeight! - 2 * fullScreenPadding
                : externalBounds.height
        )
    }

    @computed private get idealWidth(): number {
        return Math.floor(this.widthForDeviceOrientation * this.scaleToFitIdeal)
    }

    @computed private get idealHeight(): number {
        return Math.floor(
            this.heightForDeviceOrientation * this.scaleToFitIdeal
        )
    }

    @computed get sidePanelBounds(): Bounds | undefined {
        if (!this.isEntitySelectorPanelActive) return

        return new Bounds(
            0, // not in use; intentionally set to zero
            0, // not in use; intentionally set to zero
            this.frameBounds.width - this.captionedChartBounds.width,
            this.captionedChartBounds.height
        )
    }
    @computed get containerElement(): HTMLDivElement | undefined {
        return this.base.current || undefined
    }

    @computed get availableEntities(): Entity[] {
        return this.tableForSelection.availableEntities
    }
    @computed get hasMultipleYColumns(): boolean {
        return this.yColumnSlugs.length > 1
    }

    @computed private get hasSingleMetricInFacets(): boolean {
        const {
            isOnStackedDiscreteBarTab,
            isOnStackedAreaTab,
            isOnStackedBarTab,
            selectedFacetStrategy,
            hasMultipleYColumns,
        } = this

        if (isOnStackedDiscreteBarTab) {
            return (
                selectedFacetStrategy === FacetStrategy.entity ||
                selectedFacetStrategy === FacetStrategy.metric
            )
        }

        if (isOnStackedAreaTab || isOnStackedBarTab) {
            return (
                selectedFacetStrategy === FacetStrategy.entity &&
                !hasMultipleYColumns
            )
        }

        return false
    }

    @computed private get hasSingleEntityInFacets(): boolean {
        const {
            isOnStackedAreaTab,
            isOnStackedBarTab,
            selectedFacetStrategy,
            selection,
        } = this

        if (isOnStackedAreaTab || isOnStackedBarTab) {
            return (
                selectedFacetStrategy === FacetStrategy.metric &&
                selection.numSelectedEntities === 1
            )
        }

        return false
    }

    // TODO: remove once #2136 is fixed
    // issue #2136 describes a serious bug that relates to relative mode and
    // affects all stacked area/bar charts that are split by metric. for now,
    // we simply turn off relative mode in such cases. once the bug is properly
    // addressed, this computed property and its references can be removed
    @computed
    private get isStackedChartSplitByMetric(): boolean {
        return (
            (this.isOnStackedAreaTab || this.isOnStackedBarTab) &&
            this.selectedFacetStrategy === FacetStrategy.metric
        )
    }

    @computed get isFaceted(): boolean {
        const hasFacetStrategy = this.facetStrategy !== FacetStrategy.none
        return this.isOnChartTab && hasFacetStrategy
    }

    @computed get isInFullScreenMode(): boolean {
        return this._isInFullScreenMode
    }

    // the header and footer don't rely on the base font size unless explicitly specified
    @computed get useBaseFontSize(): boolean {
        return this.props.baseFontSize !== undefined || this.isStatic
    }

    @computed get areStaticBoundsSmall(): boolean {
        const { defaultBounds, staticBounds } = this
        const idealPixelCount = defaultBounds.width * defaultBounds.height
        const staticPixelCount = staticBounds.width * staticBounds.height
        return staticPixelCount < 0.66 * idealPixelCount
    }

    @computed get secondaryColorInStaticCharts(): Color {
        return this.isStaticAndSmall ? GRAPHER_LIGHT_TEXT : GRAPHER_DARK_TEXT
    }

    @computed get isExportingForSocialMedia(): boolean {
        return (
            this.isExportingToSvgOrPng &&
            this.isStaticAndSmall &&
            this.isSocialMediaExport
        )
    }

    @computed get hasRelatedQuestion(): boolean {
        if (
            this.hideRelatedQuestion ||
            !this.relatedQuestions ||
            !this.relatedQuestions.length
        )
            return false
        const question = this.relatedQuestions[0]
        return !!question && !!question.text && !!question.url
    }

    @computed get isRelatedQuestionTargetDifferentFromCurrentPage(): boolean {
        // comparing paths rather than full URLs for this to work as
        // expected on local and staging where the origin (e.g.
        // hans.owid.cloud) doesn't match the production origin that has
        // been entered in the related question URL field:
        // "ourworldindata.org" and yet should still yield a match.
        // - Note that this won't work on production previews (where the
        //   path is /admin/posts/preview/ID)
        const { hasRelatedQuestion, relatedQuestions = [] } = this
        const relatedQuestion = relatedQuestions[0]
        return (
            hasRelatedQuestion &&
            !!relatedQuestion &&
            getWindowUrl().pathname !==
                Url.fromURL(relatedQuestion.url).pathname
        )
    }

    @computed get showRelatedQuestion(): boolean {
        return (
            !!this.relatedQuestions &&
            !!this.hasRelatedQuestion &&
            !!this.isRelatedQuestionTargetDifferentFromCurrentPage
        )
    }

    @computed.struct get allParams(): GrapherQueryParams {
        return grapherObjectToQueryParams(this)
    }

    @computed get areSelectedEntitiesDifferentThanAuthors(): boolean {
        const authoredConfig = this.legacyConfigAsAuthored
        const currentSelectedEntityNames = this.selection.selectedEntityNames
        const originalSelectedEntityNames =
            authoredConfig.selectedEntityNames ?? []

        return isArrayDifferentFromReference(
            currentSelectedEntityNames,
            originalSelectedEntityNames
        )
    }

    @computed get areFocusedSeriesNamesDifferentThanAuthors(): boolean {
        const authoredConfig = this.legacyConfigAsAuthored
        const currentFocusedSeriesNames = this.focusArray.seriesNames
        const originalFocusedSeriesNames =
            authoredConfig.focusedSeriesNames ?? []

        return isArrayDifferentFromReference(
            currentFocusedSeriesNames,
            originalFocusedSeriesNames
        )
    }

    // Autocomputed url params to reflect difference between current grapher state
    // and original config state
    @computed.struct get changedParams(): Partial<GrapherQueryParams> {
        return differenceObj(this.allParams, this.authorsVersion.allParams)
    }

    // If you want to compare current state against the published grapher.
    @computed private get authorsVersion(): Grapher {
        return new Grapher({
            ...this.legacyConfigAsAuthored,
            getGrapherInstance: undefined,
            manager: undefined,
            manuallyProvideData: true,
            queryStr: "",
        })
    }

    @computed get canonicalUrlIfIsChartView(): string | undefined {
        if (!this.chartViewInfo) return undefined

        const { parentChartSlug, queryParamsForParentChart } =
            this.chartViewInfo

        const combinedQueryParams = {
            ...queryParamsForParentChart,
            ...this.changedParams,
        }

        return `${this.bakedGrapherURL}/${parentChartSlug}${queryParamsToStr(
            combinedQueryParams
        )}`
    }

    @computed get isOnCanonicalUrl(): boolean {
        if (!this.canonicalUrl) return false
        return (
            getWindowUrl().pathname === Url.fromURL(this.canonicalUrl).pathname
        )
    }

    @computed private get hasUserChangedTimeHandles(): boolean {
        const authorsVersion = this.authorsVersion
        return (
            this.minTime !== authorsVersion.minTime ||
            this.maxTime !== authorsVersion.maxTime
        )
    }

    @computed private get hasUserChangedMapTimeHandle(): boolean {
        return this.map.time !== this.authorsVersion.map.time
    }

    @computed get timeParam(): string | undefined {
        const { timeColumn } = this.table
        const formatTime = (t: Time): string =>
            timeBoundToTimeBoundString(
                t,
                timeColumn instanceof ColumnTypeMap.Day
            )

        if (this.isOnMapTab) {
            return this.map.time !== undefined &&
                this.hasUserChangedMapTimeHandle
                ? formatTime(this.map.time)
                : undefined
        }

        if (!this.hasUserChangedTimeHandles) return undefined

        const [startTime, endTime] =
            this.timelineHandleTimeBounds.map(formatTime)
        return startTime === endTime ? startTime : `${startTime}..${endTime}`
    }

    @computed get canAddEntities(): boolean {
        return (
            this.hasChartTab &&
            this.canSelectMultipleEntities &&
            (this.isOnLineChartTab ||
                this.isOnSlopeChartTab ||
                this.isOnStackedAreaTab ||
                this.isOnStackedBarTab ||
                this.isOnDiscreteBarTab ||
                this.isOnStackedDiscreteBarTab)
        )
    }

    @computed get showEntitySelectorAs(): GrapherWindowType {
        if (
            this.frameBounds.width > 940 &&
            // don't use the panel if the grapher is embedded
            ((!this.isInIFrame && !this.isEmbeddedInAnOwidPage) ||
                // unless we're in full-screen mode
                this.isInFullScreenMode)
        )
            return GrapherWindowType.panel

        return this.isSemiNarrow
            ? GrapherWindowType.modal
            : GrapherWindowType.drawer
    }

    @computed get isEntitySelectorPanelActive(): boolean {
        return (
            !this.hideEntityControls &&
            this.canChangeAddOrHighlightEntities &&
            this.isOnChartTab &&
            this.showEntitySelectorAs === GrapherWindowType.panel
        )
    }

    @computed get showEntitySelectionToggle(): boolean {
        return (
            !this.hideEntityControls &&
            this.canChangeAddOrHighlightEntities &&
            this.isOnChartTab &&
            (this.showEntitySelectorAs === GrapherWindowType.modal ||
                this.showEntitySelectorAs === GrapherWindowType.drawer)
        )
    }

    @computed get isEntitySelectorModalOpen(): boolean {
        return (
            this.isEntitySelectorModalOrDrawerOpen &&
            this.showEntitySelectorAs === GrapherWindowType.modal
        )
    }

    @computed get isEntitySelectorDrawerOpen(): boolean {
        return (
            this.isEntitySelectorModalOrDrawerOpen &&
            this.showEntitySelectorAs === GrapherWindowType.drawer
        )
    }

    // This is just a helper method to return the correct table for providing entity choices. We want to
    // provide the root table, not the transformed table.
    // A user may have added time or other filters that would filter out all rows from certain entities, but
    // we may still want to show those entities as available in a picker. We also do not want to do things like
    // hide the Add Entity button as the user drags the timeline.
    @computed private get numSelectableEntityNames(): number {
        return this.selection.numAvailableEntityNames
    }

    /**
     * todo: factor this out and make more RAII.
     *
     * Explorers create 1 Grapher instance, but as the user clicks around the Explorer loads other author created Graphers.
     * But currently some Grapher features depend on knowing how the current state is different than the "authored state".
     * So when an Explorer updates the grapher, it also needs to update this "original state".
     */
    @action.bound setAuthoredVersion(
        config: Partial<LegacyGrapherInterface>
    ): void {
        this.legacyConfigAsAuthored = config
    }

    @action.bound updateAuthoredVersion(
        config: Partial<LegacyGrapherInterface>
    ): void {
        this.legacyConfigAsAuthored = {
            ...this.legacyConfigAsAuthored,
            ...config,
        }
    }

    constructor(
        propsWithGrapherInstanceGetter: GrapherProgrammaticInterface = {}
    ) {
        super(propsWithGrapherInstanceGetter)

        const { getGrapherInstance, ...props } = propsWithGrapherInstanceGetter

        this.inputTable = props.table ?? BlankOwidTable(`initialGrapherTable`)

        if (props) this.setAuthoredVersion(props)

        // prefer the manager's selection over the config's selectedEntityNames
        // if both are passed in and the manager's selection is not empty.
        // this is necessary for the global entity selector to work correctly.
        if (props.manager?.selection?.hasSelection) {
            this.updateFromObject(omit(props, "selectedEntityNames"))
        } else {
            this.updateFromObject(props)
        }

        this.populateFromQueryParams(
            legacyToCurrentGrapherQueryParams(props.queryStr ?? "")
        )
        this.externalQueryParams = omit(
            Url.fromQueryStr(props.queryStr ?? "").queryParams,
            GRAPHER_QUERY_PARAM_KEYS
        )

        if (this.isEditor) {
            this.ensureValidConfigWhenEditing()
        }

        if (getGrapherInstance) getGrapherInstance(this) // todo: possibly replace with more idiomatic ref
    }

    toObject(): GrapherInterface {
        const obj: GrapherInterface = objectWithPersistablesToObject(
            this,
            grapherKeysToSerialize
        )

        obj.selectedEntityNames = this.selection.selectedEntityNames
        obj.focusedSeriesNames = this.focusArray.seriesNames

        deleteRuntimeAndUnchangedProps(obj, defaultObject)

        // always include the schema, even if it's the default
        obj.$schema = this.$schema || latestGrapherConfigSchema

        // JSON doesn't support Infinity, so we use strings instead.
        if (obj.minTime) obj.minTime = minTimeToJSON(this.minTime) as any
        if (obj.maxTime) obj.maxTime = maxTimeToJSON(this.maxTime) as any

        if (obj.timelineMinTime)
            obj.timelineMinTime = minTimeToJSON(this.timelineMinTime) as any
        if (obj.timelineMaxTime)
            obj.timelineMaxTime = maxTimeToJSON(this.timelineMaxTime) as any

        // todo: remove dimensions concept
        // if (this.legacyConfigAsAuthored?.dimensions)
        //     obj.dimensions = this.legacyConfigAsAuthored.dimensions

        return obj
    }

    @action.bound updateFromObject(obj?: GrapherProgrammaticInterface): void {
        if (!obj) return

        updatePersistables(this, obj)

        // Regression fix: some legacies have this set to Null. Todo: clean DB.
        if (obj.originUrl === null) this.originUrl = ""

        // update selection
        if (obj.selectedEntityNames)
            this.selection.setSelectedEntities(obj.selectedEntityNames)

        // update focus
        if (obj.focusedSeriesNames)
            this.focusArray.clearAllAndAdd(...obj.focusedSeriesNames)

        // JSON doesn't support Infinity, so we use strings instead.
        this.minTime = minTimeBoundFromJSONOrNegativeInfinity(obj.minTime)
        this.maxTime = maxTimeBoundFromJSONOrPositiveInfinity(obj.maxTime)

        this.timelineMinTime = minTimeBoundFromJSONOrNegativeInfinity(
            obj.timelineMinTime
        )
        this.timelineMaxTime = maxTimeBoundFromJSONOrPositiveInfinity(
            obj.timelineMaxTime
        )

        // Todo: remove once we are more RAII.
        if (obj?.dimensions?.length)
            this.setDimensionsFromConfigs(obj.dimensions)
    }

    @action.bound populateFromQueryParams(params: GrapherQueryParams): void {
        // Set tab if specified
        if (params.tab) {
            const tab = this.mapQueryParamToGrapherTab(params.tab)
            if (tab) this.setTab(tab)
            else console.error("Unexpected tab: " + params.tab)
        }

        // Set overlay if specified
        const overlay = params.overlay
        if (overlay) {
            if (overlay === "sources") {
                this.isSourcesModalOpen = true
            } else if (overlay === "download") {
                this.isDownloadModalOpen = true
            } else {
                console.error("Unexpected overlay: " + overlay)
            }
        }

        // Stack mode for bar and stacked area charts
        this.stackMode = (params.stackMode ?? this.stackMode) as StackMode

        this.zoomToSelection =
            params.zoomToSelection === "true" ? true : this.zoomToSelection

        // Axis scale mode
        const xScaleType = params.xScale
        if (xScaleType) {
            if (xScaleType === ScaleType.linear || xScaleType === ScaleType.log)
                this.xAxis.scaleType = xScaleType
            else console.error("Unexpected xScale: " + xScaleType)
        }

        const yScaleType = params.yScale
        if (yScaleType) {
            if (yScaleType === ScaleType.linear || yScaleType === ScaleType.log)
                this.yAxis.scaleType = yScaleType
            else console.error("Unexpected xScale: " + yScaleType)
        }

        const time = params.time
        if (time !== undefined && time !== "")
            this.setTimeFromTimeQueryParam(time)

        const endpointsOnly = params.endpointsOnly
        if (endpointsOnly !== undefined)
            this.compareEndPointsOnly = endpointsOnly === "1" ? true : undefined

        const region = params.region
        if (region !== undefined)
            this.map.projection = region as MapProjectionName

        // selection
        const selection = getSelectedEntityNamesParam(
            Url.fromQueryParams(params)
        )
        if (this.addCountryMode !== EntitySelectionMode.Disabled && selection)
            this.selection.setSelectedEntities(selection)

        // focus
        const focusedSeriesNames = getFocusedSeriesNamesParam(params.focus)
        if (focusedSeriesNames) {
            this.focusArray.clearAllAndAdd(...focusedSeriesNames)
        }

        // faceting
        if (params.facet && params.facet in FacetStrategy) {
            this.selectedFacetStrategy = params.facet as FacetStrategy
        }
        if (params.uniformYAxis === "0") {
            this.yAxis.facetDomain = FacetAxisDomain.independent
        } else if (params.uniformYAxis === "1") {
            this.yAxis.facetDomain = FacetAxisDomain.shared
        }

        // only relevant for the table
        if (params.showSelectionOnlyInTable) {
            this.showSelectionOnlyInDataTable =
                params.showSelectionOnlyInTable === "1" ? true : undefined
        }

        if (params.showNoDataArea) {
            this.showNoDataArea = params.showNoDataArea === "1"
        }
    }

    @action.bound private setTimeFromTimeQueryParam(time: string): void {
        this.timelineHandleTimeBounds = getTimeDomainFromQueryString(time).map(
            (time) => findClosestTime(this.times, time) ?? time
        ) as TimeBounds
    }

    // Convenience method for debugging
    windowQueryParams(str = location.search): QueryParams {
        return strToQueryParams(str)
    }

    // Exclusively used for the performance.measurement API, so that DevTools can show some context
    private createPerformanceMeasurement(
        name: string,
        startMark: number
    ): void {
        const endMark = performance.now()
        const detail = {
            devtools: {
                track: "Grapher",
                properties: [
                    // might be missing for charts within explorers or mdims
                    ["slug", this.slug ?? "missing-slug"],
                    ["chartTypes", this.validChartTypes],
                    ["tab", this.tab],
                ],
            },
        }

        try {
            performance.measure(name, {
                start: startMark,
                end: endMark,
                detail,
            })
        } catch {
            // In old browsers, the above may throw an error - just ignore it
        }
    }
    @action.bound private _setInputTable(
        json: MultipleOwidVariableDataDimensionsMap,
        legacyConfig: Partial<LegacyGrapherInterface>
    ): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files

        const startMark = performance.now()
        const tableWithColors = legacyToOwidTableAndDimensionsWithMandatorySlug(
            json,
            legacyConfig.dimensions ?? [],
            legacyConfig.selectedEntityColors
        )
        this.createPerformanceMeasurement(
            "legacyToOwidTableAndDimensions",
            startMark
        )

        this.inputTable = tableWithColors

        this.appendNewEntitySelectionOptions()

        if (this.manager?.selection?.hasSelection) {
            // Selection is managed externally, do nothing.
        } else if (this.selection.hasSelection) {
            // User has changed the selection, use theris
        } else this.applyOriginalSelectionAsAuthored()
    }

    @action rebuildInputOwidTable(): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files
        if (!this.legacyVariableDataJson) return
        this._setInputTable(
            this.legacyVariableDataJson,
            this.legacyConfigAsAuthored
        )
    }

    @action.bound appendNewEntitySelectionOptions(): void {
        const { selection } = this
        const currentEntities = selection.availableEntityNameSet
        const missingEntities = this.availableEntities.filter(
            (entity) => !currentEntities.has(entity.entityName)
        )
        selection.addAvailableEntityNames(missingEntities)
    }

    @action.bound private applyOriginalSelectionAsAuthored(): void {
        if (this.selectedEntityNames?.length)
            this.selection.setSelectedEntities(this.selectedEntityNames)
    }

    set startHandleTimeBound(newValue: TimeBound) {
        if (this.isSingleTimeSelectionActive)
            this.timelineHandleTimeBounds = [newValue, newValue]
        else
            this.timelineHandleTimeBounds = [
                newValue,
                this.timelineHandleTimeBounds[1],
            ]
    }

    set endHandleTimeBound(newValue: TimeBound) {
        if (this.isSingleTimeSelectionActive)
            this.timelineHandleTimeBounds = [newValue, newValue]
        else
            this.timelineHandleTimeBounds = [
                this.timelineHandleTimeBounds[0],
                newValue,
            ]
    }

    // Keeps a running cache of series colors at the Grapher level.

    disposers: (() => void)[] = []

    @bind dispose(): void {
        this.disposers.forEach((dispose) => dispose())
    }

    @action.bound setTab(newTab: GrapherTabName): void {
        if (newTab === GRAPHER_TAB_NAMES.Table) {
            this.tab = GRAPHER_TAB_OPTIONS.table
            this.chartTab = undefined
        } else if (newTab === GRAPHER_TAB_NAMES.WorldMap) {
            this.tab = GRAPHER_TAB_OPTIONS.map
            this.chartTab = undefined
        } else {
            this.tab = GRAPHER_TAB_OPTIONS.chart
            this.chartTab = newTab
        }
    }

    @action.bound onTabChange(
        oldTab: GrapherTabName,
        newTab: GrapherTabName
    ): void {
        // if switching from a line to a slope chart and the handles are
        // on the same time, then automatically adjust the handles so that
        // the slope chart view is meaningful
        if (
            oldTab === GRAPHER_TAB_NAMES.LineChart &&
            newTab === GRAPHER_TAB_NAMES.SlopeChart &&
            this.areHandlesOnSameTime
        ) {
            if (this.startHandleTimeBound !== -Infinity) {
                this.startHandleTimeBound = -Infinity
            } else {
                this.endHandleTimeBound = Infinity
            }
        }
    }

    // todo: can we remove this?
    // I believe these states can only occur during editing.
    @action.bound private ensureValidConfigWhenEditing(): void {
        const disposers = [
            autorun(() => {
                if (!this.availableTabs.includes(this.activeTab))
                    runInAction(() => this.setTab(this.availableTabs[0]))
            }),
            autorun(() => {
                const validDimensions = this.validDimensions
                if (!isEqual(this.dimensions, validDimensions))
                    this.dimensions = validDimensions
            }),
        ]
        this.disposers.push(...disposers)
    }
    set timelineHandleTimeBounds(value: TimeBounds) {
        if (this.isOnMapTab) {
            this.map.time = value[1]
        } else {
            this.minTime = value[0]
            this.maxTime = value[1]
        }
    }

    @action.bound addDimension(config: OwidChartDimensionInterface): void {
        this.dimensions.push(new ChartDimension(config, this))
    }

    @action.bound setDimensionsForProperty(
        property: DimensionProperty,
        newConfigs: OwidChartDimensionInterface[]
    ): void {
        let newDimensions: ChartDimension[] = []
        this.dimensionSlots.forEach((slot) => {
            if (slot.property === property)
                newDimensions = newDimensions.concat(
                    newConfigs.map((config) => new ChartDimension(config, this))
                )
            else newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.dimensions = newDimensions
    }

    @action.bound setDimensionsFromConfigs(
        configs: OwidChartDimensionInterface[]
    ): void {
        this.dimensions = configs.map(
            (config) => new ChartDimension(config, this)
        )
    }

    getColumnForProperty(property: DimensionProperty): CoreColumn | undefined {
        return this.dimensions.find((dim) => dim.property === property)?.column
    }

    getSlugForProperty(property: DimensionProperty): string | undefined {
        return this.dimensions.find((dim) => dim.property === property)
            ?.columnSlug
    }

    getColumnSlugsForCondensedSources(): string[] {
        const { xColumnSlug, sizeColumnSlug, colorColumnSlug, isMarimekko } =
            this
        const columnSlugs: string[] = []

        // exclude "Countries Continent" if it's used as the color dimension in a scatter plot, slope chart etc.
        if (
            colorColumnSlug !== undefined &&
            !isContinentsVariableId(colorColumnSlug)
        )
            columnSlugs.push(colorColumnSlug)

        if (xColumnSlug !== undefined) {
            const xColumn = this.inputTable.get(xColumnSlug)
                .def as OwidColumnDef
            // exclude population variable if it's used as the x dimension in a marimekko
            if (
                !isMarimekko ||
                !isPopulationVariableETLPath(xColumn?.catalogPath ?? "")
            )
                columnSlugs.push(xColumnSlug)
        }

        // exclude population variable if it's used as the size dimension in a scatter plot
        if (sizeColumnSlug !== undefined) {
            const sizeColumn = this.inputTable.get(sizeColumnSlug)
                .def as OwidColumnDef
            if (!isPopulationVariableETLPath(sizeColumn?.catalogPath ?? ""))
                columnSlugs.push(sizeColumnSlug)
        }
        return columnSlugs
    }

    // todo: this is only relevant for scatter plots and Marimekko. move to scatter plot class?
    set xOverrideTime(value: number | undefined) {
        this.xDimension!.targetYear = value
    }

    set staticFormat(format: GrapherStaticFormat) {
        this._staticFormat = format
    }

    getStaticBounds(format: GrapherStaticFormat): Bounds {
        switch (format) {
            case GrapherStaticFormat.landscape:
                return this.defaultBounds
            case GrapherStaticFormat.square:
                return new Bounds(
                    0,
                    0,
                    GRAPHER_SQUARE_SIZE,
                    GRAPHER_SQUARE_SIZE
                )
            default:
                return this.defaultBounds
        }
    }

    generateStaticSvg(): string {
        const _isExportingToSvgOrPng = this.isExportingToSvgOrPng
        this.isExportingToSvgOrPng = true
        const staticSvg = ReactDOMServer.renderToStaticMarkup(
            <StaticCaptionedChart manager={this} />
        )
        this.isExportingToSvgOrPng = _isExportingToSvgOrPng
        return staticSvg
    }

    get staticSVG(): string {
        return this.generateStaticSvg()
    }

    static renderGrapherIntoContainer(
        config: GrapherProgrammaticInterface,
        containerNode: Element
    ): React.RefObject<Grapher> {
        const grapherInstanceRef = React.createRef<Grapher>()

        const setBoundsFromContainerAndRender = (
            entries: ResizeObserverEntry[]
        ): void => {
            const entry = entries?.[0] // We always observe exactly one element
            if (!entry)
                throw new Error(
                    "Couldn't resize grapher, expected exactly one ResizeObserverEntry"
                )

            // Don't bother rendering if the container is hidden
            // see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
            if ((entry.target as HTMLElement).offsetParent === null) return

            const props: GrapherProgrammaticInterface = {
                ...config,
                bounds: Bounds.fromRect(entry.contentRect),
            }
            ReactDOM.render(
                <Sentry.ErrorBoundary>
                    <Grapher ref={grapherInstanceRef} {...props} />
                </Sentry.ErrorBoundary>,
                containerNode
            )
        }

        if (typeof window !== "undefined" && "ResizeObserver" in window) {
            const resizeObserver = new ResizeObserver(
                // Use a leading debounce to render immediately upon first load, and also immediately upon orientation change on mobile
                debounce(setBoundsFromContainerAndRender, 400, {
                    leading: true,
                })
            )
            resizeObserver.observe(containerNode)
        } else if (
            typeof window === "object" &&
            typeof document === "object" &&
            !navigator.userAgent.includes("jsdom")
        ) {
            // only show the warning when we're in something that roughly resembles a browser
            console.warn(
                "ResizeObserver not available; grapher will not be able to render"
            )
        }

        return grapherInstanceRef
    }

    static renderSingleGrapherOnGrapherPage(
        jsonConfig: GrapherInterface
    ): void {
        const container = document.getElementsByTagName("figure")[0]
        try {
            Grapher.renderGrapherIntoContainer(
                {
                    ...jsonConfig,
                    bindUrlToWindow: true,
                    enableKeyboardShortcuts: true,
                    queryStr: window.location.search,
                },
                container
            )
        } catch (err) {
            container.innerHTML = `<p>Unable to load interactive visualization</p>`
            container.setAttribute("id", "fallback")
            throw err
        }
    }

    @action.bound setError(err: Error): void {
        this.uncaughtError = err
    }

    @action.bound clearErrors(): void {
        this.uncaughtError = undefined
    }

    private get commandPalette(): React.ReactElement | null {
        return this.props.enableKeyboardShortcuts ? (
            <CommandPalette commands={this.keyboardShortcuts} display="none" />
        ) : null
    }

    @action.bound private toggleTabCommand(): void {
        this.setTab(next(this.availableTabs, this.activeTab))
    }

    @action.bound private togglePlayingCommand(): void {
        void this.timelineController.togglePlay()
    }

    private get keyboardShortcuts(): Command[] {
        const temporaryFacetTestCommands = range(0, 10).map((num) => {
            return {
                combo: `${num}`,
                fn: (): void => this.randomSelection(num),
            }
        })
        const shortcuts = [
            ...temporaryFacetTestCommands,
            {
                combo: "t",
                fn: (): void => this.toggleTabCommand(),
                title: "Toggle tab",
                category: "Navigation",
            },
            {
                combo: "?",
                fn: (): void => CommandPalette.togglePalette(),
                title: `Toggle Help`,
                category: "Navigation",
            },
            {
                combo: "a",
                fn: (): void => {
                    if (this.selection.hasSelection) {
                        this.selection.clearSelection()
                        this.focusArray.clear()
                    } else {
                        this.selection.selectAll()
                    }
                },
                title: this.selection.hasSelection
                    ? `Select None`
                    : `Select All`,
                category: "Selection",
            },
            {
                combo: "f",
                fn: (): void => {
                    this.hideFacetControl = !this.hideFacetControl
                },
                title: `Toggle Faceting`,
                category: "Chart",
            },
            {
                combo: "p",
                fn: (): void => this.togglePlayingCommand(),
                title: this.isPlaying ? `Pause` : `Play`,
                category: "Timeline",
            },
            {
                combo: "l",
                fn: (): void => this.toggleYScaleTypeCommand(),
                title: "Toggle Y log/linear",
                category: "Chart",
            },
            {
                combo: "w",
                fn: (): void => this.toggleFullScreenMode(),
                title: `Toggle full-screen mode`,
                category: "Chart",
            },
            {
                combo: "s",
                fn: (): void => {
                    this.isSourcesModalOpen = !this.isSourcesModalOpen
                },
                title: `Toggle sources modal`,
                category: "Chart",
            },
            {
                combo: "d",
                fn: (): void => {
                    this.isDownloadModalOpen = !this.isDownloadModalOpen
                },
                title: "Toggle download modal",
                category: "Chart",
            },
            {
                combo: "esc",
                fn: (): void => this.clearErrors(),
            },
            {
                combo: "z",
                fn: (): void => this.toggleTimelineCommand(),
                title: "Latest/Earliest/All period",
                category: "Timeline",
            },
            {
                combo: "shift+o",
                fn: (): void => this.clearQueryParams(),
                title: "Reset to original",
                category: "Navigation",
            },
        ]

        if (this.slideShow) {
            const slideShow = this.slideShow
            shortcuts.push({
                combo: "right",
                fn: () => slideShow.playNext(),
                title: "Next chart",
                category: "Browse",
            })
            shortcuts.push({
                combo: "left",
                fn: () => slideShow.playPrevious(),
                title: "Previous chart",
                category: "Browse",
            })
        }

        return shortcuts
    }

    @action.bound private toggleTimelineCommand(): void {
        // Todo: add tests for this
        this.setTimeFromTimeQueryParam(
            next(["latest", "earliest", ".."], this.timeParam!)
        )
    }

    @action.bound private toggleYScaleTypeCommand(): void {
        this.yAxis.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            this.yAxis.scaleType
        )
    }

    set facetStrategy(facet: FacetStrategy) {
        this.selectedFacetStrategy = facet
    }

    @action.bound randomSelection(num: number): void {
        // Continent, Population, GDP PC, GDP, PopDens, UN, Language, etc.
        this.clearErrors()
        const currentSelection = this.selection.selectedEntityNames.length
        const newNum = num ? num : currentSelection ? currentSelection * 2 : 10
        this.selection.setSelectedEntities(
            sampleFrom(this.selection.availableEntityNames, newNum, Date.now())
        )
    }

    set isInFullScreenMode(newValue: boolean) {
        // prevent scrolling when in full-screen mode
        if (newValue) {
            document.documentElement.classList.add("no-scroll")
        } else {
            document.documentElement.classList.remove("no-scroll")
        }

        // dismiss the share menu
        this.isShareMenuActive = false

        this._isInFullScreenMode = newValue
    }

    @action.bound toggleFullScreenMode(): void {
        this.isInFullScreenMode = !this.isInFullScreenMode
    }

    @action.bound dismissFullScreen(): void {
        // if a modal is open, dismiss it instead of exiting full-screen mode
        if (this.isModalOpen || this.isShareMenuActive) {
            this.isEntitySelectorModalOrDrawerOpen = false
            this.isSourcesModalOpen = false
            this.isEmbedModalOpen = false
            this.isDownloadModalOpen = false
            this.isShareMenuActive = false
        } else {
            this.isInFullScreenMode = false
        }
    }

    private renderError(): React.ReactElement {
        return (
            <div
                title={this.uncaughtError?.message}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    textAlign: "center",
                    lineHeight: 1.5,
                    padding: "48px",
                }}
            >
                <p style={{ color: "#cc0000", fontWeight: 700 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    {ThereWasAProblemLoadingThisChart}
                </p>
                <p>
                    We have been notified of this error, please check back later
                    whether it's been fixed. If the error persists, get in touch
                    with us at{" "}
                    <a
                        href={`mailto:info@ourworldindata.org?subject=Broken chart on page ${window.location.href}`}
                    >
                        info@ourworldindata.org
                    </a>
                    .
                </p>
                {this.uncaughtError && this.uncaughtError.message && (
                    <pre style={{ fontSize: "11px" }}>
                        Error: {this.uncaughtError.message}
                    </pre>
                )}
            </div>
        )
    }

    private renderGrapherComponent(): React.ReactElement {
        const containerClasses = classnames({
            GrapherComponent: true,
            GrapherPortraitClass: this.isPortrait,
            isStatic: this.isStatic,
            isExportingToSvgOrPng: this.isExportingToSvgOrPng,
            GrapherComponentNarrow: this.isNarrow,
            GrapherComponentSemiNarrow: this.isSemiNarrow,
            GrapherComponentSmall: this.isSmall,
            GrapherComponentMedium: this.isMedium,
        })

        const activeBounds = this.renderToStatic
            ? this.staticBounds
            : this.frameBounds

        const containerStyle = {
            width: activeBounds.width,
            height: activeBounds.height,
            fontSize: this.isExportingToSvgOrPng
                ? 18
                : Math.min(16, this.fontSize), // cap font size at 16px
        }

        return (
            <div
                ref={this.base}
                className={containerClasses}
                style={containerStyle}
                data-grapher-url={JSON.stringify({
                    grapherUrl: this.canonicalUrl,
                    chartViewName: this.chartViewInfo?.name,
                })}
            >
                {this.commandPalette}
                {this.uncaughtError ? this.renderError() : this.renderReady()}
            </div>
        )
    }

    render(): React.ReactElement | undefined {
        // TODO how to handle errors in exports?
        // TODO remove this? should have a simple toStaticSVG for exporting
        if (this.isExportingToSvgOrPng) return <CaptionedChart manager={this} />

        if (this.isInFullScreenMode) {
            return (
                <FullScreen
                    onDismiss={this.dismissFullScreen}
                    overlayColor={this.isModalOpen ? "#999999" : "#fff"}
                >
                    {this.renderGrapherComponent()}
                </FullScreen>
            )
        }

        return this.renderGrapherComponent()
    }

    private renderReady(): React.ReactElement | null {
        if (!this.hasBeenVisible) return null

        if (this.renderToStatic) {
            return <StaticCaptionedChart manager={this} />
        }

        return (
            <>
                {/* captioned chart and entity selector */}
                <div className="CaptionedChartAndSidePanel">
                    <CaptionedChart manager={this} />
                    {this.sidePanelBounds && (
                        <SidePanel bounds={this.sidePanelBounds}>
                            <EntitySelector manager={this} />
                        </SidePanel>
                    )}
                </div>

                {/* modals */}
                {this.isSourcesModalOpen && <SourcesModal manager={this} />}
                {this.isDownloadModalOpen && <DownloadModal manager={this} />}
                {this.isEmbedModalOpen && <EmbedModal manager={this} />}
                {this.isEntitySelectorModalOpen && (
                    <EntitySelectorModal manager={this} />
                )}

                {/* entity selector in a slide-in drawer */}
                <SlideInDrawer
                    grapherRef={this.base}
                    active={this.isEntitySelectorDrawerOpen}
                    toggle={() => {
                        this.isEntitySelectorModalOrDrawerOpen =
                            !this.isEntitySelectorModalOrDrawerOpen
                    }}
                >
                    <EntitySelector manager={this} autoFocus={true} />
                </SlideInDrawer>

                {/* tooltip: either pin to the bottom or render into the chart area */}
                {this.shouldPinTooltipToBottom ? (
                    <BodyDiv>
                        <TooltipContainer
                            tooltipProvider={this}
                            anchor={GrapherTooltipAnchor.bottom}
                        />
                    </BodyDiv>
                ) : (
                    <TooltipContainer
                        tooltipProvider={this}
                        containerWidth={this.captionedChartBounds.width}
                        containerHeight={this.captionedChartBounds.height}
                    />
                )}
            </>
        )
    }

    // Chart should only render SVG when it's on the screen
    @action.bound private setUpIntersectionObserver(): void {
        if (typeof window !== "undefined" && "IntersectionObserver" in window) {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            this.hasBeenVisible = true

                            if (!this.hasLoggedGAViewEvent) {
                                this.hasLoggedGAViewEvent = true

                                if (this.chartViewInfo) {
                                    this.analytics.logGrapherView(
                                        this.chartViewInfo.parentChartSlug,
                                        {
                                            chartViewName:
                                                this.chartViewInfo.name,
                                        }
                                    )
                                    this.hasLoggedGAViewEvent = true
                                } else if (this.slug) {
                                    this.analytics.logGrapherView(this.slug)
                                    this.hasLoggedGAViewEvent = true
                                }
                            }
                        }

                        // dismiss tooltip when less than 2/3 of the chart is visible
                        const tooltip = this.tooltip?.get()
                        const isNotVisible = !entry.isIntersecting
                        const isPartiallyVisible =
                            entry.isIntersecting &&
                            entry.intersectionRatio < 0.66
                        if (tooltip && (isNotVisible || isPartiallyVisible)) {
                            tooltip.dismiss?.()
                        }
                    })
                },
                { threshold: [0, 0.66] }
            )
            observer.observe(this.containerElement!)
            this.disposers.push(() => observer.disconnect())
        } else {
            // IntersectionObserver not available; we may be in a Node environment, just render
            this.hasBeenVisible = true
        }
    }

    set baseFontSize(val: number) {
        this._baseFontSize = val
    }

    private computeBaseFontSizeFromHeight(bounds: Bounds): number {
        const squareBounds = this.getStaticBounds(GrapherStaticFormat.square)
        const factor = squareBounds.height / 21
        return Math.max(10, bounds.height / factor)
    }

    private computeBaseFontSizeFromWidth(bounds: Bounds): number {
        if (bounds.width <= 400) return 14
        else if (bounds.width < 1080) return 16
        else if (bounds.width >= 1080) return 18
        else return 16
    }

    @action.bound private setBaseFontSize(): void {
        this.baseFontSize = this.computeBaseFontSizeFromWidth(
            this.captionedChartBounds
        )
    }

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    private bindToWindow(): void {
        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = (): void =>
            setWindowQueryStr(queryParamsToStr(this.changedParams))
        const debouncedPushParams = debounce(pushParams, 100)

        reaction(
            () => this.changedParams,
            () => (this.debounceMode ? debouncedPushParams() : pushParams())
        )

        autorun(() => (document.title = this.currentTitle))
    }

    @action.bound private setUpWindowResizeEventHandler(): void {
        const updateWindowDimensions = (): void => {
            this.windowInnerWidth = window.innerWidth
            this.windowInnerHeight = window.innerHeight
        }
        const onResize = debounce(updateWindowDimensions, 400, {
            leading: true,
        })

        if (typeof window !== "undefined") {
            updateWindowDimensions()
            window.addEventListener("resize", onResize)
            this.disposers.push(() => {
                window.removeEventListener("resize", onResize)
            })
        }
    }

    componentDidMount(): void {
        this.setBaseFontSize()
        this.setUpIntersectionObserver()
        this.setUpWindowResizeEventHandler()
        exposeInstanceOnWindow(this, "grapher")
        // Emit a custom event when the grapher is ready
        // We can use this in global scripts that depend on the grapher e.g. the site-screenshots tool
        this.disposers.push(
            reaction(
                () => this.isReady,
                () => {
                    if (this.isReady) {
                        document.dispatchEvent(
                            new CustomEvent(GRAPHER_LOADED_EVENT_NAME, {
                                detail: { grapher: this },
                            })
                        )
                    }
                }
            ),
            reaction(
                () => this.facetStrategy,
                () => this.focusArray.clear()
            )
        )
        if (this.props.bindUrlToWindow) this.bindToWindow()
        if (this.props.enableKeyboardShortcuts) this.bindKeyboardShortcuts()
    }

    private _shortcutsBound = false
    private bindKeyboardShortcuts(): void {
        if (this._shortcutsBound) return
        this.keyboardShortcuts.forEach((shortcut) => {
            Mousetrap.bind(shortcut.combo, () => {
                shortcut.fn()
                this.analytics.logKeyboardShortcut(
                    shortcut.title || "",
                    shortcut.combo
                )
                return false
            })
        })
        this._shortcutsBound = true
    }

    private unbindKeyboardShortcuts(): void {
        if (!this._shortcutsBound) return
        this.keyboardShortcuts.forEach((shortcut) => {
            Mousetrap.unbind(shortcut.combo)
        })
        this._shortcutsBound = false
    }

    componentWillUnmount(): void {
        this.unbindKeyboardShortcuts()
        this.dispose()
    }

    componentDidUpdate(): void {
        this.setBaseFontSize()
    }

    componentDidCatch(error: Error): void {
        this.setError(error)
        this.analytics.logGrapherViewError(error)
    }

    @action.bound clearSelection(): void {
        this.selection.clearSelection()
        this.applyOriginalSelectionAsAuthored()
    }

    @action.bound clearFocus(): void {
        this.focusArray.clear()
        this.applyOriginalFocusAsAuthored()
    }

    @action.bound clearQueryParams(): void {
        const { authorsVersion } = this
        this.tab = authorsVersion.tab
        this.xAxis.scaleType = authorsVersion.xAxis.scaleType
        this.yAxis.scaleType = authorsVersion.yAxis.scaleType
        this.stackMode = authorsVersion.stackMode
        this.zoomToSelection = authorsVersion.zoomToSelection
        this.compareEndPointsOnly = authorsVersion.compareEndPointsOnly
        this.minTime = authorsVersion.minTime
        this.maxTime = authorsVersion.maxTime
        this.map.time = authorsVersion.map.time
        this.map.projection = authorsVersion.map.projection
        this.showSelectionOnlyInDataTable =
            authorsVersion.showSelectionOnlyInDataTable
        this.showNoDataArea = authorsVersion.showNoDataArea
        this.clearSelection()
        this.clearFocus()
    }

    // Todo: come up with a more general pattern?
    // The idea here is to reset the Grapher to a blank slate, so that if you updateFromObject and the object contains some blanks, those blanks
    // won't overwrite defaults (like type == LineChart). RAII would probably be better, but this works for now.
    @action.bound reset(): void {
        const grapher = new Grapher()
        for (const key of grapherKeysToSerialize) {
            // @ts-expect-error grapherKeysToSerialize is not properly typed
            this[key] = grapher[key]
        }

        this.ySlugs = grapher.ySlugs
        this.xSlug = grapher.xSlug
        this.colorSlug = grapher.colorSlug
        this.sizeSlug = grapher.sizeSlug

        this.selection.clearSelection()
        this.focusArray.clear()
    }

    debounceMode = false

    private mapQueryParamToGrapherTab(tab: string): GrapherTabName | undefined {
        const {
            chartType: defaultChartType,
            validChartTypeSet,
            hasMapTab,
        } = this

        if (tab === GRAPHER_TAB_QUERY_PARAMS.table) {
            return GRAPHER_TAB_NAMES.Table
        }
        if (tab === GRAPHER_TAB_QUERY_PARAMS.map) {
            return GRAPHER_TAB_NAMES.WorldMap
        }

        if (tab === GRAPHER_TAB_QUERY_PARAMS.chart) {
            if (defaultChartType) {
                return defaultChartType
            } else if (hasMapTab) {
                return GRAPHER_TAB_NAMES.WorldMap
            } else {
                return GRAPHER_TAB_NAMES.Table
            }
        }

        const chartTypeName = mapQueryParamToChartTypeName(tab)

        if (!chartTypeName) return undefined

        if (validChartTypeSet.has(chartTypeName)) {
            return chartTypeName
        } else if (defaultChartType) {
            return defaultChartType
        } else if (hasMapTab) {
            return GRAPHER_TAB_NAMES.WorldMap
        } else {
            return GRAPHER_TAB_NAMES.Table
        }
    }

    mapGrapherTabToQueryParam(tab: GrapherTabName): string {
        if (tab === GRAPHER_TAB_NAMES.Table)
            return GRAPHER_TAB_QUERY_PARAMS.table
        if (tab === GRAPHER_TAB_NAMES.WorldMap)
            return GRAPHER_TAB_QUERY_PARAMS.map

        if (!this.hasMultipleChartTypes) return GRAPHER_TAB_QUERY_PARAMS.chart

        return mapChartTypeNameToQueryParam(tab)
    }

    // todo: restore this behavior??
    onStartPlayOrDrag(): void {
        this.debounceMode = true
    }

    onStopPlayOrDrag(): void {
        this.debounceMode = false
    }

    formatTime(value: Time): string {
        const timeColumn = this.table.timeColumn
        return isMobile()
            ? timeColumn.formatValueForMobile(value)
            : timeColumn.formatValue(value)
    }
}

const defaultObject = objectWithPersistablesToObject(
    new Grapher(),
    grapherKeysToSerialize
)

export const getErrorMessageRelatedQuestionUrl = (
    question: RelatedQuestionsConfig
): string | undefined => {
    return question.text
        ? (!question.url && "Missing URL") ||
              (!question.url.match(/^https?:\/\//) &&
                  "URL should start with http(s)://") ||
              undefined
        : undefined
}
