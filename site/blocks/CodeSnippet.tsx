import React, { useEffect, useState } from "react"
import classnames from "classnames"
import ReactDOM from "react-dom"
import ReactDOMServer from "react-dom/server.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCopy } from "@fortawesome/free-solid-svg-icons"
import { canWriteToClipboard } from "@ourworldindata/utils"

export const CodeSnippet = ({
    code,
    theme = "dark",
}: {
    code: string
    theme?: "dark" | "light"
}) => {
    const [canCopy, setCanCopy] = useState(false)
    const [hasCopied, setHasCopied] = useState(false)

    useEffect(() => {
        canWriteToClipboard().then(setCanCopy)
    }, [])

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            setHasCopied(true)
            // reset CSS animation
            setTimeout(() => setHasCopied(false), 10)
        } catch (err) {
            console.error(
                "Couldn't copy to clipboard using navigator.clipboard",
                err
            )
        }
    }

    return (
        <div className={`wp-code-snippet wp-code-snippet--${theme}`}>
            <pre className="wp-block-code">
                <code>{code}</code>
            </pre>
            {canCopy && (
                <button
                    className={classnames("code-copy-button", {
                        "code-copy-button--has-copied": hasCopied,
                    })}
                    onClick={copy}
                    aria-label="Copy to clipboard"
                >
                    <FontAwesomeIcon icon={faCopy} />
                </button>
            )}
        </div>
    )
}

export const hydrateCodeSnippets = () => {
    const codeSnippets = document.querySelectorAll("div.wp-code-snippet")

    codeSnippets.forEach((snippet) => {
        const code =
            snippet.querySelector(".wp-block-code code")?.textContent || ""
        ReactDOM.hydrate(<CodeSnippet code={code} />, snippet.parentElement)
    })
}

export const renderCodeSnippets = ($: CheerioStatic) => {
    const codeSnippets = $("div.wp-code-snippet")
    codeSnippets.each((_, snippet) => {
        const $el = $(snippet)
        const $dry = $(
            ReactDOMServer.renderToStaticMarkup(
                <div>
                    <CodeSnippet code={$el.text().trim()} />
                </div>
            )
        )
        $el.after($dry)
        $el.remove()
    })
}
