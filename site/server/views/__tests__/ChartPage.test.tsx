#! /usr/bin/env jest

import * as React from "react"
import { shallow, ShallowWrapper } from "enzyme"

import { ChartPage } from "../ChartPage"
import { SiteHeader } from "../SiteHeader"
import { SiteFooter } from "../SiteFooter"
import { extend } from "charts/Util"
import { ChartConfigProps } from "charts/ChartConfig"

import * as fixtures from "test/fixtures"

describe(ChartPage, () => {
    let chart: ChartConfigProps

    beforeAll(() => {
        chart = new ChartConfigProps()
        extend(chart, fixtures.readChart(677))
    })

    describe("when the page is rendered", () => {
        let view: ShallowWrapper

        beforeAll(() => (view = shallow(<ChartPage chart={chart} />)))

        it("preloads the data", () => {
            const path = "/grapher/data/variables/104402.json?v=7"
            const selector = `link[rel="preload"][href="${path}"]`
            expect(view.find(selector)).toHaveLength(1)
        })

        it("renders a site header", () => {
            expect(view.find(SiteHeader)).toHaveLength(1)
        })

        it("renders a figure", () => {
            const selector =
                'figure[data-grapher-src="/grapher/child-mortality-rate-ihme"]'
            expect(view.find(selector)).toHaveLength(1)
        })

        it("renders a site footer", () => {
            expect(view.find(SiteFooter)).toHaveLength(1)
        })
    })
})
