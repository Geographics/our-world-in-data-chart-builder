import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons"
import { AssetMapEntry, SiteFooterContext } from "@ourworldindata/utils"
import { viteAssetsForSite } from "./viteUtils.js"
import { ScriptLoadErrorDetector } from "./NoJSDetector.js"
import { RSS_FEEDS, SOCIALS } from "./SiteConstants.js"

interface SiteFooterProps {
    hideDonate?: boolean
    hideDonationFlag?: boolean
    baseUrl: string
    context?: SiteFooterContext
    debug?: boolean
    isPreviewing?: boolean
    viteAssetMap?: AssetMapEntry
    runtimeAssetMap?: AssetMapEntry
}

export const SiteFooter = (props: SiteFooterProps) => (
    <>
        {!props.hideDonate && (
            <section className="donate-footer">
                <div className="wrapper">
                    <div className="owid-row flex-align-center">
                        <div className="owid-col owid-col--lg-3 owid-padding-bottom--sm-3">
                            <p>
                                Our World in Data is free and accessible for
                                everyone.
                            </p>
                            <p>Help us do this work by making a donation.</p>
                        </div>
                        <div className="owid-col owid-col--lg-1">
                            <a
                                href="/donate"
                                className="owid-button donate-button"
                                data-track-note="donate_footer"
                            >
                                <span className="label">Donate now</span>
                                <span className="icon">
                                    <FontAwesomeIcon icon={faAngleRight} />
                                </span>
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        )}
        <footer className="site-footer">
            <div className="wrapper">
                <div className="owid-row">
                    <div className="owid-col owid-col--lg-1">
                        <ul>
                            <li>
                                <a
                                    href="/about"
                                    data-track-note="footer_navigation"
                                >
                                    About
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/about#contact"
                                    data-track-note="footer_navigation"
                                >
                                    Contact
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/feedback"
                                    data-track-note="footer_navigation"
                                >
                                    Feedback
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/jobs"
                                    data-track-note="footer_navigation"
                                >
                                    Jobs
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/funding"
                                    data-track-note="footer_navigation"
                                >
                                    Funding
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/faqs"
                                    data-track-note="footer_navigation"
                                >
                                    FAQs
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/donate"
                                    data-track-note="footer_navigation"
                                >
                                    Donate
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/privacy-policy"
                                    data-track-note="footer_navigation"
                                >
                                    Privacy policy
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div className="owid-col owid-col--lg-1">
                        <ul>
                            <li>
                                <a
                                    href="/latest"
                                    data-track-note="footer_navigation"
                                >
                                    Latest work
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/data"
                                    data-track-note="footer_navigation"
                                >
                                    Data Catalog
                                </a>
                            </li>
                            {SOCIALS.map(({ title, url }) => (
                                <li key={title}>
                                    <a
                                        href={url}
                                        data-track-note="footer_navigation"
                                    >
                                        {title}
                                    </a>
                                </li>
                            ))}
                            <li>
                                <a
                                    href="https://github.com/owid"
                                    data-track-note="footer_navigation"
                                >
                                    GitHub
                                </a>
                            </li>
                            {RSS_FEEDS.map(({ title, url }) => (
                                <li key={title}>
                                    <a
                                        href={url}
                                        data-track-note="footer_navigation"
                                    >
                                        {title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="owid-col owid-col--lg-1">
                        <div className="logos">
                            <a
                                href="https://www.oxfordmartin.ox.ac.uk/global-development"
                                className="partner-logo"
                                data-track-note="footer_navigation"
                            >
                                <picture>
                                    <source
                                        type="image/avif"
                                        srcSet={`${props.baseUrl}/oms-logo.avif`}
                                    />
                                    <img
                                        src={`${props.baseUrl}/oms-logo.png`}
                                        alt="Oxford Martin School logo"
                                        loading="lazy"
                                        width={275}
                                        height={139}
                                    />
                                </picture>
                            </a>
                            <a
                                href="/owid-at-ycombinator"
                                className="partner-logo"
                                data-track-note="footer_navigation"
                            >
                                <picture>
                                    <source
                                        type="image/avif"
                                        srcSet={`${props.baseUrl}/yc-logo.avif`}
                                    />
                                    <img
                                        src={`${props.baseUrl}/yc-logo.png`}
                                        alt="Y Combinator logo"
                                        loading="lazy"
                                        width={490}
                                        height={138}
                                    />
                                </picture>
                            </a>
                        </div>
                    </div>
                    <div className="owid-col flex-2">
                        <div className="legal">
                            <p>
                                Licenses: All visualizations, data, and articles
                                produced by Our World in Data are open access
                                under the{" "}
                                <a
                                    href="https://creativecommons.org/licenses/by/4.0/"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    Creative Commons BY license
                                </a>
                                . You have permission to use, distribute, and
                                reproduce these in any medium, provided the
                                source and authors are credited. All the
                                software and code that we write is open source
                                and made available via GitHub under the
                                permissive{" "}
                                <a
                                    href="https://github.com/owid/owid-grapher/blob/master/LICENSE.md "
                                    target="_blank"
                                    rel="noopener"
                                >
                                    MIT license
                                </a>
                                . All other material, including data produced by
                                third parties and made available by Our World in
                                Data, is subject to the license terms from the
                                original third-party authors.
                            </p>
                            <p>
                                Please consult our full{" "}
                                <a href="/organization#legal-disclaimer">
                                    legal disclaimer
                                </a>
                                .
                            </p>
                            <p className="legal--last-paragraph">
                                <span>
                                    Our World in Data is a project of the{" "}
                                    <a href="https://global-change-data-lab.org/">
                                        Global Change Data Lab
                                    </a>
                                    , a registered charity in England and Wales
                                    (Charity Number 1186433).
                                </span>
                                <a
                                    href="https://global-change-data-lab.org/"
                                    className="partner-logo gcdl-logo"
                                    data-track-note="footer_navigation"
                                >
                                    <picture>
                                        <source
                                            type="image/webp"
                                            srcSet={`${props.baseUrl}/gcdl-logo.webp`}
                                        />
                                        <img
                                            src={`${props.baseUrl}/gcdl-logo.png`}
                                            alt="Global Change Data Lab logo"
                                            loading="lazy"
                                            width={106}
                                            height={127}
                                        />
                                    </picture>
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="site-tools" />
            {viteAssetsForSite({ viteAssetMap: props.viteAssetMap }).forFooter}
            <ScriptLoadErrorDetector />
            <script
                type="module"
                dangerouslySetInnerHTML={{
                    __html: `window.runSiteFooterScripts(${JSON.stringify({
                        context: props.context,
                        debug: props.debug,
                        isPreviewing: props.isPreviewing,
                        hideDonationFlag: props.hideDonationFlag,
                        runtimeAssetMap: props.runtimeAssetMap,
                    })})`, // todo: gotta be a better way.
                }}
            />
        </footer>
    </>
)
