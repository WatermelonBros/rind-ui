<script lang="ts">
import { QrCode } from "../../src/index"

const { root = {}, overlay = false }: { root?: Record<string, unknown>; overlay?: boolean } =
  $props()
</script>

<QrCode.Root {...root}>
  <QrCode.Frame width={220} height={220}><QrCode.Pattern /></QrCode.Frame>
  {#if overlay}<QrCode.Overlay><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width={20} height={20} /></QrCode.Overlay>{/if}
  <QrCode.ValueText />
  <QrCode.DownloadTrigger>Download</QrCode.DownloadTrigger>
</QrCode.Root>
