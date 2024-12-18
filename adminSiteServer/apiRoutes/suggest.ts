import {
    TaggableType,
    DbChartTagJoin,
    JsonError,
    DbEnrichedImage,
} from "@ourworldindata/types"
import { parseIntOrUndefined } from "@ourworldindata/utils"
import { getGptTopicSuggestions } from "../../db/model/Chart.js"
import { CLOUDFLARE_IMAGES_URL } from "../../settings/clientSettings.js"
import { apiRouter } from "../apiRouter.js"
import { getRouteWithROTransaction } from "../functionalRouterHelpers.js"
import { fetchGptGeneratedAltText } from "../imagesHelpers.js"

getRouteWithROTransaction(
    apiRouter,
    `/gpt/suggest-topics/${TaggableType.Charts}/:chartId.json`,
    async (req, res, trx): Promise<Record<"topics", DbChartTagJoin[]>> => {
        const chartId = parseIntOrUndefined(req.params.chartId)
        if (!chartId) throw new JsonError(`Invalid chart ID`, 400)

        const topics = await getGptTopicSuggestions(trx, chartId)

        if (!topics.length)
            throw new JsonError(
                `No GPT topic suggestions found for chart ${chartId}`,
                404
            )

        return {
            topics,
        }
    }
)

getRouteWithROTransaction(
    apiRouter,
    `/gpt/suggest-alt-text/:imageId`,
    async (
        req,
        res,
        trx
    ): Promise<{
        success: boolean
        altText: string | null
    }> => {
        const imageId = parseIntOrUndefined(req.params.imageId)
        if (!imageId) throw new JsonError(`Invalid image ID`, 400)
        const image = await trx<DbEnrichedImage>("images")
            .where("id", imageId)
            .first()
        if (!image) throw new JsonError(`No image found for ID ${imageId}`, 404)

        const src = `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/public`
        let altText: string | null = ""
        try {
            altText = await fetchGptGeneratedAltText(src)
        } catch (error) {
            console.error(
                `Error fetching GPT alt text for image ${imageId}`,
                error
            )
            throw new JsonError(`Error fetching GPT alt text: ${error}`, 500)
        }

        if (!altText) {
            throw new JsonError(`Unable to generate alt text for image`, 404)
        }

        return { success: true, altText }
    }
)
