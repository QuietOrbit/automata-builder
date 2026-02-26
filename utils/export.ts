import type { Position } from "~/types/automaton";

/** Minimal type for the File System Access API (Chromium only, not in all TS libs). */
interface FileSystemAccessGlobal {
  showSaveFilePicker: (options?: Record<string, unknown>) => Promise<{
    getParent?: () => Promise<FileSystemDirectoryHandle>;
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute a tight bounding box around all state positions with padding.
 * Padding default of 80px covers state radius (30) + accept ring (5) + start arrow (45).
 * Returns null if no positions are provided.
 */
export function computeContentBounds(
  positions: Position[],
  padding: number = 80,
): Bounds | null {
  if (positions.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pos of positions) {
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.x > maxX) maxX = pos.x;
    if (pos.y > maxY) maxY = pos.y;
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

const INLINE_PROPS = [
  "fill",
  "stroke",
  "stroke-width",
  "font-family",
  "font-size",
] as const;

/**
 * Walk both element trees in parallel, reading computed styles from the
 * original and writing them as inline styles on the clone. This resolves
 * CSS custom properties so the exported SVG is self-contained.
 */
function inlineStyles(original: SVGSVGElement, clone: SVGSVGElement): void {
  const origElements = original.querySelectorAll("*");
  const cloneElements = clone.querySelectorAll("*");

  for (let i = 0; i < origElements.length; i++) {
    const origEl = origElements[i];
    const cloneEl = cloneElements[i] as HTMLElement | SVGElement | undefined;
    if (!cloneEl) break;

    const computed = globalThis.getComputedStyle(origEl);
    for (const prop of INLINE_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value) {
        cloneEl.style.setProperty(prop, value);
      }
    }
  }
}

/**
 * Promise wrapper for loading an image from a src URL.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Clone the live SVG, remove grid elements, insert a background rect,
 * inline all computed styles, and set the viewBox to the content bounds.
 */
export function prepareSvgForExport(
  svgElement: SVGSVGElement,
  bounds: Bounds,
): SVGSVGElement {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Inline styles FIRST while the clone's DOM structure exactly matches the
  // original. This ensures the parallel querySelectorAll('*') walk pairs each
  // original element with its correct clone counterpart.
  inlineStyles(svgElement, clone);

  // Now safe to modify the clone's DOM — style data is already baked in.
  clone.querySelector(".grid-bg")?.remove();
  clone.querySelector("#grid")?.remove();
  clone.querySelector("#grid-major")?.remove();

  // Resolve --color-bg from the live document
  const bgColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-bg")
    .trim();

  // Insert background rect as first child of clone
  const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bgRect.setAttribute("x", String(bounds.x));
  bgRect.setAttribute("y", String(bounds.y));
  bgRect.setAttribute("width", String(bounds.width));
  bgRect.setAttribute("height", String(bounds.height));
  bgRect.setAttribute("fill", bgColor);
  clone.insertBefore(bgRect, clone.firstChild);

  // Set viewBox and dimensions
  clone.setAttribute(
    "viewBox",
    `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
  );
  clone.setAttribute("width", String(bounds.width));
  clone.setAttribute("height", String(bounds.height));

  return clone;
}

/**
 * Serialize an SVG element to a string with XML declaration and xmlns.
 */
export function serializeSvg(svgElement: SVGSVGElement): string {
  svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n" + svgString;
}

/**
 * Full SVG export pipeline: compute bounds, prepare, serialize, return Blob.
 * Returns null if the automaton has no states.
 */
export function exportSvgBlob(
  svgElement: SVGSVGElement,
  positions: Position[],
): Blob | null {
  const bounds = computeContentBounds(positions);
  if (!bounds) return null;

  const prepared = prepareSvgForExport(svgElement, bounds);
  const svgString = serializeSvg(prepared);
  return new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
}

/**
 * Raster export pipeline: SVG -> data URL -> Image -> Canvas -> Blob.
 * Scale defaults to 2x for retina quality. JPEG gets a white canvas fill.
 * Returns null if the automaton has no states.
 */
export async function exportRasterBlob(
  svgElement: SVGSVGElement,
  positions: Position[],
  format: "png" | "jpeg",
  scale: number = 2,
): Promise<Blob | null> {
  const bounds = computeContentBounds(positions);
  if (!bounds) return null;

  const prepared = prepareSvgForExport(svgElement, bounds);
  const svgString = serializeSvg(prepared);

  // Use encodeURIComponent for Unicode safety
  const dataUrl
    = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = bounds.width * scale;
  canvas.height = bounds.height * scale;

  const ctx = canvas.getContext("2d")!;

  // JPEG doesn't support transparency — fill with white
  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob | null>((resolve) => {
    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    canvas.toBlob(
      blob => resolve(blob),
      mimeType,
      format === "jpeg" ? 0.95 : undefined,
    );
  });
}

/**
 * Trigger a browser download for a Blob with the given filename.
 * Used as fallback when the File System Access API is unavailable.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Cached directory handle for File System Access API (session-only, Chromium). */
let lastDirectoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Save a Blob using the File System Access API (native save dialog) when available,
 * falling back to blob+anchor download for unsupported browsers.
 *
 * In Chromium, caches the parent directory handle so subsequent exports
 * in the same session default to the same folder.
 *
 * @param blob     - The file content to save.
 * @param filename - Suggested filename (used in both native dialog and fallback).
 * @param accept   - Optional MIME type filter for the save dialog.
 */
export async function saveBlob(
  blob: Blob,
  filename: string,
  accept?: Record<string, string[]>,
): Promise<void> {
  if ("showSaveFilePicker" in globalThis) {
    try {
      const options: Record<string, unknown> = {
        suggestedName: filename,
      };
      if (accept) {
        options.types = [{ accept }];
      }
      if (lastDirectoryHandle) {
        options.startIn = lastDirectoryHandle;
      }

      const handle = await (globalThis as unknown as FileSystemAccessGlobal).showSaveFilePicker(options);

      // Cache parent directory for next export
      if (typeof handle.getParent === "function") {
        lastDirectoryHandle = await handle.getParent();
      }

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
    catch {
      // User cancelled the dialog — do nothing
      return;
    }
  }

  // Fallback for Firefox/Safari
  triggerDownload(blob, filename);
}
