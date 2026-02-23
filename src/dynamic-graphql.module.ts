import { DataSource } from "typeorm";
export const DYNAMIC_GRAPHQL_OPTIONS = "DYNAMIC_GRAPHQL_OPTIONS";
import { DynamicGraphqlResolveService } from "@src/dynamic-graphql-resolve.service";
import { Module, Global, DynamicModule, OnModuleInit, Optional, Inject } from "@nestjs/common";
import { autoRegisterEntities, DynamicGraphqlModuleOptions } from "@src/auto-register-entities.util";

@Global()
@Module({ exports: [DynamicGraphqlResolveService], providers: [DynamicGraphqlResolveService] })
export class DynamicGraphqlModule implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    @Optional() @Inject(DYNAMIC_GRAPHQL_OPTIONS) private readonly options: DynamicGraphqlModuleOptions | null,
  ) {}

  onModuleInit() {
    autoRegisterEntities(this.dataSource, this.options ?? {});
  }

  static forRoot(options: DynamicGraphqlModuleOptions = {}): DynamicModule {
    return { module: DynamicGraphqlModule, providers: [{ provide: DYNAMIC_GRAPHQL_OPTIONS, useValue: options }] };
  }
}
