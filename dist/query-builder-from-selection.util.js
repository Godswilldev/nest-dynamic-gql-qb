"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQueryBuilderFromSelection = buildQueryBuilderFromSelection;
const graphql_entity_registry_1 = require("./graphql-entity.registry");
const graphql_entity_registry_2 = require("./graphql-entity.registry");
const ROOT_ALIAS_DEFAULT = "root";
/** Base-model property names to always include for the root entity (PK + common audit columns). */
const BASE_ROOT_PROPERTY_NAMES = ["id", "createdAt", "updatedAt", "deletedAt", "rowId"];
/**
 * Returns property names that exist on the entity and should be selected for the root: PKs first, then base columns.
 */
function getBaseRootSelectProperties(meta) {
    const order = [...meta.primaryColumns.map((c) => c.propertyName)];
    for (const name of BASE_ROOT_PROPERTY_NAMES) {
        if (!order.includes(name) && meta.columns.some((c) => c.propertyName === name))
            order.push(name);
    }
    return order;
}
function isPlainObject(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
/**
 * Applies nested where: root-level columns → qb.where(rootWhere); each relation key with object value → andWhere on that relation's alias.
 * Assumes joins for relation keys already exist in qb (added from selection or from ensureJoinsForWhere).
 */
function applyNestedWhere(qb, where, rootAlias, rootMeta, aliasMetaList, dataSource) {
    const rootColumnNames = new Set(rootMeta.columns.map((c) => c.propertyName));
    const rootWhere = {};
    const relationWheres = [];
    for (const [key, value] of Object.entries(where)) {
        if (rootColumnNames.has(key)) {
            rootWhere[key] = value;
        }
        else if (isPlainObject(value)) {
            const rel = rootMeta.relations.find((r) => r.propertyName === key);
            if (rel && (rel.isManyToOne || rel.isOneToOne))
                relationWheres.push({ relationKey: key, value: value });
        }
    }
    const hasRoot = Object.keys(rootWhere).length > 0;
    const hasNested = relationWheres.length > 0 && relationWheres.some((r) => Object.keys(r.value).length > 0);
    if (hasRoot) {
        qb.where(rootWhere);
    }
    else if (hasNested) {
        qb.where("1 = 1");
    }
    let paramIndex = 0;
    for (const { relationKey, value } of relationWheres) {
        const meta = aliasMetaList.find((a) => a.relationKey === relationKey && a.parentAlias === rootAlias);
        if (!meta)
            continue;
        const nestedEntity = rootMeta.relations.find((r) => r.propertyName === relationKey)?.type;
        if (typeof nestedEntity !== "function")
            continue;
        const nestedMeta = dataSource.getMetadata(nestedEntity);
        for (const [propName, val] of Object.entries(value)) {
            const col = nestedMeta.findColumnWithPropertyName(propName);
            if (!col)
                continue;
            const paramName = `where_${paramIndex++}`;
            if (val === null) {
                qb.andWhere(`${meta.alias}.${col.databaseName} IS NULL`);
            }
            else if (Array.isArray(val)) {
                qb.andWhere(`${meta.alias}.${col.databaseName} IN (:...${paramName})`, { [paramName]: val });
            }
            else {
                qb.andWhere(`${meta.alias}.${col.databaseName} = :${paramName}`, { [paramName]: val });
            }
        }
    }
}
/**
 * Adds leftJoin for any relation key in where that is not already in aliasMetaList (so nested where can filter on them).
 */
function ensureJoinsForWhere(qb, where, rootAlias, metadata, aliasMetaList, dataSource, aliasCounterRef) {
    const existingRelationKeys = new Set(aliasMetaList.filter((a) => a.parentAlias === rootAlias).map((a) => a.relationKey));
    for (const [key, value] of Object.entries(where)) {
        if (!isPlainObject(value))
            continue;
        const relation = metadata.relations.find((r) => r.propertyName === key);
        if (!relation || !(relation.isManyToOne || relation.isOneToOne))
            continue;
        if (existingRelationKeys.has(key))
            continue;
        const nestedTypeName = relation.inverseEntityMetadata?.name ?? relation.type?.name;
        const nestedEntity = graphql_entity_registry_2.GRAPHQL_ENTITY_REGISTRY.get(nestedTypeName) ?? relation.type;
        if (typeof nestedEntity !== "function")
            continue;
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
/**
 * Builds a TypeORM SelectQueryBuilder from a GraphQL selection tree.
 * Root: only base columns (PK, createdAt, updatedAt, deletedAt, rowId) + columns requested in the query.
 * Nested relations: only requested fields. Uses leftJoin + addSelect (no default select).
 */
function buildQueryBuilderFromSelection(params) {
    const { dataSource, entityClass, graphqlTypeName, selectionTree, rootAlias = ROOT_ALIAS_DEFAULT, where = {} } = params;
    const metadata = dataSource.getMetadata(entityClass);
    const repo = dataSource.getRepository(entityClass);
    const qb = repo.createQueryBuilder(rootAlias);
    qb.select([]);
    const aliasMetaList = [];
    const aliasCounterRef = { current: 0 };
    const columnByProp = new Map(metadata.columns.map((c) => [c.propertyName, c]));
    const relationByProp = new Map(metadata.relations.map((r) => [r.propertyName, r]));
    function addSelectionsAndJoins(alias, meta, tree, gqlTypeName, relationKey, parentAlias) {
        const entityPropertyNames = [];
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
            const propName = (0, graphql_entity_registry_1.getEntityPropertyName)(gqlTypeName, fieldName);
            if (isRoot && entityPropertyNames.includes(propName))
                continue;
            const column = colMap.get(propName);
            const relation = relMap.get(propName);
            if (column) {
                const dbName = column.databaseName;
                const outputKey = `${alias}_${propName}`;
                qb.addSelect(`${alias}.${dbName}`, outputKey);
                entityPropertyNames.push(propName);
            }
            else if (relation && (relation.isManyToOne || relation.isOneToOne)) {
                const nestedTypeName = relation.inverseEntityMetadata?.name ?? relation.type?.name;
                const nestedEntity = graphql_entity_registry_2.GRAPHQL_ENTITY_REGISTRY.get(nestedTypeName) ?? relation.type;
                if (typeof nestedEntity !== "function")
                    continue;
                const nestedMeta = dataSource.getMetadata(nestedEntity);
                const nestedAlias = `a${aliasCounterRef.current++}`;
                qb.leftJoin(`${alias}.${propName}`, nestedAlias);
                const nestedTree = fieldNode?.fieldsByTypeName ? fieldNode.fieldsByTypeName[Object.keys(fieldNode.fieldsByTypeName)[0]] : {};
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
//# sourceMappingURL=query-builder-from-selection.util.js.map