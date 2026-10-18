// Text Field through its driver: runs unchanged in jsdom and in real browsers. Presses go
// through drivers (a raw userEvent.click makes a zero-size pointer that the modality tracker
// treats as assistive technology).
import { domEnvironment } from "@rind-ui/core"
import { Button, Field, FieldHost, HostLabel, TextField } from "@rind-ui/react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FieldInput } from "../../fixtures/field/field-input"
// The shared host helper is not part of the public barrel (Number/Pin/Password/Search use it).
import { composeInPage } from "../adapters/compose"
import { getButton, getTextField, installAnnouncementLog } from "../index"

const platform = domEnvironment().platform
const inJsdom = navigator.userAgent.includes("jsdom")
const opts = { platform }
const field = (name: string) => getTextField(screen, { name }, opts)
const button = (name: string) => getButton(screen, { name }, opts)
const control = () => screen.getByRole("textbox") as HTMLInputElement | HTMLTextAreaElement
const root = () => document.querySelector('[data-part="root"]') as HTMLElement

/** The user-visible effect of a browser autofill / paste: the native setter plus `input`. */
function setNative(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement
  Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(el, value)
  act(() => {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }))
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Fake only the timers (the announcer debounce); frames and microtasks stay real. */
const fakeTimers = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
/** Advances fake time, then lets the announcer's frame run (rAF stays real). */
const advance = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms)
    await frame()
    await frame()
  })

describe("TextField anatomy", () => {
  it("standalone: label for, value, clear keeps focus, count", async () => {
    const onValueChange = vi.fn()
    render(
      <TextField.Root onValueChange={onValueChange}>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input maxLength={10} />
        <TextField.ClearTrigger />
        <TextField.CharacterCount />
      </TextField.Root>,
    )
    const t = field("Name")
    expect(await t.name()).toBe("Name")
    expect(document.querySelector("label")?.getAttribute("for")).toBe(control().id)
    await t.type("abc")
    expect(await t.value()).toBe("abc")
    expect(onValueChange).toHaveBeenLastCalledWith(
      "abc",
      expect.objectContaining({ reason: "INPUT" }),
    )
    expect(await t.characterCount()).toBe("3/10")
    expect(await t.isClearable()).toBe(true)
    await t.clear()
    expect(await t.value()).toBe("")
    expect(onValueChange).toHaveBeenLastCalledWith("", expect.objectContaining({ reason: "CLEAR" }))
    expect(document.activeElement).toBe(control())
    expect(await t.isClearable()).toBe(false)
    expect(document.querySelector('[data-part="label"]')?.getAttribute("data-scope")).toBe(
      "text-field",
    )
  })

  it("inside a Field: registered control, the Field names it, no own Label", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <form>
        <Field.Root required>
          <Field.Label>Email</Field.Label>
          <TextField.Root>
            <TextField.Label>Own</TextField.Label>
            <TextField.Input type="email" />
          </TextField.Root>
          <Field.ErrorMessage />
        </Field.Root>
        <Button type="submit">Send</Button>
      </form>,
    )
    const t = field("Email")
    expect(await t.name()).toBe("Email")
    expect(screen.queryByText("Own")).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/not rendered inside a Field/))
    await t.type("abc")
    await button("Send").press()
    expect(await t.isInvalid()).toBe(true)
    expect(document.activeElement).toBe(control())
  })

  it("dev error for zero and for two controls", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const none = render(
      <TextField.Root>
        <TextField.Label>A</TextField.Label>
      </TextField.Root>,
    )
    expect(error.mock.calls.flat().join(" ")).toMatch(/renders 0 Input\/Textarea/)
    none.unmount()
    error.mockClear()
    render(
      <TextField.Root>
        <TextField.Input aria-label="a" />
        <TextField.Textarea aria-label="b" />
      </TextField.Root>,
    )
    expect(error.mock.calls.flat().join(" ")).toMatch(/renders 2 Input\/Textarea/)
  })
})

describe("Shared Field host", () => {
  it("standalone: the host's Label is the Field's under its own scope", async () => {
    render(
      <FieldHost scope="text-field">
        <HostLabel>Search</HostLabel>
        <FieldInput />
      </FieldHost>,
    )
    const label = document.querySelector("label")
    expect(label?.getAttribute("data-scope")).toBe("text-field")
    expect(label?.getAttribute("for")).toBe(control().id)
    expect(screen.getByRole("textbox", { name: "Search" })).toBe(control())
  })

  it("inside a Field: no own Label, the Field names it, with a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <Field.Root>
        <Field.Label>Query</Field.Label>
        <FieldHost scope="text-field">
          <HostLabel>Search</HostLabel>
          <FieldInput />
        </FieldHost>
      </Field.Root>,
    )
    expect(document.querySelector('label[data-scope="text-field"]')).toBeNull()
    expect(screen.queryByText("Search")).toBeNull()
    expect(screen.getByRole("textbox", { name: "Query" })).toBe(control())
    expect(warn).toHaveBeenCalled()
    expect(document.querySelector('[data-scope="text-field"][data-part="root"]')).not.toBeNull()
  })
})

describe("Value", () => {
  it("autofill is reported with reason INPUT and sets data-filled", async () => {
    const onValueChange = vi.fn()
    render(
      <TextField.Root onValueChange={onValueChange}>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
      </TextField.Root>,
    )
    expect(control().hasAttribute("data-filled")).toBe(false)
    setNative(control(), "Ada")
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(
      "Ada",
      expect.objectContaining({ reason: "INPUT", isComposing: false }),
    )
    await waitFor(() => expect(control().hasAttribute("data-filled")).toBe(true))
  })

  it("React 19 action reset shows the defaultValue; the Field is no longer filled", async () => {
    const action = vi.fn(async () => {})
    render(
      <form action={action}>
        <TextField.Root>
          <TextField.Label>Notes</TextField.Label>
          <TextField.Textarea />
        </TextField.Root>
        <Button type="submit">Send</Button>
      </form>,
    )
    const t = field("Notes")
    await t.type("hello")
    await waitFor(() => expect(control().hasAttribute("data-filled")).toBe(true))
    await button("Send").press()
    await waitFor(() => expect(action).toHaveBeenCalled())
    await waitFor(() => expect(control().value).toBe(""))
    await waitFor(() => expect(control().hasAttribute("data-filled")).toBe(false))
  })

  it("latest default on reset: a changed defaultValue prop shows after form reset, no warning", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const ui = (defaultValue: string) => (
      <form>
        <TextField.Root defaultValue={defaultValue}>
          <TextField.Label>Name</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <Button type="reset">Reset</Button>
      </form>
    )
    const { rerender } = render(ui("one"))
    const t = field("Name")
    await t.type("xyz")
    rerender(ui("two"))
    await button("Reset").press()
    await waitFor(() => expect(control().value).toBe("two"))
    expect([...error.mock.calls, ...warn.mock.calls]).toEqual([])
  })

  it("controlled: abc then null renders empty", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const ui = (value: string | null) => (
      <TextField.Root value={value} onValueChange={() => {}}>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
      </TextField.Root>
    )
    const { rerender } = render(ui("abc"))
    expect(control().value).toBe("abc")
    rerender(ui(null))
    expect(control().value).toBe("")
    expect(error.mock.calls.flat().join(" ")).not.toMatch(/value.*prop|uncontrolled|controlled/i)
  })

  it("onChange gets the native event and onValueChange the string, both fire", async () => {
    const onChange = vi.fn()
    const onValueChange = vi.fn()
    render(
      <TextField.Root onValueChange={onValueChange}>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input onChange={onChange} />
      </TextField.Root>,
    )
    await field("Name").type("a")
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0]?.[0]?.target).toBe(control())
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange.mock.calls[0]?.[0]).toBe("a")
  })

  it("a controlled parent that applies each proposal keeps the typed value", async () => {
    function Controlled() {
      const [v, setV] = useState("")
      return (
        <TextField.Root value={v} onValueChange={setV}>
          <TextField.Label>Name</TextField.Label>
          <TextField.Input />
        </TextField.Root>
      )
    }
    render(<Controlled />)
    await field("Name").type("abc")
    expect(control().value).toBe("abc")
  })
})

describe("Textarea attributes", () => {
  it("forwards rows and wrap (react-spectrum#1178)", () => {
    render(
      <TextField.Root>
        <TextField.Label>Bio</TextField.Label>
        <TextField.Textarea rows={4} wrap="hard" />
      </TextField.Root>,
    )
    expect(control().getAttribute("rows")).toBe("4")
    expect(control().getAttribute("wrap")).toBe("hard")
  })
})

describe("IME composition", () => {
  it("Japanese: the value is the committed text and the Field validated once after commit (kobalte#737)", async () => {
    const validate = vi.fn(() => null)
    const onValueChange = vi.fn()
    render(
      <TextField.Root validationMode="change" validate={validate} onValueChange={onValueChange}>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
      </TextField.Root>,
    )
    const t = field("Name")
    const atMount = validate.mock.calls.length
    await t.compose("にほん", "日本")
    expect(control().value).toBe("日本")
    expect(onValueChange.mock.calls.some(([, d]) => d.isComposing === true)).toBe(true)
    // Spec: "validated once, after the commit".
    expect(validate.mock.calls.length - atMount).toBe(1)
  })

  it("no error is displayed mid-composition, only after the commit", async () => {
    render(
      <TextField.Root validationMode="change" validate={(v) => (v ? "Bad" : null)}>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.ErrorMessage />
      </TextField.Root>,
    )
    const t = field("Name")
    await t.part("input").compose(["に", "にほ"])
    expect(control().hasAttribute("aria-invalid")).toBe(false)
    await t.part("input").compose([], "日本")
    await waitFor(() => expect(control().getAttribute("aria-invalid")).toBe("true"))
  })

  it("a composing field announces no error; the committed value does", async () => {
    render(
      <TextField.Root validationMode="change" validate={(v) => (v ? "Bad" : null)}>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.ErrorMessage />
      </TextField.Root>,
    )
    fakeTimers()
    const log = installAnnouncementLog()
    const before = log.length
    // The driver's waits go through Testing Library's asyncWrapper, which hangs under vitest
    // fake timers; the composition is synthesised directly instead.
    control().focus()
    await act(() => composeInPage(control(), { updates: ["に", "にほ"] }))
    await advance(1200)
    expect(log.length).toBe(before)
    await act(() => composeInPage(control(), { updates: [], commit: "日本" }))
    await advance(4000)
    expect(log.length).toBeGreaterThan(before)
  })

  it("an open composition is flagged data-composing, and the input value is never overwritten", async () => {
    render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
      </TextField.Root>,
    )
    const t = field("Name")
    await t.part("input").compose(["に", "にほ"])
    expect(root().hasAttribute("data-composing")).toBe(true)
    expect(control().value).toBe("にほ")
    await t.part("input").compose([], "日")
    expect(control().value).toBe("日")
    await waitFor(() => expect(root().hasAttribute("data-composing")).toBe(false))
  })

  it("controlled: onValueChange per update with isComposing, not interrupted by the parent (react-spectrum#8506)", async () => {
    const calls: [string, boolean][] = []
    function Controlled() {
      const [v, setV] = useState("")
      return (
        <TextField.Root
          value={v}
          onValueChange={(next, d) => {
            calls.push([next, d.isComposing])
            setV(next)
          }}
        >
          <TextField.Label>Name</TextField.Label>
          <TextField.Input />
        </TextField.Root>
      )
    }
    render(<Controlled />)
    const t = field("Name")
    await t.part("input").compose(["に", "にほ", "にほん"])
    expect(root().hasAttribute("data-composing")).toBe(true)
    expect(calls.filter(([, c]) => c).map(([v]) => v)).toEqual(
      expect.arrayContaining(["に", "にほ", "にほん"]),
    )
    await t.part("input").compose([], "日本")
    expect(control().value).toBe("日本")
    expect(root().hasAttribute("data-composing")).toBe(false)
  })

  it("Korean: syllables are not split and the count follows the commits (ariakit#6663)", async () => {
    render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.CharacterCount />
      </TextField.Root>,
    )
    const t = field("Name")
    await t.compose("사", "사")
    expect(control().value).toBe("사")
    expect(await t.characterCount()).toBe("1")
    await t.compose("과", "과")
    expect(control().value).toBe("사과")
    expect(await t.characterCount()).toBe("2")
  })

  it("composition never announces the count", async () => {
    render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.CharacterCount max={5} />
      </TextField.Root>,
    )
    const log = installAnnouncementLog()
    const before = log.length
    const t = field("Name")
    await t.part("input").compose(["あ", "あい", "あいう", "あいうえ"])
    expect(log.slice(before)).toEqual([])
  })

  it("focusable-disabled ignores IME (base-ui#5366)", async () => {
    render(
      <TextField.Root disabled focusableWhenDisabled defaultValue="keep">
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
      </TextField.Root>,
    )
    expect(control().readOnly).toBe(true)
    expect(control().getAttribute("aria-disabled")).toBe("true")
    expect(control().disabled).toBe(false)
    control().focus()
    // The DOM adapter's synthesised composition writes the value whatever readonly says (only
    // the Playwright adapter's CDP composition is faithful), so the browser's refusal is
    // tested with real typing; readonly is what makes the IME refuse too.
    await field("Name").type("zz")
    expect(control().value).toBe("keep")
  })
})

describe("ClearTrigger", () => {
  it("keeps focus, empties the input, one native input event, one CLEAR report (base-ui#4643)", async () => {
    const onValueChange = vi.fn()
    const onInput = vi.fn()
    render(
      <form onInput={onInput}>
        <TextField.Root onValueChange={onValueChange}>
          <TextField.Label>Name</TextField.Label>
          <TextField.Input />
          <TextField.ClearTrigger />
        </TextField.Root>
      </form>,
    )
    const t = field("Name")
    await t.type("abc")
    onValueChange.mockClear()
    onInput.mockClear()
    await t.clear()
    expect(control().value).toBe("")
    expect(document.activeElement).toBe(control())
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(
      "",
      expect.objectContaining({ reason: "CLEAR" }),
    )
    expect(onInput).toHaveBeenCalledTimes(1)
  })

  it("is named Clear, out of the tab order, and moves focus to the input if it had none", async () => {
    render(
      <TextField.Root defaultValue="abc">
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.ClearTrigger />
      </TextField.Root>,
    )
    const clear = screen.getByRole("button", { name: "Clear" })
    expect(clear.getAttribute("tabindex")).toBe("-1")
    expect(clear.getAttribute("type")).toBe("button")
    await field("Name").clear()
    expect(control().value).toBe("")
    expect(document.activeElement).toBe(control())
  })

  it("controlled: a proposal; a parent that ignores it keeps the value", async () => {
    const onValueChange = vi.fn()
    render(
      <TextField.Root value="abc" onValueChange={onValueChange}>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.ClearTrigger />
      </TextField.Root>,
    )
    await field("Name").part("clear-trigger").click()
    expect(onValueChange).toHaveBeenCalledWith("", expect.objectContaining({ reason: "CLEAR" }))
    expect(control().value).toBe("abc")
  })

  it("is not rendered when empty, read-only or disabled", async () => {
    const { rerender } = render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.ClearTrigger />
      </TextField.Root>,
    )
    expect(await field("Name").isClearable()).toBe(false)
    rerender(
      <TextField.Root defaultValue="abc" readOnly>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.ClearTrigger />
      </TextField.Root>,
    )
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull()
    expect(await field("Name").isReadOnly()).toBe(true)
    rerender(
      <TextField.Root defaultValue="abc" disabled focusableWhenDisabled>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.ClearTrigger />
      </TextField.Root>,
    )
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull()
  })
})

describe("CharacterCount", () => {
  it("counts a newline once and the browser enforces the same limit (react-spectrum#1907)", async () => {
    render(
      <TextField.Root defaultValue={"abc\ndef"}>
        <TextField.Label>Bio</TextField.Label>
        <TextField.Textarea maxLength={10} />
        <TextField.CharacterCount />
      </TextField.Root>,
    )
    const t = field("Bio")
    expect(await t.characterCount()).toBe("7/10")
    await t.type("12345")
    expect(control().value.length).toBe(10)
    expect(await t.characterCount()).toBe("10/10")
  })

  it("is referenced by aria-describedby and is not a live region", () => {
    render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.CharacterCount max={10} />
      </TextField.Root>,
    )
    const count = document.querySelector('[data-part="character-count"]') as HTMLElement
    expect(control().getAttribute("aria-describedby")?.split(" ")).toContain(count.id)
    expect(count.getAttribute("aria-live")).toBeNull()
    expect(count.getAttribute("role")).toBeNull()
  })

  it("announces near the limit once after a pause, not at 50 (focused)", async () => {
    render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.CharacterCount max={100} />
      </TextField.Root>,
    )
    fakeTimers()
    const log = installAnnouncementLog()
    const mine = () => log.filter((a) => /characters? (remaining|too many)/.test(a.message))
    control().focus()
    setNative(control(), "x".repeat(50))
    await advance(1200)
    expect(mine()).toEqual([])
    setNative(control(), "x".repeat(85))
    await advance(4000)
    expect(mine().map((a) => a.message)).toContain("15 characters remaining")
    expect(mine().at(-1)?.priority).toBe("polite")
  })

  it("does not announce while unfocused", async () => {
    render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
        <TextField.CharacterCount max={100} />
      </TextField.Root>,
    )
    fakeTimers()
    const log = installAnnouncementLog()
    const before = log.length
    setNative(control(), "x".repeat(95))
    await advance(1200)
    expect(log.slice(before).filter((a) => /remaining/.test(a.message))).toEqual([])
  })

  it("soft limit exceeded: text kept, submission blocked with an error, excess announced", async () => {
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <TextField.Root>
          <TextField.Label>Name</TextField.Label>
          <TextField.Input />
          <TextField.CharacterCount max={100} />
          <TextField.ErrorMessage />
        </TextField.Root>
        <Button type="submit">Send</Button>
      </form>,
    )
    const log = installAnnouncementLog()
    control().focus()
    setNative(control(), "x".repeat(120))
    await waitFor(() => expect(log.map((a) => a.message)).toContain("20 characters too many"), {
      timeout: 4000,
    })
    await button("Send").press()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(control().value.length).toBe(120)
    await waitFor(() => expect(control().getAttribute("aria-invalid")).toBe("true"))
    expect(await field("Name").errors()).toEqual(["20 characters too many"])
  })
})

describe("Field integration", () => {
  it("required email: focus-visible, aria-invalid, the description has the browser message", async () => {
    render(
      <form>
        <TextField.Root required>
          <TextField.Label>Email</TextField.Label>
          <TextField.Input type="email" />
          <TextField.ErrorMessage />
        </TextField.Root>
        <Button type="submit">Send</Button>
      </form>,
    )
    const t = field("Email")
    await t.type("abc")
    await button("Send").via("keyboard").press()
    await waitFor(() => expect(document.activeElement).toBe(control()))
    expect(control().hasAttribute("data-focus-visible")).toBe(true)
    expect(await t.isInvalid()).toBe(true)
    const message = (control() as HTMLInputElement).validationMessage
    expect(message).not.toBe("")
    expect(await t.description()).toContain(message)
  })

  it("autoFocus seeds data-focus on the Root on mount (base-ui#3172)", () => {
    render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input autoFocus />
      </TextField.Root>,
    )
    expect(root().hasAttribute("data-focus")).toBe(true)
    expect(control().hasAttribute("data-focus")).toBe(true)
  })

  it("data attributes: scope, parts, instance, consumer data-variant", () => {
    render(
      <TextField.Root data-variant="soft" data-size="lg">
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
      </TextField.Root>,
    )
    expect(root().getAttribute("data-variant")).toBe("soft")
    expect(root().getAttribute("data-size")).toBe("lg")
    for (const part of ["root", "label", "input"]) {
      const el = document.querySelector(`[data-part="${part}"]`)
      expect(el?.getAttribute("data-scope")).toBe("text-field")
      expect(el?.getAttribute("data-instance")).toBeTruthy()
    }
  })
})

describe("Autosize", () => {
  it.skipIf(inJsdom)("six lines show without a scrollbar", async () => {
    render(
      <TextField.Root>
        <TextField.Label>Bio</TextField.Label>
        <TextField.Textarea autosize rows={2} style={{ width: 300, boxSizing: "border-box" }} />
      </TextField.Root>,
    )
    const el = control()
    const two = el.getBoundingClientRect().height
    setNative(el, Array.from({ length: 6 }, (_, i) => `line ${i}`).join("\n"))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    await waitFor(() => expect(el.getBoundingClientRect().height).toBeGreaterThan(two + 40))
    expect(el.scrollHeight).toBeLessThanOrEqual(el.clientHeight + 1)
  })
})

describe("review fixes (add-text-field r1)", () => {
  it("a soft max validates with the change that crosses it, both ways (change mode)", async () => {
    render(
      <TextField.Root validationMode="change">
        <TextField.Label>Bio</TextField.Label>
        <TextField.Input />
        <TextField.CharacterCount max={5} />
        <TextField.ErrorMessage />
      </TextField.Root>,
    )
    const t = getTextField(screen, { name: "Bio" }, { platform: domEnvironment().platform })
    await t.type("abcdefgh")
    expect(await t.isInvalid()).toBe(true)
    // Back under the limit, key by key (synthetic select-all is not reliable here).
    const input = screen.getByRole("textbox", { name: "Bio" })
    for (let i = 0; i < 5; i++) await userEvent.type(input, "{Backspace}")
    expect((input as HTMLInputElement).value).toBe("abc")
    expect(await t.isInvalid()).toBe(false)
  })

  it("warns when the control has no name source (a placeholder is not one)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <TextField.Root>
        <TextField.Input placeholder="Search" />
      </TextField.Root>,
    )
    expect(warn.mock.calls.some(([m]) => String(m).includes("no accessible name"))).toBe(true)
    warn.mockRestore()
  })

  it("does not warn with a Label", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    render(
      <TextField.Root>
        <TextField.Label>Name</TextField.Label>
        <TextField.Input />
      </TextField.Root>,
    )
    expect(warn.mock.calls.some(([m]) => String(m).includes("no accessible name"))).toBe(false)
    warn.mockRestore()
  })
})
