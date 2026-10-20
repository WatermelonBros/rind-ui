"use client"

// The colour props of every colour component (color-model "Controlled Colour Value" rule 1):
// `string | Color`, parsed once per distinct string; an unparsable string is a development
// error and the previous colour is kept.

import { type Color, type ColorInput, isColor, tryParseColor } from "@rind-ui/core"
import { useRef } from "react"

declare const process: { env: { NODE_ENV?: string } }

/** The colour of a `string | Color` prop; `undefined` when the prop is. */
export function useColorProp(
  input: ColorInput | null | undefined,
  prop: string,
  component: string,
): Color | undefined {
  const last = useRef<{ input: unknown; color: Color | undefined }>({
    input: undefined,
    color: undefined,
  })
  if (input === undefined || input === null) return undefined
  if (isColor(input)) {
    last.current = { input, color: input }
    return input
  }
  if (last.current.input === input) return last.current.color
  const color = tryParseColor(String(input))
  if (!color) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[rind-ui] ${component}: "${prop}" ${JSON.stringify(input)} is not a colour`)
    }
    return last.current.color
  }
  last.current = { input, color }
  return color
}

/** The colour a component starts with: read once (a later `defaultValue` changes a reset only). */
export function useCreationColor(color: Color | undefined): Color | undefined {
  const first = useRef<Color | undefined | null>(null)
  if (first.current === null) first.current = color
  return first.current ?? undefined
}
