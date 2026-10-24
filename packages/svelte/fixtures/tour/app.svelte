<script lang="ts">
import { Tour, type TourRootProps } from "../../src/index"

// The tour example (model and parity). No whitespace between parts: React's markup has none.
const { root = {} }: { root?: Record<string, unknown> } = $props()
const rootProps = $derived(root as TourRootProps)
</script>

<div id="app"
  ><button type="button" id="search">Search</button><div id="toolbar" style="width: 120px; height: 30px;"
    ><button type="button">Bold</button></div
  ><button type="button" id="after">After</button><Tour.Root {...rootProps}
    ><Tour.Trigger>Take the tour</Tour.Trigger><Tour.Portal
      ><Tour.Backdrop /><Tour.Spotlight /><Tour.Positioner
        ><Tour.Content
          ><Tour.Arrow /><Tour.Title /><Tour.Description /><Tour.ProgressText /><Tour.Actions
            >{#snippet children(actions)}{#each actions as a (String(a.action))}<Tour.ActionTrigger
                  action={a}
                />{/each}{/snippet}</Tour.Actions
          ><Tour.CloseTrigger /></Tour.Content
        ></Tour.Positioner
      ></Tour.Portal
    ></Tour.Root
  ></div
>
