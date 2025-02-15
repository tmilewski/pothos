import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import { prisma } from './example/builder';
import schema from './example/schema';

let queries: unknown[] = [];
prisma.$use((params, next) => {
  queries.push(params);

  return next(params);
});

describe('prisma', () => {
  afterEach(() => {
    queries = [];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('query for multiple nodes', async () => {
    const query = gql`
      query {
        node(id: "VXNlcjox") {
          __typename
          id
          ... on User {
            name
            email
            profile {
              id
              bio
              user {
                id
              }
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "node": Object {
            "__typename": "User",
            "email": "Maurine.Rath@gmail.com",
            "id": "VXNlcjox",
            "name": "Maurine Rath",
            "profile": Object {
              "bio": "Saepe deserunt animi quia.",
              "id": "1",
              "user": Object {
                "id": "VXNlcjox",
              },
            },
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "profile": Object {
                "include": Object {
                  "user": true,
                },
              },
            },
            "where": Object {
              "id": 1,
            },
          },
          "dataPath": Array [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('query for single node', async () => {
    const query = gql`
      query {
        nodes(ids: ["VXNlcjox", "VXNlcjoy"]) {
          __typename
          id
          ... on User {
            name
            email
            profile {
              id
              bio
              user {
                id
              }
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "nodes": Array [
            Object {
              "__typename": "User",
              "email": "Maurine.Rath@gmail.com",
              "id": "VXNlcjox",
              "name": "Maurine Rath",
              "profile": Object {
                "bio": "Saepe deserunt animi quia.",
                "id": "1",
                "user": Object {
                  "id": "VXNlcjox",
                },
              },
            },
            Object {
              "__typename": "User",
              "email": "Kyla_Schoen@yahoo.com",
              "id": "VXNlcjoy",
              "name": "Kyla Schoen",
              "profile": null,
            },
          ],
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "profile": Object {
                "include": Object {
                  "user": true,
                },
              },
            },
            "where": Object {
              "id": 1,
            },
          },
          "dataPath": Array [],
          "model": "User",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "profile": Object {
                "include": Object {
                  "user": true,
                },
              },
            },
            "where": Object {
              "id": 2,
            },
          },
          "dataPath": Array [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('query with multiple fragments', async () => {
    const query = gql`
      query {
        node(id: "VXNlcjox") {
          __typename
          id
          ... on User {
            posts {
              id
            }
          }
          ... on User {
            profile {
              id
            }
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "node": Object {
            "__typename": "User",
            "id": "VXNlcjox",
            "posts": Array [
              Object {
                "id": "250",
              },
              Object {
                "id": "249",
              },
              Object {
                "id": "248",
              },
              Object {
                "id": "247",
              },
              Object {
                "id": "246",
              },
              Object {
                "id": "245",
              },
              Object {
                "id": "244",
              },
              Object {
                "id": "243",
              },
              Object {
                "id": "242",
              },
              Object {
                "id": "241",
              },
            ],
            "profile": Object {
              "id": "1",
            },
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "posts": Object {
                "include": Object {
                  "comments": Object {
                    "include": Object {
                      "author": true,
                    },
                    "take": 3,
                  },
                },
                "orderBy": Object {
                  "createdAt": "desc",
                },
                "take": 10,
              },
              "profile": true,
            },
            "where": Object {
              "id": 1,
            },
          },
          "dataPath": Array [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('resolvers branded nodes in interfaces', async () => {
    const query = gql`
      query {
        named {
          name
          ... on User {
            id
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "named": Array [
            Object {
              "id": "VXNlcjox",
              "name": "Maurine Rath",
            },
            null,
          ],
        },
        "errors": Array [
          [GraphQLError: Abstract type "Named" must resolve to an Object type at runtime for field "Query.named". Either the "Named" type should provide a "resolveType" function or each possible type should provide an "isTypeOf" function.],
        ],
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findFirst",
          "args": Object {
            "where": Object {
              "id": 1,
            },
          },
          "dataPath": Array [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('resolves unions', async () => {
    const query = gql`
      query {
        userOrProfile {
          __typename
          ... on User {
            id
          }
          ... on Profile {
            id
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "userOrProfile": Array [
            Object {
              "__typename": "User",
              "id": "VXNlcjox",
            },
            Object {
              "__typename": "Profile",
              "id": "1",
            },
          ],
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findFirst",
          "args": Object {
            "where": Object {
              "id": 1,
            },
          },
          "dataPath": Array [],
          "model": "User",
          "runInTransaction": false,
        },
        Object {
          "action": "findUnique",
          "args": Object {
            "where": Object {
              "id": 1,
            },
          },
          "dataPath": Array [],
          "model": "Profile",
          "runInTransaction": false,
        },
      ]
    `);
  });

  it('loads type includes', async () => {
    const query = gql`
      query {
        node(id: "Vmlld2VyTm9kZTox") {
          id
          ... on ViewerNode {
            bio
          }
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: { user: { id: 1 } },
    });

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "node": Object {
            "bio": "Saepe deserunt animi quia.",
            "id": "Vmlld2VyTm9kZTox",
          },
        },
      }
    `);

    expect(queries).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "findUnique",
          "args": Object {
            "include": Object {
              "profile": true,
            },
            "where": Object {
              "id": 1,
            },
          },
          "dataPath": Array [],
          "model": "User",
          "runInTransaction": false,
        },
      ]
    `);
  });
});
