import { DataSource } from "typeorm";
import { SelectQueryBuilder } from "typeorm/query-builder/SelectQueryBuilder";
import type { SelectionTree } from "./selection-parser.util";
export interface AliasMeta {
    alias: string;
    entityPropertyNames: string[];
    relationKey?: string;
    parentAlias?: string;
}
export interface BuildQueryResult {
    qb: SelectQueryBuilder<any>;
    aliasMetaList: AliasMeta[];
    rootAlias: string;
    /** Root entity primary key property names; use for grouping (supports composite PK). */
    rootPrimaryKeyNames: string[];
}
/**
 * Nested where: root keys are root-entity columns or relation names.
 * - Column: value is primitive, null, or array (IN).
 * - Relation: value is an object with that relation's column keys and primitive/null/array values.
 * Example: { email: "x", role: "admin", profile: { country: "US", firstname: null } }
 */
export type NestedWhereValue = string | number | boolean | null | unknown[] | {
    [key: string]: NestedWhereValue;
};
export type NestedWhere = {
    [key: string]: NestedWhereValue;
};
/**
 * Builds a TypeORM SelectQueryBuilder from a GraphQL selection tree.
 * Root: only base columns (PK, createdAt, updatedAt, deletedAt, rowId) + columns requested in the query.
 * Nested relations: only requested fields. Uses leftJoin + addSelect (no default select).
 */
export declare function buildQueryBuilderFromSelection<T>(params: {
    dataSource: DataSource;
    entityClass: new (...args: any[]) => T;
    graphqlTypeName: string;
    selectionTree: SelectionTree;
    rootAlias?: string;
    /** Root and nested relation conditions. Nested: use relation key as key and object of column conditions as value. */
    where?: NestedWhere;
}): BuildQueryResult;
//# sourceMappingURL=query-builder-from-selection.util.d.ts.map