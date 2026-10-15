// add-toolbar 5.4 (spec "Performance"): moving focus re-renders at most the two controls
// whose tab-stop state changed. A Profiler around each control counts its commits.
import { Toolbar } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Profiler } from "react"
import { expect, it } from "vitest"

it("each ArrowRight over 30 buttons re-renders at most two controls", async () => {
  const counts = new Map<string, number>()
  const names = Array.from({ length: 30 }, (_, i) => `B${i}`)
  // Built once: the same element identities across the root's renders.
  const controls = names.map((n) => (
    <Profiler
      key={n}
      id={n}
      onRender={(id) => {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }}
    >
      <Toolbar.Button id={n}>{n}</Toolbar.Button>
    </Profiler>
  ))
  render(<Toolbar.Root aria-label="Many">{controls}</Toolbar.Root>)
  const user = userEvent.setup()
  screen.getByRole("button", { name: "B0" }).focus()
  await user.keyboard("{ArrowRight}")
  counts.clear()
  for (let i = 2; i <= 6; i++) {
    const before = new Map(counts)
    await user.keyboard("{ArrowRight}")
    const rendered = names.filter((n) => (counts.get(n) ?? 0) > (before.get(n) ?? 0))
    expect(rendered.length, `move to B${i} re-rendered ${rendered.join(", ")}`).toBeLessThanOrEqual(
      2,
    )
  }
})
