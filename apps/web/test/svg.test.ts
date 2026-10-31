import { expect, test } from "vitest";
import { cleanSvg } from "../src/lib/svg";

test("scripts, HTML layers and links are removed", () => {
  const dirty = `<svg><script>alert(1)</script><g><foreignObject><h5:div>&lt;img&gt;</h5:div></foreignObject></g><a xlink:href="javascript:alert(1)"><path d="M0 0"/></a><A HREF="javascript:x">y</A></svg>`;
  const clean = cleanSvg(dirty);
  expect(clean).not.toMatch(/script|foreignObject|javascript|<a\b|<A\b/i);
  expect(clean).toContain('<g><path d="M0 0"/></g>');
});
