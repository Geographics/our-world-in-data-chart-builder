import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Grapher,
    GrapherProgrammaticInterface,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import ReactDOM from "react-dom"
import {
    DataPageDataV2,
    GrapherInterface,
    joinTitleFragments,
    OwidVariableWithSource,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    omitUndefinedValues,
    getAttributionFragmentsFromVariable,
    OwidVariableWithSourceAndDimension,
    memoize,
    setWindowQueryStr,
    getWindowQueryStr,
    compact,
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromQueryStr,
    multiDimStateToQueryStr,
    omit,
} from "@ourworldindata/utils"
import cx from "classnames"
import { DebugProvider } from "../gdocs/DebugContext.js"
import { DATA_API_URL } from "../../settings/clientSettings.js"
import {
    IndicatorsAfterPreProcessing,
    MultiDimDataPageProps,
    MultiDimDimensionChoices,
    View,
} from "@ourworldindata/types"
import AboutThisData from "../AboutThisData.js"
import TopicTags from "../TopicTags.js"
import MetadataSection from "../MetadataSection.js"
import { useElementBounds, useMobxStateToReactState } from "../hooks.js"
import { MultiDimSettingsPanel } from "./MultiDimDataPageSettingsPanel.js"
declare global {
    interface Window {
        _OWID_MULTI_DIM_PROPS?: MultiDimDataPageProps
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

// From DataPageUtils
const getDatapageDataV2 = async (
    variableMetadata: OwidVariableWithSource,
    partialGrapherConfig: GrapherInterface | undefined
): Promise<DataPageDataV2> => {
    {
        const lastUpdated = getLastUpdatedFromVariable(variableMetadata) ?? ""
        const nextUpdate = getNextUpdateFromVariable(variableMetadata)
        const datapageJson: DataPageDataV2 = {
            status: "draft",
            title: variableMetadata.presentation?.titlePublic
                ? omitUndefinedValues({
                      title: variableMetadata.presentation?.titlePublic,
                      attributionShort:
                          variableMetadata.presentation?.attributionShort,
                      titleVariant: variableMetadata.presentation?.titleVariant,
                  })
                : {
                      title:
                          partialGrapherConfig?.title ??
                          variableMetadata.display?.name ??
                          variableMetadata.name ??
                          "",
                  },
            description: variableMetadata.description,
            descriptionShort: variableMetadata.descriptionShort,
            descriptionFromProducer: variableMetadata.descriptionFromProducer,
            attributionShort: variableMetadata.presentation?.attributionShort,
            titleVariant: variableMetadata.presentation?.titleVariant,
            topicTagsLinks: variableMetadata.presentation?.topicTagsLinks ?? [],
            attributions: getAttributionFragmentsFromVariable(variableMetadata),
            faqs: variableMetadata.presentation?.faqs ?? [],
            descriptionKey: variableMetadata.descriptionKey ?? [],
            descriptionProcessing: variableMetadata.descriptionProcessing,
            owidProcessingLevel: variableMetadata.processingLevel,
            dateRange: variableMetadata.timespan ?? "",
            lastUpdated: lastUpdated,
            nextUpdate: nextUpdate,
            allCharts: [],
            relatedResearch: [],
            source: variableMetadata.source,
            origins: variableMetadata.origins ?? [],
            chartConfig: partialGrapherConfig as Record<string, unknown>,
            unit: variableMetadata.display?.unit ?? variableMetadata.unit,
            unitConversionFactor: variableMetadata.display?.conversionFactor,
        }
        return datapageJson
    }
}

const cachedGetVariableMetadata = memoize(
    (variableId: number): Promise<OwidVariableWithSourceAndDimension> =>
        fetch(getVariableMetadataRoute(DATA_API_URL, variableId)).then((resp) =>
            resp.json()
        )
)

const cachedGetGrapherConfigByUuid = memoize(
    (grapherConfigUuid: string): Promise<GrapherInterface> =>
        fetch(`/grapher/by-uuid/${grapherConfigUuid}.config.json`).then(
            (resp) => resp.json()
        )
)

const useTitleFragments = (config: MultiDimDataPageConfig) => {
    const title = config.config.title
    return useMemo(
        () => joinTitleFragments(title.titleVariant, title.attributionShort),
        [title]
    )
}

const useView = (
    currentSettings: MultiDimDimensionChoices,
    config: MultiDimDataPageConfig
) => {
    const currentView = useMemo(() => {
        if (Object.keys(currentSettings).length === 0) return undefined
        return config.findViewByDimensions(currentSettings)
    }, [currentSettings, config])

    const dimensionsConfig = useMemo(
        () => MultiDimDataPageConfig.viewToDimensionsConfig(currentView),
        [currentView]
    )

    return { currentView, dimensionsConfig }
}

const useVarDatapageData = (
    currentView: View<IndicatorsAfterPreProcessing> | undefined,
    variableIdToGrapherConfigMap: Record<number, string | null> | undefined
) => {
    const [varDatapageData, setVarDatapageData] =
        useState<DataPageDataV2 | null>(null)
    const [grapherConfig, setGrapherConfig] = useState<GrapherInterface | null>(
        null
    )
    const [grapherConfigIsReady, setGrapherConfigIsReady] = useState(false)

    useEffect(() => {
        setGrapherConfigIsReady(false)
        setGrapherConfig(null)
        setVarDatapageData(null)
        const yIndicatorOrIndicators = currentView?.indicators?.["y"]
        const variableId = Array.isArray(yIndicatorOrIndicators)
            ? yIndicatorOrIndicators[0]
            : yIndicatorOrIndicators
        if (!variableId) return

        const datapageDataPromise = cachedGetVariableMetadata(variableId).then(
            (json) => getDatapageDataV2(json, currentView?.config)
        )
        const grapherConfigUuid = variableIdToGrapherConfigMap?.[variableId]
        const grapherConfigPromise = grapherConfigUuid
            ? cachedGetGrapherConfigByUuid(grapherConfigUuid)
            : null

        Promise.allSettled([datapageDataPromise, grapherConfigPromise])
            .then(([datapageData, grapherConfig]) => {
                if (datapageData.status === "rejected")
                    throw new Error(
                        `Fetching variable by uuid failed: ${grapherConfigUuid}`,
                        { cause: datapageData.reason }
                    )

                setVarDatapageData(datapageData.value)
                setGrapherConfig(
                    grapherConfig.status === "fulfilled"
                        ? grapherConfig.value
                        : null
                )
                setGrapherConfigIsReady(true)
            })
            .catch(console.error)
    }, [
        currentView?.indicators,
        currentView?.config,
        variableIdToGrapherConfigMap,
    ])

    return {
        varDatapageData,
        varGrapherConfig: grapherConfig,
        grapherConfigIsReady,
    }
}

export const MultiDimDataPageContent = ({
    // _datapageData,
    configObj,
    // isPreviewing = false,
    faqEntries,
    variableIdToGrapherConfigMap,
    primaryTopic,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    tagToSlugMap,
    // imageMetadata,
    initialQueryStr,
}: MultiDimDataPageProps) => {
    const grapherFigureRef = useRef<HTMLDivElement>(null)

    const config = useMemo(
        () => MultiDimDataPageConfig.fromObject(configObj),
        [configObj]
    )
    const titleFragments = useTitleFragments(config)

    const [currentSettings, setCurrentSettings] = useState(() => {
        const initialChoices = initialQueryStr
            ? extractMultiDimChoicesFromQueryStr(initialQueryStr, config)
            : {}
        const { selectedChoices } =
            config.filterToAvailableChoices(initialChoices)
        return selectedChoices
    })

    const { currentView, dimensionsConfig } = useView(currentSettings, config)
    const { varDatapageData, varGrapherConfig, grapherConfigIsReady } =
        useVarDatapageData(currentView, variableIdToGrapherConfigMap)

    // This is the ACTUAL grapher instance being used, because GrapherFigureView/GrapherWithFallback are doing weird things and are not actually using the grapher instance we pass into it
    // and therefore we can not access the grapher state (e.g. tab, selection) from the grapher instance we pass into it
    // TODO we should probably fix that? seems sensible? change GrapherFigureView around a bit to use the actual grapher inst? or pass a GrapherProgrammaticInterface to it instead?
    const [grapherInst, setGrapherInst] = useState<Grapher | null>(null)

    // De-mobx grapher.changedParams by transforming it into React state
    const grapherChangedParams = useMobxStateToReactState(
        useCallback(() => grapherInst?.changedParams, [grapherInst]),
        !!grapherInst
    )

    const bounds = useElementBounds(grapherFigureRef)

    const queryStr = useMemo(
        () =>
            grapherChangedParams !== undefined
                ? multiDimStateToQueryStr(grapherChangedParams, currentSettings)
                : initialQueryStr,
        [grapherChangedParams, currentSettings, initialQueryStr]
    )

    useEffect(() => {
        setWindowQueryStr(queryStr ?? "")
    }, [queryStr])

    const grapherConfigComputed = useMemo(() => {
        const baseConfig: GrapherProgrammaticInterface = {
            isEmbeddedInAnOwidPage: true,
            selectedEntityNames: config.config.defaultSelection ?? [],
            bounds,
        }

        if (!grapherConfigIsReady) return baseConfig
        return {
            ...varGrapherConfig,
            ...currentView?.config,
            dimensions: dimensionsConfig,
            ...baseConfig,
            // TODO: The way manager and slug are set here are just workarounds to make the edit button in the
            // share menu work. They should be removed before we publish MDims!
            manager: {
                canonicalUrl,
            },
            slug: "DUMMY",
        } as GrapherProgrammaticInterface
    }, [
        varGrapherConfig,
        grapherConfigIsReady,
        currentView,
        dimensionsConfig,
        bounds,
        config,
        canonicalUrl,
    ])

    const hasTopicTags = !!config.config.topicTags?.length

    // TODO
    // const relatedResearchCandidates = varDatapageData?.relatedResearch ?? []
    // const relatedResearch =
    //     relatedResearchCandidates.length > 3 && config.config.topicTags?.length
    //         ? relatedResearchCandidates.filter((research) => {
    //               const shared = intersection(
    //                   research.tags,
    //                   config.config.topicTags ?? []
    //               )
    //               return shared.length > 0
    //           })
    //         : relatedResearchCandidates
    // for (const item of relatedResearch) {
    //     // TODO: these are workarounds to not link to the (not really existing) template pages for energy or co2
    //     // country profiles but instead to the topic page at the country selector.
    //     if (item.url === "/co2-country-profile")
    //         item.url =
    //             "/co2-and-greenhouse-gas-emissions#co2-and-greenhouse-gas-emissions-country-profiles"
    //     else if (item.url === "/energy-country-profile")
    //         item.url = "/energy#country-profiles"
    //     else if (item.url === "/coronavirus-country-profile")
    //         item.url = "/coronavirus#coronavirus-country-profiles"
    // }

    const faqEntriesForView = useMemo(() => {
        return compact(
            varDatapageData?.faqs?.flatMap(
                (faq) => faqEntries?.faqs?.[faq.gdocId]?.[faq.fragmentId]
            )
        )
    }, [varDatapageData?.faqs, faqEntries])

    return (
        <div className="DataPageContent MultiDimDataPageContent">
            <div className="bg-blue-10">
                <div className="header__wrapper wrapper grid grid-cols-12 ">
                    <div className="header__left span-cols-8 span-sm-cols-12">
                        <div className="header__supertitle">Data</div>
                        <h1 className="header__title">
                            {config.config.title.title}
                        </h1>
                        <div className="header__source">{titleFragments}</div>
                    </div>
                    {hasTopicTags && tagToSlugMap && (
                        <TopicTags
                            className="header__right col-start-10 span-cols-4 col-sm-start-2 span-sm-cols-12"
                            topicTagsLinks={config.config.topicTags ?? []}
                            tagToSlugMap={tagToSlugMap}
                        />
                    )}
                    <div
                        className={cx(
                            "settings-row__wrapper",
                            "span-sm-cols-12",
                            hasTopicTags ? "span-cols-9" : "span-cols-12"
                        )}
                    >
                        <MultiDimSettingsPanel
                            config={config}
                            currentSettings={currentSettings}
                            updateSettings={setCurrentSettings}
                        />
                    </div>
                </div>
            </div>

            <div className="span-cols-14 grid grid-cols-12-full-width full-width--border">
                <div className="chart-key-info col-start-2 span-cols-12">
                    <div
                        id="explore-the-data"
                        className="GrapherWithFallback full-width-on-mobile"
                    >
                        <figure data-grapher-src ref={grapherFigureRef}>
                            <Grapher
                                key={JSON.stringify(
                                    omit(grapherConfigComputed, ["bounds"])
                                )}
                                {...grapherConfigComputed}
                                queryStr={queryStr}
                                getGrapherInstance={setGrapherInst}
                            />
                        </figure>
                    </div>
                    {varDatapageData && (
                        <AboutThisData
                            datapageData={varDatapageData}
                            hasFaq={!!faqEntriesForView?.length}
                        />
                    )}
                </div>
            </div>
            {/* <div className="col-start-2 span-cols-12">
                {relatedResearch && relatedResearch.length > 0 && (
                    <div className="section-wrapper grid">
                        <h2
                            className="related-research__title span-cols-3 span-lg-cols-12"
                            id="research-and-writing"
                        >
                            Related research and writing
                        </h2>
                        <div className="related-research__items grid grid-cols-9 grid-lg-cols-12 span-cols-9 span-lg-cols-12">
                            {relatedResearch.map((research) => (
                                <a
                                    href={research.url}
                                    key={research.url}
                                    className="related-research__item grid grid-cols-4 grid-lg-cols-6 grid-sm-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12"
                                >
                                    <DatapageResearchThumbnail
                                        urlOrFilename={research.imageUrl}
                                    />
                                    <div className="span-cols-3 span-lg-cols-4 span-sm-cols-9">
                                        <h3 className="related-article__title">
                                            {research.title}
                                        </h3>
                                        <div className="related-article__authors body-3-medium-italic">
                                            {research.authors &&
                                                research.authors.length &&
                                                formatAuthors({
                                                    authors: research.authors,
                                                })}
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
                {varDatapageData?.allCharts &&
                varDatapageData?.allCharts.length > 0 ? (
                    <div className="section-wrapper section-wrapper__related-charts">
                        <h2 className="related-charts__title" id="all-charts">
                            Explore charts that include this data
                        </h2>
                        <div>
                            <RelatedCharts
                                charts={varDatapageData.allCharts}
                            />
                        </div>
                    </div>
                ) : null}
            </div> */}
            {varDatapageData && (
                <MetadataSection
                    attributionShort={varDatapageData.attributionShort}
                    attributions={varDatapageData.attributions}
                    canonicalUrl={canonicalUrl}
                    descriptionProcessing={
                        varDatapageData.descriptionProcessing
                    }
                    faqEntries={{ faqs: faqEntriesForView }}
                    origins={varDatapageData.origins}
                    owidProcessingLevel={varDatapageData.owidProcessingLevel}
                    primaryTopic={primaryTopic}
                    source={varDatapageData.source}
                    title={varDatapageData.title}
                    titleVariant={varDatapageData.titleVariant}
                />
            )}
        </div>
    )
}

export const hydrateMultiDimDataPageContent = (isPreviewing?: boolean) => {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const props: MultiDimDataPageProps = window._OWID_MULTI_DIM_PROPS!
    const initialQueryStr = getWindowQueryStr()

    ReactDOM.hydrate(
        <DebugProvider debug={isPreviewing}>
            <MultiDimDataPageContent
                {...props}
                isPreviewing={isPreviewing}
                initialQueryStr={initialQueryStr}
            />
        </DebugProvider>,
        wrapper
    )
}
