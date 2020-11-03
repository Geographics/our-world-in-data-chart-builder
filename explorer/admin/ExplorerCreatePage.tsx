import { observer } from "mobx-react"
import React from "react"
import { AdminLayout } from "adminSite/client/AdminLayout"
import {
    AdminAppContextType,
    AdminAppContext,
} from "adminSite/client/AdminAppContext"
import { SwitcherExplorer } from "explorer/client/SwitcherExplorer"
import { HotTable } from "@handsontable/react"
import { action, observable, computed } from "mobx"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import {
    DefaultExplorerProgram,
    ExplorerProgram,
    ProgramKeyword,
} from "explorer/client/ExplorerProgram"
import { readRemoteFile, writeRemoteFile } from "gitCms/client"
import { Prompt } from "react-router-dom"
import { Link } from "adminSite/client/Link"
import Handsontable from "handsontable"
import { CoreMatrix } from "coreTable/CoreTableConstants"
import { exposeInstanceOnWindow } from "grapher/utils/Util"

@observer
export class ExplorerCreatePage extends React.Component<{ slug: string }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @action componentDidMount() {
        this.context.admin.loadingIndicatorSetting = "off"
        this.fetchExplorerProgramOnLoad()
        exposeInstanceOnWindow(this, "explorerEditor")
    }

    @action componentWillUnmount() {
        this.context.admin.loadingIndicatorSetting = "default"
    }

    @action.bound private async fetchExplorerProgramOnLoad() {
        const response = await readRemoteFile({
            filepath: ExplorerProgram.fullPath(this.props.slug),
        })
        this.sourceOnDisk = response.content ?? DefaultExplorerProgram
        this.setProgram(this.sourceOnDisk)
    }

    @action.bound private setProgram(code: string) {
        this.program = new ExplorerProgram(this.program.slug, code)
        this.fetchChartConfigs(this.program.requiredChartIds)
    }

    @action.bound private async fetchChartConfigs(chartIds: number[]) {
        const missing = chartIds.filter((id) => !this.chartConfigs.has(id))
        if (!missing.length) return
        const response = await fetch(
            `/admin/api/charts/explorer-charts.json?chartIds=${chartIds.join(
                "~"
            )}`
        )
        const configs = await response.json()
        configs.forEach((config: any) =>
            this.chartConfigs.set(config.id, config)
        )
    }

    @observable chartConfigs: Map<number, GrapherInterface> = new Map()

    hotTableComponent = React.createRef<HotTable>()

    @action.bound private updateProgramFromHot() {
        const newVersion = this.hotTableComponent.current?.hotInstance.getData() as CoreMatrix
        if (!newVersion) return

        const newProgram = ExplorerProgram.fromMatrix(
            this.program.slug,
            newVersion
        )
        if (this.program.toString() === newProgram.toString()) return
        this.setProgram(newProgram.toString())
    }

    @observable sourceOnDisk = DefaultExplorerProgram

    @observable.ref program = new ExplorerProgram(this.props.slug, "")

    @action.bound async saveExplorer() {
        const slug = prompt("Slug for this explorer", this.program.slug)
        if (!slug) return
        this.context.admin.loadingIndicatorSetting = "loading"
        this.program.slug = slug
        await writeRemoteFile({
            filepath: this.program.fullPath,
            content: this.program.toString(),
        })
        this.context.admin.loadingIndicatorSetting = "off"
        this.sourceOnDisk = this.program.toString()
    }

    @computed get isModified() {
        return this.sourceOnDisk !== this.program.toString()
    }

    render() {
        const data = this.program.toArrays()

        // Highlight the active view
        const activeViewRowNumber =
            this.program.getLineIndex(ProgramKeyword.switcher) +
            this.program.switcherRuntime.selectedRowIndex +
            3
        const hotStyles = `.ht_master tr:nth-child(${activeViewRowNumber}) > td:nth-child(3) {
            outline: 3px dashed rgba(0,0,255,.5);
          }`

        const cells = function (row: number, column: number) {
            const cellProperties: Partial<Handsontable.CellProperties> = {}

            if (column === 0) {
                cellProperties.type = "autocomplete"
                cellProperties.source = Object.values(ProgramKeyword)
            }

            return cellProperties
        }

        const hotSettings: Handsontable.GridSettings = {
            afterChange: () => this.updateProgramFromHot(),
            allowInsertColumn: false,
            allowInsertRow: true,
            autoColumnSize: true,
            cells,
            colHeaders: false,
            contextMenu: true,
            data,
            manualColumnResize: [150, 200],
            minCols: 8,
            minRows: 20,
            minSpareRows: 20,
            rowHeaders: true,
            stretchH: "all",
            width: "100%",
            wordWrap: false,
        }

        return (
            <AdminLayout title="Create Explorer">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <style dangerouslySetInnerHTML={{ __html: hotStyles }}></style>
                <main style={{ padding: 0, position: "relative" }}>
                    <div
                        style={{
                            right: "15px",
                            top: "5px",
                            position: "absolute",
                            zIndex: 2,
                        }}
                    >
                        {this.isModified ? (
                            <button
                                className="btn btn-primary"
                                onClick={this.saveExplorer}
                            >
                                Save
                            </button>
                        ) : (
                            <button className="btn btn-secondary">
                                Unmodified
                            </button>
                        )}
                        <br />
                        <br />
                        <Link
                            target="preview"
                            to={`/explorers/preview/${this.program.slug}`}
                            className="btn btn-secondary"
                        >
                            Preview
                        </Link>
                    </div>
                    <div style={{ height: "500px", overflow: "scroll" }}>
                        <SwitcherExplorer
                            chartConfigs={Object.values(this.chartConfigs)}
                            explorerProgram={this.program}
                            explorerProgramCode={""}
                            slug={""}
                        />
                    </div>
                    <div>
                        <HotTable
                            settings={hotSettings}
                            ref={this.hotTableComponent as any}
                            licenseKey={"non-commercial-and-evaluation"}
                        />
                    </div>
                </main>
            </AdminLayout>
        )
    }
}
