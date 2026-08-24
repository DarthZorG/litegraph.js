describe("cross-graph node transfer", () => {
    let api;
    let LiteGraph;
    let clipboard;

    beforeEach(() => {
        jest.resetModules();
        api = require("../build/litegraph.js");
        LiteGraph = api.LiteGraph;
        clipboard = new Map();
        global.localStorage = {
            getItem: (key) => clipboard.get(key) || null,
            setItem: (key, value) => clipboard.set(key, value),
        };
    });

    afterEach(() => {
        LiteGraph.use_uuids = false;
        delete global.localStorage;
    });

    function createCanvas(graph) {
        return new api.LGraphCanvas(null, graph, { skip_render: true });
    }

    function addConnectedNodes(graph) {
        const origin = LiteGraph.createNode("basic/const");
        const target = LiteGraph.createNode("math/operation");
        graph.add(origin);
        graph.add(target);
        origin.connect(0, target, 0);
        return { origin, target };
    }

    test("copies from a subgraph and pastes into its parent", () => {
        const parent = new api.LGraph();
        const subgraphNode = LiteGraph.createNode("graph/subgraph");
        parent.add(subgraphNode);
        const { origin, target } = addConnectedNodes(subgraphNode.subgraph);
        const canvas = createCanvas(subgraphNode.subgraph);

        canvas.selected_nodes = {
            [origin.id]: origin,
            [target.id]: target,
        };
        canvas.copyToClipboard();

        parent.attachCanvas(canvas);
        canvas.graph_mouse = [300, 200];
        const pasted = canvas.pasteFromClipboard();

        expect(pasted.map((node) => node.type)).toEqual([
            "basic/const",
            "math/operation",
        ]);
        expect(pasted[1].inputs[0].link).not.toBeNull();
        expect(parent.links[pasted[1].inputs[0].link].origin_id).toBe(
            pasted[0].id
        );
    });

    test("copies from a parent and pastes into a subgraph", () => {
        const parent = new api.LGraph();
        const subgraphNode = LiteGraph.createNode("graph/subgraph");
        const node = LiteGraph.createNode("basic/const");
        parent.add(subgraphNode);
        parent.add(node);
        const canvas = createCanvas(parent);

        canvas.selected_nodes = { [node.id]: node };
        canvas.copyToClipboard();
        subgraphNode.subgraph.attachCanvas(canvas);
        const [pasted] = canvas.pasteFromClipboard();

        expect(pasted.type).toBe("basic/const");
        expect(pasted.graph).toBe(subgraphNode.subgraph);
    });

    test("does not reuse stale relative IDs from unselected nodes", () => {
        const source = new api.LGraph();
        const destination = new api.LGraph();
        const { origin, target } = addConnectedNodes(source);
        const canvas = createCanvas(source);

        origin._relative_id = 0;
        canvas.selected_nodes = { [target.id]: target };
        canvas.copyToClipboard();

        const data = JSON.parse(
            clipboard.get("litegrapheditor_clipboard")
        );
        expect(data.links[0][0]).toBeNull();

        destination.attachCanvas(canvas);
        const [pasted] = canvas.pasteFromClipboard();
        expect(pasted.inputs[0].link).toBeNull();
    });

    test("clones a selection directly into its parent with internal links", () => {
        const parent = new api.LGraph();
        const subgraphNode = LiteGraph.createNode("graph/subgraph");
        subgraphNode.pos = [100, 80];
        parent.add(subgraphNode);
        const { origin, target } = addConnectedNodes(subgraphNode.subgraph);
        const canvas = createCanvas(subgraphNode.subgraph);

        canvas.selected_nodes = {
            [origin.id]: origin,
            [target.id]: target,
        };
        const cloned = canvas.cloneNodesToGraph(parent);

        expect(cloned).toHaveLength(2);
        expect(cloned[0].graph).toBe(parent);
        expect(cloned[1].inputs[0].link).not.toBeNull();
        expect(cloned[0].pos[0]).toBeGreaterThan(
            subgraphNode.pos[0] + subgraphNode.size[0]
        );
    });

    test("builds a hierarchical destination menu and clones into a nested graph", () => {
        const root = new api.LGraph();
        const subgraphB = LiteGraph.createNode("graph/subgraph");
        subgraphB.title = "B";
        root.add(subgraphB);
        const subgraphC = LiteGraph.createNode("graph/subgraph");
        subgraphC.title = "C";
        subgraphB.subgraph.add(subgraphC);
        const node = LiteGraph.createNode("basic/const");
        subgraphB.subgraph.add(node);
        const canvas = createCanvas(subgraphB.subgraph);
        canvas.selected_nodes = { [node.id]: node };

        const nodeMenu = canvas.getNodeMenuOptions(node);
        const cloneInto = nodeMenu.find(
            (option) => option && option.content === "Clone into..."
        );
        const bDestination = cloneInto.submenu.options.find(
            (option) => option && option.content === "B"
        );
        const cDestination = bDestination.submenu.options.find(
            (option) => option && option.content === "C"
        );

        expect(cloneInto.submenu.options[0].content).toBe("Parent graph");
        expect(
            bDestination.submenu.options.find(
                (option) =>
                    option && option.content === "This graph (current)"
            ).disabled
        ).toBe(true);

        cDestination.callback();
        expect(subgraphC.subgraph._nodes.map((item) => item.type)).toEqual([
            "basic/const",
        ]);

        canvas.copyToClipboard([node]);
        const paste = canvas
            .getCanvasMenuOptions()
            .find((option) => option && option.content === "Paste");
        const countBeforePaste = subgraphB.subgraph._nodes.length;
        paste.callback({ content: "Paste" });
        expect(subgraphB.subgraph._nodes).toHaveLength(countBeforePaste + 1);
    });

    test("reassigns nested subgraph UUIDs when cloning across graphs", () => {
        LiteGraph.use_uuids = true;
        const destination = new api.LGraph();
        const source = new api.LGraph();
        const nested = LiteGraph.createNode("graph/subgraph");
        source.add(nested);
        addConnectedNodes(nested.subgraph);
        const canvas = createCanvas(source);
        canvas.selected_nodes = { [nested.id]: nested };

        const [cloned] = canvas.cloneNodesToGraph(destination);
        const originalIDs = nested.subgraph._nodes.map((node) => node.id);
        const clonedIDs = cloned.subgraph._nodes.map((node) => node.id);

        expect(cloned.id).not.toBe(nested.id);
        expect(clonedIDs).not.toEqual(originalIDs);
        expect(cloned.subgraph._nodes[1].inputs[0].link).not.toBeNull();
    });
});
