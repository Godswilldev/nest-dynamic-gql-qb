"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicGraphqlResolveService = void 0;
const typeorm_1 = require("typeorm");
const common_1 = require("@nestjs/common");
const reshape_rows_util_1 = require("@src/reshape-rows.util");
const graphql_entity_registry_1 = require("@src/graphql-entity.registry");
const selection_parser_util_1 = require("@src/selection-parser.util");
const query_builder_from_selection_util_1 = require("@src/query-builder-from-selection.util");
let DynamicGraphqlResolveService = class DynamicGraphqlResolveService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async resolveEntity(params) {
        const { info, take, args, skip, order, where, entity, returnTypeName, graphqlTypeName, selectionTree: selectionTreeOverride, } = params;
        if (!graphql_entity_registry_1.GRAPHQL_ENTITY_REGISTRY.has(graphqlTypeName)) {
            graphql_entity_registry_1.GRAPHQL_ENTITY_REGISTRY.set(graphqlTypeName, entity);
        }
        const selectionTree = selectionTreeOverride ?? (0, selection_parser_util_1.getSelectionTree)(info, returnTypeName ?? graphqlTypeName);
        const hasSelection = selectionTree && Object.keys(selectionTree).length > 0;
        const { qb, aliasMetaList, rootAlias, rootPrimaryKeyNames } = (0, query_builder_from_selection_util_1.buildQueryBuilderFromSelection)({
            graphqlTypeName,
            where: where(args),
            dataSource: this.dataSource,
            entityClass: entity,
            selectionTree: hasSelection ? selectionTree : { id: { name: "id", alias: "id", args: {}, fieldsByTypeName: {} } },
        });
        if (order && Object.keys(order).length > 0) {
            const metadata = this.dataSource.getMetadata(entity);
            for (const [propOrColumn, dir] of Object.entries(order)) {
                const col = metadata.findColumnWithPropertyName(propOrColumn);
                const orderColumn = col ? `${rootAlias}.${col.databaseName}` : `${rootAlias}.${propOrColumn}`;
                qb.orderBy(orderColumn, dir);
            }
        }
        if (take != null)
            qb.limit(Number(take));
        if (skip != null)
            qb.offset(Number(skip));
        const rawRows = await qb.getRawMany();
        return (0, reshape_rows_util_1.reshapeRawRowsToNested)(rawRows, aliasMetaList, rootAlias, rootPrimaryKeyNames);
    }
};
exports.DynamicGraphqlResolveService = DynamicGraphqlResolveService;
exports.DynamicGraphqlResolveService = DynamicGraphqlResolveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], DynamicGraphqlResolveService);
//# sourceMappingURL=dynamic-graphql-resolve.service.js.map