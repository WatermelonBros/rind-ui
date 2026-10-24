<script lang="ts">
import { joinHandlers } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { calendarHost } from "./context"

// With a higher view, the heading's text is a button one view up (spec "View Drill-Down").
const ctx = calendarHost.get()
const env = useEnvironment()
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") ctx.send({ type: "VIEW.UP", modality: e.modality })
  },
})
const own = $derived(ctx.api().viewTrigger({ focused, modality: modality.current }))
const props = $derived(
  own
    ? joinHandlers(normalizeProps(own), press.props, {
        onfocus: () => {
          focused = true
        },
        onblur: () => {
          focused = false
        },
      })
    : null,
)
const text = $derived(ctx.api().viewTriggerText())
</script>

{#if props}<button {...attrs(props)} type="button"
    ><span {...attrs(normalizeProps(text))}>{text["children"] as string}</span></button
  >{/if}
