"use strict";

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, "build");

const core = ["src/litegraph.ts"];
const mini = [
    ...core,
    "src/nodes/base.ts",
    "src/nodes/events.ts",
    "src/nodes/input.ts",
    "src/nodes/math.ts",
    "src/nodes/strings.ts",
    "src/nodes/logic.ts",
    "src/nodes/network.ts",
];
const full = [
    ...core,
    "src/nodes/base.ts",
    "src/nodes/events.ts",
    "src/nodes/interface.ts",
    "src/nodes/input.ts",
    "src/nodes/math.ts",
    "src/nodes/math3d.ts",
    "src/nodes/strings.ts",
    "src/nodes/logic.ts",
    "src/nodes/graphics.ts",
    "src/nodes/gltextures.ts",
    "src/nodes/glshaders.ts",
    "src/nodes/geometry.ts",
    "src/nodes/glfx.ts",
    "src/nodes/midi.ts",
    "src/nodes/audio.ts",
    "src/nodes/network.ts",
];

const compilerOptions = {
    target: ts.ScriptTarget.ES2019,
    module: ts.ModuleKind.None,
    newLine: ts.NewLineKind.LineFeed,
    removeComments: false,
};

function compile(relativePath) {
    const sourcePath = path.join(root, relativePath);
    const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
    const result = ts.transpileModule(source, {
        compilerOptions,
        fileName: sourcePath,
        reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter(
        diagnostic => diagnostic.category === ts.DiagnosticCategory.Error
    );
    if (errors.length) {
        throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
            getCanonicalFileName: fileName => fileName,
            getCurrentDirectory: () => root,
            getNewLine: () => "\n",
        }));
    }
    return result.outputText
        .replace(/[ \t]+(?=\r?$)/gm, "")
        .trimEnd() + "\n";
}

function writeBundle(name, files) {
    const outputPath = path.join(buildDir, name);
    fs.writeFileSync(outputPath, files.map(compile).join("\n"));
}

fs.mkdirSync(path.join(buildDir, "src", "nodes"), { recursive: true });

for (const relativePath of ["src/litegraph-editor.ts", ...new Set(full.concat("src/nodes/others.ts"))]) {
    const emittedPath = path.join(buildDir, relativePath.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(emittedPath), { recursive: true });
    fs.writeFileSync(emittedPath, compile(relativePath));
}

writeBundle("litegraph.core.js", core);
writeBundle("litegraph_mini.js", mini);
writeBundle("litegraph.js", full);

console.log("Built full, mini, and core bundles from TypeScript sources.");
