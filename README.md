# nest-dynamic-gql-qb

A **generic layer** that turns the fields and relations a client requests in a GraphQL query into a **single, optimized TypeORM query**. Only requested columns and relations are selected and joined; raw rows are then reshaped into the nested structure the client expects.

For **NestJS** + **TypeORM** + **GraphQL** (Apollo). This document explains the **problems** it solves, **how it works**, **how to get started**, and what you need to **watch out for** so you can use it correctly in your architecture.

## Install

```bash
npm install nest-dynamic-gql-qb
```

Peer dependencies: `@nestjs/common`, `@nestjs/core`, `typeorm`, `graphql`, `graphql-parse-resolve-info` (install them in your app if not already present).

---

## Table of contents

1. [Problems this solves](#problems-this-solves)
2. [What the solution does](#what-the-solution-does)
3. [Architecture: what you need in place](#architecture-what-you-need-in-place)
4. [Getting started](#getting-started)
5. [Configuration (registry and field mapping)](#configuration-registry-and-field-mapping)
6. [Using the resolve service](#using-the-resolve-service)
7. [What to pay attention to](#what-to-pay-attention-to)
8. [Limitations and edge cases](#limitations-and-edge-cases)
9. [How it works under the hood](#how-it-works-under-the-hood)
10. [Troubleshooting](#troubleshooting)

---

## Problems this solves

### 1. Over-fetching

With a normal TypeORM `find()` or `createQueryBuilder().getMany()`, you load **every column** of the entity and every relation you add. If the client only asked for `id`, `email`, and `profile.firstname`, you still pull `password`, tokens, and dozens of other columns. That wastes memory, network, and database work.

**This module:** Builds a query that selects **only** the root base columns (e.g. `id`, `createdAt`, `updatedAt`, `deletedAt`, `rowId`) plus **exactly** the fields and nested relations requested in the GraphQL query.

### 2. N+1 queries

If you use a simple `find()` and then rely on **field resolvers** to load relations (e.g. `profile` on `User`), each row can trigger another query. 50 users → 1 query for users + 50 for profiles = **N+1**.

**This module:** Uses a **single query** with `LEFT JOIN` for each requested relation and `addSelect` for each requested column. One round-trip to the database.

### 3. Boilerplate and inconsistency

Without a generic approach, every list query needs its own resolver logic: build a QueryBuilder, manually add selects/joins based on what might be requested, then map results to the GraphQL shape. It’s easy to forget a relation or a field and hard to keep behaviour consistent.

**This module:** You call one method (`resolveEntity`) with the entity, GraphQL type name, and `info`. The selection tree from the query drives the QueryBuilder and the reshape step. Same pattern for every list-of-entity endpoint.

### 4. Security and performance

Loading columns like `password` or internal tokens when the client didn’t ask for them is unnecessary and risky. Selecting only what was requested reduces exposure and keeps queries lean.

**This module:** Only columns that appear in the selection (plus base fields needed for grouping and consistency) are selected; no automatic “select \*”.

---

## What the solution does

In short:

1. **Reads** the GraphQL request: which fields and nested relations the client asked for (from `info`).
2. **Builds** one TypeORM `SelectQueryBuilder`: `leftJoin` for each requested relation, `addSelect` for each requested column (and base root columns).
3. **Runs** the query once: `getRawMany()` → flat rows with prefixed keys (e.g. `root_id`, `root_email`, `a0_firstname`).
4. **Reshapes** the flat rows into nested objects that match the GraphQL shape (e.g. `{ id, email, profile: { firstname } }`).

So: **one query, only requested data, correct nested shape.**

---

## Architecture: what you need in place

For this module to work, your app should follow a few conventions.

### 1. TypeORM entities as source of truth

- Each “thing” you want to resolve dynamically is a **TypeORM entity** (with `@Entity()`, columns, relations).
- Relations that you want to be selectable in one query must be **OneToOne** or **ManyToOne** (single related entity). **OneToMany** is not supported (see [Limitations](#limitations-and-edge-cases)).

### 2. GraphQL types that mirror entities

- You expose **GraphQL ObjectTypes** (e.g. `UserObject`, `ProfileObject`) whose fields correspond to entity properties (and possibly a few computed/virtual fields).
- The **name** of the GraphQL type is used to look up the entity in a **registry**. By convention we register:
  - `EntityName` → entity class
  - `EntityNameObject` → same entity class  
    So if your GraphQL type is `UserObject`, the registry must map `UserObject` → `User` entity. Auto-registration does this for every entity (see [Configuration](#configuration-registry-and-field-mapping)).

### 3. Field names vs property names

- Ideally, GraphQL field names match entity **property names** (e.g. `firstname` in both).
- If they differ (e.g. GraphQL `externalRegistry` vs entity `recipientRegistry`), you must register that mapping in **fieldMap** so the QB and reshape use the correct property name.

### 4. Where the module lives

- The module is **global**: import it once (e.g. in your root or global app module) with `DynamicGraphqlModule.forRoot(...)`. Then inject `DynamicGraphqlResolveService` in any resolver that needs it.

### 5. Resolver return type

- Resolvers that use `resolveEntity` return a **list** of plain objects (e.g. `Record<string, unknown>[]`). You cast to your GraphQL type (e.g. `UserObject[]`) so the schema stays typed. The actual shape matches what the client requested.

---

## Getting started

### Step 1: Import the module

In your root or global module (e.g. `AppModule` or `GlobalProvidersModule`), import `DynamicGraphqlModule`. Prefer `forRoot()` so you can pass options:

```ts
import { DynamicGraphqlModule } from "nest-dynamic-gql-qb";

@Module({
  imports: [
    DynamicGraphqlModule.forRoot({
      // optional: overrides and fieldMap (see Configuration)
    }),
    // ... other imports
  ],
})
export class AppModule {}
```

If you don’t need overrides or field mapping, you can still use `DynamicGraphqlModule.forRoot({})`.

### Step 2: Inject the service in a resolver

In the resolver that will expose the “dynamic” query:

```ts
import { DynamicGraphqlResolveService } from "nest-dynamic-gql-qb";
import { User } from "src/common/modules/user/entities/user"; // your entity
import { UserObject } from "./objects/user.object"; // your GraphQL type

@Resolver()
export class UserResolver {
  constructor(private readonly dynamicGraphqlResolveService: DynamicGraphqlResolveService) {}
}
```

### Step 3: Add a query that uses `resolveEntity`

Example: a query that returns a list of users with **nested filters** (e.g. by profile or kyc) and **pagination**:

```ts
// Optional: define filter args (e.g. via GraphQL input type)
type UsersDynamicArgs = {
  role?: string;
  status?: string;
  country?: string;      // filter on profile.country
  kycStatus?: string;   // filter on kyc.status
  page?: number;
  limit?: number;
};

@Query(() => [UserObject])
async usersDynamic(
  @Args() args: UsersDynamicArgs,
  @Info() info: GraphQLResolveInfo,
): Promise<UserObject[]> {
  const page = Math.max(1, args.page ?? 1);
  const limit = Math.min(100, args.limit ?? 50);

  const rows = await this.dynamicGraphqlResolveService.resolveEntity({
    info,
    entity: User,
    graphqlTypeName: "UserObject",
    where: (a) => ({
      role: a.role ?? undefined,
      status: a.status ?? undefined,
      profile: a.country ? { country: a.country } : undefined,
      kyc: a.kycStatus ? { status: a.kycStatus } : undefined,
    }),
    args,
    order: { createdAt: "DESC" },
    take: limit,
    skip: (page - 1) * limit,
  });
  return rows as unknown as UserObject[];
}
```

- **`info`** – GraphQL resolve info; the service uses it to see which fields were requested.
- **`entity`** – The TypeORM entity class (e.g. `User`).
- **`graphqlTypeName`** – The name of the GraphQL type in the schema (e.g. `"UserObject"`). This must be registered (auto or manual) so the service can resolve nested types.
- **`where`** – Function from `args` to a where object. Can be **root-only** (TypeORM-style) or **nested**: use relation keys as keys and an object of column conditions as value (see [Nested where](#nested-where)).
- **`order`** – Keys are **root entity property names** (e.g. `createdAt`); they are translated to DB column names.
- **`take` / `skip`** – Pagination.

### Step 4: Query from the client

The client can request any subset of fields and nested relations, and pass **filter and pagination args**; the server will load only the requested data and apply nested filters:

```graphql
query {
  usersDynamic(role: "developer", country: "US", kycStatus: "approved", page: 2, limit: 20) {
    id
    email
    role
    profile {
      firstname
      lastname
      companyName
      country
    }
    kyc {
      status
    }
  }
}
```

Only the requested fields are selected and joined. Filters apply to the root (`role`) and to joined relations (`profile.country`, `kyc.status`); pagination uses `page` and `limit`.

---

## Configuration (registry and field mapping)

The service needs to know: **GraphQL type name → Entity class** and, optionally, **GraphQL type + field name → entity property name**.

### Auto-registration (default)

When the module initializes (`onModuleInit`), it can **auto-register** every entity from your TypeORM `DataSource`:

- `EntityName` → entity class
- `EntityNameObject` → entity class

So for a `User` entity (metadata name `"User"`), both `"User"` and `"UserObject"` resolve to the `User` entity. No extra code needed if your GraphQL types are named `X` or `XObject`.

### `forRoot({ overrides, fieldMap })`

Use **overrides** when a GraphQL type name does **not** follow `EntityName` or `EntityNameObject`:

```ts
DynamicGraphqlModule.forRoot({
  overrides: {
    CreditRequestInfoObject: CreditRequest, // GraphQL type → entity
  },
});
```

Use **fieldMap** when a **field name** in the GraphQL schema differs from the **entity property name**:

```ts
DynamicGraphqlModule.forRoot({
  fieldMap: {
    CreditRequestInfoObject: {
      externalRegistry: "recipientRegistry", // GraphQL field → entity property
    },
  },
});
```

So when the client asks for `externalRegistry`, the QB and reshape use the `recipientRegistry` property on the entity.

### Manual registration (optional)

You can also call the registry helpers yourself (e.g. in a custom `onModuleInit`):

```ts
import { registerGraphQLEntity, mapGraphQLFieldToProperty } from "nest-dynamic-gql-qb";

// type name → entity
registerGraphQLEntity("AdminUserObject", User);

// type + field → property
mapGraphQLFieldToProperty("AdminUserObject", "displayName", "email");
```

---

## Using the resolve service

### `resolveEntity` parameters

| Parameter         | Type                              | Required | Description                                                                                                                                                 |
| ----------------- | --------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `info`            | `GraphQLResolveInfo`              | Yes      | From `@Info()` in the resolver; used to read the selection tree.                                                                                            |
| `entity`          | `Function` (class)                | Yes      | The TypeORM entity class (e.g. `User`).                                                                                                                     |
| `graphqlTypeName` | `string`                          | Yes      | GraphQL type name for the root (e.g. `"UserObject"`). Must be in the registry.                                                                              |
| `where`           | `(args: A) => object`             | Yes      | Function that returns a where object. Root keys = root **property names**; use **nested** objects for relation filters (see [Nested where](#nested-where)). |
| `args`            | `A`                               | Yes      | Passed to `where(args)` (e.g. filter inputs).                                                                                                               |
| `returnTypeName`  | `string`                          | No       | If the schema uses a different type name for this list (e.g. union), pass it so the selection tree is read for that type.                                   |
| `order`           | `Record<string, "ASC" \| "DESC">` | No       | Sort by root properties (e.g. `{ createdAt: "DESC" }`). Keys are property names.                                                                            |
| `take`            | `number`                          | No       | Limit.                                                                                                                                                      |
| `skip`            | `number`                          | No       | Offset.                                                                                                                                                     |

### Nested where

You can filter on **root** columns and on **joined relations** in one `where` object. Use the relation’s **property name** as the key and an object of that relation’s column conditions as the value. Supported condition values:

- **Primitive** → `column = value`
- **`null`** → `column IS NULL`
- **Array** → `column IN (...)`

If a relation appears only in `where` (and not in the GraphQL selection), the module still adds the join so the filter can be applied.

**Example:**

```ts
where: (args) => ({
  role: args.role,                    // root column
  status: "active",                    // root column
  profile: {                          // relation: filter on joined profile
    country: args.country ?? undefined,
    firstname: args.firstname ?? undefined,
  },
  kyc: { status: "approved" },         // another relation
}),
```

Type: use `NestedWhere` from `nest-dynamic-gql-qb` if you want to type the return of `where(args)`.

### Example with nested filters and pagination

```ts
// Root filters + nested relation filters + pagination
const rows = await this.dynamicGraphqlResolveService.resolveEntity({
  info,
  entity: User,
  graphqlTypeName: "UserObject",
  where: (args) => ({
    role: args.role ?? undefined,
    status: args.status ?? undefined,
    profile: {
      country: args.country ?? undefined,
      accountType: args.accountType ?? undefined,
    },
    kyc: args.kycStatus ? { status: args.kycStatus } : undefined,
  }),
  args: {
    role: "developer",
    status: "active",
    country: "US",
    kycStatus: "approved",
    page: 2,
    limit: 20,
  },
  order: { createdAt: "DESC" },
  take: 20,
  skip: 20, // (page - 1) * limit
});
```

---

## What to pay attention to

### 1. GraphQL type name must be in the registry

If `graphqlTypeName` (or a nested type) is not in `GRAPHQL_ENTITY_REGISTRY`, that type won’t resolve to an entity and the relation will be **skipped** (no join, no nested data). Use `forRoot({ overrides })` or manual `registerGraphQLEntity` for any type that doesn’t match the `EntityName` / `EntityNameObject` convention.

### 2. Field name ≠ property name

If the client asks for a field whose name is different from the entity property (e.g. `externalRegistry` vs `recipientRegistry`), you **must** add a `fieldMap` entry (or `mapGraphQLFieldToProperty`) so the correct column/relation is used. Otherwise the service won’t find a matching property and the field will be missing.

### 3. `where` and `order` use entity property names

- **Root conditions**: Use root **property names** (e.g. `createdAt`), not DB column names. For **nested** conditions, use the relation’s **property name** (e.g. `profile`) and then the related entity’s property names (e.g. `country`, `firstname`).
- **`order`**: Only root property names; the service resolves them to column names.

### 4. Return type and casting

`resolveEntity` returns `Promise<Record<string, unknown>[]>`. Your resolver should declare the correct GraphQL return type (e.g. `UserObject[]`) and cast: `return rows as unknown as UserObject[]`. The runtime shape matches the requested selection.

### 5. Only OneToOne and ManyToOne relations

Nested **collections** (OneToMany) are not supported. Only relations that are a **single** related entity (OneToOne, ManyToOne) are joined and reshaped. If you need a list (e.g. `user.projects`), you’d need a separate field resolver or a different approach.

### 6. Base columns on the root

The root entity always gets **base columns** selected (e.g. `id`, `createdAt`, `updatedAt`, `deletedAt`, `rowId`) in addition to what the client asked for. This is for grouping and consistency. Sensitive columns (e.g. `password`) are **not** selected unless they appear in the selection tree—so don’t expose them in your GraphQL type if you don’t want them requestable.

---

## Limitations and edge cases

| Topic                             | Behaviour / limitation                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Composite primary keys**        | Supported. Grouping uses all root PK columns.                                                                                                               |
| **OneToMany relations**           | Not supported. Only OneToOne and ManyToOne are joined. OneToMany would duplicate root rows and require aggregation.                                         |
| **GraphQL unions/interfaces**     | Nested selection uses the **first** type in `fieldsByTypeName`. If different union members have different fields, only that first type’s selection is used. |
| **Nested entity not in registry** | The relation is skipped (no join, no nested data). Register the nested type (or use overrides) so it resolves to an entity.                                 |
| **Nested where depth**            | Only **one level** of nesting: `profile: { country: "US" }` is supported; `profile: { address: { country: "US" } }` is not.                                 |
| **Empty selection**               | If the client requests no fields, a minimal selection (e.g. `id`) is used so the query and reshape still work.                                              |
| **Order**                         | Keys in `order` are root **property** names; they are resolved to database column names via entity metadata.                                                |

---

## How it works under the hood

1. **Selection parser**  
   Uses `graphql-parse-resolve-info` to turn `info` into a tree of requested fields per type (`getSelectionTree`). For nested relations, it reads the sub-selection from the field node.

2. **Registry**  
   `GRAPHQL_ENTITY_REGISTRY` maps GraphQL type names to entity classes. `FIELD_PROPERTY_MAP` (and `fieldMap` in forRoot) maps (type, field) → entity property name. The QB builder uses these to resolve types and field names.

3. **Query builder**  
   Walks the selection tree. For the root: adds base columns (PK + audit/rowId), then only columns and relations that appear in the tree. For each relation (OneToOne/ManyToOne): `leftJoin(alias.relation, nestedAlias)` and recurses with the nested selection. Uses `addSelect(alias.column, outputKey)` so raw rows have keys like `root_id`, `a0_firstname`.

4. **Reshape**  
   Raw rows are grouped by root primary key (all PK columns if composite). For each group, one row is turned into a nested object: root alias → root properties, then for each child alias (from `aliasMetaList`) the same row is used to fill `relationKey: { ... }`. Result is an array of objects matching the GraphQL shape.

---

## Troubleshooting

### Nested relation is always null or missing

- Check that the **nested** GraphQL type (e.g. `ProfileObject`) is in the registry (auto-registration adds `Profile` and `ProfileObject`).
- If the relation is **inverse** (e.g. User → Profile with FK on Profile), the module supports it (OneToOne/ManyToOne are both joined). If it’s still missing, ensure the entity relation is defined and the registry has the correct entity for that type name.

### Field is missing in the response

- If the GraphQL field name differs from the entity property name, add a **fieldMap** entry (or `mapGraphQLFieldToProperty`) for that type and field.
- Ensure the field exists on the entity (column or relation) and that the GraphQL type actually exposes that field.

### Wrong or duplicate rows

- This path is designed for **one root row per entity** with optional OneToOne/ManyToOne joins. If you see duplicates, check that you’re not joining a OneToMany (not supported). Grouping is by root PK; composite PKs are supported and use all PK columns.

### Order or where not working

- Use **property names** (e.g. `createdAt`), not DB column names (e.g. `created_at`). For `order`, the service resolves property → column. For `where`, use root property names; for **nested** filters use relation key and then the related entity’s property names (see [Nested where](#nested-where)).

### Type errors when returning from resolver

- `resolveEntity` returns `Record<string, unknown>[]`. Cast to your GraphQL type: `return rows as unknown as UserObject[]` so TypeScript and the schema match.

---

## Summary

- **Use this** when you want a **single, optimized query** for list endpoints where the client chooses which fields and relations to load.
- **Requires**: TypeORM entities, GraphQL types that mirror them, registry (auto or manual), and field map when names differ.
- **Provide**: `info`, `entity`, `graphqlTypeName`, `where`, `args`; optionally `order`, `take`, `skip`.
- **Watch out**: Registry and field mapping, property names for where/order (nested where supported), OneToMany not supported, and casting the return type.

For a full working example, see the `usersDynamic` query in `apps/admin/src/user/admin-user.resolver.ts` and the query example in the “Getting started” section above.
