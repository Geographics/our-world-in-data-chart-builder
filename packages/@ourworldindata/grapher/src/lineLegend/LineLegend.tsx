// This implements the line labels that appear to the right of the lines/polygons in LineCharts/StackedAreas.
import React from "react"
import {
    Bounds,
    noop,
    cloneDeep,
    max,
    min,
    sortBy,
    sumBy,
    makeIdForHumanConsumption,
    excludeUndefined,
    sortedIndexBy,
    last,
    maxBy,
} from "@ourworldindata/utils"
import { TextWrap } from "@ourworldindata/components"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { VerticalAxis } from "../axis/Axis"
import { EntityName } from "@ourworldindata/types"
import { BASE_FONT_SIZE, GRAPHER_FONT_SCALE_12 } from "../core/GrapherConstants"
import { ChartSeries } from "../chart/ChartInterface"
import { darkenColorForText } from "../color/ColorUtils"
import { AxisConfig } from "../axis/AxisConfig.js"
import { Halo } from "../halo/Halo"

// Minimum vertical space between two legend items
const LEGEND_ITEM_MIN_SPACING = 4
// Horizontal distance from the end of the chart to the start of the marker
const MARKER_MARGIN = 4
// Space between the label and the annotation
const ANNOTATION_PADDING = 2

const DEFAULT_CONNECTOR_LINE_WIDTH = 35
const DEFAULT_FONT_WEIGHT = 400

export interface LineLabelSeries extends ChartSeries {
    label: string
    yValue: number
    annotation?: string
    formattedValue?: string
    yRange?: [number, number]
}

interface SizedSeries extends LineLabelSeries {
    textWrap: TextWrap
    annotationTextWrap?: TextWrap
    valueTextWrap?: TextWrap
    width: number
    height: number
}

interface PlacedSeries extends SizedSeries {
    origBounds: Bounds
    bounds: Bounds
    repositions: number
    level: number
    totalLevels: number
    midY: number
}

function getSeriesKey(
    series: PlacedSeries,
    index: number,
    key: string
): string {
    return `${key}-${index}-` + series.seriesName
}

function groupBounds(group: PlacedSeries[]): Bounds {
    const first = group[0]
    const last = group[group.length - 1]
    const height = last.bounds.bottom - first.bounds.top
    const width = Math.max(first.bounds.width, last.bounds.width)
    return new Bounds(first.bounds.x, first.bounds.y, width, height)
}

function stackGroupVertically(
    group: PlacedSeries[],
    y: number
): PlacedSeries[] {
    let currentY = y
    group.forEach((mark) => {
        mark.bounds = mark.bounds.set({ y: currentY })
        mark.repositions += 1
        currentY += mark.bounds.height + LEGEND_ITEM_MIN_SPACING
    })
    return group
}

@observer
class LineLabels extends React.Component<{
    series: PlacedSeries[]
    uniqueKey: string
    needsConnectorLines: boolean
    connectorLineWidth?: number
    anchor?: "start" | "end"
    showValueLabelsInline?: boolean
    isFocus?: boolean
    isStatic?: boolean
    onClick?: (series: PlacedSeries) => void
    onMouseOver?: (series: PlacedSeries) => void
    onMouseLeave?: (series: PlacedSeries) => void
}> {
    @computed private get textOpacity(): number {
        return this.props.isFocus ? 1 : 0.6
    }

    @computed private get anchor(): "start" | "end" {
        return this.props.anchor ?? "start"
    }

    @computed private get connectorLineWidth(): number {
        return this.props.connectorLineWidth ?? DEFAULT_CONNECTOR_LINE_WIDTH
    }

    @computed private get showValueLabelsInline(): boolean {
        return this.props.showValueLabelsInline ?? true
    }

    @computed private get markers(): {
        series: PlacedSeries
        labelText: { x: number; y: number }
        connectorLine: { x1: number; x2: number }
    }[] {
        return this.props.series.map((series) => {
            const direction = this.anchor === "start" ? 1 : -1
            const markerMargin = direction * MARKER_MARGIN
            const connectorLineWidth = direction * this.connectorLineWidth

            const { x } = series.origBounds
            const connectorLine = {
                x1: x + markerMargin,
                x2: x + connectorLineWidth - markerMargin,
            }

            const textX = this.props.needsConnectorLines
                ? connectorLine.x2 + markerMargin
                : x + markerMargin
            const textY = series.bounds.y

            return {
                series,
                labelText: { x: textX, y: textY },
                connectorLine,
            }
        })
    }

    @computed private get textLabels(): React.ReactElement {
        return (
            <g id={makeIdForHumanConsumption("text-labels")}>
                {this.markers.map(({ series, labelText }, index) => {
                    const key = getSeriesKey(
                        series,
                        index,
                        this.props.uniqueKey
                    )
                    const textColor = darkenColorForText(series.color)
                    return (
                        <Halo id={key} key={key}>
                            {series.textWrap.render(labelText.x, labelText.y, {
                                textProps: {
                                    fill: textColor,
                                    opacity: this.textOpacity,
                                    textAnchor: this.anchor,
                                },
                            })}
                        </Halo>
                    )
                })}
            </g>
        )
    }

    @computed private get textAnnotations(): React.ReactElement | void {
        const markersWithAnnotations = this.markers.filter(
            ({ series }) => series.annotationTextWrap !== undefined
        )
        if (!markersWithAnnotations) return
        return (
            <g id={makeIdForHumanConsumption("text-annotations")}>
                {markersWithAnnotations.map(({ series, labelText }, index) => {
                    const key = getSeriesKey(
                        series,
                        index,
                        this.props.uniqueKey
                    )
                    if (!series.annotationTextWrap) return
                    return (
                        <Halo id={key} key={key}>
                            {series.annotationTextWrap.render(
                                labelText.x,
                                labelText.y +
                                    series.textWrap.height +
                                    ANNOTATION_PADDING,
                                {
                                    textProps: {
                                        fill: "#333",
                                        opacity: this.textOpacity,
                                        textAnchor: this.anchor,
                                        style: { fontWeight: 300 },
                                    },
                                }
                            )}
                        </Halo>
                    )
                })}
            </g>
        )
    }

    @computed private get textValues(): React.ReactElement | void {
        const markersWithTextValues = this.markers.filter(
            ({ series }) => series.valueTextWrap !== undefined
        )
        if (!markersWithTextValues) return
        return (
            <g id={makeIdForHumanConsumption("text-values")}>
                {markersWithTextValues.map(({ series, labelText }, index) => {
                    if (!series.valueTextWrap) return
                    const key = getSeriesKey(
                        series,
                        index,
                        this.props.uniqueKey
                    )
                    const textColor = darkenColorForText(series.color)
                    const direction = this.anchor === "start" ? 1 : -1
                    const x = this.showValueLabelsInline
                        ? labelText.x + direction * (series.textWrap.width + 4)
                        : labelText.x
                    const y = this.showValueLabelsInline
                        ? labelText.y
                        : labelText.y +
                          series.textWrap.height +
                          ANNOTATION_PADDING
                    return (
                        <Halo id={key} key={key}>
                            {series.valueTextWrap.render(x, y, {
                                textProps: {
                                    fill: textColor,
                                    opacity: this.textOpacity,
                                    textAnchor: this.anchor,
                                },
                            })}
                        </Halo>
                    )
                })}
            </g>
        )
    }

    @computed private get connectorLines(): React.ReactElement | void {
        if (!this.props.needsConnectorLines) return
        return (
            <g id={makeIdForHumanConsumption("connectors")}>
                {this.markers.map(({ series, connectorLine }, index) => {
                    const { isFocus } = this.props
                    const { x1, x2 } = connectorLine
                    const {
                        level,
                        totalLevels,
                        origBounds: { centerY: leftCenterY },
                        bounds: { centerY: rightCenterY },
                    } = series

                    const step = (x2 - x1) / (totalLevels + 1)
                    const markerXMid = x1 + step + level * step
                    const d = `M${x1},${leftCenterY} H${markerXMid} V${rightCenterY} H${x2}`
                    const lineColor = isFocus ? "#999" : "#eee"

                    return (
                        <path
                            id={makeIdForHumanConsumption(series.seriesName)}
                            key={getSeriesKey(
                                series,
                                index,
                                this.props.uniqueKey
                            )}
                            d={d}
                            stroke={lineColor}
                            strokeWidth={0.5}
                            fill="none"
                        />
                    )
                })}
            </g>
        )
    }

    @computed private get interactions(): React.ReactElement | void {
        return (
            <g>
                {this.props.series.map((series, index) => {
                    const x =
                        this.anchor === "start"
                            ? series.origBounds.x
                            : series.origBounds.x - series.bounds.width
                    return (
                        <g
                            key={getSeriesKey(
                                series,
                                index,
                                this.props.uniqueKey
                            )}
                            onMouseOver={() => this.props.onMouseOver?.(series)}
                            onMouseLeave={() =>
                                this.props.onMouseLeave?.(series)
                            }
                            onClick={() => this.props.onClick?.(series)}
                            style={{ cursor: "default" }}
                        >
                            <rect
                                x={x}
                                y={series.bounds.y}
                                width={series.bounds.width}
                                height={series.bounds.height}
                                fill="#fff"
                                opacity={0}
                            />
                        </g>
                    )
                })}
            </g>
        )
    }

    render(): React.ReactElement {
        return (
            <>
                {this.connectorLines}
                {this.textAnnotations}
                {this.textValues}
                {this.textLabels}
                {!this.props.isStatic && this.interactions}
            </>
        )
    }
}

export interface LineLegendProps {
    labelSeries: LineLabelSeries[]
    yAxis?: VerticalAxis

    // positioning
    x?: number
    yRange?: [number, number]
    maxWidth?: number
    lineLegendAnchorX?: "start" | "end"

    // presentation
    connectorLineWidth?: number
    fontSize?: number
    fontWeight?: number
    showValueLabelsInline?: boolean

    // used to determine which series should be labelled when there is limited space
    seriesSortedByImportance?: EntityName[]

    // interactions
    isStatic?: boolean // don't add interactions if true
    focusedSeriesNames?: EntityName[] // currently in focus
    onClick?: (key: EntityName) => void
    onMouseOver?: (key: EntityName) => void
    onMouseLeave?: () => void
}

@observer
export class LineLegend extends React.Component<LineLegendProps> {
    static width(props: LineLegendProps): number {
        const test = new LineLegend(props)
        const connectorLineWidth = test.needsLines ? test.connectorLineWidth : 0
        return test.maxLabelWidth + connectorLineWidth + MARKER_MARGIN
    }

    /**
     * Always adds the width of connector lines, which leads to an incorrect
     * result if no connector lines are rendered. We sometimes can't use the
     * correct width above due to circular dependencies.
     */
    static incorrectWidth(props: LineLegendProps): number {
        const test = new LineLegend(props)
        return test.maxLabelWidth + test.connectorLineWidth + MARKER_MARGIN
    }

    @computed private get fontSize(): number {
        return Math.max(
            GRAPHER_FONT_SCALE_12 * (this.props.fontSize ?? BASE_FONT_SIZE),
            11.5
        )
    }

    @computed private get fontWeight(): number {
        return this.props.fontWeight ?? DEFAULT_FONT_WEIGHT
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? 300
    }

    @computed private get yAxis(): VerticalAxis {
        return this.props.yAxis ?? new VerticalAxis(new AxisConfig())
    }

    @computed private get connectorLineWidth(): number {
        return this.props.connectorLineWidth ?? DEFAULT_CONNECTOR_LINE_WIDTH
    }

    @computed private get showValueLabelsInline(): boolean {
        return this.props.showValueLabelsInline ?? true
    }

    @computed private get hasValueLabels(): boolean {
        return this.props.labelSeries.some(
            (series) => series.formattedValue !== undefined
        )
    }

    @computed private get hideAnnotations(): boolean {
        return this.hasValueLabels && !this.showValueLabelsInline
    }

    @computed.struct get sizedLabels(): SizedSeries[] {
        const { fontSize, fontWeight, maxWidth } = this
        const maxTextWidth = maxWidth - this.connectorLineWidth
        const maxAnnotationWidth = Math.min(maxTextWidth, 150)

        return this.props.labelSeries.map((label) => {
            const textWrap = new TextWrap({
                text: label.label,
                maxWidth: maxTextWidth,
                fontSize,
                fontWeight,
                lineHeight: 1,
            })
            const annotationTextWrap =
                !this.hideAnnotations && label.annotation
                    ? new TextWrap({
                          text: label.annotation,
                          maxWidth: maxAnnotationWidth,
                          fontSize: fontSize * 0.9,
                          lineHeight: 1,
                      })
                    : undefined
            const valueTextWrap = label.formattedValue
                ? new TextWrap({
                      text: label.formattedValue,
                      maxWidth: Infinity,
                      fontSize: fontSize * 0.9,
                      lineHeight: 1,
                  })
                : undefined

            const annotationWidth = annotationTextWrap
                ? annotationTextWrap.width
                : 0
            const annotationHeight = annotationTextWrap
                ? ANNOTATION_PADDING + annotationTextWrap.height
                : 0

            const valueWidth = valueTextWrap ? valueTextWrap.width : 0
            const valueHeight = valueTextWrap
                ? ANNOTATION_PADDING + valueTextWrap.height
                : 0

            return {
                ...label,
                textWrap,
                annotationTextWrap,
                valueTextWrap,
                width: this.showValueLabelsInline
                    ? Math.max(textWrap.width + 4 + valueWidth, annotationWidth)
                    : Math.max(textWrap.width, annotationWidth, valueWidth),
                height: this.showValueLabelsInline
                    ? textWrap.height + annotationHeight
                    : textWrap.height + annotationHeight + valueHeight,
            }
        })
    }

    @computed private get maxLabelWidth(): number {
        const { sizedLabels = [] } = this
        return max(sizedLabels.map((d) => d.width)) ?? 0
    }

    @computed get onMouseOver(): any {
        return this.props.onMouseOver ?? noop
    }
    @computed get onMouseLeave(): any {
        return this.props.onMouseLeave ?? noop
    }
    @computed get onClick(): any {
        return this.props.onClick ?? noop
    }

    @computed get focusedSeriesNames(): EntityName[] {
        return this.props.focusedSeriesNames ?? []
    }

    @computed get isFocusMode(): boolean {
        return this.sizedLabels.some((label) =>
            this.focusedSeriesNames.includes(label.seriesName)
        )
    }

    @computed get legendX(): number {
        return this.props.x ?? 0
    }

    @computed get legendY(): [number, number] {
        const range = this.props.yRange ?? this.yAxis.range
        return [Math.min(range[1], range[0]), Math.max(range[1], range[0])]
    }

    // Naive initial placement of each mark at the target height, before collision detection
    @computed private get initialSeries(): PlacedSeries[] {
        const { yAxis, legendX, legendY } = this

        const [legendYMin, legendYMax] = legendY

        return this.sizedLabels.map((label) => {
            const labelHeight = label.height
            const labelWidth = label.width + this.connectorLineWidth

            // place vertically centered at Y value
            const midY = yAxis.place(label.yValue)
            const initialY = midY - label.height / 2
            const origBounds = new Bounds(
                legendX,
                initialY,
                labelWidth,
                labelHeight
            )

            // ensure label doesn't go beyond the top or bottom of the chart
            const y = Math.min(
                Math.max(initialY, legendYMin),
                legendYMax - labelHeight
            )
            const bounds = new Bounds(legendX, y, labelWidth, labelHeight)

            return {
                ...label,
                y,
                midY,
                origBounds,
                bounds,
                repositions: 0,
                level: 0,
                totalLevels: 0,
            }
        })
    }

    @computed get initialSeriesByName(): Map<EntityName, PlacedSeries> {
        return new Map(this.initialSeries.map((d) => [d.seriesName, d]))
    }

    @computed get placedSeries(): PlacedSeries[] {
        const [yLegendMin, yLegendMax] = this.legendY

        // ensure list is sorted by the visual position in ascending order
        const sortedSeries = sortBy(
            this.partialInitialSeries,
            (label) => label.midY
        )

        const groups: PlacedSeries[][] = cloneDeep(sortedSeries).map((mark) => [
            mark,
        ])

        let hasOverlap

        do {
            hasOverlap = false
            for (let i = 0; i < groups.length - 1; i++) {
                const topGroup = groups[i]
                const bottomGroup = groups[i + 1]
                const topBounds = groupBounds(topGroup)
                const bottomBounds = groupBounds(bottomGroup)
                if (topBounds.intersects(bottomBounds)) {
                    const overlapHeight =
                        topBounds.bottom -
                        bottomBounds.top +
                        LEGEND_ITEM_MIN_SPACING
                    const newHeight =
                        topBounds.height +
                        LEGEND_ITEM_MIN_SPACING +
                        bottomBounds.height
                    const targetY =
                        topBounds.top -
                        overlapHeight *
                            (bottomGroup.length /
                                (topGroup.length + bottomGroup.length))
                    const overflowTop = Math.max(yLegendMin - targetY, 0)
                    const overflowBottom = Math.max(
                        targetY + newHeight - yLegendMax,
                        0
                    )
                    const newY = targetY + overflowTop - overflowBottom
                    const newGroup = [...topGroup, ...bottomGroup]
                    stackGroupVertically(newGroup, newY)
                    groups.splice(i, 2, newGroup)
                    hasOverlap = true
                    break
                }
            }
        } while (hasOverlap && groups.length > 1)

        for (const group of groups) {
            let currentLevel = 0
            let prevSign = 0
            for (const series of group) {
                const currentSign = Math.sign(
                    series.bounds.y - series.origBounds.y
                )
                if (prevSign === currentSign) {
                    currentLevel -= currentSign
                }
                series.level = currentLevel
                prevSign = currentSign
            }
            const minLevel = min(group.map((mark) => mark.level)) as number
            const maxLevel = max(group.map((mark) => mark.level)) as number
            for (const mark of group) {
                mark.level -= minLevel
                mark.totalLevels = maxLevel - minLevel + 1
            }
        }

        return groups.flat()
    }

    @computed get sortedSeriesByImportance(): PlacedSeries[] | undefined {
        if (!this.props.seriesSortedByImportance) return undefined
        return excludeUndefined(
            this.props.seriesSortedByImportance.map((seriesName) =>
                this.initialSeriesByName.get(seriesName)
            )
        )
    }

    @computed get partialInitialSeries(): PlacedSeries[] {
        const { legendY } = this
        const availableHeight = Math.abs(legendY[1] - legendY[0])
        const nonOverlappingMinHeight =
            sumBy(this.initialSeries, (series) => series.bounds.height) +
            this.initialSeries.length * LEGEND_ITEM_MIN_SPACING

        // early return if filtering is not needed
        if (nonOverlappingMinHeight <= availableHeight)
            return this.initialSeries

        if (this.sortedSeriesByImportance) {
            // keep a subset of series that fit within the available height,
            // prioritizing by importance. Note that more important (but longer)
            // series names are skipped if they don't fit.
            const keepSeries: PlacedSeries[] = []
            let keepSeriesHeight = 0
            for (const series of this.sortedSeriesByImportance) {
                const newHeight =
                    keepSeriesHeight +
                    series.bounds.height +
                    LEGEND_ITEM_MIN_SPACING
                if (newHeight <= availableHeight) {
                    keepSeries.push(series)
                    keepSeriesHeight = newHeight
                    if (keepSeriesHeight > availableHeight) break
                }
            }
            return keepSeries
        } else {
            const candidates = new Set<PlacedSeries>(this.initialSeries)
            const sortedKeepSeries: PlacedSeries[] = []

            let keepSeriesHeight = 0

            const maybePickCandidate = (candidate: PlacedSeries): boolean => {
                const newHeight =
                    keepSeriesHeight +
                    candidate.bounds.height +
                    LEGEND_ITEM_MIN_SPACING
                if (newHeight <= availableHeight) {
                    const insertIndex = sortedIndexBy(
                        sortedKeepSeries,
                        candidate,
                        (s) => s.midY
                    )
                    sortedKeepSeries.splice(insertIndex, 0, candidate)
                    candidates.delete(candidate)
                    keepSeriesHeight = newHeight
                    return true
                }
                return false
            }

            type Bracket = [number, number]
            const findBracket = (
                sortedBrackets: Bracket[],
                n: number
            ): [number | undefined, number | undefined] => {
                if (sortedBrackets.length === 0) return [undefined, undefined]

                const firstBracketValue = sortedBrackets[0][0]
                const lastBracketValue = last(sortedBrackets)![1]

                if (n < firstBracketValue) return [undefined, firstBracketValue]
                if (n >= lastBracketValue) return [lastBracketValue, undefined]

                for (const bracket of sortedBrackets) {
                    if (n >= bracket[0] && n < bracket[1]) return bracket
                }

                return [undefined, undefined]
            }

            const sortedCandidates = sortBy(this.initialSeries, (c) => c.midY)

            // pick two candidates, one from the top and one from the bottom
            const midIndex = Math.floor((sortedCandidates.length - 1) / 2)
            for (let startIndex = 0; startIndex <= midIndex; startIndex++) {
                const endIndex = sortedCandidates.length - 1 - startIndex
                maybePickCandidate(sortedCandidates[endIndex])
                if (sortedKeepSeries.length >= 2 || startIndex === endIndex)
                    break
                maybePickCandidate(sortedCandidates[startIndex])
                if (sortedKeepSeries.length >= 2) break
            }

            while (candidates.size > 0 && keepSeriesHeight <= availableHeight) {
                const sortedBrackets = sortedKeepSeries
                    .slice(0, -1)
                    .map((s, i) => [s.midY, sortedKeepSeries[i + 1].midY])
                    .filter((bracket) => bracket[0] !== bracket[1]) as Bracket[]

                // score each candidate based on how well it fits into the available space
                const candidateScores: [PlacedSeries, number][] = Array.from(
                    candidates
                ).map((candidate) => {
                    // find the bracket that the candidate is contained in
                    const [start, end] = findBracket(
                        sortedBrackets,
                        candidate.midY
                    )
                    // if no bracket is found, return the worst possible score
                    if (end === undefined || start === undefined)
                        return [candidate, 0]

                    // score the candidate based on how far it is from the
                    // middle of the bracket and how large the bracket is
                    const length = end - start
                    const midPoint = start + length / 2
                    const distanceFromMidPoint = Math.abs(
                        candidate.midY - midPoint
                    )
                    const score = length - distanceFromMidPoint

                    return [candidate, score]
                })

                // pick the candidate with the highest score
                // that fits into the available space
                let picked = false
                while (!picked && candidateScores.length > 0) {
                    const maxCandidateArr = maxBy(candidateScores, (s) => s[1])!
                    const maxCandidate = maxCandidateArr[0]
                    picked = maybePickCandidate(maxCandidate)

                    // if the highest scoring candidate doesn't fit,
                    // remove it from the candidates and continue
                    if (!picked) {
                        candidates.delete(maxCandidate)

                        const cIndex = candidateScores.indexOf(maxCandidateArr)
                        if (cIndex > -1) candidateScores.splice(cIndex, 1)
                    }
                }
            }

            return sortedKeepSeries
        }
    }

    @computed private get backgroundSeries(): PlacedSeries[] {
        const { focusedSeriesNames } = this
        const { isFocusMode } = this
        return this.placedSeries.filter(
            (mark) =>
                isFocusMode && !focusedSeriesNames.includes(mark.seriesName)
        )
    }

    @computed private get focusedSeries(): PlacedSeries[] {
        const { focusedSeriesNames } = this
        const { isFocusMode } = this
        return this.placedSeries.filter(
            (mark) =>
                !isFocusMode || focusedSeriesNames.includes(mark.seriesName)
        )
    }

    // Does this placement need line markers or is the position of the labels already clear?
    @computed private get needsLines(): boolean {
        return this.placedSeries.some((series) => series.totalLevels > 1)
    }

    private renderBackground(): React.ReactElement {
        return (
            <LineLabels
                uniqueKey="background"
                series={this.backgroundSeries}
                needsConnectorLines={this.needsLines}
                connectorLineWidth={this.connectorLineWidth}
                showValueLabelsInline={this.showValueLabelsInline}
                isFocus={false}
                anchor={this.props.lineLegendAnchorX}
                isStatic={this.props.isStatic}
                onMouseOver={(series): void =>
                    this.onMouseOver(series.seriesName)
                }
                onClick={(series): void => this.onClick(series.seriesName)}
            />
        )
    }

    // All labels are focused by default, moved to background when mouseover of other label
    private renderFocus(): React.ReactElement {
        return (
            <LineLabels
                uniqueKey="focus"
                series={this.focusedSeries}
                needsConnectorLines={this.needsLines}
                connectorLineWidth={this.connectorLineWidth}
                showValueLabelsInline={this.showValueLabelsInline}
                isFocus={true}
                anchor={this.props.lineLegendAnchorX}
                isStatic={this.props.isStatic}
                onMouseOver={(series): void =>
                    this.onMouseOver(series.seriesName)
                }
                onClick={(series): void => this.onClick(series.seriesName)}
                onMouseLeave={(series): void =>
                    this.onMouseLeave(series.seriesName)
                }
            />
        )
    }

    render(): React.ReactElement {
        return (
            <g
                id={makeIdForHumanConsumption("line-labels")}
                className="LineLabels"
            >
                {this.renderBackground()}
                {this.renderFocus()}
            </g>
        )
    }
}
