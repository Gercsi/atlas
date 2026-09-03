import {
  bounds,
  center,
  distance,
  inflate,
  intersects,
  segmentHits,
  type GraphEdge,
  type Obstacle,
  type Point,
  type Rect,
  type Route,
  type RoutingInput,
  type RoutingResult,
} from "./model";

const CLEARANCE = 12,
  LANE = 7,
  EPS = 0.01;
interface Segment extends Rect {
  a: Point;
  b: Point;
  route: number;
  index: number;
}
interface Port {
  at: Point;
  out: Point;
}
const segment = (a: Point, b: Point, route = 0, index = 0): Segment => ({
  ...bounds([
    { x1: a.x, y1: a.y, x2: a.x, y2: a.y },
    { x1: b.x, y1: b.y, x2: b.x, y2: b.y },
  ]),
  a,
  b,
  route,
  index,
});

// Spatial buckets keep hit checks local; no database work or DOM access occurs in this module.
class Spatial<T extends Rect> {
  cells = new Map<string, T[]>();
  add(r: T) {
    for (let x = Math.floor(r.x1 / 200); x <= Math.floor(r.x2 / 200); x++)
      for (let y = Math.floor(r.y1 / 200); y <= Math.floor(r.y2 / 200); y++) {
        const k = x + "," + y;
        if (!this.cells.has(k)) this.cells.set(k, []);
        this.cells.get(k)!.push(r);
      }
  }
  query(r: Rect): T[] {
    const found = new Set<T>();
    for (let x = Math.floor(r.x1 / 200); x <= Math.floor(r.x2 / 200); x++)
      for (let y = Math.floor(r.y1 / 200); y <= Math.floor(r.y2 / 200); y++)
        for (const a of this.cells.get(x + "," + y) || []) found.add(a);
    return [...found];
  }
}
class Heap {
  list: { id: number; f: number }[] = [];
  push(id: number, f: number) {
    const a = this.list;
    let i = a.length;
    a.push({ id, f });
    while (i) {
      const p = (i - 1) >> 1;
      if (a[p].f <= f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = { id, f };
  }
  pop() {
    const a = this.list,
      root = a[0],
      last = a.pop()!;
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1].f < a[c].f) c++;
        if (a[c].f >= last.f) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = last;
    }
    return root;
  }
}
const round = (v: number) => Math.round(v * 100) / 100;
function portCandidates(r: Obstacle): Port[] {
  const c = center(r),
    out: Port[] = [];
  const add = (x: number, y: number, dx: number, dy: number) =>
    out.push({
      at: { x: round(x), y: round(y) },
      out: { x: round(x + dx * 24), y: round(y + dy * 24) },
    });
  const nx = Math.max(1, Math.floor((r.x2 - r.x1 - 24) / 9)),
    ny = Math.max(1, Math.floor((r.y2 - r.y1 - 24) / 9));
  for (let i = 0; i < nx; i++) {
    const x = c.x + (i - (nx - 1) / 2) * 9;
    add(x, r.y1, 0, -1);
    add(x, r.y2, 0, 1);
  }
  for (let i = 0; i < ny; i++) {
    const y = c.y + (i - (ny - 1) / 2) * 9;
    add(r.x1, y, -1, 0);
    add(r.x2, y, 1, 0);
  }
  return out;
}
function simplify(points: Point[]) {
  const p: Point[] = [];
  for (const raw of points) {
    const point = { x: round(raw.x), y: round(raw.y) };
    if (p.length) {
      const previous = p[p.length - 1];
      // Layout calculations can leave a hundredth-pixel drift at a port. Snap
      // that drift so exported and on-screen routes remain truly orthogonal.
      if (Math.abs(previous.x - point.x) <= EPS * 2) point.x = previous.x;
      else if (Math.abs(previous.y - point.y) <= EPS * 2) point.y = previous.y;
    }
    if (p.length && distance(p[p.length - 1], point) < EPS) continue;
    while (p.length > 1) {
      const a = p[p.length - 2],
        b = p[p.length - 1];
      if ((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y))
        p.pop();
      else break;
    }
    p.push(point);
  }
  return p;
}
function crossing(a: Segment, b: Segment): Point | undefined {
  if ((a.a.x === a.b.x) === (b.a.x === b.b.x)) return;
  const v = a.a.x === a.b.x ? a : b,
    h = v === a ? b : a;
  const p = { x: v.x1, y: h.y1 };
  if (
    p.x >= h.x1 - EPS &&
    p.x <= h.x2 + EPS &&
    p.y >= v.y1 - EPS &&
    p.y <= v.y2 + EPS
  )
    return p;
}
function parallelConflict(a: Segment, b: Segment, gap = LANE) {
  if (a.a.x === a.b.x && b.a.x === b.b.x)
    return (
      Math.abs(a.x1 - b.x1) < gap - EPS &&
      Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) > EPS
    );
  if (a.a.y === a.b.y && b.a.y === b.b.y)
    return (
      Math.abs(a.y1 - b.y1) < gap - EPS &&
      Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) > EPS
    );
  return false;
}
export function routeGraph(
  input: RoutingInput,
  onProgress?: (done: number, total: number) => void,
): RoutingResult {
  if (
    input.nodes.some(
      (n) =>
        ![n.x1, n.y1, n.x2, n.y2].every(
          (v) => Number.isFinite(v) && Math.abs(v) < 1e7,
        ),
    )
  )
    throw new Error("Érvénytelen vagy túl távoli objektumpozíció.");
  const start = performance.now();
  const byId = new Map(
    input.nodes.filter((n) => !n.header).map((n) => [n.id, n]),
  );
  const obstacles = new Spatial<Obstacle>();
  for (const n of input.nodes)
    obstacles.add({
      ...inflate(n, n.header ? 5 : CLEARANCE),
      id: n.id,
      parent: n.parent,
      group: n.group,
      header: n.header,
    });
  const lanes = new Spatial<Segment>(),
    labels = new Spatial<Rect>();
  const routes: Route[] = [],
    failed: string[] = [];
  const labelObstacles: Obstacle[] = [];
  let hiddenLabels = 0;
  const ports = new Map<string, Port[]>();
  for (const n of input.nodes.filter((n) => !n.group && !n.header))
    ports.set(n.id, portCandidates(n));
  const ancestors = (id: string) => {
    const result = new Set<string>();
    let p = byId.get(id)?.parent;
    while (p && !result.has(p)) {
      result.add(p);
      p = byId.get(p)?.parent;
    }
    return result;
  };
  const sorted = [...input.edges].sort((a, b) => {
    const dist = (e: GraphEdge) =>
      byId.has(e.source) && byId.has(e.target)
        ? distance(center(byId.get(e.source)!), center(byId.get(e.target)!))
        : Infinity;
    return dist(a) - dist(b) || a.id.localeCompare(b.id);
  });
  for (const edge of sorted) {
    if ((routes.length + failed.length) % 20 === 0)
      onProgress?.(routes.length + failed.length, sorted.length);
    const src = byId.get(edge.source),
      dst = byId.get(edge.target);
    if (!src || !dst) {
      failed.push(edge.id);
      continue;
    }
    const allowed = new Set([...ancestors(src.id), ...ancestors(dst.id)]);
    let laneGap = LANE;
    const blocked = (a: Point, b: Point, stubId?: string) => {
      const box = segment(a, b);
      return (
        obstacles
          .query(box)
          .some(
            (o) =>
              !(o.group && allowed.has(o.id)) &&
              o.id !== stubId &&
              segmentHits(a, b, o),
          ) || labels.query(box).some((o) => segmentHits(a, b, o))
      );
    };
    const cost = (a: Point, b: Point) => {
      if (blocked(a, b)) return Infinity;
      const s = segment(a, b);
      let penalty = 0;
      for (const other of lanes.query(inflate(s, LANE))) {
        if (parallelConflict(s, other, laneGap)) return Infinity;
        if (crossing(s, other)) penalty += 45;
      }
      return distance(a, b) + penalty;
    };
    const pick = (id: string, target: Point, wide = false) => {
      const candidates = [...(ports.get(id) || [])]
        .sort((a, b) => distance(a.out, target) - distance(b.out, target))
        .filter(
          (p) =>
            !blocked(p.at, p.out, id) &&
            !lanes
              .query(inflate(segment(p.at, p.out), LANE))
              .some((s) => parallelConflict(segment(p.at, p.out), s, laneGap)),
        );
      if (wide) return candidates;
      const sides = new Map<string, Port[]>();
      for (const p of candidates) {
        const side = `${Math.sign(p.out.x - p.at.x)},${Math.sign(p.out.y - p.at.y)}`;
        if (!sides.has(side)) sides.set(side, []);
        sides.get(side)!.push(p);
      }
      return candidates.filter((p) =>
        [...sides.values()].some((side) => side[0] === p || side.at(-1) === p),
      );
    };
    const sp = pick(src.id, center(dst)),
      tp = pick(dst.id, center(src));
    let best: Point[] | undefined,
      bestPorts: [Port, Port] | undefined,
      bestCost = Infinity;
    for (const s of sp.slice(0, 3))
      for (const t of tp.slice(0, 3)) {
        if (src.id === dst.id && s === t) continue;
        const p = quickRoute(s.out, t.out, cost);
        if (p) {
          const value = p
            .slice(1)
            .reduce((v, b, i) => v + cost(p[i], b) + 18, 0);
          if (value < bestCost) {
            best = p;
            bestCost = value;
            bestPorts = [s, t];
          }
        }
      }
    if (!best) {
      // A* uses a rectilinear visibility grid; unrelated compound groups remain solid obstacles.
      const localObstacles = [
        ...input.nodes.filter((n) => !(n.group && allowed.has(n.id))),
        ...labelObstacles,
      ];
      for (const s of sp.slice(0, 4)) {
        for (const t of tp.slice(0, 4)) {
          const corridor = inflate(segment(s.out, t.out), 220);
          const near = localObstacles.filter((o) => intersects(o, corridor));
          const p = quickRoute(s.out, t.out, cost, near);
          if (p) {
            best = p;
            bestPorts = [s, t];
            break;
          }
        }
        if (best) break;
      }
      if (!best) {
        const found = searchMany(
          sp,
          tp,
          cost,
          src.id === dst.id,
          14,
          localObstacles,
        );
        if (found) {
          best = found.points;
          bestPorts = [found.source, found.target];
        }
      }
    }
    if (!best) {
      laneGap = 3.5;
      const found = searchMany(
        pick(src.id, center(dst), true),
        pick(dst.id, center(src), true),
        cost,
        src.id === dst.id,
        28,
        input.nodes.filter((n) => !(n.group && allowed.has(n.id))),
        true,
      );
      if (found) {
        best = found.points;
        bestPorts = [found.source, found.target];
      }
    }
    if (!best) {
      const found = searchMany(
        pick(src.id, center(dst), true),
        pick(dst.id, center(src), true),
        cost,
        src.id === dst.id,
        42,
        input.nodes.filter((n) => !(n.group && allowed.has(n.id))),
        true,
      );
      if (found) {
        best = found.points;
        bestPorts = [found.source, found.target];
      }
    }
    if (!best || !bestPorts) {
      failed.push(edge.id);
      continue;
    }
    const [s, t] = bestPorts;
    ports.set(
      src.id,
      (ports.get(src.id) || []).filter((p) => p !== s && p !== t),
    );
    ports.set(
      dst.id,
      (ports.get(dst.id) || []).filter((p) => p !== s && p !== t),
    );
    const points = simplify([s.at, ...best, t.at]);
    const color = edge.on_path
      ? "#d07819"
      : edge.action === "deny"
        ? "#bc444e"
        : edge.action === "unknown"
          ? "#a77b1c"
          : edge.type === "database"
            ? "#9270b9"
            : "#587c87";
    const route: Route = {
      id: edge.id,
      points,
      path: "",
      arrow: "",
      color,
      width: edge.on_path ? 4 : 1.8,
      directed: edge.type !== "boundary",
      dash:
        edge.action === "unknown"
          ? "2 5"
          : edge.type === "database" ||
              edge.action === "deny" ||
              ["disabled", "planned", "expired"].includes(edge.status)
            ? "7 4"
            : "",
      opacity: ["disabled", "planned", "expired"].includes(edge.status)
        ? 0.55
        : 1,
      crossings: 0,
    };
    const segments = points
      .slice(1)
      .map((p, i) => segment(points[i], p, routes.length, i));
    if ((edge.count || 1) > 1) {
      badge: for (const seg of segments)
        for (const f of [0.5, 0.3, 0.7]) {
          const text = `${edge.count}×`,
            w = text.length * 6.3 + 12,
            x = seg.a.x + (seg.b.x - seg.a.x) * f,
            y = seg.a.y + (seg.b.y - seg.a.y) * f;
          const r = { x1: x - w / 2, y1: y - 9, x2: x + w / 2, y2: y + 9 };
          if (
            distance(seg.a, { x, y }) < w / 2 + 20 ||
            distance(seg.b, { x, y }) < w / 2 + 20
          )
            continue;
          if (
            obstacles
              .query(r)
              .some(
                (o) => !(o.group && allowed.has(o.id)) && intersects(o, r),
              ) ||
            lanes
              .query(inflate(r, 5))
              .some((s) => segmentHits(s.a, s.b, inflate(r, 5))) ||
            labels
              .query(inflate(r, 5))
              .some((o) => intersects(o, inflate(r, 5))) ||
            segments.some(
              (s) => s !== seg && segmentHits(s.a, s.b, inflate(r, 5)),
            )
          )
            continue;
          route.label = { text, box: r };
          labels.add(inflate(r, 6));
          labelObstacles.push({ ...r, id: "label:" + edge.id, header: true });
          break badge;
        }
    }
    segments.forEach((s) => lanes.add(s));
    routes.push(route);
  }
  routes.forEach((route, ri) => {
    if (route.label) return;
    const edge = input.edges.find((e) => e.id === route.id)!;
    const allowed = new Set([
      ...ancestors(edge.source),
      ...ancestors(edge.target),
    ]);
    const segments = route.points
      .slice(1)
      .map((p, i) => segment(route.points[i], p, ri, i));
    const text =
      (edge.count || 1) > 1
        ? `${edge.count}× · ${edge.label || "Kapcsolat"}`
        : edge.label || "";
    if (text) {
      const options = [text.length > 28 ? text.slice(0, 27) + "…" : text];
      if ((edge.count || 1) > 1) options.push(`${edge.count}×`);
      label: for (const text of options)
        for (const seg of [...segments].sort(
          (a, b) => distance(b.a, b.b) - distance(a.a, a.b),
        ))
          for (const f of [0.5, 0.3, 0.7]) {
            const w = text.length * 6.3 + 12,
              h = 18,
              x = seg.a.x + (seg.b.x - seg.a.x) * f,
              y = seg.a.y + (seg.b.y - seg.a.y) * f;
            const r = {
              x1: x - w / 2,
              y1: y - h / 2,
              x2: x + w / 2,
              y2: y + h / 2,
            };
            if (
              distance(seg.a, { x, y }) < Math.max(w, h) / 2 + 16 ||
              distance(seg.b, { x, y }) < Math.max(w, h) / 2 + 16
            )
              continue;
            if (
              obstacles
                .query(r)
                .some(
                  (o) => !(o.group && allowed.has(o.id)) && intersects(o, r),
                ) ||
              labels
                .query(inflate(r, 5))
                .some((o) => intersects(o, inflate(r, 5))) ||
              lanes
                .query(inflate(r, 5))
                .some(
                  (s) =>
                    (s.route !== ri || s.index !== seg.index) &&
                    segmentHits(s.a, s.b, inflate(r, 5)),
                )
            )
              continue;
            if (
              segments.some(
                (s) => s !== seg && segmentHits(s.a, s.b, inflate(r, 5)),
              )
            )
              continue;
            route.label = { text, box: r };
            labels.add(inflate(r, 6));
            labelObstacles.push({ ...r, id: "label:" + edge.id, header: true });
            break label;
          }
      if (!route.label) hiddenLabels++;
    }
  });
  const crossings = decorateRoutes(routes);
  return {
    routes,
    failed,
    crossings,
    hiddenLabels,
    elapsed: Math.round(performance.now() - start),
    bounds: bounds([
      ...input.nodes,
      ...routes.flatMap((r) =>
        r.points.map((p) => ({ x1: p.x, y1: p.y, x2: p.x, y2: p.y })),
      ),
    ]),
  };
}
function quickRoute(
  s: Point,
  t: Point,
  cost: (a: Point, b: Point) => number,
  obstacles: Obstacle[] = [],
): Point[] | undefined {
  const paths: Point[][] = [
    [s, { x: t.x, y: s.y }, t],
    [s, { x: s.x, y: t.y }, t],
  ];
  for (const f of [0.5, 0.25, 0.75]) {
    const x = round(s.x + (t.x - s.x) * f),
      y = round(s.y + (t.y - s.y) * f);
    paths.push(
      [s, { x, y: s.y }, { x, y: t.y }, t],
      [s, { x: s.x, y }, { x: t.x, y }, t],
    );
  }
  const xs = new Set<number>(),
    ys = new Set<number>();
  for (const o of obstacles)
    for (const margin of [15, 29, 57, 99]) {
      xs.add(round(o.x1 - margin));
      xs.add(round(o.x2 + margin));
      ys.add(round(o.y1 - margin));
      ys.add(round(o.y2 + margin));
    }
  for (const x of xs) paths.push([s, { x, y: s.y }, { x, y: t.y }, t]);
  for (const y of ys) paths.push([s, { x: s.x, y }, { x: t.x, y }, t]);
  let best: Point[] | undefined,
    score = Infinity;
  for (const raw of paths) {
    const p = simplify(raw);
    if (p.length < 2) continue;
    const c = p.slice(1).reduce((sum, b, i) => sum + cost(p[i], b) + 18, 0);
    if (c < score) {
      best = p;
      score = c;
    }
  }
  return best;
}
function searchMany(
  sources: Port[],
  targets: Port[],
  cost: (a: Point, b: Point) => number,
  selfLoop: boolean,
  grid = 14,
  obstacles: Obstacle[] = [],
  wide = false,
): { points: Point[]; source: Port; target: Port } | undefined {
  if (!sources.length || !targets.length) return;
  const endpoints = [...sources, ...targets].map((p) => p.out);
  let window = inflate(
    bounds(endpoints.map((p) => ({ x1: p.x, y1: p.y, x2: p.x, y2: p.y }))),
    250,
  );
  window = inflate(
    bounds([
      window,
      ...obstacles.filter((o) => o.group && intersects(o, window)),
    ]),
    grid === 42 ? 600 : wide ? 180 : 40,
  );
  const xs = new Set(endpoints.map((p) => p.x)),
    ys = new Set(endpoints.map((p) => p.y));
  for (
    let x = Math.floor(window.x1 / grid) * grid + (wide ? grid / 4 : 0);
    x <= window.x2;
    x += grid
  )
    xs.add(x);
  for (
    let y = Math.floor(window.y1 / grid) * grid + (wide ? grid / 4 : 0);
    y <= window.y2;
    y += grid
  )
    ys.add(y);
  const x = [...xs].sort((a, b) => a - b),
    y = [...ys].sort((a, b) => a - b),
    w = x.length;
  const cell = (p: Point) => y.indexOf(p.y) * w + x.indexOf(p.x);
  const goal = new Map(targets.map((p) => [cell(p.out), p]));
  const heap = new Heap(),
    scores = new Map<number, number>(),
    prev = new Map<number, number>(),
    starts = new Map<number, Port>(),
    closed = new Set<number>();
  const point = (id: number) => ({ x: x[id % w], y: y[Math.floor(id / w)] });
  const heuristic = (p: Point) =>
    Math.min(...targets.map((t) => distance(p, t.out)));
  for (const source of sources)
    for (const dir of [0, 1]) {
      const id = cell(source.out) * 2 + dir;
      scores.set(id, 0);
      starts.set(id, source);
      heap.push(id, heuristic(source.out));
    }
  let visits = 0;
  while (heap.list.length && visits++ < (grid === 7 ? 48000 : 24000)) {
    const { id } = heap.pop();
    if (closed.has(id)) continue;
    closed.add(id);
    const atCell = Math.floor(id / 2),
      dir = id % 2,
      p = point(atCell);
    const target = goal.get(atCell);
    if (target) {
      const path: Point[] = [];
      let at: number | undefined = id,
        last = id;
      while (at !== undefined) {
        last = at;
        path.push(point(Math.floor(at / 2)));
        at = prev.get(at);
      }
      const source = starts.get(last)!;
      if (source && (!selfLoop || source !== target) && path.length > 1)
        return { points: simplify(path.reverse()), source, target };
    }
    const col = atCell % w,
      row = Math.floor(atCell / w);
    for (const [next, d] of [
      [col > 0 ? atCell - 1 : -1, 0],
      [col < w - 1 ? atCell + 1 : -1, 0],
      [row > 0 ? atCell - w : -1, 1],
      [row < y.length - 1 ? atCell + w : -1, 1],
    ]) {
      if (next < 0) continue;
      const nid = next * 2 + d;
      if (closed.has(nid)) continue;
      const q = point(next),
        step = cost(p, q);
      if (!Number.isFinite(step)) continue;
      const value = scores.get(id)! + step + (dir !== d ? 24 : 0);
      if (value < (scores.get(nid) ?? Infinity)) {
        scores.set(nid, value);
        prev.set(nid, id);
        heap.push(nid, value + heuristic(q) * 1.8);
      }
    }
  }
}

// Genuine transparent gaps, not white paint: also correct on transparent PNGs and group fills.
export function decorateRoutes(routes: Route[]) {
  const index = new Spatial<Segment>(),
    cuts = new Map<string, Point[]>(),
    seen = new Set<string>();
  let total = 0;
  routes.forEach((r, ri) =>
    r.points.slice(1).forEach((p, si) => {
      const s = segment(r.points[si], p, ri, si);
      for (const other of index.query(inflate(s, 0.1))) {
        if (other.route === ri) continue;
        const cross = crossing(s, other);
        if (!cross) continue;
        const key = [other.route, ri, cross.x, cross.y].join("/");
        if (!seen.has(key)) {
          seen.add(key);
          total++;
          r.crossings++;
          routes[other.route].crossings++;
        }
        // The later route passes over; cut all incident segments of the earlier route at bends too.
        const ck = other.route + ":" + other.index;
        if (!cuts.has(ck)) cuts.set(ck, []);
        cuts.get(ck)!.push(cross);
      }
      index.add(s);
    }),
  );
  routes.forEach((r, ri) => {
    const d: string[] = [];
    r.points.slice(1).forEach((p, i) => {
      const a = r.points[i],
        len = distance(a, p),
        dx = (p.x - a.x) / len,
        dy = (p.y - a.y) / len;
      const intervals = (cuts.get(ri + ":" + i) || [])
        .map((c) => [
          Math.max(0, distance(a, c) - 5),
          Math.min(len, distance(a, c) + 5),
        ])
        .sort((a, b) => a[0] - b[0]);
      const line = (from: number, to: number) => {
        if (to - from > EPS)
          d.push(
            `M${round(a.x + dx * from)},${round(a.y + dy * from)}L${round(a.x + dx * to)},${round(a.y + dy * to)}`,
          );
      };
      let at = 0;
      for (const [lo, hi] of intervals) {
        line(at, lo);
        at = Math.max(at, hi);
      }
      line(at, len);
    });
    r.path = d.join("");
    if (r.directed !== false) {
      const tip = r.points.at(-1)!,
        pre = r.points.at(-2)!,
        len = distance(tip, pre),
        dx = (tip.x - pre.x) / len,
        dy = (tip.y - pre.y) / len;
      r.arrow = `${tip.x},${tip.y} ${round(tip.x - dx * 10 + dy * 4)},${round(tip.y - dy * 10 - dx * 4)} ${round(tip.x - dx * 10 - dy * 4)},${round(tip.y - dy * 10 + dx * 4)}`;
    }
  });
  return total;
}
