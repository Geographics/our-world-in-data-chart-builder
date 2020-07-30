import {
    hydrate as hydrateAdditionalInformation,
    render as renderAdditionalInformation
} from "./AdditionalInformation/AdditionalInformation"
import { render as renderHelp } from "./Help/Help"
import { renderProminentLink } from "./ProminentLink/ProminentLink"
import { shouldProgressiveEmbed } from "../Grapher"
import { runSearchCountry } from "../covid/CovidSearchCountry"

export const renderBlocks = ($: CheerioStatic) => {
    renderAdditionalInformation($)
    renderHelp($)
}
export const runBlocks = () => {
    if (!shouldProgressiveEmbed()) {
        // Used by Help blocks. Pierces encapsulation but considered not worth going through hydration / client side rendering for this.
        // If hydration required for other purposes, then reassess.
        document
            .getElementsByTagName("body")[0]
            .classList.add("is-not-chart-interactive")
    }
    hydrateAdditionalInformation()
    renderProminentLink()
    runSearchCountry()
}
