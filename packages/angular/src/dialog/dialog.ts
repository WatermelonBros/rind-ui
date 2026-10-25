import {
  afterEveryRender,
  booleanAttribute,
  computed,
  Directive,
  ElementRef,
  effect,
  forwardRef,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  DIALOG_PARENT_KINDS,
  type DialogChangeDetails,
  type DialogCloseReason,
  type DialogMessages,
  type DialogProps,
  type DismissEvent,
  dialogConnect,
  dialogLayerId,
  dialogMachine,
  dialogMessages,
  type FocusTarget,
  type HeadingLevel,
  type LayerMeta,
  type MessageOverrides,
  type Modality,
  partId,
  type Service,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { HEADING_LEVEL } from "../heading/heading"
import { injectRootId, RindIds } from "../ids"
import { injectButton } from "../inject-button"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality } from "../inject-press"
import {
  injectLayerMeta,
  injectParentLayer,
  injectRendered,
  LAYER,
  layerProvider,
} from "../layer-context"
import { PORTAL_PROVIDERS, PortalBase } from "../portal"
import { injectEnvironment, injectMessages } from "../provider"

type Rendered = { readonly title?: string | undefined; readonly description?: string | undefined }

/** A dialog-family member's Root (Dialog, Drawer): what its parts read. Internal. */
export const DIALOG = new InjectionToken<DialogRootBase>("rind-ui.dialog")

export function injectDialog(part: string): DialogRootBase {
  const root = inject(DIALOG, { optional: true })
  if (!root) throw new Error(`${part} must be inside its Dialog or Drawer Root`)
  return root
}

/** The content's role: a dialog, or a confirmation that interrupts. */
export type DialogRole = "dialog" | "alertdialog"

/** What an `openChangeDetails` output emits: the proposed visibility and why it changes. */
export interface DialogChangeEvent {
  readonly value: boolean
  /** `details.cancel()`, called synchronously, vetoes the change. */
  readonly details: DialogChangeDetails
}

export interface DialogState {
  readonly open: boolean
}

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/** A family member: its scope, layer kind and machine. */
export interface DialogFamily {
  readonly scope: string
  readonly kind: "dialog" | "drawer"
  readonly machine: typeof dialogMachine
}

/** The Root's inputs and wiring, shared by the family (Drawer adds its own). Internal. */
@Directive()
export abstract class DialogRootBase {
  /** `alertdialog`: a confirmation. Always modal, an outside press never closes it, focus starts on Cancel, a missing description warns. */
  readonly role = input<DialogRole>("dialog")
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default true (a confirmation is always modal). */
  readonly modal = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default true. */
  readonly closeOnEscape = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Default: `modal` (never for a confirmation). */
  readonly closeOnInteractOutside = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: optionalBoolean },
  )
  /** `null`: the overlay's rule; `false`: focus does not move; a part name or a function. */
  readonly initialFocus = input<
    "content" | "title" | "cancel" | (() => FocusTarget) | null | false
  >()
  /** `null`: back to the opener; `false`: focus does not move. */
  readonly finalFocus = input<
    ((reason: DialogCloseReason | undefined) => FocusTarget) | null | false
  >()
  /** The base of the generated part ids. Default: a generated id. */
  readonly id = input<string>()
  /** Content, backdrop and positioner stay rendered (hidden) while closed. */
  readonly keepMounted = input(false, { transform: booleanAttribute })
  readonly openChangeDetails = output<DialogChangeEvent>()
  /** The accepted visibility, for `[(open)]`. */
  readonly openChange = output<boolean>()
  /** Escape is about to close it; `event.preventDefault()` keeps it open. */
  readonly escapeKeyDown = output<DismissEvent>()
  /** A press or focus outside is about to close it; `event.preventDefault()` keeps it open. */
  readonly interactOutside = output<DismissEvent>()

  /** @internal The family member: `dialog` or `drawer` (scope, names). */
  scope = "dialog"
  /** @internal The layer kind: `alertdialog` for a `role="alertdialog"` dialog. */
  readonly kind = computed(() => (this.role() === "alertdialog" ? "alertdialog" : this.family.kind))
  /** @internal A confirmation is always modal. */
  readonly isModal = computed(() => this.role() === "alertdialog" || this.modal() !== false)
  /** @internal */
  readonly titleFocusTarget = computed(() => this.initialFocus() === "title")
  /** @internal */
  readonly contentMounted = signal(false)
  /** @internal */
  readonly titleLevel = signal<HeadingLevel>(2)
  /** @internal Ids of the rendered title and description: the only source of the ARIA references. */
  readonly rendered = signal<Rendered>({})
  /** @internal */
  root!: () => string
  /** @internal */
  view!: Signal<ReturnType<Service<typeof dialogMachine>["view"]>>
  /** @internal */
  send!: Service<typeof dialogMachine>["send"]
  /** @internal The stack's metadata for this layer, followed while open. */
  meta!: Signal<LayerMeta | undefined>
  /** @internal */
  texts!: Signal<DialogMessages>
  /** The dialog's state, for the template (`#d="rindDialogRoot"`, `d.state()`). */
  readonly state = computed<DialogState>(() => ({ open: this.isOpen() }))

  private family: DialogFamily = { scope: "dialog", kind: "dialog", machine: dialogMachine }

  /** @internal */
  isOpen(): boolean {
    return this.view().matches("open")
  }

  /**
   * Its machine, scope and layer kind; called from the subclass's constructor.
   * `extra`: a family member's own machine props (a drawer's side, snap points).
   */
  protected wire(
    family: DialogFamily,
    texts: Signal<DialogMessages>,
    extra: () => Record<string, unknown> = () => ({}),
  ): void {
    this.family = family
    this.scope = family.scope
    this.texts = texts
    const root = injectRootId(() => this.id())
    this.root = root
    const parent = injectParentLayer(DIALOG_PARENT_KINDS)
    const env = injectEnvironment()
    // As changeEmitter, for the dialog's own details type (its reasons are the dialog's).
    const onOpenChange = (value: boolean, d: DialogChangeDetails) => {
      let cancelled = false
      this.openChangeDetails.emit({
        value,
        details: {
          ...d,
          cancel() {
            cancelled = true
            d.cancel()
          },
        },
      })
      if (!cancelled) this.openChange.emit(value)
    }
    const { view, send } = injectMachine(
      family.machine,
      (): DialogProps => ({
        role: this.role(),
        open: this.open(),
        defaultOpen: this.defaultOpen(),
        onOpenChange,
        modal: this.modal(),
        closeOnEscape: this.closeOnEscape(),
        closeOnInteractOutside: this.closeOnInteractOutside(),
        initialFocus: this.initialFocus(),
        finalFocus: this.finalFocus(),
        onEscapeKeyDown: (e: DismissEvent) => this.escapeKeyDown.emit(e),
        onInteractOutside: (e: DismissEvent) => this.interactOutside.emit(e),
        root: root(),
        parent: parent(),
        ...extra(),
      }),
      env,
    )
    this.view = view
    this.send = send
    this.meta = injectLayerMeta(
      () => view().matches("open"),
      () => dialogLayerId(family.scope, root()),
    )
  }

  /** @internal The connect input, for a family member's own parts (a drawer's Handle). */
  input(focus: { focusWithin?: boolean; contentFocused?: boolean; modality?: Modality } = {}) {
    const view = this.view()
    return {
      instance: this.root(),
      open: view.matches("open"),
      opener: view.context.opener,
      closeReason: view.context.closeReason,
      rendered: this.rendered(),
      contentMounted: this.contentMounted(),
      meta: this.meta(),
      titleFocusTarget: this.titleFocusTarget(),
      ...focus,
      messages: this.texts(),
    }
  }

  /** @internal */
  api(focus: { focusWithin?: boolean; contentFocused?: boolean; modality?: Modality } = {}) {
    return dialogConnect(
      { ...this.input(focus), scope: this.scope, role: this.role(), modal: this.isModal() },
      this.send,
    )
  }

  /** Opens it. */
  show(): void {
    this.send({ type: "OPEN" })
  }
  /** Closes it. */
  hide(): void {
    this.send({ type: "CLOSE" })
  }
}

/**
 * A window over the page: `<ng-container rindDialogRoot>` with Triggers and, usually in
 * `<ng-template rindDialogPortal>`, a Backdrop and a Positioner holding the Content.
 */
@Directive({
  selector: "[rindDialogRoot]",
  exportAs: "rindDialogRoot",
  providers: [{ provide: DIALOG, useExisting: forwardRef(() => DialogRoot) }],
})
export class DialogRoot extends DialogRootBase {
  readonly messages = input<MessageOverrides<DialogMessages>>()
  constructor() {
    super()
    this.wire(
      { scope: "dialog", kind: "dialog", machine: dialogMachine },
      injectMessages("dialog", dialogMessages, () => this.messages()),
    )
  }
}

/** A part id for a repeatable button: the consumer's, else the instance's plus a generated suffix. */
function injectPartId(root: DialogRootBase, part: string, own: () => string | undefined) {
  const generated = inject(RindIds).next()
  return () => own() ?? partId(root.scope, root.root(), `${part}-${generated}`)
}

/** Opens the dialog: `<button rindDialogTrigger>`. Several triggers may open one dialog. */
@Directive({
  selector: "[rindDialogTrigger], [rindDrawerTrigger]",
  exportAs: "rindDialogTrigger",
})
export class DialogTrigger {
  readonly id = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  constructor() {
    const root = injectDialog("rindDialogTrigger")
    const id = injectPartId(root, "trigger", () => this.id())
    const b = injectButton(
      (m) => untracked(() => root.api()).pressTrigger(untracked(id), m),
      () => this.disabled(),
    )
    bindProps(
      () => ({
        ...joinHandlers(
          root.api().trigger({
            id: id(),
            focused: b.focused(),
            modality: b.modality(),
            pressed: b.press.pressed(),
            disabled: this.disabled(),
          }),
          b.press.props,
          b.handlers,
        ),
        ...(this.disabled() ? { disabled: true } : {}),
      }),
      { owns: ["id", "disabled"] },
    )
  }
}

/** The page's cover behind a modal dialog: `<div rindDialogBackdrop>`. */
@Directive({ selector: "[rindDialogBackdrop]", exportAs: "rindDialogBackdrop" })
export class DialogBackdrop {
  constructor() {
    const root = injectDialog("rindDialogBackdrop")
    const el: Element = inject(ElementRef).nativeElement
    const presence = injectPresence(() => root.isOpen(), el, {
      keepMounted: () => root.keepMounted(),
    })
    bindProps(() => {
      // Non-modal dialogs render no backdrop: the page stays usable (zag#3401).
      if (!root.isModal() || !presence.mounted()) return absentProps(root.scope, root.root())
      return { ...root.api().backdrop(), hidden: !root.isOpen() && root.keepMounted() }
    })
  }
}

/** Centres the content: `<div rindDialogPositioner>`. */
@Directive({ selector: "[rindDialogPositioner]", exportAs: "rindDialogPositioner" })
export class DialogPositioner {
  constructor() {
    const root = injectDialog("rindDialogPositioner")
    const el: Element = inject(ElementRef).nativeElement
    // It holds the content: it stays while the content's exit animations run.
    const presence = injectPresence(() => root.isOpen(), el, {
      keepMounted: () => root.keepMounted(),
      subtree: () => true,
    })
    bindProps(() => {
      if (!presence.mounted()) return absentProps(root.scope, root.root())
      return { ...root.api().positioner(), hidden: !root.isOpen() && root.keepMounted() }
    })
  }
}

/**
 * The dialog: `<div rindDialogContent>`. Layers opened from it are its children; headings
 * inside are one level below its Title.
 */
@Directive({
  selector: "[rindDialogContent]",
  exportAs: "rindDialogContent",
  providers: [
    {
      provide: LAYER,
      useFactory: () => {
        const root = injectDialog("rindDialogContent")
        return layerProvider(
          () => dialogLayerId(root.scope, root.root()),
          () => root.kind(),
        )
      },
    },
    {
      provide: HEADING_LEVEL,
      useFactory: () => {
        const root = injectDialog("rindDialogContent")
        return computed(() => Math.min(6, root.titleLevel() + 1))
      },
    },
  ],
})
export class DialogContent {
  constructor() {
    const root = injectDialog("rindDialogContent")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const focusWithin = signal(false)
    const contentFocused = signal(false)
    const modality = injectModality(env.modality, contentFocused)
    const presence = injectPresence(() => root.isOpen(), el, {
      keepMounted: () => root.keepMounted(),
    })
    let naming: { labelledBy?: string; describedBy?: string } = {}
    const { statics } = bindProps(
      () => {
        if (!presence.mounted()) return absentProps(root.scope, root.root())
        const open = root.isOpen()
        const exiting = !open && presence.state() === "exiting"
        const own = root
          .api({
            focusWithin: focusWithin(),
            contentFocused: contentFocused(),
            modality: modality(),
          })
          .content(naming)
        return {
          ...own,
          hidden: !open && !exiting && root.keepMounted(),
          // Closing: presses on the exiting content do nothing (mui/base-ui#3153).
          ...(exiting ? { inert: "" } : {}),
        }
      },
      { owns: ["aria-describedby", "aria-labelledby"] },
    )
    const labelledBy = statics.get("aria-labelledby")
    const describedBy = statics.get("aria-describedby")
    naming = {
      ...(labelledBy === undefined ? {} : { labelledBy }),
      ...(describedBy === undefined ? {} : { describedBy }),
    }
    const ready = injectRendered()
    effect((onCleanup) => {
      const mounted = ready() && presence.mounted()
      untracked(() => {
        root.contentMounted.set(mounted)
        if (!mounted || !(el instanceof HTMLElement)) return
        onCleanup(() => root.contentMounted.set(false))
        // Focus within, from the DOM itself: native focusin/focusout on the content plus a
        // check of the active element on attach and at the next frame (the initial focus
        // move), so it holds where a focus move does not reach the handlers (WebKit on Linux).
        const sync = () => {
          const active = el.ownerDocument.activeElement
          focusWithin.set(active !== null && el.contains(active))
          contentFocused.set(active === el)
        }
        const onFocusOut = (e: FocusEvent) => {
          const next = e.relatedTarget as Node | null
          if (next && el.contains(next)) return
          focusWithin.set(false)
          contentFocused.set(false)
        }
        sync()
        const frame = env.scheduler.requestAnimationFrame(sync)
        el.addEventListener("focusin", sync)
        el.addEventListener("focusout", onFocusOut)
        onCleanup(() => {
          env.scheduler.cancelAnimationFrame(frame)
          el.removeEventListener("focusin", sync)
          el.removeEventListener("focusout", onFocusOut)
        })
      })
    })
  }
}

/** Registers a title/description part with the Root while it is rendered. */
function injectRegistered(root: DialogRootBase, part: "title" | "description") {
  const ready = injectRendered()
  effect((onCleanup) => {
    if (!ready()) return
    const id = partId(root.scope, root.root(), part)
    untracked(() => root.rendered.set({ ...root.rendered(), [part]: id }))
    onCleanup(() => untracked(() => root.rendered.set({ ...root.rendered(), [part]: undefined })))
  })
}

/** The dialog's name: `<h2 rindDialogTitle>` (its element's level, else `level`). */
@Directive({
  selector: "[rindDialogTitle], [rindDrawerTitle]",
  exportAs: "rindDialogTitle",
})
export class DialogTitle {
  /** The heading level (default 2); headings in the content are one level below. */
  readonly level = input<HeadingLevel>(2)
  constructor() {
    const root = injectDialog("rindDialogTitle")
    const tag = (inject(ElementRef).nativeElement as Element).tagName.toLowerCase()
    injectRegistered(root, "title")
    effect(() => {
      const level = this.level()
      untracked(() => root.titleLevel.set(level))
    })
    bindProps(() => root.api().title({ level: this.level(), tag }), { owns: ["level"] })
  }
}

@Directive({
  selector: "[rindDialogDescription], [rindDrawerDescription]",
  exportAs: "rindDialogDescription",
})
export class DialogDescription {
  constructor() {
    const root = injectDialog("rindDialogDescription")
    injectRegistered(root, "description")
    bindProps(() => root.api().description())
  }
}

/** Cancel and Action: press-activated buttons that close with their own reason. */
@Directive()
abstract class CloseButton {
  readonly id = input<string>()
  readonly disabled = input(false, { transform: booleanAttribute })
  protected wire(part: "cancel" | "action") {
    const root = injectDialog(part === "cancel" ? "rindDialogCancel" : "rindDialogAction")
    const id = injectPartId(root, part, () => this.id())
    const b = injectButton(
      (m) => {
        const api = untracked(() => root.api())
        if (part === "cancel") api.pressCancel(m)
        else api.pressAction(untracked(id), m)
      },
      () => this.disabled(),
    )
    bindProps(
      () => ({
        ...joinHandlers(
          root.api()[part]({
            id: id(),
            focused: b.focused(),
            modality: b.modality(),
            pressed: b.press.pressed(),
            disabled: this.disabled(),
          }),
          b.press.props,
          b.handlers,
        ),
        ...(this.disabled() ? { disabled: true } : {}),
      }),
      { owns: ["id", "disabled"] },
    )
  }
}

/** Dismisses a confirmation: `<button rindDialogCancel>` (an alert dialog's first focus). */
@Directive({ selector: "[rindDialogCancel]", exportAs: "rindDialogCancel" })
export class DialogCancel extends CloseButton {
  constructor() {
    super()
    this.wire("cancel")
  }
}

/** Confirms and closes: `<button rindDialogAction>`. */
@Directive({ selector: "[rindDialogAction]", exportAs: "rindDialogAction" })
export class DialogAction extends CloseButton {
  constructor() {
    super()
    this.wire("action")
  }
}

/** Closes it: `<button rindDialogCloseTrigger>`; an empty one (an icon) is named "Close". */
@Directive({
  selector: "[rindDialogCloseTrigger], [rindDrawerCloseTrigger]",
  exportAs: "rindDialogCloseTrigger",
})
export class DialogCloseTrigger {
  readonly id = input<string>()
  constructor() {
    const root = injectDialog("rindDialogCloseTrigger")
    const el: Element = inject(ElementRef).nativeElement
    const id = injectPartId(root, "close", () => this.id())
    const b = injectButton((m) => {
      const api = untracked(() => root.api())
      const node = el as HTMLButtonElement
      // A submit button of a form: close on that form's submit, so the form is still
      // connected when it submits (radix#1109, #1779); an invalid form keeps it open.
      if (node.type === "submit" && node.form) {
        const form = node.form
        const onSubmit = () => api.pressClose(m)
        form.addEventListener("submit", onSubmit, { once: true })
        b.env.scheduler.setTimeout(() => form.removeEventListener("submit", onSubmit), 0)
        return
      }
      api.pressClose(m)
    })
    // No content of its own (an icon): named by messages.close.
    const empty = signal(false)
    bindProps(
      () =>
        joinHandlers(
          root.api().closeTrigger({
            id: id(),
            focused: b.focused(),
            modality: b.modality(),
            pressed: b.press.pressed(),
            empty: empty() || (el.textContent ?? "").trim() === "",
          }),
          b.press.props,
          b.handlers,
        ),
      { owns: ["id"] },
    )
    if (inject(PLATFORM_ID) === "browser")
      afterEveryRender({ read: () => empty.set((el.textContent ?? "").trim() === "") })
  }
}

/**
 * The dialog's portal (`<ng-template rindDialogPortal>`). Its logical parent is the opener
 * once open; before that (and when opened programmatically) the first trigger, so the host
 * carries the trigger's theme, dir and lang from the first open on.
 */
@Directive({
  selector: "ng-template[rindDialogPortal], ng-template[rindDrawerPortal]",
  exportAs: "rindDialogPortal",
  providers: PORTAL_PROVIDERS,
})
export class DialogPortal extends PortalBase {
  private readonly owner = injectDialog("rindDialogPortal")
  private readonly env = injectEnvironment()
  protected parent(): Element | null {
    const opener = this.owner.view().context.opener
    const root = this.owner.root()
    return (
      (opener ? this.env.dom.getById(opener) : null) ??
      this.env.dom
        .getRootNode()
        .querySelector?.(
          `[data-scope="${this.owner.scope}"][data-part="trigger"][data-instance="${root}"]`,
        ) ??
      null
    )
  }
}

/** The Dialog's parts, for a standalone component's `imports`. */
export const Dialog = [
  DialogRoot,
  DialogTrigger,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogCancel,
  DialogAction,
  DialogCloseTrigger,
  DialogPortal,
] as const
