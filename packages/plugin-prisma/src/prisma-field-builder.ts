/* eslint-disable no-underscore-dangle */
import { GraphQLResolveInfo } from 'graphql';
import {
  FieldRef,
  InputFieldMap,
  MaybePromise,
  NormalizeArgs,
  ObjectFieldBuilder,
  ObjectRef,
  PluginName,
  SchemaTypes,
} from '@giraphql/core';
import { prismaCursorConnectionQuery, wrapConnectionResult } from './cursors.js';
import { getLoaderMapping, setLoaderMappings } from './loader-map.js';
import { ModelLoader } from './model-loader.js';
import { getDelegateFromModel, getFindUniqueForRef, getRefFromModel, getRelation } from './refs.js';
import {
  PrismaDelegate,
  PrismaModelTypes,
  RelatedConnectionOptions,
  RelatedFieldOptions,
  RelationCountOptions,
} from './types.js';
import { queryFromInfo } from './util/index.js';

export class PrismaObjectFieldBuilder<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  NeedsResolve extends boolean,
  Shape extends object = Model['Shape'],
> extends ObjectFieldBuilder<Types, Shape> {
  delegate: PrismaDelegate;
  model: string;

  relatedConnection: 'relay' extends PluginName
    ? <
        Field extends Model['ListRelation'],
        Nullable extends boolean,
        Args extends InputFieldMap,
        ResolveReturnShape,
      >(
        ...args: NormalizeArgs<
          [
            field: Field,
            options: RelatedConnectionOptions<Types, Model, Field, Nullable, Args, NeedsResolve>,
            connectionOptions?: GiraphQLSchemaTypes.ConnectionObjectOptions<
              Types,
              ObjectRef<Shape>,
              ResolveReturnShape
            >,
            edgeOptions?: GiraphQLSchemaTypes.ConnectionEdgeObjectOptions<
              Types,
              ObjectRef<Shape>,
              ResolveReturnShape
            >,
          ]
        >
      ) => FieldRef<GiraphQLSchemaTypes.ConnectionShapeHelper<Types, Shape, Nullable>['shape']>
    : '@giraphql/plugin-relay is required to use this method' = function relatedConnection(
    this: PrismaObjectFieldBuilder<SchemaTypes, Model, boolean>,
    name: string,
    {
      maxSize,
      defaultSize,
      cursor,
      query,
      resolve,
      extensions,
      totalCount,
      ...options
    }: {
      totalCount?: boolean;
      maxSize?: number;
      defaultSize?: number;
      cursor: string;
      extensions: {};
      query: ((args: {}) => {}) | {};
      resolve: (query: {}, parent: unknown, args: {}, ctx: {}, info: {}) => MaybePromise<{}[]>;
    },
    connectionOptions = {},
    edgeOptions = {},
  ) {
    const relationField = getRelation(this.model, this.builder, name);
    const parentRef = getRefFromModel(this.model, this.builder);
    const ref = getRefFromModel(relationField.type, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    const getQuery = (args: GiraphQLSchemaTypes.DefaultConnectionArguments) => ({
      ...((typeof query === 'function' ? query(args) : query) as {}),
      ...prismaCursorConnectionQuery({
        column: cursor,
        maxSize,
        defaultSize,
        args,
      }),
    });

    const fieldRef = (
      this as unknown as {
        connection: (...args: unknown[]) => FieldRef<unknown>;
      }
    ).connection(
      {
        ...options,
        extensions: {
          ...extensions,
          giraphQLPrismaQuery: getQuery,
          giraphQLPrismaRelation: name,
        },
        type: ref,
        resolve: async (
          parent: object,
          args: GiraphQLSchemaTypes.DefaultConnectionArguments,
          context: {},
          info: GraphQLResolveInfo,
        ) => {
          const connectionQuery = getQuery(args);
          const getResult = () => {
            const mapping = getLoaderMapping(context, info.path);
            const loadedValue = (parent as Record<string, unknown>)[name];

            if (
              // if we attempted to load the relation, and its missing it will be null
              // undefined means that the query was not constructed in a way that requested the relation
              loadedValue !== undefined &&
              mapping
            ) {
              if (loadedValue !== null && loadedValue !== undefined) {
                setLoaderMappings(context, info.path, mapping);
              }

              return loadedValue as {}[];
            }

            if (!resolve && !findUnique) {
              throw new Error(`Missing findUnique for Prisma type ${this.model}`);
            }

            const mergedQuery = { ...queryFromInfo(context, info), ...connectionQuery };

            if (resolve) {
              return resolve(mergedQuery, parent, args, context, info);
            }

            return loaderCache(parent).loadRelation(name, mergedQuery, context) as Promise<{}[]>;
          };

          return wrapConnectionResult(
            await getResult(),
            args,
            connectionQuery.take,
            cursor,
            (parent as { _count?: Record<string, number> })._count?.[name],
          );
        },
      },
      {
        ...connectionOptions,
        fields: totalCount
          ? (t: GiraphQLSchemaTypes.ObjectFieldBuilder<SchemaTypes, { totalCount?: number }>) => ({
              totalCount: t.int({
                extensions: {
                  giraphQLPrismaRelationCount: name,
                },
                resolve: (parent, args, context) => {
                  const loadedValue = parent.totalCount;

                  if (loadedValue !== undefined) {
                    return loadedValue;
                  }

                  return loaderCache(parent).loadCount(name, context);
                },
              }),
              ...(connectionOptions as { fields?: (t: unknown) => {} }).fields?.(t),
            })
          : (connectionOptions as { fields: undefined }).fields,
        extensions: {
          ...(connectionOptions as Record<string, {}> | undefined)?.extensions,
          giraphQLPrismaIndirectInclude: {
            getType: () => this.builder.configStore.getTypeConfig(ref).name,
            path: [{ name: 'edges' }, { name: 'node' }],
          },
        },
      },
      edgeOptions,
    );

    return fieldRef;
  } as never;

  constructor(name: string, builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, model: string) {
    super(name, builder);

    this.model = model;
    this.delegate = getDelegateFromModel(builder.options.prisma.client, model);
  }

  relation<
    Field extends string & keyof Model['Include'] & keyof Model['Relations'],
    Nullable extends boolean,
    Args extends InputFieldMap,
    ResolveReturnShape,
  >(
    ...allArgs: NormalizeArgs<
      [
        name: Field,
        options?: RelatedFieldOptions<
          Types,
          Model,
          Field,
          Nullable,
          Args,
          ResolveReturnShape,
          NeedsResolve,
          Shape
        >,
      ]
    >
  ): FieldRef<Model['Relations'][Field]['Shape'], 'Object'> {
    const [name, options = {} as never] = allArgs;
    const relationField = getRelation(this.model, this.builder, name);
    const parentRef = getRefFromModel(this.model, this.builder);
    const ref = getRefFromModel(relationField.type, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    const { query = {}, resolve, ...rest } = options;

    return this.field({
      ...rest,
      type: relationField.isList ? [ref] : ref,
      extensions: {
        ...options.extensions,
        giraphQLPrismaQuery: query,
        giraphQLPrismaRelation: name,
      },
      resolve: (parent, args, context, info) => {
        const mapping = getLoaderMapping(context, info.path);

        const loadedValue = (parent as Record<string, unknown>)[name];

        if (
          // if we attempted to load the relation, and its missing it will be null
          // undefined means that the query was not constructed in a way that requested the relation
          loadedValue !== undefined &&
          mapping
        ) {
          if (loadedValue !== null && loadedValue !== undefined) {
            setLoaderMappings(context, info.path, mapping);
          }

          return loadedValue as never;
        }

        const queryOptions = {
          ...((typeof query === 'function' ? query(args) : query) as {}),
          ...queryFromInfo(context, info),
        };

        if (resolve) {
          return resolve(queryOptions, parent, args as never, context, info) as never;
        }

        if (!findUnique) {
          throw new Error(`Missing findUnique for Prisma type ${this.model}`);
        }

        return loaderCache(parent).loadRelation(name, queryOptions, context) as never;
      },
    }) as FieldRef<Model['Relations'][Field]['Shape'], 'Object'>;
  }

  relationCount<Field extends string & keyof Model['Relations']>(
    ...allArgs: NormalizeArgs<
      [name: Field, options?: RelationCountOptions<Types, Shape, NeedsResolve>]
    >
  ): FieldRef<number, 'Object'> {
    const [name, options = {} as never] = allArgs;
    const parentRef = getRefFromModel(this.model, this.builder);
    const findUnique = getFindUniqueForRef(parentRef, this.builder);
    const loaderCache = ModelLoader.forModel(this.model, this.builder);

    const { resolve, ...rest } = options;

    return this.field({
      ...rest,
      type: 'Int',
      nullable: false,
      extensions: {
        ...options.extensions,
        giraphQLPrismaRelationCount: name,
      },
      resolve: (parent, args, context, info) => {
        const loadedValue = (parent as { _count: Record<string, unknown> })._count?.[name];

        if (loadedValue !== undefined) {
          return loadedValue as never;
        }

        if (resolve) {
          return resolve(parent, args, context, info) as never;
        }

        if (!findUnique) {
          throw new Error(`Missing findUnique for Prisma type ${this.model}`);
        }

        return loaderCache(parent).loadCount(name, context) as never;
      },
    }) as FieldRef<number, 'Object'>;
  }
}