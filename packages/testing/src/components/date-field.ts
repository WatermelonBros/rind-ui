import { dateFieldContract, dateRangeFieldContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

type RangeDriver = ReturnType<typeof createDriverWith<typeof dateRangeFieldContract>>
type SingleDriver = ReturnType<typeof createDriverWith<typeof dateFieldContract>>

/**
 * A driver for the Date Field whose group is named `name`; `selectionMode: "range"` drives
 * a range field (fill both ends, read both hidden inputs).
 */
export function getDateField(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly selectionMode: "range" },
  options?: DriverOptions,
): RangeDriver
export function getDateField(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly selectionMode?: "single" },
  options?: DriverOptions,
): SingleDriver
export function getDateField(
  target: Target,
  anchor: { readonly name: string | RegExp; readonly selectionMode?: "single" | "range" },
  options?: DriverOptions,
): RangeDriver | SingleDriver {
  const { selectionMode, ...locate } = anchor
  return selectionMode === "range"
    ? createDriverWith(dateRangeFieldContract, target, [locate], options)
    : createDriverWith(dateFieldContract, target, [locate], options)
}
