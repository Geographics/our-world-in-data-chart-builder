import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { IconDefinition, faArrowRight } from "@fortawesome/free-solid-svg-icons"

type ButtonCommonProps = {
    text: string
    className?: string
    theme: "solid-vermillion" | "outline-vermillion" | "solid-blue"
    /** Set to null to hide the icon */
    icon?: IconDefinition | null
}

type WithHrefProps = {
    href: string
    onClick?: never
    ariaLabel?: never
    type?: never
}

type WithOnClickProps = {
    onClick?: () => void
    href?: never
    ariaLabel: string
    type?: "button" | "submit"
}

export type ButtonProps =
    | (ButtonCommonProps & WithHrefProps)
    | (ButtonCommonProps & WithOnClickProps)

export const Button = ({
    theme = "solid-vermillion",
    className,
    href,
    onClick,
    text,
    ariaLabel,
    type = "button",
    icon = faArrowRight,
}: ButtonProps) => {
    const classes = cx("owid-btn", `owid-btn--${theme}`, className)

    if (href) {
        return (
            <a className={classes} href={href}>
                {text} {icon && <FontAwesomeIcon icon={icon} />}
            </a>
        )
    }

    return (
        <button
            aria-label={ariaLabel}
            type={type}
            className={classes}
            onClick={onClick}
        >
            {text} {icon && <FontAwesomeIcon icon={icon} />}
        </button>
    )
}
