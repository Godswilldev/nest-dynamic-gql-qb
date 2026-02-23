"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reshapeRawRowsToNested = reshapeRawRowsToNested;
const GROUP_KEY_SEP = "\u0000";
function reshapeRawRowsToNested(rows, aliasMetaList, rootAlias, rootPrimaryKeyNames) {
    if (rows.length === 0)
        return [];
    const aliasToMeta = new Map(aliasMetaList.map((a) => [a.alias, a]));
    const rootMeta = aliasToMeta.get(rootAlias);
    if (!rootMeta || rootMeta.entityPropertyNames.length === 0)
        return rows;
    const pkNames = rootPrimaryKeyNames?.length ? rootPrimaryKeyNames : [rootMeta.entityPropertyNames[0]];
    const pkKeys = pkNames.map((p) => `${rootAlias}_${p}`);
    const groups = new Map();
    for (const row of rows) {
        const key = pkKeys.map((k) => (row[k] != null ? String(row[k]) : "__null__")).join(GROUP_KEY_SEP);
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key).push(row);
    }
    const aliasToChildren = new Map();
    for (const a of aliasMetaList) {
        if (a.parentAlias != null) {
            const list = aliasToChildren.get(a.parentAlias) ?? [];
            list.push(a);
            aliasToChildren.set(a.parentAlias, list);
        }
    }
    const result = [];
    for (const [, groupRows] of groups) {
        const firstRow = groupRows[0];
        const obj = buildNestedFromRow(firstRow, aliasToMeta, aliasToChildren, rootAlias);
        result.push(obj);
    }
    return result;
}
function buildNestedFromRow(row, aliasToMeta, aliasToChildren, currentAlias) {
    const meta = aliasToMeta.get(currentAlias);
    if (!meta)
        return {};
    const out = {};
    for (const prop of meta.entityPropertyNames) {
        const key = `${currentAlias}_${prop}`;
        if (key in row)
            out[prop] = row[key];
    }
    const children = aliasToChildren.get(currentAlias) ?? [];
    for (const child of children) {
        if (child.relationKey) {
            const childObj = buildNestedFromRow(row, aliasToMeta, aliasToChildren, child.alias);
            if (Object.keys(childObj).length > 0 ||
                child.entityPropertyNames.some((p) => row[`${child.alias}_${p}`] != null)) {
                out[child.relationKey] = childObj;
            }
        }
    }
    return out;
}
//# sourceMappingURL=reshape-rows.util.js.map