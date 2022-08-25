#! /usr/bin/env node

import parseArgs from "minimist"
import { SiteBaker } from "./SiteBaker.js"
import * as fs from "fs-extra"
import { normalize } from "path"

const bakeDomainToFolder = async (
    baseUrl = "http://localhost:3000/",
    dir = "localBake"
) => {
    dir = normalize(dir)
    fs.mkdirp(dir)
    const baker = new SiteBaker(dir, baseUrl)
    console.log(
        `Baking site sans Wordpress with baseUrl '${baseUrl}' to dir '${dir}'`
    )
    await baker.bakeNonWordpressPages()
}

const args = parseArgs(process.argv.slice(2))
const theArgs = args._
// Usage: yarn buildLocalBake http://localhost:3000/ localBake
// todo: can we just make all paths relative? why do we need absolute baked base url?
bakeDomainToFolder(theArgs[0], theArgs[1]).then((_) => {
    // TODO: without this the script hangs here since using the workerpool library in baking
    // I don't understand why this happens. Probably using top level await would also resolve
    // this but I couldn't get Typescript to play along with that
    process.exit(0)
})
