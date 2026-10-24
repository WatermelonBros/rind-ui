import {
  announcerCapability,
  type ChangeDetails,
  type DropSource,
  domDropSource,
  type FileLike,
  type FileRejection,
  type FileUploadEvent,
  type FileUploadMessages,
  filesFromClipboard,
  fileUploadConnect,
  fileUploadMachine,
  fileUploadMessages,
  focusSafely,
  type MessageOverrides,
  mergeFieldProps,
  partId,
  syncFileInput,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  computed,
  defineComponent,
  h,
  type InjectionKey,
  inject,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
  watch,
} from "vue"
import { changeEmitter } from "../emit-change"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers } from "../join-handlers"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"

declare module "../provider" {
  interface RindMessageScopes {
    "file-upload": FileUploadMessages
  }
}

// Bundlers replace `process.env.NODE_ENV` and drop the dead branch in production builds.
declare const process: { env: { NODE_ENV?: string } }

/** What every part's slot receives. */
export interface FileUploadRenderState<F extends FileLike = File> {
  readonly files: readonly F[]
  readonly rejections: readonly FileRejection<F>[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

interface Ctx {
  readonly api: () => ReturnType<typeof fileUploadConnect>
  readonly send: (event: FileUploadEvent) => void
  readonly state: () => FileUploadRenderState<FileLike>
  readonly ids: () => { readonly label: string; readonly trigger: string }
  readonly registry: PartRegistry<"label">
  readonly dropSource: () => DropSource<FileLike>
  /** A removal asks for focus to move after the update (to the index's Remove, else the Trigger). */
  readonly focusAfterRemoval: { current: number | null }
  readonly hasTrigger: { current: boolean }
}
const FileUploadKey: InjectionKey<Ctx> = Symbol("rind-ui.file-upload")
function useFileUpload(part: string): Ctx {
  const ctx = inject(FileUploadKey, null)
  if (!ctx) throw new Error(`FileUpload.${part} must be inside FileUpload.Root`)
  return ctx
}
type Slots = SlotsType<{ default?: (state: FileUploadRenderState<FileLike>) => VNodeChild }>

// ── Missed drops (design §6): one document listener, reference counted ──
let documentDropUsers = 0
const preventMissedDrop = (e: DragEvent) => {
  if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return
  const target = e.target as Element | null
  if (target?.closest?.('[data-scope="file-upload"][data-part="dropzone"]')) return
  // A file dropped outside a Dropzone would navigate the tab to it.
  e.preventDefault()
  if (e.dataTransfer && e.type === "dragover") e.dataTransfer.dropEffect = "none"
}
function preventDocumentDrops() {
  if (documentDropUsers++ === 0) {
    document.addEventListener("dragover", preventMissedDrop)
    document.addEventListener("drop", preventMissedDrop)
  }
  return () => {
    if (--documentDropUsers === 0) {
      document.removeEventListener("dragover", preventMissedDrop)
      document.removeEventListener("drop", preventMissedDrop)
    }
  }
}

const Root = defineComponent({
  name: "FileUploadRoot",
  inheritAttrs: false,
  props: {
    /** Controlled held files (`v-model:files`). */
    files: Array as PropType<readonly FileLike[]>,
    /** Uncontrolled initial files; a later change only changes what a form reset restores. */
    defaultFiles: Array as PropType<readonly FileLike[]>,
    /** MIME types, `type/*` and `.ext`; an empty type falls back to the extension. */
    accept: [String, Array] as PropType<string | readonly string[]>,
    /** The most files held (default 1: a new file replaces the held one). */
    maxFiles: { type: Number, default: 1 },
    /** The largest file, in bytes. */
    maxFileSize: Number,
    /** The smallest file, in bytes. */
    minFileSize: Number,
    /** Take folders: `webkitdirectory` on the chooser, traversal on drop. */
    directory: Boolean,
    /** A code rejects the file (`CUSTOM`). */
    validate: Function as PropType<
      (file: FileLike, context: { readonly files: readonly FileLike[] }) => string | null
    >,
    /** Where drops come from (default: the DOM). A Tauri window's drag-drop events, for example. */
    dropSource: Function as PropType<DropSource<FileLike>>,
    /** A file dropped outside the Dropzone does not navigate the page. Default true. */
    preventDocumentDrop: { type: Boolean, default: true },
    /** The native `capture` hint (camera on mobile). */
    capture: String as PropType<"user" | "environment">,
    /** The form field name. */
    name: String,
    /** The form id, when the File Upload is outside it. */
    form: String,
    disabled: Boolean,
    /** Focusable and submitted, but nothing is added or removed. */
    readonly: Boolean,
    required: Boolean,
    invalid: Boolean,
    messages: Object as PropType<MessageOverrides<FileUploadMessages>>,
    /** Default: the provider's locale. */
    locale: String,
    id: String,
    ...asChildProp,
  },
  emits: {
    /** The whole new list; `details.reason`: "add", "remove", "clear", "reset" or "api". */
    filesChange: (_files: readonly FileLike[], _details: ChangeDetails<FileUploadEvent>) => true,
    "update:files": (_files: readonly FileLike[]) => true,
    /** Once per gesture with any rejection. */
    reject: (_rejections: readonly FileRejection<FileLike>[]) => true,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots, emit }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const locale = useLocale(() => props.locale)
    const messages = useMessages("file-upload", fileUploadMessages, () => props.messages)
    const binding = useFieldControl()
    const fieldsetContext = useFieldsetDisabled()
    const fieldsetDom = shallowRef(false)
    const registry = usePartRegistry<"label">({ scope: "file-upload", root: instance() })
    const ownLabel = useRenderedId(registry, "label")
    const input = shallowRef<Element | null>(null)
    const inputEl = () => (input.value instanceof HTMLInputElement ? input.value : null)
    const ids = () => ({
      label: partId("file-upload", instance(), "label"),
      trigger: partId("file-upload", instance(), "trigger"),
      input: partId("file-upload", instance(), "input"),
      summary: partId("file-upload", instance(), "summary"),
    })
    const field = computed(() =>
      mergeFieldProps(
        {
          role: "button",
          labelable: false,
          disabled: props.disabled || fieldsetContext.value || fieldsetDom.value,
          readOnly: props.readonly,
          required: props.required,
          invalid: props.invalid,
          name: props.name,
        },
        binding?.value ?? null,
      ),
    )
    let dispatching = false
    const sync = (held: readonly FileLike[], dispatch: boolean) => {
      const el = inputEl()
      if (!el) return
      // Only real File objects reach the form; records from another source (paths) never do.
      syncFileInput(
        el,
        held.filter((f): f is File => typeof File !== "undefined" && f instanceof File),
      )
      if (!dispatch) return
      dispatching = true
      try {
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
      } finally {
        dispatching = false
      }
    }
    let lastReason: string | null = null
    const onFilesChange = changeEmitter<readonly FileLike[], FileUploadEvent>(
      (v, d) => {
        lastReason = d.reason
        emit("filesChange", v, d)
      },
      (v) => emit("update:files", v),
    )
    const { view, send } = useMachine(
      fileUploadMachine,
      () => ({
        id: instance(),
        messages: messages.value,
        lang: locale.value.locale,
        files: props.files,
        defaultFiles: props.defaultFiles,
        onFilesChange,
        accept: props.accept,
        maxFiles: props.maxFiles,
        maxFileSize: props.maxFileSize,
        minFileSize: props.minFileSize,
        directory: props.directory,
        validate: props.validate as never,
        disabled: field.value.disabled,
        readOnly: field.value.readOnly,
        onReject: (r: readonly FileRejection<FileLike>[]) => emit("reject", r),
      }),
      {
        ...env,
        // In the press's task: the chooser needs the user activation.
        openPicker: () => inputEl()?.click(),
        syncInput: sync,
      },
    )
    const held = () => view.value.values.files
    const state = computed(
      (): FileUploadRenderState<FileLike> => ({
        files: held(),
        rejections: view.value.context.rejections,
        dragging: view.value.state === "dragging",
        disabled: field.value.disabled,
        readOnly: field.value.readOnly,
      }),
    )
    const api = computed(() =>
      fileUploadConnect({
        instance: instance(),
        files: held(),
        dragging: state.value.dragging,
        field: field.value,
        fieldData: binding?.value.data,
        ids: ids(),
        labelledBy: binding?.value.ids.label ?? ownLabel.value,
        messages: messages.value,
        locale: locale.value.locale,
        accept: props.accept,
        maxFiles: props.maxFiles,
        directory: props.directory,
        capture: props.capture,
        form: props.form,
      }),
    )
    const focusAfterRemoval = { current: null as number | null }
    const hasTrigger = { current: false }
    const rootEl = shallowRef<Element | null>(null)
    // Every update, so a controlled proposal the parent ignored leaves the input as the value.
    const afterRender = () => {
      if (!dispatching) sync(held(), false)
      // Focus after a removal: the Remove now at that index, else the previous one, else the Trigger.
      const index = focusAfterRemoval.current
      if (index === null) return
      focusAfterRemoval.current = null
      const removes = rootEl.value?.querySelectorAll<HTMLElement>('[data-part="item-remove"]')
      const target =
        removes?.[index] ?? removes?.[index - 1] ?? document.getElementById(ids().trigger)
      if (target) void focusSafely(target, env, "programmatic", env.modality.modality())
    }
    onUpdated(afterRender)
    onMounted(() => {
      afterRender()
      watch(
        () => props.preventDocumentDrop && !field.value.disabled,
        (on, _old, onCleanup) => {
          if (on) onCleanup(preventDocumentDrops())
        },
        { immediate: true },
      )
      const el = inputEl()
      if (el) {
        const w = watchFieldsetDisabled(el, (d) => (fieldsetDom.value = d))
        fieldsetDom.value = w.disabled
        // Form reset and validation focus, on the native input.
        const doc = el.ownerDocument
        const onReset = (e: Event) => {
          if (e.target !== el.form || e.defaultPrevented) return
          send({ type: "RESET" })
          // The browser clears the input after this event: mirror the value again after it.
          queueMicrotask(() => sync(held(), false))
        }
        const onFocus = () => {
          const trigger = doc.getElementById(ids().trigger)
          if (trigger) void focusSafely(trigger, env, "programmatic", "keyboard")
        }
        doc.addEventListener("reset", onReset)
        el.addEventListener("focus", onFocus)
        onBeforeUnmount(() => {
          w.stop()
          doc.removeEventListener("reset", onReset)
          el.removeEventListener("focus", onFocus)
        })
      }
      // field-control: one control; the input is its validity element, the Trigger its focus.
      if (binding) {
        const trigger = ids().trigger
        onBeforeUnmount(
          binding.value.register(
            {
              id: trigger,
              labelable: false,
              focus: (m) => {
                const t = document.getElementById(trigger)
                if (t) void focusSafely(t, env, "programmatic", m)
              },
              validityElement: inputEl,
              value: held,
            },
            trigger,
          ),
        )
      }
      let reported = held()
      watch(held, (now) => {
        if (reported === now) return
        reported = now
        const user = lastReason !== null && lastReason !== "reset"
        lastReason = null
        binding?.value.report({ type: "change", value: now, user, composing: false })
        if (user) binding?.value.report({ type: "commit" })
      })
      if (process.env.NODE_ENV !== "production") {
        if (!hasTrigger.current && !field.value.disabled)
          console.warn("[rind-ui] file-upload: render FileUpload.Trigger, the keyboard way in")
        if (props.directory && props.maxFiles === 1)
          console.warn(
            "[rind-ui] file-upload: `directory` with `maxFiles` 1 keeps one file of a folder",
          )
      }
    })
    const editable = () => !field.value.disabled && !field.value.readOnly
    const defaultSource = domDropSource({
      directory: () => props.directory,
      refuse: () => !editable(),
    })
    provide(FileUploadKey, {
      api: () => api.value,
      send,
      state: () => state.value,
      ids,
      registry,
      dropSource: () => props.dropSource ?? defaultSource,
      focusAfterRemoval,
      hasTrigger,
    })
    return () => {
      const a = api.value
      return renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(a.root()), {
              // A paste of files while focus is inside: one gesture (text pastes are the platform's).
              onPaste: (e: ClipboardEvent) => {
                if (!editable()) return
                const pasted = filesFromClipboard(e.clipboardData)
                if (!pasted) return
                e.preventDefault()
                send({ type: "FILES.ADD", files: pasted, source: "paste" })
              },
            }),
            ref: refTo(rootEl),
            ...(props.id === undefined ? {} : { id: props.id }),
          },
          attrs,
        ),
        [
          slots.default?.(state.value),
          h("input", {
            ...normalizeProps(a.hiddenInput()),
            ref: refTo(input),
            // Not into the Dropzone: its press would open the chooser twice (RA#10092).
            onClick: (e: MouseEvent) => e.stopPropagation(),
            onChange: (e: Event) => {
              if (dispatching) return
              const el = e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null
              const picked = Array.from(el?.files ?? [])
              // A cancelled chooser (older engines report an empty change): keep the files.
              if (picked.length === 0) {
                sync(held(), false)
                return
              }
              send({ type: "FILES.ADD", files: picked, source: "pick" })
            },
          }),
          h("span", normalizeProps(a.summary()), a.summaryText),
        ],
        props.asChild,
      )
    }
  },
})

const Label = defineComponent({
  name: "FileUploadLabel",
  inheritAttrs: false,
  props: { id: String, ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("Label")
    const own = () => props.id ?? ctx.ids().label
    useRegisterPart(ctx.registry, "label", own)
    return () =>
      renderPart(
        "span",
        mergeProps(
          {
            // A press on the Label focuses the Trigger without opening the chooser.
            ...joinHandlers(normalizeProps(ctx.api().label()), {
              onClick: () => document.getElementById(ctx.ids().trigger)?.focus(),
            }),
            id: own(),
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const INTERACTIVE =
  'button, a[href], input, select, textarea, label, [role="button"], [contenteditable=""], [contenteditable="true"], [tabindex]'

const Dropzone = defineComponent({
  name: "FileUploadDropzone",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("Dropzone")
    const el = shallowRef<Element | null>(null)
    onMounted(() =>
      watch(
        ctx.dropSource,
        (source, _old, onCleanup) => {
          const zone = el.value
          if (!(zone instanceof HTMLElement)) return
          onCleanup(
            source(zone, {
              enter: () => ctx.send({ type: "DRAG.ENTER" }),
              leave: () => ctx.send({ type: "DRAG.LEAVE" }),
              drop: (files, refused) =>
                ctx.send({
                  type: "FILES.ADD",
                  files,
                  source: "drop",
                  ...(refused && refused.length > 0 ? { refused } : {}),
                }),
            }),
          )
        },
        { immediate: true },
      ),
    )
    return () =>
      renderPart(
        "div",
        mergeProps(
          {
            ...joinHandlers(normalizeProps(ctx.api().dropzone()), {
              // A press on the zone's own area opens the chooser; presses on its controls, labels
              // and the input do not (no double open: zag#3387, react-dropzone#182).
              onClick: (e: MouseEvent) => {
                if (e.defaultPrevented || e.button !== 0) return
                const target = e.target as Element
                if (target !== e.currentTarget && target.closest(INTERACTIVE)) return
                ctx.send({ type: "PICKER.OPEN" })
              },
            }),
            ref: refTo(el),
          },
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const Trigger = defineComponent({
  name: "FileUploadTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("Trigger")
    ctx.hasTrigger.current = true
    const env = useEnvironment()
    onMounted(() => onBeforeUnmount(env.modality.subscribe(() => {})))
    const focused = shallowRef(false)
    const modality = useModality(env.modality, () => focused.value)
    return () => {
      const named = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
      return renderPart(
        "button",
        mergeProps(
          joinHandlers(
            normalizeProps(
              ctx.api().trigger({ focused: focused.value, modality: modality.value, named }),
            ),
            {
              onClick: () => ctx.send({ type: "PICKER.OPEN" }),
              onFocusin: () => (focused.value = true),
              onFocusout: () => (focused.value = false),
            },
          ),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

const ItemGroup = defineComponent({
  name: "FileUploadItemGroup",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("ItemGroup")
    return () =>
      ctx.state().files.length === 0
        ? null
        : renderPart(
            "ul",
            mergeProps(normalizeProps(ctx.api().itemGroup()), attrs),
            slots.default?.(ctx.state()),
            props.asChild,
          )
  },
})

interface ItemCtx {
  readonly file: () => FileLike
  readonly index: () => number
}
const ItemKey: InjectionKey<ItemCtx> = Symbol("rind-ui.file-upload-item")
function useItem(part: string): ItemCtx {
  const item = inject(ItemKey, null)
  if (!item) throw new Error(`FileUpload.${part} must be inside FileUpload.Item`)
  return item
}

const Item = defineComponent({
  name: "FileUploadItem",
  inheritAttrs: false,
  props: {
    /** The held file this Item shows. */
    file: { type: Object as PropType<FileLike>, required: true },
    ...asChildProp,
  },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("Item")
    const index = () => ctx.state().files.indexOf(props.file)
    provide(ItemKey, { file: () => props.file, index })
    return () =>
      renderPart(
        "li",
        mergeProps(normalizeProps(ctx.api().item(index())), attrs),
        slots.default?.(ctx.state()),
        props.asChild,
      )
  },
})

const ItemName = defineComponent({
  name: "FileUploadItemName",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("ItemName")
    const item = useItem("ItemName")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().itemName()), attrs),
        slots.default?.(ctx.state()) ?? item.file().name,
        props.asChild,
      )
  },
})

const ItemSize = defineComponent({
  name: "FileUploadItemSize",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("ItemSize")
    const item = useItem("ItemSize")
    return () =>
      renderPart(
        "span",
        mergeProps(normalizeProps(ctx.api().itemSize()), attrs),
        slots.default?.(ctx.state()) ?? ctx.api().itemSizeText(item.file()),
        props.asChild,
      )
  },
})

const ItemPreview = defineComponent({
  name: "FileUploadItemPreview",
  inheritAttrs: false,
  props: { ...asChildProp },
  setup(props, { attrs }) {
    const ctx = useFileUpload("ItemPreview")
    const item = useItem("ItemPreview")
    const url = shallowRef<string | null>(null)
    onMounted(() =>
      watch(
        item.file,
        (file, _old, onCleanup) => {
          if (
            typeof File === "undefined" ||
            !(file instanceof File) ||
            !file.type.startsWith("image/")
          ) {
            url.value = null
            return
          }
          const next = URL.createObjectURL(file)
          url.value = next
          // Revoked when the file changes or the preview unmounts.
          onCleanup(() => URL.revokeObjectURL(next))
        },
        { immediate: true },
      ),
    )
    return () =>
      url.value
        ? renderPart(
            "img",
            mergeProps(normalizeProps(ctx.api().itemPreview()), { src: url.value }, attrs),
            undefined,
            props.asChild,
          )
        : null
  },
})

const ItemRemove = defineComponent({
  name: "FileUploadItemRemove",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("ItemRemove")
    const item = useItem("ItemRemove")
    return () => {
      const named = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
      return renderPart(
        "button",
        mergeProps(
          joinHandlers(normalizeProps(ctx.api().itemRemove(item.file(), named)), {
            onClick: () => {
              ctx.focusAfterRemoval.current = item.index()
              ctx.send({ type: "FILE.REMOVE", file: item.file() })
            },
          }),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

const ClearTrigger = defineComponent({
  name: "FileUploadClearTrigger",
  inheritAttrs: false,
  props: { ...asChildProp },
  slots: Object as Slots,
  setup(props, { attrs, slots }) {
    const ctx = useFileUpload("ClearTrigger")
    return () => {
      if (ctx.state().files.length === 0) return null
      const named = attrs["aria-label"] !== undefined || attrs["aria-labelledby"] !== undefined
      return renderPart(
        "button",
        mergeProps(
          joinHandlers(normalizeProps(ctx.api().clearTrigger(named)), {
            onClick: () => {
              // After a clear: the Trigger (index -1 finds no Remove).
              ctx.focusAfterRemoval.current = -1
              ctx.send({ type: "FILES.CLEAR" })
            },
          }),
          attrs,
        ),
        slots.default?.(ctx.state()),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `file-upload.parts.ts` re-exports them as the `FileUpload` namespace. */
export {
  ClearTrigger,
  Dropzone,
  Item,
  ItemGroup,
  ItemName,
  ItemPreview,
  ItemRemove,
  ItemSize,
  Label,
  Root,
  Trigger,
}
