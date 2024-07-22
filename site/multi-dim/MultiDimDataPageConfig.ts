import YAML from "yaml"
import {
    Choice,
    ChoicesEnriched,
    DimensionEnriched,
    MultiDimDataPageConfigType,
    View,
} from "./MultiDimDataPageTypes.js"
import { DimensionProperty, groupBy, keyBy } from "@ourworldindata/utils"

export class MultiDimDataPageConfig {
    private constructor(public readonly config: MultiDimDataPageConfigType) {}

    static fromYaml(yamlString: string) {
        return new MultiDimDataPageConfig(YAML.parse(yamlString))
    }

    static fromJson(jsonString: string) {
        return new MultiDimDataPageConfig(JSON.parse(jsonString))
    }

    static fromObject(obj: MultiDimDataPageConfigType) {
        return new MultiDimDataPageConfig(obj)
    }

    private static getEnrichedChoicesFields(
        choices: Choice[]
    ): ChoicesEnriched {
        return {
            choices,
            choicesBySlug: keyBy(choices, "slug"),
            choicesByGroup: groupBy(choices, "group"),
        }
    }

    get dimensions(): Record<string, DimensionEnriched> {
        const dimensionsEnriched = this.config.dimensions.map((dimension) => ({
            ...dimension,
            ...MultiDimDataPageConfig.getEnrichedChoicesFields(
                dimension.choices
            ),
        }))
        return keyBy(dimensionsEnriched, "slug")
    }

    filterViewsByDimensions(dimensions: Record<string, string>): View[] {
        return this.config.views.filter((view) => {
            for (const [dimensionSlug, choiceSlug] of Object.entries(
                dimensions
            )) {
                if (view.dimensions[dimensionSlug] !== choiceSlug) return false
            }
            return true
        })
    }

    // This'll only ever find one or zero views, and will throw an error
    // if more than one matching views were found
    findViewByDimensions(dimensions: Record<string, string>) {
        const matchingViews = this.filterViewsByDimensions(dimensions)
        if (matchingViews.length === 0) return undefined
        if (matchingViews.length > 1) {
            throw new Error(
                `Multiple views found for dimensions ${JSON.stringify(
                    dimensions
                )}`
            )
        }
        return matchingViews[0]
    }

    /**
     * This checks if matching views are available for the selected choices, and otherwise
     * adapts them in such a way that they are available, in the following way:
     * - Go through the choices left-to-right. The current dimension we're looking at is called `cur`.
     * - If there is at least one available view for choices[leftmost, ..., cur], continue.
     * - Otherwise, for dimension `cur`, find the first choice that has at least one available view.
     *
     * `selectedChoices` is expected to be fully-qualified, i.e. it should contain a choice for every available dimension.
     *
     * The method returns two values:
     * - `selectedChoices` is the updated version of the input `selectedChoices`, where choices have been adapted to make sure there are available views.
     * - `dimensionsWithAvailableChoices` indicates for each dimension which choices are available, and excludes the ones that are excluded by choices left of it.
     *
     * - @marcelgerber, 2024-07-22
     */
    filterToAvailableChoices(selectedChoices: Record<string, string>) {
        const updatedSelectedChoices: Record<string, string> = {}
        const dimensionsWithAvailableChoices: Record<
            string,
            DimensionEnriched
        > = {}
        for (const [currentDimSlug, currentDim] of Object.entries(
            this.dimensions
        )) {
            const availableViewsBeforeSelection = this.filterViewsByDimensions(
                updatedSelectedChoices
            )
            if (
                selectedChoices[currentDimSlug] &&
                currentDim.choicesBySlug[selectedChoices[currentDimSlug]]
            ) {
                updatedSelectedChoices[currentDimSlug] =
                    selectedChoices[currentDimSlug]
            } else {
                throw new Error(
                    `Missing or invalid choice for dimension ${currentDimSlug}`
                )
            }

            const availableViewsAfterSelection = this.filterViewsByDimensions(
                updatedSelectedChoices
            )
            if (availableViewsAfterSelection.length === 0) {
                // If there are no views available after this selection, choose the first available view before this choice and update to its choice
                updatedSelectedChoices[currentDimSlug] =
                    availableViewsBeforeSelection[0].dimensions[currentDimSlug]
            }

            // Find all the available choices we can show for this dimension - these are all
            // the ones that are possible for this dimension with all of the previous choices
            // (i.e., left of this dimension) in mind.
            const availableChoicesForDimension = Object.values(
                currentDim.choices
            ).filter((choice) =>
                availableViewsBeforeSelection.some(
                    (view) => view.dimensions[currentDimSlug] === choice.slug
                )
            )
            dimensionsWithAvailableChoices[currentDimSlug] = {
                ...currentDim,
                ...MultiDimDataPageConfig.getEnrichedChoicesFields(
                    availableChoicesForDimension
                ),
            }
        }

        return {
            selectedChoices: updatedSelectedChoices,
            dimensionsWithAvailableChoices,
        }
    }

    static transformIndicatorPathObj(
        indicatorPathObj:
            | Record<string, DimensionProperty>
            | Array<Record<string, DimensionProperty>>
    ): Record<DimensionProperty, string[]> {
        const emptyObj: Record<DimensionProperty, string[]> = {
            x: [],
            y: [],
            color: [],
            size: [],
            table: [],
        }
        if (Array.isArray(indicatorPathObj)) {
            return indicatorPathObj.reduce((result, obj) => {
                const transformed =
                    MultiDimDataPageConfig.transformIndicatorPathObj(obj)
                for (const [dimension, indicatorPaths] of Object.entries(
                    transformed
                )) {
                    result[dimension as DimensionProperty].push(
                        ...indicatorPaths
                    )
                }
                return result
            }, emptyObj)
        } else {
            return Object.entries(indicatorPathObj).reduce(
                (result, [indicatorPath, dimension]) => {
                    result[dimension].push(indicatorPath)
                    return result
                },
                emptyObj
            )
        }
    }
}