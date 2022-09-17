import React, { useContext } from "react"
import { AdminAppContext } from "./AdminAppContext.js"
import { Help } from "./Forms.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { ErrorMessage, getPropertyValidationStatus } from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import { Input } from "antd"

export const GdocsSettings = ({
    gdoc,
    setGdoc,
    saveButtons,
    errors,
}: {
    gdoc: OwidArticleType
    setGdoc: (gdoc: OwidArticleType) => void
    saveButtons: React.ReactNode
    errors?: ErrorMessage[]
}) => {
    const { admin } = useContext(AdminAppContext)

    return gdoc ? (
        <form className="GdocsSettingsForm">
            <p>
                <a
                    href={`https://docs.google.com/document/d/${gdoc.id}/edit`}
                    target="_blank"
                    rel="noopener"
                >
                    <FontAwesomeIcon icon={faEdit} /> Edit document
                </a>
            </p>
            <div className="form-group">
                <label htmlFor="title">Title</label>
                <Input
                    value={gdoc.title}
                    onChange={(e) =>
                        setGdoc({ ...gdoc, title: e.target.value })
                    }
                    status={getPropertyValidationStatus("title", errors)}
                    id="title"
                    required
                />
                <Help>The document title as it will appear on the site.</Help>
            </div>
            <div className="form-group">
                <GdocsSlug gdoc={gdoc} setGdoc={setGdoc} errors={errors} />
            </div>
            <div className="d-flex justify-content-end">{saveButtons}</div>
        </form>
    ) : null
}
