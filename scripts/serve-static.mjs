// Serves a static export (the site, apps/site/out) for Playwright runs: node scripts/serve-static.mjs <dir> <port>
import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"

const root = resolve(process.argv[2] ?? "apps/site/out")
const port = Number(process.argv[3] ?? 6007)
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"))
  let file = join(root, path)
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html")
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" })
  createReadStream(file).pipe(res)
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`))
