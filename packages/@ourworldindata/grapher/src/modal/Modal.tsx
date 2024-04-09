import React from "react"
import cx from "classnames"
import { observer } from "mobx-react"
import { action, computed } from "mobx"
import { Bounds } from "@ourworldindata/utils"
import { CloseButton } from "../closeButton/CloseButton.js"
import { GRAPHER_SCROLLABLE_CONTAINER_CLASS } from "../core/GrapherConstants.js"

@observer
export class Modal extends React.Component<{
    bounds: Bounds
    onDismiss: () => void
    title?: string
    children?: React.ReactNode
    isHeightFixed?: boolean // by default, the modal height is not fixed but fits to the content
    alignVertical?: "center" | "bottom"
    showStickyHeader?: boolean
}> {
    contentRef: React.RefObject<HTMLDivElement> = React.createRef()

    @computed private get bounds(): Bounds {
        return this.props.bounds
    }

    @computed private get title(): string | undefined {
        return this.props.title
    }

    @computed private get isHeightFixed(): boolean {
        return this.props.isHeightFixed ?? false
    }

    @computed private get alignVertical(): "center" | "bottom" {
        return this.props.alignVertical ?? "center"
    }

    @computed private get showStickyHeader(): boolean {
        return this.props.showStickyHeader || !!this.title
    }

    @action.bound onDocumentClick(e: MouseEvent): void {
        const tagName = (e.target as HTMLElement).tagName
        const isTargetInteractive = ["A", "BUTTON", "INPUT"].includes(tagName)
        if (
            this.contentRef?.current &&
            !this.contentRef.current.contains(e.target as Node) &&
            // clicking on an interactive element should not dismiss the modal
            // (this is especially important for the suggested chart review tool)
            !isTargetInteractive &&
            // check that the target is still mounted to the document; we also get click events on nodes that have since been removed by React
            document.contains(e.target as Node)
        )
            this.props.onDismiss()
    }

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") this.props.onDismiss()
    }

    componentDidMount(): void {
        document.addEventListener("click", this.onDocumentClick)
        document.addEventListener("keydown", this.onDocumentKeyDown)
    }

    componentWillUnmount(): void {
        document.removeEventListener("click", this.onDocumentClick)
        document.removeEventListener("keydown", this.onDocumentKeyDown)
    }

    render(): JSX.Element {
        const { bounds } = this

        const contentStyle: React.CSSProperties = {
            left: bounds.left,
            width: bounds.width,
            maxHeight: bounds.height,
        }

        if (this.isHeightFixed) {
            contentStyle.height = bounds.height
        }

        if (this.alignVertical === "bottom") {
            contentStyle.bottom = bounds.y
        } else {
            contentStyle.top = "50%"
            contentStyle.transform = "translateY(-50%)"
        }

        return (
            <div className="modal-overlay">
                <div className="modal-wrapper">
                    <div
                        className="modal-content"
                        style={contentStyle}
                        ref={this.contentRef}
                    >
                        {this.showStickyHeader ? (
                            <div className="modal-header">
                                <h2 className="grapher_h5-black-caps grapher_light">
                                    {this.title}
                                </h2>
                                <CloseButton onClick={this.props.onDismiss} />
                            </div>
                        ) : (
                            <CloseButton
                                className="close-button--top-right"
                                onClick={this.props.onDismiss}
                            />
                        )}
                        <div
                            className={cx(
                                "modal-scrollable",
                                GRAPHER_SCROLLABLE_CONTAINER_CLASS
                            )}
                        >
                            {this.props.children}
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}
