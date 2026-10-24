<script lang="ts">
import { untrack } from "svelte"
import { useFieldBindingPeek } from "../field/context.svelte"
import { listboxHost } from "../listbox/context"
import ListboxList from "../listbox/listbox-list.svelte"
import type { ListboxPartProps } from "../listbox/types"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { api, selectHost } from "./context.svelte"

// The list: it registers itself (aria-controls exists only while it is mounted), and binds the
// listbox parts below to this select (the list named as the trigger says).
const props: ListboxPartProps = $props()
const ctx = selectHost.get()
const env = useEnvironment()
// A Field's label names the list when the select renders no label of its own.
const fieldLabel = useFieldBindingPeek()
let listFocused = $state(false)
const modality = useModality(env.modality, () => listFocused)
$effect(() => {
  untrack(() => ctx.setMounted("list", true))
  return () => ctx.setMounted("list", false)
})
const parts = $derived.by(() => {
  const a = api(ctx, env, { listFocused, modality: modality.current })
  return {
    ...a.listbox,
    list: () => ({
      ...a.list({
        ...ctx.triggerNaming.current,
        labelledBy: ctx.triggerNaming.current.labelledBy ?? fieldLabel?.().ids.label,
      }),
      onFocus: () => {
        listFocused = true
      },
      onBlur: () => {
        listFocused = false
      },
    }),
  }
})
listboxHost.set({
  name: "Select",
  parts: () => parts as never,
  collection: ctx.collection,
  registry: untrack(() => ctx.registry()),
  mount: (p, on) => ctx.setMounted(p, on),
  mountDescription: ctx.mountDescription,
  requestLoadMore: () => {},
})
</script>

<ListboxList {...props} />
