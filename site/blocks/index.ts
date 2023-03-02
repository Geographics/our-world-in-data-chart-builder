import { hydrate as hydrateAdditionalInformation } from "./AdditionalInformation.js"
import { runSearchCountry } from "../../site/SearchCountry.js"
import { runExpandableInlineBlock } from "../../site/ExpandableInlineBlock.js"
import { runDataTokens } from "../../site/runDataTokens.js"
import { hydrateKeyInsights } from "./KeyInsights.js"
import { hydrateStickyNav } from "./StickyNav.js"
import { hydrateExpandableParagraphs } from "./ExpandableParagraph.js"
import { hydrateCodeSnippets } from "./CodeSnippet.js"

export const runBlocks = () => {
    runDataTokens()
    runExpandableInlineBlock()
    runSearchCountry()
    hydrateAdditionalInformation()
    hydrateKeyInsights()
    hydrateExpandableParagraphs()
    hydrateStickyNav()
    hydrateCodeSnippets()
}
