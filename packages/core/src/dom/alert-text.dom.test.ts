// add-alert 2.2: the announced segments read from the DOM, and the observer that reports
// only real text changes.
import { afterEach, describe, expect, it } from "vitest"
import { announceableText, observeText } from "./alert-text"

const hosts: HTMLElement[] = []
afterEach(() => {
  for (const h of hosts.splice(0)) h.remove()
})

function mount(html: string): HTMLElement {
  const host = document.createElement("div")
  host.innerHTML = html
  document.body.append(host)
  hosts.push(host)
  return host.firstElementChild as HTMLElement
}

const p = (part: string, inner: string, extra = "") =>
  `<div data-scope="alert" data-part="${part}" data-instance="a" ${extra}>${inner}</div>`

describe("announceableText", () => {
  it("labelled Icon, Title, Description in order; CloseTrigger and aria-hidden skipped", () => {
    const root = mount(
      p(
        "root",
        `<span data-scope="alert" data-part="icon" data-instance="a" role="img" aria-label="Error"></span>${p("title", "Couldn't <b>save</b>")}${p("description", 'Disk <span aria-hidden="true">💾</span> full')}<button data-scope="alert" data-part="close-trigger" data-instance="a">Dismiss</button>`,
      ),
    )
    expect(announceableText(root)).toEqual(["Error", "Couldn't save", "Disk full"])
  })

  it("a decorative icon adds nothing; hidden text is skipped, visually hidden kept", () => {
    const root = mount(
      p(
        "root",
        `<span data-scope="alert" data-part="icon" data-instance="a" aria-hidden="true">!</span>${p("title", 'Saved <span hidden>old</span><span style="position:absolute;clip:rect(0 0 0 0)">now</span>')}`,
      ),
    )
    expect(announceableText(root)).toEqual(["Saved now"])
  })

  it("Root text when neither Title nor Description is rendered", () => {
    const root = mount(
      p(
        "root",
        `Plain <em>text</em><button data-scope="alert" data-part="close-trigger" data-instance="a">x</button>`,
      ),
    )
    expect(announceableText(root)).toEqual(["Plain text"])
  })

  it("ignores another alert's parts nested inside", () => {
    const root = mount(
      p(
        "root",
        `${p("title", "Outer")}<div data-scope="alert" data-part="title" data-instance="b">Inner</div>`,
      ),
    )
    expect(announceableText(root)).toEqual(["Outer"])
  })
})

describe("observeText", () => {
  it("reports a changed text once per batch, never an unchanged one", async () => {
    const root = mount(p("root", p("title", "Reconnecting…")))
    const seen: string[][] = []
    const stop = observeText(root, (s) => seen.push(s))
    const title = root.querySelector('[data-part="title"]') as HTMLElement
    // A rewrite to the same text is not a change.
    title.textContent = "Reconnecting…"
    await new Promise<void>((r) => queueMicrotask(r))
    expect(seen).toEqual([])
    title.textContent = "Connected"
    await new Promise<void>((r) => queueMicrotask(r))
    expect(seen).toEqual([["Connected"]])
    stop()
    title.textContent = "Gone"
    await new Promise<void>((r) => queueMicrotask(r))
    expect(seen).toHaveLength(1)
  })

  it("hiding a segment is a change", async () => {
    const root = mount(p("root", `${p("title", "Saved")}${p("description", "3 files")}`))
    const seen: string[][] = []
    const stop = observeText(root, (s) => seen.push(s))
    root.querySelector('[data-part="description"]')?.setAttribute("hidden", "")
    await new Promise<void>((r) => queueMicrotask(r))
    expect(seen).toEqual([["Saved"]])
    stop()
  })
})
