// Interface themes. A theme is a set of colours and a few shapes (see docs/themes.md); Foja has
// three, and more can be added as plugins: a `.foja-theme.json` file imported from the theme
// menu, or `window.foja.themes.register(theme)` from a script. Themes only touch the editor's
// look, never the CV.

import { create } from "zustand";

export const TOKENS = ["bg", "surface", "surface2", "ink", "muted", "line", "accent", "accentSoft", "accentInk", "onAccent", "danger", "desk"] as const;
export type Token = (typeof TOKENS)[number];
export type Palette = Record<Token, string>;

export interface Theme {
  id: string;
  name: string;
  /** Colours for light mode; missing ones come from Foja's default theme. */
  light: Partial<Palette>;
  /** Colours for dark mode; missing ones come from Foja's default dark palette. A theme without
   * them stays light in dark mode. */
  dark?: Partial<Palette>;
  /** Corner radius, e.g. `6px` or `0.5rem`. */
  radius?: string;
  /** Font stacks (installed fonts only: nothing is downloaded). `heading` may be "serif". */
  fonts?: { ui?: string; heading?: string };
}

const SERIF = 'XCharter, Charter, "Bitstream Charter", Georgia, serif';
const SANS = 'system-ui, "Segoe UI", "Noto Sans", Roboto, Helvetica, Arial, sans-serif';

export const BUILTIN_THEMES: Theme[] = [
  {
    id: "papel",
    name: "Papel y tinta",
    radius: "4px",
    fonts: { ui: SANS, heading: SERIF },
    light: {
      bg: "#f6f1e7",
      surface: "#fffdf8",
      surface2: "#efe8da",
      ink: "#1f2a2e",
      muted: "#5f6b6e",
      line: "#ddd3c0",
      accent: "#1f5f5b",
      accentSoft: "#dcebe8",
      accentInk: "#123c39",
      onAccent: "#ffffff",
      danger: "#a3322a",
      desk: "#e4dccb",
    },
    dark: {
      bg: "#171c1d",
      surface: "#1f2627",
      surface2: "#283133",
      ink: "#ece6da",
      muted: "#a3aba9",
      line: "#3a4446",
      accent: "#5fb3aa",
      accentSoft: "#1f3b39",
      accentInk: "#bfe5e0",
      onAccent: "#0d1a19",
      danger: "#e0786f",
      desk: "#0f1314",
    },
  },
  {
    id: "neutra",
    name: "Neutro",
    radius: "6px",
    fonts: { ui: SANS, heading: SANS },
    light: {
      bg: "#f4f5f7",
      surface: "#ffffff",
      surface2: "#eceef1",
      ink: "#16181d",
      muted: "#5b616e",
      line: "#d9dce2",
      accent: "#3f51b5",
      accentSoft: "#e6e9fb",
      accentInk: "#26327a",
      onAccent: "#ffffff",
      danger: "#c62828",
      desk: "#e2e5ea",
    },
    dark: {
      bg: "#121419",
      surface: "#1a1d23",
      surface2: "#23272f",
      ink: "#e8eaef",
      muted: "#9aa1ad",
      line: "#30353f",
      accent: "#8c9eff",
      accentSoft: "#262d52",
      accentInk: "#cdd5ff",
      onAccent: "#10131f",
      danger: "#ef7d7d",
      desk: "#0c0e12",
    },
  },
  {
    id: "viva",
    name: "Vivo",
    radius: "12px",
    fonts: { ui: SANS, heading: SANS },
    light: {
      bg: "#fff6f0",
      surface: "#ffffff",
      surface2: "#ffe9dc",
      ink: "#2b1d16",
      muted: "#7a6155",
      line: "#f2d6c6",
      accent: "#c2410c",
      accentSoft: "#ffe3d2",
      accentInk: "#8a2f00",
      onAccent: "#ffffff",
      danger: "#c2255c",
      desk: "#fbe2d3",
    },
    dark: {
      bg: "#1d1411",
      surface: "#271b17",
      surface2: "#33241e",
      ink: "#fbece4",
      muted: "#c9ab9c",
      line: "#47332b",
      accent: "#ff8a4c",
      accentSoft: "#4a2616",
      accentInk: "#ffd2b8",
      onAccent: "#2b1306",
      danger: "#f783ac",
      desk: "#140d0b",
    },
  },
];

// ---------------------------------------------------------------- validation

// Values are written into CSS custom properties, so only plain colours, lengths and font names
// get through: no url(), no `;` or braces, nothing that could load or inject anything.
const COLOR = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla|oklch|oklab)\([\d\s.,%/+-]+\)|[a-z]{3,20})$/i;
const LENGTH = /^\d+(\.\d+)?(px|rem|em)$/;
const FONTS = /^[\w\s,"'.-]{1,200}$/;

export function parseTheme(value: unknown): Theme {
  if (!value || typeof value !== "object") throw new Error("a theme is a JSON object");
  const v = value as Record<string, unknown>;
  const fail = (m: string): never => {
    throw new Error(m);
  };
  const id = typeof v.id === "string" && /^[a-z0-9][a-z0-9-]{0,40}$/.test(v.id) ? v.id : fail('"id" must be lowercase letters, digits and dashes');
  const name = typeof v.name === "string" && v.name.trim() && v.name.length <= 60 ? v.name.trim() : fail('"name" is required (up to 60 characters)');
  const palette = (p: unknown, key: string): Partial<Palette> => {
    if (p === undefined) return {};
    if (!p || typeof p !== "object") fail(`"${key}" must be an object of colours`);
    const out: Partial<Palette> = {};
    for (const [token, color] of Object.entries(p as Record<string, unknown>)) {
      if (!(TOKENS as readonly string[]).includes(token)) fail(`"${key}.${token}" is not a colour of a theme (${TOKENS.join(", ")})`);
      if (typeof color !== "string" || !COLOR.test(color.trim())) fail(`"${key}.${token}" is not a colour`);
      out[token as Token] = (color as string).trim();
    }
    return out;
  };
  const theme: Theme = { id, name, light: palette(v.light, "light") };
  if (v.dark !== undefined) theme.dark = palette(v.dark, "dark");
  if (v.radius !== undefined) theme.radius = typeof v.radius === "string" && LENGTH.test(v.radius) ? v.radius : fail('"radius" must be a length like 6px');
  if (v.fonts !== undefined) {
    const f = v.fonts as Record<string, unknown>;
    theme.fonts = {};
    for (const key of ["ui", "heading"] as const) {
      if (f?.[key] === undefined) continue;
      if (typeof f[key] !== "string" || !FONTS.test(f[key] as string)) fail(`"fonts.${key}" must be a list of font names`);
      theme.fonts[key] = f[key] as string;
    }
  }
  if (BUILTIN_THEMES.some((t) => t.id === theme.id)) fail(`"${theme.id}" is a built-in theme; pick another id`);
  return theme;
}

// ---------------------------------------------------------------- state

export type Mode = "auto" | "light" | "dark";

const KEYS = { themes: "foja.themes", theme: "foja.theme", mode: "foja.mode" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private windows): the choice lasts for this visit only.
  }
}

interface ThemeState {
  added: Theme[];
  current: string;
  mode: Mode;
  register(theme: unknown): Theme;
  remove(id: string): void;
  use(id: string): void;
  setMode(mode: Mode): void;
}

const savedThemes = load<unknown[]>(KEYS.themes, []).flatMap((t) => {
  try {
    return [parseTheme(t)];
  } catch {
    return [];
  }
});

export const useThemes = create<ThemeState>()((set, get) => ({
  added: savedThemes,
  current: load(KEYS.theme, "papel"),
  mode: load<Mode>(KEYS.mode, "auto"),
  register(value) {
    const theme = parseTheme(value);
    const added = [...get().added.filter((t) => t.id !== theme.id), theme];
    store(KEYS.themes, added);
    set({ added });
    return theme;
  },
  remove(id) {
    const added = get().added.filter((t) => t.id !== id);
    store(KEYS.themes, added);
    set({ added, current: get().current === id ? "papel" : get().current });
  },
  use(id) {
    store(KEYS.theme, id);
    set({ current: id });
  },
  setMode(mode) {
    store(KEYS.mode, mode);
    set({ mode });
  },
}));

export const allThemes = (s: Pick<ThemeState, "added">) => [...BUILTIN_THEMES, ...s.added];

// ---------------------------------------------------------------- applying

const cssName = (token: Token) => `--foja-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/** The full palette of a theme in a mode, with the default theme filling the gaps. */
export function paletteOf(theme: Theme, dark: boolean): Palette {
  const base = BUILTIN_THEMES[0];
  return (dark ? { ...base.dark, ...theme.dark } : { ...base.light, ...theme.light }) as Palette;
}

function apply() {
  const state = useThemes.getState();
  const theme = allThemes(state).find((t) => t.id === state.current) ?? BUILTIN_THEMES[0];
  const dark = state.mode === "dark" || (state.mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  // A theme without dark colours stays light in dark mode rather than mixing palettes.
  const useDark = dark && (theme.dark !== undefined || BUILTIN_THEMES.includes(theme));
  const palette = paletteOf(theme, useDark);
  const root = document.documentElement;
  for (const token of TOKENS) root.style.setProperty(cssName(token), palette[token]);
  root.style.setProperty("--foja-radius", theme.radius ?? "4px");
  root.style.setProperty("--foja-font-ui", theme.fonts?.ui ?? SANS);
  root.style.setProperty("--foja-font-heading", theme.fonts?.heading === "serif" ? SERIF : (theme.fonts?.heading ?? theme.fonts?.ui ?? SANS));
  root.dataset.mode = useDark ? "dark" : "light";
  root.dataset.theme = theme.id;
  root.style.colorScheme = useDark ? "dark" : "light";
}

/** Applies the chosen theme now and whenever the choice or the system's mode changes; exposes
 * the plugin API on `window.foja.themes`. */
export function startThemes() {
  apply();
  useThemes.subscribe(apply);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", apply);
  const api = {
    /** Adds (or replaces) a theme and returns it; throws with the reason when it is not valid. */
    register: (theme: unknown) => useThemes.getState().register(theme),
    /** Switches to a theme by id. */
    use: (id: string) => useThemes.getState().use(id),
    /** Every theme, built-in and added. */
    list: () => allThemes(useThemes.getState()).map(({ id, name }) => ({ id, name })),
  };
  const w = window as unknown as { foja?: Record<string, unknown> };
  w.foja = { ...w.foja, themes: api };
}
