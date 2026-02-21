import { GraphQLResolveInfo } from "graphql";
import * as graphqlParseResolveInfo from "graphql-parse-resolve-info";

export type SelectionTree = Record<string, graphqlParseResolveInfo.ResolveTree>;

export function getSelectionTree(info: GraphQLResolveInfo, returnTypeName?: string): SelectionTree {
  const parsed = graphqlParseResolveInfo.parseResolveInfo(info, { deep: true });
  if (!parsed) return {};

  const fieldsByTypeName = "fieldsByTypeName" in parsed ? parsed.fieldsByTypeName : (parsed as Record<string, SelectionTree>);
  if (!fieldsByTypeName || typeof fieldsByTypeName !== "object") return {};

  const typeNames = Object.keys(fieldsByTypeName);
  const typeName = returnTypeName && typeNames.includes(returnTypeName) ? returnTypeName : typeNames[0];
  if (!typeName) return {};

  const fields = fieldsByTypeName[typeName];
  return (fields && typeof fields === "object" ? fields : {}) as SelectionTree;
}

export function getSelectionForField(info: GraphQLResolveInfo, parentTypeName: string, fieldName: string): SelectionTree | null {
  const parsed = graphqlParseResolveInfo.parseResolveInfo(info, { deep: true });
  if (!parsed) return null;

  const fieldsByTypeName = "fieldsByTypeName" in parsed ? parsed.fieldsByTypeName : (parsed as Record<string, SelectionTree>);
  const byType = fieldsByTypeName as Record<string, Record<string, graphqlParseResolveInfo.ResolveTree>> | undefined;
  if (!byType?.[parentTypeName]?.[fieldName]) return null;

  const fieldNode = byType[parentTypeName][fieldName];
  const nested = fieldNode?.fieldsByTypeName as Record<string, SelectionTree> | undefined;
  if (!nested || typeof nested !== "object") return {};

  const nestedTypeNames = Object.keys(nested);
  const firstTypeName = nestedTypeNames[0];
  if (!firstTypeName) return {};

  const fields = nested[firstTypeName];
  return (fields && typeof fields === "object" ? fields : {}) as SelectionTree;
}
