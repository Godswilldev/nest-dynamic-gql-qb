import { DataSource } from "typeorm";
import { GraphQLResolveInfo } from "graphql";
import { SelectionTree } from "@src/selection-parser.util";
export declare class DynamicGraphqlResolveService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    resolveEntity<A = Record<string, unknown>>(params: {
        args: A;
        take?: number;
        skip?: number;
        entity: Function;
        returnTypeName?: string;
        graphqlTypeName: string;
        info: GraphQLResolveInfo;
        where: (args: A) => object;
        order?: Record<string, "ASC" | "DESC">;
        /** THis can be used to override the selection tree for the query. When the query returns a wrapper (e.g. { data: AccountObject[] }), pass the selection for the list element type so the right fields are loaded. */
        selectionTree?: SelectionTree;
    }): Promise<Record<string, unknown>[]>;
}
//# sourceMappingURL=dynamic-graphql-resolve.service.d.ts.map