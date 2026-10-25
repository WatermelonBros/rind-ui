import { NgComponentOutlet } from "@angular/common"
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  type Type,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type ClipboardCopyDetails,
  type ClipboardCopyState,
  type ClipboardMessages,
  type ClipboardEvent as CopyEvent,
  clipboardCapability,
  clipboardConnect,
  clipboardInputCopy,
  clipboardMachine,
  clipboardMessages,
  type MessageOverrides,
  partId,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectIcon, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"

/** The clipboard's state, for the template (`#c="rindClipboardRoot"`, `c.state()`). */
export interface ClipboardRenderState {
  readonly copyState: ClipboardCopyState
  readonly value: string
}

const CLIPBOARD = new InjectionToken<ClipboardRoot>("rind-ui.clipboard")

function injectClipboard(part: string): ClipboardRoot {
  const root = inject(CLIPBOARD, { optional: true })
  if (!root) throw new Error(`rindClipboard${part} must be inside rindClipboardRoot`)
  return root
}

/** Focus state with the modality it arrived by (keyboard focus shows the ring). */
function injectFocus() {
  const env = injectEnvironment()
  // Tracks the modality from the first render, so the first keyboard focus is already visible.
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  return { env, focused, modality }
}

/**
 * Copies a value: `<div rindClipboardRoot [value]="key">` with a Trigger (a bare copy button),
 * or a Label and a Control holding the read-only Input and the Trigger.
 */
@Directive({
  selector: "[rindClipboardRoot]",
  exportAs: "rindClipboardRoot",
  providers: [{ provide: CLIPBOARD, useExisting: forwardRef(() => ClipboardRoot) }],
})
export class ClipboardRoot {
  /** What a press copies; read when the write starts. */
  readonly value = input.required<string>()
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration = input<number>()
  readonly disabled = input(false, { transform: booleanAttribute })
  /** With text in the Trigger, set `copy` to that text (label in name). */
  readonly messages = input<MessageOverrides<ClipboardMessages>>()
  /** Default: the provider's locale (the announcement's language). */
  readonly locale = input<string>()
  readonly id = input<string>()
  /**
   * Once per result, after the write settled (or the Input's own copy). Not `copy`: a `(copy)`
   * listener also hears the native copy event bubbling from the Input.
   */
  readonly copyResult = output<ClipboardCopyDetails>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof clipboardConnect>>
  /** @internal */
  readonly send: (event: CopyEvent) => void
  /** @internal */
  readonly copyAnchor: { value: Element | null } = { value: null }
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"label" | "input">>
  /** @internal */
  readonly ids: () => { readonly label: string; readonly input: string; readonly trigger: string }
  readonly state: Signal<ClipboardRenderState>

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment(announcerCapability, clipboardCapability)
    const messages = injectMessages("clipboard", clipboardMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    this.registry = injectPartRegistry<"label" | "input">(() => ({
      scope: "clipboard",
      root: instance(),
    }))
    const copyAnchor = this.copyAnchor
    const { view, send } = injectMachine(
      clipboardMachine,
      () => ({
        value: this.value(),
        messages: messages(),
        id: instance(),
        lang: locale().locale,
        copyFeedbackDuration: this.copyFeedbackDuration(),
        disabled: this.disabled(),
        onCopy: (d: ClipboardCopyDetails) => this.copyResult.emit(d),
        getCopyAnchor: () => (copyAnchor.value instanceof HTMLElement ? copyAnchor.value : null),
      }),
      env,
    )
    this.send = send
    this.ids = () => ({
      label: partId("clipboard", instance(), "label"),
      input: partId("clipboard", instance(), "input"),
      trigger: partId("clipboard", instance(), "trigger"),
    })
    const labelId = injectRenderedId(this.registry, "label")
    const inputId = injectRenderedId(this.registry, "input")
    this.state = computed(() => ({ copyState: view().state, value: this.value() }))
    this.api = computed(() =>
      clipboardConnect(
        {
          instance: instance(),
          state: view().state,
          value: this.value(),
          disabled: this.disabled(),
          messages: messages(),
          ids: {
            label: labelId() ?? this.ids().label,
            input: inputId() ?? this.ids().input,
            trigger: this.ids().trigger,
          },
          rendered: { label: labelId() !== undefined, input: inputId() !== undefined },
        },
        env,
      ),
    )
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: ["copyfeedbackduration", "disabled", "id", "locale", "messages", "value"],
      },
    )
  }
}

@Directive({ selector: "[rindClipboardLabel]", exportAs: "rindClipboardLabel" })
export class ClipboardLabel {
  readonly id = input<string>()
  constructor() {
    const root = injectClipboard("Label")
    const own = () => this.id() ?? root.ids().label
    injectRegisterPart(root.registry, "label", own)
    bindProps(() => ({ ...root.api().label(), id: own() }), { owns: ["id"] })
  }
}

/** The group around the Input and the Trigger. */
@Directive({ selector: "[rindClipboardControl]", exportAs: "rindClipboardControl" })
export class ClipboardControl {
  constructor() {
    const root = injectClipboard("Control")
    bindProps(() => root.api().control())
  }
}

/** The read-only `<input rindClipboardInput>` showing the value. */
@Directive({ selector: "[rindClipboardInput]", exportAs: "rindClipboardInput" })
export class ClipboardInput {
  readonly id = input<string>()
  constructor() {
    const root = injectClipboard("Input")
    const own = () => this.id() ?? root.ids().input
    injectRegisterPart(root.registry, "input", own)
    const { env, focused, modality } = injectFocus()
    // The pointer press that focuses the Input selects the whole value after its mouseup (which
    // would collapse a selection made on focus, in Safari and Chrome); later presses keep the
    // native selection.
    let selectOnUp = false
    const asInput = (t: EventTarget | null) => (t instanceof HTMLInputElement ? t : null)
    bindProps(
      () => ({
        ...joinHandlers(root.api().input({ focused: focused(), modality: modality() }), {
          onPointerDown: (e: PointerEvent) => {
            if (document.activeElement !== e.currentTarget) selectOnUp = true
          },
          onMouseUp: (e: MouseEvent) => {
            if (!selectOnUp) return
            selectOnUp = false
            e.preventDefault()
            asInput(e.currentTarget)?.select()
          },
          onFocusIn: (e: FocusEvent) => {
            focused.set(true)
            if (env.modality.modality() !== "pointer" && env.modality.modality() !== "touch")
              asInput(e.currentTarget)?.select()
          },
          onFocusOut: () => {
            focused.set(false)
            selectOnUp = false
          },
          onCopy: (e: Event) => {
            const el = asInput(e.currentTarget)
            if (!el) return
            root.send(
              clipboardInputCopy({
                value: el.value,
                selectionStart: el.selectionStart,
                selectionEnd: el.selectionEnd,
              }),
            )
          },
        }),
        id: own(),
      }),
      { owns: ["id"] },
    )
  }
}

/** Copies on press: `<button rindClipboardTrigger>`; named "Copy" unless you name it. */
@Directive({ selector: "[rindClipboardTrigger]", exportAs: "rindClipboardTrigger" })
export class ClipboardTrigger {
  constructor() {
    const root = injectClipboard("Trigger")
    const el: Element = inject(ElementRef).nativeElement
    root.copyAnchor.value = el
    const tag = el.tagName.toLowerCase()
    const native = tag === "button" || tag === "input"
    const read = (name: string) => inject(new HostAttributeToken(name), { optional: true })
    // A consumer name replaces the default one, labelled-by included (spec "Trigger Name").
    const ownName = read("aria-label") !== null && read("aria-labelledby") === null
    const { focused, modality } = injectFocus()
    bindProps(() => {
      const api = root.api().trigger({ focused: focused(), modality: modality(), tag })
      return joinHandlers(ownName ? { ...api, "aria-labelledby": undefined } : api, {
        // The write starts in the click's task (WebKit's user-activation rule); an assistive
        // technology press is a bare click too.
        onClick: () => root.send({ type: "COPY" }),
        // A non-button element: Enter and Space click it, as a button would.
        onKeyDown: (e: KeyboardEvent) => {
          if (native || e.repeat) return
          if (e.key === "Enter") (e.currentTarget as HTMLElement).click()
          if (e.key === " ") e.preventDefault()
        },
        onKeyUp: (e: KeyboardEvent) => {
          if (!native && e.key === " ") (e.currentTarget as HTMLElement).click()
        },
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
      })
    })
  }
}

/**
 * Follows the copy state (`data-state`): its content (switch on `c.state().copyState`), else the
 * provider's icon for the state (copy, check, x), else nothing (the theme draws it).
 */
@Component({
  selector: "[rindClipboardIndicator]",
  exportAs: "rindClipboardIndicator",
  imports: [NgComponentOutlet],
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>@if (icon(); as i) {<ng-container *ngComponentOutlet="i" />}</ng-content>`,
})
export class ClipboardIndicator {
  /** @internal */
  protected readonly icon: Signal<Type<unknown> | undefined>
  constructor() {
    const root = injectClipboard("Indicator")
    const icons = { copy: injectIcon("copy"), check: injectIcon("check"), x: injectIcon("x") }
    this.icon = computed(() => {
      const s = root.state().copyState
      return icons[s === "copied" ? "check" : s === "error" ? "x" : "copy"]()
    })
    bindProps(() => root.api().indicator())
  }
}

/** The value as text: its content, or the value. */
@Component({
  selector: "[rindClipboardValueText]",
  exportAs: "rindClipboardValueText",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ value() }}</ng-content>",
})
export class ClipboardValueText {
  /** @internal */
  protected readonly value: Signal<string>
  constructor() {
    const root = injectClipboard("ValueText")
    this.value = computed(() => root.state().value)
    bindProps(() => root.api().valueText())
  }
}

/** The Clipboard's parts, for a standalone component's `imports`. */
export const Clipboard = [
  ClipboardRoot,
  ClipboardLabel,
  ClipboardControl,
  ClipboardInput,
  ClipboardTrigger,
  ClipboardIndicator,
  ClipboardValueText,
] as const
