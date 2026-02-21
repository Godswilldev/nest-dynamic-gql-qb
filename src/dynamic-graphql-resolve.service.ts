import { DataSource } from "typeorm";
import { Injectable } from "@nestjs/common";
import { GraphQLResolveInfo } from "graphql";
import { getSelectionTree } from "./selection-parser.util";
import { reshapeRawRowsToNested } from "./reshape-rows.util";
import { GRAPHQL_ENTITY_REGISTRY } from "./graphql-entity.registry";
import { buildQueryBuilderFromSelection, NestedWhere } from "./query-builder-from-selection.util";

@Injectable()
export class DynamicGraphqlResolveService {
  constructor(private readonly dataSource: DataSource) {}

  async resolveEntity<A = Record<string, unknown>>(params: {
    args: A;
    take?: number;
    skip?: number;
    entity: Function;
    returnTypeName?: string;
    graphqlTypeName: string;
    info: GraphQLResolveInfo;
    where: (args: A) => object;
    order?: Record<string, "ASC" | "DESC">;
  }): Promise<Record<string, unknown>[]> {
    const { info, entity, graphqlTypeName, where, args, returnTypeName, order, take, skip } = params;

    if (!GRAPHQL_ENTITY_REGISTRY.has(graphqlTypeName)) {
      GRAPHQL_ENTITY_REGISTRY.set(graphqlTypeName, entity);
    }

    const selectionTree = getSelectionTree(info, returnTypeName ?? graphqlTypeName);
    const hasSelection = selectionTree && Object.keys(selectionTree).length > 0;

    const { qb, aliasMetaList, rootAlias, rootPrimaryKeyNames } = buildQueryBuilderFromSelection({
      graphqlTypeName,
      where: where(args) as unknown as NestedWhere,
      dataSource: this.dataSource,
      entityClass: entity as new (...args: any[]) => any,
      selectionTree: hasSelection ? selectionTree : { id: { name: "id", alias: "id", args: {}, fieldsByTypeName: {} } },
    });

    if (order && Object.keys(order).length > 0) {
      const metadata = this.dataSource.getMetadata(entity as new (...args: any[]) => any);
      for (const [propOrColumn, dir] of Object.entries(order)) {
        const col = metadata.findColumnWithPropertyName(propOrColumn);
        const orderColumn = col ? `${rootAlias}.${col.databaseName}` : `${rootAlias}.${propOrColumn}`;
        qb.orderBy(orderColumn, dir);
      }
    }
    if (take != null) qb.limit(Number(take));
    if (skip != null) qb.offset(Number(skip));
    const rawRows = await qb.getRawMany<Record<string, unknown>>();
    return reshapeRawRowsToNested(rawRows, aliasMetaList, rootAlias, rootPrimaryKeyNames);
  }
}
