import { resolveArrayConnection, resolveOffsetConnection } from '../../../../src';
import builder from '../builder';

class NumberThing {
  id: number;

  constructor(n: number) {
    this.id = n;
  }
}

class BatchLoadableNumberThing {
  id: number;

  constructor(n: number) {
    this.id = n;
  }
}

builder.node(NumberThing, {
  id: {
    resolve: (n) => n.id,
  },
  loadOne: (id) => new NumberThing(Number.parseInt(id, 10)),
  name: 'Number',
  fields: (t) => ({
    number: t.exposeInt('id', {}),
  }),
});

builder.node(BatchLoadableNumberThing, {
  id: {
    resolve: (n) => n.id,
  },
  loadMany: (ids) => ids.map((id) => new BatchLoadableNumberThing(Number.parseInt(id, 10))),
  name: 'BatchNumber',
  fields: (t) => ({
    number: t.exposeInt('id', {}),
  }),
});

builder.queryFields((t) => ({
  numbers: t.connection(
    {
      type: NumberThing,
      resolve: async (parent, args) => {
        const result = await resolveOffsetConnection({ args }, ({ limit, offset }) => {
          const items = [];

          for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
            items.push(new NumberThing(i));
          }

          return items;
        });

        return {
          totalCount: 500,
          other: 'abc',
          ...result,
        };
      },
    },
    {
      fields: (t2) => ({
        other: t2.exposeString('other'),
      }),
    },
  ),
}));

builder.queryFields((t) => ({
  nullableNumbers: t.connection(
    {
      type: NumberThing,
      nullable: true,
      resolve: async (parent, args) => {
        const result = await resolveOffsetConnection(
          { args },
          ({ limit, offset }) => null as NumberThing[] | null,
        );

        if (!result) {
          return null;
        }

        return {
          totalCount: 500,
          other: 'abc',
          ...result,
        };
      },
    },
    {
      fields: (t2) => ({
        other: t2.exposeString('other'),
      }),
    },
  ),
  oddNumbers: t.connection({
    type: NumberThing,
    edgesNullable: {
      items: true,
      list: false,
    },
    nodeNullable: false,
    resolve: async (parent, args) => {
      const result = await resolveOffsetConnection({ args }, () => [
        new NumberThing(1),
        null,
        new NumberThing(3),
      ]);

      return {
        totalCount: 500,
        other: 'abc',
        ...result,
      };
    },
  }),
}));

builder.queryFields((t) => ({
  batchNumbers: t.connection({
    type: BatchLoadableNumberThing,
    resolve: (parent, args) => {
      const numbers: BatchLoadableNumberThing[] = [];

      for (let i = 0; i < 200; i += 1) {
        numbers.push(new BatchLoadableNumberThing(i));
      }

      const result = resolveArrayConnection({ args }, numbers);

      return result && { totalCount: 500, ...result };
    },
  }),
  extraNode: t.node({
    id: () => 'TnVtYmVyOjI=',
  }),
  moreNodes: t.nodeList({
    ids: () => ['TnVtYmVyOjI=', { id: 10, type: NumberThing }],
  }),
}));

const SharedConnection = builder.connectionObject({
  name: 'SharedConnection',
  type: NumberThing,
});

builder.queryField('sharedConnection', (t) =>
  t.field({
    type: SharedConnection,
    nullable: true,
    args: {
      ...t.arg.connectionArgs(),
    },
    resolve: async (root, args) => {
      const result = await resolveOffsetConnection({ args }, ({ limit, offset }) => {
        const items = [];

        for (let i = offset; i < Math.min(offset + limit, 200); i += 1) {
          items.push(new NumberThing(i));
        }

        return items;
      });

      return {
        totalCount: 500,
        ...result,
      };
    },
  }),
);
