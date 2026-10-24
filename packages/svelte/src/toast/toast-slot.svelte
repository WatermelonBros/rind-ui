<script lang="ts">
import type { ToastSnapshot } from "@rind-ui/core"
import type { Snippet } from "svelte"
import { regionHost, toastHost } from "./context.svelte"

// Provides one toast to its parts.
const { toast, children }: { toast: ToastSnapshot; children: Snippet<[ToastSnapshot]> } = $props()
const region = regionHost.get()
let rendered = $state({ title: false, description: false })
toastHost.set({
  region,
  toast: () => toast,
  rendered: () => rendered,
  mount: (part, on) => {
    if (rendered[part] !== on) rendered = { ...rendered, [part]: on }
  },
})
</script>

{@render children(toast)}
