import React from "react"
import { action, makeObservable } from "mobx";
import { observer } from "mobx-react"
import { ScaleType } from "../core/GrapherConstants.js"
import classNames from "classnames"
import { next } from "../../clientUtils/Util.js"

export interface ScaleSelectorManager {
    scaleType?: ScaleType
}

export const ScaleSelector = observer(class ScaleSelector extends React.Component<{
    manager?: ScaleSelectorManager
    prefix?: string
}> {
    constructor(
        props: {
            manager?: ScaleSelectorManager
            prefix?: string
        }
    ) {
        super(props);

        makeObservable<ScaleSelector, "onClick">(this, {
            onClick: action.bound
        });
    }

    private onClick(): void {
        const manager = this.props.manager ?? {}
        manager.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            manager.scaleType ?? ScaleType.linear
        )
    }

    render(): JSX.Element {
        const { manager, prefix } = this.props
        const { scaleType } = manager ?? {}
        return (
            <span
                onClick={this.onClick}
                className={classNames(["clickable", "toggleSwitch"])}
            >
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "leftToggle " +
                        (scaleType === ScaleType.linear ? "activeToggle" : "")
                    }
                >
                    {prefix}Linear
                </span>
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "rightToggle " +
                        (scaleType === ScaleType.log ? "activeToggle" : "")
                    }
                >
                    {prefix}Log
                </span>
            </span>
        )
    }
});
