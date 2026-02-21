export declare const GRAPHQL_ENTITY_REGISTRY: Map<string, Function>;
export declare function registerGraphQLEntity(graphqlTypeName: string, entityClass: Function): void;
export declare const FIELD_PROPERTY_MAP: Map<string, Record<string, string>>;
export declare function mapGraphQLFieldToProperty(graphqlTypeName: string, graphqlFieldName: string, entityPropertyName: string): void;
export declare function getEntityPropertyName(graphqlTypeName: string, graphqlFieldName: string): string;
//# sourceMappingURL=graphql-entity.registry.d.ts.map