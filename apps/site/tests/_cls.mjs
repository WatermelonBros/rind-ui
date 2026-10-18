import { readFile, stat } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join } from "node:path"
import { chromium } from "playwright"

const root = new URL("../out/", import.meta.url).pathname
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".txt": "text/plain",
}
const server = createServer(async (req, res) => {
  let p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname))
  try {
    if ((await stat(p)).isDirectory()) p = join(p, "index.html")
  } catch {
    p += ".html"
  }
  try {
    res.writeHead(200, { "content-type": types[extname(p)] ?? "application/octet-stream" })
    res.end(await readFile(p))
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((ok) => server.listen(4555, ok))
const b = await chromium.launch()
for (const intro of [false, true]) {
  const p = await b.newPage({ viewport: { width: 1350, height: 940 } })
  if (intro) await p.addInitScript(() => sessionStorage.setItem("rind-intro", "1"))
  await p.addInitScript(() => {
    window.__shifts = []
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (!e.hadRecentInput)
          window.__shifts.push({
            t: Math.round(e.startTime),
            v: +e.value.toFixed(4),
            src: e.sources.map(
              (s) =>
                (s.node?.nodeName ?? "?") +
                "." +
                (s.node?.className?.toString?.().slice(0, 40) ?? "") +
                " " +
                JSON.stringify(
                  [
                    s.previousRect.y,
                    s.currentRect.y,
                    s.previousRect.height,
                    s.currentRect.height,
                  ].map(Math.round),
                ),
            ),
          })
    }).observe({ type: "layout-shift", buffered: true })
  })
  await p.goto("http://localhost:4555/", { waitUntil: "load" })
  await p.waitForTimeout(6000)
  const s = await p.evaluate(() => window.__shifts)
  console.log("intro-skipped=" + intro, "CLS", s.reduce((a, e) => a + e.v, 0).toFixed(3))
  for (const e of s) console.log(" ", e.t, e.v, e.src.slice(0, 3).join(" | "))
  await p.close()
}
await b.close()
server.close()
