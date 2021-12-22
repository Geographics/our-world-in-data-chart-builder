import * as React from "react"
import {
    sortBy,
    sum,
    guid,
    getRelativeMouse,
    pointsToPath,
    minBy,
    flatten,
    last,
    exposeInstanceOnWindow,
    round,
    excludeUndefined,
} from "../../clientUtils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { DualAxisComponent } from "../axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { PointVector } from "../../clientUtils/PointVector"
import {
    LineLegend,
    LineLabelSeries,
    LineLegendManager,
} from "../lineLegend/LineLegend"
import { ComparisonLine } from "../scatterCharts/ComparisonLine"
import { Tooltip } from "../tooltip/Tooltip"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { extent } from "d3-array"
import {
    BASE_FONT_SIZE,
    SeriesName,
    ScaleType,
    SeriesStrategy,
} from "../core/GrapherConstants"
import { ColorSchemes } from "../color/ColorSchemes"
import { AxisConfig, FontSizeManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import {
    LinesProps,
    LineChartSeries,
    LineChartManager,
    LinePoint,
    PlacedLineChartSeries,
    PlacedPoint,
} from "./LineChartConstants"
import { OwidTable } from "../../coreTable/OwidTable"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    getSeriesKey,
    makeClipPath,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { ColorScheme } from "../color/ColorScheme"
import { SelectionArray } from "../selection/SelectionArray"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import {
    CoreValueType,
    PrimitiveType,
} from "../../coreTable/CoreTableConstants"
import { CategoricalBin } from "../color/ColorScaleBin"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import {
    ColorScaleConfig,
    ColorScaleConfigInterface,
} from "../color/ColorScaleConfig"
import { isNotErrorValue } from "../../coreTable/ErrorValues"
import { ColorSchemeName } from "../color/ColorConstants"
import { MultiColorPolyline } from "../scatterCharts/MultiColorPolyline"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner"
import { EntityName } from "../../coreTable/OwidTableConstants"
import { Color } from "../../clientUtils/owidTypes"

const BLUR_COLOR = "#eee"
const DEFAULT_LINE_COLOR = "#000"

@observer
class Lines extends React.Component<LinesProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get allValues(): LinePoint[] {
        return flatten(this.props.placedSeries.map((series) => series.points))
    }

    @action.bound private onCursorMove(ev: MouseEvent | TouchEvent): void {
        const { dualAxis } = this.props
        const { horizontalAxis } = dualAxis

        if (!this.base.current) return

        const mouse = getRelativeMouse(this.base.current, ev)

        let hoverX
        if (dualAxis.innerBounds.contains(mouse)) {
            const closestValue = minBy(this.allValues, (point) =>
                Math.abs(horizontalAxis.place(point.x) - mouse.x)
            )
            hoverX = closestValue?.x
        }

        this.props.onHover(hoverX)
    }

    @action.bound private onCursorLeave(): void {
        this.props.onHover(undefined)
    }

    @computed get bounds(): Bounds {
        const { horizontalAxis, verticalAxis } = this.props.dualAxis
        return Bounds.fromCorners(
            new PointVector(horizontalAxis.range[0], verticalAxis.range[0]),
            new PointVector(horizontalAxis.range[1], verticalAxis.range[1])
        )
    }

    @computed private get focusedLines(): PlacedLineChartSeries[] {
        const { focusedSeriesNames } = this.props
        // If nothing is focused, everything is
        if (!focusedSeriesNames.length) return this.props.placedSeries
        return this.props.placedSeries.filter((series) =>
            focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get backgroundLines(): PlacedLineChartSeries[] {
        const { focusedSeriesNames } = this.props
        return this.props.placedSeries.filter(
            (series) => !focusedSeriesNames.includes(series.seriesName)
        )
    }

    // Don't display point markers if there are very many of them for performance reasons
    // Note that we're using circle elements instead of marker-mid because marker performance in Safari 10 is very poor for some reason
    @computed private get hasMarkers(): boolean {
        if (this.props.hidePoints) return false
        return (
            sum(this.focusedLines.map((series) => series.placedPoints.length)) <
            500
        )
    }

    @computed private get strokeWidth(): number {
        return this.props.lineStrokeWidth ?? 1.5
    }

    private renderFocusGroups(): JSX.Element[] {
        return this.focusedLines.map((series, index) => {
            // If the series only contains one point, then we will always want to show a marker/circle
            // because we can't draw a line.
            const showMarkers =
                (this.hasMarkers || series.placedPoints.length === 1) &&
                !series.isProjection

            return (
                <g key={index}>
                    <path
                        stroke={series.color}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d={pointsToPath(
                            series.placedPoints.map((value) => [
                                value.x,
                                value.y,
                            ]) as [number, number][]
                        )}
                        fill="none"
                        strokeWidth={this.strokeWidth}
                        strokeDasharray={
                            series.isProjection ? "1,4" : undefined
                        }
                    />
                    {showMarkers && (
                        <g fill={series.color}>
                            {series.placedPoints.map((value, index) => (
                                <circle
                                    key={index}
                                    cx={value.x}
                                    cy={value.y}
                                    r={2}
                                />
                            ))}
                        </g>
                    )}
                </g>
            )
        })
    }

    private renderBackgroundGroups(): JSX.Element[] {
        return this.backgroundLines.map((series, index) => (
            <g key={index}>
                <path
                    key={getSeriesKey(series, "line")}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    stroke="#ddd"
                    d={pointsToPath(
                        series.placedPoints.map((value) => [
                            value.x,
                            value.y,
                        ]) as [number, number][]
                    )}
                    fill="none"
                    strokeWidth={1}
                />
            </g>
        ))
    }

    private container?: SVGElement
    componentDidMount(): void {
        const base = this.base.current as SVGGElement
        const container = base.closest("svg") as SVGElement
        container.addEventListener("mousemove", this.onCursorMove)
        container.addEventListener("mouseleave", this.onCursorLeave)
        container.addEventListener("touchstart", this.onCursorMove)
        container.addEventListener("touchmove", this.onCursorMove)
        container.addEventListener("touchend", this.onCursorLeave)
        container.addEventListener("touchcancel", this.onCursorLeave)
        this.container = container
    }

    componentWillUnmount(): void {
        const { container } = this
        if (!container) return

        container.removeEventListener("mousemove", this.onCursorMove)
        container.removeEventListener("mouseleave", this.onCursorLeave)
        container.removeEventListener("touchstart", this.onCursorMove)
        container.removeEventListener("touchmove", this.onCursorMove)
        container.removeEventListener("touchend", this.onCursorLeave)
        container.removeEventListener("touchcancel", this.onCursorLeave)
    }

    render(): JSX.Element {
        const { bounds } = this

        return (
            <g ref={this.base} className="Lines">
                <rect
                    x={Math.round(bounds.x)}
                    y={Math.round(bounds.y)}
                    width={Math.round(bounds.width)}
                    height={Math.round(bounds.height)}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                {this.renderBackgroundGroups()}
                {this.renderFocusGroups()}
            </g>
        )
    }
}

@observer
export class LineChart
    extends React.Component<{
        bounds?: Bounds
        manager: LineChartManager
    }>
    implements
        ChartInterface,
        LineLegendManager,
        FontSizeManager,
        ColorScaleManager
{
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable): OwidTable {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        if (this.colorColumnSlug) {
            const tolerance = table.get(this.colorColumnSlug)?.display
                ?.tolerance
            table = table.interpolateColumnWithTolerance(
                this.colorColumnSlug,
                tolerance
            )
        }

        return table
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed private get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher
        // The % growth transform cannot be applied in transformTable() because it will filter out
        // any rows before startHandleTimeBound and change the timeline bounds.
        const { isRelativeMode, startHandleTimeBound } = this.manager
        if (isRelativeMode && startHandleTimeBound !== undefined) {
            table = table.toTotalGrowthForEachColumnComparedToStartTime(
                startHandleTimeBound,
                this.manager.yColumnSlugs ?? []
            )
        }
        return table
    }

    // todo: rename mouseHoverX -> hoverX and hoverX -> activeX
    @observable mouseHoverX?: number = undefined
    @action.bound onHover(hoverX: number | undefined): void {
        this.mouseHoverX = hoverX
    }

    @computed get hoverX(): number | undefined {
        return this.mouseHoverX ?? this.props.manager.annotation?.year
    }

    @computed private get manager(): LineChartManager {
        return this.props.manager
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get maxLegendWidth(): number {
        return this.bounds.width / 3
    }

    @computed get lineStrokeWidth(): number {
        return this.manager.lineStrokeWidth ?? this.hasColorScale ? 2 : 1.5
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    seriesIsBlurred(series: LineChartSeries): boolean {
        return (
            this.isFocusMode &&
            !this.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get tooltip(): JSX.Element | undefined {
        const { hoverX, dualAxis, inputTable, formatColumn } = this

        if (hoverX === undefined) return undefined

        const sortedData = sortBy(this.series, (series) => {
            const value = series.points.find((point) => point.x === hoverX)
            return value !== undefined ? -value.y : Infinity
        })

        const formatted = inputTable.timeColumnFormatFunction(hoverX)

        return (
            <Tooltip
                tooltipManager={this.manager}
                x={dualAxis.horizontalAxis.place(hoverX)}
                y={
                    dualAxis.verticalAxis.rangeMin +
                    dualAxis.verticalAxis.rangeSize / 2
                }
                style={{ padding: "0.3em" }}
                offsetX={5}
            >
                <table
                    style={{
                        fontSize: "0.9em",
                        lineHeight: "1.4em",
                        whiteSpace: "normal",
                    }}
                >
                    <tbody>
                        <tr>
                            <td colSpan={3}>
                                <strong>{formatted}</strong>
                            </td>
                        </tr>
                        {sortedData.map((series) => {
                            const value = series.points.find(
                                (point) => point.x === hoverX
                            )

                            const annotation = this.getAnnotationsForSeries(
                                series.seriesName
                            )

                            // It sometimes happens that data is missing for some years for a particular
                            // entity. If the user hovers over these years, we want to show a "No data"
                            // notice. However, we only want to show this notice when we are in the middle
                            // of a time series – when data points exist before and after the current year.
                            // Otherwise we want to entirely exclude the entity from the tooltip.
                            if (!value) {
                                const [startX, endX] = extent(
                                    series.points,
                                    (point) => point.x
                                )
                                if (
                                    startX === undefined ||
                                    endX === undefined ||
                                    startX > hoverX ||
                                    endX < hoverX
                                )
                                    return undefined
                            }

                            const isBlur =
                                this.seriesIsBlurred(series) ||
                                value === undefined
                            const textColor = isBlur ? "#ddd" : "#333"
                            const annotationColor = isBlur ? "#ddd" : "#999"
                            const circleColor = isBlur
                                ? BLUR_COLOR
                                : this.hasColorScale
                                ? this.getColorScaleColor(value.colorValue)
                                : series.color
                            return (
                                <tr
                                    key={getSeriesKey(series)}
                                    style={{ color: textColor }}
                                >
                                    <td>
                                        <div
                                            style={{
                                                width: "10px",
                                                height: "10px",
                                                borderRadius: "5px",
                                                backgroundColor: circleColor,
                                                display: "inline-block",
                                                marginRight: "2px",
                                            }}
                                        />
                                    </td>
                                    <td
                                        style={{
                                            paddingRight: "0.8em",
                                            fontSize: "0.9em",
                                        }}
                                    >
                                        {series.seriesName}
                                        {annotation && (
                                            <span
                                                className="tooltipAnnotation"
                                                style={{
                                                    color: annotationColor,
                                                    fontSize: "90%",
                                                }}
                                            >
                                                {" "}
                                                {annotation}
                                            </span>
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            textAlign: "right",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {!value
                                            ? "No data"
                                            : formatColumn.formatValueShort(
                                                  value.y,
                                                  { noTrailingZeroes: false }
                                              )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </Tooltip>
        )
    }

    defaultRightPadding = 1

    @observable hoveredSeriesName?: SeriesName
    @action.bound onLegendClick(): void {
        if (this.manager.startSelectingWhenLineClicked)
            this.manager.isSelectingData = true
    }

    @action.bound onLegendMouseOver(seriesName: SeriesName): void {
        this.hoveredSeriesName = seriesName
    }

    @action.bound onLegendMouseLeave(): void {
        this.hoveredSeriesName = undefined
    }

    @computed get focusedSeriesNames(): string[] {
        return excludeUndefined([
            this.manager.externalLegendFocusBin?.value,
            this.props.manager.annotation?.entityName,
            this.hoveredSeriesName,
        ])
    }

    @computed get isFocusMode(): boolean {
        return this.focusedSeriesNames.length > 0
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    componentDidMount(): void {
        if (!this.manager.isExportingtoSvgOrPng) this.runFancyIntroAnimation()
        exposeInstanceOnWindow(this)
    }

    componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get renderUid(): number {
        return guid()
    }

    @computed get fontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get legendX(): number {
        return this.bounds.right - (this.legendDimensions?.width || 0)
    }

    @computed get clipPathBounds(): Bounds {
        const { dualAxis, bounds } = this
        return bounds.set({ x: dualAxis.innerBounds.x }).expand(10)
    }

    @computed get clipPath(): { id: string; element: JSX.Element } {
        return makeClipPath(this.renderUid, this.clipPathBounds)
    }

    private runFancyIntroAnimation(): void {
        this.animSelection = select(this.base.current)
            .selectAll("clipPath > rect")
            .attr("width", 0)
        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.clipPathBounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    @computed private get legendDimensions(): LineLegend | undefined {
        return this.manager.hideLegend
            ? undefined
            : new LineLegend({ manager: this })
    }

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { manager, tooltip, dualAxis, hoverX, clipPath } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        const comparisonLines = manager.comparisonLines || []

        const showLegend = !manager.hideLegend

        // The tiny bit of extra space in the clippath is to ensure circles centered on the very edge are still fully visible
        return (
            <g ref={this.base} className="LineChart">
                {clipPath.element}
                <DualAxisComponent dualAxis={dualAxis} showTickMarks={true} />
                <g clipPath={clipPath.id}>
                    {comparisonLines.map((line, index) => (
                        <ComparisonLine
                            key={index}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                    {showLegend && <LineLegend manager={this} />}
                    <Lines
                        dualAxis={dualAxis}
                        placedSeries={this.placedSeries}
                        hidePoints={manager.hidePoints}
                        onHover={this.onHover}
                        focusedSeriesNames={this.focusedSeriesNames}
                        lineStrokeWidth={this.lineStrokeWidth}
                    />
                </g>
                {hoverX !== undefined && (
                    <g className="hoverIndicator">
                        {this.series.map((series) => {
                            const value = series.points.find(
                                (point) => point.x === hoverX
                            )
                            if (!value || this.seriesIsBlurred(series))
                                return null

                            return (
                                <circle
                                    key={getSeriesKey(series)}
                                    cx={horizontalAxis.place(value.x)}
                                    cy={verticalAxis.place(value.y)}
                                    r={4}
                                    fill={
                                        this.hasColorScale
                                            ? this.getColorScaleColor(
                                                  value.colorValue
                                              )
                                            : series.color
                                    }
                                />
                            )
                        })}
                        <line
                            x1={horizontalAxis.place(hoverX)}
                            y1={verticalAxis.range[0]}
                            x2={horizontalAxis.place(hoverX)}
                            y2={verticalAxis.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                    </g>
                )}

                {tooltip}
            </g>
        )
    }

    @computed get failMessage(): string {
        const message = getDefaultFailMessage(this.manager)
        if (message) return message
        if (!this.series.length) return "No matching data"
        return ""
    }

    @computed private get yColumns(): CoreColumn[] {
        return this.yColumnSlugs.map((slug) => this.transformedTable.get(slug))
    }

    @computed protected get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed private get colorColumnSlug(): string | undefined {
        return this.manager.colorColumnSlug
    }

    @computed private get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed private get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    // Color scale props

    @computed get colorScaleColumn(): CoreColumn {
        return (
            // For faceted charts, we have to get the values of inputTable before it's filtered by
            // the faceting logic.
            this.manager.colorScaleColumnOverride ??
            // We need to use inputTable in order to get consistent coloring for a variable across
            // charts, e.g. each continent being assigned to the same color.
            // inputTable is unfiltered, so it contains every value that exists in the variable.
            this.inputTable.get(this.colorColumnSlug)
        )
    }

    @computed get hasColorScale(): boolean {
        return !this.colorColumn.isMissing
    }

    @computed get colorScaleConfig(): ColorScaleConfigInterface | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    @computed get hasNoDataBin(): boolean {
        if (!this.hasColorScale) return false
        return this.colorColumn.valuesIncludingErrorValues.some(
            (value) => !isNotErrorValue(value)
        )
    }

    defaultBaseColorScheme = ColorSchemeName.continents
    defaultNoDataColor = "#959595"
    colorScale = new ColorScale(this)

    private getColorScaleColor(value: CoreValueType | undefined): Color {
        return this.colorScale.getColor(value) ?? DEFAULT_LINE_COLOR
    }

    // End of color scale props

    // todo: for now just works with 1 y column
    @computed private get annotationsMap(): Map<
        PrimitiveType,
        Set<PrimitiveType>
    > {
        return this.inputTable
            .getAnnotationColumnForColumn(this.yColumnSlugs[0])
            ?.getUniqueValuesGroupedBy(this.inputTable.entityNameSlug)
    }

    getAnnotationsForSeries(seriesName: SeriesName): string | undefined {
        const annotationsMap = this.annotationsMap
        const annos = annotationsMap?.get(seriesName)
        return annos
            ? Array.from(annos.values())
                  .filter((anno) => anno)
                  .join(" & ")
            : undefined
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : null) ?? ColorSchemes["owid-distinct"]
        )
    }

    @computed get seriesStrategy(): SeriesStrategy {
        const hasNormalAndProjectedSeries =
            this.yColumns.some((col) => col.isProjection) &&
            this.yColumns.some((col) => !col.isProjection)
        return autoDetectSeriesStrategy(
            this.manager,
            hasNormalAndProjectedSeries
        )
    }

    @computed get isLogScale(): boolean {
        return this.yAxisConfig.scaleType === ScaleType.log
    }

    @computed private get categoricalColorAssigner(): CategoricalColorAssigner {
        return new CategoricalColorAssigner({
            colorScheme: this.colorScheme,
            invertColorScheme: this.manager.invertColorScheme,
            colorMap:
                this.seriesStrategy === SeriesStrategy.entity
                    ? this.inputTable.entityNameColorIndex
                    : this.inputTable.columnDisplayNameToColorMap,
            autoColorMapCache: this.manager.seriesColorMap,
        })
    }

    private getSeriesName(
        entityName: EntityName,
        columnName: string,
        entityCount: number
    ): SeriesName {
        if (this.seriesStrategy === SeriesStrategy.entity) {
            return entityName
        }
        if (entityCount > 1 || this.manager.canSelectMultipleEntities) {
            return `${entityName} - ${columnName}`
        } else {
            return columnName
        }
    }

    private getColorCategoryName(
        entityName: EntityName,
        columnName: string,
        entityCount: number
    ): SeriesName {
        if (this.seriesStrategy === SeriesStrategy.entity) {
            return entityName
        }
        // If only one entity is plotted, we want to use the column colors.
        // Unlike in `getSeriesName`, we don't care whether the user can select
        // multiple entities, only whether more than one is plotted.
        if (entityCount > 1) {
            return `${entityName} - ${columnName}`
        } else {
            return columnName
        }
    }

    @computed get series(): readonly LineChartSeries[] {
        const { hasColorScale } = this
        return flatten(
            this.yColumns.map((col) => {
                const { isProjection, owidRowsByEntityName } = col
                const entityNames = Array.from(owidRowsByEntityName.keys())
                return entityNames.map((entityName) => {
                    const seriesName = this.getSeriesName(
                        entityName,
                        col.displayName,
                        entityNames.length
                    )
                    const points = owidRowsByEntityName
                        .get(entityName)!
                        .map((row) => {
                            const point: LinePoint = {
                                x: row.time,
                                y: row.value,
                            }
                            if (hasColorScale) {
                                point.colorValue =
                                    this.colorColumn.valueByEntityNameAndTime
                                        .get(entityName)
                                        ?.get(row.time)
                            }
                            return point
                        })
                    let seriesColor: Color
                    if (hasColorScale) {
                        const colorValue = last(points)?.colorValue
                        seriesColor = this.getColorScaleColor(colorValue)
                    } else {
                        seriesColor = this.categoricalColorAssigner.assign(
                            this.getColorCategoryName(
                                entityName,
                                col.displayName,
                                entityNames.length
                            )
                        )
                    }
                    return {
                        points,
                        seriesName,
                        isProjection,
                        color: seriesColor,
                    }
                })
            })
        )
    }

    // TODO: remove, seems unused
    @computed get allPoints(): LinePoint[] {
        return flatten(this.series.map((series) => series.points))
    }

    @computed get placedSeries(): PlacedLineChartSeries[] {
        const { dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        return this.series
            .slice()
            .reverse()
            .map((series) => {
                return {
                    ...series,
                    placedPoints: series.points.map(
                        (point): PlacedPoint => ({
                            x: round(horizontalAxis.place(point.x), 1),
                            y: round(verticalAxis.place(point.y), 1),
                            color: this.hasColorScale
                                ? this.getColorScaleColor(point.colorValue)
                                : series.color,
                        })
                    ),
                }
            })
    }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get labelSeries(): LineLabelSeries[] {
        // If there are any projections, ignore non-projection legends
        // Bit of a hack
        let seriesToShow = this.series
        if (seriesToShow.some((series) => !!series.isProjection))
            seriesToShow = seriesToShow.filter((series) => series.isProjection)

        return seriesToShow.map((series) => {
            const { seriesName, color } = series
            const lastValue = last(series.points)!.y
            return {
                color,
                seriesName,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: this.manager.hideLegend ? "" : `${seriesName}`,
                annotation: this.getAnnotationsForSeries(seriesName),
                yValue: lastValue,
            }
        })
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.xAxisConfig, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.transformedTable.timeDomainFor(this.yColumnSlugs)
        )
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.inputTable.timeColumn
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get yAxisConfig(): AxisConfig {
        // TODO: enable nice axis ticks for linear scales
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axisConfig = this.yAxisConfig
        const yDomain = this.transformedTable.domainFor(this.yColumnSlugs)
        const domain = axisConfig.domain
        const axis = axisConfig.toVerticalAxis()
        axis.updateDomainPreservingUserSettings([
            Math.min(domain[0], yDomain[0]),
            Math.max(domain[1], yDomain[1]),
        ])
        axis.hideFractionalTicks = this.yColumns.every(
            (yColumn) => yColumn.isAllIntegers
        ) // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.formatColumn = this.formatColumn
        return axis
    }

    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.bounds.padRight(
                this.legendDimensions
                    ? this.legendDimensions.width
                    : this.defaultRightPadding
            ),
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    // TODO: implement legends on line chart
    // This is just for demo purposes
    @computed get externalLegendBins(): CategoricalBin[] {
        if (this.manager.hideLegend) {
            if (this.hasColorScale) {
                return this.colorScale.legendBins.map((bin, index) =>
                    bin instanceof CategoricalBin
                        ? bin
                        : new CategoricalBin({
                              index,
                              value: `${bin.minText}–${bin.maxText}`,
                              label: `${bin.minText}–${bin.maxText}`,
                              color: bin.color,
                          })
                )
            } else {
                return this.series.map(
                    (series, index) =>
                        new CategoricalBin({
                            index,
                            value: series.seriesName,
                            label: series.seriesName,
                            color: series.color,
                        })
                )
            }
        }
        return []
    }
}
