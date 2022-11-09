import React from "react"
import classnames from "classnames"
import { SortOrder } from "@ourworldindata/core-table"

export interface CovidTableSortIconProps {
    sortOrder: SortOrder
    isActive: boolean
}

export const CovidTableSortIcon = (props: CovidTableSortIconProps) => {
    const isActive = props.isActive ?? false

    return (
        <span
            className={classnames("sort-icon", props.sortOrder, {
                active: isActive,
            })}
        />
    )
}
