/* eslint-disable no-nested-ternary */
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import ts, { ListFormat, ScriptKind, ScriptTarget, SyntaxKind } from 'typescript';
import { generatorHandler } from '@prisma/generator-helper';

generatorHandler({
  onManifest: () => ({
    prettyName: 'GiraphQL integration',
    defaultOutput: 'node_modules/@giraphql/plugin-prisma/generated.ts',
    requiresGenerators: ['prisma-client-js'],
  }),
  onGenerate: async (options) => {
    const importStatement = ts.factory.createImportDeclaration(
      [],
      [],
      ts.factory.createImportClause(
        true,
        undefined,
        ts.factory.createNamedImports([
          ts.factory.createImportSpecifier(undefined, ts.factory.createIdentifier('Prisma')),
          ...options.dmmf.datamodel.models.map((model) =>
            ts.factory.createImportSpecifier(undefined, ts.factory.createIdentifier(model.name)),
          ),
        ]),
      ),
      ts.factory.createStringLiteral('@prisma/client'),
    );

    const modelTypes = options.dmmf.datamodel.models.map((model) => {
      const relations = model.fields.filter((field) => !!field.relationName);
      const listRelations = model.fields.filter((field) => !!field.relationName && field.isList);

      return ts.factory.createPropertySignature(
        [],
        model.name,
        undefined,
        ts.factory.createTypeLiteralNode([
          ts.factory.createPropertySignature(
            [],
            'Shape',
            undefined,
            ts.factory.createTypeReferenceNode(model.name),
          ),
          ts.factory.createPropertySignature(
            [],
            'Include',
            undefined,
            relations.length > 0
              ? ts.factory.createTypeReferenceNode(`Prisma.${model.name}Include`)
              : ts.factory.createTypeReferenceNode('never'),
          ),
          ts.factory.createPropertySignature(
            [],
            'Where',
            undefined,
            ts.factory.createTypeReferenceNode(`Prisma.${model.name}WhereUniqueInput`),
          ),
          ts.factory.createPropertySignature(
            [],
            'Fields',
            undefined,
            ts.factory.createTypeOperatorNode(
              SyntaxKind.KeyOfKeyword,
              ts.factory.createIndexedAccessTypeNode(
                ts.factory.createIndexedAccessTypeNode(
                  ts.factory.createTypeReferenceNode('PrismaTypes'),
                  ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(model.name)),
                ),
                ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral('Relations')),
              ),
            ),
          ),
          ts.factory.createPropertySignature(
            [],
            'ListRelations',
            undefined,
            listRelations.length > 0
              ? ts.factory.createUnionTypeNode(
                  listRelations.map((field) =>
                    ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(field.name)),
                  ),
                )
              : ts.factory.createTypeReferenceNode('never'),
          ),
          ts.factory.createPropertySignature(
            [],
            'Relations',
            undefined,
            ts.factory.createTypeLiteralNode(
              relations.map((field) =>
                ts.factory.createPropertySignature(
                  [],
                  field.name,
                  undefined,
                  ts.factory.createTypeLiteralNode([
                    ts.factory.createPropertySignature(
                      [],
                      'Shape',
                      undefined,
                      field.isList
                        ? ts.factory.createArrayTypeNode(
                            ts.factory.createTypeReferenceNode(field.type),
                          )
                        : field.isRequired
                        ? ts.factory.createTypeReferenceNode(field.type)
                        : ts.factory.createUnionTypeNode([
                            ts.factory.createTypeReferenceNode(field.type),
                            ts.factory.createLiteralTypeNode(ts.factory.createNull()),
                          ]),
                    ),
                    ts.factory.createPropertySignature(
                      [],
                      'Types',
                      undefined,
                      ts.factory.createIndexedAccessTypeNode(
                        ts.factory.createTypeReferenceNode('PrismaTypes'),
                        ts.factory.createLiteralTypeNode(
                          ts.factory.createStringLiteral(field.type),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ]),
      );
    });

    const prismaTypes = ts.factory.createInterfaceDeclaration(
      [],
      [
        ts.factory.createModifier(SyntaxKind.ExportKeyword),
        ts.factory.createModifier(SyntaxKind.DefaultKeyword),
      ],
      'PrismaTypes',
      [],
      [],
      modelTypes,
    );
    const printer = ts.createPrinter({});

    const sourcefile = ts.createSourceFile(
      options.generator.output!.value,
      '',
      ScriptTarget.ESNext,
      false,
      ScriptKind.TS,
    );

    const nodes = ts.factory.createNodeArray([importStatement, prismaTypes]);

    const result = printer.printList(ListFormat.SourceFileStatements, nodes, sourcefile);

    await mkdir(dirname(sourcefile.fileName), { recursive: true });

    return writeFile(sourcefile.fileName, result);
  },
});