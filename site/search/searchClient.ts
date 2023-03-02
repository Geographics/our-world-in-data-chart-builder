import algoliasearch, { SearchClient } from "algoliasearch/lite"
import { countries } from "@ourworldindata/utils"
import {
    ALGOLIA_ID,
    ALGOLIA_SEARCH_KEY,
} from "../../settings/clientSettings.js"
import { PageHit, SiteSearchResults, ChartHit } from "./searchTypes.js"
import type { SearchResponse } from "@algolia/client-search"
import insightsClient, { InsightsClient } from "search-insights"
import type { InsightsSearchClickEvent } from "search-insights/dist/click.js"
import {
    getPreferenceValue,
    PreferenceType,
} from "../CookiePreferencesManager.js"

let algolia: SearchClient | undefined
const getClient = () => {
    if (!algolia) algolia = algoliasearch(ALGOLIA_ID, ALGOLIA_SEARCH_KEY)
    return algolia
}

let insightsInitialized = false
const getInsightsClient = (): InsightsClient => {
    if (!insightsInitialized) {
        insightsClient("init", {
            appId: ALGOLIA_ID,
            apiKey: ALGOLIA_SEARCH_KEY,
            userHasOptedOut: !getPreferenceValue(PreferenceType.Analytics),
            useCookie: true, // insightsClient doesn't set the cookie when userHasOptedOut is true
        })
        insightsInitialized = true
    }
    return insightsClient
}

export const siteSearch = async (query: string): Promise<SiteSearchResults> => {
    // Some special ad hoc handling of country names for chart query
    // This is especially important for "uk" and "us" since algolia otherwise isn't too sure what to do with them
    let chartQuery = query.trim()
    const matchCountries = []
    for (const country of countries) {
        const variants = [country.name, ...(country.variantNames ?? [])]
        for (const variant of variants) {
            const r = new RegExp(`\\b(${variant})\\b`, "gi")

            const newQuery = chartQuery.replace(r, "")

            if (newQuery !== chartQuery) {
                matchCountries.push(country)
                if (newQuery.trim().length) chartQuery = newQuery
            }
        }
    }

    // "HACK" use undocumented (legacy?) multi-queries capability of search()
    // instead of multipleQueries() here to benefit from optimized algoliasearch/lite
    // see https://github.com/owid/owid-grapher/pull/461#discussion_r433791078
    const json = await getClient().search([
        {
            indexName: "pages",
            query,
            params: {
                attributesToRetrieve: ["objectID", "slug", "title", "type"],
                attributesToSnippet: ["excerpt:20", "content:20"],
                attributesToHighlight: ["title"],
                hitsPerPage: 10,
                clickAnalytics: true,
            },
        },
        {
            indexName: "charts",
            query: chartQuery,
            params: {
                attributesToRetrieve: [
                    "objectID",
                    "chartId",
                    "slug",
                    "title",
                    "variantName",
                ],
                attributesToSnippet: ["subtitle:24"],
                attributesToHighlight: ["title", "availableEntities"],
                hitsPerPage: 10,
                removeStopWords: true,
                replaceSynonymsInHighlight: false,
                clickAnalytics: true,
            },
        },
    ])

    return {
        pages: json.results[0] as SearchResponse<PageHit>,
        charts: json.results[1] as SearchResponse<ChartHit>,
        countries: matchCountries,
    }
}

export const logSiteSearchClick = (
    event: Omit<InsightsSearchClickEvent, "eventName">
) => {
    const client = getInsightsClient()
    client("clickedObjectIDsAfterSearch", { ...event, eventName: "click" })
}
