#! /usr/bin/env node
import { bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers } from "./GrapherBaker.js"
import * as db from "../db/db.js"

/**
 * This bakes all the Graphers to a folder on your computer, running the same baking code as the SiteBaker.
 *
 * Usage: ./runBakeGraphers.ts ~/folder_to_bake_to
 */

const main = async (folder: string) => {
    await bakeAllChangedGrapherPagesVariablesPngSvgAndDeleteRemovedGraphers(
        folder,
        db.knexInstance()
    )
}

const dir = process.argv.slice(2).join(" ")
main(dir)
