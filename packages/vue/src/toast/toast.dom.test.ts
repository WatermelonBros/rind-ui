// Toast against the Vue parts: the toaster region's contract model (React's), the main
// scenarios through the drivers (region, announcement, close trigger, Escape, F6, action) and
// markup parity.
import { createToaster, type Toaster as ToasterStore, toasterContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { getToast, installAnnouncementLog, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { userEvent } from "@testing-library/user-event"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, expect, it, vi } from "vitest"
import { h, nextTick } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Toast, Toaster } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const app =
  (store: ToasterStore, portal = true) =>
  () => [
    h("input", { "aria-label": "Name" }),
    h(
      Toaster,
      { toaster: store, portal },
      {
        default: (t: { data: { description?: unknown; action?: unknown } }) =>
          h(Toast.Root, null, () => [
            h(Toast.Title),
            t.data.description ? h(Toast.Description) : null,
            t.data.action ? h(Toast.ActionTrigger) : null,
            h(Toast.CloseTrigger, null, () =>
              h("svg", { "aria-hidden": "true", width: 12, height: 12 }),
            ),
          ]),
      },
    ),
  ]
const reactApp = (store: ToasterStore, portal = true) =>
  r(
    "div",
    null,
    r("input", { "aria-label": "Name" }),
    r(
      R.Toaster,
      { toaster: store, portal } as never,
      // The toast's markup is the Toaster's function child.
      ((t: { data: { description?: unknown; action?: unknown } }) =>
        r(
          R.Toast.Root,
          null,
          r(R.Toast.Title),
          t.data.description ? r(R.Toast.Description) : null,
          t.data.action ? r(R.Toast.ActionTrigger) : null,
          r(R.Toast.CloseTrigger, null, r("svg", { "aria-hidden": "true", width: 12, height: 12 })),
        )) as never,
    ),
  )

describe("vue toaster model", () => {
  testMachine(toasterContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    // The region renders after mount (no toast on the server): the run starts once it shows.
    setup: async () => {
      const store = createToaster({ duration: Number.POSITIVE_INFINITY })
      store.show({ title: "Saved", description: "3 files" })
      store.show({ title: "Archived" })
      const rendered = mount(() =>
        h("div", null, [
          h("input", { "aria-label": "Name" }),
          h(
            Toaster,
            { toaster: store },
            {
              default: () =>
                h(Toast.Root, null, () => [
                  h(Toast.Title),
                  h(Toast.CloseTrigger, null, () => "Dismiss"),
                ]),
            },
          ),
        ]),
      )
      await screen.findByRole("region", { name: "Notifications (F6)" })
      return rendered
    },
    target: () => screen,
    anchor: [{ name: "Notifications (F6)" }] as never,
    props: { expand: false } as never,
    modalities: ["pointer", "keyboard", "virtual"],
    a11y,
  })
})

describe("vue toast", () => {
  it("no region while empty (zag#2988); a named region with a list once a toast shows", async () => {
    const store = createToaster()
    mount(() => h("div", null, app(store)()))
    expect(screen.queryByRole("region")).toBe(null)
    store.show({ title: "Saved", description: "3 files" })
    const region = await screen.findByRole("region", { name: "Notifications (F6)" })
    expect(region.querySelector("ol")).toBeTruthy()
    const item = screen.getByRole("listitem", { name: "Saved" })
    expect(item.getAttribute("tabindex")).toBe("0")
  })

  it("one polite announcement: 'Saved. 3 files' (reka-ui#2611)", async () => {
    const log = installAnnouncementLog()
    const start = log.length
    const store = createToaster()
    mount(() => h("div", null, app(store)()))
    await nextTick()
    store.show({ title: "Saved", description: "3 files" })
    await screen.findByRole("listitem", { name: "Saved" })
    await vi.waitFor(() =>
      expect(log.slice(start).map((a) => a.message)).toEqual(["Saved. 3 files"]),
    )
  })

  it("the close trigger dismisses with reason close-trigger; an icon-only one is named", async () => {
    const store = createToaster()
    const onDismiss = vi.fn()
    mount(() => h("div", null, app(store)()))
    await nextTick()
    store.show({ title: "Saved", onDismiss })
    await screen.findByRole("listitem", { name: "Saved" })
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Dismiss notification" })).toBeTruthy(),
    )
    await getToast(screen, { name: "Saved" }).via("pointer").dismiss()
    expect(onDismiss).toHaveBeenCalledWith("close-trigger")
  })

  it("Escape closes only the focused toast (radix#2906)", async () => {
    const store = createToaster({ duration: Number.POSITIVE_INFINITY })
    mount(() => h("div", null, app(store)()))
    await nextTick()
    store.show("First")
    store.show("Second")
    store.show("Third")
    await screen.findByRole("listitem", { name: "First" })
    await getToast(screen, { name: "First" }).via("keyboard").dismiss()
    await vi.waitFor(() => expect(screen.queryByRole("listitem", { name: "First" })).toBe(null))
    expect(screen.getByRole("listitem", { name: "Second" })).toBeTruthy()
    expect(screen.getByRole("listitem", { name: "Third" })).toBeTruthy()
  })

  it("F6 jumps to the newest toast and back (Jump in and back)", async () => {
    const user = userEvent.setup()
    const store = createToaster({ duration: Number.POSITIVE_INFINITY })
    mount(() => h("div", null, app(store)()))
    await nextTick()
    store.show("Older")
    store.show("Newer")
    await screen.findByRole("listitem", { name: "Newer" })
    const name = screen.getByRole("textbox", { name: "Name" })
    name.focus()
    await user.keyboard("{F6}")
    expect(document.activeElement).toBe(screen.getByRole("listitem", { name: "Newer" }))
    await user.keyboard("{F6}")
    expect(document.activeElement).toBe(name)
  })

  it("the action runs; closes:false keeps it (reka-ui#2626)", async () => {
    const store = createToaster()
    const onAction = vi.fn()
    mount(() => h("div", null, app(store)()))
    await nextTick()
    store.show({ title: "Archived", action: { label: "Undo", onAction, closes: false } })
    await screen.findByRole("listitem", { name: "Archived" })
    await userEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("listitem", { name: "Archived" })).toBeTruthy()
  })
})

describe("Vue Toast matches React", () => {
  it("title, description and action", async () => {
    // Each side its own store: a toast shown once, never timing out.
    const store = () => {
      const s = createToaster({ duration: Number.POSITIVE_INFINITY })
      s.show({ title: "Saved", description: "3 files" })
      s.show({ title: "Archived", action: { label: "Undo", onAction: () => {} } })
      return s
    }
    await clientParity(reactApp(store(), false), () => h("div", null, app(store(), false)()))
  })
})
