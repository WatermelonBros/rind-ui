// Broken wrappers (add-color-picker 8.2): each colour invariant fails, readably, on a wrapper
// that breaks exactly what it checks. Keyboard runs in jsdom.
import { type Contract, colorPickerContract, makeColor, parseColor } from "@rind-ui/core"
import { areaAxes, colorAreaContract, colorSliderContract } from "@rind-ui/core/internal"
import { ColorPicker } from "@rind-ui/react"
import { cleanup, render } from "@testing-library/react"
import { type ReactElement, type ReactNode, useEffect, useRef } from "react"
import { describe, expect, it } from "vitest"
import { domEnv, testMachine } from "../index"
import { ColorArea, ColorSlider } from "./color-parts"

/** Re-applies a breakage after every DOM change under it (React re-renders undo it). */
function Break({
  apply,
  children,
}: {
  readonly apply: (root: HTMLElement) => void
  readonly children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    // The portalled content is outside: the whole document is watched.
    const run = () => apply(root.ownerDocument.body)
    run()
    const observer = new MutationObserver(run)
    observer.observe(root.ownerDocument.body, { subtree: true, attributes: true, childList: true })
    return () => observer.disconnect()
  }, [apply])
  return <div ref={ref}>{children}</div>
}

/** Every failure message of a contract run on a broken page. */
async function failures(c: Contract, ui: () => ReactElement, props: unknown, anchor: string) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(
    c as never,
    {
      test: (n: string, fn: () => Promise<void>) => tests.push({ name: n, fn }),
      setup: () => render(ui()),
      target: () => domEnv({ timeout: 200 }),
      anchor: [{ name: anchor }] as never,
      props: props as never,
      modalities: ["keyboard"],
      directions: ["ltr"],
    } as never,
  )
  const out: string[] = []
  for (const t of tests.slice(0, 6)) {
    await t.fn().catch((e: Error) => out.push(e.message))
    cleanup()
  }
  return out.join("\n")
}

/** Sets an attribute only when it differs (the observer would loop otherwise). */
const setAttr = (el: Element | null | undefined, name: string, value: string) => {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value)
}
const setVar = (el: HTMLElement | null | undefined, name: string, value: string) => {
  if (el && el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value)
}

const HSB = makeColor("hsb", [200, 50, 50])
const areaProps = {
  value: undefined,
  defaultValue: HSB,
  axes: areaAxes("hsb"),
  fallback: makeColor("hsb", [0, 0, 100]),
  disabled: undefined,
  readOnly: undefined,
}
const area = (apply: (root: HTMLElement) => void) => () => (
  <Break apply={apply}>
    <form>
      <ColorArea.Root aria-label="Fill" defaultValue={HSB}>
        <ColorArea.Background />
        <ColorArea.Thumb />
      </ColorArea.Root>
      <button type="reset">Reset</button>
    </form>
  </Break>
)

const sliderProps = {
  value: undefined,
  defaultValue: [200],
  min: 0,
  max: 360,
  step: 1,
  largeStep: 15,
  minStepsBetweenThumbs: undefined,
  disabled: undefined,
  readOnly: undefined,
  thumbDisabled: undefined,
}
const slider = (apply: (root: HTMLElement) => void) => () => (
  <Break apply={apply}>
    <form>
      <ColorSlider.Root channel="hue" defaultValue={HSB} name="h">
        <ColorSlider.Track>
          <ColorSlider.Thumb />
        </ColorSlider.Track>
      </ColorSlider.Root>
      <button type="reset">Reset</button>
    </form>
  </Break>
)

const pickerProps = {
  value: undefined,
  defaultValue: parseColor("#336699"),
  format: undefined,
  defaultFormat: "hex",
  open: undefined,
  defaultOpen: undefined,
  inline: undefined,
  disabled: undefined,
  readOnly: undefined,
  closeOnSelect: undefined,
  onValueCommit: undefined,
}
const picker =
  (apply: (root: HTMLElement) => void, extra?: ReactNode, inline = false) =>
  () => (
    <Break apply={apply}>
      <form>
        <ColorPicker.Root name="fill" defaultValue="#336699" inline={inline}>
          <ColorPicker.Label>Fill</ColorPicker.Label>
          {inline ? null : (
            <ColorPicker.Control>
              <ColorPicker.Trigger>
                <ColorPicker.ValueSwatch />
              </ColorPicker.Trigger>
            </ColorPicker.Control>
          )}
          <ColorPicker.Portal>
            <ColorPicker.Positioner>
              <ColorPicker.Content>
                <ColorPicker.FormatSelect />
                <ColorPicker.FormatTrigger />
                {extra}
              </ColorPicker.Content>
            </ColorPicker.Positioner>
          </ColorPicker.Portal>
        </ColorPicker.Root>
        <button type="reset">Reset</button>
      </form>
    </Break>
  )
const q = <T extends Element = HTMLElement>(root: HTMLElement, sel: string) =>
  root.querySelector<T>(sel)

describe("broken colour wrappers fail readably (8.2)", { timeout: 60_000 }, () => {
  it("area: an input's value disagrees with aria-valuenow", async () => {
    const out = await failures(
      colorAreaContract as never,
      area((r) => setAttr(q(r, 'input[data-part="area-input"]'), "aria-valuenow", "99")),
      areaProps,
      "Fill",
    )
    expect(out).toMatch(/the x input has value \d+, aria-valuenow 99/)
  })

  it("area: tabindex=0 on the y input is an extra tab stop", async () => {
    const out = await failures(
      colorAreaContract as never,
      area((r) => setAttr(r.querySelectorAll('input[data-part="area-input"]')[1], "tabindex", "0")),
      areaProps,
      "Fill",
    )
    expect(out).toMatch(/2 tab stops among its inputs, not 1/)
  })

  it("area: NaN in the thumb's position", async () => {
    const out = await failures(
      colorAreaContract as never,
      area((r) =>
        setVar(
          q(r, '[data-scope="color-picker"][data-part="area-thumb"]'),
          "--rind-color-area-x",
          "NaN",
        ),
      ),
      areaProps,
      "Fill",
    )
    expect(out).toMatch(/thumb's style contains NaN/)
  })

  it("slider: the track paints no gradient", async () => {
    const out = await failures(
      colorSliderContract as never,
      slider((r) => {
        const t = q(r, '[data-scope="color-picker"][data-part="channel-slider-track"]')
        if (t && t.style.backgroundImage !== "none") t.style.backgroundImage = "none"
      }),
      sliderProps,
      "Hue",
    )
    expect(out).toMatch(/the track paints no gradient/)
  })

  it("slider: a value text without the channel", async () => {
    const out = await failures(
      colorSliderContract as never,
      slider((r) => setAttr(q(r, 'input[data-part="hidden-input"]'), "aria-valuetext", "200")),
      sliderProps,
      "Hue",
    )
    expect(out).toMatch(/does not name the hue channel/)
  })

  it("picker: a stale hidden input", async () => {
    const out = await failures(
      colorPickerContract as never,
      picker((r) => {
        const input = q<HTMLInputElement>(r, 'input[data-part="hidden-input"]')
        if (input && input.value !== "#000000") input.value = "#000000"
      }),
      pickerProps,
      "Fill",
    )
    expect(out).toMatch(/the hidden input holds #000000/)
  })

  it("picker: NaN in the root's variables", async () => {
    const out = await failures(
      colorPickerContract as never,
      picker((r) =>
        setVar(q(r, '[data-scope="color-picker"][data-part="root"]'), "--rind-x", "NaN"),
      ),
      pickerProps,
      "Fill",
    )
    expect(out).toMatch(/root style contains NaN/)
  })

  it("picker: a second Area with its own value", async () => {
    const out = await failures(
      colorPickerContract as never,
      picker(
        () => {},
        <ColorArea.Root aria-label="Other" value="#000000">
          <ColorArea.Thumb />
        </ColorArea.Root>,
      ),
      pickerProps,
      "Fill",
    )
    expect(out).toMatch(/a Color Area in the content shows #000000/)
  })

  it("picker: aria-expanded that does not follow the open state", async () => {
    const out = await failures(
      colorPickerContract as never,
      picker((r) => setAttr(q(r, '[data-part="trigger"]'), "aria-expanded", "false")),
      pickerProps,
      "Fill",
    )
    expect(out).toMatch(/aria-expanded is false, the picker is open/)
  })

  it("picker: a format select that shows another format", async () => {
    const out = await failures(
      colorPickerContract as never,
      picker((r) => {
        const s = q<HTMLSelectElement>(r, 'select[data-part="format-select"]')
        if (s && s.value !== "hsb") s.value = "hsb"
      }),
      pickerProps,
      "Fill",
    )
    expect(out).toMatch(/the format select shows hsb/)
  })

  it("picker: an inline picker made inert", async () => {
    const out = await failures(
      colorPickerContract as never,
      picker(
        (r) => setAttr(q(r, '[data-scope="color-picker"][data-part="content"]'), "inert", ""),
        null,
        true,
      ),
      { ...pickerProps, inline: true },
      "Fill",
    )
    expect(out).toMatch(/the inline content is inert/)
  })
})
