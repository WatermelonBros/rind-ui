// Progress through its driver (add-progress 5.3): queries, indeterminate, the completion
// announcement, no live region, and the name rules. Runs in jsdom and in real browsers.
import { Progress, type ProgressRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { getProgress } from "../index"

afterEach(() => vi.restoreAllMocks())

function Upload(props: ProgressRootProps) {
  return (
    <Progress.Root {...props}>
      <Progress.Label>Uploading</Progress.Label>
      <Progress.ValueText />
      <Progress.Track>
        <Progress.Indicator />
      </Progress.Track>
    </Progress.Root>
  )
}

describe("Progress driver", () => {
  it("reads a determinate bar (spec: Default markup)", async () => {
    render(<Upload value={40} />)
    const p = getProgress(screen, { name: "Uploading" })
    expect(await p.name()).toBe("Uploading")
    expect(await p.value()).toBe(40)
    expect(await p.valueText()).toBe("40%")
    expect(await p.percent()).toBe(40)
    expect(await p.state()).toBe("loading")
    expect(screen.getAllByRole("progressbar")).toHaveLength(1)
  })

  it("indeterminate: value() is null (spec: Driver reads indeterminate)", async () => {
    const error = vi.spyOn(console, "error")
    render(<Upload value={undefined} />)
    const p = getProgress(screen, { name: "Uploading" })
    expect(await p.value()).toBeNull()
    expect(await p.state()).toBe("indeterminate")
    expect(await p.percent()).toBeNull()
    expect(error).not.toHaveBeenCalled()
  })

  it("custom range: 2 of 8 is 25% with valuenow 2", async () => {
    render(<Upload value={2} max={8} />)
    const p = getProgress(screen, { name: "Uploading" })
    expect(await p.value()).toBe(2)
    expect(await p.valueText()).toBe("25%")
  })

  it("announces Complete once on 40 → 90 → 100, never a live region", async () => {
    const { rerender } = render(<Upload value={40} announceCompletion />)
    const p = getProgress(screen, { name: "Uploading" })
    expect(await p.announcements()).toEqual([])
    rerender(<Upload value={90} announceCompletion />)
    rerender(<Upload value={100} announceCompletion />)
    const said = await p.announcements()
    expect(said.map((a) => a.message)).toEqual(["Complete"])
    const root = screen.getByRole("progressbar")
    expect(root.closest("[aria-live]")).toBeNull()
    expect(root.querySelector("[aria-live]")).toBeNull()
    expect(await p.state()).toBe("complete")
  })

  it("mounted complete: no announcement", async () => {
    render(<Upload value={100} announceCompletion />)
    expect(await getProgress(screen, { name: "Uploading" }).announcements()).toEqual([])
  })

  it("no flood: 50 changes announce nothing", async () => {
    const { rerender } = render(<Upload value={0} announceCompletion />)
    const p = getProgress(screen, { name: "Uploading" })
    await p.announcements()
    for (let v = 1; v <= 50; v += 1) rerender(<Upload value={v} announceCompletion />)
    expect(await p.announcements()).toEqual([])
  })

  it("unnamed: a development error; decorative (aria-hidden) is fine (RS#9987)", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const { unmount } = render(<Progress.Root value={10} aria-hidden="true" />)
    expect(error).not.toHaveBeenCalled()
    unmount()
    render(<Progress.Root value={10} />)
    expect(error.mock.calls[0]?.[0]).toMatch(/progress: Root has no accessible name/)
  })

  it("aria-label replaces the Label relation", async () => {
    render(<Progress.Root value={10} aria-label="Sync" />)
    const root = screen.getByRole("progressbar", { name: "Sync" })
    expect(root.getAttribute("aria-labelledby")).toBeNull()
  })

  it("vertical: data-orientation on every part, no aria-orientation, block-size fill", () => {
    render(<Upload value={30} orientation="vertical" />)
    const root = screen.getByRole("progressbar")
    expect(root.getAttribute("aria-orientation")).toBeNull()
    for (const el of root.querySelectorAll("[data-scope=progress]")) {
      expect(el.getAttribute("data-orientation")).toBe("vertical")
    }
    const ind = root.querySelector<HTMLElement>("[data-part=indicator]")
    expect(ind?.style.blockSize).toBe("30%")
    expect(ind?.style.getPropertyValue("--rind-progress-percent")).toBe("30")
  })

  it("nvda-progressbar-name: Root's last child is the presentational filler", () => {
    render(<Upload value={40} />)
    const last = screen.getByRole("progressbar").lastElementChild
    expect(last?.getAttribute("role")).toBe("presentation")
    expect(last?.textContent).toBe("x")
  })
})
