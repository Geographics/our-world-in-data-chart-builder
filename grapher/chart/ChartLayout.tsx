import { Grapher } from "grapher/core/Grapher"
import React from "react"
import { computed } from "mobx"
import { Header, HeaderHTML } from "grapher/chart/Header"
import { SourcesFooter, SourcesFooterHTML } from "grapher/chart/Footer"
import { Bounds } from "grapher/utils/Bounds"
import { ControlsOverlayView } from "grapher/controls/Controls"
import { GrapherView } from "grapher/core/GrapherView"

interface ChartLayoutProps {
    grapher: Grapher
    grapherView: GrapherView
    bounds: Bounds
}

export class ChartLayout {
    props: ChartLayoutProps
    constructor(props: ChartLayoutProps) {
        this.props = props
    }

    @computed get paddedBounds() {
        return this.props.bounds.pad(15)
    }

    @computed get header() {
        const that = this
        return new Header({
            get grapher() {
                return that.props.grapher
            },
            get maxWidth() {
                return that.paddedBounds.width
            }
        })
    }

    @computed get footer() {
        const that = this
        return new SourcesFooter({
            get grapher() {
                return that.props.grapher
            },
            get maxWidth() {
                return that.paddedBounds.width
            }
        })
    }

    @computed get isExporting(): boolean {
        return !!this.props.grapher.isExporting
    }

    @computed get svgWidth() {
        if (this.isExporting) return this.props.bounds.width

        const { overlayPadding } = this.props.grapherView.controls
        return (
            this.props.bounds.width - overlayPadding.left - overlayPadding.right
        )
    }

    @computed get svgHeight() {
        if (this.isExporting) return this.props.bounds.height

        const { overlayPadding } = this.props.grapherView.controls
        return (
            this.props.bounds.height -
            this.header.height -
            this.footer.height -
            overlayPadding.top -
            overlayPadding.bottom -
            25
        )
    }

    @computed get innerBounds() {
        if (this.isExporting)
            return this.paddedBounds
                .padTop(this.header.height)
                .padBottom(this.footer.height)

        return new Bounds(0, 0, this.svgWidth, this.svgHeight).padWidth(15)
    }
}

export class ChartLayoutView extends React.Component<{
    layout: ChartLayout
    children: any
}> {
    @computed get svgStyle() {
        return {
            fontFamily: "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif",
            fontSize: this.props.layout.props.grapher.baseFontSize,
            backgroundColor: "white",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased"
        }
    }

    renderWithSVGText() {
        const { layout } = this.props
        const { paddedBounds } = layout

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                style={this.svgStyle as any}
                width={layout.svgWidth}
                height={layout.svgHeight}
                viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
            >
                {layout.header.render(paddedBounds.x, paddedBounds.y)}
                {this.props.children}
                {layout.footer.render(
                    paddedBounds.x,
                    paddedBounds.bottom - layout.footer.height
                )}
            </svg>
        )
    }

    renderWithHTMLText() {
        const { layout } = this.props
        const { grapher, grapherView } = layout.props

        return (
            <React.Fragment>
                <HeaderHTML grapher={grapher} header={layout.header} />
                <ControlsOverlayView
                    grapher={grapher}
                    grapherView={grapherView}
                    controls={grapherView.controls}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        version="1.1"
                        style={this.svgStyle as any}
                        width={layout.svgWidth}
                        height={layout.svgHeight}
                        viewBox={`0 0 ${layout.svgWidth} ${layout.svgHeight}`}
                    >
                        {this.props.children}
                    </svg>
                </ControlsOverlayView>
                <SourcesFooterHTML
                    grapher={layout.props.grapher}
                    footer={layout.footer}
                />
            </React.Fragment>
        )
    }

    render() {
        return this.props.layout.isExporting
            ? this.renderWithSVGText()
            : this.renderWithHTMLText()
    }
}
