/** @jsxImportSource solid-js */
import { ImageViewer } from "@rind-ui/solid"

/** A detailed floor plan (same-origin data URL), worth zooming into. */
const PLAN = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" font-family="sans-serif">
  <rect width="1600" height="1000" fill="#f7f4ee"/>
  <g fill="none" stroke="#2d3142" stroke-width="10">
    <rect x="80" y="80" width="1440" height="840"/>
    <path d="M620 80V520M620 640V920M80 520H460M560 520H1120M1220 520H1520M1120 80V420"/>
  </g>
  <g fill="#2d3142" font-size="34" font-weight="700">
    <text x="200" y="300">Living room</text><text x="760" y="300">Kitchen</text>
    <text x="1240" y="300">Study</text><text x="220" y="740">Bedroom</text>
    <text x="820" y="740">Bathroom</text><text x="1260" y="740">Bedroom 2</text>
  </g>
  <g fill="#5b6070" font-size="20">
    <text x="200" y="340">5.4 × 4.2 m</text><text x="760" y="340">4.8 × 4.2 m</text>
    <text x="1240" y="340">3.8 × 3.4 m</text><text x="220" y="780">5.2 × 3.8 m</text>
    <text x="820" y="780">2.6 × 3.8 m</text><text x="1260" y="780">3.8 × 3.8 m</text>
  </g>
  <g fill="#c9b79c"><rect x="160" y="380" width="240" height="90" rx="12"/><rect x="760" y="380" width="300" height="60"/><rect x="200" y="820" width="200" height="70" rx="8"/></g>
  <g fill="#8fb3a3"><circle cx="1400" cy="160" r="34"/><circle cx="520" cy="160" r="24"/></g>
</svg>`,
)}`

export function FloorPlan() {
  return (
    <div style={{ "inline-size": "min(100%, 560px)" }}>
      <ImageViewer.Root>
        <ImageViewer.Viewport style={{ "inline-size": "100%", "block-size": "320px" }}>
          <ImageViewer.Image src={PLAN} alt="Floor plan of the flat" />
        </ImageViewer.Viewport>
        <ImageViewer.ZoomOut />
        <ImageViewer.ZoomText />
        <ImageViewer.ZoomIn />
        <ImageViewer.Reset />
      </ImageViewer.Root>
    </div>
  )
}
