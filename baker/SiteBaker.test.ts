#! /usr/bin/env jest

import { SiteBaker } from "./SiteBaker"

it("can init", () => {
    const baker = new SiteBaker(
        __dirname + "/example.com",
        "https://example.com"
    )
    expect(baker).toBeTruthy()
})
