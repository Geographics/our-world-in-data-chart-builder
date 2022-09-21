import ReactDOM from "react-dom"
import React from "react"
import { getWindowQueryParams } from "../clientUtils/urls/UrlUtils.js"
import { siteSearch, SiteSearchResults } from "./searchClient.js"
import { SearchResults } from "../site/SearchResults.js"
import { observer } from "mobx-react"
import { action, observable, runInAction, makeObservable } from "mobx"

export const SearchPageMain = observer(
    class SearchPageMain extends React.Component {
        query: string = getWindowQueryParams().q || ""
        lastQuery?: string

        results?: SiteSearchResults

        constructor(props) {
            super(props)

            makeObservable(this, {
                query: observable,
                results: observable.ref,
                onSearch: action.bound,
                onSearchInput: action.bound,
            })
        }

        async runSearch(query: string) {
            const results = await siteSearch(query)

            if (this.lastQuery !== query) {
                // Don't need this result anymore
                return
            }

            runInAction(() => (this.results = results))
        }

        onSearch(query: string) {
            this.lastQuery = query
            if (query) {
                this.runSearch(query)
            } else {
                this.results = undefined
            }
        }

        componentDidMount() {
            const input = document.querySelector(
                ".SearchPage > main > form input"
            ) as HTMLInputElement
            input.value = this.query
            input.focus()
            this.onSearch(this.query)
        }

        // dispose?: IReactionDisposer
        // componentDidMount() {
        //     this.dispose = autorun(() => this.onSearch(this.query))
        // }

        // componentWillUnmount() {
        //     if (this.dispose) this.dispose()
        // }

        onSearchInput(e: React.ChangeEvent<HTMLInputElement>) {
            this.query = e.currentTarget.value
        }

        render() {
            return (
                <React.Fragment>
                    {this.results && <SearchResults results={this.results} />}
                </React.Fragment>
            )
        }
    }
)

export function runSearchPage() {
    ReactDOM.render(
        <SearchPageMain />,
        document.querySelector(".searchResults")
    )
}
