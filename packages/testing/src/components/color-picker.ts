import { colorPickerContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"
import { getColorArea } from "./color-area"
import { getColorChannelField, getColorField } from "./color-field"
import { getColorSlider } from "./color-slider"
import { getColorSwatchPicker } from "./color-swatch-picker"

type FakeResult = string | "abort"

/**
 * A driver for the Color Picker named `name` (its Control, or its content when inline), with
 * its children's drivers (`area()`, `slider(channel)`, `input(channel)`, `swatches()`) and
 * `eyeDropper(result | "abort")`, which installs a fake `EyeDropper` on the page's window.
 */
export function getColorPicker(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  const driver = createDriverWith(colorPickerContract, target, [anchor], options)
  const names = (channel: string) =>
    channel === "hex"
      ? "HEX"
      : channel === "css"
        ? "CSS"
        : channel[0]?.toUpperCase() + channel.slice(1)
  return Object.assign(driver, {
    area: (name: string | RegExp = "Color area") => getColorArea(target, { name }, options),
    slider: (channel: string) => getColorSlider(target, { name: names(channel) }, options),
    input: (channel: string) =>
      channel === "hex" || channel === "css"
        ? getColorField(target, { name: names(channel) }, options)
        : getColorChannelField(target, { name: names(channel) }, options),
    swatches: (name: string | RegExp = "Color swatches") =>
      getColorSwatchPicker(target, { name }, options),
    /** Installs a fake EyeDropper that resolves `result` (or rejects as dismissed). */
    eyeDropper: (result: FakeResult, win: unknown = globalThis.window) => {
      class FakeEyeDropper {
        open() {
          return result === "abort"
            ? Promise.reject(new DOMException("dismissed", "AbortError"))
            : Promise.resolve({ sRGBHex: result })
        }
      }
      Object.assign(win as object, { EyeDropper: FakeEyeDropper })
      return () => {
        Reflect.deleteProperty(win as object, "EyeDropper")
      }
    },
  })
}
