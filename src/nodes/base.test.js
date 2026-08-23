const fs = require("fs");
const path = require("path");

function loadLiteGraphWithBaseNodes() {
    jest.resetModules();
    const litegraph = require("../../build/src/litegraph");
    const source = fs.readFileSync(
        path.join(__dirname, "../../build/src/nodes/base.js"),
        "utf8"
    );
    Function(source).call({ LiteGraph: litegraph.LiteGraph });
    return litegraph;
}

function createInputNode(litegraph, type) {
    const node = new litegraph.LGraphNode();
    node.addInput("value", type);
    return node;
}

function createOutputNode(litegraph, type) {
    const node = new litegraph.LGraphNode();
    node.addOutput("value", type);
    return node;
}

describe("automatic subgraph input and output nodes", () => {
    let litegraph;
    let LiteGraph;

    beforeEach(() => {
        litegraph = loadLiteGraphWithBaseNodes();
        LiteGraph = litegraph.LiteGraph;
    });

    test("auto input inherits, restricts, and resets its type", () => {
        const graph = new litegraph.LGraph();
        const autoInput = LiteGraph.createNode("graph/auto_input");
        const firstNumberInput = createInputNode(litegraph, "number");
        const secondNumberInput = createInputNode(litegraph, "number");
        const stringInput = createInputNode(litegraph, "string");

        graph.add(autoInput);
        graph.add(firstNumberInput);
        graph.add(secondNumberInput);
        graph.add(stringInput);
        autoInput.setProperty("name", "value");

        expect(autoInput.outputs[0].type).toBe("");
        expect(autoInput.connect(0, firstNumberInput, 0)).not.toBeNull();
        expect(autoInput.outputs[0].type).toBe("number");
        expect(autoInput.properties.type).toBe("number");
        expect(graph.inputs.value.type).toBe("number");

        expect(autoInput.connect(0, stringInput, 0)).toBeNull();
        expect(autoInput.connect(0, secondNumberInput, 0)).not.toBeNull();

        autoInput.disconnectOutput(0, firstNumberInput);
        expect(autoInput.outputs[0].type).toBe("number");

        autoInput.disconnectOutput(0);
        expect(autoInput.outputs[0].type).toBe("");
        expect(autoInput.properties.type).toBe("");
        expect(graph.inputs.value.type).toBe("");
    });

    test("auto output inherits, restricts, and resets its type", () => {
        const graph = new litegraph.LGraph();
        const autoOutput = LiteGraph.createNode("graph/auto_output");
        const numberOutput = createOutputNode(litegraph, "number");
        const stringOutput = createOutputNode(litegraph, "string");

        graph.add(autoOutput);
        graph.add(numberOutput);
        graph.add(stringOutput);
        autoOutput.setProperty("name", "value");

        expect(autoOutput.inputs[0].type).toBe("");
        expect(numberOutput.connect(0, autoOutput, 0)).not.toBeNull();
        expect(autoOutput.inputs[0].type).toBe("number");
        expect(autoOutput.properties.type).toBe("number");
        expect(graph.outputs.value.type).toBe("number");

        expect(stringOutput.connect(0, autoOutput, 0)).toBeNull();

        autoOutput.disconnectInput(0);
        expect(autoOutput.inputs[0].type).toBe("");
        expect(autoOutput.properties.type).toBe("");
        expect(graph.outputs.value.type).toBe("");
    });

    test("inferred types propagate to the containing subgraph node", () => {
        const graph = new litegraph.LGraph();
        const subgraphNode = LiteGraph.createNode("graph/subgraph");
        const autoInput = LiteGraph.createNode("graph/auto_input");
        const autoOutput = LiteGraph.createNode("graph/auto_output");
        const numberInput = createInputNode(litegraph, "number");
        const stringOutput = createOutputNode(litegraph, "string");

        graph.add(subgraphNode);
        subgraphNode.subgraph.add(autoInput);
        subgraphNode.subgraph.add(autoOutput);
        subgraphNode.subgraph.add(numberInput);
        subgraphNode.subgraph.add(stringOutput);
        autoInput.setProperty("name", "input");
        autoOutput.setProperty("name", "output");

        autoInput.connect(0, numberInput, 0);
        stringOutput.connect(0, autoOutput, 0);

        expect(subgraphNode.inputs[0].type).toBe("number");
        expect(subgraphNode.outputs[0].type).toBe("string");

        autoInput.disconnectOutput(0);
        autoOutput.disconnectInput(0);

        expect(subgraphNode.inputs[0].type).toBe("");
        expect(subgraphNode.outputs[0].type).toBe("");
    });

    test("inferred types survive serialization while connected", () => {
        const graph = new litegraph.LGraph();
        const autoInput = LiteGraph.createNode("graph/auto_input");
        const numberInput = createInputNode(litegraph, "number");

        graph.add(autoInput);
        graph.add(numberInput);
        autoInput.setProperty("name", "value");
        autoInput.connect(0, numberInput, 0);

        const restored = new litegraph.LGraph();
        restored.configure(graph.serialize());
        const restoredAutoInput = restored._nodes.find(
            (node) => node.type === "graph/auto_input"
        );

        expect(restoredAutoInput.outputs[0].type).toBe("number");
        expect(restored.inputs.value.type).toBe("number");

        const clonedAutoInput = restoredAutoInput.clone();
        expect(clonedAutoInput.outputs[0].type).toBe("");
        expect(clonedAutoInput.properties.type).toBe("");

        restoredAutoInput.disconnectOutput(0);
        expect(restoredAutoInput.outputs[0].type).toBe("");
        expect(restored.inputs.value.type).toBe("");
    });

    test("auto input supports event connections", () => {
        const graph = new litegraph.LGraph();
        const autoInput = LiteGraph.createNode("graph/auto_input");
        const actionTarget = createInputNode(litegraph, LiteGraph.ACTION);
        actionTarget.onAction = jest.fn();

        graph.add(autoInput);
        graph.add(actionTarget);
        autoInput.setProperty("name", "trigger");
        autoInput.connect(0, actionTarget, 0);

        expect(autoInput.outputs[0].type).toBe(LiteGraph.ACTION);
        graph.onAction("trigger", "payload");
        expect(actionTarget.onAction).toHaveBeenCalledWith(
            "value",
            "payload",
            expect.any(Object),
            0
        );
    });
});
