import {
  bounds,
  center,
  inflate,
  intersects,
  type GraphNode,
  type GraphEdge,
  type Point,
  type Rank,
  type Rect,
} from "./model";

export function topology(
  nodes: GraphNode[],
  edges: GraphEdge[],
  preferred = "",
) {
  const parents = new Set(nodes.map((n) => n.parent).filter(Boolean));
  const leaves = nodes.filter((n) => !parents.has(n.id));
  const neighbors = new Map(leaves.map((n) => [n.id, new Set<string>()]));
  for (const e of edges)
    if (
      e.source !== e.target &&
      neighbors.has(e.source) &&
      neighbors.has(e.target)
    ) {
      neighbors.get(e.source)!.add(e.target);
      neighbors.get(e.target)!.add(e.source);
    }
  const candidates = leaves.filter((n) =>
    ["servers", "applications", "collapsed"].includes(n.entity_type),
  );
  const ordered = [...(candidates.length ? candidates : leaves)].sort(
    (a, b) =>
      neighbors.get(b.id)!.size - neighbors.get(a.id)!.size ||
      a.id.localeCompare(b.id),
  );
  const chosen = ordered.find((n) => n.id === preferred) || ordered[0];
  const ranks: Rank[] = ordered.map((n, i) => ({
    id: n.id,
    label: n.label,
    degree: neighbors.get(n.id)!.size,
    rank: i + 1,
    component: -1,
    hops: -1,
  }));
  const byRank = new Map(ranks.map((r) => [r.id, r]));
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const root of [chosen, ...ordered, ...leaves].filter(
    Boolean,
  ) as GraphNode[]) {
    if (visited.has(root.id)) continue;
    const queue = [root.id];
    visited.add(root.id);
    const levels = new Map([[root.id, 0]]);
    for (let at = 0; at < queue.length; at++)
      for (const n of neighbors.get(queue[at]) || [])
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
          levels.set(n, levels.get(queue[at])! + 1);
        }
    for (const id of queue) {
      const r = byRank.get(id);
      if (r) {
        r.component = components.length;
        r.hops = levels.get(id)!;
      }
    }
    components.push(queue);
  }
  return { ranks, center: chosen?.id || "", neighbors, components };
}

interface Block {
  id: string;
  rect: Rect;
  positions: Record<string, Point>;
  members: Set<string>;
}
export function radialLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  preferred = "",
  fixed: Record<string, Point> = {},
) {
  const t = topology(nodes, edges, preferred);
  const compact = t.neighbors.size <= 30 && nodes.some((n) => n.parent);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const p = n.parent || "";
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(n);
  }
  const rank = (id: string) => t.ranks.find((r) => r.id === id)?.rank ?? 100000;
  const build = (n: GraphNode): Block => {
    const kids = children.get(n.id);
    if (!kids?.length) {
      const size = nodeSize(n, edges);
      return {
        id: n.id,
        rect: {
          x1: -size.w / 2,
          y1: -size.h / 2,
          x2: size.w / 2,
          y2: size.h / 2,
        },
        positions: { [n.id]: { x: 0, y: 0 } },
        members: new Set([n.id]),
      };
    }
    const placed = pack(kids.map(build), true);
    const c = center(placed.rect);
    for (const p of Object.values(placed.positions)) {
      p.x -= c.x;
      p.y -= c.y;
    }
    const r = inflate(placed.rect, compact ? 36 : 50);
    return {
      id: n.id,
      rect: { x1: r.x1 - c.x, y1: r.y1 - c.y, x2: r.x2 - c.x, y2: r.y2 - c.y },
      positions: placed.positions,
      members: new Set(Object.keys(placed.positions)),
    };
  };
  const pack = (blocks: Block[], nested = false) => {
    const owner = new Map<string, string>();
    blocks.forEach((b) => b.members.forEach((id) => owner.set(id, b.id)));
    const adj = new Map(blocks.map((b) => [b.id, new Set<string>()]));
    for (const e of edges) {
      const s = owner.get(e.source),
        d = owner.get(e.target);
      if (s && d && s !== d) {
        adj.get(s)!.add(d);
        adj.get(d)!.add(s);
      }
    }
    const priority = (b: Block) => Math.min(...[...b.members].map(rank));
    const sorted = [...blocks].sort(
      (a, b) =>
        Number(b.members.has(t.center)) - Number(a.members.has(t.center)) ||
        priority(a) - priority(b) ||
        a.id.localeCompare(b.id),
    );
    // Unconnected applications sharing a server still belong to one physical
    // container. Pack them locally instead of treating each as a distant island.
    if (
      compact &&
      nested &&
      blocks.length > 1 &&
      blocks.every((b) => b.members.size === 1 && !adj.get(b.id)!.size)
    ) {
      const columns = Math.ceil(Math.sqrt(blocks.length));
      const cellW = Math.max(...blocks.map((b) => b.rect.x2 - b.rect.x1)) + 52;
      const cellH = Math.max(...blocks.map((b) => b.rect.y2 - b.rect.y1)) + 52;
      const positions: Record<string, Point> = {};
      const rects = sorted.map((b, i) => {
        const x = (i % columns) * cellW,
          y = Math.floor(i / columns) * cellH;
        for (const [id, p] of Object.entries(b.positions))
          positions[id] = { x: p.x + x, y: p.y + y };
        return {
          x1: b.rect.x1 + x,
          y1: b.rect.y1 + y,
          x2: b.rect.x2 + x,
          y2: b.rect.y2 + y,
        };
      });
      return { positions, rect: bounds(rects) };
    }
    const todo = new Set(blocks.map((b) => b.id));
    const allRects: Rect[] = [];
    const positions: Record<string, Point> = {};
    for (const root of sorted) {
      if (!todo.delete(root.id)) continue;
      const levels = new Map([[root.id, 0]]),
        queue = [root.id];
      for (let at = 0; at < queue.length; at++)
        for (const n of adj.get(queue[at])!)
          if (todo.delete(n)) {
            queue.push(n);
            levels.set(n, levels.get(queue[at])! + 1);
          }
      const component = sorted.filter((b) => levels.has(b.id));
      const size =
        Math.max(
          ...component.map((b) =>
            Math.hypot(b.rect.x2 - b.rect.x1, b.rect.y2 - b.rect.y1),
          ),
        ) + 100;
      const coords = new Map<string, Point>([[root.id, { x: 0, y: 0 }]]);
      const rings = Math.max(...levels.values());
      let radius = 0;
      for (let hop = 1; hop <= rings; hop++) {
        const ring = component.filter((b) => levels.get(b.id) === hop);
        // Keep the second hub next to the first, and each BFS ring outside the previous ring.
        const previousRadius = radius;
        radius = compact
          ? previousRadius + 120
          : Math.max(radius + size, (ring.length * size) / (2 * Math.PI));
        ring.sort((a, b) => {
          const angle = (b: Block) => {
            const p = [...adj.get(b.id)!]
              .map((id) => coords.get(id))
              .filter(Boolean) as Point[];
            return p.length
              ? Math.atan2(
                  p.reduce((s, c) => s + c.y, 0),
                  p.reduce((s, c) => s + c.x, 0),
                )
              : 0;
          };
          return angle(a) - angle(b) || priority(a) - priority(b);
        });
        // Small compound graphs need space for actual rectangles, not the largest
        // group diagonal multiplied at every nesting level.
        if (compact) {
          const rectAt = (b: Block) => {
            const p = coords.get(b.id)!;
            return {
              x1: b.rect.x1 + p.x,
              y1: b.rect.y1 + p.y,
              x2: b.rect.x2 + p.x,
              y2: b.rect.y2 + p.y,
            };
          };
          const placed = component.filter((b) => coords.has(b.id));
          ring.forEach((b, i) => {
            let distance = previousRadius + 120;
            const angle = (2 * Math.PI * i) / ring.length;
            const place = () =>
              coords.set(b.id, {
                x: distance * Math.cos(angle),
                y: distance * Math.sin(angle),
              });
            place();
            while (
              placed.some((other) =>
                intersects(inflate(rectAt(b), nested ? 44 : 76), rectAt(other)),
              )
            ) {
              distance += 12;
              place();
            }
            radius = Math.max(radius, distance);
            placed.push(b);
          });
        } else {
          ring.forEach((b, i) =>
            coords.set(b.id, {
              x: radius * Math.cos((2 * Math.PI * i) / ring.length),
              y: radius * Math.sin((2 * Math.PI * i) / ring.length),
            }),
          );
        }
      }
      const localRects = component.map((b) => {
        const p = coords.get(b.id)!;
        return {
          x1: b.rect.x1 + p.x,
          y1: b.rect.y1 + p.y,
          x2: b.rect.x2 + p.x,
          y2: b.rect.y2 + p.y,
        };
      });
      const bb = bounds(localRects);
      const shift = compact
        ? compactOffset(bb, allRects, nested ? 44 : 100)
        : componentsOffset(bb, allRects);
      component.forEach((b, i) => {
        const p = coords.get(b.id)!;
        for (const [id, c] of Object.entries(b.positions))
          positions[id] = { x: c.x + p.x + shift.x, y: c.y + p.y + shift.y };
        const r = localRects[i];
        allRects.push({
          x1: r.x1 + shift.x,
          y1: r.y1 + shift.y,
          x2: r.x2 + shift.x,
          y2: r.y2 + shift.y,
        });
      });
    }
    return { positions, rect: bounds(allRects) };
  };
  const result = pack((children.get("") || []).map(build));
  // Fixed leaves are hard constraints. Move their whole top-level block by a common delta first.
  const top = (id: string): string => {
    const n = byId.get(id);
    return n?.parent ? top(n.parent) : id;
  };
  const moved = new Set<string>();
  for (const [id, p] of Object.entries(fixed))
    if (result.positions[id] && !moved.has(top(id))) {
      const old = result.positions[id],
        dx = p.x - old.x,
        dy = p.y - old.y;
      for (const [n, q] of Object.entries(result.positions))
        if (top(n) === top(id))
          result.positions[n] = { x: q.x + dx, y: q.y + dy };
      moved.add(top(id));
    }
  Object.entries(fixed).forEach(([id, p]) => {
    if (result.positions[id]) result.positions[id] = { ...p };
  });
  // Preserve anchored blocks; displace only movable blocks when anchors consume their space.
  const rootBlocks = (children.get("") || []).map((n) => ({
    id: n.id,
    ids: Object.keys(result.positions).filter((id) => top(id) === n.id),
  }));
  const rectOf = (ids: string[]) =>
    inflate(
      bounds(
        ids.map((id) => {
          const p = result.positions[id],
            s = nodeSize(byId.get(id)!, edges);
          return {
            x1: p.x - s.w / 2,
            y1: p.y - s.h / 2,
            x2: p.x + s.w / 2,
            y2: p.y + s.h / 2,
          };
        }),
      ),
      60,
    );
  const occupied: Rect[] = rootBlocks
    .filter((b) => moved.has(b.id))
    .map((b) => rectOf(b.ids));
  for (const b of rootBlocks.filter(
    (b) => Object.keys(fixed).length && !moved.has(b.id),
  )) {
    const original = rectOf(b.ids);
    let r = original;
    let step = 0;
    while (occupied.some((o) => intersects(o, r)) && step < 400) {
      step++;
      const a = step * 2.4,
        rad = 100 * Math.sqrt(step);
      const dx = Math.cos(a) * rad,
        dy = Math.sin(a) * rad;
      r = {
        x1: original.x1 + dx,
        y1: original.y1 + dy,
        x2: original.x2 + dx,
        y2: original.y2 + dy,
      };
    }
    for (const id of b.ids) {
      result.positions[id].x += r.x1 - original.x1;
      result.positions[id].y += r.y1 - original.y1;
    }
    occupied.push(r);
  }
  // For a compound graph the winning object, rather than its bounding box, defines the origin.
  const c = { ...(result.positions[t.center] || { x: 0, y: 0 }) };
  if (!Object.keys(fixed).length)
    for (const p of Object.values(result.positions)) {
      p.x -= c.x;
      p.y -= c.y;
    }
  return {
    positions: result.positions,
    ranks: t.ranks,
    center: t.center,
    components: t.components.length,
  };
}
function compactOffset(bb: Rect, occupied: Rect[], gap: number): Point {
  if (!occupied.length) return { x: 0, y: 0 };
  const w = bb.x2 - bb.x1,
    h = bb.y2 - bb.y1;
  const candidates: Point[] = [];
  for (const o of occupied) {
    for (const x of [o.x1, o.x2 - w, (o.x1 + o.x2 - w) / 2])
      for (const y of [o.y1 - gap - h, o.y2 + gap]) candidates.push({ x, y });
    for (const y of [o.y1, o.y2 - h, (o.y1 + o.y2 - h) / 2])
      for (const x of [o.x1 - gap - w, o.x2 + gap]) candidates.push({ x, y });
  }
  const ranked = candidates
    .map((p) => {
      const r = { x1: p.x, y1: p.y, x2: p.x + w, y2: p.y + h };
      const b = bounds([...occupied, r]);
      const width = b.x2 - b.x1,
        height = b.y2 - b.y1;
      return {
        p,
        r,
        score: width * height + 0.25 * Math.max(width, height) ** 2,
      };
    })
    .filter(
      ({ r }) => !occupied.some((o) => intersects(inflate(o, gap - 1), r)),
    )
    .sort((a, b) => a.score - b.score);
  const best = ranked[0];
  return best
    ? { x: best.p.x - bb.x1, y: best.p.y - bb.y1 }
    : componentsOffset(bb, occupied);
}
function componentsOffset(bb: Rect, occupied: Rect[]): Point {
  if (!occupied.length) return { x: 0, y: 0 };
  const step = Math.max(bb.x2 - bb.x1, bb.y2 - bb.y1) / 2 + 100;
  for (let i = 1; i < 10000; i++) {
    const a = i * 2.399963,
      rad = step * Math.sqrt(i),
      x = Math.cos(a) * rad - (bb.x1 + bb.x2) / 2,
      y = Math.sin(a) * rad - (bb.y1 + bb.y2) / 2;
    const r = { x1: bb.x1 + x, y1: bb.y1 + y, x2: bb.x2 + x, y2: bb.y2 + y };
    if (!occupied.some((o) => intersects(inflate(o, 70), r))) return { x, y };
  }
  return { x: Math.max(...occupied.map((o) => o.x2)) + 200 - bb.x1, y: 0 };
}
export function nodeSize(n: GraphNode, edges: GraphEdge[]) {
  const incident = edges.reduce(
    (count, e) => count + Number(e.source === n.id) + Number(e.target === n.id),
    0,
  );
  const extra = Math.max(0, incident - 30);
  return {
    w: 156 + Math.ceil(extra / 3) * 9,
    h: (n.entity_type === "databases" ? 90 : 72) + Math.ceil(extra / 6) * 9,
  };
}
