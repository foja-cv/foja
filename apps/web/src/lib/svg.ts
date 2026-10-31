/**
 * The typst.ts SVG without its extras: the interaction `<script>` (not valid XML, so the SVG
 * would not decode as an image) and the text-selection layer, HTML in `<foreignObject>` holding
 * the user's text (an imported project could carry markup; it would also taint a canvas). The
 * glyphs are paths, so the page looks the same.
 */
export function cleanSvg(svg: string): string {
  return svg.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, "");
}
