<script lang="ts">
import type { MentionsQuery } from "@rind-ui/core"
import { Mentions, RindProvider } from "../../src/index"

const {
  root = {},
  full = true,
  onBound = undefined,
}: {
  root?: Record<string, unknown>
  full?: boolean
  onBound?: ((value: string) => void) | undefined
} = $props()
const PEOPLE = ["Alice", "Alan", "Bob"]
const COMMANDS = ["Clear", "Summarise"]
const TRIGGERS = [{ char: "@" }, { char: "/", behavior: "action" as const, startOfInput: true }]
let query = $state<MentionsQuery | null>(null)
const list = $derived(query?.trigger === "/" ? COMMANDS : PEOPLE)
let bound = $state("")
$effect(() => onBound?.(bound))
</script>

{#if onBound}
  <RindProvider><Mentions.Root triggers={TRIGGERS} bind:value={bound}><Mentions.Textarea aria-label="Note" /></Mentions.Root></RindProvider>
{:else if full}
  <RindProvider>
    <label for="msg">Message</label>
    <Mentions.Root triggers={TRIGGERS} onQueryChange={(q) => (query = q)} {...root}>
      <Mentions.Highlighter />
      <Mentions.Textarea id="msg" />
      <Mentions.Description />
      <Mentions.Positioner><Mentions.Popup><Mentions.List>{#each list as name (name)}<Mentions.Item value={name.toLowerCase()}><Mentions.ItemText>{name}</Mentions.ItemText></Mentions.Item>{/each}</Mentions.List></Mentions.Popup></Mentions.Positioner>
    </Mentions.Root>
  </RindProvider>
{:else}
  <RindProvider><Mentions.Root triggers={[{ char: "@" }]} defaultValue="Hi @Bob " defaultMentions={[{ id: "bob", trigger: "@", start: 3, end: 7 }]}><Mentions.Highlighter /><Mentions.Textarea aria-label="Message" /><Mentions.Description /></Mentions.Root></RindProvider>
{/if}
