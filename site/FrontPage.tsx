import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import {
    faRss,
    faAngleRight,
    faExternalLinkAlt,
    faAngleDoubleDown,
    faArrowRight,
} from "@fortawesome/free-solid-svg-icons"
import {
    faTwitter,
    faFacebookSquare,
    faInstagram,
} from "@fortawesome/free-brands-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    NewsletterSubscriptionForm,
    NewsletterSubscriptionContext,
} from "../site/NewsletterSubscription.js"
import {
    CategoryWithEntries,
    EntryNode,
    IndexPost,
} from "@ourworldindata/utils"
import PostCard from "./PostCard/PostCard.js"

const splitOnLastWord = (str: string) => {
    const endIndex = (str.lastIndexOf(" ") as number) + 1
    return {
        start: endIndex === 0 ? "" : str.substring(0, endIndex),
        end: str.substring(endIndex),
    }
}

export const FrontPage = (props: {
    entries: CategoryWithEntries[]
    totalCharts: number
    baseUrl: string
    featuredWork: IndexPost[]
}) => {
    const { entries, totalCharts, baseUrl, featuredWork } = props

    // Structured data for google
    const structuredMarkup = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        url: baseUrl,
        potentialAction: {
            "@type": "SearchAction",
            target: `${baseUrl}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
        },
    }

    const renderEntry = (entry: EntryNode, categorySlug: string) => {
        const { start: titleStart, end: titleEnd } = splitOnLastWord(
            entry.title
        )
        return (
            <a
                key={entry.slug}
                href={`/${entry.slug}`}
                className={`entry-item-container ${categorySlug}-color`}
                data-track-note="homepage_entries"
            >
                <div className="entry-item">
                    <div className="top">
                        {entry.kpi && (
                            <div
                                className="kpi"
                                dangerouslySetInnerHTML={{
                                    __html: entry.kpi,
                                }}
                            />
                        )}
                        <p className="excerpt">{entry.excerpt}</p>
                    </div>
                    <div className="bottom">
                        <h5>
                            {titleStart}
                            <span>
                                {titleEnd}
                                <FontAwesomeIcon icon={faArrowRight} />
                            </span>
                        </h5>
                    </div>
                </div>
            </a>
        )
    }

    return (
        <html>
            <Head canonicalUrl={baseUrl} baseUrl={baseUrl}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(structuredMarkup),
                    }}
                />
            </Head>
            <body className="FrontPage">
                <SiteHeader baseUrl={baseUrl} />

                <section className="homepage-masthead">
                    <div className="wrapper">
                        <h1>
                            Research and data to make progress against the
                            world’s largest problems
                        </h1>
                        <a
                            href="#entries"
                            className="see-all"
                            data-smooth-scroll
                            data-track-note="homepage_scroll"
                        >
                            Scroll to all of our topics
                            <span className="icon">
                                <FontAwesomeIcon icon={faAngleDoubleDown} />
                            </span>
                        </a>
                        <p>{totalCharts} charts across 297 topics</p>
                        <p>All free: open access and open source</p>
                    </div>
                </section>

                <section className="homepage-coverage">
                    <div className="wrapper">
                        <div className="inner-wrapper">
                            <div className="owid-row owid-spacing--4">
                                <div className="owid-col owid-col--lg-2">
                                    <section>
                                        <h3 className="align-center">
                                            Trusted in{" "}
                                            <strong>research and media</strong>
                                        </h3>
                                        <a
                                            href="/about/coverage#coverage"
                                            className="coverage-link"
                                            data-track-note="homepage_trust"
                                        >
                                            <img
                                                src={`${baseUrl}/media-logos-wide.png`}
                                                alt="Logos of the publications that have used our content"
                                            />
                                            <div className="hover-note">
                                                <p>
                                                    Find out how our work is
                                                    used by journalists and
                                                    researchers
                                                </p>
                                            </div>
                                        </a>
                                    </section>
                                    <section>
                                        <h3 className="align-center">
                                            Used in <strong>teaching</strong>
                                        </h3>
                                        <a
                                            href="/about/coverage#teaching"
                                            className="coverage-link"
                                            data-track-note="homepage_trust"
                                        >
                                            <img
                                                src={`${baseUrl}/university-logos-wide.png`}
                                                alt="Logos of the universities that have used our content"
                                            />
                                            <div className="hover-note">
                                                <p>
                                                    Find out how our work is
                                                    used in teaching
                                                </p>
                                            </div>
                                        </a>
                                    </section>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="homepage-posts">
                    <div className="wrapper">
                        <div className="owid-row">
                            <div className="owid-col flex-row">
                                <div className="homepage-posts--explainers">
                                    <div className="header">
                                        <h2>Featured work</h2>
                                    </div>
                                    <ul>
                                        {featuredWork.map((post) => (
                                            <li key={post.slug}>
                                                <PostCard
                                                    post={post}
                                                    hideDate={true}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="see-all">
                                        <a
                                            href="/blog"
                                            data-track-note="homepage_see_all_explainers"
                                        >
                                            <div className="label">
                                                See all of our work
                                            </div>
                                            <div className="icon">
                                                <FontAwesomeIcon
                                                    icon={faAngleRight}
                                                />
                                            </div>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="homepage-subscribe" id="subscribe">
                    <div className="wrapper">
                        <div className="owid-row">
                            <div className="owid-col owid-col--lg-2 flex-row">
                                <div className="newsletter-subscription">
                                    <div className="box">
                                        <h2>Subscribe to our newsletter</h2>
                                        <div className="root">
                                            {/* Hydrated in runSiteTools() */}
                                            <NewsletterSubscriptionForm
                                                context={
                                                    NewsletterSubscriptionContext.Homepage
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="owid-col owid-col--lg-1">
                                <div className="homepage-subscribe--social-media">
                                    <div className="shaded-box">
                                        <h2>Follow us</h2>
                                        <div className="list">
                                            <a
                                                href="https://twitter.com/ourworldindata"
                                                className="list-item"
                                                title="Twitter"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                data-track-note="homepage_follow_us"
                                            >
                                                <div className="icon">
                                                    <FontAwesomeIcon
                                                        icon={faTwitter}
                                                    />
                                                </div>
                                                <div className="label">
                                                    Twitter
                                                </div>
                                            </a>
                                            <a
                                                href="https://facebook.com/ourworldindata"
                                                className="list-item"
                                                title="Facebook"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                data-track-note="homepage_follow_us"
                                            >
                                                <div className="icon">
                                                    <FontAwesomeIcon
                                                        icon={faFacebookSquare}
                                                    />
                                                </div>
                                                <div className="label">
                                                    Facebook
                                                </div>
                                            </a>
                                            <a
                                                href="https://www.instagram.com/ourworldindata/"
                                                className="list-item"
                                                title="Instagram"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                data-track-note="homepage_follow_us"
                                            >
                                                <div className="icon">
                                                    <FontAwesomeIcon
                                                        icon={faInstagram}
                                                    />
                                                </div>
                                                <div className="label">
                                                    Instagram
                                                </div>
                                            </a>
                                            <a
                                                href="/feed"
                                                className="list-item"
                                                title="RSS"
                                                target="_blank"
                                                data-track-note="homepage_follow_us"
                                            >
                                                <div className="icon">
                                                    <FontAwesomeIcon
                                                        icon={faRss}
                                                    />
                                                </div>
                                                <div className="label">
                                                    RSS Feed
                                                </div>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="homepage-projects">
                    <div className="wrapper">
                        <div className="list">
                            <a
                                href="https://sdg-tracker.org"
                                className="list-item"
                                data-track-note="homepage_projects"
                            >
                                <div className="icon-left">
                                    <img
                                        src={`${baseUrl}/sdg-wheel.png`}
                                        alt="SDG Tracker logo"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="content">
                                    <h3>
                                        Sustainable Development Goals Tracker
                                    </h3>
                                    <p>
                                        Is the world on track to reach the
                                        Sustainable Development Goals?
                                    </p>
                                </div>
                                <div className="icon-right">
                                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                                </div>
                            </a>
                            <a
                                href="/teaching"
                                className="list-item"
                                data-track-note="homepage_projects"
                            >
                                <div className="icon-left">
                                    <img
                                        src={`${baseUrl}/teaching-hub.svg`}
                                        alt="Teaching Hub logo"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="content">
                                    <h3>Teaching Hub</h3>
                                    <p>
                                        Slides, research, and visualizations for
                                        teaching and learning about global
                                        development
                                    </p>
                                </div>
                                <div className="icon-right">
                                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                                </div>
                            </a>
                        </div>
                    </div>
                </section>

                <section id="entries" className="homepage-entries">
                    <div className="wrapper">
                        <h2>
                            All of our pages on global problems and global
                            changes
                        </h2>
                        {entries.map((category) => (
                            <div
                                key={category.slug}
                                className="category-wrapper"
                            >
                                <h3
                                    className={`${category.slug}-color`}
                                    id={category.slug}
                                >
                                    {category.name}
                                </h3>
                                {!!category.entries.length && (
                                    <div className="category-entries">
                                        {category.entries.map((entry) =>
                                            renderEntry(entry, category.slug)
                                        )}
                                    </div>
                                )}
                                {category.subcategories.map((subcategory) => (
                                    <div key={subcategory.slug}>
                                        <h4
                                            className={`${category.slug}-color`}
                                        >
                                            {subcategory.name}
                                        </h4>
                                        <div className="category-entries">
                                            {subcategory.entries.map((entry) =>
                                                renderEntry(
                                                    entry,
                                                    category.slug
                                                )
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                <SiteFooter baseUrl={baseUrl} />
            </body>
        </html>
    )
}
