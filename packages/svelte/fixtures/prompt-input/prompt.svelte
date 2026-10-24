<script lang="ts">
import type { PromptInputStatus } from "@rind-ui/core"
import { PromptInput, type PromptInputRootProps, RindProvider } from "../../src/index"

// The model's prompt (an environment, the "Settle request" and "After" buttons) or the parity
// prompt (a placeholder, no provider).
const {
  root = {},
  count,
  status,
  environment,
  settle,
  parity = false,
  undo = false,
}: {
  root?: Record<string, unknown>
  count?: number
  status?: PromptInputStatus
  environment?: Record<string, unknown>
  settle?: () => void
  parity?: boolean
  undo?: boolean
} = $props()
const rootProps = $derived({
  ...(root as PromptInputRootProps),
  ...(status ? { status } : {}),
})
</script>

{#snippet prompt()}<PromptInput.Root {...rootProps}
    ><PromptInput.Label>Message</PromptInput.Label
    >{#if !undo}<PromptInput.Attachments />{/if}<PromptInput.Textarea
      placeholder={parity ? "Ask" : undefined}
    />{#if count !== undefined}<PromptInput.CharacterCount max={count} />{/if}{#if !undo}<PromptInput.AttachTrigger
      />{/if}<PromptInput.Submit /></PromptInput.Root
  >{/snippet}

{#if environment}<RindProvider {environment}
    >{@render prompt()}<!-- Settles nothing in the plain classes: their sends settle at once. A press keeps focus. --><button
      type="button"
      tabindex={-1}
      onmousedown={(e) => e.preventDefault()}
      onclick={settle}>Settle request</button
    ><button type="button">After</button></RindProvider
  >{:else}{@render prompt()}{/if}
