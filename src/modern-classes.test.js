describe("modern TypeScript classes", () => {
    let api;

    beforeAll(() => {
        api = require("../build/litegraph.js");
    });

    const expectNativeClass = (constructor) => {
        expect(typeof constructor).toBe("function");
        expect(Function.prototype.toString.call(constructor)).toMatch(
            /^class\s/,
        );
    };

    test("exports the core API as native classes", () => {
        [
            api.LGraph,
            api.LGraphNode,
            api.LGraphGroup,
            api.LGraphCanvas,
            api.LiteGraph.LLink,
            api.LiteGraph.DragAndScale,
            api.LiteGraph.ContextMenu,
        ].forEach(expectNativeClass);
    });

    test("registers every bundled node as a native class", () => {
        const registeredTypes = Object.values(
            api.LiteGraph.registered_node_types,
        );

        expect(registeredTypes.length).toBeGreaterThan(100);
        registeredTypes.forEach(expectNativeClass);
    });

    test("preserves node behavior and non-enumerable class methods", () => {
        const node = api.LiteGraph.createNode("events/log");
        const method = Object.getOwnPropertyDescriptor(
            node.constructor.prototype,
            "onAction",
        );

        expect(typeof node.configure).toBe("function");
        expect(node.configure).toBe(api.LGraphNode.prototype.configure);
        expect(method).toMatchObject({
            configurable: true,
            enumerable: false,
            writable: true,
        });
    });

    test("uses real inheritance for automatic graph inputs", () => {
        const node = api.LiteGraph.createNode("graph/auto_input");

        expectNativeClass(api.LiteGraph.GraphInput);
        expectNativeClass(api.LiteGraph.GraphAutoInput);
        expect(node).toBeInstanceOf(api.LiteGraph.GraphAutoInput);
        expect(node).toBeInstanceOf(api.LiteGraph.GraphInput);
        expect(node.configure).toBe(api.LGraphNode.prototype.configure);
    });
});
