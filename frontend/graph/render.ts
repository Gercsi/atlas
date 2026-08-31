import type { Rect, Route } from "./model";
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function routeSvg(routes: Route[], selected = "", interactive = true) {
  return routes
    .map((r) => {
      const color = r.id === selected ? "#116b58" : r.color;
      const label = r.label;
      return `<g data-route="${esc(r.id)}" opacity="${r.opacity}" ${interactive ? 'pointer-events="visiblePainted"' : ""}><path d="${r.path}" fill="none" stroke="${color}" stroke-width="${r.id === selected ? 3 : 1.8}" stroke-linejoin="round" ${r.dash ? `stroke-dasharray="${r.dash}"` : ""}/><polygon points="${r.arrow}" fill="${color}"/>${label ? `<rect x="${label.box.x1}" y="${label.box.y1}" width="${label.box.x2 - label.box.x1}" height="18" rx="4" fill="#fff" stroke="#d8e4df"/><text x="${(label.box.x1 + label.box.x2) / 2}" y="${label.box.y1 + 12.5}" text-anchor="middle" font-family="Arial" font-size="10" fill="${color}">${esc(label.text)}</text>` : ""}${interactive ? `<path class="route-hit" d="${r.path}" fill="none" stroke="transparent" stroke-width="9" pointer-events="stroke"/><title>${esc(r.id)}</title>` : ""}</g>`;
    })
    .join("");
}
export function svgDocument(
  routes: Route[],
  box: Rect,
  width: number,
  height: number,
  selected = "",
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${box.x1} ${box.y1} ${box.x2 - box.x1} ${box.y2 - box.y1}">${routeSvg(routes, selected, false)}</svg>`;
}
