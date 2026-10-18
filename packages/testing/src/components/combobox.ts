import { comboboxContract, inlineComboboxContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

type Anchor = { readonly name: string | RegExp }

/** An inline combobox (a command palette): `run(name)`, `back()`, `page()` besides the rest. */
export function getCombobox(
  target: Target,
  anchor: Anchor,
  options: DriverOptions & { readonly inline: true },
): ReturnType<typeof createDriverWith<typeof inlineComboboxContract>>
/** A driver for the Combobox named `name`: type, compose, open, choose, clear, queries. */
export function getCombobox(
  target: Target,
  anchor: Anchor,
  options?: DriverOptions & { readonly inline?: false },
): ReturnType<typeof createDriverWith<typeof comboboxContract>>
export function getCombobox(
  target: Target,
  anchor: Anchor,
  options?: DriverOptions & { readonly inline?: boolean },
) {
  const { inline, ...rest } = options ?? {}
  return inline
    ? createDriverWith(inlineComboboxContract, target, [anchor], rest)
    : createDriverWith(comboboxContract, target, [anchor], rest)
}
