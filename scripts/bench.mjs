// Measure the live preview in a real browser: opens `/spike?bench=N` in headless Chrome through the
// DevTools protocol (no dependencies), waits for the page to finish and prints its timings.
//
//   node scripts/bench.mjs [url] [runs] [screenshot.png]
//   CHROME=google-chrome-stable node scripts/bench.mjs http://127.0.0.1:8090/spike 50

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url = "http://127.0.0.1:8090/spike", runs = "50", screenshot] = process.argv.slice(2);
const chrome = process.env.CHROME ?? "google-chrome-unstable";
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), "foja-bench-"));

const browser = spawn(chrome, [
  "--headless=new",
  "--no-first-run",
  "--disable-extensions",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--window-size=1600,1200",
  "about:blank",
], { stdio: "ignore" });

async function target() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await target());
await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
let nextId = 0;
const calls = new Map();
const consoleLines = [];
ws.addEventListener("message", ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id !== undefined) calls.get(msg.id)?.(msg);
  if (msg.method === "Runtime.consoleAPICalled") {
    consoleLines.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
  }
  if (msg.method === "Runtime.exceptionThrown") consoleLines.push(msg.params.exceptionDetails.text);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    calls.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;

try {
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: `${url}?bench=${runs}` });
  const deadline = Date.now() + 180_000;
  while ((await evaluate("document.title")) !== "bench-done") {
    if (Date.now() > deadline) {
      throw new Error(`timed out; status: ${await evaluate("document.querySelector('#status')?.textContent")}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(await evaluate("document.querySelector('#bench').textContent"));
  if (process.env.STATUS) console.log(await evaluate("document.querySelector('#status').textContent"));
  if (screenshot) {
    // Only the first page of the preview, at about 100 dpi.
    const clip = await evaluate(`(() => {
      const svg = document.querySelector("#preview svg");
      svg.style.maxWidth = "none";
      svg.style.width = "830px";
      const r = svg.getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.width * 297 / 210, scale: 1 };
    })()`);
    const { data } = await send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
    writeFileSync(screenshot, Buffer.from(data, "base64"));
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  if (consoleLines.length) console.error("console:\n" + consoleLines.join("\n"));
  ws.close();
  browser.kill();
  rmSync(profile, { recursive: true, force: true });
}
