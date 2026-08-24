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

    test("property input creates a widget instead of a subgraph input", () => {
        const graph = new litegraph.LGraph();
        const subgraphNode = LiteGraph.createNode("graph/subgraph");
        const propertyInput = LiteGraph.createNode("graph/property_input");
        const numberInput = createInputNode(litegraph, "number");

        graph.add(subgraphNode);
        subgraphNode.subgraph.add(propertyInput);
        subgraphNode.subgraph.add(numberInput);
        propertyInput.setProperty("name", "gain");
        propertyInput.connect(0, numberInput, 0);
        subgraphNode.setProperty("gain", 2.5);
        propertyInput.onExecute();

        expect(subgraphNode.findInputSlot("gain")).toBe(-1);
        expect(subgraphNode.widgets).toHaveLength(1);
        expect(subgraphNode.widgets[0]).toMatchObject({
            name: "gain",
            type: "number",
            value: 2.5,
        });
        expect(propertyInput.properties.type).toBe("number");
        expect(propertyInput.property_type_widget.disabled).toBe(true);
        expect(numberInput.getInputData(0)).toBe(2.5);
    });

    test("property input maps generic and custom types to primitive widgets", () => {
        const graph = new litegraph.LGraph();
        const subgraphNode = LiteGraph.createNode("graph/subgraph");
        const propertyInput = LiteGraph.createNode("graph/property_input");
        const customInput = createInputNode(litegraph, "custom/vector");

        graph.add(subgraphNode);
        subgraphNode.subgraph.add(propertyInput);
        subgraphNode.subgraph.add(customInput);
        propertyInput.setProperty("name", "vectorPreset");
        propertyInput.connect(0, customInput, 0);

        expect(propertyInput.properties.type).toBe("custom/vector");
        expect(propertyInput.property_type_widget.disabled).toBe(false);
        expect(subgraphNode.widgets[0].type).toBe("number");

        propertyInput.setProperty("property_type", "string");
        subgraphNode.setProperty("vectorPreset", "fast");
        propertyInput.onExecute();

        expect(subgraphNode.widgets[0].type).toBe("text");
        expect(customInput.getInputData(0)).toBe("fast");

        propertyInput.setProperty("property_type", "boolean");
        expect(subgraphNode.widgets[0].type).toBe("toggle");
        expect(subgraphNode.properties.vectorPreset).toBe(true);
    });

    test("property input renames, validates, and removes its parent property", () => {
        const graph = new litegraph.LGraph();
        const subgraphNode = LiteGraph.createNode("graph/subgraph");
        const propertyInput = LiteGraph.createNode("graph/property_input");
        const duplicate = LiteGraph.createNode("graph/property_input");

        graph.add(subgraphNode);
        subgraphNode.subgraph.add(propertyInput);
        subgraphNode.subgraph.add(duplicate);
        propertyInput.setProperty("name", "amount");
        propertyInput.setProperty("value", 4);

        expect(subgraphNode.properties.amount).toBe(4);
        subgraphNode.setProperty("amount", 7);
        propertyInput.setProperty("name", "renamedAmount");

        expect(subgraphNode.properties.amount).toBeUndefined();
        expect(subgraphNode.properties.renamedAmount).toBe(7);
        expect(subgraphNode.widgets[0].name).toBe("renamedAmount");

        duplicate.setProperty("name", "renamedAmount");
        expect(duplicate.properties.name).toBe("");
        expect(subgraphNode.widgets).toHaveLength(1);

        subgraphNode.subgraph.remove(propertyInput);
        expect(subgraphNode.properties.renamedAmount).toBeUndefined();
        expect(subgraphNode.widgets).toHaveLength(0);
    });

    test("property input widget and value survive subgraph serialization", () => {
        const graph = new litegraph.LGraph();
        const subgraphNode = LiteGraph.createNode("graph/subgraph");
        const propertyInput = LiteGraph.createNode("graph/property_input");
        const watch = LiteGraph.createNode("basic/watch");

        graph.add(subgraphNode);
        subgraphNode.subgraph.add(propertyInput);
        subgraphNode.subgraph.add(watch);
        propertyInput.setProperty("name", "threshold");
        propertyInput.setProperty("property_type", "number");
        propertyInput.connect(0, watch, 0);
        subgraphNode.setProperty("threshold", 12);

        const serializedSubgraph = subgraphNode.serialize();
        subgraphNode.setProperty("threshold", 99);
        subgraphNode.configure(serializedSubgraph);

        expect(subgraphNode.properties.threshold).toBe(12);
        expect(subgraphNode.widgets).toHaveLength(1);

        const restoredGraph = new litegraph.LGraph();
        restoredGraph.configure(graph.serialize());
        const restoredSubgraph = restoredGraph.findNodesByType(
            "graph/subgraph"
        )[0];
        const restoredPropertyInput = restoredSubgraph.subgraph.findNodesByType(
            "graph/property_input"
        )[0];
        const restoredWatch = restoredSubgraph.subgraph.findNodesByType(
            "basic/watch"
        )[0];

        restoredPropertyInput.onExecute();
        restoredWatch.onExecute();

        expect(restoredSubgraph.properties.threshold).toBe(12);
        expect(restoredSubgraph.widgets).toHaveLength(1);
        expect(restoredSubgraph.widgets[0]).toMatchObject({
            name: "threshold",
            type: "number",
            value: 12,
        });
        expect(restoredWatch.value).toBe(12);
    });
});
