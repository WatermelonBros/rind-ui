<script lang="ts">
import {
  blobToDataUrl,
  createQrEncoder,
  exportQr,
  type QrDownloadOptions,
  type QrMime,
  qrCodeConnect,
  qrCodeIds,
  qrCodeMachine,
  qrCodeMessages,
  qrEncodingKey,
  warnEncodeError,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useMessages } from "../provider"
import { usePartRegistry } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { qrCodeContext } from "./context"
import type { QrCodeRootProps, QrCodeState } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  encoding,
  onEncodeError,
  onDownload,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: QrCodeRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("qr-code", qrCodeMessages, () => ownMessages)
const encoder = createQrEncoder()
// Stable: reads the latest options; the encoder memoises by value and option values.
const encode = (v: string) => encoder.encode(v, encoding)
const machine = useMachine(qrCodeMachine, () => ({
  value,
  defaultValue,
  onValueChange: (v: string) => {
    onValueChange?.(v)
    if (value !== undefined) value = v
  },
  encode,
  encodingKey: qrEncodingKey("", encoding),
  root: instance,
  onDownload: (d: Parameters<NonNullable<typeof onDownload>>[0]) => onDownload?.(d),
}))
const current = $derived(machine.view.values.value)
const encoded = $derived(encode(current))
// ponytail: a Svelte Root cannot read its snippet's parts, so the frame references the
// ValueText from mount on (React's server HTML already does); add a declared flag if SSR
// descriptions matter.
const registry = usePartRegistry<"value-text">(
  untrack(() => ({ scope: "qr-code", root: instance })),
)
// Once per distinct failing value (and its options), after mount: never during render.
let reported: string | undefined
$effect(() => {
  const key = encoded.status === "invalid" ? qrEncodingKey(current, encoding) : undefined
  const e = encoded
  untrack(() => {
    if (key === undefined || key === reported) return
    reported = key
    if (e.status !== "invalid") return
    warnEncodeError(e)
    onEncodeError?.(e.error)
  })
})
// Mounted optional parts, reported to the machine (the overlay measurement needs them).
const parts = { valueText: 0, overlay: 0 }
const report = (part: "valueText" | "overlay", on: boolean) => {
  parts[part] += on ? 1 : -1
  machine.send({
    type: "PARTS.CHANGED",
    valueText: parts.valueText > 0,
    overlay: parts.overlay > 0,
  })
}
const qrState: QrCodeState = $derived({
  state: encoded.status,
  downloading: machine.view.state === "downloading",
})
const connect = $derived(
  qrCodeConnect({
    instance,
    encoded,
    downloading: qrState.downloading,
    covers: machine.view.context.coverage?.covers,
    lastDownload: machine.view.context.lastDownload?.fileName,
    messages: messages(),
  }),
)
/** The symbol as a `data:` URL (PNG by default), overlay composited like a download. */
export async function getDataUrl(
  mimeType: QrMime = "image/png",
  o: Omit<QrDownloadOptions, "mimeType" | "fileName"> = {},
) {
  const e = encoded
  if (e.status !== "ready") throw new Error("[rind-ui] qr-code: there is no symbol to export")
  const ids = qrCodeIds(instance)
  const byId = (i: string) => document.getElementById(i)
  const { blob } = await exportQr({
    modules: e.result.modules,
    quietZone: e.quietZone,
    mimeType,
    quality: o.quality,
    size: o.size ?? 1024,
    frame: byId(ids.frame),
    pattern: byId(ids.pattern),
    overlay: byId(ids.overlay),
  })
  return blobToDataUrl(blob)
}
/** Starts a download, as pressing the trigger does (ignored while one runs). */
export function download(o: QrDownloadOptions = {}) {
  machine.send({ type: "DOWNLOAD", modality: "virtual", ...o })
}
/** Proposes a new value (only `onValueChange` when controlled). */
export function setValue(v: string) {
  machine.send({ type: "VALUE.SET", value: v })
}
qrCodeContext.set({
  connect: () => connect,
  registry,
  value: () => current,
  state: () => qrState,
  download: ({ modality, ...o }) => machine.send({ type: "DOWNLOAD", modality, ...o }),
  report,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(connect.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: qrState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(qrState)}</div>
{/if}
