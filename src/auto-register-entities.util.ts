import { DataSource } from "typeorm";
import { GRAPHQL_ENTITY_REGISTRY, mapGraphQLFieldToProperty } from "@src/graphql-entity.registry";

export interface DynamicGraphqlModuleOptions {
  overrides?: Record<string, Function>;
  fieldMap?: Record<string, Record<string, string>>;
}

export function autoRegisterEntities(dataSource: DataSource, options: DynamicGraphqlModuleOptions = {}): void {
  const { overrides = {}, fieldMap = {} } = options;

  for (const metadata of dataSource.entityMetadatas) {
    const entityClass = metadata.target as Function;
    if (typeof entityClass !== "function") continue;

    const name = metadata.name;
    GRAPHQL_ENTITY_REGISTRY.set(name, entityClass);
    GRAPHQL_ENTITY_REGISTRY.set(`${name}Object`, entityClass);
  }

  for (const [graphqlTypeName, entityClass] of Object.entries(overrides)) {
    GRAPHQL_ENTITY_REGISTRY.set(graphqlTypeName, entityClass);
  }

  for (const [graphqlTypeName, map] of Object.entries(fieldMap)) {
    for (const [graphqlFieldName, entityPropertyName] of Object.entries(map)) {
      mapGraphQLFieldToProperty(graphqlTypeName, graphqlFieldName, entityPropertyName);
    }
  }
}
