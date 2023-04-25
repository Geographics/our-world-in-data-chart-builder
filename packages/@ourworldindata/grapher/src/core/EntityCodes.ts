import { invert, entities } from "@ourworldindata/utils"
import { EntityName } from "@ourworldindata/core-table"

export const entityCodesToEntityNames: Record<string, string> = Object.fromEntries(
    entities.map(({code, name}) => [code, name])
)

export const entityNamesToEntityCodes = invert(entityCodesToEntityNames)

export const codeToEntityName = (codeOrEntityName: string): EntityName => {
    return entityCodesToEntityNames[codeOrEntityName] ?? codeOrEntityName
}

export const entityNameToCode = (entityName: EntityName): string => {
    return entityNamesToEntityCodes[entityName] ?? entityName
}
