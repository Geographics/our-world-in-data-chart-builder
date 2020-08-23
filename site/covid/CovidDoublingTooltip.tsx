import * as React from "react"

import { CovidDoublingRange, NounGenerator, CovidDatum } from "./CovidTypes"
import { formatInt, formatDate } from "./CovidUtils"

export const CovidDoublingTooltip = (props: {
    doublingRange: CovidDoublingRange
    noun: NounGenerator
    accessor: (d: CovidDatum) => number | undefined
}) => {
    const { noun, accessor } = props
    const { latestDay, halfDay, ratio, length } = props.doublingRange
    const exactRatioWording =
        ratio.toFixed(1) === "2.0"
            ? "doubled"
            : `increased by a factor of ${ratio.toFixed(1)}`
    return (
        <div className="covid-tooltip">
            The number of total confirmed {noun()} in {latestDay.location} has{" "}
            <span className="growth-rate">{exactRatioWording}</span> in the{" "}
            <span className="period">last {length} days</span>.
            <table className="values">
                <tbody>
                    <tr>
                        <td className="value from-color">
                            {formatInt(accessor(halfDay))}{" "}
                            {noun(accessor(halfDay))}
                        </td>
                        <td>on</td>
                        <td className="date from-color">
                            {formatDate(halfDay.date)}
                        </td>
                    </tr>
                    <tr>
                        <td className="value to-color">
                            {formatInt(accessor(latestDay))}{" "}
                            {noun(accessor(latestDay))}
                        </td>
                        <td>on</td>
                        <td className="date to-color">
                            {formatDate(latestDay.date)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}
