import { DataSource } from "typeorm";
import { GraphQLResolveInfo } from "graphql";
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
    }): Promise<Record<string, unknown>[]>;
}
//# sourceMappingURL=dynamic-graphql-resolve.service.d.ts.map