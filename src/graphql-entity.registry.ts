export const GRAPHQL_ENTITY_REGISTRY = new Map<string, Function>();

export function registerGraphQLEntity(graphqlTypeName: string, entityClass: Function): void {
  GRAPHQL_ENTITY_REGISTRY.set(graphqlTypeName, entityClass);
}

export const FIELD_PROPERTY_MAP = new Map<string, Record<string, string>>();

export function mapGraphQLFieldToProperty(graphqlTypeName: string, graphqlFieldName: string, entityPropertyName: string): void {
  const map = FIELD_PROPERTY_MAP.get(graphqlTypeName) ?? {};
  map[graphqlFieldName] = entityPropertyName;
  FIELD_PROPERTY_MAP.set(graphqlTypeName, map);
}

export function getEntityPropertyName(graphqlTypeName: string, graphqlFieldName: string): string {
  return FIELD_PROPERTY_MAP.get(graphqlTypeName)?.[graphqlFieldName] ?? graphqlFieldName;
}
