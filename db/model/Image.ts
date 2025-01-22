import { DbEnrichedImage, DbRawImage } from "@ourworldindata/types"
import { parseImageRow } from "@ourworldindata/utils"
import { KnexReadonlyTransaction } from "../db.js"

/**
 * Get all images that haven't been replaced
 **/
export async function getAllImages(
    knex: KnexReadonlyTransaction
): Promise<DbEnrichedImage[]> {
    const images = await knex
        .table("images")
        .where("replacedBy", null)
        .select<DbRawImage[]>()
    return images.map(parseImageRow)
}

export async function getImagesByFilenames(
    knex: KnexReadonlyTransaction,
    filenames: string[]
): Promise<DbEnrichedImage[]> {
    const images = await knex
        .table("images")
        .where("replacedBy", null)
        .whereIn("filename", filenames)
        .select<DbRawImage[]>()
    return images.map(parseImageRow)
}
