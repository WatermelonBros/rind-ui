import type { checkboxGroupConnect } from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import type { FormToggleGrouping } from "../form-toggle/types"

export const checkboxGroupContext = createContext<{
  readonly api: () => ReturnType<typeof checkboxGroupConnect>
  readonly registry: PartRegistry<"label" | "description" | "error-message">
  readonly ids: () => { label: string; description: string; errorMessage: string }
  readonly setLabelTag: (tag: string) => void
  readonly hasParent: () => boolean
  /** The group's own ErrorMessage defers to the Field's inside one. */
  readonly inField: boolean
  readonly invalid: () => boolean
  readonly parentGrouping: FormToggleGrouping
}>("checkbox-group")
