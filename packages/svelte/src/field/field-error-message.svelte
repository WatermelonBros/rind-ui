<script lang="ts">
import { partId } from "@rind-ui/core"
import { usePresence } from "../use-presence.svelte"
import { fieldParts } from "./context.svelte"
import Shown from "./field-error-message-shown.svelte"
import type { FieldErrorMessageProps } from "./types"

const props: FieldErrorMessageProps = $props()
const ctx = fieldParts.get()
// Counted while mounted: the Field cancels the browser bubble only when one exists.
ctx.hasErrorPart.current += 1
$effect(() => () => {
  ctx.hasErrorPart.current -= 1
})
let el = $state<Element | null>(null)
const open = $derived(
  ctx.api().display === "invalid" &&
    (props.match === undefined || props.match === ctx.api().errorKey),
)
const presence = usePresence(
  () => open,
  () => el,
)
const own = $derived(props.id ?? partId("field", ctx.instance(), "error-message"))
</script>

{#if presence.mounted}
  <Shown {...props} {own} setEl={(node) => (el = node)} />
{/if}
