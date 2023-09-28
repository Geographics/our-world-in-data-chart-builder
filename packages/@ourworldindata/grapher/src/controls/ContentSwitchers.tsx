import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faTable,
    faEarthAmericas,
    faChartLine,
} from "@fortawesome/free-solid-svg-icons"
import { GrapherTabOption } from "../core/GrapherConstants"

const icons = {
    [GrapherTabOption.table]: faTable,
    [GrapherTabOption.chart]: faChartLine,
    [GrapherTabOption.map]: faEarthAmericas,
} as const

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabOption[]
    tab?: GrapherTabOption
    isNarrow?: boolean
}

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    @computed private get manager(): ContentSwitchersManager {
        return this.props.manager
    }

    @computed private get availableTabs(): GrapherTabOption[] {
        return this.manager.availableTabs || []
    }

    @computed private get showTabLabels(): boolean {
        return !this.manager.isNarrow
    }

    render(): JSX.Element {
        const { manager } = this
        return (
            <ul
                className={classnames({
                    ContentSwitchers: true,
                    iconOnly: !this.showTabLabels,
                })}
            >
                {this.availableTabs.map((tab) => (
                    <Tab
                        key={tab}
                        tab={tab}
                        isActive={tab === manager.tab}
                        onClick={(): void => {
                            manager.tab = tab
                        }}
                        showLabel={this.showTabLabels}
                    />
                ))}
            </ul>
        )
    }
}

function Tab(props: {
    tab: GrapherTabOption
    isActive?: boolean
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
    showLabel?: boolean
}): JSX.Element {
    const className = "tab clickable" + (props.isActive ? " active" : "")
    return (
        <li key={props.tab} className={className}>
            <a
                onClick={props.onClick}
                data-track-note={"chart_click_" + props.tab}
            >
                <FontAwesomeIcon icon={icons[props.tab]} />
                {props.showLabel && <span className="label">{props.tab}</span>}
            </a>
        </li>
    )
}
