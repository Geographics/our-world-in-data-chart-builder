import {
    EnrichedBlockChart,
    EnrichedBlockText,
    OwidEnrichedArticleBlock,
    Span,
    SpanSimpleText,
} from "@ourworldindata/utils"

const spanSimpleText: SpanSimpleText = {
    spanType: "span-simple-text",
    text: "This is a text block with",
}

const boldLinkExampleText: Span[] = [
    {
        spanType: "span-simple-text",
        text: "This is a text block with ",
    },
    {
        spanType: "span-bold",
        children: [
            {
                spanType: "span-link",
                url: "https://ourworldindata.org",
                children: [
                    {
                        spanType: "span-simple-text",
                        text: "a link",
                    },
                ],
            },
        ],
    },
]

const enrichedBlockText: EnrichedBlockText = {
    type: "text",
    value: boldLinkExampleText,
    parseErrors: [],
}

const enrichedChart: EnrichedBlockChart = {
    type: "chart",
    url: "https://ourworldindata.org/grapher/total-cases-covid-19",
    parseErrors: [],
}

export const enrichedBlockExamples: Record<
    OwidEnrichedArticleBlock["type"],
    OwidEnrichedArticleBlock
> = {
    text: enrichedBlockText,
    aside: {
        type: "aside",
        position: "right",
        caption: boldLinkExampleText,
        parseErrors: [],
    },
    chart: {
        type: "chart",
        url: "https://ourworldindata.org/grapher/total-cases-covid-19",
        height: "400",
        row: "1",
        column: "1",
        position: "featured",
        caption: boldLinkExampleText,
        parseErrors: [],
    },
    scroller: {
        type: "scroller",
        blocks: [
            {
                url: "https://ourworldindata.org/grapher/total-cases-covid-19",
                text: enrichedBlockText,
            },
        ],
        parseErrors: [],
    },
    "chart-story": {
        type: "chart-story",
        items: [
            {
                narrative: enrichedBlockText,
                chart: enrichedChart,
                technical: [enrichedBlockText],
            },
        ],
        parseErrors: [],
    },
    "additional-charts": {
        type: "additional-charts",
        items: [boldLinkExampleText],
        parseErrors: [],
    },
    "fixed-graphic": {
        type: "fixed-graphic",
        graphic: enrichedChart,
        text: [enrichedBlockText],
        position: "right",
        parseErrors: [],
    },
    image: {
        type: "image",
        src: "https://ourworldindata.org/uploads/2022/03/Future-as-triangles-of-an-hour-glass-01.png",
        caption: boldLinkExampleText,
        parseErrors: [],
    },
    list: {
        type: "list",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    "numbered-list": {
        type: "numbered-list",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    "pull-quote": {
        type: "pull-quote",
        text: [spanSimpleText],
        parseErrors: [],
    },
    "horizontal-rule": {
        type: "horizontal-rule",
        parseErrors: [],
    },
    recirc: {
        type: "recirc",
        title: spanSimpleText,
        items: [
            {
                article: spanSimpleText,
                author: spanSimpleText,
                url: "https://ourworldindata.org/grapher/total-cases-covid-19",
            },
        ],
        parseErrors: [],
    },
    html: {
        type: "html",
        value: "<p>This is a paragraph</p>",
        parseErrors: [],
    },
    heading: {
        type: "heading",
        level: 1,
        text: boldLinkExampleText,
        supertitle: boldLinkExampleText,
        parseErrors: [],
    },
    "sdg-grid": {
        type: "sdg-grid",
        items: [
            {
                goal: "A test goal",
                link: "https://ourworldindata.org/grapher/total-cases-covid-19",
            },
        ],
        parseErrors: [],
    },
    "sticky-right": {
        type: "sticky-right",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    "sticky-left": {
        type: "sticky-left",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    "side-by-side": {
        type: "side-by-side",
        left: [enrichedBlockText],
        right: [enrichedBlockText],
        parseErrors: [],
    },
    "gray-section": {
        type: "gray-section",
        items: [enrichedBlockText],
        parseErrors: [],
    },
    "prominent-link": {
        type: "prominent-link",
        url: "https://ourworldindata.org/grapher/total-cases-covid-19",
        title: "A test title",
        description: "A test description",
        parseErrors: [],
    },
    "sdg-toc": {
        type: "sdg-toc",
        parseErrors: [],
    },
    "missing-data": {
        type: "missing-data",
        parseErrors: [],
    },
}
