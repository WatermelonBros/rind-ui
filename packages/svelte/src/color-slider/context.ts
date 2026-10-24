import { createContext } from "../context"
import { normalizeProps } from "../normalize-props"

export const colorSlider = createContext<{
  readonly data: () => Readonly<Record<`data-${string}`, string>>
  readonly trackStyle: () => string
  readonly thumbStyle: () => string
  readonly setLabelled: (on: boolean) => void
}>("color-slider")

/** A style object as a declaration string (Svelte style attributes are strings). */
export const styleText = (s: object): string =>
  (normalizeProps({ style: s }) as { style?: string }).style ?? ""
export const joinStyle = (...s: (string | null | undefined)[]) => s.filter(Boolean).join("; ")
