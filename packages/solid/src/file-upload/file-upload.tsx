/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type ChangeDetails,
  type DropSource,
  domDropSource,
  dropzoneClickOpens,
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
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldControl } from "../field/context"
import { useFieldsetDisabled } from "../fieldset/context"
import { afterMount } from "../lifecycle"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
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

/** What every part's `render` receives. */
export interface FileUploadRenderState<F extends FileLike = File> {
  readonly files: readonly F[]
  readonly rejections: readonly FileRejection<F>[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

type Api = ReturnType<typeof fileUploadConnect>

interface Ctx {
  readonly api: Accessor<Api>
  readonly send: (event: FileUploadEvent) => void
  readonly state: FileUploadRenderState<FileLike>
  readonly ids: Accessor<{ readonly label: string; readonly trigger: string }>
  readonly registerLabel: ReturnType<typeof usePartRegistry<"label">>
  readonly dropSource: Accessor<DropSource<FileLike>>
  /** A removal asks for focus to move after the commit (to the index's Remove, else the Trigger). */
  readonly focusAfterRemoval: { current: number | null }
  readonly hasTrigger: { current: boolean }
}
const FileUploadContext = createContext<Ctx>()
function useFileUpload(part: string): Ctx {
  const ctx = useContext(FileUploadContext)
  if (!ctx) throw new Error(`FileUpload.${part} must be inside FileUpload.Root`)
  return ctx
}

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
function preventDocumentDrops(): () => void {
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

type PartProps<A> = Omit<A, "children"> & {
  /** Another element: a function receiving the props to spread and the state. */
  readonly render?: RenderProp<FileUploadRenderState<FileLike>> | undefined
  readonly children?: JSX.Element | ((state: FileUploadRenderState<FileLike>) => JSX.Element)
}

export type FileUploadRootProps<F extends FileLike = File> = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue" | "children"
> & {
  readonly children?: JSX.Element | ((state: FileUploadRenderState<F>) => JSX.Element)
  /** Controlled held files. */
  readonly files?: readonly F[] | undefined
  /** Uncontrolled initial files; a later change only changes what a form reset restores. */
  readonly defaultFiles?: readonly F[] | undefined
  /** The whole new list; `details.reason`: "add", "remove", "clear", "reset" or "api". */
  readonly onFilesChange?:
    | ((files: readonly F[], details: ChangeDetails<FileUploadEvent<F>>) => void)
    | undefined
  /** MIME types, `type/*` and `.ext`; an empty type falls back to the extension. */
  readonly accept?: string | readonly string[] | undefined
  /** The most files held (default 1: a new file replaces the held one). */
  readonly maxFiles?: number | undefined
  /** The largest file, in bytes. */
  readonly maxFileSize?: number | undefined
  /** The smallest file, in bytes. */
  readonly minFileSize?: number | undefined
  /** Take folders: `webkitdirectory` on the chooser, traversal on drop. */
  readonly directory?: boolean | undefined
  /** A code rejects the file (`CUSTOM`). */
  readonly validate?:
    | ((file: F, context: { readonly files: readonly F[] }) => string | null)
    | undefined
  /** Once per gesture with any rejection. */
  readonly onReject?: ((rejections: readonly FileRejection<F>[]) => void) | undefined
  /** Where drops come from (default: the DOM). A Tauri window's drag-drop events, for example. */
  readonly dropSource?: DropSource<F> | undefined
  /** A file dropped outside the Dropzone does not navigate the page. Default true. */
  readonly preventDocumentDrop?: boolean | undefined
  /** The native `capture` hint (camera on mobile). */
  readonly capture?: "user" | "environment" | undefined
  /** The form field name. */
  readonly name?: string | undefined
  /** The form id, when the File Upload is outside it. */
  readonly form?: string | undefined
  readonly disabled?: boolean | undefined
  /** Focusable and submitted, but nothing is added or removed. */
  readonly readOnly?: boolean | undefined
  readonly required?: boolean | undefined
  readonly invalid?: boolean | undefined
  readonly messages?: MessageOverrides<FileUploadMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
  readonly render?: RenderProp<FileUploadRenderState<F>> | undefined
}

function Root<F extends FileLike = File>(props: FileUploadRootProps<F>) {
  const [own, rest] = splitProps(props, [
    "files",
    "defaultFiles",
    "onFilesChange",
    "accept",
    "maxFiles",
    "maxFileSize",
    "minFileSize",
    "directory",
    "validate",
    "onReject",
    "dropSource",
    "preventDocumentDrop",
    "capture",
    "name",
    "form",
    "disabled",
    "readOnly",
    "required",
    "invalid",
    "messages",
    "locale",
    "render",
    "children",
  ])
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => rest.id)
  const locale = useLocale(() => own.locale)
  const messages = useMessages("file-upload", fileUploadMessages, () => own.messages)
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = createSignal(false)
  const registry = usePartRegistry<"label">({ scope: "file-upload", root: instance() })
  const ownLabel = useRenderedId(registry, "label")
  const [inputEl, setInputEl] = createSignal<Element | null>(null)
  const asInput = () => {
    const el = inputEl()
    return el instanceof HTMLInputElement ? el : null
  }
  const ids = createMemo(() => ({
    label: partId("file-upload", instance(), "label"),
    trigger: partId("file-upload", instance(), "trigger"),
    input: partId("file-upload", instance(), "input"),
    summary: partId("file-upload", instance(), "summary"),
  }))
  const field = createMemo(() =>
    mergeFieldProps(
      {
        role: "button",
        labelable: false,
        disabled: own.disabled === true || fieldsetContext() || fieldsetDom(),
        readOnly: own.readOnly === true,
        required: own.required === true,
        invalid: own.invalid === true,
        name: own.name,
      },
      binding?.() ?? null,
    ),
  )
  let dispatching = false
  const sync = (held: readonly FileLike[], dispatch: boolean) => {
    const el = untrack(asInput)
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
  const maxFiles = () => own.maxFiles ?? 1
  const { view, send } = useMachine(
    fileUploadMachine,
    () => ({
      id: instance(),
      messages: messages(),
      lang: locale().locale,
      files: own.files,
      defaultFiles: own.defaultFiles,
      onFilesChange: (next: readonly FileLike[], details: ChangeDetails<FileUploadEvent>) => {
        lastReason = details.reason
        ;(own.onFilesChange as ((f: readonly FileLike[], d: typeof details) => void) | undefined)?.(
          next,
          details,
        )
      },
      accept: own.accept,
      maxFiles: maxFiles(),
      maxFileSize: own.maxFileSize,
      minFileSize: own.minFileSize,
      directory: own.directory === true,
      validate: own.validate as never,
      disabled: field().disabled,
      readOnly: field().readOnly,
      onReject: (r: readonly FileRejection<FileLike>[]) =>
        (own.onReject as ((r: readonly FileRejection<FileLike>[]) => void) | undefined)?.(r),
    }),
    {
      ...env,
      // In the press's task: the chooser needs the user activation.
      openPicker: () => untrack(asInput)?.click(),
      syncInput: sync,
    },
  )
  const held = () => view().values.files
  const dragging = () => view().state === "dragging"
  const state = reactive<FileUploadRenderState<FileLike>>(() => ({
    files: held(),
    rejections: view().context.rejections,
    dragging: dragging(),
    disabled: field().disabled,
    readOnly: field().readOnly,
  }))
  const api = createMemo(() =>
    fileUploadConnect({
      instance: instance(),
      files: held(),
      dragging: dragging(),
      field: field(),
      fieldData: binding?.().data,
      ids: ids(),
      labelledBy: binding?.().ids.label ?? ownLabel(),
      messages: messages(),
      locale: locale().locale,
      accept: own.accept,
      maxFiles: maxFiles(),
      directory: own.directory === true,
      capture: own.capture,
      form: own.form,
    }),
  )
  const focusAfterRemoval = { current: null as number | null }
  const hasTrigger = { current: false }
  const [rootEl, setRootEl] = createSignal<Element | null>(null)
  afterMount(() => {
    // The input mirrors the value after every commit (hydration, a parent's change): no
    // events. Every commit, so a controlled proposal the parent ignored leaves the input as
    // the value.
    createEffect(() => {
      const now = held()
      inputEl()
      if (!dispatching) sync(now, false)
    })
    // Focus after a removal: the Remove now at that index, else the previous one, else the
    // Trigger.
    createEffect(() => {
      held()
      const index = focusAfterRemoval.current
      if (index === null) return
      focusAfterRemoval.current = null
      const removes = rootEl()?.querySelectorAll<HTMLElement>('[data-part="item-remove"]')
      const target =
        removes?.[index] ?? removes?.[index - 1] ?? document.getElementById(untrack(ids).trigger)
      if (target) void focusSafely(target, env, "programmatic", env.modality.modality())
    })
    createEffect(() => {
      if (own.preventDocumentDrop !== false && !field().disabled) onCleanup(preventDocumentDrops())
    })
    const el = untrack(asInput)
    if (el) {
      const watch = watchFieldsetDisabled(el, setFieldsetDom)
      setFieldsetDom(watch.disabled)
      // Form reset and validation focus, on the native input.
      const doc = el.ownerDocument
      const onReset = (e: Event) => {
        if (e.target !== el.form || e.defaultPrevented) return
        send({ type: "RESET" })
        // The browser clears the input after this event: mirror the value again after it.
        queueMicrotask(() => sync(untrack(held), false))
      }
      const onFocus = () => {
        const trigger = doc.getElementById(untrack(ids).trigger)
        if (trigger) void focusSafely(trigger, env, "programmatic", "keyboard")
      }
      doc.addEventListener("reset", onReset)
      el.addEventListener("focus", onFocus)
      onCleanup(() => {
        watch.stop()
        doc.removeEventListener("reset", onReset)
        el.removeEventListener("focus", onFocus)
      })
    }
    // field-control: one control; the input is its validity element, the Trigger its focus.
    if (binding) {
      createEffect(() => {
        const trigger = ids().trigger
        onCleanup(
          untrack(() =>
            binding().register(
              {
                id: trigger,
                labelable: false,
                focus: (m) => {
                  const t = document.getElementById(trigger)
                  if (t) void focusSafely(t, env, "programmatic", m)
                },
                validityElement: asInput,
                value: () => untrack(held),
              },
              trigger,
            ),
          ),
        )
      })
    }
    let reported = untrack(held)
    createEffect(() => {
      const now = held()
      if (reported === now) return
      reported = now
      const user = lastReason !== null && lastReason !== "reset"
      lastReason = null
      untrack(() => {
        binding?.().report({ type: "change", value: now, user, composing: false })
        if (user) binding?.().report({ type: "commit" })
      })
    })
    if (process.env.NODE_ENV !== "production") {
      if (!hasTrigger.current && !untrack(field).disabled) {
        console.warn("[rind-ui] file-upload: render FileUpload.Trigger, the keyboard way in")
      }
      if (own.directory && maxFiles() === 1) {
        console.warn(
          "[rind-ui] file-upload: `directory` with `maxFiles` 1 keeps one file of a folder",
        )
      }
    }
  })
  const editable = () => !field().disabled && !field().readOnly
  const defaultSource = domDropSource({
    directory: () => own.directory === true,
    refuse: () => !editable(),
  })
  const ctx: Ctx = {
    api,
    send,
    state,
    ids,
    registerLabel: registry,
    dropSource: () => (own.dropSource ?? defaultSource) as DropSource<FileLike>,
    focusAfterRemoval,
    hasTrigger,
  }
  const rootProps = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(api().root()), {
          // A paste of files while focus is inside: one gesture (text pastes are the platform's).
          onPaste: (e: ClipboardEvent) => {
            if (!editable()) return
            const pasted = filesFromClipboard(e.clipboardData)
            if (!pasted) return
            e.preventDefault()
            send({ type: "FILES.ADD", files: pasted, source: "paste" })
          },
        }),
        ref: setRootEl,
        ...(rest.id === undefined ? {} : { id: rest.id }),
      },
      rest,
    ),
  )
  const inputProps = createMemo(() =>
    mergeProps(normalizeProps(api().hiddenInput()), {
      ref: setInputEl,
      // Not into the Dropzone: its press would open the chooser twice (RA#10092).
      onClick: (e: MouseEvent) => e.stopPropagation(),
      onChange: (e: Event) => {
        if (dispatching) return
        const el = e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null
        const picked = Array.from(el?.files ?? [])
        // A cancelled chooser (older engines report an empty change): keep the files.
        if (picked.length === 0) {
          sync(untrack(held), false)
          return
        }
        send({ type: "FILES.ADD", files: picked, source: "pick" })
      },
    }),
  )
  const children = () => (
    <>
      {resolveChildren(own.children as JSX.Element, state)}
      <input {...inputProps()} />
      <span {...normalizeProps(api().summary())}>{api().summaryText}</span>
    </>
  )
  return (
    <FileUploadContext.Provider value={ctx}>
      {renderPart(
        own.render as RenderProp<FileUploadRenderState<FileLike>> | undefined,
        rootProps,
        state,
        children,
        (p) => (
          <div {...p}>{children()}</div>
        ),
      )}
    </FileUploadContext.Provider>
  )
}

export type FileUploadLabelProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function Label(props: FileUploadLabelProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("Label")
  const own = () => rest.id ?? ctx.ids().label
  useRegisterPart(ctx.registerLabel, "label", own)
  // A press on the Label focuses the Trigger without opening the chooser.
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().label()), {
          onClick: () => document.getElementById(ctx.ids().trigger)?.focus(),
        }),
        id: own(),
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type FileUploadDropzoneProps = PartProps<JSX.HTMLAttributes<HTMLDivElement>>

function Dropzone(props: FileUploadDropzoneProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("Dropzone")
  const [el, setEl] = createSignal<Element | null>(null)
  const { send } = ctx
  afterMount(() => {
    createEffect(() => {
      const zone = el()
      const source = ctx.dropSource()
      if (!(zone instanceof HTMLElement)) return
      onCleanup(
        source(zone, {
          enter: () => send({ type: "DRAG.ENTER" }),
          leave: () => send({ type: "DRAG.LEAVE" }),
          drop: (files, refused) =>
            send({
              type: "FILES.ADD",
              files,
              source: "drop",
              ...(refused && refused.length > 0 ? { refused } : {}),
            }),
        }),
      )
    })
  })
  const merged = createMemo(() =>
    mergeProps(
      {
        ...joinHandlers(normalizeProps(ctx.api().dropzone()), {
          // A press on the zone's own area opens the chooser; presses on its controls, labels
          // and the input do not (no double open: zag#3387, react-dropzone#182).
          onClick: (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0) return
            const target = e.target as Element
            if (!dropzoneClickOpens(target, e.currentTarget as Element)) return
            send({ type: "PICKER.OPEN" })
          },
        }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <div {...p}>{children()}</div>
  ))
}

function useFocusRing() {
  const env = useEnvironment()
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const [focused, setFocused] = createSignal(false)
  const modality = useModality(env.modality, focused)
  return { focused, setFocused, modality }
}

export type FileUploadTriggerProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function Trigger(props: FileUploadTriggerProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("Trigger")
  ctx.hasTrigger.current = true
  const { focused, setFocused, modality } = useFocusRing()
  const merged = createMemo(() => {
    const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    return mergeProps(
      joinHandlers(
        normalizeProps(ctx.api().trigger({ focused: focused(), modality: modality(), named })),
        {
          onClick: () => ctx.send({ type: "PICKER.OPEN" }),
          onFocusIn: () => setFocused(true),
          onFocusOut: () => setFocused(false),
        },
      ),
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

export type FileUploadItemGroupProps = PartProps<JSX.HTMLAttributes<HTMLUListElement>>

function ItemGroup(props: FileUploadItemGroupProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("ItemGroup")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().itemGroup()), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <Show when={ctx.state.files.length > 0}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <ul {...p}>{children()}</ul>
      ))}
    </Show>
  )
}

interface ItemCtx {
  readonly file: Accessor<FileLike>
  readonly index: Accessor<number>
}
const ItemContext = createContext<ItemCtx>()
function useItem(part: string): ItemCtx {
  const item = useContext(ItemContext)
  if (!item) throw new Error(`FileUpload.${part} must be inside FileUpload.Item`)
  return item
}

export type FileUploadItemProps = PartProps<JSX.LiHTMLAttributes<HTMLLIElement>> & {
  /** The held file this Item shows. */
  readonly file: FileLike
}

function Item(props: FileUploadItemProps) {
  const [local, rest] = splitProps(props, ["render", "file", "children"])
  const ctx = useFileUpload("Item")
  const index = createMemo(() => ctx.state.files.indexOf(local.file))
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().item(index())), rest))
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <ItemContext.Provider value={{ file: () => local.file, index }}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <li {...p}>{children()}</li>
      ))}
    </ItemContext.Provider>
  )
}

export type FileUploadTextProps = PartProps<JSX.HTMLAttributes<HTMLSpanElement>>

function ItemName(props: FileUploadTextProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("ItemName")
  const item = useItem("ItemName")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().itemName()), rest))
  const children = () => resolveChildren(local.children, ctx.state) ?? item.file().name
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

function ItemSize(props: FileUploadTextProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("ItemSize")
  const item = useItem("ItemSize")
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().itemSize()), rest))
  const children = () =>
    resolveChildren(local.children, ctx.state) ?? ctx.api().itemSizeText(item.file())
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <span {...p}>{children()}</span>
  ))
}

export type FileUploadItemPreviewProps = PartProps<JSX.ImgHTMLAttributes<HTMLImageElement>>

function ItemPreview(props: FileUploadItemPreviewProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("ItemPreview")
  const item = useItem("ItemPreview")
  const [url, setUrl] = createSignal<string | null>(null)
  afterMount(() => {
    createEffect(() => {
      const file = item.file()
      if (
        typeof File === "undefined" ||
        !(file instanceof File) ||
        !file.type.startsWith("image/")
      ) {
        setUrl(null)
        return
      }
      const next = URL.createObjectURL(file)
      setUrl(next)
      // Revoked when the file changes or the preview unmounts.
      onCleanup(() => URL.revokeObjectURL(next))
    })
  })
  const merged = createMemo(() =>
    mergeProps(normalizeProps(ctx.api().itemPreview()), { src: url() }, rest),
  )
  return (
    <Show when={url()}>
      {renderPart(
        local.render,
        merged,
        ctx.state,
        () => undefined,
        (p) => (
          <img alt="" {...p} />
        ),
      )}
    </Show>
  )
}

export type FileUploadButtonProps = PartProps<JSX.ButtonHTMLAttributes<HTMLButtonElement>>

function ItemRemove(props: FileUploadButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("ItemRemove")
  const item = useItem("ItemRemove")
  const merged = createMemo(() => {
    const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    return mergeProps(
      joinHandlers(normalizeProps(ctx.api().itemRemove(item.file(), named)), {
        onClick: () => {
          ctx.focusAfterRemoval.current = item.index()
          ctx.send({ type: "FILE.REMOVE", file: item.file() })
        },
      }),
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return renderPart(local.render, merged, ctx.state, children, (p) => (
    <button {...p}>{children()}</button>
  ))
}

function ClearTrigger(props: FileUploadButtonProps) {
  const [local, rest] = splitProps(props, ["render", "children"])
  const ctx = useFileUpload("ClearTrigger")
  const merged = createMemo(() => {
    const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
    return mergeProps(
      joinHandlers(normalizeProps(ctx.api().clearTrigger(named)), {
        onClick: () => {
          // After a clear: the Trigger (index -1 finds no Remove).
          ctx.focusAfterRemoval.current = -1
          ctx.send({ type: "FILES.CLEAR" })
        },
      }),
      rest,
    )
  })
  const children = () => resolveChildren(local.children, ctx.state)
  return (
    <Show when={ctx.state.files.length > 0}>
      {renderPart(local.render, merged, ctx.state, children, (p) => (
        <button {...p}>{children()}</button>
      ))}
    </Show>
  )
}

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
