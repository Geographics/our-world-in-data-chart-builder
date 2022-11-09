import React from "react"
import { MapChart } from "./MapChart"
import { SynthesizeGDPTable } from "@ourworldindata/core-table"

export default {
    title: "MapChart",
    component: MapChart,
}

export const AutoColors = (): JSX.Element => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 200,
    })

    return (
        <svg width={600} height={600}>
            <MapChart manager={{ table }} />
        </svg>
    )
}
