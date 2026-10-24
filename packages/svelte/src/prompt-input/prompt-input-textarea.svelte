<script lang="ts">
import { autosize as attachAutosize, focusSafely, mergeFieldProps } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLTextareaAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldControl } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { promptInput } from "./context"
import type { PromptInputTextareaProps } from "./types"

const { autosize = true, id, child, ...rest }: PromptInputTextareaProps = $props()
const host = promptInput.get()
// Counted at initialisation, so the Root's "exactly one" check sees it.
host.mounted.textareas += 1
$effect(() => () => {
  host.mounted.textareas -= 1
})
const env = useEnvironment()
const uid = $props.id()
const binding = useFieldControl(uid)
const el = elementRef("textarea")
// The Field's control id first: its Label is `for` it from the first render.
const controlId = $derived(id ?? binding?.().controlId ?? host.ids().textarea)
$effect(() => host.setTextareaId(controlId))
$effect(() => {
  const node = el.current
  if (!(node instanceof HTMLTextAreaElement)) return
  host.textarea.current = node
  return () => {
    if (host.textarea.current === node) host.textarea.current = null
  }
})
$effect(() => {
  const node = el.current
  const cid = controlId
  if (!(node instanceof HTMLTextAreaElement)) return
  return untrack(() =>
    binding?.().register(
      {
        id: cid,
        labelable: true,
        focus: (modality) => void focusSafely(node, env, "programmatic", modality),
        validityElement: () => node,
        value: () => node.value,
      },
      cid,
    ),
  )
})
let handle: ReturnType<typeof attachAutosize> | null = null
$effect(() => {
  const node = el.current
  if (!autosize || !(node instanceof HTMLTextAreaElement)) return
  const a = untrack(() => attachAutosize(node, env))
  handle = a
  return () => {
    a.dispose()
    handle = null
  }
})
// Every value commit (typing, the clear on send, a restore, a recall) re-measures.
$effect(() => {
  void host.value()
  untrack(() => handle?.measure())
})
// Development: the placeholder is never a name. Checked once the Field's Label settled (its
// `for` follows the registered control).
$effect(() => {
  if (!DEV) return
  const frame = env.scheduler.requestAnimationFrame(() => {
    const node = el.current as HTMLTextAreaElement | null
    if (!node) return
    const named =
      (node.labels?.length ?? 0) > 0 ||
      node.hasAttribute("aria-label") ||
      node.hasAttribute("aria-labelledby")
    if (!named) {
      console.warn(
        "[rind-ui] prompt-input: the Textarea has no accessible name: render a PromptInput.Label or pass aria-label (a placeholder is not a name).",
      )
    }
  })
  return () => env.scheduler.cancelAnimationFrame(frame)
})
const merged = $derived.by(() => {
  const {
    "aria-describedby": describedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...own
  } = rest
  const field = mergeFieldProps(
    {
      role: "textbox",
      labelable: true,
      disabled: host.disabled(),
      readOnly: host.readOnly(),
      invalid: host.api().derived.overLimit,
      name: host.name(),
      consumerDescribedBy: describedBy ?? undefined,
      ariaLabel: ariaLabel ?? undefined,
      ariaLabelledBy: ariaLabelledBy ?? undefined,
    },
    binding?.() ?? null,
  )
  return stripMarker(
    mergeProps(
      {
        ...normalizeProps({
          ...host.api().textarea(field),
          ...(host.controlled() ? { value: host.value() } : { defaultValue: host.defaultValue() }),
        }),
        ...el.props,
      },
      {
        // The Field validates on the control's changes.
        oninput: (e: Event) =>
          binding?.().report({
            type: "change",
            value: (e.currentTarget as HTMLTextAreaElement).value,
            user: true,
            composing: (e as InputEvent).isComposing === true,
          }),
      },
      own,
    ),
  )
})
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <!-- An uncontrolled textarea's initial value: its content in server HTML, and the
  `defaultValue` property on the client (it keeps the user's edits). -->
  {@const initial = merged["defaultValue"] as string | undefined}
  {#if initial === undefined}
    <textarea {...merged as HTMLTextareaAttributes}></textarea>
  {:else}
    <textarea {...merged as HTMLTextareaAttributes}>{initial}</textarea>
  {/if}
{/if}
