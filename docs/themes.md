# Making an interface theme

Themes change how the editor looks, never the CV. Foja comes with three (**Papel y tinta**,
**Neutro**, **Vivo**); a theme of your own is a small JSON file:

```json
{
  "id": "bosque",
  "name": "Bosque",
  "radius": "8px",
  "fonts": { "ui": "system-ui, sans-serif", "heading": "serif" },
  "light": {
    "bg": "#f1f7f3", "surface": "#ffffff", "surface2": "#e3efe7", "ink": "#16241c",
    "muted": "#5b6e62", "line": "#cfe0d5", "accent": "#2d6a4f", "accentSoft": "#d8eee2",
    "accentInk": "#1b4332", "onAccent": "#ffffff", "danger": "#b42318", "desk": "#dde9e1"
  },
  "dark": {
    "bg": "#101814", "surface": "#17221c", "surface2": "#1f2d25", "ink": "#e3efe7",
    "muted": "#9db3a6", "line": "#2c3d33", "accent": "#74c69d", "accentSoft": "#1f3a2c",
    "accentInk": "#c7ecd6", "onAccent": "#0b1a12", "danger": "#f08c84", "desk": "#0a100d"
  }
}
```

In the editor, **Tema → Importar un tema (.json)** adds it; **Descargar este tema como base**
gives you the current one to start from. Themes are kept in this browser.

## The colours

| Key | Used for |
| :--- | :--- |
| `bg` | the page behind everything |
| `surface`, `surface2` | panels, inputs; menus and hovers |
| `ink`, `muted` | text; secondary text |
| `line` | borders |
| `accent`, `onAccent` | buttons and links; text on an accent background |
| `accentSoft`, `accentInk` | selected items; text on them |
| `danger` | destructive actions and errors |
| `desk` | behind the preview sheet |

Every key is optional: missing ones come from Papel y tinta. Without `dark`, the theme stays
light when the system or the user asks for dark.

Values must be colours (`#hex`, `rgb()`, `hsl()`, `oklch()`, a colour name). `radius` is a
length (`px`, `rem`, `em`); `fonts.ui` and `fonts.heading` are lists of installed font names
(`"serif"` for the heading picks XCharter). Nothing else is accepted (no `url()`, no other CSS),
so a theme cannot load anything or reach beyond the editor's colours.

## From a script

Plugins can do the same at runtime:

```js
window.foja.themes.register({ id: "noche", name: "Noche", light: { accent: "#7048e8" }, dark: { accent: "#b197fc" } });
window.foja.themes.use("noche");
window.foja.themes.list(); // [{ id, name }, …]
```

`register` throws with the reason when the theme is not valid.
