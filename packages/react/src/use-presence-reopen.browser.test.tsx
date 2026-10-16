// Reopen during the exit (backlog: "presence: reopen during exit can mount a new element",
// CI Linux). Deterministic: the exit animation is held by pausing it, so the reopen always
// lands while it runs, however slow the machine.
import { render } from "@testing-library/react"
import { useRef } from "react"
import { expect, it } from "vitest"
import { usePresence } from "./use-presence"

function Part({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const { mounted } = usePresence(open, ref)
  if (!mounted) return null
  return (
    <div ref={ref} data-testid="part" data-state={open ? "open" : "closed"}>
      content
    </div>
  )
}

const css = `
  [data-testid="part"] { transition: opacity 150ms; }
  [data-testid="part"][data-state="closed"] { opacity: 0; }
`

const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

it("reopening while the exit animation runs keeps the same element", async () => {
  const style = document.createElement("style")
  style.textContent = css
  document.head.append(style)
  const { rerender, getByTestId, unmount } = render(<Part open />)
  const before = getByTestId("part")
  // A transition needs a computed starting style (an app always has frames in between).
  getComputedStyle(before).opacity
  rerender(<Part open={false} />)
  await frame()
  const running = document.getAnimations().filter((a) => a.playState === "running")
  expect(running.length).toBeGreaterThan(0)
  for (const a of running) a.pause() // hold the exit, as a slow run would stretch it
  rerender(<Part open />)
  await frame()
  expect(getByTestId("part")).toBe(before)
  expect(before.getAttribute("data-state")).toBe("open")
  for (const a of running) a.play()
  unmount()
  style.remove()
})

it("reopening after the exit ended mounts a new element (the race the runner now holds)", async () => {
  const style = document.createElement("style")
  style.textContent = css
  document.head.append(style)
  const { rerender, queryByTestId, getByTestId, unmount } = render(<Part open />)
  const before = getByTestId("part")
  getComputedStyle(before).opacity
  rerender(<Part open={false} />)
  await expect.poll(() => queryByTestId("part")).toBeNull()
  rerender(<Part open />)
  expect(getByTestId("part")).not.toBe(before)
  unmount()
  style.remove()
})
