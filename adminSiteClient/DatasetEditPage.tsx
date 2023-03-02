import React from "react"
import { observer } from "mobx-react"
import { observable, computed, runInAction, action } from "mobx"
import * as lodash from "lodash"
import { Prompt, Redirect } from "react-router-dom"
import filenamify from "filenamify"

import { OwidSource } from "@ourworldindata/utils"

import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import {
    BindString,
    Toggle,
    FieldsRow,
    EditableTags,
    Timeago,
} from "./Forms.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { Tag } from "./TagBadge.js"
import { VariableList, VariableListItem } from "./VariableList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload"
import { faGithub } from "@fortawesome/free-brands-svg-icons/faGithub"

interface DatasetPageData {
    id: number
    name: string
    description: string
    namespace: string
    isPrivate: boolean
    nonRedistributable: boolean

    dataEditedAt: Date
    dataEditedByUserId: number
    dataEditedByUserName: string

    metadataEditedAt: Date
    metadataEditedByUserId: number
    metadataEditedByUserName: string

    availableTags: { id: number; name: string; parentName: string }[]
    tags: { id: number; name: string }[]
    variables: VariableListItem[]
    charts: ChartListItem[]
    source: OwidSource
    zipFile?: { filename: string }
}

class DatasetEditable {
    @observable name: string = ""
    @observable description: string = ""
    @observable isPrivate: boolean = false
    @observable nonRedistributable: boolean = false

    @observable source: OwidSource = {
        id: -1,
        name: "",
        dataPublishedBy: "",
        dataPublisherSource: "",
        link: "",
        retrievedDate: "",
        additionalInfo: "",
    }

    @observable tags: Tag[] = []

    constructor(json: DatasetPageData) {
        for (const key in this) {
            if (key in json) {
                if (key === "tags") this.tags = lodash.clone(json.tags)
                else this[key] = (json as any)[key]
            }
        }
    }
}

@observer
class DatasetTagEditor extends React.Component<{
    newDataset: DatasetEditable
    availableTags: { id: number; name: string; parentName: string }[]
    isBulkImport: boolean
}> {
    @action.bound onSaveTags(tags: Tag[]) {
        this.props.newDataset.tags = tags
    }

    render() {
        const { newDataset, availableTags } = this.props

        return (
            <div className="form-group">
                <label>Tags</label>
                <EditableTags
                    tags={newDataset.tags}
                    suggestions={availableTags}
                    onSave={this.onSaveTags}
                />
            </div>
        )
    }
}

@observer
class DatasetEditor extends React.Component<{ dataset: DatasetPageData }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable newDataset!: DatasetEditable
    @observable isDeleted: boolean = false

    // HACK (Mispy): Force variable refresh when dataset metadata is updated
    @observable timesUpdated: number = 0

    // Store the original dataset to determine when it is modified
    UNSAFE_componentWillMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        this.newDataset = new DatasetEditable(this.props.dataset)
        this.isDeleted = false
    }

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.newDataset) !==
            JSON.stringify(new DatasetEditable(this.props.dataset))
        )
    }

    async save() {
        const { dataset } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}`,
            { dataset: this.newDataset },
            "PUT"
        )

        if (json.success) {
            runInAction(() => {
                Object.assign(this.props.dataset, this.newDataset)
                this.timesUpdated += 1
            })
        }
    }

    async delete() {
        const { dataset } = this.props
        if (
            !window.confirm(
                `Really delete the dataset ${dataset.name}? This action cannot be undone!`
            )
        )
            return

        const json = await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}`,
            {},
            "DELETE"
        )

        if (json.success) {
            this.isDeleted = true
        }
    }

    async archive() {
        const { dataset } = this.props
        if (
            !window.confirm(
                `Are you sure you want to archive: ${dataset.name}?`
            )
        ) {
            return
        }
        await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}/setArchived`,
            {},
            "POST"
        )
    }

    async republishCharts() {
        const { dataset } = this.props
        if (
            !window.confirm(
                `Are you sure you want to republish all charts in ${dataset.name}?`
            )
        ) {
            return
        }

        await this.context.admin.requestJSON(
            `/api/datasets/${dataset.id}/charts`,
            { republish: true },
            "POST"
        )
    }

    @computed get gitHistoryUrl() {
        return `https://github.com/${
            this.context.admin.settings.GITHUB_USERNAME
        }/owid-datasets/tree/master/datasets/${encodeURIComponent(
            filenamify(this.props.dataset.name)
        )}`
    }

    @computed get zipFileUrl() {
        return "/"
    }

    async uploadZip(file: File) {
        const json = await this.context.admin.requestJSON(
            `/api/datasets/${this.props.dataset.id}/uploadZip`,
            file,
            "PUT"
        )
        if (json.success) {
            this.props.dataset.zipFile = { filename: file.name }
        }
    }

    @action.bound onChooseZip(ev: { target: HTMLInputElement }) {
        if (!ev.target.files) return

        const file = ev.target.files[0]
        this.uploadZip(file)
    }

    @action.bound startChooseZip() {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".zip"
        input.addEventListener("change", this.onChooseZip as any)
        input.click()
    }

    render() {
        if (this.isDeleted) return <Redirect to="/datasets" />

        const { dataset } = this.props
        const { newDataset } = this
        const isBulkImport = dataset.namespace !== "owid"

        return (
            <main className="DatasetEditPage">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <section>
                    <h1>{dataset.name}</h1>
                    <p>
                        Uploaded{" "}
                        <Timeago
                            time={dataset.dataEditedAt}
                            by={dataset.dataEditedByUserName}
                        />
                    </p>
                    <Link
                        native
                        to={`/datasets/${dataset.id}.csv`}
                        className="btn btn-primary"
                    >
                        <FontAwesomeIcon icon={faDownload} /> Download CSV
                    </Link>
                    {!isBulkImport && !dataset.isPrivate && (
                        <a
                            href={this.gitHistoryUrl}
                            target="_blank"
                            className="btn btn-secondary"
                            rel="noopener"
                        >
                            <FontAwesomeIcon icon={faGithub} /> View on GitHub
                        </a>
                    )}
                    {dataset.zipFile && (
                        <Link
                            native
                            to={`/datasets/${dataset.id}/downloadZip`}
                            className="btn btn-secondary"
                        >
                            <FontAwesomeIcon icon={faDownload} />{" "}
                            additional-material.zip
                        </Link>
                    )}
                    {!isBulkImport && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.startChooseZip}
                        >
                            <FontAwesomeIcon icon={faUpload} />{" "}
                            {dataset.zipFile ? "Overwrite Zip" : "Upload Zip"}
                        </button>
                    )}
                </section>
                <section>
                    <h3>Dataset metadata</h3>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault()
                            this.save()
                        }}
                    >
                        {isBulkImport ? (
                            <p>
                                This dataset came from an automated import, so
                                we can't change the original metadata manually.
                            </p>
                        ) : (
                            <p>
                                The core metadata for the dataset. It's
                                important to keep this in a standardized style
                                across datasets.
                            </p>
                        )}
                        <div className="row">
                            <div className="col">
                                <BindString
                                    field="name"
                                    store={newDataset}
                                    label="Name"
                                    disabled={isBulkImport}
                                    helpText="Short name for this dataset, followed by the source and year. Example: Government Revenue Data – ICTD (2016)"
                                />
                                <BindString
                                    field="additionalInfo"
                                    store={newDataset.source}
                                    label="Description"
                                    textarea
                                    disabled={isBulkImport}
                                    helpText="Describe the dataset and the methodology used in its construction. This can be as long and detailed as you like."
                                    rows={10}
                                />
                                <BindString
                                    field="link"
                                    store={newDataset.source}
                                    label="Link"
                                    disabled={isBulkImport}
                                    helpText="Link to the publication from which we retrieved this data"
                                />
                                <BindString
                                    field="retrievedDate"
                                    store={newDataset.source}
                                    label="Retrieved"
                                    disabled={isBulkImport}
                                    helpText="Date when this data was obtained by us. Date format should always be YYYY-MM-DD."
                                />
                                <DatasetTagEditor
                                    newDataset={newDataset}
                                    availableTags={dataset.availableTags}
                                    isBulkImport={isBulkImport}
                                />
                                <FieldsRow>
                                    <Toggle
                                        label="Is publishable (include in exported OWID collection)"
                                        value={!newDataset.isPrivate}
                                        onValue={(v) =>
                                            (newDataset.isPrivate = !v)
                                        }
                                        disabled={
                                            isBulkImport ||
                                            newDataset.nonRedistributable
                                        }
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <Toggle
                                        label="Redistribution is prohibited (disable chart data download)"
                                        value={newDataset.nonRedistributable}
                                        onValue={(v) => {
                                            newDataset.nonRedistributable = v
                                            if (v) newDataset.isPrivate = true
                                        }}
                                        disabled={isBulkImport}
                                    />
                                </FieldsRow>
                            </div>

                            <div className="col">
                                <BindString
                                    field="name"
                                    store={newDataset.source}
                                    label="Source name"
                                    disabled={isBulkImport}
                                    helpText={`Short citation of the main sources, to be displayed on the charts. Additional sources (e.g. population denominator) should not be included. Use semi-colons to separate multiple sources e.g. "UN (2022); World Bank (2022)". For institutional datasets or reports, use "Institution, Project (year or vintage)" e.g. "IHME, Global Burden of Disease (2019)". For data we have modified extensively, use "Our World in Data based on X (year)" e.g. "Our World in Data based on Pew Research Center (2022)". For academic papers, use "Authors (year)" e.g. "Arroyo-Abad and Lindert (2016)".`}
                                />

                                <BindString
                                    field="dataPublishedBy"
                                    store={newDataset.source}
                                    label="Data published by"
                                    disabled={isBulkImport}
                                    helpText={`Full citation of main and additional sources. For academic papers, institutional datasets, and reports, use the complete citation recommended by the publisher. For data we have modified extensively, use "Our World in Data based on X (year) and Y (year)" e.g. "Our World in Data based on Pew Research Center (2022) and UN (2022)".`}
                                />
                                <BindString
                                    field="dataPublisherSource"
                                    store={newDataset.source}
                                    label="Data publisher's source"
                                    disabled={isBulkImport}
                                    helpText={`Optional field. Basic indication of how the publisher collected this data e.g. "Survey data". Anything longer than a line should go in the dataset description.`}
                                />
                                <BindString
                                    field="description"
                                    store={newDataset}
                                    label="Internal notes"
                                    textarea
                                    disabled={isBulkImport}
                                />
                            </div>
                        </div>
                        {!isBulkImport && (
                            <input
                                type="submit"
                                className="btn btn-success"
                                value="Update dataset"
                            />
                        )}
                    </form>
                </section>
                <section>
                    <h3>Variables</h3>
                    <VariableList variables={dataset.variables} />
                </section>
                <section>
                    <button
                        className="btn btn-primary float-right"
                        onClick={() => this.republishCharts()}
                    >
                        Republish all charts
                    </button>
                    <h3>Charts</h3>
                    <ChartList charts={dataset.charts} />
                </section>
                {!isBulkImport && (
                    <section>
                        <h3>Danger zone</h3>
                        <p>
                            Delete this dataset and all variables it contains.
                            If there are any charts using this data, you must
                            delete them individually first.
                        </p>
                        <p>
                            Before you archive or delete a dataset, please
                            ensure that this dataset is not used in ETL via
                            backporting. At some point this check will be done
                            automatically, but currently the ETL is not visible
                            inside the Grapher admin.
                        </p>
                        <div className="card-footer">
                            <button
                                className="btn btn-danger mr-3"
                                onClick={() => this.delete()}
                            >
                                Delete dataset
                            </button>
                            <button
                                className="btn btn-outline-danger"
                                onClick={() => this.archive()}
                            >
                                Archive dataset
                            </button>
                        </div>
                    </section>
                )}
            </main>
        )
    }
}

@observer
export class DatasetEditPage extends React.Component<{ datasetId: number }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType
    @observable dataset?: DatasetPageData

    render() {
        return (
            <AdminLayout title={this.dataset && this.dataset.name}>
                {this.dataset && <DatasetEditor dataset={this.dataset} />}
            </AdminLayout>
        )
    }

    async getData() {
        const json = await this.context.admin.getJSON(
            `/api/datasets/${this.props.datasetId}.json`
        )
        runInAction(() => {
            this.dataset = json.dataset as DatasetPageData
        })
    }

    componentDidMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        this.getData()
    }
}
