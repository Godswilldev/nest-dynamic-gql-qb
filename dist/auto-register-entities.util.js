"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoRegisterEntities = autoRegisterEntities;
const graphql_entity_registry_1 = require("@src/graphql-entity.registry");
function autoRegisterEntities(dataSource, options = {}) {
    const { overrides = {}, fieldMap = {} } = options;
    for (const metadata of dataSource.entityMetadatas) {
        const entityClass = metadata.target;
        if (typeof entityClass !== "function")
            continue;
        const name = metadata.name;
        graphql_entity_registry_1.GRAPHQL_ENTITY_REGISTRY.set(name, entityClass);
        graphql_entity_registry_1.GRAPHQL_ENTITY_REGISTRY.set(`${name}Object`, entityClass);
    }
    for (const [graphqlTypeName, entityClass] of Object.entries(overrides)) {
        graphql_entity_registry_1.GRAPHQL_ENTITY_REGISTRY.set(graphqlTypeName, entityClass);
    }
    for (const [graphqlTypeName, map] of Object.entries(fieldMap)) {
        for (const [graphqlFieldName, entityPropertyName] of Object.entries(map)) {
            (0, graphql_entity_registry_1.mapGraphQLFieldToProperty)(graphqlTypeName, graphqlFieldName, entityPropertyName);
        }
    }
}
//# sourceMappingURL=auto-register-entities.util.js.map