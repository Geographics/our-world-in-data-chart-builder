import React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    autorun,
    IReactionDisposer,
} from "mobx"
import * as lodash from "lodash"
import { Prompt, Redirect } from "react-router-dom"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { BindString, BindFloat, FieldsRow, Toggle } from "./Forms.js"
import {
    OwidVariableWithDataAndSource,
    OwidVariableDisplayConfig,
    DimensionProperty,
    EPOCH_DATE,
} from "@ourworldindata/utils"
import { GrapherFigureView } from "../site/GrapherFigureView.js"
import { ChartList, ChartListItem } from "./ChartList.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { Base64 } from "js-base64"
import {
    Grapher,
    GrapherTabOption,
    GrapherInterface,
} from "@ourworldindata/grapher"

interface VariablePageData
    extends Omit<OwidVariableWithDataAndSource, "source"> {
    datasetNamespace: string
    charts: ChartListItem[]
    source: { id: number; name: string }
}

class VariableEditable
    implements
        Omit<
            OwidVariableWithDataAndSource,
            "id" | "values" | "years" | "entities"
        >
{
    @observable name = ""
    @observable unit = ""
    @observable shortUnit = ""
    @observable description = ""
    @observable entityAnnotationsMap = ""
    @observable display = new OwidVariableDisplayConfig()

    constructor(json: any) {
        for (const key in this) {
            if (key === "display") lodash.extend(this.display, json.display)
            else this[key] = json[key]
        }
    }
}

// XXX refactor with DatasetEditPage
@observer
class VariableEditor extends React.Component<{ variable: VariablePageData }> {
    @observable newVariable!: VariableEditable
    @observable isDeleted: boolean = false

    // Store the original dataset to determine when it is modified
    UNSAFE_componentWillMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        this.newVariable = new VariableEditable(this.props.variable)
        this.isDeleted = false
    }

    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable.ref grapher?: Grapher

    @computed get isModified(): boolean {
        return (
            JSON.stringify(this.newVariable) !==
            JSON.stringify(new VariableEditable(this.props.variable))
        )
    }

    render() {
        const { variable } = this.props
        const { newVariable } = this
        const isDisabled = true

        if (this.isDeleted)
            return <Redirect to={`/datasets/${variable.datasetId}`} />

        return (
            <main className="VariableEditPage">
                <Prompt
                    when={this.isModified}
                    message="Are you sure you want to leave? Unsaved changes will be lost."
                />
                <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                        {variable.datasetNamespace}
                    </li>
                    <li className="breadcrumb-item">
                        <Link to={`/datasets/${variable.datasetId}`}>
                            {variable.datasetName}
                        </Link>
                    </li>
                    <li className="breadcrumb-item active">{variable.name}</li>
                </ol>
                <div className="row">
                    <div className="col">
                        <form>
                            <section>
                                <h3>Indicator metadata</h3>
                                <p>
                                    Metadata is non-editable and can be only
                                    changed in ETL.
                                </p>
                                <BindString
                                    field="name"
                                    store={newVariable}
                                    label="Indicator Name"
                                    disabled={isDisabled}
                                />
                                <BindString
                                    label="Display name"
                                    field="name"
                                    store={newVariable.display}
                                    disabled={isDisabled}
                                />
                                <FieldsRow>
                                    <BindString
                                        label="Unit of measurement"
                                        field="unit"
                                        store={newVariable.display}
                                        placeholder={newVariable.unit}
                                        disabled={isDisabled}
                                    />
                                    <BindString
                                        label="Short (axis) unit"
                                        field="shortUnit"
                                        store={newVariable.display}
                                        placeholder={newVariable.shortUnit}
                                        disabled={isDisabled}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <BindFloat
                                        label="Number of decimal places"
                                        field="numDecimalPlaces"
                                        store={newVariable.display}
                                        helpText={`A negative number here will round integers`}
                                        disabled={isDisabled}
                                    />
                                    <BindFloat
                                        label="Unit conversion factor"
                                        field="conversionFactor"
                                        store={newVariable.display}
                                        helpText={`Multiply all values by this amount`}
                                        disabled={isDisabled}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <Toggle
                                        value={
                                            newVariable.display.yearIsDay ===
                                            true
                                        }
                                        onValue={(value) =>
                                            (newVariable.display.yearIsDay =
                                                value)
                                        }
                                        label="Treat year column as day series"
                                        disabled={isDisabled}
                                    />
                                    <BindString
                                        label="Zero Day as YYYY-MM-DD"
                                        field="zeroDay"
                                        store={newVariable.display}
                                        // disabled={
                                        //     !newVariable.display.yearIsDay
                                        // }
                                        disabled={isDisabled}
                                        placeholder={
                                            newVariable.display.yearIsDay
                                                ? EPOCH_DATE
                                                : ""
                                        }
                                        helpText={`The day series starts on this date.`}
                                    />
                                </FieldsRow>
                                <FieldsRow>
                                    <Toggle
                                        value={
                                            newVariable.display
                                                .includeInTable === true
                                        }
                                        onValue={(value) =>
                                            (newVariable.display.includeInTable =
                                                value)
                                        }
                                        label="Include in table"
                                        disabled={isDisabled}
                                    />
                                </FieldsRow>
                                <BindString
                                    field="description"
                                    store={newVariable}
                                    label="Description"
                                    textarea
                                    disabled={isDisabled}
                                />
                                <BindString
                                    field="entityAnnotationsMap"
                                    placeholder="Entity: note"
                                    store={newVariable.display}
                                    label="Entity annotations"
                                    textarea
                                    disabled={isDisabled}
                                    helpText="Additional text to show next to entity labels. Each note should be in a separate line."
                                />
                            </section>
                        </form>
                    </div>
                    {this.grapher && (
                        <div className="col">
                            <div className="topbar">
                                <h3>Preview</h3>
                                <Link
                                    className="btn btn-secondary"
                                    to={`/charts/create/${Base64.encode(
                                        JSON.stringify(this.grapher.object)
                                    )}`}
                                >
                                    Edit as new chart
                                </Link>
                            </div>
                            <GrapherFigureView grapher={this.grapher} />
                        </div>
                    )}
                </div>
                <section>
                    <h3>Charts</h3>
                    <ChartList charts={variable.charts} />
                </section>
            </main>
        )
    }

    @computed private get grapherConfig(): GrapherInterface {
        return {
            yAxis: { min: 0 },
            map: { columnSlug: this.props.variable.id.toString() },
            tab: GrapherTabOption.map,
            hasMapTab: true,
            dimensions: [
                {
                    property: DimensionProperty.y,
                    variableId: this.props.variable.id,
                    display: lodash.clone(this.newVariable.display),
                },
            ],
        }
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.grapher = new Grapher(this.grapherConfig)

        this.dispose = autorun(() => {
            if (this.grapher && this.grapherConfig) {
                this.grapher.updateFromObject(this.grapherConfig)
            }
        })
    }

    componentWillUnmount() {
        this.dispose()
    }
}

@observer
export class VariableEditPage extends React.Component<{ variableId: number }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable variable?: VariablePageData

    render() {
        return (
            <AdminLayout>
                {this.variable && <VariableEditor variable={this.variable} />}
            </AdminLayout>
        )
    }

    async getData() {
        const json = await this.context.admin.getJSON(
            `/api/variables/${this.props.variableId}.json`
        )
        runInAction(() => {
            this.variable = json.variable as VariablePageData
        })
    }

    componentDidMount() {
        this.UNSAFE_componentWillReceiveProps()
    }
    UNSAFE_componentWillReceiveProps() {
        this.getData()
    }
}
