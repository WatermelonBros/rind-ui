<script lang="ts">
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useDateRange } from "./context"
import type { DateFieldSeparatorProps } from "./types"

const props: DateFieldSeparatorProps = $props()
const range = useDateRange()
if (!range) throw new Error("DateField.Separator must be inside a range DateField.Root")
const ctx = range
const own = $derived(ctx.api(null).separator())
const merged = $derived(mergeProps(normalizeProps(own), props as Record<string, unknown>))
</script>

<span {...attrs(merged)}>{own["children"] as string}</span>
