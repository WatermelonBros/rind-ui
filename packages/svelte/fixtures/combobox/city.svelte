<script lang="ts">
import { platforms } from "@rind-ui/core"
import { currentRun } from "@rind-ui/testing"
import { Combobox, type ComboboxRootProps, RindProvider } from "../../src/index"

// The combobox examples (model and parity): popup or inline. No whitespace between parts:
// React's markup has none.
const {
  root = {},
  inline = false,
  parity = false,
  provider = true,
}: {
  root?: Record<string, unknown>
  inline?: boolean
  /** The parity example: Clear and toggle buttons with text, an Empty part. */
  parity?: boolean
  provider?: boolean
} = $props()
const rootProps = $derived(root as ComboboxRootProps)
</script>

{#snippet body()}{#if inline}<Combobox.Root {...rootProps} inline
      ><Combobox.Label>City</Combobox.Label><Combobox.Control><Combobox.Input /></Combobox.Control
      ><Combobox.List><Combobox.Items /></Combobox.List
      >{#if parity}<Combobox.Empty>None</Combobox.Empty>{/if}</Combobox.Root
    >{:else}<Combobox.Root {...rootProps}
      ><Combobox.Label>City</Combobox.Label><Combobox.Control
        ><Combobox.Chips /><Combobox.Input />{#if parity}<Combobox.ClearTrigger>Clear</Combobox.ClearTrigger
          ><Combobox.Trigger>▾</Combobox.Trigger>{:else}<Combobox.Trigger />{/if}</Combobox.Control
      ><Combobox.Positioner
        ><Combobox.Popup
          ><Combobox.List><Combobox.Items /></Combobox.List
          >{#if parity}<Combobox.Empty>None</Combobox.Empty>{/if}</Combobox.Popup
        ></Combobox.Positioner
      ></Combobox.Root
    >{/if}{/snippet}

{#if provider}<RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}
    >{@render body()}<button type="button">After</button></RindProvider
  >{:else}<div>{@render body()}</div>{/if}
