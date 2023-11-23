import {
    Bounds,
    DEFAULT_BOUNDS,
    uniq,
    uniqBy,
    sum,
    zip,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    excludeUndefined,
    DisplaySource,
    prepareSourcesForDisplay,
    OwidSource,
} from "@ourworldindata/utils"
import {
    IndicatorSources,
    IndicatorProcessing,
} from "@ourworldindata/components"
import React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { CoreColumn, OwidColumnDef } from "@ourworldindata/core-table"
import { Modal } from "./Modal"
import { SourcesKeyDataTable } from "./SourcesKeyDataTable"
import { SourcesDescriptions } from "./SourcesDescriptions"
import { Tabs } from "../tabs/Tabs"
import { ExpandableTabs } from "../tabs/ExpandableTabs"

// keep in sync with variables in SourcesModal.scss
const MAX_WIDTH = 640
const TAB_PADDING = 16
const TAB_FONT_SIZE = 13
const TAB_GAP = 8

export interface SourcesModalManager {
    adminBaseUrl?: string
    columnsWithSourcesExtensive: CoreColumn[]
    showAdminControls?: boolean
    isSourcesModalOpen?: boolean
    tabBounds?: Bounds
    isEmbeddedInADataPage?: boolean
    isNarrow?: boolean
    fontSize?: number
}

interface SourcesModalProps {
    manager: SourcesModalManager
}

interface SourcesModalState {
    activeTabIndex: number
}

@observer
export class SourcesModal extends React.Component<
    SourcesModalProps,
    SourcesModalState
> {
    constructor(props: SourcesModalProps) {
        super(props)
        this.state = {
            activeTabIndex: 0,
        }
    }

    @computed private get manager(): SourcesModalManager {
        return this.props.manager
    }

    @computed private get tabBounds(): Bounds {
        return this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    @computed private get modalBounds(): Bounds {
        // using 15px instead of 16px to make sure the modal fully covers the OWID logo in the header
        const maxWidth = MAX_WIDTH + 220
        const padWidth = Math.max(15, (this.tabBounds.width - maxWidth) / 2)
        return this.tabBounds.padHeight(15).padWidth(padWidth)
    }

    @computed private get editBaseUrl(): string | undefined {
        if (!this.manager.showAdminControls) return undefined
        return `${this.props.manager.adminBaseUrl}/admin/datasets`
    }

    @computed private get columns(): CoreColumn[] {
        return this.manager.columnsWithSourcesExtensive
    }

    @computed private get deduplicatedColumn(): CoreColumn | undefined {
        const sources = this.columns.map((column) => new Source({ column }))
        const uniqueSources = uniqBy(sources, (source) => source.attributions)
        return uniqueSources.length === 1 ? this.columns[0] : undefined
    }

    @computed private get tabLabels(): string[] {
        return this.columns.map((column) => column.nonEmptyDisplayName)
    }

    private renderSource(column: CoreColumn | undefined): JSX.Element | null {
        if (!column) return null
        return (
            <Source
                column={column}
                editBaseUrl={this.editBaseUrl}
                isEmbeddedInADataPage={
                    this.manager.isEmbeddedInADataPage ?? false
                }
            />
        )
    }

    private renderDeduplicatedSource(): JSX.Element | null {
        if (!this.deduplicatedColumn) return null
        return (
            <DeduplicatedSource
                column={this.deduplicatedColumn}
                editBaseUrl={this.editBaseUrl}
                isEmbeddedInADataPage={
                    this.manager.isEmbeddedInADataPage ?? false
                }
            />
        )
    }

    private renderTabs(): JSX.Element {
        const activeIndex = this.state.activeTabIndex
        const setActiveIndex = (index: number) =>
            this.setState({
                activeTabIndex: index,
            })

        // tabs are clipped to this width
        const maxTabWidth = 240

        // on mobile, we show a horizontally scrolling tabs
        if (this.manager.isNarrow) {
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    horizontalScroll={true}
                    maxTabWidth={maxTabWidth}
                />
            )
        }

        // maximum width available for tabs
        const modalPadding = 1.5 * (this.manager.fontSize ?? 16)
        const maxWidth = Math.min(
            MAX_WIDTH,
            this.modalBounds.width - 2 * modalPadding - 10 // wiggle room
        )

        const labelWidths = this.tabLabels.map(
            (label) => measureTabWidth(label) + TAB_GAP
        )

        // check if all tab labels fit into a single line
        if (sum(labelWidths) <= maxWidth) {
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    maxTabWidth={null}
                />
            )
        }

        const clippedLabelWidths = this.tabLabels.map(
            (label) => Math.min(measureTabWidth(label), maxTabWidth) + TAB_GAP
        )

        // check if all tab labels fit into a single line when they are clipped
        if (sum(clippedLabelWidths) <= maxWidth) {
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    maxTabWidth={maxTabWidth}
                />
            )
        }

        // compute the subset of tabs that fit into a single line
        const getVisibleLabels = (labels: string[]) => {
            // take width of the "Show more" button into account
            let width =
                measureTabWidth("Show more") +
                13 + // icon width
                6 // icon padding

            const visibleLabels: string[] = []
            for (const [label, labelWidth] of zip(labels, clippedLabelWidths)) {
                width += labelWidth as number
                if (width > maxWidth) break
                visibleLabels.push(label as string)
            }

            return visibleLabels
        }

        // if only a single label would be visible, we prefer tabs with horizontal scrolling
        const visibleLabels = getVisibleLabels(this.tabLabels)
        if (visibleLabels.length <= 1) {
            return (
                <Tabs
                    labels={this.tabLabels}
                    activeIndex={activeIndex}
                    setActiveIndex={setActiveIndex}
                    horizontalScroll={true}
                    maxTabWidth={maxTabWidth}
                />
            )
        }

        return (
            <ExpandableTabs
                labels={this.tabLabels}
                activeIndex={activeIndex}
                setActiveIndex={setActiveIndex}
                getVisibleLabels={getVisibleLabels}
                maxTabWidth={maxTabWidth}
            />
        )
    }

    render(): JSX.Element {
        return (
            <Modal
                onDismiss={action(
                    () => (this.manager.isSourcesModalOpen = false)
                )}
                bounds={this.modalBounds}
                isHeightFixed={true}
            >
                <div className="SourcesModalContent">
                    {this.deduplicatedColumn ? (
                        this.renderDeduplicatedSource()
                    ) : this.columns.length === 1 ? (
                        this.renderSource(this.columns[0])
                    ) : (
                        <>
                            <p className="note-multiple-indicators">
                                This chart is composed of multiple indicators.
                                Select an indicator for more information.
                            </p>
                            {this.renderTabs()}
                            {this.renderSource(
                                this.columns[this.state.activeTabIndex]
                            )}
                        </>
                    )}
                </div>
            </Modal>
        )
    }
}

@observer
export class Source extends React.Component<{
    column: CoreColumn
    editBaseUrl?: string
    isEmbeddedInADataPage?: boolean
}> {
    @computed private get def(): OwidColumnDef & { source?: OwidSource } {
        return { ...this.props.column.def, source: this.props.column.source }
    }

    @computed private get source(): OwidSource {
        return this.def.source ?? {}
    }

    @computed private get title(): string {
        return this.props.column.nonEmptyDisplayName
    }

    @computed private get editUrl(): string | undefined {
        // there will not be a datasetId for explorers that define the FASTT in TSV
        if (!this.props.editBaseUrl || !this.def.datasetId) return undefined
        return `${this.props.editBaseUrl}/${this.def.datasetId}`
    }

    @computed private get producers(): string[] {
        if (!this.def.origins) return []
        return uniq(excludeUndefined(this.def.origins.map((o) => o.producer)))
    }

    @computed get attributions(): string | undefined {
        const attributionFragments =
            getAttributionFragmentsFromVariable(this.def) ?? this.producers
        if (attributionFragments.length === 0) return undefined
        return attributionFragments.join(", ")
    }

    @computed private get lastUpdated(): string | undefined {
        return getLastUpdatedFromVariable(this.def)
    }

    @computed private get nextUpdate(): string | undefined {
        return getNextUpdateFromVariable(this.def)
    }

    @computed private get unit(): string | undefined {
        return this.props.column.unit
    }

    @computed private get datapageHasFAQSection(): boolean {
        const faqCount = this.def.presentation?.faqs?.length ?? 0
        return !!this.props.isEmbeddedInADataPage && faqCount > 0
    }

    @computed private get showDescriptions(): boolean {
        return (
            (this.def.descriptionKey && this.def.descriptionKey.length > 0) ||
            !!this.def.descriptionFromProducer ||
            !!this.source.additionalInfo
        )
    }

    @computed private get sourcesForDisplay(): DisplaySource[] {
        return prepareSourcesForDisplay(this.def)
    }

    @computed protected get sourcesSectionHeading(): string {
        return "The data of this indicator is based on the following sources:"
    }

    protected renderTitle(): JSX.Element {
        return (
            <h2>
                {this.title}{" "}
                {this.editUrl && (
                    <a href={this.editUrl} target="_blank" rel="noopener">
                        <FontAwesomeIcon icon={faPencilAlt} />
                    </a>
                )}
            </h2>
        )
    }

    render(): JSX.Element {
        return (
            <div className="source">
                {this.renderTitle()}
                {this.def.descriptionShort && (
                    <p>{this.def.descriptionShort}</p>
                )}
                <SourcesKeyDataTable
                    attribution={this.attributions}
                    owidProcessingLevel={this.def.owidProcessingLevel}
                    dateRange={this.def.timespan}
                    lastUpdated={this.lastUpdated}
                    nextUpdate={this.nextUpdate}
                    unit={this.unit}
                    link={this.source.link}
                    unitConversionFactor={
                        this.props.column.unitConversionFactor
                    }
                    isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                />
                {this.showDescriptions && (
                    <SourcesDescriptions
                        descriptionShort={this.def.descriptionShort}
                        descriptionKey={this.def.descriptionKey ?? []}
                        hasFaqEntries={this.datapageHasFAQSection}
                        descriptionFromProducer={
                            this.def.descriptionFromProducer
                        }
                        attributionShort={
                            this.def.presentation?.attributionShort
                        }
                        additionalInfo={this.source.additionalInfo}
                        isEmbeddedInADataPage={this.props.isEmbeddedInADataPage}
                    />
                )}
                {this.sourcesForDisplay &&
                    this.sourcesForDisplay.length > 0 && (
                        <>
                            <h3 className="heading">
                                {this.sourcesSectionHeading}
                            </h3>
                            <IndicatorSources
                                sources={this.sourcesForDisplay}
                                isEmbeddedInADataPage={
                                    this.props.isEmbeddedInADataPage
                                }
                            />
                        </>
                    )}
                <h3 className="heading heading--tight">
                    How we process data at Our World in Data:
                </h3>
                <IndicatorProcessing
                    descriptionProcessing={this.def.descriptionProcessing}
                />
            </div>
        )
    }
}

@observer
export class DeduplicatedSource extends Source {
    renderTitle(): JSX.Element {
        return <h2>About this data</h2>
    }

    @computed get sourcesSectionHeading(): string {
        return "This data is based on the following sources"
    }
}

const measureTabWidth = (label: string): number => {
    return (
        2 * TAB_PADDING +
        Bounds.forText(label, { fontSize: TAB_FONT_SIZE }).width +
        2 // border
    )
}
