// The EyeDropper API (color-picker "Eye Dropper"): feature detection and one pick. A dismissed
// dropper (AbortError) or any error resolves to null: nothing changes, nothing is reported.

interface EyeDropperLike {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>
}
type EyeDropperCtor = new () => EyeDropperLike

const ctor = (win: unknown): EyeDropperCtor | undefined => {
  const c = (win as { EyeDropper?: unknown } | undefined)?.EyeDropper
  // Sound: a constructor named EyeDropper on the window is the API (or a test's fake of it).
  return typeof c === "function" ? (c as EyeDropperCtor) : undefined
}

/** Whether `win` has the EyeDropper API (decided after mount: the server has no window). */
export const isEyeDropperSupported = (win: unknown) => ctor(win) !== undefined

/** Opens the dropper; the picked `#rrggbb`, or null when dismissed, unsupported or failed. */
export async function pickScreenColor(win: unknown, signal?: AbortSignal): Promise<string | null> {
  const C = ctor(win)
  if (!C) return null
  try {
    const result = await new C().open(signal ? { signal } : {})
    return typeof result?.sRGBHex === "string" ? result.sRGBHex : null
  } catch {
    return null
  }
}
