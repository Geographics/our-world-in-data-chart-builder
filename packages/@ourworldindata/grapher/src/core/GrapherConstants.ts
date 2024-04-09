import type { GrapherProgrammaticInterface } from "./Grapher"

export const GRAPHER_EMBEDDED_FIGURE_ATTR = "data-grapher-src"
export const GRAPHER_EMBEDDED_FIGURE_CONFIG_ATTR = "data-grapher-config"

export const GRAPHER_PAGE_BODY_CLASS = "StandaloneGrapherOrExplorerPage"
export const GRAPHER_SCROLLABLE_CONTAINER_CLASS = "scrollable-container"
export const GRAPHER_IS_IN_IFRAME_CLASS = "IsInIframe"
export const GRAPHER_DRAWER_ID = "grapher-drawer"

export const DEFAULT_GRAPHER_CONFIG_SCHEMA =
    "https://files.ourworldindata.org/schemas/grapher-schema.004.json"

export const DEFAULT_GRAPHER_ENTITY_TYPE = "country or region"
export const DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL = "countries and regions"
export const GRAPHER_MOUNTED_EVENT_NAME = "grapherMounted"
export const GRAPHER_LOADED_EVENT_NAME = "grapherLoaded"

export const DEFAULT_GRAPHER_WIDTH = 850
export const DEFAULT_GRAPHER_HEIGHT = 600

export const DEFAULT_GRAPHER_FRAME_PADDING = 16
export const STATIC_EXPORT_DETAIL_SPACING = 8

export const GRAPHER_DARK_TEXT = "#5b5b5b"
export const GRAPHER_LIGHT_TEXT = "#858585"

export const GRAPHER_AXIS_LINE_WIDTH_DEFAULT = 1
export const GRAPHER_AXIS_LINE_WIDTH_THICK = 2

export const GRAPHER_AREA_OPACITY_DEFAULT = 0.8

export const BASE_FONT_SIZE = 16

export const GRAPHER_FONT_SCALE_9_6 = 9.6 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_10 = 10 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_10_5 = 10.5 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_11 = 11 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_11_2 = 11.2 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_12 = 12 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_12_8 = 12.8 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_13 = 13 / BASE_FONT_SIZE
export const GRAPHER_FONT_SCALE_14 = 14 / BASE_FONT_SIZE

export enum CookieKey {
    isAdmin = "isAdmin",
}

export const ThereWasAProblemLoadingThisChart = `There was a problem loading this chart`

export const WorldEntityName = "World"

export const isPopulationVariableId = (id: string): boolean =>
    id === "525709" || // "Population (historical + projections), Gapminder, HYDE & UN"
    id === "525711" || // "Population (historical estimates), Gapminder, HYDE & UN"
    id === "597929" || // "Population (various sources, 2023.1)"
    id === "597930" // "Population (various sources, 2023.1)"

export enum Patterns {
    noDataPattern = "noDataPattern",
    noDataPatternForMapChart = "noDataPatternForMapChart",
}

export const grapherInterfaceWithHiddenControlsOnly: GrapherProgrammaticInterface =
    {
        hideRelativeToggle: true,
        hideTimeline: true,
        hideFacetControl: true,
        hideEntityControls: true,
        hideZoomToggle: true,
        hideNoDataAreaToggle: true,
        hideFacetYDomainToggle: true,
        hideXScaleToggle: true,
        hideYScaleToggle: true,
        hideMapProjectionMenu: true,
        hideTableFilterToggle: true,
        map: {
            hideTimeline: true,
        },
    }

export const grapherInterfaceWithHiddenTabsOnly: GrapherProgrammaticInterface =
    {
        hasChartTab: false,
        hasMapTab: false,
        hasTableTab: false,
    }
