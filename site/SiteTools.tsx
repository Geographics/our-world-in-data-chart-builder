import React from "react"
import ReactDOM from "react-dom"
import { FeedbackPrompt } from "./Feedback.js"
import { HiringButton } from "./HiringButton.js"
import { ScrollDirection, useScrollDirection } from "./hooks.js"
import {
    NewsletterSubscription,
    NewsletterSubscriptionForm,
    NewsletterSubscriptionContext,
} from "./NewsletterSubscription.js"

const SITE_TOOLS_CLASS = "site-tools"

const SiteTools = () => {
    const scrollDirection = useScrollDirection()

    return (
        <div
            className={`hide-wrapper${
                (scrollDirection === ScrollDirection.Down && " hide") || ""
            }`}
        >
            <NewsletterSubscription
                context={NewsletterSubscriptionContext.Floating}
            />
            <FeedbackPrompt />
            <HiringButton />
        </div>
    )
}

export const runSiteTools = () => {
    ReactDOM.render(
        <SiteTools />,
        document.querySelector(`.${SITE_TOOLS_CLASS}`)
    )

    const newsletterSubscriptionFormRootHomepage = document.querySelector(
        ".homepage-subscribe .newsletter-subscription .root"
    )
    if (newsletterSubscriptionFormRootHomepage) {
        ReactDOM.hydrate(
            <NewsletterSubscriptionForm
                context={NewsletterSubscriptionContext.Homepage}
            />,
            newsletterSubscriptionFormRootHomepage
        )
    }
}
