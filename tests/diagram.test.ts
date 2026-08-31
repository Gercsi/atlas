import assert from "node:assert/strict";
import { radialLayout, topology, nodeSize } from "../frontend/graph/layout";
import { routeGraph } from "../frontend/graph/router";
import { fixture } from "../frontend/graph/fixtures";
import {
  aggregateEdges,
  bounds,
  inflate,
  intersects,
  segmentHits,
  type GraphNode,
  type GraphEdge,
  type Obstacle,
  type Point,
} from "../frontend/graph/model";
function geometry(
  nodes: GraphNode[],
  edges: GraphEdge[],
  positions: Record<string, Point>,
): Obstacle[] {
  const parents = new Set(nodes.map((n) => n.parent));
  const result: Obstacle[] = nodes
    .filter((n) => !parents.has(n.id))
    .map((n) => {
      const p = positions[n.id],
        s = nodeSize(n, edges);
      return {
        id: n.id,
        parent: n.parent,
        x1: p.x - s.w / 2,
        y1: p.y - s.h / 2,
        x2: p.x + s.w / 2,
        y2: p.y + s.h / 2,
      };
    });
  const addGroup = (n: GraphNode): Obstacle => {
    const existing = result.find((o) => o.id === n.id);
    if (existing) return existing;
    const r = inflate(
      bounds(
        nodes
          .filter((o) => o.parent === n.id)
          .map((child) =>
            parents.has(child.id)
              ? addGroup(child)
              : result.find((o) => o.id === child.id)!,
          ),
      ),
      35,
    );
    const group = { ...r, id: n.id, group: true, parent: n.parent };
    result.push(group);
    result.push({
      id: "header:" + n.id,
      header: true,
      x1: r.x1,
      y1: r.y1 - 20,
      x2: r.x2,
      y2: r.y1 + 12,
    });
    return group;
  };
  nodes.filter((n) => parents.has(n.id)).forEach(addGroup);
  return result;
}
function verify(
  input: { nodes: Obstacle[]; edges: GraphEdge[] },
  r: ReturnType<typeof routeGraph>,
) {
  const byId = new Map(input.nodes.map((n) => [n.id, n]));
  for (const route of r.routes) {
    const e = input.edges.find((e) => e.id === route.id)!;
    const allowed = new Set([e.source, e.target]);
    for (const id of [e.source, e.target]) {
      let p = byId.get(id)?.parent;
      while (p) {
        allowed.add(p);
        p = byId.get(p)?.parent;
      }
    }
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i];
      assert.ok(a.x === b.x || a.y === b.y, "orthogonal");
      for (const o of input.nodes)
        if (!allowed.has(o.id))
          assert.ok(
            !segmentHits(a, b, inflate(o, 5)),
            `${e.id} intersects ${o.id}`,
          );
      for (const other of r.routes)
        if (other.id !== route.id && other.label)
          assert.ok(
            !segmentHits(a, b, inflate(other.label.box, 2)),
            `${e.id} intersects label ${other.id}`,
          );
    }
    const endpoint = (p: Point, id: string) => {
      const n = byId.get(id)!;
      assert.ok(
        p.x >= n.x1 - 0.1 &&
          p.x <= n.x2 + 0.1 &&
          p.y >= n.y1 - 0.1 &&
          p.y <= n.y2 + 0.1,
        "endpoint inside actual boundary range",
      );
      assert.ok(
        Math.abs(p.x - n.x1) < 0.1 ||
          Math.abs(p.x - n.x2) < 0.1 ||
          Math.abs(p.y - n.y1) < 0.1 ||
          Math.abs(p.y - n.y2) < 0.1,
        "actual boundary",
      );
    };
    endpoint(route.points[0], e.source);
    endpoint(route.points.at(-1)!, e.target);
    assert.ok(route.arrow && route.path, "arrow and path");
  }
  const segs = r.routes.flatMap((route) =>
    route.points
      .slice(1)
      .map((p, i) => ({ a: route.points[i], b: p, id: route.id })),
  );
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i],
        b = segs[j];
      if (a.id === b.id) continue;
      if (a.a.x === a.b.x && b.a.x === b.b.x && Math.abs(a.a.x - b.a.x) < 0.01)
        assert.ok(
          Math.min(Math.max(a.a.y, a.b.y), Math.max(b.a.y, b.b.y)) -
            Math.max(Math.min(a.a.y, a.b.y), Math.min(b.a.y, b.b.y)) <
            0.01,
          "no indistinguishable vertical overlap",
        );
      if (a.a.y === a.b.y && b.a.y === b.b.y && Math.abs(a.a.y - b.a.y) < 0.01)
        assert.ok(
          Math.min(Math.max(a.a.x, a.b.x), Math.max(b.a.x, b.b.x)) -
            Math.max(Math.min(a.a.x, a.b.x), Math.min(b.a.x, b.b.x)) <
            0.01,
          "no indistinguishable horizontal overlap",
        );
    }
}
const rank = fixture("ranking");
const t = topology(rank.nodes, rank.edges);
assert.equal(t.center, "hub");
assert.equal(t.ranks[0].degree, 10);
assert.equal(t.ranks[1].id, "second");
assert.equal(t.ranks[1].degree, 7);
assert.equal(t.components.length, 2);
const filtered = topology(
  rank.nodes.filter((n) => !["r0", "r1", "r2", "r3", "r4"].includes(n.id)),
  rank.edges,
);
assert.equal(filtered.center, "second");
const a = radialLayout(rank.nodes, rank.edges),
  b = radialLayout(rank.nodes, rank.edges);
assert.deepEqual(a.positions, b.positions);
assert.deepEqual(a.positions.hub, { x: 0, y: 0 });
assert.ok(
  Math.hypot(a.positions.r9.x, a.positions.r9.y) >
    Math.hypot(a.positions.second.x, a.positions.second.y),
);
const fixed = radialLayout(rank.nodes, rank.edges, "second", {
  hub: { x: 73, y: 112 },
});
assert.deepEqual(fixed.positions.hub, { x: 73, y: 112 });
assert.equal(radialLayout(rank.nodes, rank.edges, "second").center, "second");
assert.equal(
  aggregateEdges(rank.edges, true).find(
    (e) => e.source === "hub" && e.target === "second",
  )!.count,
  3,
);
assert.ok(
  aggregateEdges(rank.edges, true).some(
    (e) => e.source === "second" && e.target === "hub",
  ),
);
const results = [];
for (const kind of [
  "small-groups",
  "small-flat",
  "ranking",
  "crossing",
  "dense",
]) {
  const f = fixture(kind),
    edges = aggregateEdges(f.edges, true),
    layout = radialLayout(f.nodes, edges);
  const input = {
    nodes: geometry(
      f.nodes,
      edges,
      kind === "crossing" ? f.positions : layout.positions,
    ),
    edges,
  };
  const result = routeGraph(input);
  if (kind === "small-groups" || kind === "small-flat") {
    const extent = bounds(input.nodes);
    assert.ok(
      extent.x2 - extent.x1 < 1500 && extent.y2 - extent.y1 < 1050,
      "seven objects including an uneven server group fit a compact overview",
    );
    assert.equal(layout.center, "small0");
    assert.equal(layout.ranks[0].degree, 6);
    const pinned = radialLayout(f.nodes, edges, "", {
      small0: { x: 73, y: 112 },
    });
    assert.deepEqual(pinned.positions.small0, { x: 73, y: 112 });
  }
  const groups = input.nodes.filter((n) => n.group);
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++)
      if (groups[i].parent === groups[j].parent)
        assert.ok(
          !intersects(groups[i], groups[j]),
          "distinct group rectangles do not overlap",
        );
  verify(input, result);
  results.push({
    kind,
    objects: f.nodes.length,
    edges: edges.length,
    routed: result.routes.length,
    failed: result.failed.length,
    crossings: result.crossings,
    hiddenLabels: result.hiddenLabels,
    ms: result.elapsed,
  });
  assert.equal(result.failed.length, 0, `${kind}: every route must exist`);
}
const nested = fixture("crossing");
nested.nodes
  .filter((n) => n.entity_type === "group")
  .forEach((n) => (n.parent = n.id === "g1" ? "z1" : "z0"));
nested.nodes.push(
  { id: "z0", label: "Zóna A", entity_type: "zone" },
  { id: "z1", label: "Zóna B", entity_type: "zone" },
);
const nestedEdges = aggregateEdges(nested.edges, true),
  nestedLayout = radialLayout(nested.nodes, nestedEdges);
const nestedInput = {
  nodes: geometry(nested.nodes, nestedEdges, nestedLayout.positions),
  edges: nestedEdges,
};
const nestedResult = routeGraph(nestedInput);
verify(nestedInput, nestedResult);
assert.equal(nestedResult.failed.length, 0, "nested groups and zone headers");
results.push({
  kind: "nested zones",
  objects: nested.nodes.length,
  edges: nestedEdges.length,
  routed: nestedResult.routes.length,
  failed: nestedResult.failed.length,
  crossings: nestedResult.crossings,
  hiddenLabels: nestedResult.hiddenLabels,
  ms: nestedResult.elapsed,
});
const starNodes = Array.from({ length: 101 }, (_, i) => ({
  id: "s" + i,
  label: "Server " + i,
  entity_type: "servers",
}));
const starEdges = starNodes
  .slice(1)
  .map((n, i) => ({ id: "star" + i, source: "s0", target: n.id }));
const starLayout = radialLayout(starNodes, starEdges);
const starInput = {
  nodes: geometry(starNodes, starEdges, starLayout.positions),
  edges: starEdges,
};
const starResult = routeGraph(starInput);
verify(starInput, starResult);
assert.equal(starLayout.ranks[0].degree, 100);
assert.equal(
  starResult.failed.length,
  0,
  "100 unique neighbors have separate endpoint ports",
);
results.push({
  kind: "100-neighbor server hub",
  objects: 101,
  edges: 100,
  routed: starResult.routes.length,
  failed: starResult.failed.length,
  crossings: starResult.crossings,
  hiddenLabels: starResult.hiddenLabels,
  ms: starResult.elapsed,
});
// Impossible user-positioned overlap must fail visibly, never use a straight-line fallback.
const impossible = routeGraph({
  nodes: [
    { id: "a", x1: 0, y1: 0, x2: 100, y2: 100 },
    { id: "b", x1: 300, y1: 0, x2: 400, y2: 100 },
    { id: "wall", x1: -30, y1: -30, x2: 130, y2: 130 },
  ],
  edges: [{ id: "bad", source: "a", target: "b" }],
});
assert.deepEqual(impossible.failed, ["bad"]);
assert.equal(impossible.routes.length, 0);
console.log(JSON.stringify({ assertions: "passed", results }, null, 2));
