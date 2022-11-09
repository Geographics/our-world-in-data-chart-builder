#! /usr/bin/env jest

import { getCountryDetectionRedirects } from "./countries.js"

it("generates correct country redirect urls for netlify", () => {
    expect(getCountryDetectionRedirects()).toContain(
        `/detect-country-redirect /detect-country.js?GBR 302! Country=gb`
    )
})
