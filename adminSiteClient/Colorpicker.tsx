import React from "react"
import { action, makeObservable } from "mobx";
import { SketchPicker } from "react-color"

import { lastOfNonEmptyArray } from "../clientUtils/Util.js"
import { ColorSchemes } from "../grapher/color/ColorSchemes.js"

interface ColorpickerProps {
    color?: string
    onColor: (color: string | undefined) => void
}

export class Colorpicker extends React.Component<ColorpickerProps> {
    constructor(props: ColorpickerProps) {
        super(props);

        makeObservable(this, {
            onColor: action.bound
        });
    }

    onColor(color: string) {
        if (color === "") {
            this.props.onColor(undefined)
        } else {
            this.props.onColor(color)
        }
    }

    render() {
        const scheme = ColorSchemes["owid-distinct"]
        const availableColors: string[] = lastOfNonEmptyArray(scheme.colorSets)

        return (
            <SketchPicker
                disableAlpha
                presetColors={availableColors}
                color={this.props.color}
                onChange={(color) => this.onColor(color.hex)}
            />
        )
    }
}
