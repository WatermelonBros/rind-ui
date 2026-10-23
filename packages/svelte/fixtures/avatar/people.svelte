<script lang="ts">
import { type Announcer } from "@rind-ui/core"
import { Avatar, Image, RindProvider } from "../../src/index"

const {
  src,
  delay = 0,
  show = "both",
  announcer,
}: {
  src?: string
  delay?: number
  show?: "both" | "avatar" | "image" | "group"
  announcer?: Announcer
} = $props()
</script>

<RindProvider {announcer}>
  {#if show === "group"}
    <Avatar.Group aria-label="Team">
      <Avatar.Root aria-label="Ada"><Avatar.Fallback>A</Avatar.Fallback></Avatar.Root>
      <Avatar.GroupOverflow count={3} />
    </Avatar.Group>
  {/if}
  {#if show === "both" || show === "avatar"}
    <Avatar.Root aria-label="Ada Lovelace" fallbackDelay={delay}>
      <Avatar.Image {src} />
      <Avatar.Fallback>AL</Avatar.Fallback>
    </Avatar.Root>
  {/if}
  {#if show === "both" || show === "image"}
    <Image.Root alt="A red bicycle">
      <Image.Img {src} />
      <Image.Fallback>Image unavailable</Image.Fallback>
    </Image.Root>
  {/if}
</RindProvider>
