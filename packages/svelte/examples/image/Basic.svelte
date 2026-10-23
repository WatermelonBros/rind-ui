<script lang="ts">
import { Image } from "@rind-ui/svelte"

// An inline SVG data URL: the example needs no network.
const BIKE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#fde68a"/><g fill="none" stroke="#b91c1c" stroke-width="8"><circle cx="90" cy="120" r="40"/><circle cx="230" cy="120" r="40"/><path d="M90 120 140 60h70l20 60M140 60l30 60h60"/></g></svg>',
)}`
</script>

<Image.Root alt="A red bicycle" style="inline-size: 100%; max-inline-size: 320px; --rind-image-aspect-ratio: 16 / 9">
  <Image.Img src={BIKE} />
  <Image.Fallback>Image unavailable</Image.Fallback>
</Image.Root>
