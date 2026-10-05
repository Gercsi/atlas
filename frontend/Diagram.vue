<script setup lang="ts">
import {
  ref,
  shallowRef,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import cytoscape from "cytoscape";
import {
  vectorScene,
  vectorDocument,
  vectorPdf,
  exportFonts,
} from "./graph/vector";
import { api, labels } from "./api";
import Lookup from "./Lookup.vue";
import {
  radialLayout,
  topology,
  nodeSize,
  type LayoutStrategy,
} from "./graph/layout";
import {
  aggregateEdges,
  inflate,
  bounds,
  type GraphEdge,
  type GraphNode,
  type RoutingResult,
  type RoutingInput,
} from "./graph/model";
import { routeSvg, svgDocument } from "./graph/render";
import { routeGraph } from "./graph/router";
import { fixture } from "./graph/fixtures";
import {
  Maximize,
  Expand,
  Minimize,
  Download,
  Save,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Layers,
  Search,
} from "lucide-vue-next";
const props = defineProps<{ caps: string[]; zones: any[]; proof?: boolean }>();
const emit = defineEmits(["open"]);
const exporting = ref(false);
const svgPreview = ref("");
const canvas = ref<HTMLDivElement>();
const diagramRoot = ref<HTMLDivElement>();
const fullscreen = ref(false);
const fullscreenButton = ref<HTMLButtonElement>();
let nativeFullscreen = false;
let previousOverflow = "";
function leaveFullscreen() {
  fullscreen.value = false;
  nativeFullscreen = false;
  document.body.style.overflow = previousOverflow;
  nextTick(() => {
    cy?.resize();
    syncRoutes();
    fullscreenButton.value?.focus();
  });
}
async function toggleFullscreen() {
  if (fullscreen.value) {
    if (document.fullscreenElement === diagramRoot.value)
      await document.exitFullscreen();
    leaveFullscreen();
    return;
  }
  previousOverflow = document.body.style.overflow;
  fullscreen.value = true;
  document.body.style.overflow = "hidden";
  try {
    if (diagramRoot.value?.requestFullscreen) {
      await diagramRoot.value.requestFullscreen();
      nativeFullscreen = true;
    }
  } catch {
    /* Embedded browsers may disallow native fullscreen; CSS fills the app instead. */
  }
  await nextTick();
  cy?.resize();
  fitGraph();
  syncRoutes();
  fullscreenButton.value?.focus();
}
function fullscreenChanged() {
  if (nativeFullscreen && document.fullscreenElement !== diagramRoot.value)
    leaveFullscreen();
}
function fullscreenKey(event: KeyboardEvent) {
  if (!fullscreen.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    void toggleFullscreen();
  } else if (event.key === "Tab") {
    const items = [
      ...(diagramRoot.value?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, summary, a[href], [tabindex="0"]',
      ) || []),
    ].filter((el) => el.getClientRects().length > 0);
    const next = event.shiftKey ? items[items.length - 1] : items[0];
    if (
      document.activeElement ===
        (event.shiftKey ? items[0] : items[items.length - 1]) ||
      !diagramRoot.value?.contains(document.activeElement)
    ) {
      event.preventDefault();
      next?.focus();
    }
  }
}
async function openRecord(type: string, id: string) {
  if (fullscreen.value) await toggleFullscreen();
  emit("open", type, id);
}
const config = ref<any>({
  view: "infrastructure",
  environment: "",
  server_ids: [],
  mode: "selected",
  hops: 1,
  groups: true,
  aggregate: true,
  isolated: true,
  databases: true,
  integrations: true,
  include_unknown: true,
  path_from: "",
  path_to: "",
});
const chosen = ref<any>(null),
  meta = ref<any>({}),
  error = ref(""),
  busy = ref(false),
  views = ref<any[]>([]),
  viewName = ref("Saját infrastruktúra"),
  selectedView = ref(""),
  selectedServer = ref(""),
  find = ref(""),
  scope = ref("full"),
  scale = ref(2),
  paper = ref("a3"),
  collapsed = ref<string[]>([]),
  exportBg = ref("white"),
  positions = ref<any>({}),
  graphRows = ref<any[]>([]);
let cy: cytoscape.Core | undefined;
let fullElements: any[] = [];
let resize: ResizeObserver | undefined;
const routeLayer = ref<SVGSVGElement>();
const routeResult = shallowRef<RoutingResult>();
const routing = ref(false),
  pinned = ref<string[]>([]),
  centerOverride = ref("");
const routeProgress = ref("");
const ranking = ref<ReturnType<typeof topology>["ranks"]>([]),
  actualCenter = ref("");
const dragging = ref(false),
  moving = ref(false),
  routeTexture = ref(""),
  textureReady = ref(false);
const textureImage = ref<HTMLImageElement>();
let motionTimer: ReturnType<typeof setTimeout> | undefined;
let textureScale = 1;
async function makeRouteTexture() {
  textureReady.value = false;
  moving.value = false;
  const r = routeResult.value,
    version = routeVersion;
  if (!r) return;
  const b = r.bounds,
    w = b.x2 - b.x1,
    h = b.y2 - b.y1;
  const rasterScale = Math.min(1, 2400 / Math.max(1, w), 2400 / Math.max(1, h));
  const svgUrl = URL.createObjectURL(
    new Blob([svgDocument(r.routes, b, w * rasterScale, h * rasterScale)], {
      type: "image/svg+xml",
    }),
  );
  try {
    const image = new Image();
    image.src = svgUrl;
    await image.decode();
    const raster = document.createElement("canvas");
    raster.width = Math.ceil(w * rasterScale);
    raster.height = Math.ceil(h * rasterScale);
    raster
      .getContext("2d")!
      .drawImage(image, 0, 0, raster.width, raster.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      raster.toBlob(resolve, "image/png"),
    );
    if (!blob || version !== routeVersion) return;
    if (routeTexture.value) URL.revokeObjectURL(routeTexture.value);
    textureScale = rasterScale;
    routeTexture.value = URL.createObjectURL(blob);
    await nextTick();
    syncRoutes();
  } catch {
    /* Keep the precise SVG if a browser cannot prepare a pan texture. */
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
const routeMarkup = computed(() =>
  routeSvg(
    routeResult.value?.routes || [],
    chosen.value?.source ? chosen.value.id : "",
  ),
);
let routeWorker: Worker | undefined,
  routeVersion = 0,
  finishRoute: (() => void) | undefined;
let visibleNodes: GraphNode[] = [],
  visibleEdges: GraphEdge[] = [];
const layoutRevision = ref(0);
const layoutModes: { id: LayoutStrategy; label: string }[] = [
  { id: "radial", label: "Kompakt pókháló" },
  { id: "layered", label: "Kapcsolati rétegek" },
  { id: "compact", label: "Tömör kapcsolati térkép" },
];
const layoutModeIndex = ref(0);
const activeLayout = computed(() => layoutModes[layoutModeIndex.value]);
const nextLayout = computed(
  () => layoutModes[(layoutModeIndex.value + 1) % layoutModes.length],
);
function cycleLayout() {
  layoutModeIndex.value = (layoutModeIndex.value + 1) % layoutModes.length;
}
const fixtureKind = ref("ranking");
function syncRoutes() {
  if (cy) {
    const p = cy.pan();
    if (!moving.value)
      routeLayer.value
        ?.querySelector("g")
        ?.setAttribute(
          "transform",
          `translate(${p.x},${p.y}) scale(${cy.zoom()})`,
        );
    const b = routeResult.value?.bounds;
    if (b && textureImage.value)
      Object.assign(textureImage.value.style, {
        width: `${(b.x2 - b.x1) * textureScale}px`,
        height: `${(b.y2 - b.y1) * textureScale}px`,
        transform: `translate(${p.x + b.x1 * cy.zoom()}px,${p.y + b.y1 * cy.zoom()}px) scale(${cy.zoom() / textureScale})`,
      });
  }
}
function viewportMotion() {
  syncRoutes();
  updateMini();
  if (textureReady.value) {
    moving.value = true;
    clearTimeout(motionTimer);
    motionTimer = setTimeout(() => {
      moving.value = false;
      syncRoutes();
    }, 160);
  }
}
function graphBounds() {
  if (!cy) return { x1: 0, y1: 0, x2: 1, y2: 1, w: 1, h: 1 };
  const b = bounds([
    cy.nodes().boundingBox({ includeOverlays: false }),
    ...(routeResult.value ? [routeResult.value.bounds] : []),
  ]);
  return { ...b, w: b.x2 - b.x1, h: b.y2 - b.y1 };
}
function fitGraph() {
  if (cy) {
    const b = graphBounds(),
      zoom = Math.min(
        3,
        Math.max(
          0.015,
          Math.min((cy.width() - 80) / b.w, (cy.height() - 80) / b.h),
        ),
      );
    cy.viewport({
      zoom,
      pan: {
        x: cy.width() / 2 - ((b.x1 + b.x2) * zoom) / 2,
        y: cy.height() / 2 - ((b.y1 + b.y2) * zoom) / 2,
      },
    });
  }
}
function routeSelect(event: MouseEvent) {
  const g = (event.target as Element).closest("[data-route]");
  if (g) {
    event.stopPropagation();
    chosen.value = visibleEdges.find(
      (e) => e.id === g.getAttribute("data-route"),
    );
  }
}
function routeTitle(event: MouseEvent) {
  const g = (event.target as Element).closest("[data-route]");
  const e = visibleEdges.find((e) => e.id === g?.getAttribute("data-route"));
  if (e && g) {
    const title = g.querySelector("title");
    if (title)
      title.textContent = `${e.label || "Kapcsolat"} · ${e.count || 1} kapcsolat · ${visibleNodes.find((n) => n.id === e.source)?.label} → ${visibleNodes.find((n) => n.id === e.target)?.label}`;
  }
}
function routeInput(): RoutingInput {
  const nodes: RoutingInput["nodes"] = [];
  cy?.nodes().forEach((n) => {
    const b = n.boundingBox({
      includeLabels: false,
      includeOverlays: false,
      includeUnderlays: false,
    });
    nodes.push({
      id: n.id(),
      parent: n.data("parent"),
      group: n.isParent(),
      x1: b.x1,
      y1: b.y1,
      x2: b.x2,
      y2: b.y2,
    });
    {
      const labeled = n.boundingBox({
        includeNodes: false,
        includeEdges: false,
        includeLabels: true,
        includeOverlays: false,
        includeUnderlays: false,
      });
      // Protect actual multiline labels, including any text extending beyond a leaf body.
      if (
        [labeled.x1, labeled.y1, labeled.x2, labeled.y2].every(
          Number.isFinite,
        ) &&
        labeled.x2 > labeled.x1 &&
        labeled.y2 > labeled.y1
      )
        nodes.push({
          id: (n.isParent() ? "header:" : "label:") + n.id(),
          header: true,
          x1: labeled.x1,
          y1: labeled.y1 - 3,
          x2: labeled.x2,
          y2: labeled.y2 + 3,
        });
    }
  });
  return { nodes, edges: JSON.parse(JSON.stringify(visibleEdges)) };
}
async function reroute(fit = false) {
  routeWorker?.terminate();
  finishRoute?.();
  const version = ++routeVersion;
  routing.value = true;
  routeResult.value = undefined;
  routeProgress.value = "";
  if (!cy) return;
  const input = routeInput();
  await new Promise<void>((resolve) => {
    finishRoute = resolve;
    let settled = false;
    const complete = (result?: RoutingResult, message = "") => {
      if (settled) return;
      settled = true;
      if (version === routeVersion) {
        if (result) {
          routeResult.value = result;
          void makeRouteTexture();
        } else {
          error.value = message || "Az útvonalvezetés nem indult el.";
        }
        routing.value = false;
        routeWorker?.terminate();
        routeWorker = undefined;
        finishRoute = undefined;
        syncRoutes();
        updateMini();
        // A diagram akkor is maradjon látható, ha a kapcsolati worker
        // szerveroldali MIME- vagy biztonsági szabály miatt nem indul el.
        if (fit) fitGraph();
      }
      resolve();
    };
    const compatibleRoute = () => {
      routeWorker?.terminate();
      routeWorker = undefined;
      routeProgress.value = "Kompatibilis számítás…";
      // Yield once so Vue can paint the status before the synchronous fallback.
      setTimeout(() => {
        if (version !== routeVersion) return complete();
        try {
          complete(
            routeGraph(input, (done, total) => {
              routeProgress.value = `${done} / ${total}`;
            }),
          );
        } catch (cause) {
          complete(
            undefined,
            "Az útvonalvezetés nem indult el. " +
              (cause instanceof Error ? cause.message : String(cause)),
          );
        }
      }, 0);
    };
    try {
      routeWorker = new Worker(
        new URL("./graph/router.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      compatibleRoute();
      return;
    }
    routeWorker.onmessage = (event) => {
      if (event.data.version !== routeVersion) return;
      if (event.data.progress) {
        routeProgress.value = `${event.data.progress.done} / ${event.data.progress.total}`;
        return;
      }
      if (event.data.error)
        complete(undefined, "Útvonalvezetési hiba: " + event.data.error);
      else complete(event.data.result);
    };
    routeWorker.onerror = (event) => {
      event.preventDefault();
      compatibleRoute();
    };
    routeWorker.postMessage({ version, input });
  });
}
async function automatic(cycle = true) {
  if (cycle) cycleLayout();
  capture();
  arrange(false);
  capture();
  await reroute(true);
}
async function centerOn(id: string) {
  const direct = ranking.value.find((r) => r.id === id);
  if (!direct) {
    const byId = new Map(
      fullElements
        .filter((e) => !e.data.source)
        .map((e) => [e.data.id, e.data]),
    );
    const belongsTo = (candidate: string) => {
      let at = byId.get(candidate);
      while (at?.parent) {
        if (at.parent === id) return true;
        at = byId.get(at.parent);
      }
      return false;
    };
    id = ranking.value.find((r) => belongsTo(r.id))?.id || id;
  }
  centerOverride.value = id;
  await automatic(false);
}
function pinChosen() {
  if (!chosen.value) return;
  const selected = cy?.getElementById(chosen.value.id);
  const ids =
    selected?.length && selected.isParent()
      ? selected.descendants(":childless").map((n: any) => n.id())
      : [chosen.value.id];
  const release =
    ids.length > 0 && ids.every((id: string) => pinned.value.includes(id));
  pinned.value = release
    ? pinned.value.filter((id) => !ids.includes(id))
    : [...new Set([...pinned.value, ...ids])];
  capture();
}
function chosenPinned() {
  if (!chosen.value) return false;
  const selected = cy?.getElementById(chosen.value.id);
  const ids =
    selected?.length && selected.isParent()
      ? selected.descendants(":childless").map((n: any) => n.id())
      : [chosen.value.id];
  return ids.length > 0 && ids.every((id: string) => pinned.value.includes(id));
}
function selectRank(id: string) {
  const n = cy?.getElementById(id);
  if (n?.length) {
    chosen.value = n.data();
    cy?.center(n);
  }
}
function viewState() {
  return {
    schema_version: 3,
    filters: config.value,
    positions: positions.value,
    collapsed: collapsed.value,
    pinned: pinned.value,
    center: centerOverride.value,
    layout: activeLayout.value.id,
  };
}

const dbSvg =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><path d="M2 15 C2 -2 158 -2 158 15 L158 72 C158 92 2 92 2 72 Z" fill="#f5edff" stroke="#a78bce" stroke-width="2"/><ellipse cx="80" cy="15" rx="78" ry="13" fill="#eee1ff" stroke="#a78bce" stroke-width="2"/></svg>',
  );
const measurements = ref<any>(null),
  measuring = ref(false),
  stress = ref(false),
  exportPreview = ref(""),
  pdfPreview = ref(""),
  pdfMode = ref("fit");
const minimap = ref<HTMLCanvasElement>();
let miniFrame = 0;
function paintMinimap() {
  if (!cy || !minimap.value) return;
  const ctx = minimap.value.getContext("2d")!;
  const bb = graphBounds();
  const s = Math.min(170 / Math.max(1, bb.w), 100 / Math.max(1, bb.h));
  ctx.clearRect(0, 0, 180, 110);
  ctx.fillStyle = "#f5f8f6";
  ctx.fillRect(0, 0, 180, 110);
  cy.nodes(":childless").forEach((n) => {
    const p = n.position();
    ctx.fillStyle =
      n.data("entity_type") === "databases" ? "#a58bc4" : "#709a88";
    ctx.fillRect(
      5 + (p.x - bb.x1) * s,
      5 + (p.y - bb.y1) * s,
      Math.max(2, 140 * s),
      Math.max(2, 50 * s),
    );
  });
  const e = cy.extent();
  ctx.strokeStyle = "#176958";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(
    5 + (e.x1 - bb.x1) * s,
    5 + (e.y1 - bb.y1) * s,
    e.w * s,
    e.h * s,
  );
}
function updateMini() {
  if (miniFrame) return;
  miniFrame = requestAnimationFrame(() => {
    miniFrame = 0;
    paintMinimap();
  });
}
function miniFocus(e: MouseEvent) {
  if (!cy) return;
  const bb = graphBounds(),
    s = Math.min(170 / Math.max(1, bb.w), 100 / Math.max(1, bb.h));
  cy.pan({
    x: cy.width() / 2 - ((e.offsetX - 5) / s + bb.x1) * cy.zoom(),
    y: cy.height() / 2 - ((e.offsetY - 5) / s + bb.y1) * cy.zoom(),
  });
}
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
async function measurePerformance(redraw = true) {
  measuring.value = true;
  measurements.value = null;
  const times: number[] = [];
  const runs = redraw ? (fixtureKind.value === "dense" ? 3 : 20) : 0;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await benchmark();
    await frame();
    await frame();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const durations: number[] = [];
  let last = performance.now(),
    start = last;
  const original = cy!.zoom();
  while (performance.now() - start < 10000) {
    cy!.panBy({ x: Math.sin((performance.now() - start) / 350) * 2, y: 1 });
    cy!.zoom(
      original * (1 + 0.025 * Math.sin((performance.now() - start) / 200)),
    );
    await frame();
    const now = performance.now();
    durations.push(now - last);
    last = now;
  }
  durations.sort((a, b) => a - b);
  measurements.value = {
    runs,
    nodes: meta.value.counts?.nodes,
    edges: graphRows.value.length,
    routed: routeResult.value?.routes.length,
    failed: routeResult.value?.failed.length,
    draw_p95_ms: runs ? Math.round(times[Math.ceil(runs * 0.95) - 1]) : null,
    frame_median_ms:
      Math.round(durations[Math.floor(durations.length / 2)] * 10) / 10,
    fps_median: Math.round(1000 / durations[Math.floor(durations.length / 2)]),
    frames_over_200ms: durations.filter((n) => n > 200).length,
    viewport: { width: innerWidth, height: innerHeight },
    user_agent: navigator.userAgent,
  };
  measuring.value = false;
  fitGraph();
}
function elements(g: any) {
  return [
    ...g.nodes.map((n: any) => ({
      data: { ...n, parent: n.parent || undefined },
    })),
    ...g.edges.map((e: any) => ({ data: e })),
  ];
}
async function draw(elementsIn: any[], saved: any = {}) {
  if (!canvas.value) return;
  routeWorker?.terminate();
  finishRoute?.();
  routeVersion++;
  routeResult.value = undefined;
  cy?.destroy();
  visibleNodes = elementsIn.filter((e) => !e.data.source).map((e) => e.data);
  visibleEdges = aggregateEdges(
    elementsIn.filter((e) => e.data.source).map((e) => e.data),
    config.value.aggregate,
  );
  graphRows.value = visibleEdges;
  const sizes = new Map(
    visibleNodes.map((n) => [n.id, nodeSize(n, visibleEdges)]),
  );
  cy = cytoscape({
    container: canvas.value,
    // Cytoscape mutates its data objects; keep display ranks out of the source graph and saved labels.
    elements: visibleNodes.map((data) => ({ data: { ...data } })),
    textureOnViewport: true,
    hideEdgesOnViewport: true,
    pixelRatio: 1,
    style: [
      {
        selector: "node",
        style: {
          "background-color": "#e7f2f0",
          "border-color": "#aaccc5",
          "border-width": 1.5,
          label: "data(label)",
          color: "#24443f",
          "font-family": "Arial",
          "font-size": 11,
          "text-wrap": "wrap",
          "text-max-width": "140px",
          "text-valign": "center",
          width: (n: any) => sizes.get(n.id())?.w || 156,
          height: (n: any) => sizes.get(n.id())?.h || 72,
          shape: "round-rectangle",
        },
      },
      {
        selector: 'node[entity_type="servers"]',
        style: {
          "background-color": "#e8eff8",
          "border-color": "#9fb6d1",
          color: "#314a69",
          shape: "rectangle",
        },
      },
      {
        selector: 'node[entity_type="server_group"]',
        style: {
          "background-color": "#e8eff8",
          "border-color": "#7899b7",
          color: "#294c69",
          shape: "rectangle",
          "border-width": 2,
        },
      },
      {
        selector: 'node[entity_type="location_gateway"]',
        style: {
          "background-color": "#dce9ef",
          "border-color": "#47778d",
          shape: "diamond",
          width: 92,
          height: 62,
          "font-size": 9,
          "text-max-width": "76px",
        },
      },
      {
        selector: 'node[entity_type="databases"]',
        style: {
          "background-image": dbSvg,
          "background-fit": "contain",
          "background-opacity": 0,
          "border-width": 0,
          height: (n: any) => sizes.get(n.id())?.h || 90,
        },
      },
      {
        selector: ":parent",
        style: {
          "background-color": "#f1f4f5",
          "background-opacity": 0.6,
          "border-color": "#cbd5da",
          "border-style": "dashed",
          "border-width": 1,
          "text-valign": "top",
          "text-halign": "center",
          "text-margin-x": 0,
          "text-margin-y": 8,
          "font-weight": "bold",
          padding: "26px",
          shape: "round-rectangle",
          "font-size": 12,
        },
      },
      {
        selector: 'node[entity_type="zone"]',
        style: {
          "background-color": "#f2f4f9",
          "background-opacity": 0.6,
          padding: "40px",
          "border-color": "#9ca8bd",
        },
      },
      {
        selector: 'node[entity_type="server_group"]:parent',
        style: {
          "background-color": "#eef4f8",
          "background-opacity": 0.72,
          "border-color": "#7899b7",
          "border-width": 2,
          "border-style": "solid",
          color: "#294c69",
        },
      },
      {
        selector: 'node[entity_type="location_group"]:parent',
        style: {
          "background-color": "#eef7f3",
          "background-opacity": 0.55,
          "border-color": "#5f9988",
          "border-width": 2,
          "border-style": "solid",
          padding: "48px",
          "font-size": 14,
        },
      },
      {
        selector: 'node[entity_type="location_group"][scope="external"]:parent',
        style: {
          "background-color": "#f8f0ff",
          "border-color": "#9b6fc0",
          "border-style": "dashed",
          color: "#694383",
        },
      },
      {
        selector: 'node[entity_type="location_group"][scope="unknown"]:parent',
        style: {
          "background-color": "#fff8e8",
          "border-color": "#c39332",
          "border-style": "dashed",
          color: "#745719",
        },
      },
      {
        selector: "edge",
        style: {
          width: 1.7,
          "line-color": "#8397a0",
          "target-arrow-color": "#8397a0",
          "target-arrow-shape": "triangle",
          "curve-style": "bezier",
          label: "data(label)",
          "font-size": 9,
          "text-background-color": "#ffffff",
          "text-background-opacity": 0.9,
          "text-background-padding": "3px",
          "text-rotation": "autorotate",
          color: "#526971",
        },
      },
      {
        selector: 'edge[type="database"]',
        style: {
          "line-style": "dashed",
          "line-color": "#a78bce",
          "target-arrow-color": "#a78bce",
        },
      },
      {
        selector: 'edge[action="deny"]',
        style: {
          "line-color": "#ce5e60",
          "target-arrow-color": "#ce5e60",
          "line-style": "dashed",
        },
      },
      {
        selector: 'edge[action="unknown"]',
        style: { "line-style": "dotted", "line-color": "#bf982e" },
      },
      {
        selector:
          'edge[status="disabled"],edge[status="planned"],edge[status="expired"]',
        style: { opacity: 0.45, "line-style": "dashed" },
      },
      {
        selector: "edge[?on_path]",
        style: {
          width: 4,
          "line-color": "#d07819",
          "target-arrow-color": "#d07819",
        },
      },
      {
        selector: 'node[path_state="path"],node[path_state="endpoint"]',
        style: { "border-color": "#d07819", "border-width": 4 },
      },
      {
        selector: ":selected",
        style: {
          "border-color": "#167565",
          "border-width": 3,
          "line-color": "#167565",
          "target-arrow-color": "#167565",
        },
      },
      { selector: ".faded", style: { opacity: 0.15 } },
      { selector: "edge", style: { display: "none" } },
      {
        selector: "node[?is_center]",
        style: { "border-color": "#197561", "border-width": 3 },
      },
    ],
    layout: { name: "preset" },
    minZoom: 0.015,
    maxZoom: 3,
    wheelSensitivity: 0.2,
  });
  arrange(true, saved);
  cy.on("pan zoom", viewportMotion);
  cy.on("resize dragfree", () => {
    syncRoutes();
    updateMini();
  });
  cy.on("tap", "node", (evt) => {
    chosen.value = evt.target.data();
  });
  cy.on("tap", (evt) => {
    if (evt.target === cy) chosen.value = null;
  });
  cy.on("drag", "node", () => {
    dragging.value = true;
  });
  // A click has grab/free events too, but no dragfree. Hide routes only while
  // coordinates really change and always release the transient state on free.
  cy.on("free", "node", () => {
    dragging.value = false;
    syncRoutes();
  });
  cy.on("dragfree", "node", async (evt) => {
    dragging.value = false;
    const n = evt.target;
    const ids = n.isParent()
      ? n.descendants(":childless").map((d: any) => d.id())
      : [n.id()];
    pinned.value = [...new Set([...pinned.value, ...ids])];
    capture();
    await reroute();
  });
  await reroute(true);
}
function arrange(restore = false, saved: any = {}) {
  if (!cy) return;
  const fixed = Object.fromEntries(
    pinned.value
      .filter(
        (id) => positions.value[id] && visibleNodes.some((n) => n.id === id),
      )
      .map((id) => [id, positions.value[id]]),
  );
  const result = radialLayout(
    visibleNodes,
    visibleEdges,
    centerOverride.value,
    fixed,
    activeLayout.value.id,
  );
  ranking.value = result.ranks;
  actualCenter.value = result.center;
  cy.batch(() => {
    cy?.nodes(":childless").forEach((n) => {
      n.position(
        restore && saved[n.id()]
          ? saved[n.id()]
          : result.positions[n.id()] || { x: 0, y: 0 },
      );
      n.data("label", n.data("base_label") || n.data("label"));
      n.data("base_label", n.data("label"));
      n.data("is_center", n.id() === result.center);
    });
  });
  layoutRevision.value++;
  capture();
}

function capture() {
  cy?.nodes().forEach((n) => {
    if (!n.isParent()) positions.value[n.id()] = { ...n.position() };
  });
}
async function collapse(id: string) {
  capture();
  collapsed.value = collapsed.value.includes(id)
    ? collapsed.value.filter((x) => x !== id)
    : [...collapsed.value, id];
  await applyCollapse();
}
async function applyCollapse(preserve = true) {
  const byId = new Map(
    fullElements.filter((e) => !e.data.source).map((e) => [e.data.id, e.data]),
  );
  const root = (id: string): string => {
    let at = byId.get(id),
      result = id;
    while (at?.parent) {
      if (collapsed.value.includes(at.parent)) result = at.parent;
      at = byId.get(at.parent);
    }
    return result;
  };
  const els = fullElements
    .filter((e) => e.data.source || root(e.data.id) === e.data.id)
    .map((e) => {
      const d = { ...e.data };
      if (d.source) {
        d.source = root(d.source);
        d.target = root(d.target);
      }
      if (collapsed.value.includes(d.id)) {
        d.label += " · összecsukva";
        d.entity_type = "collapsed";
      }
      return { data: d };
    })
    .filter(
      (e) =>
        !e.data.source ||
        e.data.source !== e.data.target ||
        !["group", "server_group", "location_group"].includes(
          byId.get(e.data.source)?.entity_type,
        ),
    );
  await draw(els, preserve ? positions.value : {});
}
async function load(restoreLayout = false, cycle = true) {
  if (props.proof) {
    await benchmark();
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    if (cycle) cycleLayout();
    const g = await api("graphs/query", "POST", config.value);
    meta.value = g.meta;
    fullElements = elements(g);
    graphRows.value = g.edges;
    await nextTick();
    chosen.value = null;
    await applyCollapse(restoreLayout);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function save() {
  capture();
  try {
    const r = await api("diagram-views", "POST", {
      name: viewName.value,
      visibility: "private",
      config: viewState(),
    });
    selectedView.value = r.id;
    views.value = (await api("diagram-views")).data;
    error.value = "Nézet elmentve.";
  } catch (e: any) {
    error.value = e.message;
  }
}
async function restore() {
  const v = views.value.find((v) => v.id === selectedView.value);
  if (!v) return;
  config.value = v.config.filters;
  positions.value = v.config.positions || {};
  collapsed.value = v.config.collapsed || [];
  pinned.value = v.config.pinned || Object.keys(v.config.positions || {});
  centerOverride.value = v.config.center || "";
  const restoredLayout = layoutModes.findIndex(
    (mode) => mode.id === v.config.layout,
  );
  layoutModeIndex.value = restoredLayout >= 0 ? restoredLayout : 0;
  viewName.value = v.name;
  await load(true, false);
}
function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}
async function exportImage(format: string) {
  if (!cy || exporting.value) return;
  exporting.value = true;
  try {
    capture();
    if (routing.value || dragging.value || !routeResult.value)
      throw new Error("Várd meg az útvonalvezetés végét.");
    const exportGraph = routeResult.value;
    const full = scope.value === "full",
      background = exportBg.value,
      pdfPaper = paper.value,
      pdfLayout = pdfMode.value,
      environment = config.value.environment;
    const selectedEdge = chosen.value?.source ? chosen.value.id : "";
    if (format === "svg" || format === "pdf") {
      const box = full ? inflate(graphBounds(), 20) : cy.extent();
      const scene = vectorScene(cy, exportGraph, selectedEdge);
      const footer = [
        "Atlas CMDB · " + new Date().toLocaleDateString("hu-HU"),
        "Alkalmazás · Szerver · Adatbázis (henger) · Nyíl = irány · Vonalszakadás = keresztezés",
        `${exportGraph.routes.length} útvonal · ${exportGraph.failed.length} nincs útvonal · ${environment || "Minden környezet"} · Nyilvántartás, nem élő mérés.`,
      ];
      if (format === "svg") {
        const svg = vectorDocument(scene, box, {
          background,
          fonts: await exportFonts(),
          footer,
        });
        if (svgPreview.value) URL.revokeObjectURL(svgPreview.value);
        svgPreview.value = URL.createObjectURL(
          new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
        );
        download(svgPreview.value, "CMDB-diagram.svg");
      } else {
        const blob = await vectorPdf(scene, box, {
          paper: pdfPaper as "a3" | "a4",
          mode: pdfLayout,
          footer,
        });
        if (pdfPreview.value) URL.revokeObjectURL(pdfPreview.value);
        pdfPreview.value = URL.createObjectURL(blob);
        download(pdfPreview.value, "CMDB-diagram.pdf");
      }
      return;
    }

    const nodeBox = full ? cy.elements().boundingBox() : cy.extent();
    const box = full ? inflate(graphBounds(), 20) : cy.extent();
    const w = box.x2 - box.x1,
      h = box.y2 - box.y1;
    const safeScale = Math.min(
      scale.value * (scope.value === "viewport" ? cy.zoom() : 1),
      4000 / Math.max(1, w),
      3800 / Math.max(1, h),
    );
    // Align the two rasters without subpixel resampling of node text.
    box.x1 =
      nodeBox.x1 - Math.ceil((nodeBox.x1 - box.x1) * safeScale) / safeScale;
    box.y1 =
      nodeBox.y1 - Math.ceil((nodeBox.y1 - box.y1) * safeScale) / safeScale;
    const plot = document.createElement("canvas");
    plot.width = Math.ceil((box.x2 - box.x1) * safeScale);
    plot.height = Math.ceil((box.y2 - box.y1) * safeScale);
    const plotContext = plot.getContext("2d")!;
    if (background === "white" || format === "pdf") {
      plotContext.fillStyle = "#fff";
      plotContext.fillRect(0, 0, plot.width, plot.height);
    }
    // The public PNG renderer draws full-detail nodes, bypassing viewport texture caches.
    const nodesImage = new Image();
    nodesImage.src = cy.png({
      output: "base64uri",
      full,
      scale: full ? safeScale : safeScale / cy.zoom(),
      maxWidth: 4096,
      maxHeight: 4096,
    });
    const overlay = new Image();
    const exportBox = {
      ...box,
      x2: box.x1 + plot.width / safeScale,
      y2: box.y1 + plot.height / safeScale,
    };
    const overlayUrl = URL.createObjectURL(
      new Blob(
        [
          svgDocument(
            exportGraph.routes,
            exportBox,
            plot.width,
            plot.height,
            selectedEdge,
          ),
        ],
        { type: "image/svg+xml" },
      ),
    );
    try {
      overlay.src = overlayUrl;
      await Promise.all([nodesImage.decode(), overlay.decode()]);
      plotContext.drawImage(
        nodesImage,
        Math.round((nodeBox.x1 - box.x1) * safeScale),
        Math.round((nodeBox.y1 - box.y1) * safeScale),
      );
      plotContext.drawImage(overlay, 0, 0);
    } finally {
      URL.revokeObjectURL(overlayUrl);
    }
    const im = plot;
    const out = document.createElement("canvas");
    out.width = im.width;
    const legendScale = Math.max(1, im.width / 1500);
    const measure = document.createElement("canvas").getContext("2d")!;
    const captions = [
      "Atlas CMDB · " + new Date().toLocaleDateString("hu-HU"),
      "Alkalmazás • Szerver • Adatbázis (henger) → Irányított kapcsolat · Vonalszakadás = keresztezés",
      `${exportGraph.routes.length} útvonal; ${exportGraph.failed.length} nem megjeleníthető kapcsolat. Nyilvántartás, nem élő mérés. ${environment || "Minden környezet"}`,
    ];
    const rows: { text: string; font: string }[] = [];
    captions.forEach((caption, index) => {
      const font = index ? "14px Arial" : "bold 18px Arial";
      measure.font = font;
      let line = "";
      for (const word of caption.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (
          line &&
          measure.measureText(next).width > out.width / legendScale - 40
        ) {
          rows.push({ text: line, font });
          line = word;
        } else line = next;
      }
      rows.push({ text: line, font });
    });
    out.height = im.height + Math.ceil((30 + rows.length * 24) * legendScale);
    const ctx = out.getContext("2d")!;
    if (background === "white") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.drawImage(im, 0, 0);
    ctx.save();
    ctx.translate(0, im.height);
    ctx.scale(legendScale, legendScale);
    ctx.fillStyle = "#24443f";
    rows.forEach((row, i) => {
      ctx.font = row.font;
      ctx.fillText(row.text, 20, 30 + i * 24);
    });
    ctx.restore();
    const url = out.toDataURL("image/png");
    if (exportPreview.value) URL.revokeObjectURL(exportPreview.value);
    exportPreview.value = URL.createObjectURL(
      await new Promise<Blob>((r) => out.toBlob((b) => r(b!), "image/png")),
    );
    download(url, "CMDB-diagram.png");
  } catch (e: any) {
    error.value = "Az export nem sikerült. " + e.message;
  } finally {
    exporting.value = false;
  }
}
function exportJson() {
  capture();
  download(
    "data:application/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(viewState(), null, 2)),
    "CMDB-nezet.json",
  );
}
function focus() {
  const n = cy
    ?.nodes()
    .filter((n) =>
      String(n.data("label")).toLowerCase().includes(find.value.toLowerCase()),
    );
  if (n?.length) {
    cy?.fit(n, 100);
    n.select();
    chosen.value = n.first().data();
  }
}
async function benchmark() {
  const f = fixture(fixtureKind.value, stress.value);
  positions.value = {};
  pinned.value = [];
  collapsed.value = [];
  centerOverride.value = "";
  chosen.value = null;
  const start = performance.now();
  fullElements = [...f.nodes, ...f.edges].map((data) => ({ data }));
  await draw(fullElements, f.positions);
  meta.value = {
    counts: {
      nodes: f.nodes.filter(
        (n) =>
          !["group", "zone", "location_group", "location_gateway"].includes(
            n.entity_type,
          ),
      ).length,
      edges: f.edges.length,
    },
    warnings: [
      "Szintetikus próba · elrendezés és útvonalvezetés: " +
        Math.round(performance.now() - start) +
        " ms",
    ],
    unprojected: [],
  };
}
onMounted(async () => {
  document.addEventListener("fullscreenchange", fullscreenChanged);
  document.addEventListener("keydown", fullscreenKey);
  await load(false, false);
  if (!props.proof) views.value = (await api("diagram-views")).data;
  resize = new ResizeObserver(() => cy?.resize());
  if (canvas.value) resize.observe(canvas.value);
});
onBeforeUnmount(() => {
  document.removeEventListener("fullscreenchange", fullscreenChanged);
  document.removeEventListener("keydown", fullscreenKey);
  if (fullscreen.value) {
    document.body.style.overflow = previousOverflow;
    if (document.fullscreenElement === diagramRoot.value)
      void document.exitFullscreen();
  }
  clearTimeout(motionTimer);
  if (routeTexture.value) URL.revokeObjectURL(routeTexture.value);
  cancelAnimationFrame(miniFrame);
  resize?.disconnect();
  routeWorker?.terminate();
  finishRoute?.();
  routeVersion++;
  cy?.destroy();
  cy = undefined;
  if (pdfPreview.value) URL.revokeObjectURL(pdfPreview.value);
  if (exportPreview.value) URL.revokeObjectURL(exportPreview.value);
  if (svgPreview.value) URL.revokeObjectURL(svgPreview.value);
});
</script>
<template>
  <div
    ref="diagramRoot"
    class="diagram-layout"
    :class="{ 'diagram-fullscreen': fullscreen }"
  >
    <aside v-if="!props.proof" class="graph-settings">
      <div class="eyebrow">MEGJELENÍTÉS</div>
      <label
        >Nézet<select v-model="config.view">
          <option value="infrastructure">Infrastruktúra</option>
          <option value="applications">Alkalmazásintegrációk</option>
          <option value="servers">Szerverkapcsolatok</option>
          <option value="network">Hálózati szabályok</option>
          <option value="datacenters">Adatközpontok és külső hosztolás</option>
        </select></label
      ><label
        >Környezet<select v-model="config.environment">
          <option value="">Minden környezet</option>
          <option
            v-for="e in ['PROD', 'PREPROD', 'UAT', 'TEST', 'DEV', 'UNKNOWN']"
          >
            {{ e }}
          </option>
        </select></label
      ><template v-if="config.view === 'datacenters'">
        <label
          >Hálózati útvonal innen<select v-model="config.path_from">
            <option value="">Nincs kiválasztva</option>
            <option
              v-for="location in meta.locations || []"
              :value="location.key"
            >
              {{ location.label }}
            </option>
          </select></label
        ><label
          >Hálózati útvonal ide<select v-model="config.path_to">
            <option value="">Nincs kiválasztva</option>
            <option
              v-for="location in meta.locations || []"
              :value="location.key"
            >
              {{ location.label }}
            </option>
          </select></label
        >
        <p class="muted">
          Az első frissítés feltölti a helylistát. Két hely kiválasztása után a
          következő frissítés kiemeli a dokumentált, akár több lépéses
          útvonalat.
        </p>
      </template>
      <label
        >Kiinduló szerverek<Lookup
          type="servers"
          v-model="selectedServer"
        /><button
          class="text-button"
          :disabled="!selectedServer"
          @click="
            config.server_ids.includes(selectedServer) ||
              config.server_ids.push(selectedServer);
            selectedServer = '';
          "
        >
          + Hozzáadás
        </button></label
      >
      <div v-for="id in config.server_ids" class="chip">
        {{ id.slice(-7)
        }}<button
          @click="
            config.server_ids = config.server_ids.filter(
              (x: string) => x !== id,
            )
          "
        >
          ×
        </button>
      </div>
      <label
        >Részhalmaz<select v-model="config.mode">
          <option value="selected">Csak kijelöltek</option>
          <option value="neighbors">Kijelöltek és szomszédaik</option>
        </select></label
      ><label v-if="config.mode === 'neighbors'"
        >Lépések<select v-model="config.hops">
          <option :value="1">1 lépés</option>
          <option :value="2">2 lépés</option>
        </select></label
      >
      <div class="divider"></div>
      <label v-if="config.view === 'infrastructure'" class="check"
        ><input type="checkbox" v-model="config.groups" />Szerverkeretek</label
      ><label class="check"
        ><input
          type="checkbox"
          v-model="config.databases"
        />Adatbázisréteg</label
      ><label class="check"
        ><input
          type="checkbox"
          v-model="config.integrations"
        />Integrációk</label
      ><label class="check"
        ><input type="checkbox" v-model="config.aggregate" />Párhuzamos élek
        összevonása</label
      ><label class="check"
        ><input type="checkbox" v-model="config.isolated" />Kapcsolat nélküli
        objektumok</label
      ><button class="primary full" @click="load()" :disabled="busy">
        <RefreshCw :size="15" />Nézet frissítése
      </button>
      <div class="divider"></div>
      <label
        >Mentett nézet<select v-model="selectedView" @change="restore">
          <option value="">Válassz nézetet…</option>
          <option v-for="v in views" :value="v.id">{{ v.name }}</option>
        </select></label
      ><input v-model="viewName" aria-label="Nézet neve" /><button
        @click="save"
      >
        <Save :size="14" />Nézet mentése</button
      ><button class="text-button" @click="exportJson">JSON letöltése</button>
    </aside>
    <div class="graph-main">
      <div class="graph-toolbar">
        <div class="inline">
          <span class="live-dot"></span
          ><strong>{{ meta.counts?.nodes || 0 }}</strong> objektum
          <span class="muted">/</span
          ><strong>{{ meta.counts?.edges || 0 }}</strong> kapcsolat
        </div>
        <div class="inline">
          <input
            v-model="find"
            placeholder="Objektum keresése…"
            @keyup.enter="focus"
            aria-label="Diagram keresése"
          /><button @click="focus" title="Keresés"><Search :size="16" /></button
          ><button @click="fitGraph" title="Teljes ábra illesztése">
            <Maximize :size="16" /></button
          ><button
            ref="fullscreenButton"
            @click="toggleFullscreen"
            :title="
              fullscreen ? 'Kilépés a teljes képernyőből' : 'Teljes képernyő'
            "
            :aria-pressed="fullscreen"
          >
            <Minimize v-if="fullscreen" :size="16" /><Expand
              v-else
              :size="16"
            /></button
          ><button @click="cy?.zoom((cy?.zoom() || 1) * 1.2)" title="Nagyítás">
            <ZoomIn :size="16" /></button
          ><button
            @click="cy?.zoom((cy?.zoom() || 1) / 1.2)"
            title="Kicsinyítés"
          >
            <ZoomOut :size="16" />
          </button>
        </div>
      </div>
      <div v-if="error" role="alert" class="notice">{{ error }}</div>
      <div v-for="w in meta.warnings" class="notice">{{ w }}</div>
      <div v-if="meta.location_path?.length" class="notice location-path">
        Dokumentált hálózati útvonal:
        <strong>{{ meta.location_path.join(" → ") }}</strong>
      </div>
      <div v-if="meta.unprojected?.length" class="notice">
        {{ meta.unprojected.length }} integráció nem vetíthető szerverre:
        {{ meta.unprojected.join(", ") }}
      </div>
      <div class="layout-toolbar">
        <button @click="automatic()" :disabled="routing">
          <RefreshCw :size="14" />Automatikus elrendezés · következő:
          {{ nextLayout.label }}
        </button>
        <button
          v-if="centerOverride"
          @click="
            centerOverride = '';
            automatic(false);
          "
          :disabled="routing"
        >
          Automatikus központ
        </button>
        <strong class="layout-mode"
          >Elrendezés: {{ activeLayout.label }}</strong
        >
        <span>{{ pinned.length }} rögzített pozíció</span>
        <button v-if="pinned.length" @click="pinned = []">
          Rögzítések feloldása
        </button>
        <span role="status">{{
          routing
            ? `Akadálykerülő útvonalak számítása… ${routeProgress}`
            : `${routeResult?.routes.length || 0} útvonal · ${routeResult?.crossings || 0} jelölt kereszteződés`
        }}</span>
      </div>
      <details class="rank-list">
        <summary>
          Kapcsolati rangsor · Központ:
          {{ ranking.find((r) => r.id === actualCenter)?.label || "—" }}
        </summary>
        <p>
          A látható gráf egyedi közvetlen szomszédai; az irány és a párhuzamos
          integrációk nem többszöröznek.
        </p>
        <div v-for="r in ranking" :key="r.id">
          <button @click="selectRank(r.id)">
            {{ r.rank }}. {{ r.label }} · {{ r.degree }} szomszéd ·
            {{ r.hops }} lépés</button
          ><button @click="centerOn(r.id)" :disabled="routing">
            Középpontba helyezés
          </button>
        </div>
      </details>
      <div v-if="routeResult?.failed.length" role="alert" class="notice">
        {{ routeResult.failed.length }} kapcsolathoz nem találtunk elkülönülő,
        akadálymentes útvonalat. Ezeket nem rajzoljuk az objektumokon át. Az
        alábbi kapcsolati listában „Nincs útvonal” jelzi őket; mozgasd szét az
        érintett objektumokat, vagy oldd fel a rögzítéseket, és rendezd újra.
      </div>
      <div v-if="routeResult?.hiddenLabels" class="notice">
        {{ routeResult.hiddenLabels }} élcímke csak a tooltipben és a kapcsolati
        listában fér el átfedés nélkül.
      </div>
      <div class="graph-stage">
        <div
          ref="canvas"
          class="graph-canvas"
          aria-label="Interaktív infrastruktúradiagram"
        ></div>
        <svg
          ref="routeLayer"
          class="route-layer"
          :class="{ dragging, moving }"
          aria-label="Akadálykerülő kapcsolati útvonalak"
          @click="routeSelect"
          @mouseover="routeTitle"
        >
          <g v-html="routeMarkup"></g>
        </svg>
        <img
          ref="textureImage"
          v-if="routeTexture"
          v-show="moving && !dragging && !routing"
          :src="routeTexture"
          @load="
            textureReady = true;
            syncRoutes();
          "
          class="route-texture"
          alt=""
          aria-hidden="true"
        />
        <canvas
          ref="minimap"
          width="180"
          height="110"
          class="minimap"
          role="button"
          tabindex="0"
          aria-label="Diagram minitérkép, kattints a fókuszhoz"
          @click="miniFocus"
          @keydown.enter="fitGraph"
        ></canvas>
      </div>
      <div class="graph-legend">
        <span><i class="legend-app"></i>Alkalmazás</span
        ><span><i class="legend-server"></i>Szerver</span
        ><span><i class="legend-db"></i>Adatbázis</span
        ><span v-if="config.view === 'datacenters'"
          ><i class="legend-datacenter"></i>Belső adatközpont</span
        ><span v-if="config.view === 'datacenters'"
          ><i class="legend-external"></i>Felhő / internet / külső hely</span
        ><span v-if="config.view === 'datacenters'"
          ><i class="legend-path"></i>Kiválasztott hálózati útvonal</span
        ><span
          >→ Irányított kapcsolat · Vonalszakadás = keresztezés, nem
          csomópont</span
        ><span class="muted">Görgess a nagyításhoz · Húzd az objektumokat</span>
      </div>
      <div class="export-strip" v-if="caps.includes('export_diagram')">
        <select v-model="scope" aria-label="Képexport terület">
          <option value="full">Teljes szűrt diagram</option>
          <option value="viewport">Aktuális látómező</option></select
        ><select v-model="scale" aria-label="Kép méret">
          <option :value="1">PNG 1×</option>
          <option :value="2">PNG 2×</option>
          <option :value="3">PNG 3×</option></select
        ><select v-model="paper" aria-label="PDF papírméret">
          <option value="a3">A3 fekvő</option>
          <option value="a4">A4 fekvő</option></select
        ><select v-model="exportBg" aria-label="Háttér">
          <option value="white">Fehér</option>
          <option value="transparent">Átlátszó PNG / SVG</option></select
        ><select v-model="pdfMode" aria-label="PDF tördelés">
          <option value="fit">Egy lapra illesztés</option>
          <option value="tiles">Több lapos csempézés</option></select
        ><button
          @click="exportImage('png')"
          :disabled="routing || dragging || exporting"
        >
          <Download :size="14" />PNG</button
        ><button
          @click="exportImage('svg')"
          :disabled="routing || dragging || exporting"
          title="Vektoros, nagyítható rajz"
        >
          <Download :size="14" />SVG</button
        ><button
          @click="exportImage('pdf')"
          :disabled="routing || dragging || exporting"
        >
          <Download :size="14" />PDF
        </button>
      </div>
      <div v-if="exporting" role="status" class="notice">
        Vektoros export / kép készítése…
      </div>
      <a
        v-if="svgPreview"
        :href="svgPreview"
        download="CMDB-diagram.svg"
        class="text-button"
        >Elkészült SVG letöltése</a
      >
      <div class="graph-disclaimer">
        SVG és PDF: vektoros, nagyításkor is éles. PNG: képpontos kép.
        Nyilvántartás, nem élő mérés.
      </div>
      <div v-if="(meta.counts?.nodes || 0) > 80" class="notice">
        Sűrű diagram: egyetlen PDF-lapra illesztve a címkék aprók lehetnek.
        Olvasható részletekhez szűkítsd a nézetet vagy válassz több lapos
        csempézést.
      </div>
      <details class="edge-list">
        <summary>
          Akadálymentes kapcsolati lista ({{ graphRows.length }})
        </summary>
        <button v-for="e in graphRows" @click="chosen = e">
          {{ routeResult?.failed.includes(e.id) ? "⚠ Nincs útvonal · " : ""
          }}{{ visibleNodes.find((n) => n.id === e.source)?.label }} →
          {{ visibleNodes.find((n) => n.id === e.target)?.label }} ·
          {{ e.label }} · {{ e.count }} kapcsolat
        </button>
      </details>
      <button
        v-if="props.proof"
        class="text-button benchmark"
        @click="benchmark"
      >
        Szintetikus próba betöltése</button
      ><a
        v-if="!props.proof"
        href="proof.html"
        target="_blank"
        rel="noopener"
        class="text-button benchmark"
        >Szintetikus diagrampróba külön oldalon</a
      >
      <div class="proof-controls" v-if="props.proof">
        <select
          v-model="fixtureKind"
          aria-label="Próbahálózat"
          @change="benchmark"
        >
          <option value="ranking">10 / 7 szomszéd · rangsor</option>
          <option value="single">Egy objektum · ékezetek és SVG szöveg</option>
          <option value="small-groups">7 alkalmazás · 5 szerverkeret</option>
          <option value="small-flat">7 alkalmazás · keretek nélkül</option>
          <option value="crossing">
            Csoportok, keresztezések, párhuzamos élek
          </option>
          <option value="dense">200 objektum / 500 él</option></select
        ><label class="check"
          ><input
            type="checkbox"
            v-model="config.aggregate"
            @change="benchmark"
          />Párhuzamos kapcsolatok összevonása</label
        >
        <details>
          <summary>Próba diagnosztika</summary>
          <pre class="diagram-diagnostics">{{
            JSON.stringify(
              {
                layoutRevision,
                center: actualCenter,
                pinned,
                routes: routeResult?.routes.length,
                failed: routeResult?.failed,
                crossings: routeResult?.crossings,
                routingMs: routeResult?.elapsed,
                positions,
              },
              null,
              2,
            )
          }}</pre>
        </details>
        <label class="check"
          ><input type="checkbox" v-model="stress" />Stresszteszt: 2000
          él</label
        ><button @click="measurePerformance()" :disabled="measuring || routing">
          {{
            measuring
              ? "Mérés folyamatban…"
              : `${fixtureKind === "dense" ? 3 : 20} rajzolás + 10 másodperc pan/zoom mérése`
          }}
        </button>
        <button
          @click="measurePerformance(false)"
          :disabled="measuring || routing"
        >
          10 másodperc pan/zoom
        </button>
        <pre v-if="measurements" class="measurement-result">{{
          JSON.stringify(measurements, null, 2)
        }}</pre>
      </div>
      <a
        v-if="pdfPreview"
        :href="pdfPreview"
        download="CMDB-diagram.pdf"
        class="text-button"
        >Elkészült PDF letöltése</a
      >
      <details v-if="exportPreview">
        <summary>Legutóbbi képexport előnézete</summary>
        <img
          :src="exportPreview"
          alt="Exportált CMDB diagram"
          style="width: 100%; height: auto"
        />
      </details>
    </div>
    <aside v-if="chosen" class="graph-detail">
      <button class="close" @click="chosen = null">×</button>
      <div class="eyebrow">KIJELÖLT OBJEKTUM</div>
      <h3>{{ chosen.label }}</h3>
      <p>{{ chosen.public_id }}</p>
      <p>
        {{ labels[chosen.record_type || chosen.entity_type] || chosen.type }}
      </p>
      <p v-if="chosen.environment">Környezet: {{ chosen.environment }}</p>
      <p v-if="chosen.datacenter">Adatközpont: {{ chosen.datacenter }}</p>
      <p v-if="chosen.hosting_type">Hosztolás: {{ chosen.hosting_type }}</p>
      <p v-if="chosen.entity_type === 'location_group'">
        {{ chosen.member_count }} közvetlenül besorolt elem ·
        {{
          chosen.scope === "external" ? "belső hálózaton kívül" : chosen.scope
        }}
      </p>
      <template v-if="!chosen.source">
        <p v-if="ranking.some((r) => r.id === chosen.id)">
          {{ ranking.find((r) => r.id === chosen.id)?.degree }} egyedi szomszéd
          a jelenlegi nézetben
        </p>
        <button
          v-if="
            ranking.some((r) => r.id === chosen.id) ||
            ['server_group', 'location_group'].includes(chosen.entity_type)
          "
          @click="centerOn(chosen.id)"
          :disabled="routing"
        >
          Középpontba helyezés
        </button>
      </template>
      <button
        v-if="
          !chosen.source &&
          ![
            'group',
            'zone',
            'component',
            'location_group',
            'location_gateway',
          ].includes(chosen.entity_type)
        "
        @click="pinChosen"
      >
        {{ chosenPinned() ? "Pozíció feloldása" : "Pozíció rögzítése" }}
      </button>
      <p v-if="chosen.count">{{ chosen.count }} mögöttes kapcsolat</p>
      <p v-if="chosen.source">
        {{ visibleNodes.find((n) => n.id === chosen.source)?.label }} →
        {{ visibleNodes.find((n) => n.id === chosen.target)?.label }}
      </p>
      <details v-if="chosen.members?.length > 1">
        <summary>Összevont kapcsolatok részletei ({{ chosen.count }})</summary>
        <p v-for="member in chosen.members">
          {{ member.label }} · {{ member.count || 1 }} kapcsolat
        </p>
      </details>
      <button
        v-if="
          ['group', 'server_group', 'location_group', 'collapsed'].includes(
            chosen.entity_type,
          )
        "
        @click="collapse(chosen.id)"
      >
        Keret összecsukása / kinyitása</button
      ><button
        v-if="labels[chosen.record_type || chosen.entity_type]"
        @click="
          openRecord(chosen.record_type || chosen.entity_type, chosen.entity_id)
        "
      >
        Adatlap megnyitása →</button
      ><button
        v-for="id in chosen.entity_ids || []"
        @click="
          openRecord(
            chosen.type === 'integration'
              ? 'integrations'
              : chosen.type === 'database'
                ? 'databases'
                : 'network_connections',
            id,
          )
        "
      >
        Kapcsolat adatlapja →
      </button>
    </aside>
  </div>
</template>
