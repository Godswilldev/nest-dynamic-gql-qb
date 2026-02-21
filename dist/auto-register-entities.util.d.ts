import { DataSource } from "typeorm";
export interface DynamicGraphqlModuleOptions {
    overrides?: Record<string, Function>;
    fieldMap?: Record<string, Record<string, string>>;
}
export declare function autoRegisterEntities(dataSource: DataSource, options?: DynamicGraphqlModuleOptions): void;
//# sourceMappingURL=auto-register-entities.util.d.ts.map