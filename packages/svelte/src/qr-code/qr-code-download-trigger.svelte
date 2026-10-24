<script lang="ts">
import Button from "../button/button.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { qrCodeContext } from "./context"
import type { QrCodeDownloadTriggerProps } from "./types"

/** Saves the symbol as a file; `aria-disabled` while there is no symbol. */
const { mimeType, quality, fileName, size, children, ...rest }: QrCodeDownloadTriggerProps =
  $props()
const ctx = qrCodeContext.get()
const merged = $derived(
  mergeProps(normalizeProps(ctx.connect().downloadTrigger(children !== undefined)), rest),
)
</script>

<Button
  {...merged}
  {children}
  type="button"
  disabled={ctx.state().state !== "ready"}
  focusableWhenDisabled
  onPress={(d) =>
    ctx.download({
      modality: d.modality,
      ...(mimeType === undefined ? {} : { mimeType }),
      ...(quality === undefined ? {} : { quality }),
      ...(fileName === undefined ? {} : { fileName }),
      ...(size === undefined ? {} : { size }),
    })}
/>
