import { faArrowLeftLong } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { GalleryArrowDirection } from "../SiteConstants.js"

export const GalleryArrow = ({
    disabled,
    onClick,
    direction,
}: {
    disabled: boolean
    onClick: VoidFunction
    direction: GalleryArrowDirection
}) => {
    const flip =
        direction === GalleryArrowDirection.next ? "horizontal" : undefined
    const classes = ["gallery-arrow", direction]

    return (
        <button
            aria-label={`Go to ${
                direction === GalleryArrowDirection.next ? "next" : "previous"
            } slide`}
            disabled={disabled}
            onClick={onClick}
            className={classes.join(" ")}
        >
            <FontAwesomeIcon icon={faArrowLeftLong} flip={flip} />
        </button>
    )
}
