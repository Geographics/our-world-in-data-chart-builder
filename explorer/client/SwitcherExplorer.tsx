import React from "react"
import { observer } from "mobx-react"
import { action, observable, computed, autorun, when } from "mobx"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { ExplorerControlPanel } from "explorer/client/ExplorerControls"
import ReactDOM from "react-dom"
import {
    UrlBinder,
    ObservableUrl,
    MultipleUrlBinder,
} from "grapher/utils/UrlBinder"
import { ExplorerShell } from "./ExplorerShell"
import { ExplorerProgram } from "./ExplorerProgram"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"
import { GrapherProgrammaticInterface } from "grapher/core/Grapher"
import { exposeInstanceOnWindow } from "grapher/utils/Util"
import {
    SlideShowController,
    SlideShowManager,
} from "grapher/slideshowController/SlideShowController"
import { OwidRow } from "coreTable/OwidTableConstants"
import { ExplorerContainerId } from "./ExplorerConstants"
import { CountryPickerManager } from "grapher/controls/countryPicker/CountryPickerConstants"

export interface SwitcherExplorerProps {
    explorerProgramCode: string
    slug: string
    chartConfigs?: GrapherInterface[]
    bindToWindow?: boolean
    queryString?: string
}

@observer
export class SwitcherExplorer
    extends React.Component<SwitcherExplorerProps>
    implements ObservableUrl, SlideShowManager, CountryPickerManager {
    static bootstrap(props: SwitcherExplorerProps) {
        return ReactDOM.render(
            <SwitcherExplorer
                {...props}
                queryString={window.location.search}
            />,
            document.getElementById(ExplorerContainerId)
        )
    }

    private urlBinding?: UrlBinder

    private explorerProgram = new ExplorerProgram(
        this.props.slug,
        this.props.explorerProgramCode,
        this.props.queryString
    )

    @observable hideControls = false

    @computed get params(): QueryParams {
        const params: any = {}
        params.hideControls = this.hideControls ? true : undefined
        params.country = EntityUrlBuilder.entitiesToQueryParam(
            this.countryPickerTable.selectedEntityNames
        )
        return params as QueryParams
    }

    @computed get chartConfigs() {
        const arr = this.props.chartConfigs || []
        const chartConfigsMap: Map<number, GrapherInterface> = new Map()
        arr.forEach((config) => chartConfigsMap.set(config.id!, config))
        return chartConfigsMap
    }

    // The country picker can have entities not present in all charts
    @action.bound private async addEntityOptionsToPickerWhenReady() {
        if (!this.grapher) return
        await this.grapher.whenReady()
        this.addEntityOptionsToPicker()
    }

    @action.bound private addEntityOptionsToPicker() {
        if (!this.grapher) return
        const currentEntities = this.countryPickerTable.availableEntityNameSet
        const newEntities = this.grapher.inputTable.availableEntityNameSet
        const missingEntities = [...newEntities]
            .filter((entityName) => !currentEntities.has(entityName))
            .map((entityName) => {
                return {
                    entityName,
                } as OwidRow
            })
        this.countryPickerTable = this.countryPickerTable.appendRows(
            missingEntities,
            `Added ${missingEntities.length} entity names to Country Picker`
        ) as OwidTable
        this.countryPickerTable.addToSelection(
            this.grapher.inputTable.selectedEntityNames
        )
    }

    @computed get grapher() {
        return this.explorerRef.current?.grapherRef?.current
    }

    componentDidMount() {
        autorun(() =>
            this.updateGrapher(this.explorerProgram.switcherRuntime.chartId)
        )

        when(
            () => !!this.grapher,
            () => {
                this.updateGrapher(this.explorerProgram.switcherRuntime.chartId)
            }
        )

        autorun(() => {
            this.updateSelection(this.countryPickerTable.selectedEntityNames)
        })

        exposeInstanceOnWindow(this, "switcherExplorer")
    }

    @action.bound private updateSelection(entityNames: string[]) {
        if (!this.countryPickerTable.numRows) return
        if (this.grapher)
            this.grapher.inputTable.setSelectedEntities(entityNames)
    }

    @action.bound private updateGrapher(newGrapherId: number) {
        const grapher = this.grapher
        if (!grapher || grapher.id === newGrapherId) return

        const config: GrapherProgrammaticInterface = {
            ...this.chartConfigs.get(newGrapherId)!,
            hideEntityControls: !this.hideControls && !this.isEmbed,
            dropUnchangedUrlParams: false,
        }

        grapher.hasError = false
        const queryStr = grapher.id
            ? grapher.queryStr
            : this.explorerProgram.queryString

        if (!grapher.slideShow)
            grapher.slideShow = new SlideShowController(
                this.explorerProgram.switcherRuntime.allOptionsAsQueryStrings(),
                0,
                this
            )

        grapher.updateFromObject(config)
        grapher.inputTable = BlankOwidTable()
        grapher.populateFromQueryParams(strToQueryParams(queryStr ?? ""))
        grapher.downloadData()
        this.addEntityOptionsToPickerWhenReady()
        this.bindToWindow()
    }

    @action.bound setSlide(queryString: string) {
        this.explorerProgram.switcherRuntime.setValuesFromQueryString(
            queryString
        )
    }

    bindToWindow() {
        if (!this.props.bindToWindow || !this.grapher) return

        if (this.urlBinding) this.urlBinding.unbindFromWindow()
        else this.urlBinding = new UrlBinder()
        this.urlBinding.bindToWindow(
            new MultipleUrlBinder([
                this.grapher,
                this.explorerProgram.switcherRuntime,
                this,
            ])
        )
    }

    @observable.ref countryPickerTable = BlankOwidTable()

    private get panels() {
        return this.explorerProgram.switcherRuntime.choicesWithAvailability.map(
            (choice) => (
                <ExplorerControlPanel
                    key={choice.title}
                    value={choice.value}
                    title={choice.title}
                    explorerSlug={this.explorerProgram.slug}
                    name={choice.title}
                    options={choice.options}
                    type={choice.type}
                    onChange={(value) => {
                        this.explorerProgram.switcherRuntime.setValue(
                            choice.title,
                            value
                        )
                    }}
                />
            )
        )
    }

    private get header() {
        return (
            <>
                <div></div>
                <div className="ExplorerTitle">
                    {this.explorerProgram.title}
                </div>
                <div
                    className="ExplorerSubtitle"
                    dangerouslySetInnerHTML={{
                        __html: this.explorerProgram.subtitle || "",
                    }}
                ></div>
            </>
        )
    }

    //todo
    private get isEmbed() {
        return false
    }

    @observable.ref explorerRef: React.RefObject<
        ExplorerShell
    > = React.createRef()

    render() {
        return (
            <ExplorerShell
                headerElement={this.header}
                controlPanels={this.panels}
                explorerSlug={this.explorerProgram.slug}
                countryPickerManager={this}
                hideControls={this.hideControls}
                isEmbed={this.isEmbed}
                enableKeyboardShortcuts={!this.isEmbed}
                ref={this.explorerRef}
            />
        )
    }
}
