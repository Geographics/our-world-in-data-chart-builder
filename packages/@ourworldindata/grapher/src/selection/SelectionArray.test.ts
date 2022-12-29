#! /usr/bin/env jest
import { it, describe, expect, test } from "vitest"

import { SelectionArray } from "./SelectionArray"

it("can create a selection", () => {
    const selection = new SelectionArray(
        [],
        [{ entityName: "USA" }, { entityName: "Canada" }]
    )
    expect(selection.hasSelection).toEqual(false)

    selection.selectAll()
    expect(selection.hasSelection).toEqual(true)
    expect(selection.selectedEntityNames).toEqual(["USA", "Canada"])
})
