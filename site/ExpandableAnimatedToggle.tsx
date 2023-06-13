import { faMinus } from "@fortawesome/free-solid-svg-icons/faMinus"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import React, { useState } from "react"
import AnimateHeight from "react-animate-height"
import cx from "classnames"

export const ExpandableAnimatedToggle = ({
    label,
    content,
    isExpandedDefault = false,
    isStacked = false,
}: {
    label: string
    content?: React.ReactNode
    isExpandedDefault?: boolean
    isStacked?: boolean
}) => {
    const [height, setHeight] = useState<"auto" | 0>(
        isExpandedDefault ? "auto" : 0
    )

    const toggle = () => {
        setHeight(height === 0 ? "auto" : 0)
    }

    return (
        <div
            className={cx("ExpandableAnimatedToggle", {
                "ExpandableAnimatedToggle--stacked": isStacked,
            })}
        >
            <button onClick={toggle}>
                <h4>{label}</h4>
                <FontAwesomeIcon
                    className="ExpandableAnimatedToggle__icon"
                    icon={height === 0 ? faPlus : faMinus}
                />
            </button>
            <AnimateHeight height={height} animateOpacity>
                <div className="content-wrapper">{content}</div>
            </AnimateHeight>
        </div>
    )
}
