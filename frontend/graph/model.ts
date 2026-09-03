export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface GraphNode {
  id: string;
  label: string;
  entity_type: string;
  parent?: string;
  [key: string]: any;
}
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  count?: number;
  entity_ids?: string[];
  [key: string]: any;
}
export interface Rank {
  id: string;
  label: string;
  degree: number;
  rank: number;
  component: number;
  hops: number;
}
export interface Obstacle extends Rect {
  id: string;
  parent?: string;
  group?: boolean;
  header?: boolean;
}
export interface Route {
  id: string;
  points: Point[];
  path: string;
  arrow: string;
  label?: { text: string; box: Rect };
  color: string;
  dash: string;
  opacity: number;
  crossings: number;
  width?: number;
  directed?: boolean;
}
export interface RoutingInput {
  nodes: Obstacle[];
  edges: GraphEdge[];
}
export interface RoutingResult {
  routes: Route[];
  failed: string[];
  crossings: number;
  hiddenLabels: number;
  elapsed: number;
  bounds: Rect;
}
export const center = (r: Rect): Point => ({
  x: (r.x1 + r.x2) / 2,
  y: (r.y1 + r.y2) / 2,
});
export const inflate = (r: Rect, m: number): Rect => ({
  x1: r.x1 - m,
  y1: r.y1 - m,
  x2: r.x2 + m,
  y2: r.y2 + m,
});
export const intersects = (a: Rect, b: Rect) =>
  a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
export function segmentHits(a: Point, b: Point, r: Rect) {
  return a.x === b.x
    ? a.x > r.x1 &&
        a.x < r.x2 &&
        Math.max(a.y, b.y) > r.y1 &&
        Math.min(a.y, b.y) < r.y2
    : a.y === b.y &&
        a.y > r.y1 &&
        a.y < r.y2 &&
        Math.max(a.x, b.x) > r.x1 &&
        Math.min(a.x, b.x) < r.x2;
}
export const bounds = (rs: Rect[]): Rect =>
  rs.length
    ? {
        x1: Math.min(...rs.map((r) => r.x1)),
        y1: Math.min(...rs.map((r) => r.y1)),
        x2: Math.max(...rs.map((r) => r.x2)),
        y2: Math.max(...rs.map((r) => r.y2)),
      }
    : { x1: 0, y1: 0, x2: 1, y2: 1 };
export const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Same direction and semantics only: a reverse arrow or different rule remains a separate route.
export function aggregateEdges(
  edges: GraphEdge[],
  enabled: boolean,
): GraphEdge[] {
  if (!enabled) return edges;
  const groups = new Map<string, GraphEdge>();
  for (const e of edges) {
    const key = JSON.stringify([
      e.source,
      e.target,
      e.type,
      e.action,
      e.status,
    ]);
    const old = groups.get(key);
    if (!old)
      groups.set(key, {
        ...e,
        count: e.count || 1,
        entity_ids: [...(e.entity_ids || [])],
        members: [e],
      });
    else {
      old.count! += e.count || 1;
      old.entity_ids = [
        ...new Set([...old.entity_ids!, ...(e.entity_ids || [])]),
      ];
      old.members.push(e);
      old.label = `${old.count} kapcsolat`;
    }
  }
  return [...groups.values()];
}
