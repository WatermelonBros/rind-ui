// add-theme-system I.2 (react-adapter "Reserved Theme Attributes"): parts forward
// data-variant / data-size / data-tone unchanged, also through `render`; connect never emits
// them. No shipped component exists yet, so the parts under test are the library's own
// (VisuallyHidden, Portal) and the disclosure fixture, which supports `render` on every part;
// `renderPart` is the shared mechanism behind all of them.
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { connect } from "../../testing/fixtures/disclosure/disclosure.connect"
import { Disclosure } from "../../testing/fixtures/disclosure/disclosure.react"
import { LayerExample } from "../../testing/fixtures/layer/layer.fixture"
import { Portal } from "./portal"
import { renderPart } from "./render"
import { VisuallyHidden } from "./visually-hidden"

const reserved = { "data-variant": "outline", "data-size": "sm", "data-tone": "danger" } as const
const reservedSelector = "[data-variant],[data-size],[data-tone]"
const carried = (el: Element) => ({
  "data-variant": el.getAttribute("data-variant"),
  "data-size": el.getAttribute("data-size"),
  "data-tone": el.getAttribute("data-tone"),
})

describe("Reserved Theme Attributes", () => {
  it("Variant reaches the DOM (every part of the disclosure fixture)", () => {
    render(
      <Disclosure.Root {...reserved} defaultOpen>
        <Disclosure.Trigger {...reserved}>Toggle</Disclosure.Trigger>
        <Disclosure.Content {...reserved}>body</Disclosure.Content>
      </Disclosure.Root>,
    )
    for (const part of ["root", "trigger", "content"]) {
      const el = document.querySelector(`[data-scope="disclosure"][data-part="${part}"]`)
      expect(el, part).not.toBeNull()
      expect(carried(el as Element), part).toEqual(reserved)
    }
  })

  it("behaviour is identical with and without the attributes", async () => {
    const user = userEvent.setup()
    const state = async (props: object) => {
      const { unmount } = render(
        <Disclosure.Root>
          <Disclosure.Trigger {...props}>Toggle</Disclosure.Trigger>
          <Disclosure.Content>body</Disclosure.Content>
        </Disclosure.Root>,
      )
      const trigger = screen.getByRole("button", { name: "Toggle" })
      const seen = [trigger.getAttribute("aria-expanded")]
      await user.click(trigger)
      seen.push(trigger.getAttribute("aria-expanded"))
      await user.click(trigger)
      seen.push(trigger.getAttribute("aria-expanded"))
      unmount()
      return seen
    }
    expect(await state(reserved)).toEqual(await state({}))
    expect(await state({})).toEqual(["false", "true", "false"])
  })

  it("Render substitution", async () => {
    const user = userEvent.setup()
    render(
      <Disclosure.Root defaultOpen render={<section {...reserved} />}>
        <Disclosure.Trigger {...reserved} render={<a href="#x" />}>
          Toggle
        </Disclosure.Trigger>
        <Disclosure.Content {...reserved} render={<article />}>
          body
        </Disclosure.Content>
      </Disclosure.Root>,
    )
    const anchor = document.querySelector("a[href='#x']")
    expect(anchor).not.toBeNull()
    expect(carried(anchor as Element)).toEqual(reserved)
    // The substituted trigger still works: behaviour does not depend on the element.
    await user.click(anchor as Element)
    expect(anchor?.getAttribute("aria-expanded")).toBe("false")
    expect(carried(document.querySelector("article") as Element)).toEqual(reserved)
    expect(document.querySelector("section")).not.toBeNull()
    expect(carried(document.querySelector("section") as Element)).toEqual(reserved)
  })

  it("VisuallyHidden forwards them, with and without render", () => {
    render(
      <>
        <VisuallyHidden {...reserved}>plain</VisuallyHidden>
        <VisuallyHidden {...reserved} render={<a href="/y" />}>
          anchor
        </VisuallyHidden>
      </>,
    )
    expect(carried(screen.getByText("plain"))).toEqual(reserved)
    const anchor = screen.getByText("anchor")
    expect(anchor.tagName).toBe("A")
    expect(carried(anchor)).toEqual(reserved)
  })

  it("Portal forwards them to its host, with and without render", () => {
    render(
      <>
        <Portal {...reserved}>plain</Portal>
        <Portal {...reserved} render={<section />}>
          rendered
        </Portal>
      </>,
    )
    const hosts = document.querySelectorAll("[data-rind-portal]")
    expect(hosts).toHaveLength(2)
    for (const host of hosts) expect(carried(host)).toEqual(reserved)
    expect(hosts[1]?.tagName).toBe("SECTION")
  })

  it("renderPart (the shared helper) forwards them to a function render too", () => {
    render(renderPart("div", reserved, (props) => <a href="/z" {...props} />, undefined) as never)
    expect(carried(document.querySelector("a[href='/z']") as Element)).toEqual(reserved)
  })

  it("connect never emits them (disclosure, in every state)", () => {
    for (const open of [true, false]) {
      for (const revealed of [true, false]) {
        const api = connect(
          { open, revealed, hiddenUntilFound: true, triggerFocused: true, modality: "keyboard" },
          () => {},
          { root: "r", rendered: { content: "c" } },
        )
        for (const part of [api.root(), api.trigger(), api.content()]) {
          expect(Object.keys(part).filter((k) => /^data-(variant|size|tone)$/.test(k))).toEqual([])
        }
      }
    }
  })

  it("nothing a fixture renders carries them unless the consumer passed them", async () => {
    const user = userEvent.setup()
    render(
      <>
        <Disclosure.Root>
          <Disclosure.Trigger>Toggle</Disclosure.Trigger>
          <Disclosure.Content>body</Disclosure.Content>
        </Disclosure.Root>
        <LayerExample />
      </>,
    )
    expect(document.querySelectorAll(reservedSelector)).toHaveLength(0)
    await user.click(screen.getByRole("button", { name: "Toggle" }))
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(document.querySelectorAll(reservedSelector)).toHaveLength(0)
  })
})
