import { afterEach, describe, expect, it, vi } from "vitest"
import { hasTabbable, observeTabbable } from "./tabbable-content"

// Drain microtasks and two animation frames — no elapsed-time wait.
const settle = async () => {
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

function panel(html: string) {
  const el = document.createElement("div")
  el.innerHTML = html
  document.body.append(el)
  return el
}

describe("hasTabbable", () => {
  it("text only is not tabbable; a form control, button, link or tabindex=0 is", () => {
    expect(hasTabbable(panel("just text <b>bold</b>"))).toBe(false)
    for (const html of [
      "<input />",
      "<button>x</button>",
      '<a href="#x">x</a>',
      '<span tabindex="0">x</span>',
      "<select></select>",
      "<textarea></textarea>",
    ]) {
      expect(hasTabbable(panel(html)), html).toBe(true)
    }
  })

  it("disabled, tabindex=-1, hidden-input and hidden descendants do not count", () => {
    for (const html of [
      "<button disabled>x</button>",
      "<input disabled />",
      '<button tabindex="-1">x</button>',
      '<input type="hidden" />',
      "<div hidden><button>x</button></div>",
      "<div inert><button>x</button></div>",
      "<a>no href</a>",
    ]) {
      expect(hasTabbable(panel(html)), html).toBe(false)
    }
  })
})

describe("observeTabbable", () => {
  it("reports now, then only on change: text only → form → text only", async () => {
    const el = panel("text")
    const onChange = vi.fn()
    const stop = observeTabbable(el, onChange)
    expect(onChange.mock.calls).toEqual([[false]])
    // A change that does not alter the answer reports nothing.
    el.append(document.createTextNode(" more"))
    await settle()
    expect(onChange).toHaveBeenCalledTimes(1)
    const input = document.createElement("input")
    el.append(input)
    await settle()
    expect(onChange.mock.calls).toEqual([[false], [true]])
    // A second tabbable element: still true, no report.
    el.append(document.createElement("button"))
    await settle()
    expect(onChange).toHaveBeenCalledTimes(2)
    el.querySelector("button")?.remove()
    await settle()
    expect(onChange).toHaveBeenCalledTimes(2)
    input.remove()
    await settle()
    expect(onChange.mock.calls).toEqual([[false], [true], [false]])
    stop()
  })

  it("attribute changes count: disabled and tabindex=-1 turn it off, removing them on", async () => {
    const el = panel("<button>x</button>")
    const button = el.querySelector("button") as HTMLButtonElement
    const onChange = vi.fn()
    const stop = observeTabbable(el, onChange)
    expect(onChange.mock.calls).toEqual([[true]])
    button.disabled = true
    await settle()
    expect(onChange.mock.calls.at(-1)).toEqual([false])
    button.disabled = false
    await settle()
    expect(onChange.mock.calls.at(-1)).toEqual([true])
    button.setAttribute("tabindex", "-1")
    await settle()
    expect(onChange.mock.calls.at(-1)).toEqual([false])
    expect(onChange).toHaveBeenCalledTimes(4)
    stop()
  })

  it("the disconnect stops reports", async () => {
    const el = panel("text")
    const onChange = vi.fn()
    observeTabbable(el, onChange)()
    el.append(document.createElement("input"))
    await settle()
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
