"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function propertyChain(node) {
    const parts = [];
    while (ts.isPropertyAccessExpression(node)) {
        parts.unshift(node.name.text);
        node = node.expression;
    }
    if (ts.isIdentifier(node)) parts.unshift(node.text);
    return parts;
}

function transformScope(sourceFile, source, statements, edits, converted) {
    const functions = new Map();
    const methods = new Map();
    const registered = new Set();
    const unsafePrototypeAssignments = new Set();
    const inheritance = new Map();
    const prototypeConstructorResets = new Map();

    for (const statement of statements) {
        if (
            ts.isFunctionDeclaration(statement) &&
            statement.name &&
            statement.body
        ) {
            functions.set(statement.name.text, statement);
        }

        if (!ts.isExpressionStatement(statement)) continue;
        const expression = statement.expression;

        if (ts.isCallExpression(expression)) {
            const chain = propertyChain(expression.expression);
            if (
                chain.at(-1) === "registerNodeType" &&
                expression.arguments.length >= 2 &&
                ts.isIdentifier(expression.arguments[1])
            ) {
                registered.add(expression.arguments[1].text);
            }
        }

        if (
            !ts.isBinaryExpression(expression) ||
            expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken
        ) {
            continue;
        }

        const chain = propertyChain(expression.left);
        if (chain.length === 2 && chain[1] === "prototype") {
            const right = expression.right;
            const createChain = ts.isCallExpression(right)
                ? propertyChain(right.expression)
                : [];
            const baseChain =
                ts.isCallExpression(right) && right.arguments.length === 1
                    ? propertyChain(right.arguments[0])
                    : [];
            if (
                createChain.join(".") === "Object.create" &&
                baseChain.length === 2 &&
                baseChain[1] === "prototype"
            ) {
                inheritance.set(chain[0], { base: baseChain[0], statement });
            } else {
                unsafePrototypeAssignments.add(chain[0]);
            }
            continue;
        }
        if (
            chain.length === 3 &&
            chain[1] === "prototype" &&
            chain[2] === "constructor" &&
            ts.isIdentifier(expression.right) &&
            expression.right.text === chain[0]
        ) {
            prototypeConstructorResets.set(chain[0], statement);
            continue;
        }
        if (
            chain.length === 3 &&
            chain[1] === "prototype" &&
            ts.isFunctionExpression(expression.right)
        ) {
            const entries = methods.get(chain[0]) || [];
            entries.push({
                statement,
                methodName: chain[2],
                fn: expression.right,
            });
            methods.set(chain[0], entries);
        }
    }

    for (const [name, declaration] of functions) {
        const prototypeMethods = methods.get(name) || [];
        if (
            (!registered.has(name) && prototypeMethods.length === 0) ||
            unsafePrototypeAssignments.has(name)
        ) {
            continue;
        }

        const params = declaration.parameters
            .map((parameter) =>
                source.slice(parameter.getStart(sourceFile), parameter.end),
            )
            .join(", ");
        const inherited = inheritance.get(name);
        let body = source.slice(
            declaration.body.getStart(sourceFile),
            declaration.body.end,
        );
        if (inherited) {
            body = body
                .replace(
                    new RegExp(`${inherited.base}\\.call\\(this\\s*,`),
                    "super(",
                )
                .replace(
                    new RegExp(`${inherited.base}\\.call\\(this\\)`),
                    "super()",
                );
        }
        const classMethods = prototypeMethods
            .map(({ methodName, fn }) => {
                const methodParams = fn.parameters
                    .map((parameter) =>
                        source.slice(
                            parameter.getStart(sourceFile),
                            parameter.end,
                        ),
                    )
                    .join(", ");
                const methodBody = source.slice(
                    fn.body.getStart(sourceFile),
                    fn.body.end,
                );
                const asyncPrefix = fn.modifiers?.some(
                    (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
                )
                    ? "async "
                    : "";
                const generatorPrefix = fn.asteriskToken ? "*" : "";
                return `\n        ${asyncPrefix}${generatorPrefix}${methodName}(${methodParams}) ${methodBody}`;
            })
            .join("\n");

        const replacement =
            `class ${name}${inherited ? ` extends ${inherited.base}` : ""} {\n` +
            `        static [key: string]: any;\n` +
            `        [key: string]: any;\n\n` +
            `        constructor(${params}) ${body}` +
            `${classMethods}\n    }`;

        edits.push({
            start: declaration.getStart(sourceFile),
            end: declaration.end,
            text: replacement,
        });
        for (const method of prototypeMethods) {
            edits.push({
                start: method.statement.getStart(sourceFile),
                end: method.statement.end,
                text: "",
            });
        }
        if (inherited) {
            edits.push({
                start: inherited.statement.getStart(sourceFile),
                end: inherited.statement.end,
                text: "",
            });
        }
        const constructorReset = prototypeConstructorResets.get(name);
        if (constructorReset) {
            edits.push({
                start: constructorReset.getStart(sourceFile),
                end: constructorReset.end,
                text: "",
            });
        }
        converted.push(name);
    }

    function visitNestedScopes(node) {
        ts.forEachChild(node, (child) => {
            if (ts.isBlock(child) || ts.isSourceFile(child)) {
                transformScope(
                    sourceFile,
                    source,
                    child.statements,
                    edits,
                    converted,
                );
                return;
            }
            visitNestedScopes(child);
        });
    }
    for (const statement of statements) visitNestedScopes(statement);
}

function modernize(fileName) {
    const absolutePath = path.resolve(fileName);
    const source = fs.readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
    const sourceFile = ts.createSourceFile(
        absolutePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    );
    const edits = [];
    const converted = [];
    transformScope(sourceFile, source, sourceFile.statements, edits, converted);

    let output = source;
    for (const edit of edits.sort(
        (a, b) => b.start - a.start || b.end - a.end,
    )) {
        output =
            output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    }
    fs.writeFileSync(absolutePath, output.replace(/[ \t]+$/gm, ""));
    return converted;
}

const files = process.argv.slice(2);
if (!files.length) {
    console.error("Usage: node scripts/modernize-classes.js <file.ts> [...]");
    process.exit(1);
}

for (const file of files) {
    const converted = modernize(file);
    console.log(
        `${file}: converted ${converted.length} classes${converted.length ? ` (${converted.join(", ")})` : ""}`,
    );
}
