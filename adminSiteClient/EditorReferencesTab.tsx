import React from "react"
import { observer } from "mobx-react"
import { ChartEditor, ChartRedirect } from "./ChartEditor.js"
import { computed, action, observable, runInAction, makeObservable } from "mobx"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { stringifyUnkownError } from "../clientUtils/Util.js"

const BASE_URL = BAKED_GRAPHER_URL.replace(/^https?:\/\//, "")

export const EditorReferencesTab = observer(
    class EditorReferencesTab extends React.Component<{
        editor: ChartEditor
    }> {
        constructor(props: { editor: ChartEditor }) {
            super(props)

            makeObservable(this, {
                isPersisted: computed,
                references: computed,
                redirects: computed,
                appendRedirect: action.bound,
            })
        }

        get isPersisted() {
            return this.props.editor.grapher.id
        }

        get references() {
            return this.props.editor.references || []
        }
        get redirects() {
            return this.props.editor.redirects || []
        }

        appendRedirect(redirect: ChartRedirect) {
            this.props.editor.manager.redirects.push(redirect)
        }

        render() {
            return (
                <div>
                    <section>
                        <h5>References</h5>
                        {this.references.length ? (
                            <React.Fragment>
                                <p>
                                    Public pages that embed or reference this
                                    chart:
                                </p>
                                <ul className="list-group">
                                    {this.references.map((post) => (
                                        <li
                                            key={post.id}
                                            className="list-group-item"
                                        >
                                            <a
                                                href={post.url}
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                <strong>{post.title}</strong>
                                            </a>{" "}
                                            (
                                            <a
                                                href={`https://owid.cloud/wp/wp-admin/post.php?post=${post.id}&action=edit`}
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                Edit
                                            </a>
                                            )
                                        </li>
                                    ))}
                                </ul>
                            </React.Fragment>
                        ) : (
                            <p>No public posts reference this chart</p>
                        )}
                    </section>
                    <section>
                        <h5>Alternative URLs for this chart</h5>
                        {this.redirects.length ? (
                            <React.Fragment>
                                <p>
                                    The following URLs redirect to this chart:
                                </p>
                                <ul className="list-group">
                                    {this.redirects.map((redirect) => (
                                        <li
                                            key={redirect.id}
                                            className="list-group-item"
                                        >
                                            <span className="redirect-prefix">
                                                {BASE_URL}/
                                            </span>
                                            <a
                                                href={`${BAKED_GRAPHER_URL}/${redirect.slug}`}
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                <strong>{redirect.slug}</strong>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                                <hr />
                            </React.Fragment>
                        ) : null}
                        {this.isPersisted && (
                            <AddRedirectForm
                                editor={this.props.editor}
                                onSuccess={this.appendRedirect}
                            />
                        )}
                    </section>
                </div>
            )
        }
    }
)

const AddRedirectForm = observer(
    class AddRedirectForm extends React.Component<{
        editor: ChartEditor
        onSuccess: (redirect: ChartRedirect) => void
    }> {
        static contextType = AdminAppContext
        context!: AdminAppContextType

        slug?: string = ""

        isLoading: boolean = false
        errorMessage?: string

        constructor(props: {
            editor: ChartEditor
            onSuccess: (redirect: ChartRedirect) => void
        }) {
            super(props)

            makeObservable(this, {
                slug: observable,
                isLoading: observable,
                errorMessage: observable,
                onChange: action.bound,
                onSubmit: action.bound,
            })
        }

        onChange(slug: string) {
            this.slug = slug
        }

        async onSubmit() {
            if (!this.isLoading) {
                this.isLoading = true
                try {
                    const chartId = this.props.editor.grapher.id
                    const result = await this.context.admin.requestJSON(
                        `/api/charts/${chartId}/redirects/new`,
                        { slug: this.slug },
                        "POST",
                        { onFailure: "continue" }
                    )
                    const redirect = result.redirect as ChartRedirect
                    runInAction(() => {
                        this.isLoading = false
                        this.slug = ""
                        this.errorMessage = undefined
                    })
                    this.props.onSuccess(redirect)
                } catch (error) {
                    runInAction(() => {
                        this.isLoading = false
                        this.errorMessage = stringifyUnkownError(error)
                    })
                }
            }
        }

        render() {
            return (
                <form onSubmit={this.onSubmit}>
                    <div className="input-group mb-3">
                        <div className="input-group-prepend">
                            <span
                                className="input-group-text"
                                id="basic-addon3"
                            >
                                {BASE_URL}/
                            </span>
                        </div>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="URL"
                            value={this.slug}
                            onChange={(event) =>
                                this.onChange(event.target.value)
                            }
                        />
                        <div className="input-group-append">
                            <button
                                className="btn btn-primary"
                                type="submit"
                                disabled={!this.slug || this.isLoading}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                    {this.errorMessage && (
                        <div className="alert alert-danger">
                            {this.errorMessage}
                        </div>
                    )}
                </form>
            )
        }
    }
)
