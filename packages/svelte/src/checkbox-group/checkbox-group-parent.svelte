<script lang="ts">
import type { ChangeDetails, CheckboxEvent, CheckedState } from "@rind-ui/core"
import CheckboxRoot from "../checkbox/checkbox-root.svelte"
import { DEV } from "../dev"
import { formToggleGrouping } from "../form-toggle/context.svelte"
import type { FormToggleRootProps } from "../form-toggle/types"
import { checkboxGroupContext } from "./context"

// The select-all checkbox: a Checkbox whose state the group derives.
const props: Omit<
  FormToggleRootProps<CheckedState, ChangeDetails<CheckboxEvent>>,
  "checked" | "defaultChecked" | "onCheckedChange"
> = $props()
const ctx = checkboxGroupContext.get()
if (DEV && !ctx.hasParent())
  console.error("[rind-ui] checkbox-group: a Parent needs `allValues` on CheckboxGroup.Root")
formToggleGrouping.set(() => ctx.parentGrouping)
</script>

<CheckboxRoot {...props} />
