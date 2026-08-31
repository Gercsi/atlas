import type { GraphNode, GraphEdge, Point } from "./model";
export function fixture(kind = "dense", stress = false) {
  const nodes: GraphNode[] = [],
    edges: GraphEdge[] = [],
    positions: Record<string, Point> = {};
  const add = (id: string, parent?: string, type = "applications") =>
    nodes.push({
      id,
      parent,
      entity_type: type,
      label:
        (
          {
            hub: "Központ · 10 szomszéd",
            second: "Második · 7 szomszéd",
          } as Record<string, string>
        )[id] || `Rendszer ${id}`,
    });
  const edge = (
    source: string,
    target: string,
    label = "REST API",
    extra = {},
  ) =>
    edges.push({
      id: "e" + edges.length,
      source,
      target,
      label,
      type: "integration",
      count: 1,
      entity_ids: ["test-" + edges.length],
      ...extra,
    });
  if (kind === "single") {
    nodes.push({ id: "single-group", label: "DEMO-SRV", entity_type: "group" });
    add("single", "single-group");
    nodes[nodes.length - 1].label = "Árvíztűrő <minta> & API";
  } else if (kind === "ranking") {
    add("hub");
    add("second");
    for (let i = 0; i < 15; i++) add("r" + i);
    add("island1");
    add("island2");
    edge("hub", "second");
    for (let i = 0; i < 9; i++) edge("hub", "r" + i);
    for (let i = 9; i < 15; i++) edge("second", "r" + i);
    edge("hub", "second");
    edge("hub", "second");
    edge("second", "hub");
    edge("island1", "island2");
  } else if (kind === "small-groups" || kind === "small-flat") {
    const names = [
      "Rendelési portál",
      "Raktári rendszer",
      "Számlázás",
      "Ügyfélkapcsolat",
      "Dokumentumtár",
      "Partnerkapu",
      "Értesítések",
    ];
    if (kind === "small-groups")
      for (let i = 0; i < 5; i++)
        nodes.push({
          id: "g" + i,
          label: i === 4 ? "Nincs szerverhez rendelve" : "DEMO-SRV-0" + i,
          entity_type: "group",
        });
    names.forEach((label, i) => {
      add(
        "small" + i,
        kind === "small-groups" ? "g" + Math.min(i, 4) : undefined,
      );
      nodes[nodes.length - 1].label = label;
      if (i) edge("small" + i, "small0", i === 2 ? "REST API" : "SOAP API");
    });
  } else if (kind === "crossing") {
    for (let i = 0; i < 3; i++)
      nodes.push({
        id: "g" + i,
        label: "Szervercsoport " + i,
        entity_type: "group",
      });
    add("a", "g0");
    add("b", "g0");
    add("c", "g1");
    add("d", "g1");
    add("db", "g2", "databases");
    add("app", "g2");
    Object.assign(positions, {
      a: { x: 0, y: 0 },
      b: { x: 0, y: 260 },
      c: { x: 800, y: 0 },
      d: { x: 800, y: 260 },
      db: { x: 400, y: 0 },
      app: { x: 400, y: 260 },
    });
    edge("a", "d");
    edge("b", "c");
    edge("a", "d");
    edge("d", "a");
    edge("a", "db", "Adatbázis", { type: "database" });
    edge("app", "c");
    edge("db", "b");
    edge("a", "a", "Önhivatkozás");
  } else {
    for (let g = 0; g < 20; g++)
      nodes.push({
        id: "g" + g,
        label: "Szervercsoport " + g,
        entity_type: "group",
      });
    for (let i = 0; i < 200; i++)
      add(
        "n" + i,
        "g" + Math.floor(i / 10),
        i % 5 === 0 ? "databases" : "applications",
      );
    // Connected and disconnected subnetworks, unequal hubs, reverse and parallel integrations.
    for (let i = 0; i < (stress ? 2000 : 500); i++) {
      const block = i % 5,
        base = block * 40,
        source = base + (i % 7 === 0 ? 1 : i % 40),
        target = base + ((i * 13 + 7 + Math.floor(i / 40)) % 40);
      edge("n" + source, "n" + target, i % 3 ? "REST API" : "SOAP API");
    }
  }
  return { nodes, edges, positions };
}
