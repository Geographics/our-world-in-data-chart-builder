import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GRAPHER_PAGE_BODY_CLASS,
    LoadingIndicator,
} from "@ourworldindata/grapher"
import {
    PostReference,
    RelatedChart,
    serializeJSONForHTML,
    GrapherInterface,
    uniq,
    SiteFooterContext,
    Url,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import {
    HIDE_IF_JS_DISABLED_CLASSNAME,
    HIDE_IF_JS_ENABLED_CLASSNAME,
} from "@ourworldindata/types"
import urljoin from "url-join"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../settings/clientSettings.js"
import { ChartListItemVariant } from "./ChartListItemVariant.js"
import { Head } from "./Head.js"
import { IFrameDetector } from "./IframeDetector.js"
import { RelatedArticles } from "./RelatedArticles/RelatedArticles.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"
import GrapherImage from "./GrapherImage.js"
import { Html } from "./Html.js"

export const GrapherPage = (props: {
    grapher: GrapherInterface
    relatedCharts?: RelatedChart[]
    relatedArticles?: PostReference[]
    baseUrl: string
    baseGrapherUrl: string
}) => {
    const { grapher, relatedCharts, relatedArticles, baseGrapherUrl, baseUrl } =
        props
    const pageTitle = grapher.title
    const canonicalUrl = urljoin(baseGrapherUrl, grapher.slug as string)
    const dataApiOrigin = Url.fromURL(DATA_API_URL).origin
    let pageDesc: string
    if (grapher.subtitle?.length) {
        // convert subtitle from markdown to plaintext
        pageDesc = new MarkdownTextWrap({
            text: grapher.subtitle,
            fontSize: 10,
        }).plaintext
    } else pageDesc = "An interactive visualization from Our World in Data."

    // Due to thumbnails not taking into account URL parameters, they are often inaccurate on
    // social media. We decided to remove them and use a single thumbnail for all charts.
    // See https://github.com/owid/owid-grapher/issues/1086
    //
    // const imageUrl = urljoin(
    //     baseGrapherUrl,
    //     "exports",
    //     `${grapher.slug}.png?v=${grapher.version}`
    // )
    const imageUrl: string = urljoin(baseUrl, "default-grapher-thumbnail.png")
    const imageWidth = "1200"
    const imageHeight = "628"

    const script = `const jsonConfig = ${serializeJSONForHTML({
        ...grapher,
        adminBaseUrl: ADMIN_BASE_URL,
        bakedGrapherURL: BAKED_GRAPHER_URL,
        dataApiUrl: DATA_API_URL,
    })}
window.Grapher.renderSingleGrapherOnGrapherPage(jsonConfig)`

    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))
    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                imageUrl={imageUrl}
                baseUrl={baseUrl}
            >
                <meta property="og:image:width" content={imageWidth} />
                <meta property="og:image:height" content={imageHeight} />
                <IFrameDetector />
                <link rel="preconnect" href={dataApiOrigin} />
                {variableIds.flatMap((variableId) =>
                    [
                        getVariableDataRoute(DATA_API_URL, variableId),
                        getVariableMetadataRoute(DATA_API_URL, variableId),
                    ].map((href) => (
                        <link
                            key={href}
                            rel="preload"
                            href={href}
                            as="fetch"
                            crossOrigin="anonymous"
                        />
                    ))
                )}
                <link
                    rel="preload"
                    href="/fonts/PlayfairDisplayLatin-SemiBold.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className={GRAPHER_PAGE_BODY_CLASS}>
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <figure
                        className={HIDE_IF_JS_DISABLED_CLASSNAME}
                        data-grapher-src={`/grapher/${grapher.slug}`}
                    >
                        <LoadingIndicator />
                    </figure>
                    <div className={HIDE_IF_JS_ENABLED_CLASSNAME} id="fallback">
                        {grapher.slug && (
                            <GrapherImage
                                slug={grapher.slug}
                                alt={grapher.title}
                                enablePopulatingUrlParams
                            />
                        )}
                        <p>Interactive visualization requires JavaScript</p>
                    </div>

                    {((relatedArticles && relatedArticles.length !== 0) ||
                        (relatedCharts && relatedCharts.length !== 0)) && (
                        <div className="related-research-data">
                            <h2>Related research and data</h2>
                            {relatedArticles &&
                                relatedArticles.length !== 0 && (
                                    <RelatedArticles
                                        articles={relatedArticles}
                                    />
                                )}
                            {relatedCharts && relatedCharts.length !== 0 && (
                                <>
                                    <h3>Charts</h3>
                                    <ul>
                                        {relatedCharts
                                            .filter(
                                                (chartItem) =>
                                                    chartItem.slug !==
                                                    grapher.slug
                                            )
                                            .map((c) => (
                                                <ChartListItemVariant
                                                    key={c.slug}
                                                    chart={c}
                                                />
                                            ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.grapherPage}
                />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{ __html: script }}
                />
            </body>
        </Html>
    )
}
