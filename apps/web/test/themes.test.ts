import { describe, expect, test } from "vitest";
import { BUILTIN_THEMES, paletteOf, parseTheme } from "../src/editor/themes";

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// Text against what it sits on, everywhere the interface does it. 4.5:1 is WCAG AA for body text.
const PAIRS: [string, string][] = [
  ["ink", "bg"],
  ["ink", "surface"],
  ["ink", "surface2"],
  ["muted", "surface"],
  ["muted", "bg"],
  ["accent", "surface"],
  ["onAccent", "accent"],
  ["accentInk", "accentSoft"],
  ["danger", "surface"],
];

describe.each(BUILTIN_THEMES.flatMap((t) => [[t.id, t, false], [t.id, t, true]] as const))("%s (dark: %s)", (_, theme, dark) => {
  const palette = paletteOf(theme, dark) as Record<string, string>;
  test.each(PAIRS)("%s on %s reaches 4.5:1", (fg, bg) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("theme validation", () => {
  test("accepts colours, a length and font names", () => {
    expect(parseTheme({ id: "a", name: "A", light: { accent: "#123456", bg: "rgb(1, 2, 3)" }, radius: "6px", fonts: { ui: "Inter, sans-serif" } }).light.accent).toBe("#123456");
  });
  test.each([
    [{ id: "a", name: "A", light: { bg: "url(x)" } }, "is not a colour"],
    [{ id: "a", name: "A", light: { bg: "red; background: url(x)" } }, "is not a colour"],
    [{ id: "a", name: "A", light: { shadow: "#000" } }, "is not a colour of a theme"],
    [{ id: "a", name: "A", light: {}, radius: "calc(1px)" }, "must be a length"],
    [{ id: "a", name: "A", light: {}, fonts: { ui: "x}{body{display:none" } }, "list of font names"],
    [{ id: "Bad Id", name: "A", light: {} }, "lowercase"],
    [{ id: "papel", name: "A", light: {} }, "built-in"],
  ])("rejects %j", (theme, reason) => {
    expect(() => parseTheme(theme)).toThrow(reason);
  });
});
