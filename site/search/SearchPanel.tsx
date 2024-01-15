import ReactDOM from "react-dom"
import React, { useCallback, useEffect } from "react"
import cx from "classnames"
import {
    keyBy,
    getWindowQueryParams,
    get,
    mapValues,
} from "@ourworldindata/utils"
import {
    InstantSearch,
    Configure,
    SearchBox,
    Hits,
    Highlight,
    Index,
    Snippet,
    useInstantSearch,
    PoweredBy,
} from "react-instantsearch-hooks-web"
import algoliasearch, { SearchClient } from "algoliasearch"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../../settings/clientSettings.js"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import {
    IExplorerHit,
    IChartHit,
    SearchCategoryFilter,
    SearchIndexName,
    searchCategoryFilters,
    IPageHit,
    pageTypeDisplayNames,
} from "./searchTypes.js"
import { EXPLORERS_ROUTE_FOLDER } from "../../explorer/ExplorerConstants.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { logSiteSearchClick } from "./searchClient.js"
import {
    PreferenceType,
    getPreferenceValue,
} from "../CookiePreferencesManager.js"

function PagesHit({ hit }: { hit: IPageHit }) {
    return (
        <a
            href={`${BAKED_BASE_URL}/${hit.slug}`}
            data-algolia-index={SearchIndexName.Pages}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
        >
            {/* TODO: index featured images */}
            <header className="page-hit__header">
                <h4 className="h3-bold search-results__page-hit-title">
                    {hit.title}
                </h4>
                <span className="body-3-medium search-results__page-hit-type">
                    {pageTypeDisplayNames[hit.type]}
                </span>
            </header>
            <Snippet
                className="body-3-medium search-results__page-hit-snippet"
                attribute="excerpt"
                highlightedTagName="strong"
                hit={hit}
            />
        </a>
    )
}

function ChartHit({ hit }: { hit: IChartHit }) {
    return (
        <a
            href={`${BAKED_GRAPHER_URL}/${hit.slug}`}
            data-algolia-index={SearchIndexName.Charts}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
        >
            <div className="search-results__chart-hit-img-container">
                <img
                    loading="lazy"
                    src={`${BAKED_GRAPHER_URL}/exports/${hit.slug}.svg`}
                />
            </div>
            <Highlight
                attribute="title"
                highlightedTagName="strong"
                className="search-results__chart-hit-highlight"
                hit={hit}
            />{" "}
            <span className="search-results__chart-hit-variant">
                {hit.variantName}
            </span>
        </a>
    )
}

function ExplorerHit({ hit }: { hit: IExplorerHit }) {
    return (
        <a
            data-algolia-index={SearchIndexName.Explorers}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
            href={`${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${hit.slug}`}
        >
            <h4 className="h3-bold">{hit.title}</h4>
            {/* Explorer subtitles are mostly useless at the moment, so we're only showing titles */}
        </a>
    )
}

function ShowMore({
    category,
    cutoffNumber,
    activeCategoryFilter,
    handleCategoryFilterClick,
}: {
    category: SearchIndexName
    cutoffNumber: number
    activeCategoryFilter: SearchCategoryFilter
    handleCategoryFilterClick: (x: SearchIndexName) => void
}) {
    const { results } = useInstantSearch()
    // Hide if we're on the same tab as the category this button is for
    if (activeCategoryFilter === category) return null
    if (results.hits.length === 0) return null

    const handleClick = () => {
        window.scrollTo({ top: 0 })
        handleCategoryFilterClick(category)
    }

    const numberShowing = Math.min(cutoffNumber, results.hits.length)
    const isShowingAllResults = numberShowing === results.hits.length
    const message = isShowingAllResults
        ? numberShowing <= 2
            ? "Showing all results"
            : `Showing all ${numberShowing} results`
        : `Showing ${numberShowing} of the top ${results.hits.length} results`

    return (
        <div className="search-results__show-more-container">
            <em>{message}</em>
            {!isShowingAllResults && (
                <button onClick={handleClick}>Show more</button>
            )}
        </div>
    )
}

function Filters({
    isHidden,
    categoryFilterContainerRef,
    handleCategoryFilterClick,
    activeCategoryFilter,
}: {
    isHidden: boolean
    categoryFilterContainerRef: React.Ref<HTMLUListElement>
    activeCategoryFilter: SearchCategoryFilter
    handleCategoryFilterClick: (x: SearchCategoryFilter) => void
}) {
    const { scopedResults } = useInstantSearch()
    if (isHidden) return null

    const resultsByIndexName = keyBy(scopedResults, "indexId")
    const hitsLengthByIndexName = mapValues(resultsByIndexName, (results) =>
        get(results, ["results", "hits", "length"], 0)
    )
    hitsLengthByIndexName.all = Object.values(hitsLengthByIndexName).reduce(
        (a: number, b: number) => a + b,
        0
    )

    return (
        <div className="search-filters">
            <ul
                ref={categoryFilterContainerRef}
                className="search-filters__list"
            >
                {searchCategoryFilters.map(([label, key]) => (
                    <li
                        key={key}
                        data-filter-key={key}
                        className="search-filters__tab"
                    >
                        <button
                            disabled={hitsLengthByIndexName[key] === 0}
                            onClick={() => handleCategoryFilterClick(key)}
                            className={cx("search-filters__tab-button", {
                                "search-filters__tab-button--is-active":
                                    activeCategoryFilter === key,
                            })}
                        >
                            {label}
                            <span className="search-filters__tab-count">
                                {hitsLengthByIndexName[key]}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function NoResultsBoundary({ children }: { children: React.ReactElement }) {
    const { results } = useInstantSearch()

    // The `__isArtificial` flag makes sure not to display the No Results message when no hits have been returned.
    // Add the `hidden` attribute to the child <section> tag,
    // which we can leverage along with the adjacent sibling selector
    // to show a No Results screen with CSS alone
    if (!results.__isArtificial && results.nbHits === 0) {
        return React.cloneElement(children, { hidden: true })
    }

    return children
}

interface SearchResultsProps {
    activeCategoryFilter: SearchCategoryFilter
    isHidden: boolean
    handleCategoryFilterClick: (x: SearchCategoryFilter) => void
}

const SearchResults = (props: SearchResultsProps) => {
    const {
        results: { queryID },
    } = useInstantSearch()
    const { activeCategoryFilter, isHidden, handleCategoryFilterClick } = props

    // Listen to all clicks, if user clicks on a hit (and has consented to analytics - grep "hasClickAnalyticsConsent"),
    // Extract the pertinent hit data from the HTML and log the click to Algolia
    const handleHitClick = useCallback(
        (event: MouseEvent) => {
            if (!queryID) return
            let target = event.target as HTMLElement | null
            if (target) {
                let isHit = false
                while (target) {
                    if (target.hasAttribute("data-algolia-object-id")) {
                        isHit = true
                        break
                    }
                    target = target.parentElement
                }
                if (isHit && target) {
                    const objectId = target.getAttribute(
                        "data-algolia-object-id"
                    )
                    const position = target.getAttribute(
                        "data-algolia-position"
                    )
                    if (objectId && position) {
                        logSiteSearchClick({
                            index: SearchIndexName.Charts,
                            queryID,
                            objectIDs: [objectId],
                            positions: [parseInt(position)],
                        })
                    }
                }
            }
        },
        [queryID]
    )
    useEffect(() => {
        document.addEventListener("click", handleHitClick)
        return () => document.removeEventListener("click", handleHitClick)
    }, [queryID, handleHitClick])
    if (isHidden) return null

    const hasClickAnalyticsConsent = getPreferenceValue(
        PreferenceType.Analytics
    )
    return (
        <div
            className="search-results"
            data-active-filter={activeCategoryFilter}
        >
            {/* This is using the InstantSearch index specified in InstantSearchContainer */}
            <Configure
                hitsPerPage={40}
                distinct
                clickAnalytics={hasClickAnalyticsConsent}
            />
            <NoResultsBoundary>
                <section className="search-results__pages">
                    <header className="search-results__header">
                        <h2 className="h2-bold search-results__section-title">
                            Research & Writing
                        </h2>
                        <ShowMore
                            category={SearchIndexName.Pages}
                            cutoffNumber={4}
                            activeCategoryFilter={activeCategoryFilter}
                            handleCategoryFilterClick={
                                handleCategoryFilterClick
                            }
                        />
                    </header>
                    <Hits
                        classNames={{
                            root: "search-results__list-container",
                            list: "search-results__pages-list grid grid-cols-2 grid-sm-cols-1",
                            item: "search-results__page-hit",
                        }}
                        hitComponent={PagesHit}
                    />
                </section>
            </NoResultsBoundary>
            <Index indexName={SearchIndexName.Explorers}>
                <Configure
                    hitsPerPage={10}
                    distinct
                    clickAnalytics={hasClickAnalyticsConsent}
                />
                <NoResultsBoundary>
                    <section className="search-results__explorers">
                        <header className="search-results__header">
                            <h2 className="h2-bold search-results__section-title">
                                Data Explorers
                            </h2>
                            <ShowMore
                                category={SearchIndexName.Explorers}
                                cutoffNumber={2}
                                activeCategoryFilter={activeCategoryFilter}
                                handleCategoryFilterClick={
                                    handleCategoryFilterClick
                                }
                            />
                        </header>
                        <Hits
                            classNames={{
                                root: "search-results__list-container",
                                list: "search-results__explorers-list grid grid-cols-2 grid-sm-cols-1",
                                item: "search-results__explorer-hit",
                            }}
                            hitComponent={ExplorerHit}
                        />
                    </section>
                </NoResultsBoundary>
            </Index>
            <Index indexName={SearchIndexName.Charts}>
                <Configure
                    hitsPerPage={40}
                    distinct
                    clickAnalytics={hasClickAnalyticsConsent}
                />
                <NoResultsBoundary>
                    <section className="search-results__charts">
                        <header className="search-results__header">
                            <h2 className="h2-bold search-results__section-title">
                                Charts
                            </h2>
                            <ShowMore
                                category={SearchIndexName.Charts}
                                cutoffNumber={40}
                                activeCategoryFilter={activeCategoryFilter}
                                handleCategoryFilterClick={
                                    handleCategoryFilterClick
                                }
                            />
                        </header>
                        <Hits
                            classNames={{
                                root: "search-results__list-container",
                                list: "search-results__charts-list grid grid-cols-4 grid-sm-cols-2",
                                item: "search-results__chart-hit span-md-cols-2",
                            }}
                            hitComponent={ChartHit}
                        />
                    </section>
                </NoResultsBoundary>
            </Index>
            <section className="search-page__no-results">
                <div className="search-page__no-results-notice-container">
                    <FontAwesomeIcon icon={faSearch} />
                    <h2 className="body-1-regular">
                        There are no results for this query.
                    </h2>
                    <p className="body-3-medium">
                        You may want to try using different keywords or checking
                        for typos.
                    </p>
                </div>
            </section>
        </div>
    )
}

@observer
export class InstantSearchContainer extends React.Component {
    searchClient: SearchClient
    categoryFilterContainerRef: React.RefObject<HTMLUListElement>

    constructor(props: Record<string, never>) {
        super(props)
        this.searchClient = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY, {
            queryParameters: {
                clickAnalytics: "true",
            },
        })
        this.categoryFilterContainerRef = React.createRef<HTMLUListElement>()
        this.handleCategoryFilterClick =
            this.handleCategoryFilterClick.bind(this)
    }

    componentDidMount(): void {
        const params = getWindowQueryParams()
        if (params.q) {
            // Algolia runs the search and fills the searchbox input regardless
            // we just need this class to be aware that a query exists so that it doesn't hide the results
            this.inputValue = decodeURI(params.q)
        }
    }

    @observable inputValue: string = ""

    @action.bound handleQuery(query: string, search: (value: string) => void) {
        this.inputValue = query
        if (query === "") return
        search(query)
    }

    @observable activeCategoryFilter: SearchCategoryFilter = "all"

    @action.bound setActiveCategoryFilter(filter: SearchCategoryFilter) {
        this.activeCategoryFilter = filter
    }

    handleCategoryFilterClick(key: SearchCategoryFilter) {
        const ul = this.categoryFilterContainerRef.current
        if (!ul) return
        // On narrow screens, scroll horizontally to put the active tab at the left of the screen
        const hasScrollbar = document.body.scrollWidth < ul.scrollWidth
        if (hasScrollbar) {
            const target = [...ul.children].find(
                (node) => node.getAttribute("data-filter-key") === key
            ) as HTMLElement
            ul.scrollTo({
                // 16px for button padding
                left: target.offsetLeft - 16,
                behavior: "smooth",
            })
        }
        this.setActiveCategoryFilter(key)
    }

    render() {
        return (
            <InstantSearch
                routing={{
                    // This controls algolia's automatic mapping of the search query to search params
                    // we're customizing it here to remove any filter / facet information so that it's just ?q=some+query
                    stateMapping: {
                        stateToRoute(uiState) {
                            const query = uiState[SearchIndexName.Pages].query
                            return {
                                q: query,
                            }
                        },
                        routeToState(routeState) {
                            const query = routeState.q
                            return {
                                [SearchIndexName.Pages]: {
                                    query: query,
                                },
                            }
                        },
                    },
                }}
                searchClient={this.searchClient}
                indexName={SearchIndexName.Pages}
            >
                <div className="search-panel">
                    <SearchBox
                        placeholder="Try “COVID”, “Poverty”, “New Zealand”, “CO2 emissions per capita”..."
                        className="searchbox"
                        queryHook={this.handleQuery}
                    />
                    <Filters
                        isHidden={!this.inputValue}
                        categoryFilterContainerRef={
                            this.categoryFilterContainerRef
                        }
                        activeCategoryFilter={this.activeCategoryFilter}
                        handleCategoryFilterClick={
                            this.handleCategoryFilterClick
                        }
                    />
                    <SearchResults
                        isHidden={!this.inputValue}
                        activeCategoryFilter={this.activeCategoryFilter}
                        handleCategoryFilterClick={
                            this.handleCategoryFilterClick
                        }
                    />
                    <PoweredBy />
                </div>
            </InstantSearch>
        )
    }
}

export function runSearchPage() {
    ReactDOM.render(<InstantSearchContainer />, document.querySelector("main"))
}
