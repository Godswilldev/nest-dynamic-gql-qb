import { DataSource } from "typeorm";
import { ResolveTree } from "graphql-parse-resolve-info";
import type { SelectionTree } from "@src/selection-parser.util";
import { EntityMetadata } from "typeorm/metadata/EntityMetadata";
import { getEntityPropertyName } from "@src/graphql-entity.registry";
import { GRAPHQL_ENTITY_REGISTRY } from "@src/graphql-entity.registry";
import { SelectQueryBuilder } from "typeorm/query-builder/SelectQueryBuilder";

export interface AliasMeta {
  alias: string;
  relationKey?: string;
  parentAlias?: string;
  entityPropertyNames: string[];
}

export interface BuildQueryResult {
  rootAlias: string;
  qb: SelectQueryBuilder<any>;
  aliasMetaList: AliasMeta[];
  rootPrimaryKeyNames: string[];
}

export type NestedWhereValue = string | number | boolean | null | unknown[] | { [key: string]: NestedWhereValue };
export type NestedWhere = { [key: string]: NestedWhereValue };

const ROOT_ALIAS_DEFAULT = "root";

const BASE_ROOT_PROPERTY_NAMES = ["id", "createdAt", "updatedAt", "deletedAt", "rowId"];

function getBaseRootSelectProperties(meta: {
  primaryColumns: { propertyName: string }[];
  columns: { propertyName: string }[];
}): string[] {
  const order = [...meta.primaryColumns.map((c) => c.propertyName)];
  for (const name of BASE_ROOT_PROPERTY_NAMES) {
    if (!order.includes(name) && meta.columns.some((c) => c.propertyName === name)) order.push(name);
  }
  return order;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function applyNestedWhere(
  qb: SelectQueryBuilder<any>,
  where: NestedWhere,
  rootAlias: string,
  rootMeta: EntityMetadata,
  aliasMetaList: AliasMeta[],
  dataSource: DataSource,
): void {
  const rootColumnNames = new Set(rootMeta.columns.map((c) => c.propertyName));
  const rootWhere: Record<string, unknown> = {};
  const relationWheres: Array<{ relationKey: string; value: Record<string, unknown> }> = [];

  for (const [key, value] of Object.entries(where)) {
    if (rootColumnNames.has(key)) {
      rootWhere[key] = value;
    } else if (isPlainObject(value)) {
      const rel = rootMeta.relations.find((r) => r.propertyName === key);
      if (rel && (rel.isManyToOne || rel.isOneToOne))
        relationWheres.push({ relationKey: key, value: value as Record<string, unknown> });
    }
  }

  const hasRoot = Object.keys(rootWhere).length > 0;
  const hasNested = relationWheres.length > 0 && relationWheres.some((r) => Object.keys(r.value).length > 0);
  if (hasRoot) {
    qb.where(rootWhere);
  } else if (hasNested) {
    qb.where("1 = 1");
  }

  let paramIndex = 0;
  for (const { relationKey, value } of relationWheres) {
    const meta = aliasMetaList.find((a) => a.relationKey === relationKey && a.parentAlias === rootAlias);
    if (!meta) continue;

    const nestedEntity = rootMeta.relations.find((r) => r.propertyName === relationKey)?.type as Function | undefined;
    if (typeof nestedEntity !== "function") continue;
    const nestedMeta = dataSource.getMetadata(nestedEntity);

    for (const [propName, val] of Object.entries(value)) {
      const col = nestedMeta.findColumnWithPropertyName(propName);
      if (!col) continue;

      const paramName = `where_${paramIndex++}`;
      if (val === null) {
        qb.andWhere(`${meta.alias}.${col.databaseName} IS NULL`);
      } else if (Array.isArray(val)) {
        qb.andWhere(`${meta.alias}.${col.databaseName} IN (:...${paramName})`, { [paramName]: val });
      } else {
        qb.andWhere(`${meta.alias}.${col.databaseName} = :${paramName}`, { [paramName]: val });
      }
    }
  }
}

function ensureJoinsForWhere(
  qb: SelectQueryBuilder<any>,
  where: NestedWhere,
  rootAlias: string,
  metadata: EntityMetadata,
  aliasMetaList: AliasMeta[],
  dataSource: DataSource,
  aliasCounterRef: { current: number },
): void {
  const existingRelationKeys = new Set(
    aliasMetaList.filter((a) => a.parentAlias === rootAlias).map((a) => a.relationKey),
  );

  for (const [key, value] of Object.entries(where)) {
    if (!isPlainObject(value)) continue;
    const relation = metadata.relations.find((r) => r.propertyName === key);
    if (!relation || !(relation.isManyToOne || relation.isOneToOne)) continue;
    if (existingRelationKeys.has(key)) continue;

    const nestedTypeName = relation.inverseEntityMetadata?.name ?? (relation.type as Function)?.name;
    const nestedEntity = GRAPHQL_ENTITY_REGISTRY.get(nestedTypeName) ?? (relation.type as Function);
    if (typeof nestedEntity !== "function") continue;

    const nestedAlias = `a${aliasCounterRef.current++}`;
    qb.leftJoin(`${rootAlias}.${key}`, nestedAlias);
    aliasMetaList.push({
      alias: nestedAlias,
      entityPropertyNames: [],
      relationKey: key,
      parentAlias: rootAlias,
    });
    existingRelationKeys.add(key);
  }
}

export function buildQueryBuilderFromSelection<T>(params: {
  dataSource: DataSource;
  entityClass: new (...args: any[]) => T;
  graphqlTypeName: string;
  selectionTree: SelectionTree;
  rootAlias?: string;
  where?: NestedWhere;
}): BuildQueryResult {
  const {
    dataSource,
    entityClass,
    graphqlTypeName,
    selectionTree,
    rootAlias = ROOT_ALIAS_DEFAULT,
    where = {},
  } = params;
  const metadata = dataSource.getMetadata(entityClass);
  const repo = dataSource.getRepository(entityClass);
  const qb = repo.createQueryBuilder(rootAlias);
  qb.select([]);

  const aliasMetaList: AliasMeta[] = [];
  const aliasCounterRef = { current: 0 };

  const columnByProp = new Map(metadata.columns.map((c) => [c.propertyName, c]));
  const relationByProp = new Map(metadata.relations.map((r) => [r.propertyName, r]));

  function addSelectionsAndJoins(
    alias: string,
    meta: typeof metadata,
    tree: Record<string, ResolveTree>,
    gqlTypeName: string,
    relationKey?: string,
    parentAlias?: string,
  ): void {
    const entityPropertyNames: string[] = [];
    aliasMetaList.push({
      alias,
      entityPropertyNames,
      ...(relationKey && { relationKey }),
      ...(parentAlias && { parentAlias }),
    });

    const colMap = meta === metadata ? columnByProp : new Map(meta.columns.map((c) => [c.propertyName, c]));
    const relMap = meta === metadata ? relationByProp : new Map(meta.relations.map((r) => [r.propertyName, r]));

    const isRoot = parentAlias === undefined;
    if (isRoot) {
      const baseProps = getBaseRootSelectProperties(meta);
      for (const propName of baseProps) {
        const column = colMap.get(propName);
        if (column) {
          const outputKey = `${alias}_${propName}`;
          qb.addSelect(`${alias}.${column.databaseName}`, outputKey);
          entityPropertyNames.push(propName);
        }
      }
    }

    for (const [fieldName, fieldNode] of Object.entries(tree)) {
      const propName = getEntityPropertyName(gqlTypeName, fieldName);
      if (isRoot && entityPropertyNames.includes(propName)) continue;

      const column = colMap.get(propName);
      const relation = relMap.get(propName);

      if (column) {
        const dbName = column.databaseName;
        const outputKey = `${alias}_${propName}`;
        qb.addSelect(`${alias}.${dbName}`, outputKey);
        entityPropertyNames.push(propName);
      } else if (relation && (relation.isManyToOne || relation.isOneToOne)) {
        const nestedTypeName = relation.inverseEntityMetadata?.name ?? (relation.type as Function)?.name;
        const nestedEntity = GRAPHQL_ENTITY_REGISTRY.get(nestedTypeName) ?? (relation.type as Function);
        if (typeof nestedEntity !== "function") continue;

        const nestedMeta = dataSource.getMetadata(nestedEntity);
        const nestedAlias = `a${aliasCounterRef.current++}`;
        qb.leftJoin(`${alias}.${propName}`, nestedAlias);

        const nestedTree = fieldNode?.fieldsByTypeName
          ? (fieldNode.fieldsByTypeName[Object.keys(fieldNode.fieldsByTypeName)[0]] as Record<string, ResolveTree>)
          : {};
        addSelectionsAndJoins(nestedAlias, nestedMeta, nestedTree, nestedTypeName, fieldName, alias);
      }
    }
  }

  addSelectionsAndJoins(rootAlias, metadata, selectionTree, graphqlTypeName);

  if (Object.keys(where).length > 0) {
    ensureJoinsForWhere(qb, where, rootAlias, metadata, aliasMetaList, dataSource, aliasCounterRef);
    applyNestedWhere(qb, where, rootAlias, metadata, aliasMetaList, dataSource);
  }

  const rootPrimaryKeyNames = metadata.primaryColumns.map((c) => c.propertyName);
  return { qb, aliasMetaList, rootAlias, rootPrimaryKeyNames };
}
