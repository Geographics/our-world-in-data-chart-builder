import React, { useState } from "react"
import ReactDOM from "react-dom"
import Select, { ValueType } from "react-select"
import { countries } from "utils/countries"
import { asArray } from "utils/client/react-select"
import { Analytics } from "charts/core/Analytics"
import { sortBy } from "charts/utils/Util"
import { countryProfileSpecs } from "../server/countryProfileProjects"

interface CountrySelectOption {
    label: string
    value: string
}

const SearchCountry = (props: { countryProfileRootPath: string }) => {
    const [isLoading, setIsLoading] = useState(false)
    const sorted = sortBy(countries, "name")
    return (
        <Select
            options={sorted.map(c => {
                return { label: c.name, value: c.slug }
            })}
            onChange={(selected: ValueType<CountrySelectOption>) => {
                const country = asArray(selected)[0].value
                Analytics.logCovidCountryProfileSearch(country)
                setIsLoading(true)
                window.location.href = `${props.countryProfileRootPath}/${country}`
            }}
            isLoading={isLoading}
            placeholder="Search for a country..."
        />
    )
}

export function runSearchCountry() {
    const searchElements = document.querySelectorAll(
        ".wp-block-search-country-profile"
    )
    searchElements.forEach(element => {
        const project = element.getAttribute("data-project")
        if (project) {
            const profileSpec = countryProfileSpecs.find(
                spec => spec.project === project
            )
            if (profileSpec) {
                ReactDOM.render(
                    <SearchCountry
                        countryProfileRootPath={profileSpec.rootPath}
                    />,
                    element
                )
            }
        }
    })
}

export default SearchCountry
