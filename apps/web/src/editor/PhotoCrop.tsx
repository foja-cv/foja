// Crop the photo before it goes into the project: drag to move, the slider zooms, and the
// output is a JPEG of at most 800 px on its long side (smaller project, faster compiles).

import { useEffect, useRef, useState } from "react";
import { t } from "./i18n";

const ASPECTS: [string, number][] = [
  ["4:5", 4 / 5],
  ["1:1", 1],
  ["403:371", 403 / 371],
];

export function PhotoCrop({ src, onDone, onCancel }: { src: string; onDone: (jpeg: Uint8Array) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [img, setImg] = useState<HTMLImageElement>();
  const [aspect, setAspect] = useState(ASPECTS[2][1]);
  const [zoom, setZoom] = useState(1);
  // Centre of the crop, as a fraction of the image.
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const drag = useRef<{ x: number; y: number; cx: number; cy: number }>();
  const view = 320; // width of the crop frame on screen, px

  useEffect(() => {
    dialog.current?.showModal();
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = src;
  }, [src]);

  // The crop: the largest rectangle of `aspect` that fits, divided by `zoom`.
  const crop = img
    ? (() => {
        const fitW = Math.min(img.width, img.height * aspect) / zoom;
        const fitH = fitW / aspect;
        const x = Math.min(Math.max(center.x * img.width - fitW / 2, 0), img.width - fitW);
        const y = Math.min(Math.max(center.y * img.height - fitH / 2, 0), img.height - fitH);
        return { x, y, w: fitW, h: fitH };
      })()
    : undefined;
  const scale = crop ? view / crop.w : 1;

  function done() {
    if (!img || !crop) return;
    const out = Math.min(800, crop.w);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(out);
    canvas.height = Math.round(out / aspect);
    const ctx = canvas.getContext("2d")!;
    // JPEG has no transparency: a transparent PNG gets a white background, not black.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => blob && onDone(new Uint8Array(await blob.arrayBuffer())), "image/jpeg", 0.9);
  }

  return (
    <dialog ref={dialog} onClose={onCancel} aria-label={t.crop.title} className="m-auto rounded-lg bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40">
      <div className="flex flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold">{t.crop.title}</h2>
        <div
          data-testid="crop-frame"
          tabIndex={0}
          role="application"
          aria-label={`${t.crop.title}. ${t.crop.hint}`}
          onKeyDown={(e) => {
            const step = 0.02;
            const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            const m = moves[e.key];
            if (!m) return;
            e.preventDefault();
            setCenter((c) => ({ x: Math.min(1, Math.max(0, c.x + m[0])), y: Math.min(1, Math.max(0, c.y + m[1])) }));
          }}
          className="relative cursor-move touch-none overflow-hidden rounded bg-desk"
          style={{ width: view, height: view / aspect }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, cx: center.x, cy: center.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current || !img) return;
            const dx = (e.clientX - drag.current.x) / scale / img.width;
            const dy = (e.clientY - drag.current.y) / scale / img.height;
            setCenter({ x: Math.min(1, Math.max(0, drag.current.cx - dx)), y: Math.min(1, Math.max(0, drag.current.cy - dy)) });
          }}
          onPointerUp={() => (drag.current = undefined)}
        >
          {img && crop && (
            <img
              alt=""
              src={src}
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ width: img.width * scale, height: img.height * scale, left: -crop.x * scale, top: -crop.y * scale }}
            />
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          {t.crop.zoom}
          <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          {t.crop.aspect}
          <select className="rounded border border-line px-2 py-1" value={aspect} onChange={(e) => setAspect(Number(e.target.value))}>
            {ASPECTS.map(([label, value]) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">{t.crop.hint}</p>
        <div className="flex justify-end gap-2">
          <button className="rounded border border-line px-3 py-1 text-sm" onClick={onCancel}>
            {t.cancel}
          </button>
          <button className="rounded bg-accent px-3 py-1 text-sm text-on-accent" onClick={done} disabled={!img}>
            {t.crop.use}
          </button>
        </div>
      </div>
    </dialog>
  );
}
