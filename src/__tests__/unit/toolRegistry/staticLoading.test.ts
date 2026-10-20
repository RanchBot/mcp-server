import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as ts from 'typescript';

/**
 * Regression guard for MTC-SRC-005 / the runtime-selected module-loading removal: the server
 * factory must dispatch to statically bound handlers only. `serverFactory.ts` may not contain a
 * dynamic `import()` or a `require()` with a non-literal specifier, and `toolRegistry.ts` may only
 * load handlers from literal in-package paths.
 */
const SOURCE_FILES = ['serverFactory', 'toolRegistry'].map((name) => ({
  name,
  path: resolve(__dirname, `../../../${name}.ts`),
}));

const parse = (path: string) =>
  ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);

const collect = (node: ts.Node, visit: (node: ts.Node) => void) => {
  visit(node);
  ts.forEachChild(node, (child) => collect(child, visit));
};

describe('static module loading', () => {
  it.each(SOURCE_FILES)('$name.ts has no dynamic import or non-literal require', ({ path }) => {
    const violations: string[] = [];
    collect(parse(path), (node) => {
      if (!ts.isCallExpression(node)) {
        return;
      }
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        violations.push('dynamic import()');
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        !node.arguments.every((argument) => ts.isStringLiteral(argument))
      ) {
        violations.push('require() with a non-literal specifier');
      }
    });
    expect(violations).toEqual([]);
  });

  it('loads every tool handler from a literal in-package path', () => {
    const source = parse(resolve(__dirname, '../../../toolRegistry.ts'));
    const specifiers: string[] = [];
    source.forEachChild((node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        !node.importClause?.isTypeOnly
      ) {
        specifiers.push(node.moduleSpecifier.text);
      }
    });
    expect(specifiers.length).toBeGreaterThan(50);
    for (const specifier of specifiers) {
      expect(specifier).toMatch(/^\.\/tools\/[a-z0-9_]+$/);
    }
  });
});
