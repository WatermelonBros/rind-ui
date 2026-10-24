// The colour props of every colour component (color-model "Controlled Colour Value" rule 1):
// `string | Color`, parsed once per distinct string; an unparsable string is a development
// error and the previous colour is kept.
import { type Color, type ColorInput, isColor, tryParseColor } from "@rind-ui/core"

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

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
      if (process.env.NODE_ENV !== "production") {
        console.error(`[rind-ui] ${component}: "${prop}" ${JSON.stringify(value)} is not a colour`)
      }
      return last.color
    }
    last = { input: value, color }
    return color
  }
}

/** A colour prop's Vue prop definition: a colour string or a `Color`. */
export const colorProp = {
  type: [String, Object] as unknown as import("vue").PropType<ColorInput | null>,
  default: undefined,
}
