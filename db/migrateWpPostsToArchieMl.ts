// WIP: Script to export the data_values for all variables attached to charts

import * as db from "./db.js"
import * as cheerio from "cheerio"

import {
    EnrichedBlockText,
    OwidArticlePublicationContext,
    OwidArticleType,
    sortBy,
} from "@ourworldindata/utils"
import * as Post from "./model/Post.js"
import fs from "fs"
import {
    cheerioElementsToArchieML,
    withoutEmptyOrWhitespaceOnlyTextBlocks,
    convertAllWpComponentsToArchieMLBlocks,
    getEnrichedBlockTextFromBlockParseResult,
} from "./model/Gdoc/htmlToEnriched.js"

const migrate = async (): Promise<void> => {
    const writeToFile = false
    await db.getConnection()

    const posts = await Post.select(
        "id",
        "slug",
        "title",
        "content",
        "published_at",
        "updated_at_in_wordpress",
        "authors",
<<<<<<< HEAD
        "excerpt",
        "created_at_in_wordpress",
        "updated_at"
    ).from(db.knexTable(Post.postsTable)) //.where("id", "=", "22821"))
||||||| parent of 727c5acc6 (feat: add backporting of prominent links)
        "excerpt"
    ).from(db.knexTable(Post.postsTable)) //.where("id", "=", "22821"))
=======
        "excerpt"
    ).from(db.knexTable(Post.postsTable)) //.where("id", "=", "1441"))
>>>>>>> 727c5acc6 (feat: add backporting of prominent links)

    for (const post of posts) {
        try {
            let text = post.content
            const refs = (text.match(/{ref}(.*?){\/ref}/gims) || []).map(
                function (val: string, i: number) {
                    // mutate original text
                    text = text.replace(
                        val,
                        `<a class="ref" href="#note-${i + 1}"><sup>${
                            i + 1
                        }</sup></a>`
                    )
                    // return inner text
                    return val.replace(/\{\/?ref\}/g, "")
                }
            )
            //TODO: we don't seem to get the first node if it is a comment.
            // Maybe this is benign but if not this works as a workaround:
            //`<div>${post.content}</div>`)
            const $: CheerioStatic = cheerio.load(text)
            const bodyContents = $("body").contents().toArray()
            const parsingContext = {
                $,
                shouldParseWpComponents: true,
                htmlTagCounts: {},
                wpTagCounts: {},
            }
            const parsedResult = cheerioElementsToArchieML(
                bodyContents,
                parsingContext
            )
            const archieMlBodyElements = convertAllWpComponentsToArchieMLBlocks(
                withoutEmptyOrWhitespaceOnlyTextBlocks(parsedResult).content
            )

            let errors = parsedResult.errors
            const refParsingResults = refs.map(
                (refString): EnrichedBlockText => {
                    const $ref = cheerio.load(refString)
                    const refElements = $ref("body").contents().toArray()
                    const parseResult = cheerioElementsToArchieML(refElements, {
                        $,
                        shouldParseWpComponents: false,
                        htmlTagCounts: {},
                        wpTagCounts: {},
                    })
                    const textContentResult =
                        getEnrichedBlockTextFromBlockParseResult(parseResult)
                    errors = errors.concat(textContentResult.errors)
                    return {
                        type: "text",
                        value: textContentResult.content.flatMap(
                            (b) => b.value
                        ),
                        parseErrors: textContentResult.content.flatMap(
                            (b) => b.parseErrors
                        ),
                    }
                }
            )

            // request a weekday along with a long date
            const options = {
                year: "numeric",
                month: "long",
                day: "numeric",
            } as const
            const dateline = post.published_at
                ? post.published_at.toLocaleDateString("en-US", options)
                : ""

            const authors: { author: string; order: number }[] = JSON.parse(
                post.authors
            )

            const archieMlFieldContent: OwidArticleType = {
                id: `wp-${post.id}`,
                slug: post.slug,
                content: {
                    body: archieMlBodyElements,
                    title: post.title,
                    subtitle: post.excerpt,
                    excerpt: post.excerpt,
                    byline: sortBy(authors, ["order"])
                        .map((author) => author.author)
                        .join(", "),
                    dateline: dateline,
                    // TODO: this discards block level elements - those might be needed?
                    refs: refParsingResults,
                },
<<<<<<< HEAD
                published: false,
                createdAt:
                    post.created_at_in_wordpress ??
                    post.updated_at_in_wordpress ??
                    post.updated_at ??
                    new Date(),
||||||| parent of 727c5acc6 (feat: add backporting of prominent links)
                published: false, // post.published_at !== null,
                createdAt: post.updated_at_in_wordpress, // TODO: this is wrong but it doesn't seem that wordpress tracks the creation date
=======
                published: false, // post.published_at !== null,
                createdAt: post.updated_at_in_wordpress ?? new Date(), // TODO: this is wrong but it doesn't seem that wordpress tracks the creation date
>>>>>>> 727c5acc6 (feat: add backporting of prominent links)
                publishedAt: post.published_at,
                updatedAt: post.updated_at_in_wordpress,
                publicationContext: OwidArticlePublicationContext.listed, // TODO: not all articles are listed, take this from the DB
                revisionId: null,
            }
            const archieMlStatsContent = {
                errors,
                numErrors: errors.length,
                numBlocks: archieMlBodyElements.length,
                htmlTagCounts: parsingContext.htmlTagCounts,
                wpTagCounts: parsingContext.wpTagCounts,
            }

            const insertQuery = `
        UPDATE posts SET archieml = ?, archieml_update_statistics = ? WHERE id = ?
        `
            await db.queryMysql(insertQuery, [
                JSON.stringify(archieMlFieldContent, null, 2),
                JSON.stringify(archieMlStatsContent, null, 2),
                post.id,
            ])
            console.log("inserted", post.id)

            if (writeToFile) {
                try {
                    fs.writeFileSync(
                        `./wpmigration/${post.slug}.html`,
                        post.content
                    )
                    // file written successfully
                } catch (err) {
                    console.error(err)
                }
                const parsedJson = JSON.stringify(archieMlBodyElements, null, 2)
                try {
                    fs.writeFileSync(
                        `./wpmigration/${post.slug}.json`,
                        parsedJson
                    )
                    // file written successfully
                } catch (err) {
                    console.error(err)
                }
            }
        } catch (e) {
            console.error("Caught an exception", post.id)
            throw e
        }
    }

    // const sortedTagCount = _.sortBy(
    //     Array.from(tagCounts.entries()),
    //     ([tag, count]) => tag
    // )
    // for (const [tag, count] of sortedTagCount) {
    //     console.log(`${tag}: ${count}`)
    // }

    await db.closeTypeOrmAndKnexConnections()
}

migrate()
