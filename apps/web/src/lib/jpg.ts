// JPG export in the browser: the Typst SVG drawn on a canvas, one JPEG per page. The Node addon
// has no raster output, so this exists only here.

export interface PageBox {
  y: number;
  width: number;
  height: number;
}

/** The pages of a typst.ts SVG, stacked vertically in one document. */
export function pageBoxes(svg: string): PageBox[] {
  return [...svg.matchAll(/<g class="typst-page" transform="translate\(0, ([\d.]+)\)"[^>]*data-page-width="([\d.]+)" data-page-height="([\d.]+)"/g)].map(
    (m) => ({ y: Number(m[1]), width: Number(m[2]), height: Number(m[3]) }),
  );
}

export async function svgToJpegs(svg: string, dpi = 150, quality = 0.92): Promise<Uint8Array[]> {
  // The text-selection layer is HTML in <foreignObject>, which would taint the canvas.
  const clean = svg.replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, "");
  const total = { width: Number(/data-width="([\d.]+)"/.exec(svg)?.[1]), height: Number(/data-height="([\d.]+)"/.exec(svg)?.[1]) };
  const url = URL.createObjectURL(new Blob([clean], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = dpi / 72;
    const pages = pageBoxes(svg);
    return await Promise.all(
      (pages.length ? pages : [{ y: 0, ...total }]).map(async (page) => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(page.width * scale);
        canvas.height = Math.round(page.height * scale);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, -page.y * scale, total.width * scale, total.height * scale);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG encoding failed"))), "image/jpeg", quality),
        );
        return new Uint8Array(await blob.arrayBuffer());
      }),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
