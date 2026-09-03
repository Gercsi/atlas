import type cytoscape from "cytoscape";
import type { Rect, RoutingResult } from "./model";
import { routeSvg } from "./render";
import regularFontUrl from "../assets/fonts/LiberationSans-Regular.ttf?url";
import boldFontUrl from "../assets/fonts/LiberationSans-Bold.ttf?url";

const escape = (value: string) =>
  value.replace(
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
const fontFamily = "Liberation Sans";
let fontData: Promise<string[]> | undefined;
export function exportFonts() {
  return (fontData ||= Promise.all(
    [regularFontUrl, boldFontUrl].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error("Az export betűkészlete nem tölthető be.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    }),
  ).catch((error) => {
    fontData = undefined;
    throw error;
  }));
}

function wrap(text: string, width: number, context: CanvasRenderingContext2D) {
  return text.split("\n").flatMap((line) => {
    const lines: string[] = [];
    let current = "";
    for (const word of line.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && context.measureText(next).width > width) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    lines.push(current);
    return lines;
  });
}

// Snapshot public Cytoscape geometry synchronously. No viewport bitmap or private
// renderer cache is involved, so PDF/SVG retain paths and searchable text at any zoom.
export function vectorScene(
  cy: cytoscape.Core,
  result: RoutingResult,
  selected = "",
) {
  const context = document.createElement("canvas").getContext("2d")!;
  const nodes = [...cy.nodes()].sort(
    (a, b) => a.ancestors().length - b.ancestors().length,
  );
  const markup = nodes
    .map((n) => {
      const group = n.isParent(),
        p = n.position();
      const width = n.outerWidth() - parseFloat(n.style("border-width")),
        height = n.outerHeight() - parseFloat(n.style("border-width"));
      const x = p.x - width / 2,
        y = p.y - height / 2;
      const border = parseFloat(n.style("border-width")) || 0;
      const color = n.style("border-color"),
        fill = n.style("background-color");
      const opacity = n.style("background-opacity");
      const dashed =
        n.style("border-style") === "dashed" ? 'stroke-dasharray="6 3"' : "";
      let shape = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${n.style("shape") === "rectangle" ? 0 : 8}" fill="${fill}" fill-opacity="${opacity}" stroke="${color}" stroke-width="${border}" ${dashed}/>`;
      if (!group && n.style("shape") === "diamond") {
        shape = `<polygon points="${p.x},${y} ${x + width},${p.y} ${p.x},${y + height} ${x},${p.y}" fill="${fill}" fill-opacity="${opacity}" stroke="${color}" stroke-width="${border}" ${dashed}/>`;
      }
      if (!group && n.data("entity_type") === "databases") {
        const outline = border ? shape : "";
        // Same cylinder as the on-screen SVG background, scaled to the node body.
        const scale = Math.min(width / 160, height / 90);
        shape = `<g transform="translate(${p.x - 80 * scale} ${p.y - 45 * scale}) scale(${scale})"><path d="M2 15 C2 -2 158 -2 158 15 L158 72 C158 92 2 92 2 72 Z" fill="#f5edff" stroke="#a78bce" stroke-width="2"/><ellipse cx="80" cy="15" rx="78" ry="13" fill="#eee1ff" stroke="#a78bce" stroke-width="2"/></g>`;
        shape += outline;
      }
      const fontSize = parseFloat(n.style("font-size")),
        weight = n.style("font-weight");
      context.font = `${weight} ${fontSize}px Arial`;
      const lines = wrap(
        String(n.data("label") || ""),
        parseFloat(n.style("text-max-width")) || 140,
        context,
      );
      const label = n.boundingBox({
        includeNodes: false,
        includeEdges: false,
        includeLabels: true,
        includeOverlays: false,
        includeUnderlays: false,
      });
      const cx = (label.x1 + label.x2) / 2,
        cy = (label.y1 + label.y2) / 2;
      const text = lines
        .map(
          (line, i) =>
            `<text x="${cx}" y="${cy + (i - (lines.length - 1) / 2) * fontSize + fontSize * 0.35}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}" text-anchor="middle" fill="${n.style("color")}">${escape(line)}</text>`,
        )
        .join("");
      return `<g data-node="${escape(n.id())}">${shape}${text}</g>`;
    })
    .join("");
  return (
    markup +
    routeSvg(result.routes, selected, false).replaceAll(
      'font-family="Arial"',
      `font-family="${fontFamily}"`,
    )
  );
}

export function vectorDocument(
  scene: string,
  box: Rect,
  options: {
    background: string;
    fonts?: string[];
    footer?: string[];
    title?: string;
  },
) {
  const w = Math.max(1, box.x2 - box.x1),
    h = Math.max(1, box.y2 - box.y1);
  // Footer stays legible in the full overview but never determines the plot scale.
  const footerScale = Math.max(1, w / 1200);
  const context = document.createElement("canvas").getContext("2d")!;
  const footerLines = (options.footer || []).flatMap((line, i) => {
    const size = (i ? 11 : 13) * footerScale;
    context.font = `${size}px Arial`;
    return wrap(line, Math.max(30, w - 32 * footerScale), context).map(
      (text) => ({ text, size }),
    );
  });
  const footerHeight = footerLines.length
    ? (38 + (footerLines.length - 1) * 18) * footerScale
    : 0;
  const fonts = options.fonts
    ? `<defs><style>${options.fonts.map((font, i) => `@font-face { font-family: '${fontFamily}'; font-weight: ${i ? "bold" : "normal"}; src: url(data:font/ttf;base64,${font}) format('truetype'); }`).join("\n")}</style></defs>`
    : "";
  const footer =
    footerLines
      .map(
        (line, i) =>
          `<text x="${16 * footerScale}" y="${h + (22 + 18 * i) * footerScale}" font-family="${fontFamily}" font-size="${line.size}" fill="#24443f">${escape(line.text)}</text>`,
      )
      .join("") || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + footerHeight}" viewBox="0 0 ${w} ${h + footerHeight}" role="img"><title>${escape(options.title || "Atlas CMDB kapcsolati diagram")}</title>${fonts}${options.background === "white" ? `<rect width="${w}" height="${h + footerHeight}" fill="#fff"/>` : ""}<svg x="0" y="0" width="${w}" height="${h}" viewBox="${box.x1} ${box.y1} ${w} ${h}" overflow="hidden">${scene}</svg>${footer}</svg>`;
}

export async function vectorPdf(
  scene: string,
  box: Rect,
  settings: {
    paper: "a3" | "a4";
    mode: string;
    footer: string[];
  },
) {
  const [{ jsPDF }, fonts] = await Promise.all([
    import("jspdf"),
    exportFonts(),
    import("svg2pdf.js"),
  ]);
  const pdf = new jsPDF({
    orientation: "landscape",
    format: settings.paper,
    compress: true,
    putOnlyUsedFonts: true,
  });
  fonts.forEach((font, i) => {
    pdf.addFileToVFS(`LiberationSans-${i}.ttf`, font);
    pdf.addFont(`LiberationSans-${i}.ttf`, fontFamily, i ? "bold" : "normal");
  });
  // svg2pdf measures with browser fonts; install the very same embedded fonts there.
  const faces = await Promise.all(
    fonts.map(async (font, i) => {
      const face = new FontFace(
        fontFamily,
        `url(data:font/ttf;base64,${font})`,
        { weight: i ? "bold" : "normal" },
      );
      await face.load();
      document.fonts.add(face);
      return face;
    }),
  );
  try {
    const pw = pdf.internal.pageSize.getWidth() - 20,
      ph = pdf.internal.pageSize.getHeight() - 20;
    const w = box.x2 - box.x1,
      h = box.y2 - box.y1;
    // 1 CSS pixel = 0.264583 mm for readable, naturally sized tiled printing.
    const nx =
      settings.mode === "tiles"
        ? Math.max(1, Math.ceil((w * 0.264583) / pw))
        : 1;
    const ny =
      settings.mode === "tiles"
        ? Math.max(1, Math.ceil((h * 0.264583) / (ph - 24)))
        : 1;
    if (nx * ny > 64)
      throw new Error(
        "A csempézett export több mint 64 oldal lenne. Szűkítsd a nézetet vagy válaszd az egy lapra illesztést.",
      );
    for (let y = 0; y < ny; y++)
      for (let x = 0; x < nx; x++) {
        if (x || y) pdf.addPage();
        const tile = {
          x1: box.x1 + (x * w) / nx,
          y1: box.y1 + (y * h) / ny,
          x2: box.x1 + ((x + 1) * w) / nx,
          y2: box.y1 + ((y + 1) * h) / ny,
        };
        const footer = [...settings.footer];
        if (nx * ny > 1)
          footer[0] += ` · ${y * nx + x + 1}/${nx * ny}. oldal (oszlop ${x + 1}, sor ${y + 1})`;
        const xml = vectorDocument(scene, tile, {
          background: "white",
          footer,
        });
        const svg = new DOMParser().parseFromString(
          xml,
          "image/svg+xml",
        ).documentElement;
        const sw = Number(svg.getAttribute("width")),
          sh = Number(svg.getAttribute("height"));
        const scale = Math.min(pw / sw, ph / sh);
        await pdf.svg(svg, {
          x: 10,
          y: 10,
          width: sw * scale,
          height: sh * scale,
        });
      }
    return pdf.output("blob");
  } finally {
    faces.forEach((face) => document.fonts.delete(face));
  }
}
