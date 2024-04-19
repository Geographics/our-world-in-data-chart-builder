import { EnrichedBlockExplorerTiles } from "@ourworldindata/types"
import { Button } from "@ourworldindata/components"
import React, { useContext } from "react"
import { useLinkedChart } from "../utils.js"
import { DocumentContext } from "../OwidGdoc.js"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"

function ExplorerTile({ url }: { url: string }) {
    const { linkedChart, errorMessage } = useLinkedChart(url)
    const { isPreviewing } = useContext(DocumentContext)
    if (errorMessage && isPreviewing) {
        return <p>{errorMessage}</p>
    }
    if (!linkedChart) {
        return null
    }
    const icon = linkedChart.tags[0] ? (
        <img
            height={40}
            width={40}
            src={`${BAKED_BASE_URL}/images/tag-icons/${encodeURIComponent(
                linkedChart.tags[0].name
            )}.svg`}
            className="explorer-tile__icon"
            alt={`Icon for topic ${linkedChart.tags[0].name}`}
            loading="lazy"
        />
    ) : null

    return (
        <a
            className="explorer-tile span-cols-3 span-md-cols-6"
            href={linkedChart.resolvedUrl}
        >
            {icon}
            <div className="explorer-tile__text-container">
                <p className="h3-bold explorer-tile__title">
                    {linkedChart.title}
                </p>
                <p className="h3-bold explorer-tile__suffix"> Data Explorer</p>
            </div>
        </a>
    )
}

type ExplorerTilesProps = EnrichedBlockExplorerTiles & {
    className?: string
}

export function ExplorerTiles({
    className,
    title,
    subtitle,
    explorers,
}: ExplorerTilesProps) {
    return (
        <div className={className}>
            <h2 className="h2-bold span-cols-6 span-md-12 explorer-tiles__title">
                {title}
            </h2>
            <Button
                className="span-cols-4 col-start-9 span-md-cols-5 col-md-start-8 col-sm-start-1 span-sm-cols-12 body-3-medium explorer-tiles__cta"
                href="/charts"
                text="See all our Data Explorers"
                theme="outline-vermillion"
            />

            <p className="body-2-regular explorer-tiles__subtitle span-cols-8 span-md-cols-7 span-sm-cols-12">
                {subtitle}
            </p>
            <div className="span-cols-12 grid explorer-tiles-grid">
                {explorers.map((explorer) => (
                    <ExplorerTile key={explorer.url} {...explorer} />
                ))}
            </div>
        </div>
    )
}
