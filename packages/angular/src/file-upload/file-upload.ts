import {
  afterEveryRender,
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
  ViewEncapsulation,
  viewChild,
} from "@angular/core"
import {
  announcerCapability,
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
  type PartProps,
  partId,
  syncFileInput,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectFieldControl } from "../field/context"
import { injectFieldsetDisabled } from "../fieldset/context"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

declare const process: { env: { NODE_ENV?: string } }

/** The upload's state, for the template (`#u="rindFileUploadRoot"`, `u.state()`). */
export interface FileUploadRenderState<F extends FileLike = File> {
  readonly files: readonly F[]
  readonly rejections: readonly FileRejection<F>[]
  readonly dragging: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
}

const FILE_UPLOAD = new InjectionToken<FileUploadRoot>("rind-ui.file-upload")
const ITEM = new InjectionToken<FileUploadItem>("rind-ui.file-upload-item")

function injectFileUpload(part: string): FileUploadRoot {
  const root = inject(FILE_UPLOAD, { optional: true })
  if (!root) throw new Error(`rindFileUpload${part} must be inside rindFileUploadRoot`)
  return root
}
function injectItem(part: string): FileUploadItem {
  const item = inject(ITEM, { optional: true })
  if (!item) throw new Error(`rindFileUpload${part} must be inside rindFileUploadItem`)
  return item
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

/** A consumer name on the element (static `aria-label` / `aria-labelledby`). */
const injectNamed = () =>
  inject(new HostAttributeToken("aria-label"), { optional: true }) !== null ||
  inject(new HostAttributeToken("aria-labelledby"), { optional: true }) !== null

/**
 * Files from a chooser, a drop or a paste: `<div rindFileUploadRoot name="docs">` with a Label,
 * a Dropzone holding the Trigger, and an ItemGroup of Items; it renders the native file input
 * and a summary after its content.
 */
@Component({
  selector: "[rindFileUploadRoot]",
  exportAs: "rindFileUploadRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: FILE_UPLOAD, useExisting: forwardRef(() => FileUploadRoot) }],
  template: `<ng-content /><input #input [rindProps]="inputProps()" /><span
      [rindProps]="summaryProps()"
      >{{ summaryText() }}</span
    >`,
})
export class FileUploadRoot {
  /** Controlled held files (`[(files)]`). */
  readonly files = input<readonly FileLike[]>()
  /** Uncontrolled initial files; a later change only changes what a form reset restores. */
  readonly defaultFiles = input<readonly FileLike[]>()
  /** MIME types, `type/*` and `.ext`; an empty type falls back to the extension. */
  readonly accept = input<string | readonly string[]>()
  /** The most files held (default 1: a new file replaces the held one). */
  readonly maxFiles = input(1)
  /** The largest file, in bytes. */
  readonly maxFileSize = input<number>()
  /** The smallest file, in bytes. */
  readonly minFileSize = input<number>()
  /** Take folders: `webkitdirectory` on the chooser, traversal on drop. */
  readonly directory = input(false, { transform: booleanAttribute })
  /** A code rejects the file (`CUSTOM`). */
  readonly validate =
    input<(file: FileLike, context: { readonly files: readonly FileLike[] }) => string | null>()
  /** Where drops come from (default: the DOM). A Tauri window's drag-drop events, for example. */
  readonly dropSource = input<DropSource<FileLike>>()
  /** A file dropped outside the Dropzone does not navigate the page. Default true. */
  readonly preventDocumentDrop = input(true, { transform: booleanAttribute })
  /** The native `capture` hint (camera on mobile). */
  readonly capture = input<"user" | "environment">()
  /** The form field name. */
  readonly name = input<string>()
  /** The form id, when the File Upload is outside it. */
  readonly form = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  /** Focusable and submitted, but nothing is added or removed. */
  readonly readonly = input(false, { transform: booleanAttribute })
  readonly required = input(false, { transform: booleanAttribute })
  readonly invalid = input(false, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<FileUploadMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** The whole new list; `details.reason`: "add", "remove", "clear", "reset" or "api". */
  readonly filesChangeDetails = output<ChangeEvent<readonly FileLike[], FileUploadEvent>>()
  /** The accepted list, for `[(files)]`. */
  readonly filesChange = output<readonly FileLike[]>()
  /** Once per gesture with any rejection. */
  readonly reject = output<readonly FileRejection<FileLike>[]>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof fileUploadConnect>>
  /** @internal */
  readonly send: (event: FileUploadEvent) => void
  /** @internal */
  readonly ids: () => {
    readonly label: string
    readonly trigger: string
    readonly input: string
    readonly summary: string
  }
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"label">>
  /** @internal */
  readonly drops: () => DropSource<FileLike>
  /** @internal */
  readonly instance: () => string
  /** @internal A removal asks for focus to move after the render (the index's Remove, else the Trigger). */
  readonly focusAfterRemoval: { current: number | null } = { current: null }
  /** @internal */
  readonly hasTrigger = { current: false }
  /** @internal */
  protected readonly inputProps: Signal<PartProps>
  /** @internal */
  protected readonly summaryProps: Signal<PartProps>
  /** @internal */
  protected readonly summaryText: Signal<string>
  readonly state: Signal<FileUploadRenderState<FileLike>>
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>("input")

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    this.instance = instance
    const locale = injectLocale(() => this.locale())
    const messages = injectMessages("file-upload", fileUploadMessages, () => this.messages())
    const binding = injectFieldControl()
    const fieldsetContext = injectFieldsetDisabled()
    const fieldsetDom = signal(false)
    this.registry = injectPartRegistry<"label">(() => ({ scope: "file-upload", root: instance() }))
    const ownLabel = injectRenderedId(this.registry, "label")
    const inputEl = () => this.inputRef()?.nativeElement ?? null
    this.ids = () => ({
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
          disabled: this.disabled() || fieldsetContext() || fieldsetDom(),
          readOnly: this.readonly(),
          required: this.required(),
          invalid: this.invalid(),
          name: this.name(),
        },
        binding?.() ?? null,
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
    const emitChange = changeEmitter<readonly FileLike[], FileUploadEvent>(
      this.filesChangeDetails,
      this.filesChange,
    )
    const { view, send } = injectMachine(
      fileUploadMachine,
      () => ({
        id: instance(),
        messages: messages(),
        lang: locale().locale,
        files: this.files(),
        defaultFiles: this.defaultFiles(),
        onFilesChange: (v: readonly FileLike[], d: Parameters<typeof emitChange>[1]) => {
          lastReason = d.reason
          emitChange(v, d)
        },
        accept: this.accept(),
        maxFiles: this.maxFiles(),
        maxFileSize: this.maxFileSize(),
        minFileSize: this.minFileSize(),
        directory: this.directory(),
        validate: this.validate() as never,
        disabled: field().disabled,
        readOnly: field().readOnly,
        onReject: (r: readonly FileRejection<FileLike>[]) => this.reject.emit(r),
      }),
      {
        ...env,
        // In the press's task: the chooser needs the user activation.
        openPicker: () => inputEl()?.click(),
        syncInput: sync,
      },
    )
    this.send = send
    const held = () => view().values.files
    this.state = computed(() => ({
      files: held(),
      rejections: view().context.rejections,
      dragging: view().state === "dragging",
      disabled: field().disabled,
      readOnly: field().readOnly,
    }))
    this.api = computed(() =>
      fileUploadConnect({
        instance: instance(),
        files: held(),
        dragging: this.state().dragging,
        field: field(),
        fieldData: binding?.().data,
        ids: this.ids(),
        labelledBy: binding?.().ids.label ?? ownLabel(),
        messages: messages(),
        locale: locale().locale,
        accept: this.accept(),
        maxFiles: this.maxFiles(),
        directory: this.directory(),
        capture: this.capture(),
        form: this.form(),
      }),
    )
    this.inputProps = computed(() =>
      joinHandlers(this.api().hiddenInput(), {
        // Not into the Dropzone: its press would open the chooser twice (RA#10092).
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onChange: (e: Event) => {
          if (dispatching) return
          const el = e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null
          const picked = Array.from(el?.files ?? [])
          // A cancelled chooser (older engines report an empty change): keep the files.
          if (picked.length === 0) {
            sync(untracked(view).values.files, false)
            return
          }
          send({ type: "FILES.ADD", files: picked, source: "pick" })
        },
      }),
    )
    this.summaryProps = computed(() => this.api().summary())
    this.summaryText = computed(() => this.api().summaryText)
    const editable = () => !field().disabled && !field().readOnly
    const defaultSource = domDropSource({
      directory: () => untracked(this.directory),
      refuse: () => !untracked(editable),
    })
    this.drops = () => this.dropSource() ?? defaultSource
    bindProps(
      () => ({
        ...joinHandlers(this.api().root(), {
          // A paste of files while focus is inside: one gesture (text pastes are the platform's).
          onPaste: (e: ClipboardEvent) => {
            if (!untracked(editable)) return
            const pasted = filesFromClipboard(e.clipboardData)
            if (!pasted) return
            e.preventDefault()
            send({ type: "FILES.ADD", files: pasted, source: "paste" })
          },
        }),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      {
        owns: [
          "accept",
          "capture",
          "defaultfiles",
          "directory",
          "disabled",
          "dropsource",
          "files",
          "form",
          "id",
          "invalid",
          "locale",
          "maxfiles",
          "maxfilesize",
          "messages",
          "minfilesize",
          "name",
          "preventdocumentdrop",
          "readonly",
          "required",
          "validate",
        ],
      },
    )

    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    const rootEl: Element = inject(ElementRef).nativeElement
    // Every render, so a controlled proposal the parent ignored leaves the input as the value.
    afterEveryRender(() => {
      if (!dispatching) sync(untracked(view).values.files, false)
      // Focus after a removal: the Remove now at that index, else the previous one, else the Trigger.
      const index = this.focusAfterRemoval.current
      if (index === null) return
      this.focusAfterRemoval.current = null
      const removes = rootEl.querySelectorAll<HTMLElement>('[data-part="item-remove"]')
      const target =
        removes[index] ?? removes[index - 1] ?? document.getElementById(untracked(this.ids).trigger)
      if (target) void focusSafely(target, env, "programmatic", env.modality.modality())
    })
    const ready = signal(false)
    effect((onCleanup) => {
      if (ready() && this.preventDocumentDrop() && !field().disabled)
        onCleanup(untracked(preventDocumentDrops))
    })
    afterNextRender(() => {
      ready.set(true)
      const el = inputEl()
      if (el) {
        const w = watchFieldsetDisabled(el, (d) => fieldsetDom.set(d))
        fieldsetDom.set(w.disabled)
        // Form reset and validation focus, on the native input.
        const doc = el.ownerDocument
        const onReset = (e: Event) => {
          if (e.target !== el.form || e.defaultPrevented) return
          send({ type: "RESET" })
          // The browser clears the input after this event: mirror the value again after it.
          queueMicrotask(() => sync(untracked(view).values.files, false))
        }
        const onFocus = () => {
          const trigger = doc.getElementById(untracked(this.ids).trigger)
          if (trigger) void focusSafely(trigger, env, "programmatic", "keyboard")
        }
        doc.addEventListener("reset", onReset)
        el.addEventListener("focus", onFocus)
        destroy.onDestroy(() => {
          w.stop()
          doc.removeEventListener("reset", onReset)
          el.removeEventListener("focus", onFocus)
        })
      }
      // field-control: one control; the input is its validity element, the Trigger its focus.
      if (binding) {
        const trigger = untracked(this.ids).trigger
        destroy.onDestroy(
          binding().register(
            {
              id: trigger,
              labelable: false,
              focus: (m) => {
                const t = document.getElementById(trigger)
                if (t) void focusSafely(t, env, "programmatic", m)
              },
              validityElement: inputEl,
              value: () => untracked(view).values.files,
            },
            trigger,
          ),
        )
      }
      if (process.env.NODE_ENV !== "production") {
        if (!this.hasTrigger.current && !untracked(field).disabled)
          console.warn("[rind-ui] file-upload: render rindFileUploadTrigger, the keyboard way in")
        if (untracked(this.directory) && untracked(this.maxFiles) === 1)
          console.warn(
            "[rind-ui] file-upload: `directory` with `maxFiles` 1 keeps one file of a folder",
          )
      }
    })
    let reported: readonly FileLike[] | undefined
    effect(() => {
      const now = held()
      if (!ready() || reported === undefined) {
        reported = now
        return
      }
      if (reported === now) return
      reported = now
      untracked(() => {
        const user = lastReason !== null && lastReason !== "reset"
        lastReason = null
        binding?.().report({ type: "change", value: now, user, composing: false })
        if (user) binding?.().report({ type: "commit" })
      })
    })
  }
}

/** The upload's name; a press on it focuses the Trigger without opening the chooser. */
@Directive({ selector: "[rindFileUploadLabel]", exportAs: "rindFileUploadLabel" })
export class FileUploadLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectFileUpload("Label")
    const own = () => this.id() ?? root.ids().label
    injectRegisterPart(root.registry, "label", own)
    bindProps(
      () => ({
        ...joinHandlers(root.api().label(), {
          onClick: () => document.getElementById(untracked(root.ids).trigger)?.focus(),
        }),
        id: own(),
      }),
      { owns: ["id"] },
    )
  }
}

const INTERACTIVE =
  'button, a[href], input, select, textarea, label, [role="button"], [contenteditable=""], [contenteditable="true"], [tabindex]'

/** Where files are dropped; a press on its own area opens the chooser. */
@Directive({ selector: "[rindFileUploadDropzone]", exportAs: "rindFileUploadDropzone" })
export class FileUploadDropzone {
  constructor() {
    const root = injectFileUpload("Dropzone")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() =>
      joinHandlers(root.api().dropzone(), {
        // A press on the zone's own area opens the chooser; presses on its controls, labels and
        // the input do not (no double open: zag#3387, react-dropzone#182).
        onClick: (e: MouseEvent) => {
          if (e.defaultPrevented || e.button !== 0) return
          const target = e.target as Element
          if (target !== e.currentTarget && target.closest(INTERACTIVE)) return
          root.send({ type: "PICKER.OPEN" })
        },
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      const source = root.drops()
      if (!ready() || !(el instanceof HTMLElement)) return
      onCleanup(
        untracked(() =>
          source(el, {
            enter: () => root.send({ type: "DRAG.ENTER" }),
            leave: () => root.send({ type: "DRAG.LEAVE" }),
            drop: (files, refused) =>
              root.send({
                type: "FILES.ADD",
                files,
                source: "drop",
                ...(refused && refused.length > 0 ? { refused } : {}),
              }),
          }),
        ),
      )
    })
  }
}

/** Opens the chooser: `<button rindFileUploadTrigger>`, the keyboard way in. */
@Directive({ selector: "[rindFileUploadTrigger]", exportAs: "rindFileUploadTrigger" })
export class FileUploadTrigger {
  constructor() {
    const root = injectFileUpload("Trigger")
    root.hasTrigger.current = true
    const env = injectEnvironment()
    if (inject(PLATFORM_ID) === "browser") {
      const destroy = inject(DestroyRef)
      afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    }
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const named = injectNamed()
    bindProps(() =>
      joinHandlers(root.api().trigger({ focused: focused(), modality: modality(), named }), {
        onClick: () => root.send({ type: "PICKER.OPEN" }),
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
      }),
    )
  }
}

/** The list of held files (`<ul>`); hidden while there is none (React renders nothing). */
@Directive({ selector: "[rindFileUploadItemGroup]", exportAs: "rindFileUploadItemGroup" })
export class FileUploadItemGroup {
  constructor() {
    const root = injectFileUpload("ItemGroup")
    bindProps(() =>
      root.state().files.length === 0
        ? absentProps("file-upload", root.instance())
        : root.api().itemGroup(),
    )
  }
}

/** One held file: `<li rindFileUploadItem [file]="f">`. */
@Directive({
  selector: "[rindFileUploadItem]",
  exportAs: "rindFileUploadItem",
  providers: [{ provide: ITEM, useExisting: forwardRef(() => FileUploadItem) }],
})
export class FileUploadItem {
  /** The held file this Item shows. */
  readonly file = input.required<FileLike>()
  /** @internal */
  readonly index: Signal<number>
  constructor() {
    const root = injectFileUpload("Item")
    this.index = computed(() => root.state().files.indexOf(this.file()))
    bindProps(() => root.api().item(this.index()), { owns: ["file"] })
  }
}

/** The file's name: its content, or the name. */
@Component({
  selector: "[rindFileUploadItemName]",
  exportAs: "rindFileUploadItemName",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ name() }}</ng-content>",
})
export class FileUploadItemName {
  /** @internal */
  protected readonly name: Signal<string>
  constructor() {
    const root = injectFileUpload("ItemName")
    const item = injectItem("ItemName")
    this.name = computed(() => item.file().name)
    bindProps(() => root.api().itemName())
  }
}

/** The file's size: its content, or the formatted size. */
@Component({
  selector: "[rindFileUploadItemSize]",
  exportAs: "rindFileUploadItemSize",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ size() }}</ng-content>",
})
export class FileUploadItemSize {
  /** @internal */
  protected readonly size: Signal<string>
  constructor() {
    const root = injectFileUpload("ItemSize")
    const item = injectItem("ItemSize")
    this.size = computed(() => root.api().itemSizeText(item.file()))
    bindProps(() => root.api().itemSize())
  }
}

/** An image file's preview: `<img rindFileUploadItemPreview>`; hidden for other files. */
@Directive({ selector: "[rindFileUploadItemPreview]", exportAs: "rindFileUploadItemPreview" })
export class FileUploadItemPreview {
  constructor() {
    const root = injectFileUpload("ItemPreview")
    const item = injectItem("ItemPreview")
    const url = signal<string | null>(null)
    bindProps(() => {
      const src = url()
      return src
        ? { ...root.api().itemPreview(), src }
        : absentProps("file-upload", root.instance())
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    effect((onCleanup) => {
      if (!ready()) return
      const file = item.file()
      if (
        typeof File === "undefined" ||
        !(file instanceof File) ||
        !file.type.startsWith("image/")
      ) {
        url.set(null)
        return
      }
      const next = URL.createObjectURL(file)
      url.set(next)
      // Revoked when the file changes or the preview goes.
      onCleanup(() => URL.revokeObjectURL(next))
    })
  }
}

/** Removes its Item's file; focus moves to the next Remove (else the Trigger). */
@Directive({ selector: "[rindFileUploadItemRemove]", exportAs: "rindFileUploadItemRemove" })
export class FileUploadItemRemove {
  constructor() {
    const root = injectFileUpload("ItemRemove")
    const item = injectItem("ItemRemove")
    const named = injectNamed()
    bindProps(() =>
      joinHandlers(root.api().itemRemove(item.file(), named), {
        onClick: () => {
          root.focusAfterRemoval.current = untracked(item.index)
          root.send({ type: "FILE.REMOVE", file: untracked(item.file) })
        },
      }),
    )
  }
}

/** Removes every file; hidden while there is none (React renders nothing). */
@Directive({ selector: "[rindFileUploadClearTrigger]", exportAs: "rindFileUploadClearTrigger" })
export class FileUploadClearTrigger {
  constructor() {
    const root = injectFileUpload("ClearTrigger")
    const named = injectNamed()
    bindProps(() =>
      root.state().files.length === 0
        ? absentProps("file-upload", root.instance())
        : joinHandlers(root.api().clearTrigger(named), {
            onClick: () => {
              // After a clear: the Trigger (index -1 finds no Remove).
              root.focusAfterRemoval.current = -1
              root.send({ type: "FILES.CLEAR" })
            },
          }),
    )
  }
}

/** The File Upload's parts, for a standalone component's `imports`. */
export const FileUpload = [
  FileUploadRoot,
  FileUploadLabel,
  FileUploadDropzone,
  FileUploadTrigger,
  FileUploadItemGroup,
  FileUploadItem,
  FileUploadItemName,
  FileUploadItemSize,
  FileUploadItemPreview,
  FileUploadItemRemove,
  FileUploadClearTrigger,
] as const
