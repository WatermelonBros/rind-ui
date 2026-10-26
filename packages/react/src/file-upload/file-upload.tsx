"use client"

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
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useFieldControl } from "../field/field"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
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

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

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
  readonly api: Api
  readonly send: (event: FileUploadEvent) => void
  readonly state: FileUploadRenderState<FileLike>
  readonly instance: string
  readonly ids: { readonly label: string; readonly trigger: string }
  readonly registerLabel: ReturnType<typeof usePartRegistry<"label">>
  readonly dropSource: DropSource<FileLike>
  /** A removal asks for focus to move after the commit (to the index's Remove, else the Trigger). */
  readonly focusAfterRemoval: { current: number | null }
  readonly hasTrigger: { current: boolean }
}
const FileUploadContext = createContext<Ctx | null>(null)
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
function useDocumentDropPrevention(on: boolean) {
  useEffect(() => {
    if (!on || typeof document === "undefined") return
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
  }, [on])
}

export type FileUploadRootProps<F extends FileLike = File> = Omit<
  ComponentPropsWithRef<"div">,
  "onChange" | "defaultValue"
> & {
  /** Controlled held files. */
  readonly files?: readonly F[]
  /** Uncontrolled initial files; a later change only changes what a form reset restores. */
  readonly defaultFiles?: readonly F[]
  /** The whole new list; `details.reason`: "add", "remove", "clear", "reset" or "api". */
  readonly onFilesChange?: (files: readonly F[], details: ChangeDetails<FileUploadEvent<F>>) => void
  /** MIME types, `type/*` and `.ext`; an empty type falls back to the extension. */
  readonly accept?: string | readonly string[]
  /** The most files held (default 1: a new file replaces the held one). */
  readonly maxFiles?: number
  /** The largest file, in bytes. */
  readonly maxFileSize?: number
  /** The smallest file, in bytes. */
  readonly minFileSize?: number
  /** Take folders: `webkitdirectory` on the chooser, traversal on drop. */
  readonly directory?: boolean
  /** A code rejects the file (`CUSTOM`). */
  readonly validate?: (file: F, context: { readonly files: readonly F[] }) => string | null
  /** Once per gesture with any rejection. */
  readonly onReject?: (rejections: readonly FileRejection<F>[]) => void
  /** Where drops come from (default: the DOM). A Tauri window's drag-drop events, for example. */
  readonly dropSource?: DropSource<F>
  /** A file dropped outside the Dropzone does not navigate the page. Default true. */
  readonly preventDocumentDrop?: boolean
  /** The native `capture` hint (camera on mobile). */
  readonly capture?: "user" | "environment"
  /** The form field name. */
  readonly name?: string
  /** The form id, when the File Upload is outside it. */
  readonly form?: string
  readonly disabled?: boolean
  /** Focusable and submitted, but nothing is added or removed. */
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
  readonly messages?: MessageOverrides<FileUploadMessages>
  /** Default: the provider's locale. */
  readonly locale?: string
  readonly render?: RenderProp<FileUploadRenderState<F>>
}

function Root<F extends FileLike = File>(props: FileUploadRootProps<F>) {
  const {
    files,
    defaultFiles,
    onFilesChange,
    accept,
    maxFiles = 1,
    maxFileSize,
    minFileSize,
    directory = false,
    validate,
    onReject,
    dropSource,
    preventDocumentDrop = true,
    capture,
    name,
    form,
    disabled = false,
    readOnly = false,
    required = false,
    invalid = false,
    messages: ownMessages,
    locale: ownLocale,
    render,
    id,
    ref,
    children,
    ...rest
  } = props
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(id)
  const { locale } = useLocale(ownLocale)
  const messages = useMessages("file-upload", fileUploadMessages, ownMessages)
  const binding = useFieldControl()
  const fieldsetContext = useFieldsetDisabled()
  const [fieldsetDom, setFieldsetDom] = useState(false)
  const registry = usePartRegistry<"label">({ scope: "file-upload", root: instance })
  const ownLabel = useRenderedId(registry, "label")
  const input = useRef<HTMLInputElement | null>(null)
  const ids = {
    label: partId("file-upload", instance, "label"),
    trigger: partId("file-upload", instance, "trigger"),
    input: partId("file-upload", instance, "input"),
    summary: partId("file-upload", instance, "summary"),
  }
  const field = mergeFieldProps(
    {
      role: "button",
      labelable: false,
      disabled: disabled || fieldsetContext || fieldsetDom,
      readOnly,
      required,
      invalid,
      name,
    },
    binding,
  )
  const dispatching = useRef(false)
  const sync = (held: readonly FileLike[], dispatch: boolean) => {
    const el = input.current
    if (!el) return
    // Only real File objects reach the form; records from another source (paths) never do.
    syncFileInput(
      el,
      held.filter((f): f is File => typeof File !== "undefined" && f instanceof File),
    )
    if (!dispatch) return
    dispatching.current = true
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    } finally {
      dispatching.current = false
    }
  }
  const syncRef = useRef(sync)
  syncRef.current = sync
  const [machineEnv] = useState(() => ({
    ...env,
    // In the press's task: the chooser needs the user activation.
    openPicker: () => input.current?.click(),
    syncInput: (held: readonly FileLike[], dispatch: boolean) => syncRef.current(held, dispatch),
  }))
  const lastReason = useRef<string | null>(null)
  const report = binding?.report
  const { view, send } = useMachine(
    fileUploadMachine,
    {
      id: instance,
      messages,
      lang: locale,
      files,
      defaultFiles,
      onFilesChange: onFilesChange
        ? (next, details) => {
            lastReason.current = details.reason
            onFilesChange(next as readonly F[], details as ChangeDetails<FileUploadEvent<F>>)
          }
        : (_next, details) => {
            lastReason.current = details.reason
          },
      accept,
      maxFiles,
      maxFileSize,
      minFileSize,
      directory,
      validate: validate as never,
      disabled: field.disabled,
      readOnly: field.readOnly,
      onReject: onReject as never,
    },
    machineEnv,
  )
  const held = view.values.files
  const dragging = view.state === "dragging"
  const api = fileUploadConnect({
    instance,
    files: held,
    dragging,
    field,
    fieldData: binding?.data,
    ids,
    labelledBy: binding?.ids.label ?? ownLabel,
    messages,
    locale,
    accept,
    maxFiles,
    directory,
    capture,
    form,
  })
  const state: FileUploadRenderState<FileLike> = {
    files: held,
    rejections: view.context.rejections,
    dragging,
    disabled: field.disabled,
    readOnly: field.readOnly,
  }
  useDocumentDropPrevention(preventDocumentDrop && !field.disabled)
  // The input mirrors the value after every commit (hydration, a parent's change): no events.
  const heldRef = useRef(held)
  heldRef.current = held
  // Every commit, so a controlled proposal the parent ignored leaves the input as the value.
  useIsoLayoutEffect(() => {
    if (!dispatching.current) sync(held, false)
  })
  useEffect(() => {
    const el = input.current
    if (!el) return
    const watch = watchFieldsetDisabled(el, setFieldsetDom)
    setFieldsetDom(watch.disabled)
    return watch.stop
  }, [])
  // Form reset and validation focus, on the native input.
  useEffect(() => {
    const el = input.current
    if (!el) return
    const doc = el.ownerDocument
    const onReset = (e: Event) => {
      if (e.target !== el.form || e.defaultPrevented) return
      send({ type: "RESET" })
      // The browser clears the input after this event: mirror the value again after it.
      queueMicrotask(() => syncRef.current(heldRef.current, false))
    }
    const onFocus = () => {
      const trigger = doc.getElementById(ids.trigger)
      if (trigger) void focusSafely(trigger, env, "programmatic", "keyboard")
    }
    doc.addEventListener("reset", onReset)
    el.addEventListener("focus", onFocus)
    return () => {
      doc.removeEventListener("reset", onReset)
      el.removeEventListener("focus", onFocus)
    }
  }, [send, env, ids.trigger])
  // field-control: one control; the input is its validity element, the Trigger its focus.
  const register = binding?.register
  useIsoLayoutEffect(() => {
    if (!register) return
    return register(
      {
        id: ids.trigger,
        labelable: false,
        focus: (m) => {
          const t = document.getElementById(ids.trigger)
          if (t) void focusSafely(t, env, "programmatic", m)
        },
        validityElement: () => input.current,
        value: () => heldRef.current,
      },
      ids.trigger,
    )
  }, [register, ids.trigger, env])
  const reported = useRef(held)
  useEffect(() => {
    if (reported.current === held) return
    reported.current = held
    const user = lastReason.current !== null && lastReason.current !== "reset"
    lastReason.current = null
    report?.({ type: "change", value: held, user, composing: false })
    if (user) report?.({ type: "commit" })
  }, [held, report])
  // Focus after a removal: the Remove now at that index, else the previous one, else the Trigger.
  const focusAfterRemoval = useRef<number | null>(null)
  const rootEl = useRef<HTMLDivElement | null>(null)
  useIsoLayoutEffect(() => {
    const index = focusAfterRemoval.current
    if (index === null) return
    focusAfterRemoval.current = null
    const removes = rootEl.current?.querySelectorAll<HTMLElement>('[data-part="item-remove"]')
    const target = removes?.[index] ?? removes?.[index - 1] ?? document.getElementById(ids.trigger)
    if (target) void focusSafely(target, env, "programmatic", env.modality.modality())
  }, [held])
  const hasTrigger = useRef(false)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    if (!hasTrigger.current && !field.disabled) {
      console.warn("[rind-ui] file-upload: render FileUpload.Trigger, the keyboard way in")
    }
    if (directory && maxFiles === 1) {
      console.warn(
        "[rind-ui] file-upload: `directory` with `maxFiles` 1 keeps one file of a folder",
      )
    }
  }, [directory, maxFiles, field.disabled])
  const editable = !field.disabled && !field.readOnly
  const editableRef = useRef(editable)
  editableRef.current = editable
  const directoryRef = useRef(directory)
  directoryRef.current = directory
  const [defaultSource] = useState(() =>
    domDropSource({ directory: () => directoryRef.current, refuse: () => !editableRef.current }),
  )
  const ctx: Ctx = {
    api,
    send,
    state,
    instance,
    ids,
    registerLabel: registry,
    dropSource: (dropSource ?? defaultSource) as DropSource<FileLike>,
    focusAfterRemoval,
    hasTrigger,
  }
  const rootProps = mergeProps(
    {
      ...joinHandlers(normalizeProps(api.root()), {
        // A paste of files while focus is inside: one gesture (text pastes are the platform's).
        onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => {
          if (!editable) return
          const pasted = filesFromClipboard(e.clipboardData)
          if (!pasted) return
          e.preventDefault()
          send({ type: "FILES.ADD", files: pasted, source: "paste" })
        },
      }),
      ref: composeRefs(rootEl, ref),
      ...(id === undefined ? {} : { id }),
    },
    rest,
  )
  const inputProps = mergeProps(normalizeProps(api.hiddenInput()), {
    ref: input,
    // Not into the Dropzone: its press would open the chooser twice (RA#10092).
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (dispatching.current) return
      const picked = Array.from(e.currentTarget.files ?? [])
      // A cancelled chooser (older engines report an empty change): keep the files.
      if (picked.length === 0) {
        sync(heldRef.current, false)
        return
      }
      send({ type: "FILES.ADD", files: picked, source: "pick" })
    },
  })
  return (
    <FileUploadContext value={ctx}>
      {renderPart(
        "div",
        {
          ...rootProps,
          children: (
            <>
              {children}
              <input {...(inputProps as ComponentPropsWithRef<"input">)} />
              <span {...normalizeProps(api.summary())}>{api.summaryText}</span>
            </>
          ),
        },
        render as RenderProp<FileUploadRenderState<FileLike>> | undefined,
        state,
      )}
    </FileUploadContext>
  )
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  /** Another element or a render function receiving the props and the state. */
  readonly render?: RenderProp<FileUploadRenderState<FileLike>>
}

function Label({ render, id, ...rest }: PartProps<"span">) {
  const ctx = useFileUpload("Label")
  const own = id ?? ctx.ids.label
  useRegisterPart(ctx.registerLabel, "label", own)
  // A press on the Label focuses the Trigger without opening the chooser.
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.label()), {
        onClick: () => document.getElementById(ctx.ids.trigger)?.focus(),
      }),
      id: own,
    },
    rest,
  )
  return renderPart("span", props, render, ctx.state)
}

function Dropzone({ render, ref, ...rest }: PartProps<"div">) {
  const ctx = useFileUpload("Dropzone")
  const el = useRef<HTMLDivElement | null>(null)
  const { dropSource, send } = ctx
  useEffect(() => {
    const zone = el.current
    if (!zone) return
    return dropSource(zone, {
      enter: () => send({ type: "DRAG.ENTER" }),
      leave: () => send({ type: "DRAG.LEAVE" }),
      drop: (files, refused) =>
        send({
          type: "FILES.ADD",
          files,
          source: "drop",
          ...(refused && refused.length > 0 ? { refused } : {}),
        }),
    })
  }, [dropSource, send])
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.dropzone()), {
        // A press on the zone's own area opens the chooser; presses on its controls, labels
        // and the input do not (no double open: zag#3387, react-dropzone#182).
        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
          if (e.defaultPrevented || e.button !== 0) return
          const target = e.target as Element
          if (!dropzoneClickOpens(target, e.currentTarget as Element)) return
          send({ type: "PICKER.OPEN" })
        },
      }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return renderPart("div", props, render, ctx.state)
}

function useFocusRing() {
  const env = useEnvironment()
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  return { focused, setFocused, modality }
}

function Trigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useFileUpload("Trigger")
  ctx.hasTrigger.current = true
  const { focused, setFocused, modality } = useFocusRing()
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.trigger({ focused, modality, named })), {
        onClick: () => ctx.send({ type: "PICKER.OPEN" }),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      }),
      ref,
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

function ItemGroup({ render, ...rest }: PartProps<"ul">) {
  const ctx = useFileUpload("ItemGroup")
  if (ctx.state.files.length === 0) return null
  return renderPart("ul", mergeProps(normalizeProps(ctx.api.itemGroup()), rest), render, ctx.state)
}

interface ItemCtx {
  readonly file: FileLike
  readonly index: number
}
const ItemContext = createContext<ItemCtx | null>(null)
function useItem(part: string): ItemCtx {
  const item = useContext(ItemContext)
  if (!item) throw new Error(`FileUpload.${part} must be inside FileUpload.Item`)
  return item
}

export type FileUploadItemProps = PartProps<"li"> & {
  /** The held file this Item shows. */
  readonly file: FileLike
}

function Item({ render, file, ...rest }: FileUploadItemProps) {
  const ctx = useFileUpload("Item")
  const index = ctx.state.files.indexOf(file)
  return (
    <ItemContext value={{ file, index }}>
      {renderPart("li", mergeProps(normalizeProps(ctx.api.item(index)), rest), render, ctx.state)}
    </ItemContext>
  )
}

function ItemName({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useFileUpload("ItemName")
  const item = useItem("ItemName")
  const props = mergeProps(normalizeProps(ctx.api.itemName()), rest)
  return renderPart("span", { ...props, children: children ?? item.file.name }, render, ctx.state)
}

function ItemSize({ render, children, ...rest }: PartProps<"span">) {
  const ctx = useFileUpload("ItemSize")
  const item = useItem("ItemSize")
  const props = mergeProps(normalizeProps(ctx.api.itemSize()), rest)
  return renderPart(
    "span",
    { ...props, children: children ?? ctx.api.itemSizeText(item.file) },
    render,
    ctx.state,
  )
}

function ItemPreview({ render, ...rest }: PartProps<"img">) {
  const ctx = useFileUpload("ItemPreview")
  const item = useItem("ItemPreview")
  const [url, setUrl] = useState<string | null>(null)
  const file = item.file
  useEffect(() => {
    if (typeof File === "undefined" || !(file instanceof File) || !file.type.startsWith("image/")) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    // Revoked when the file changes or the preview unmounts.
    return () => URL.revokeObjectURL(next)
  }, [file])
  if (!url) return null
  return renderPart(
    "img",
    mergeProps(normalizeProps(ctx.api.itemPreview()), { src: url }, rest),
    render,
    ctx.state,
  )
}

function ItemRemove({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useFileUpload("ItemRemove")
  const item = useItem("ItemRemove")
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.itemRemove(item.file, named)), {
        onClick: () => {
          ctx.focusAfterRemoval.current = item.index
          ctx.send({ type: "FILE.REMOVE", file: item.file })
        },
      }),
      ref,
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

function ClearTrigger({ render, ref, children, ...rest }: PartProps<"button">) {
  const ctx = useFileUpload("ClearTrigger")
  if (ctx.state.files.length === 0) return null
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const props = mergeProps(
    {
      ...joinHandlers(normalizeProps(ctx.api.clearTrigger(named)), {
        onClick: () => {
          // After a clear: the Trigger (index -1 finds no Remove).
          ctx.focusAfterRemoval.current = -1
          ctx.send({ type: "FILES.CLEAR" })
        },
      }),
      ref,
    },
    rest,
  )
  return renderPart("button", { ...props, children }, render, ctx.state)
}

const PublicRoot = Root as <F extends FileLike = File>(props: FileUploadRootProps<F>) => ReactNode

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
  PublicRoot as Root,
  Trigger,
}
