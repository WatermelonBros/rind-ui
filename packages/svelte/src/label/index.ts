import Root from "./label.svelte"

export type { LabelProps } from "./types"

/** A native `<label>`: names its control through `for` or by wrapping it. */
export const Label = Object.assign(Root, { Root })
