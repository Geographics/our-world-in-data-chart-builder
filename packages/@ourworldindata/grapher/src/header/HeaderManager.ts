import { Bounds } from "@ourworldindata/utils"

export interface HeaderManager {
    fontSize?: number
    currentTitle?: string
    currentSubtitle?: string
    hideLogo?: boolean
    shouldLinkToOwid?: boolean
    logo?: string
    canonicalUrl?: string
    tabBounds?: Bounds
    detailsOrderedByReference?: Set<string>
    shouldIncludeDetailsInStaticExport?: boolean
}
