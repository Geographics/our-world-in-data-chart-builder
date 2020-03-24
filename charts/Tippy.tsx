import * as React from "react"
import { default as OriginalTippy, TippyProps } from "@tippy.js/react"
import "tippy.js/dist/tippy.css"
import "tippy.js/themes/light.css"

export const Tippy = (props: TippyProps) => (
    <OriginalTippy theme="light" {...props} />
)
