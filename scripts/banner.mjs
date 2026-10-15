// Renders the README banners (docs/media/banner-light.png, banner-dark.png) from the site's
// brand SVGs. The logo is provisional: replace apps/site/public/brand/* and run
// `node scripts/banner.mjs` to regenerate. Needs network for the Google Fonts.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { chromium } from "playwright"

const root = join(import.meta.dirname, "..")
const brand = (file) => readFileSync(join(root, "apps/site/public/brand", file), "utf8")

const TAGLINE = "Behaviour, accessibility and state.<br>The look is yours."
const PITCH = "Headless React components with test drivers built in."

// The library's own styling contract, as the banner's texture: every state a part exposes.
const CHIPS = [
  'data-state="open"',
  "data-focus-visible",
  'aria-expanded="true"',
  "data-highlighted",
  'data-state="checked"',
  "data-pressed",
  'aria-invalid="true"',
  "data-disabled",
  'data-orientation="vertical"',
  "data-hover",
]

const SCHEMES = {
  light: {
    bg: "#f5f5ee",
    ink: "#0b0b0c",
    muted: "#4a4a45",
    accent: "#d4ff3a",
    chip: "#0b0b0c",
    chipText: "#f5f5ee",
    chipSoft: "rgb(11 11 12 / 0.07)",
    chipSoftText: "#0b0b0c",
    pink: "#e0306f",
    wordmark: brand("rind-wordmark.svg"),
  },
  dark: {
    bg: "#0b0b0c",
    ink: "#f5f5ee",
    muted: "#a8a8a0",
    accent: "#d4ff3a",
    chip: "#d4ff3a",
    chipText: "#0b0b0c",
    chipSoft: "rgb(245 245 238 / 0.08)",
    chipSoftText: "#f5f5ee",
    pink: "#ff3d8b",
    wordmark: brand("rind-wordmark-on-dark.svg"),
  },
}

const html = (s) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;700&family=JetBrains+Mono:wght@500&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0 }
  body { width: 1600px; height: 560px; background: ${s.bg}; color: ${s.ink}; overflow: hidden;
    font-family: "Inter Tight", system-ui, sans-serif; position: relative }
  .copy { position: absolute; left: 96px; top: 50%; translate: 0 -50%; width: 760px }
  .wordmark svg { display: block; height: 128px; width: auto }
  h1 { margin-top: 44px; font-size: 40px; line-height: 1.12; font-weight: 700; letter-spacing: -0.02em }
  p { margin-top: 18px; font-size: 25px; line-height: 1.4; font-weight: 500; color: ${s.muted} }
  p b { color: ${s.pink}; font-weight: 700 }
  .field { position: absolute; right: 40px; top: 50%; width: 640px; translate: 0 -50%;
    display: flex; flex-wrap: wrap; justify-content: center; align-content: center; gap: 18px 14px;
    transform: rotate(-6deg) }
  .chip { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 22px; font-weight: 500;
    padding: 14px 22px; border-radius: 999px; background: ${s.chipSoft}; color: ${s.chipSoftText}; white-space: nowrap }
  .chip.on { background: ${s.chip}; color: ${s.chipText} }
  .chip.accent { background: ${s.accent}; color: #0b0b0c }
</style></head><body>
  <div class="field">${CHIPS.map(
    (c, i) => `<span class="chip${i === 1 ? " accent" : i % 3 === 0 ? " on" : ""}">${c}</span>`,
  ).join("")}</div>
  <div class="copy">
    <div class="wordmark">${s.wordmark}</div>
    <h1>${TAGLINE}</h1>
    <p>${PITCH.replace("test drivers", "<b>test drivers</b>")}</p>
  </div>
</body></html>`

const browser = await chromium.launch()
for (const [name, scheme] of Object.entries(SCHEMES)) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 560 },
    deviceScaleFactor: 2,
  })
  await page.setContent(html(scheme), { waitUntil: "networkidle" })
  await page.evaluate(() => document.fonts.ready)
  const out = join(root, "docs/media", `banner-${name}.png`)
  await page.screenshot({ path: out })
  await page.close()
  console.log(`wrote ${out}`)
}
await browser.close()
