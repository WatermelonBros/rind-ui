// The colour props of every colour component (color-model "Controlled Colour Value" rule 1):
// `string | Color`, parsed once per distinct string; an unparsable string is a development
// error and the previous colour is kept.
import { type Color, type ColorInput, isColor, tryParseColor } from "@rind-ui/core"
import { DEV } from "./dev"

/** The colour of a `string | Color` prop (a getter); `undefined` when the prop is. */
export function useColorProp(
  input: () => ColorInput | null | undefined,
  prop: string,
  component: string,
): () => Color | undefined {
  let last: { input: unknown; color: Color | undefined } = { input: undefined, color: undefined }
  return () => {
    const value = input()
    if (value === undefined || value === null) return undefined
    if (isColor(value)) {
      last = { input: value, color: value }
      return value
    }
    if (last.input === value) return last.color
    const color = tryParseColor(String(value))
    if (!color) {
      if (DEV)
        console.error(`[rind-ui] ${component}: "${prop}" ${JSON.stringify(value)} is not a colour`)
      return last.color
    }
    last = { input: value, color }
    return color
  }
}
