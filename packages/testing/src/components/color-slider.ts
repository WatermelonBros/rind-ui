import { colorSliderContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/**
 * A driver for the Color Slider whose group is `name` (its Label; an unlabelled slider's
 * group has no name, so `name` matches its thumb's channel name): the Slider's driver plus the
 * colour queries and `setChannel(value)` (`setValue(0, value)`).
 */
export function getColorSlider(
  target: Target,
  anchor: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  const driver = createDriverWith(colorSliderContract, target, [anchor], options)
  return Object.assign(driver, {
    /** Keyboard steps to the value (the pointer form is `setValue` in browser modes). */
    setChannel: (value: number) => driver.via("keyboard").setValue(0, value),
  })
}
