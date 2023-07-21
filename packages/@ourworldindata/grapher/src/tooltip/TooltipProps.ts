import { ObservableMap } from "mobx"
import { CoreColumn } from "@ourworldindata/core-table"
import { TickFormattingOptions } from "@ourworldindata/utils"

// We can't pass the property directly because we need it to be observable.
export interface TooltipManager {
    tooltips?: ObservableMap<TooltipProps["id"], TooltipProps>
}

export type TooltipFadeMode = "delayed" | "immediate" | "none"

export interface TooltipProps {
    id: number | string
    x: number
    y: number
    offsetX?: number
    offsetY?: number
    offsetXDirection?: "left" | "right"
    offsetYDirection?: "upward" | "downward"
    title?: string | number // header text
    subtitle?: string | number // header deck
    subtitleFormat?: "unit" | "notice" // optional postprocessing for subtitle
    notice?: string | number // target year displayed in footer tolerance text
    prompt?: string // freeform message displayed in footer
    style?: React.CSSProperties // css overrides (particularly width/maxWidth)
    dissolve?: TooltipFadeMode // flag that the tooltip should begin fading out
    tooltipManager: TooltipManager
    children?: React.ReactNode
}

export interface TooltipValueProps {
    column: CoreColumn
    value?: number | string
    color?: string
    notice?: number | string // actual year data was drawn from (when ≠ target year)
}

export interface TooltipValueRangeProps {
    column: CoreColumn
    values: number[]
    color?: string
    notice?: (number | string | undefined)[] // actual year data was drawn from (when ≠ target year)
}

export interface TooltipTableProps {
    columns: CoreColumn[]
    rows: TooltipTableRow[]
    totals?: (number | undefined)[]
    format?: TickFormattingOptions
}

export interface TooltipTableRow {
    name: string
    annotation?: string
    swatch?: string // css color string for the series's swatch
    focused?: boolean // highlighted (based on hovered series in chart)
    blurred?: boolean // greyed out (typically due to missing data)
    notice?: string | number // actual year data was drawn (when ≠ target year)
    values: (string | number | undefined)[]
}

export interface TooltipTableData {
    value: number
    fake?: boolean
}
