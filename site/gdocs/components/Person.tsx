import { useMediaQuery } from "usehooks-ts"

import { EnrichedBlockPerson } from "@ourworldindata/types"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "../../SiteConstants.js"
import { useLinkedDocument } from "../utils.js"
import { ArticleBlocks } from "./ArticleBlocks.js"
import Image from "./Image.js"
import { Socials } from "./Socials.js"

export default function Person({ person }: { person: EnrichedBlockPerson }) {
    const { linkedDocument } = useLinkedDocument(person.url ?? "")
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY)
    const url = linkedDocument?.url

    const heading = <h3 className="person-heading">{person.name}</h3>

    const header = (
        <div className="person-header">
            {url ? <a href={url}>{heading}</a> : heading}
            {person.title && (
                <span className="person-title">{person.title}</span>
            )}
        </div>
    )

    const image = person.image ? (
        <Image
            className="person-image"
            filename={person.image}
            containerType="person"
            shouldLightbox={false}
        />
    ) : null

    return (
        <div className="person">
            {person.image && (
                <div className="person-image-container">
                    {url ? (
                        <a href={url} className="person-image--link-wrapper">
                            {image}
                        </a>
                    ) : (
                        image
                    )}
                    {isSmallScreen && header}
                </div>
            )}
            <div>
                {(!person.image || !isSmallScreen) && header}
                <ArticleBlocks blocks={person.text} />
                {person.socials && (
                    <Socials
                        className="person-socials"
                        links={person.socials}
                    />
                )}
            </div>
        </div>
    )
}
