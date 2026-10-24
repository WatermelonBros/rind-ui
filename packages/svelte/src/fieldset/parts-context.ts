import type { FieldsetPart, FieldsetScope } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"

export const fieldsetParts = createContext<{
  readonly instance: () => string
  readonly registry: PartRegistry<FieldsetPart>
  readonly disabled: () => boolean
  readonly invalid: () => boolean
  readonly scope: () => FieldsetScope
}>("fieldset")
