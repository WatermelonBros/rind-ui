import type { SeparatorContext, SeparatorOrientation } from "@rind-ui/core"
import { createContext } from "../context"

/**
 * What a container tells the separators inside it (a Toolbar: context `toolbar`, the
 * perpendicular default orientation; a listbox popup: `listbox`). Read through a getter.
 */
export interface SeparatorHost {
  readonly context: SeparatorContext
  readonly defaultOrientation?: SeparatorOrientation | undefined
}
export const separatorHost = createContext<() => SeparatorHost | null>("separator-host")
