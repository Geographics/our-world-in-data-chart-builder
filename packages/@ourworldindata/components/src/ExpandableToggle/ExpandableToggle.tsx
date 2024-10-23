import { faMinus, faPlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import React, { useState } from "react"
import cx from "classnames"

export const ExpandableToggle = ({
    label,
    content,
    alwaysVisibleDescription,
    isExpandedDefault = false,
    isStacked = false,
    hasTeaser = false,
}: {
    label: string
    content?: React.ReactNode
    alwaysVisibleDescription?: React.ReactNode
    isExpandedDefault?: boolean
    isStacked?: boolean
    hasTeaser?: boolean
}) => {
    const [isOpen, setOpen] = useState(isExpandedDefault)

    const toggle = () => {
        setOpen(!isOpen)
    }

    return (
        <div
            className={cx("ExpandableToggle", {
                "ExpandableToggle--stacked": isStacked,
                "ExpandableToggle--open": isOpen,
                "ExpandableToggle--teaser": hasTeaser,
            })}
        >
            <button className="ExpandableToggle__button" onClick={toggle}>
                <h4 className="ExpandableToggle__title">{label}</h4>
                <FontAwesomeIcon
                    className="ExpandableToggle__icon"
                    icon={!isOpen ? faPlus : faMinus}
                />
            </button>
            {alwaysVisibleDescription && (
                <div className="ExpandableToggle__description">
                    {alwaysVisibleDescription}
                </div>
            )}
            <div className="ExpandableToggle__content">{content}</div>
        </div>
    )
}
