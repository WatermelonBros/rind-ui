<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLTextareaAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { mentionsHost } from "./context"
import type { MentionsTextareaProps } from "./types"

/** The text field: a textbox, a combobox while its list is open. */
const rest: MentionsTextareaProps = $props()
const host = mentionsHost.get()
const at = (el: HTMLTextAreaElement) => el.selectionStart ?? el.value.length
const caretOf = (e: Event) => ({
  type: "CARET" as const,
  caret: at(e.currentTarget as HTMLTextAreaElement),
})
const capture = (node: HTMLTextAreaElement) => {
  host.textarea.current = node
  return () => {
    if (host.textarea.current === node) host.textarea.current = null
  }
}
// The value as the property and as the content (`defaultValue`), as React's markup.
const own = $derived.by(() => {
  const p = normalizeProps(host.api().textarea())
  return { ...p, defaultValue: p["value"] }
})
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(own, {
        oninput: (e: Event) => {
          const el = e.currentTarget as HTMLTextAreaElement
          host.send({
            type: "INPUT",
            value: el.value,
            caret: at(el),
            composing: (e as InputEvent).isComposing === true,
          })
        },
        onselect: (e: Event) => host.send(caretOf(e)),
        onclick: (e: Event) => host.send(caretOf(e)),
        onkeyup: (e: KeyboardEvent) => {
          // Only caret keys: an input already reported its caret.
          if (/^(Arrow|Home|End|Page)/.test(e.key) && !host.open()) host.send(caretOf(e))
        },
        oncompositionstart: () => host.send({ type: "COMPOSITION.START" }),
        oncompositionend: (e: CompositionEvent) => {
          const el = e.currentTarget as HTMLTextAreaElement
          host.send({ type: "COMPOSITION.END", value: el.value, caret: at(el) })
        },
        onkeydown: (e: KeyboardEvent) => {
          // Closed: the textarea's own keys (no interception).
          if (!host.open()) return
          const composing = e.isComposing || e.keyCode === 229
          if (composing) return
          const highlighted = host.highlightedKey() !== null
          switch (e.key) {
            case "ArrowDown":
            case "ArrowUp":
              e.preventDefault()
              host.send({
                type: "ARROW",
                key: e.key === "ArrowDown" ? "NEXT" : "PREV",
                alt: e.altKey,
                composing,
              })
              return
            case "Enter":
              if (!highlighted) return
              e.preventDefault()
              host.send({ type: "ENTER", composing })
              return
            case "Tab":
              // Tab inserts only a highlighted option; otherwise focus moves on.
              if (!host.selectOnTab() || !highlighted) return
              e.preventDefault()
              host.send({ type: "TAB", composing })
              return
            case "Escape":
              e.preventDefault()
              // The list closes; a surrounding dialog stays open.
              e.stopPropagation()
              host.send({ type: "ESCAPE", composing })
              return
          }
        },
        onscroll: (e: Event) => {
          const el = e.currentTarget as HTMLTextAreaElement
          const mirror = host.highlighter.current
          if (mirror) {
            mirror.scrollTop = el.scrollTop
            mirror.scrollLeft = el.scrollLeft
          }
        },
        onfocus: () => host.send({ type: "INPUT.FOCUS" }),
        onblur: () => host.send({ type: "INPUT.BLUR" }),
      }),
      rest,
    ),
  ),
)
</script>

<textarea {...merged as HTMLTextareaAttributes} {@attach capture}></textarea>
