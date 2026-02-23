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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DynamicGraphqlModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicGraphqlModule = exports.DYNAMIC_GRAPHQL_OPTIONS = void 0;
const typeorm_1 = require("typeorm");
exports.DYNAMIC_GRAPHQL_OPTIONS = "DYNAMIC_GRAPHQL_OPTIONS";
const dynamic_graphql_resolve_service_1 = require("@src/dynamic-graphql-resolve.service");
const common_1 = require("@nestjs/common");
const auto_register_entities_util_1 = require("@src/auto-register-entities.util");
let DynamicGraphqlModule = DynamicGraphqlModule_1 = class DynamicGraphqlModule {
    constructor(dataSource, options) {
        this.dataSource = dataSource;
        this.options = options;
    }
    onModuleInit() {
        (0, auto_register_entities_util_1.autoRegisterEntities)(this.dataSource, this.options ?? {});
    }
    static forRoot(options = {}) {
        return { module: DynamicGraphqlModule_1, providers: [{ provide: exports.DYNAMIC_GRAPHQL_OPTIONS, useValue: options }] };
    }
};
exports.DynamicGraphqlModule = DynamicGraphqlModule;
exports.DynamicGraphqlModule = DynamicGraphqlModule = DynamicGraphqlModule_1 = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({ exports: [dynamic_graphql_resolve_service_1.DynamicGraphqlResolveService], providers: [dynamic_graphql_resolve_service_1.DynamicGraphqlResolveService] }),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)(exports.DYNAMIC_GRAPHQL_OPTIONS)),
    __metadata("design:paramtypes", [typeorm_1.DataSource, Object])
], DynamicGraphqlModule);
//# sourceMappingURL=dynamic-graphql.module.js.map