# Security model

Foja opens files made by other people: projects (`.foja.json`), which can carry **styles
written in Typst**, and interface themes (`.foja-theme.json`). This page says what such a file
can and cannot do.

## Projects and styles

A style is Typst code. Typst is a sandboxed language: it has no shell, no network access of its
own, and reads only files under its project root.

- **In the browser**, the compiler runs in a Web Worker and sees only the project, Foja's
  library and styles, and the project's photo. It cannot read anything else on your computer.
- **In the CLI**, every compilation gets an empty temporary directory as its root; the same
  virtual files are mapped into it. A style that tries `read("/etc/…")`, `../` or `/proc` gets
  "file not found" (tested).
- Package imports (`#import "@preview/…"`) are not available in the browser. The CLI's Typst
  library can download packages from the official Typst registry.
- The preview shows Typst's SVG with its script, its HTML text layer and every link removed, so
  a style cannot put clickable `javascript:` links or markup into the page (tested).
- The LaTeX export percent-encodes URLs and escapes every special character of the text, so a
  contact field cannot inject TeX (`\input`, `\write`) into `cv.tex` (tested, compiled).
- A style that runs too long (an endless loop) is stopped after 20 seconds and the editor says so.

## The web app

Production pages carry a Content Security Policy: scripts only from the site itself (and
WebAssembly for the compiler), **connections only to the site itself**, no plugins, no forms.
Whatever slipped in could not load anything from elsewhere or send your data out.

## Themes

A theme is data, not code: a JSON file whose values are checked against a closed list (colours,
one length, font names) and written only into CSS custom properties. `url()`, `;`, braces and
anything else are refused (tested). The `window.foja.themes` API takes the same data, with the
same checks; it exists for scripts the user runs, and the page loads none from outside.

## Reporting

Report a security problem privately through GitHub's "Report a vulnerability" on
[bafif/foja](https://github.com/bafif/foja/security), not in a public issue.
