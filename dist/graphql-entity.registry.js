"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIELD_PROPERTY_MAP = exports.GRAPHQL_ENTITY_REGISTRY = void 0;
exports.registerGraphQLEntity = registerGraphQLEntity;
exports.mapGraphQLFieldToProperty = mapGraphQLFieldToProperty;
exports.getEntityPropertyName = getEntityPropertyName;
exports.GRAPHQL_ENTITY_REGISTRY = new Map();
function registerGraphQLEntity(graphqlTypeName, entityClass) {
    exports.GRAPHQL_ENTITY_REGISTRY.set(graphqlTypeName, entityClass);
}
exports.FIELD_PROPERTY_MAP = new Map();
function mapGraphQLFieldToProperty(graphqlTypeName, graphqlFieldName, entityPropertyName) {
    const map = exports.FIELD_PROPERTY_MAP.get(graphqlTypeName) ?? {};
    map[graphqlFieldName] = entityPropertyName;
    exports.FIELD_PROPERTY_MAP.set(graphqlTypeName, map);
}
function getEntityPropertyName(graphqlTypeName, graphqlFieldName) {
    return exports.FIELD_PROPERTY_MAP.get(graphqlTypeName)?.[graphqlFieldName] ?? graphqlFieldName;
}
//# sourceMappingURL=graphql-entity.registry.js.map