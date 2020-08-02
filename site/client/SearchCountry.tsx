import React, { useState } from "react"
import ReactDOM from "react-dom"
import Select, { ValueType } from "react-select"
import { countries } from "utils/countries"
import { asArray } from "utils/client/react-select"
import { Analytics } from "./Analytics"
import { sortBy } from "charts/Util"
import { countryProfileSpecs } from "./CountryProfileConstants"

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
    countryProfileSpecs.forEach(profileSpec => {
        const elements = Array.from(
            document.querySelectorAll(profileSpec.selector)
        )
        elements.forEach(element => {
            ReactDOM.render(
                <SearchCountry countryProfileRootPath={profileSpec.rootPath} />,
                element
            )
        })
    })
}

export default SearchCountry
