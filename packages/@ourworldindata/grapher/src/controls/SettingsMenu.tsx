import React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faXmark, faGear } from "@fortawesome/free-solid-svg-icons"
import { EntityName, ChartTypeName, FacetStrategy } from "@ourworldindata/types"
import { SelectionArray } from "../selection/SelectionArray"
import { ChartDimension } from "../chart/ChartDimension"
import { makeSelectionArray } from "../chart/ChartUtils.js"
import { AxisConfig } from "../axis/AxisConfig"

import { AxisScaleToggle } from "./settings/AxisScaleToggle"
import { AbsRelToggle, AbsRelToggleManager } from "./settings/AbsRelToggle"
import { ZoomToggle, ZoomToggleManager } from "./settings/ZoomToggle"
import {
    FacetStrategySelector,
    FacetStrategySelectionManager,
} from "./settings/FacetStrategySelector"
import {
    FacetYDomainToggle,
    FacetYDomainToggleManager,
} from "./settings/FacetYDomainToggle"
import {
    NoDataAreaToggle,
    NoDataAreaToggleManager,
} from "./settings/NoDataAreaToggle"
import {
    TableFilterToggle,
    TableFilterToggleManager,
} from "./settings/TableFilterToggle"

const {
    LineChart,
    ScatterPlot,
    StackedArea,
    StackedDiscreteBar,
    StackedBar,
    Marimekko,
} = ChartTypeName

export interface SettingsMenuManager
    extends AbsRelToggleManager,
        NoDataAreaToggleManager,
        FacetYDomainToggleManager,
        ZoomToggleManager,
        TableFilterToggleManager,
        FacetStrategySelectionManager {
    // ArchieML directives
    hideFacetControl?: boolean
    hideRelativeToggle?: boolean
    hideEntityControls?: boolean
    hideZoomToggle?: boolean
    hideNoDataAreaToggle?: boolean
    hideFacetYDomainToggle?: boolean
    hideXScaleToggle?: boolean
    hideYScaleToggle?: boolean
    hideTableFilterToggle?: boolean

    // chart state
    type: ChartTypeName
    isRelativeMode?: boolean
    selection?: SelectionArray | EntityName[]
    canChangeAddOrHighlightEntities?: boolean
    filledDimensions: ChartDimension[]
    xColumnSlug?: string
    xOverrideTime?: number
    hasTimeline?: boolean
    canToggleRelativeMode: boolean
    isOnMapTab?: boolean
    isOnChartTab?: boolean
    isOnTableTab?: boolean

    // linear/log scales
    yAxis: AxisConfig
    xAxis: AxisConfig

    // TODO: show intermediate scatterplot points
    compareEndPointsOnly?: boolean
}

@observer
export class SettingsMenu extends React.Component<{
    manager: SettingsMenuManager
    top: number
    bottom: number
    right: number
}> {
    @observable.ref active: boolean = false
    contentRef: React.RefObject<HTMLDivElement> = React.createRef() // the menu contents & backdrop

    static shouldShow(manager: SettingsMenuManager): boolean {
        const test = new SettingsMenu({ manager, top: 0, bottom: 0, right: 0 })
        return test.showSettingsMenuToggle
    }

    @computed get showYScaleToggle(): boolean | undefined {
        if (this.manager.hideYScaleToggle) return false
        if (this.manager.isRelativeMode) return false
        if ([StackedArea, StackedBar].includes(this.manager.type)) return false // We currently do not have these charts with log scale
        return this.manager.yAxis.canChangeScaleType
    }

    @computed get showXScaleToggle(): boolean | undefined {
        if (this.manager.hideXScaleToggle) return false
        if (this.manager.isRelativeMode) return false
        return this.manager.xAxis.canChangeScaleType
    }

    @computed get showFacetYDomainToggle(): boolean {
        // don't offer to make the y range relative if the range is discrete
        return (
            !this.manager.hideFacetYDomainToggle &&
            this.manager.facetStrategy !== FacetStrategy.none &&
            this.manager.type !== StackedDiscreteBar
        )
    }

    @computed get showZoomToggle(): boolean {
        const { type, hideZoomToggle } = this.manager
        return (
            !hideZoomToggle &&
            type === ScatterPlot &&
            this.selectionArray.hasSelection
        )
    }

    @computed get showNoDataAreaToggle(): boolean {
        return (
            !this.manager.hideNoDataAreaToggle &&
            this.manager.type === Marimekko &&
            this.manager.xColumnSlug !== undefined
        )
    }

    @computed get showAbsRelToggle(): boolean {
        const { type, canToggleRelativeMode, hasTimeline, xOverrideTime } =
            this.manager
        if (!canToggleRelativeMode) return false
        if (type === ScatterPlot)
            return xOverrideTime === undefined && !!hasTimeline
        return [
            StackedArea,
            StackedBar,
            StackedDiscreteBar,
            ScatterPlot,
            LineChart,
            Marimekko,
        ].includes(type)
    }

    @computed get showFacetControl(): boolean {
        const {
            filledDimensions,
            availableFacetStrategies,
            hideFacetControl,
            isOnTableTab,
            type,
        } = this.manager

        // if there's no choice to be made, don't display a lone button
        if (availableFacetStrategies.length <= 1) return false

        // heuristic: if the chart doesn't make sense unfaceted, then it probably
        // also makes sense to let the user switch between entity/metric facets
        if (!availableFacetStrategies.includes(FacetStrategy.none)) return true

        const showFacetControlChartType = [
            StackedArea,
            StackedBar,
            StackedDiscreteBar,
            LineChart,
        ].includes(type)

        const hasProjection = filledDimensions.some(
            (dim) => dim.display.isProjection
        )

        return (
            showFacetControlChartType &&
            !hideFacetControl &&
            !hasProjection &&
            !isOnTableTab
        )
    }

    @computed get showTableFilterToggle(): boolean {
        const { hideTableFilterToggle, canChangeAddOrHighlightEntities } =
            this.manager
        return (
            this.selectionArray.hasSelection &&
            !!canChangeAddOrHighlightEntities &&
            !hideTableFilterToggle
        )
    }

    @computed get showSettingsMenuToggle(): boolean {
        if (this.manager.isOnMapTab) return false
        if (this.manager.isOnTableTab) return this.showTableFilterToggle

        return !!(
            this.showYScaleToggle ||
            this.showXScaleToggle ||
            this.showFacetYDomainToggle ||
            this.showZoomToggle ||
            this.showNoDataAreaToggle ||
            this.showFacetControl ||
            this.showAbsRelToggle
        )

        // TODO: add a showCompareEndPointsOnlyToggle to complement compareEndPointsOnly
    }

    componentDidMount(): void {
        document.addEventListener("keydown", this.onDocumentKeyDown)
        document.addEventListener("click", this.onDocumentClick, {
            capture: true,
        })
    }

    componentWillUnmount(): void {
        document.removeEventListener("keydown", this.onDocumentKeyDown)
        document.removeEventListener("click", this.onDocumentClick)
    }

    @action.bound onDocumentKeyDown(e: KeyboardEvent): void {
        // dismiss menu on esc
        if (this.active && e.key === "Escape") this.toggleVisibility()
    }

    @action.bound onDocumentClick(e: MouseEvent): void {
        if (
            this.active &&
            this.contentRef?.current &&
            !this.contentRef.current.contains(e.target as Node) &&
            document.contains(e.target as Node)
        )
            this.toggleVisibility()
    }

    @action.bound toggleVisibility(): void {
        this.active = !this.active
    }

    @computed get manager(): SettingsMenuManager {
        return this.props.manager
    }

    @computed get chartType(): string {
        const { type } = this.manager
        return type.replace(/([A-Z])/g, " $1")
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed get layout(): { maxHeight: string; top: number; right: number } {
        const { top, bottom, right } = this.props,
            maxHeight = `calc(100% - ${top + bottom}px)`
        return { maxHeight, top, right }
    }

    @computed get menu(): JSX.Element | void {
        if (this.active) {
            return this.menuContents
        }
    }

    @computed get menuContents(): JSX.Element {
        const {
            manager,
            chartType,
            showYScaleToggle,
            showXScaleToggle,
            showZoomToggle,
            showNoDataAreaToggle,
            showFacetControl,
            showFacetYDomainToggle,
            showAbsRelToggle,
        } = this

        const {
            yAxis,
            xAxis,
            // compareEndPointsOnly,
            filledDimensions,
            isOnTableTab,
            isOnChartTab,
        } = manager

        const yLabel =
                filledDimensions.find((d: ChartDimension) => d.property === "y")
                    ?.display.name ?? "Y axis",
            xLabel =
                filledDimensions.find((d: ChartDimension) => d.property === "x")
                    ?.display.name ?? "X axis",
            omitLoneAxisLabel =
                showYScaleToggle && !showXScaleToggle && yLabel === "Y axis"

        const menuTitle = `${isOnTableTab ? "Table" : chartType} settings`

        return (
            <div className="settings-menu-contents" ref={this.contentRef}>
                <div
                    className="settings-menu-backdrop"
                    onClick={this.toggleVisibility}
                ></div>
                <div
                    className="settings-menu-controls"
                    style={{
                        ...this.layout,
                    }}
                >
                    <div className="config-header">
                        <div className="config-title">{menuTitle}</div>
                        <button
                            className="clickable close"
                            onClick={this.toggleVisibility}
                        >
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    <SettingsGroup
                        title="Chart view"
                        active={
                            isOnChartTab &&
                            (showAbsRelToggle ||
                                showZoomToggle ||
                                showNoDataAreaToggle ||
                                showFacetControl ||
                                showFacetYDomainToggle)
                        }
                    >
                        {showFacetControl && (
                            <FacetStrategySelector manager={manager} />
                        )}
                        {showFacetYDomainToggle && (
                            <FacetYDomainToggle manager={manager} />
                        )}
                        {showAbsRelToggle && <AbsRelToggle manager={manager} />}
                        {showNoDataAreaToggle && (
                            <NoDataAreaToggle manager={manager} />
                        )}
                        {showZoomToggle && <ZoomToggle manager={manager} />}
                    </SettingsGroup>
                    <SettingsGroup
                        title="Axis scale"
                        active={
                            isOnChartTab &&
                            (showYScaleToggle || showXScaleToggle)
                        }
                    >
                        {showYScaleToggle && (
                            <AxisScaleToggle
                                axis={yAxis!}
                                subtitle={omitLoneAxisLabel ? "" : yLabel}
                            />
                        )}
                        {showXScaleToggle && (
                            <AxisScaleToggle axis={xAxis!} subtitle={xLabel} />
                        )}
                        <div className="config-subtitle">
                            A linear scale evenly spaces values, where each
                            increment represents a consistent change. A
                            logarithmic scale uses multiples of the starting
                            value, with each increment representing the same
                            percentage increase.
                        </div>
                    </SettingsGroup>
                </div>
            </div>
        )
    }

    renderChartSettings(): JSX.Element {
        const { active } = this
        return (
            <div className="settings-menu">
                <button
                    className={classnames("menu-toggle", { active })}
                    onClick={this.toggleVisibility}
                    data-track-note="chart_settings_menu_toggle"
                    title="Chart settings"
                    aria-label="Chart settings"
                >
                    <FontAwesomeIcon icon={faGear} />
                    <span className="label"> Settings</span>
                </button>
                {this.menu}
            </div>
        )
    }

    renderTableControls(): JSX.Element {
        // Since tables only have a single control, display it inline rather than
        // placing it in the settings menu
        return <TableFilterToggle manager={this.manager} />
    }

    render(): JSX.Element | null {
        const {
            manager: { isOnChartTab, isOnTableTab },
            showSettingsMenuToggle,
            showTableFilterToggle,
        } = this

        return isOnTableTab && showTableFilterToggle
            ? this.renderTableControls()
            : isOnChartTab && showSettingsMenuToggle
            ? this.renderChartSettings()
            : null
    }
}

@observer
class SettingsGroup extends React.Component<{
    title: string
    subtitle?: string
    active?: boolean
    children?: React.ReactNode
}> {
    render(): JSX.Element | null {
        const { active, title, subtitle, children } = this.props
        if (!active) return null

        return (
            <section>
                <div className="config-name">{title}</div>
                {subtitle && <div className="config-subtitle">{subtitle}</div>}
                {children}
            </section>
        )
    }
}
