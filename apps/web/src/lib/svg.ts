/**
 * The typst.ts SVG without its extras, safe to put in the page:
 * - the interaction `<script>` (not valid XML, so the SVG would not decode as an image);
 * - the text-selection layer, HTML in `<foreignObject>` holding the user's text (an imported
 *   project could carry markup; it would also taint a canvas);
 * - links: a style is Typst code that may come from someone else, and `link("javascript:…")`
 *   would become a clickable script. The preview does not need links (the PDF keeps them).
 * The glyphs are paths, so the page looks the same.
 */
export function cleanSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<a\b[^>]*>/gi, "<g>")
    .replace(/<\/a>/gi, "</g>");
}
