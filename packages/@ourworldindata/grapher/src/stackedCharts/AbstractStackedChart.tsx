import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import {
    ColorSchemeName,
    FacetStrategy,
    MissingDataStrategy,
    SeriesStrategy,
} from "@ourworldindata/types"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import {
    Bounds,
    DEFAULT_BOUNDS,
    exposeInstanceOnWindow,
    guid,
} from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import {
    StackedPoint,
    StackedRawSeries,
    StackedSeries,
} from "./StackedConstants"
import {
    OwidTable,
    CoreColumn,
    isNotErrorValueOrEmptyCell,
} from "@ourworldindata/core-table"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { easeLinear } from "d3-ease"
import { select } from "d3-selection"
import { ColorSchemes } from "../color/ColorSchemes"
import { SelectionArray } from "../selection/SelectionArray"
import { CategoricalBin } from "../color/ColorScaleBin"
import {
    CategoricalColorAssigner,
    CategoricalColorMap,
} from "../color/CategoricalColorAssigner.js"
import { BinaryMapPaletteE } from "../color/CustomSchemes"
import { HorizontalCategoricalColorLegendProps } from "../horizontalColorLegend/HorizontalCategoricalColorLegend"

// used in StackedBar charts to color negative and positive bars
const POSITIVE_COLOR = BinaryMapPaletteE.colorSets[0][0] // orange
const NEGATIVE_COLOR = BinaryMapPaletteE.colorSets[0][1] // blue

export interface AbstractStackedChartProps {
    bounds?: Bounds
    manager: ChartManager
    enableLinearInterpolation?: boolean // defaults to true
}

@observer
export class AbstractStackedChart
    extends React.Component<AbstractStackedChartProps>
    implements ChartInterface, AxisManager
{
    transformTable(table: OwidTable): OwidTable {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table
            .replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)
            .dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

        if (this.shouldRunLinearInterpolation) {
            this.yColumnSlugs.forEach((slug) => {
                table = table.interpolateColumnLinearly(slug)
            })
        }

        // Drop rows for which no valid data points exist for any display column
        // after interpolation, which most likely means they lie at the start/end
        // of the time range and were not extrapolated
        if (this.missingDataStrategy !== MissingDataStrategy.show) {
            table = table.dropRowsWithErrorValuesForAnyColumn(this.yColumnSlugs)
        }

        if (this.manager.isRelativeMode) {
            table = this.isEntitySeries
                ? table.toPercentageFromEachEntityForEachTime(
                      this.yColumnSlugs[0]
                  )
                : table.toPercentageFromEachColumnForEachEntityAndTime(
                      this.yColumnSlugs
                  )
        }
        return table
    }

    transformTableForSelection(table: OwidTable): OwidTable {
        // if entities with partial data are not plotted,
        // make sure they don't show up in the entity selector
        if (this.missingDataStrategy !== MissingDataStrategy.show) {
            table = table
                .replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)
                .dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

            if (this.shouldRunLinearInterpolation) {
                this.yColumnSlugs.forEach((slug) => {
                    table = table.interpolateColumnLinearly(slug)
                })
            }

            table = table.dropRowsWithErrorValuesForAnyColumn(this.yColumnSlugs)
        }

        return table
    }

    @computed private get missingDataStrategy(): MissingDataStrategy {
        return this.manager.missingDataStrategy || MissingDataStrategy.auto
    }

    @computed get shouldRunLinearInterpolation(): boolean {
        // enabled by default
        return this.props.enableLinearInterpolation ?? true
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get manager(): ChartManager {
        return this.props.manager
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get detailsOrderedByReference(): string[] {
        return this.manager.detailsOrderedByReference ?? []
    }

    protected get paddingForLegendRight(): number {
        return 0
    }

    protected get paddingForLegendTop(): number {
        return 0
    }

    @computed get renderUid(): number {
        return guid()
    }

    @computed protected get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed protected get yColumnSlugs(): string[] {
        return this.manager.yColumnSlugs ?? autoDetectYColumnSlugs(this.manager)
    }

    private animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >

    base: React.RefObject<SVGGElement> = React.createRef()
    componentDidMount(): void {
        if (!this.manager.disableIntroAnimation) {
            // Fancy intro animation
            this.animSelection = select(this.base.current)
                .selectAll("clipPath > rect")
                .attr("width", 0)

            this.animSelection
                .transition()
                .duration(800)
                .ease(easeLinear)
                .attr("width", this.bounds.width)
                .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
        }
        exposeInstanceOnWindow(this)
    }

    componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get seriesStrategy(): SeriesStrategy {
        return autoDetectSeriesStrategy(this.manager)
    }

    @computed get innerBounds(): Bounds {
        return (
            this.bounds
                .padTop(this.paddingForLegendTop)
                .padRight(this.paddingForLegendRight)
                // top padding leaves room for tick labels
                .padTop(6)
                // bottom padding avoids axis labels to be cut off at some resolutions
                .padBottom(2)
        )
    }

    @computed protected get dualAxis(): DualAxis {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.innerBounds,
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    // implemented in subclasses
    @computed protected get xAxisConfig(): AxisConfig {
        return new AxisConfig()
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.transformedTable.timeDomainFor(this.yColumnSlugs)
        )
        axis.formatColumn = this.inputTable.timeColumn
        axis.hideFractionalTicks = true
        return axis
    }

    @computed private get yAxisConfig(): AxisConfig {
        // TODO: enable nice axis ticks for linear scales
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    // implemented in subclasses
    @computed protected get yAxisDomain(): [number, number] {
        return [0, 0]
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axis = this.yAxisConfig.toVerticalAxis()
        // Use user settings for axis, unless relative mode
        if (this.manager.isRelativeMode) axis.domain = [0, 100]
        else axis.updateDomainPreservingUserSettings(this.yAxisDomain)
        axis.formatColumn = this.yColumns[0]
        return axis
    }

    @computed
    private get columnsAsSeries(): readonly StackedRawSeries<number>[] {
        return this.yColumns
            .map((col) => {
                return {
                    isProjection: col.isProjection,
                    seriesName: col.displayName,
                    rows: col.owidRows,
                }
            })
            .reverse() // For stacked charts, we want the first selected series to be on top, so we reverse the order of the stacks.
    }

    @computed
    private get entitiesAsSeries(): readonly StackedRawSeries<number>[] {
        if (!this.yColumns.length) return []

        const { isProjection, owidRowsByEntityName } = this.yColumns[0]
        return this.selectionArray.selectedEntityNames
            .map((seriesName) => {
                return {
                    isProjection,
                    seriesName,
                    rows: owidRowsByEntityName.get(seriesName) || [],
                }
            })
            .reverse() // For stacked charts, we want the first selected series to be on top, so we reverse the order of the stacks.
    }

    @computed
    protected get rawSeries(): readonly StackedRawSeries<number>[] {
        return this.isEntitySeries
            ? this.entitiesAsSeries
            : this.columnsAsSeries
    }

    @computed
    protected get allStackedPoints(): readonly StackedPoint<number>[] {
        return this.series.flatMap((series) => series.points)
    }

    @computed get failMessage(): string {
        const { yColumnSlugs } = this
        if (!yColumnSlugs.length) return "Missing variable"
        if (!this.series.length) return "No matching data"
        if (!this.allStackedPoints.length) return "No matching points"
        return ""
    }

    @computed private get colorMap(): CategoricalColorMap {
        return this.isEntitySeries
            ? this.inputTable.entityNameColorIndex
            : this.inputTable.columnDisplayNameToColorMap
    }

    @computed private get categoricalColorAssigner(): CategoricalColorAssigner {
        const seriesCount = this.isEntitySeries
            ? this.selectionArray.numSelectedEntities
            : this.yColumns.length
        return new CategoricalColorAssigner({
            colorScheme:
                (this.manager.baseColorScheme
                    ? ColorSchemes.get(this.manager.baseColorScheme)
                    : null) ??
                ColorSchemes.get(ColorSchemeName.stackedAreaDefault),
            invertColorScheme: this.manager.invertColorScheme,
            colorMap: this.colorMap,
            autoColorMapCache: this.manager.seriesColorMap,
            numColorsInUse: seriesCount,
        })
    }

    @computed protected get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get isEntitySeries(): boolean {
        return this.seriesStrategy === SeriesStrategy.entity
    }

    @computed get seriesColors(): string[] {
        return this.series.map((series) => series.color)
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies: FacetStrategy[] = []

        const { selectedEntityNames } = this.selectionArray
        const areMultipleEntitiesSelected = selectedEntityNames.length > 1
        const hasMultipleYColumns = this.yColumns.length > 1
        const shortUnits = this.yColumns.map((column) => column.shortUnit)
        const uniqueUnits = new Set(shortUnits)
        const hasMultipleUnits = uniqueUnits.size > 1
        const hasPercentageUnit = shortUnits.some(
            (shortUnit) => shortUnit === "%"
        )

        // Normally StackedArea/StackedBar charts are always single-entity or single-column, but if we are ever in a mode where we
        // have multiple entities selected (e.g. through GlobalEntitySelector) and multiple columns, it only makes sense when faceted.
        if (!this.isEntitySeries && !areMultipleEntitiesSelected)
            strategies.push(FacetStrategy.none)
        else if (this.isEntitySeries && !hasMultipleYColumns)
            strategies.push(FacetStrategy.none)

        if (areMultipleEntitiesSelected && !hasMultipleUnits)
            strategies.push(FacetStrategy.entity)

        if (
            hasMultipleYColumns &&
            // Stacking percentages doesn't make sense unless we're in relative mode
            (!hasPercentageUnit || this.manager.isRelativeMode)
        )
            strategies.push(FacetStrategy.metric)

        return strategies
    }

    @computed get shouldUseValueBasedColorScheme(): boolean {
        return false
    }

    @computed get useValueBasedColorScheme(): boolean {
        return false
    }

    @computed get unstackedSeries(): readonly StackedSeries<number>[] {
        return this.rawSeries
            .filter((series) => series.rows.length > 0)

            .map((series) => {
                const { isProjection, seriesName, rows } = series

                const points = rows.map((row) => {
                    const pointColor =
                        row.value > 0 ? POSITIVE_COLOR : NEGATIVE_COLOR
                    return {
                        position: row.originalTime,
                        time: row.originalTime,
                        value: row.value,
                        valueOffset: 0,
                        interpolated:
                            this.shouldRunLinearInterpolation &&
                            isNotErrorValueOrEmptyCell(row.value) &&
                            !isNotErrorValueOrEmptyCell(row.originalValue),
                        // takes precedence over the series color if given
                        color: this.useValueBasedColorScheme
                            ? pointColor
                            : undefined,
                    }
                })

                return {
                    seriesName,
                    isProjection,
                    points,
                    isAllZeros: points.every((point) => point.value === 0),
                    color: this.categoricalColorAssigner.assign(seriesName),
                }
            }) as StackedSeries<number>[]
    }

    @computed get series(): readonly StackedSeries<number>[] {
        return this.unstackedSeries
    }

    @computed get externalLegend():
        | HorizontalCategoricalColorLegendProps
        | undefined {
        if (!this.manager.showLegend) {
            const categoricalLegendData = this.series
                .map(
                    (series, index) =>
                        new CategoricalBin({
                            index,
                            value: series.seriesName,
                            label: series.seriesName,
                            color: series.color,
                        })
                )
                .reverse()
            return { categoricalLegendData }
        }
        return undefined
    }
}
