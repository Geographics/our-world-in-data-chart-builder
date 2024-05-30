import React from "react"
import { Box } from "@ourworldindata/utils"
import { SeriesStrategy, EntityName } from "@ourworldindata/types"
import { LineChartSeries } from "../lineCharts/LineChartConstants"
import { SelectionArray } from "../selection/SelectionArray"
import { ChartManager } from "./ChartManager"

export const autoDetectYColumnSlugs = (manager: ChartManager): string[] => {
    if (manager.yColumnSlugs && manager.yColumnSlugs.length)
        return manager.yColumnSlugs
    if (manager.yColumnSlug) return [manager.yColumnSlug]
    return manager.table.numericColumnSlugs
}

export const getDefaultFailMessage = (manager: ChartManager): string => {
    if (manager.table.rootTable.isBlank) return `No table loaded yet.`
    if (manager.table.rootTable.entityNameColumn.isMissing)
        return `Table is missing an EntityName column.`
    if (manager.table.rootTable.timeColumn.isMissing)
        return `Table is missing a Time column.`
    const yColumnSlugs = autoDetectYColumnSlugs(manager)
    if (!yColumnSlugs.length) return "Missing Y axis column"
    const selection = makeSelectionArray(manager.selection)
    if (!selection.hasSelection) return `No ${manager.entityType} selected`
    return ""
}

export const getSeriesKey = (
    series: LineChartSeries,
    suffix?: string
): string => {
    return `${series.seriesName}-${series.color}-${
        series.isProjection ? "projection" : ""
    }${suffix ? "-" + suffix : ""}`
}

export const autoDetectSeriesStrategy = (
    manager: ChartManager,
    handleProjections: boolean = false
): SeriesStrategy => {
    if (manager.seriesStrategy) return manager.seriesStrategy

    let columnThreshold: number = 1

    if (handleProjections && manager.transformedTable) {
        const yColumnSlugs = autoDetectYColumnSlugs(manager)
        const yColumns = yColumnSlugs.map((slug) =>
            manager.transformedTable!.get(slug)
        )
        const hasNormalAndProjectedSeries =
            yColumns.some((col) => col.isProjection) &&
            yColumns.some((col) => !col.isProjection)
        if (hasNormalAndProjectedSeries) {
            columnThreshold = 2
        }
    }

    return autoDetectYColumnSlugs(manager).length > columnThreshold
        ? SeriesStrategy.column
        : SeriesStrategy.entity
}

export const makeClipPath = (
    renderUid: number,
    box: Box
): { id: string; element: React.ReactElement } => {
    const id = `boundsClip-${renderUid}`
    return {
        id: `url(#${id})`,
        element: (
            <defs>
                <clipPath id={id}>
                    <rect {...box}></rect>
                </clipPath>
            </defs>
        ),
    }
}

export const makeSelectionArray = (
    selection?: SelectionArray | EntityName[]
): SelectionArray =>
    selection instanceof SelectionArray
        ? selection
        : new SelectionArray(selection ?? [])
