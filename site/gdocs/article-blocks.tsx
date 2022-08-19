import React from "react"
import ArticleBlock from "./article-block.js"
import { OwidArticleBlock } from "./gdoc-types.js"

export const ArticleBlocks = ({ blocks }: { blocks: OwidArticleBlock[] }) => (
    <>
        {blocks.map((block: OwidArticleBlock, i: number) => {
            return <ArticleBlock key={i} d={block} />
        })}
    </>
)
