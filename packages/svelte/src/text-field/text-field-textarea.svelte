<script lang="ts">
import { autosize as attachAutosize } from "@rind-ui/core"
import { untrack } from "svelte"
import type { HTMLTextareaAttributes } from "svelte/elements"
import { useEnvironment } from "../provider"
import type { TextFieldTextareaProps } from "./types"
import { useControl } from "./use-control.svelte"

const { autosize = false, child, ...rest }: TextFieldTextareaProps = $props()
const uid = $props.id()
const control = useControl("textarea", uid, () => rest as Readonly<Record<string, unknown>>)
const env = useEnvironment()
let handle: ReturnType<typeof attachAutosize> | null = null
$effect(() => {
  const node = control.el.current
  if (!autosize || !(node instanceof HTMLTextAreaElement)) return
  const a = untrack(() => attachAutosize(node, env))
  handle = a
  return () => {
    a.dispose()
    handle = null
  }
})
// Every value commit (controlled, programmatic, reset) re-measures (kobalte#484).
$effect(() => {
  void control.ctx.view().values.value
  untrack(() => handle?.measure())
})
</script>

{#if child}
  {@render child({ props: control.props, state: { composing: control.composing } })}
{:else}
    <!-- An uncontrolled textarea's initial value: its content in server HTML, and the
  `defaultValue` property on the client (it keeps the user's edits). -->
  {@const initial = control.props["defaultValue"] as string | undefined}
  {#if initial === undefined}
    <textarea {...control.props as HTMLTextareaAttributes}></textarea>
  {:else}
    <textarea {...control.props as HTMLTextareaAttributes}>{initial}</textarea>
  {/if}
{/if}
