// The server render carries the name, the value and the NVDA filler (add-progress 4.2).
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Progress, RindProvider } from "../index"

afterEach(() => vi.restoreAllMocks())

function html(node: React.ReactNode) {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  const out = renderToString(node)
  expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
  return out
}

describe("Progress server render", () => {
  it("labelled bar: progressbar named by the Label, value, filler span last", () => {
    const out = html(
      <Progress.Root value={40} id="up">
        <Progress.Label>Uploading</Progress.Label>
        <Progress.ValueText />
        <Progress.Track>
          <Progress.Indicator />
        </Progress.Track>
      </Progress.Root>,
    )
    expect(out).toMatch(/role="progressbar"/)
    expect(out).toMatch(/aria-labelledby="([^"]+)"[\s\S]*<span [^>]*id="\1"/)
    expect(out).toContain('aria-valuenow="40"')
    expect(out).toContain(">40%</span>")
    expect(out).toMatch(/<span role="presentation" style="[^"]*">x<\/span><\/div>$/)
    expect(out).not.toMatch(/aria-live|aria-label=/)
  })

  it("ring parts render as SVG with React attribute names (ARK#2589)", () => {
    const out = html(
      <Progress.Root value={25} aria-label="Sync">
        <Progress.Circle>
          <Progress.CircleTrack />
          <Progress.CircleIndicator />
        </Progress.Circle>
      </Progress.Root>,
    )
    expect(out).toMatch(/<svg [^>]*aria-hidden="true"[^>]*viewBox="0 0 100 100"/)
    expect(out).toMatch(/<circle [^>]*stroke-dashoffset="75"/)
    expect(out).toMatch(/<circle [^>]*pathLength="100"/)
  })

  it("provider locale formats the value text on the server (BU#4616)", () => {
    const out = html(
      <RindProvider locale="fr-FR">
        <Progress.Root value={40} aria-label="Envoi">
          <Progress.ValueText />
        </Progress.Root>
      </RindProvider>,
    )
    // French puts a (narrow) no-break space before the percent sign.
    expect(out).toMatch(/aria-valuetext="40\s%"[\s\S]*>40\s%<\/span>/u)
  })
})
