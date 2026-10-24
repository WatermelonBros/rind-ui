<script lang="ts">
import type { Scheduler } from "@rind-ui/core"
import { NavigationMenu as N, RindProvider } from "../../src/index"

const {
  root = {},
  nested = false,
  positioned = false,
  viewport = false,
  dir,
  scheduler,
}: {
  root?: Record<string, unknown>
  nested?: boolean
  positioned?: boolean
  viewport?: boolean
  dir?: "ltr" | "rtl"
  scheduler?: Scheduler
} = $props()
</script>

<!-- No whitespace between parts: React's markup has none. -->
{#snippet content()}
  <N.Content
    ><N.Link href="#analytics">Analytics</N.Link><N.Link href="#engage">Engage</N.Link
    >{#if nested}<N.Sub
        ><N.List
          ><N.Item value="more"
            ><N.Trigger>More</N.Trigger><N.Content><N.Link href="#labs">Labs</N.Link></N.Content
            ></N.Item
          ></N.List
        ></N.Sub
      >{/if}</N.Content
  >
{/snippet}

{#snippet menu()}
  <N.Root openDelay={200} closeDelay={100} {...root}
    ><N.List
      ><N.Item value="products"
        ><N.Trigger>Products</N.Trigger>{#if positioned}<N.Positioner>{@render content()}</N.Positioner
          >{:else}{@render content()}{/if}</N.Item
      ><N.Item value="pricing"><N.Link href="#pricing">Pricing</N.Link></N.Item
      >{#if viewport}<N.Indicator />{/if}</N.List
    >{#if viewport}<N.Positioner><N.Viewport /></N.Positioner>{/if}</N.Root
  >
{/snippet}

{#if scheduler}
  <RindProvider environment={{ scheduler }} dir={dir ?? "ltr"}>
    <div dir={dir ?? "ltr"}>
      <a href="/before">Before</a>
      {@render menu()}
      <a href="/after">After</a>
    </div>
  </RindProvider>
{:else}
  {@render menu()}
{/if}
