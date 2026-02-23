import { DataSource } from "typeorm";
export declare const DYNAMIC_GRAPHQL_OPTIONS = "DYNAMIC_GRAPHQL_OPTIONS";
import { DynamicModule, OnModuleInit } from "@nestjs/common";
import { DynamicGraphqlModuleOptions } from "@src/auto-register-entities.util";
export declare class DynamicGraphqlModule implements OnModuleInit {
    private readonly dataSource;
    private readonly options;
    constructor(dataSource: DataSource, options: DynamicGraphqlModuleOptions | null);
    onModuleInit(): void;
    static forRoot(options?: DynamicGraphqlModuleOptions): DynamicModule;
}
//# sourceMappingURL=dynamic-graphql.module.d.ts.map