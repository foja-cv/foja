// The preview sheet, updated page by page: a change usually touches one page and the glyph
// definitions, so only those nodes are replaced. Replacing the whole SVG of a long CV (megabytes)
// on every keystroke cost the browser hundreds of milliseconds of parsing and layout.

import { useLayoutEffect, useRef } from "react";

const PAGE = /(?=<g class="typst-page")/;
const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:h5="http://www.w3.org/1999/xhtml"';

interface Parts {
  open: string; // the <svg …> tag
  head: string; // styles and definitions, before the first page
  pages: string[];
}

function split(svg: string): Parts | undefined {
  const openEnd = svg.indexOf(">") + 1;
  const close = svg.lastIndexOf("</svg>");
  if (openEnd <= 0 || close < 0) return undefined;
  const [head, ...pages] = svg.slice(openEnd, close).split(PAGE);
  return { open: svg.slice(0, openEnd), head, pages };
}

/** Elements of an SVG fragment, parsed as XML in the SVG namespace. */
function nodes(fragment: string): Element[] | undefined {
  const doc = new DOMParser().parseFromString(`<svg ${NS}>${fragment}</svg>`, "image/svg+xml");
  if (doc.querySelector("parsererror")) return undefined;
  return [...doc.documentElement.children].map((el) => document.importNode(el, true));
}

export function SvgView({ svg }: { svg: string }) {
  const host = useRef<HTMLDivElement>(null);
  const shown = useRef<Parts>();

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const next = split(svg);
    const prev = shown.current;
    const root = el.firstElementChild;
    const full = () => {
      el.innerHTML = svg;
      shown.current = next;
    };
    if (!next || !prev || !root || prev.open !== next.open || prev.pages.length !== next.pages.length) return full();
    const pageNodes = [...root.children].filter((c) => c.classList.contains("typst-page"));
    if (pageNodes.length !== prev.pages.length) return full();
    if (prev.head !== next.head) {
      const head = nodes(next.head);
      if (!head) return full();
      for (const old of [...root.children]) if (!old.classList.contains("typst-page")) old.remove();
      root.prepend(...head);
    }
    for (let i = 0; i < next.pages.length; i++) {
      if (prev.pages[i] === next.pages[i]) continue;
      const page = nodes(next.pages[i]);
      if (!page || page.length !== 1) return full();
      pageNodes[i].replaceWith(page[0]);
    }
    shown.current = next;
  }, [svg]);

  return <div ref={host} className="foja-page" />;
}
