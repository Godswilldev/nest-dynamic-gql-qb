import { DataSource } from "typeorm";
import type { SelectionTree } from "@src/selection-parser.util";
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
export type NestedWhereValue = string | number | boolean | null | unknown[] | {
    [key: string]: NestedWhereValue;
};
export type NestedWhere = {
    [key: string]: NestedWhereValue;
};
export declare function buildQueryBuilderFromSelection<T>(params: {
    dataSource: DataSource;
    entityClass: new (...args: any[]) => T;
    graphqlTypeName: string;
    selectionTree: SelectionTree;
    rootAlias?: string;
    where?: NestedWhere;
}): BuildQueryResult;
//# sourceMappingURL=query-builder-from-selection.util.d.ts.map