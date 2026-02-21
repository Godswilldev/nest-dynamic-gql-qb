import { GraphQLResolveInfo } from "graphql";
import * as graphqlParseResolveInfo from "graphql-parse-resolve-info";
export type SelectionTree = Record<string, graphqlParseResolveInfo.ResolveTree>;
export declare function getSelectionTree(info: GraphQLResolveInfo, returnTypeName?: string): SelectionTree;
export declare function getSelectionForField(info: GraphQLResolveInfo, parentTypeName: string, fieldName: string): SelectionTree | null;
//# sourceMappingURL=selection-parser.util.d.ts.map