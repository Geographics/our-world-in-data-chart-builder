import * as db from "../db.js"
import { Knex } from "knex"
import {
    PostRowEnriched,
    PostRowRaw,
    parsePostRow,
} from "@ourworldindata/utils"

export const postsTable = "posts"

export const select = <K extends keyof PostRowRaw>(
    ...args: K[]
): {
    from: (query: Knex.QueryBuilder) => Promise<Pick<PostRowRaw, K>[]>
} => ({
    from: (query) => query.select(...args) as any,
})

export const getTagsByPostId = async (): Promise<
    Map<number, { id: number; name: string }[]>
> => {
    const postTags = await db.queryMysql(`
            SELECT pt.post_id AS postId, pt.tag_id AS tagId, t.name as tagName FROM post_tags pt
            JOIN posts p ON p.id=pt.post_id
            JOIN tags t ON t.id=pt.tag_id
        `)

    const tagsByPostId: Map<number, { id: number; name: string }[]> = new Map()

    for (const pt of postTags) {
        const tags = tagsByPostId.get(pt.postId) || []
        tags.push({ id: pt.tagId, name: pt.tagName })
        tagsByPostId.set(pt.postId, tags)
    }

    return tagsByPostId
}

export const setTags = async (
    postId: number,
    tagIds: number[]
): Promise<void> =>
    await db.transaction(async (t) => {
        const tagRows = tagIds.map((tagId) => [tagId, postId])
        await t.execute(`DELETE FROM post_tags WHERE post_id=?`, [postId])
        if (tagRows.length)
            await t.execute(
                `INSERT INTO post_tags (tag_id, post_id) VALUES ?`,
                [tagRows]
            )
    })

export const setTagsForPost = async (
    postId: number,
    tagIds: number[]
): Promise<void> =>
    await db.transaction(async (t) => {
        const tagRows = tagIds.map((tagId) => [tagId, postId])
        await t.execute(`DELETE FROM post_tags WHERE post_id=?`, [postId])
        if (tagRows.length)
            await t.execute(
                `INSERT INTO post_tags (tag_id, post_id) VALUES ?`,
                [tagRows]
            )
    })

export const getPostRawBySlug = async (
    slug: string
): Promise<PostRowRaw | undefined> =>
    (await db.knexTable("posts").where({ slug: slug }))[0]

export const getPostEnrichedBySlug = async (
    slug: string
): Promise<PostRowEnriched | undefined> => {
    const post = await getPostRawBySlug(slug)
    if (!post) return undefined
    return parsePostRow(post)
}
