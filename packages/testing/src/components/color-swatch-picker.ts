import { colorSwatchPickerContract, pickSwatch } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Color Swatch Picker named `name`: Radio Group's driver plus the colour
 * queries, `pick(key | name | index)` and `move("next" | "previous")`.
 */
export function getColorSwatchPicker(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  const driver = createDriverWith(colorSwatchPickerContract, target, [anchor], options)
  return Object.assign(driver, {
    pick: (swatch: string | number) => pickSwatch(driver.env as never, swatch),
    move: async (direction: "next" | "previous") => {
      const focused = driver.env.focused()
      await focused.press(direction === "next" ? "ArrowRight" : "ArrowLeft")
    },
  })
}
