import {
  afterNextRender,
  afterRenderEffect,
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
  signal,
} from "@angular/core"
import {
  type AlertAnnounce,
  type AlertEvent,
  type AlertMessages,
  alertConnect,
  alertMachine,
  alertMessages,
  alertWarnings,
  announceableText,
  announcerCapability,
  focusPast,
  type MessageOverrides,
  observeText,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

export interface AlertState {
  readonly open: boolean
}

const ALERT = new InjectionToken<AlertRoot>("rind-ui.alert")

function injectAlert(part: string): AlertRoot {
  const root = inject(ALERT, { optional: true })
  if (!root) throw new Error(`rindAlert${part} must be inside rindAlertRoot`)
  return root
}

/** `undefined` stays undefined (uncontrolled); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/** Whether `el` is in the document as a rendered part of `scope` (hydrating server markup). */
const presentAtLoad = (el: Element, scope: string, part: string) =>
  el.getAttribute("data-scope") === scope && el.getAttribute("data-part") === part

/**
 * A message announced when it appears: `<div rindAlertRoot>` with a Title, a Description, an
 * Icon and a CloseTrigger. Dismissed (and after its exit animation), it is hidden: React
 * renders nothing.
 */
@Directive({
  selector: "[rindAlertRoot]",
  exportAs: "rindAlertRoot",
  providers: [{ provide: ALERT, useExisting: forwardRef(() => AlertRoot) }],
})
export class AlertRoot {
  /** Default `"polite"`: `"assertive"` for errors and failures, `"off"` for static content. */
  readonly announce = input<AlertAnnounce>()
  /** Announced instead of the Icon label, Title and Description joined. */
  readonly announcement = input<string>()
  /** Controlled visibility (`[(open)]`). */
  readonly open = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly defaultOpen = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /**
   * Where focus goes when the alert is dismissed with focus inside it. Default (or `null`): the
   * next tab stop after the alert, else the previous one. `false`: focus does not move.
   */
  readonly finalFocus = input<() => HTMLElement | null | false>()
  readonly messages = input<MessageOverrides<AlertMessages>>()
  readonly id = input<string>()
  /** Every dismissal or `open` change proposes a value; `details.cancel()` vetoes it. */
  readonly openChangeDetails = output<ChangeEvent<boolean, AlertEvent>>()
  /** The accepted value, for `[(open)]`. */
  readonly openChange = output<boolean>()

  private readonly emit = changeEmitter<boolean, AlertEvent>(
    this.openChangeDetails,
    this.openChange,
  )
  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly el: HTMLElement = inject(ElementRef).nativeElement
  /** @internal */
  readonly connect: () => ReturnType<typeof alertConnect>
  /** @internal Rendered (open, or exiting). */
  readonly present: () => boolean
  /** @internal */
  readonly send: (event: AlertEvent) => void
  /** The alert's state, for the template (`#a="rindAlertRoot"`, `a.state()`). */
  readonly state: () => AlertState

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const texts = injectMessages("alert", alertMessages, () => this.messages())
    const locale = injectLocale(() => undefined)
    const el = this.el
    const { view, send } = injectMachine(
      alertMachine,
      () => ({
        open: this.open(),
        defaultOpen: this.defaultOpen(),
        onOpenChange: this.emit,
        announce: this.announce(),
        announcement: this.announcement(),
        messages: texts(),
        id: this.instance(),
        lang: locale().locale,
        moveFocusOut: () => focusPast(el, this.finalFocus()?.(), env, "alert"),
      }),
      env,
    )
    this.send = send
    const isOpen = computed(() => view().state === "open")
    const presence = injectPresence(isOpen, el)
    this.present = presence.mounted
    this.state = computed(() => ({ open: isOpen() }))
    const connect = computed(() =>
      alertConnect({ instance: this.instance(), open: isOpen(), dismissLabel: texts().dismiss }),
    )
    this.connect = connect
    bindProps(
      () =>
        presence.mounted()
          ? { ...connect().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }
          : absentProps("alert", this.instance()),
      {
        owns: ["announce", "announcement", "defaultopen", "finalfocus", "id", "messages", "open"],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // A hydrated alert was present at load (the server wrote its part) and stays silent.
    const hydrating = presentAtLoad(el, "alert", "root")
    // Only the attributes the consumer wrote: the warnings read their presence.
    const own: Record<string, string> = {}
    for (const name of ["role", "aria-live", "aria-atomic"]) {
      const value = inject(new HostAttributeToken(name), { optional: true })
      if (value !== null) own[name] = value
    }
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      send({ type: "ROOT.MOUNT", hydrating, segments: announceableText(el) })
      alertWarnings(own)
    })
    // Shown again (`open` became true): the text read from what is rendered, so a change made
    // while it was hidden is announced once, as it is now.
    let wasOpen: boolean | undefined
    afterRenderEffect(() => {
      const now = isOpen()
      if (wasOpen === false && now) send({ type: "ROOT.SHOW", segments: announceableText(el) })
      wasOpen = now
    })
    // Every change of the rendered text while the alert is rendered and live.
    let stop: (() => void) | undefined
    afterRenderEffect(() => {
      const watch = presence.mounted() && (this.announce() ?? "polite") !== "off"
      stop?.()
      stop = watch
        ? observeText(el, (segments) => send({ type: "CONTENT.CHANGE", segments }))
        : undefined
    })
    destroy.onDestroy(() => stop?.())
  }
}

/** Decorative (`aria-hidden`), or named by `label` so the severity is in the alert's text. */
@Directive({ selector: "[rindAlertIcon]", exportAs: "rindAlertIcon" })
export class AlertIcon {
  /** Names the icon (`role="img"`), so the severity is in the alert's text ("Error"). */
  readonly label = input<string>()
  constructor() {
    const root = injectAlert("Icon")
    bindProps(
      () =>
        root.present() ? root.connect().icon(this.label()) : absentProps("alert", root.instance()),
      { owns: ["label"] },
    )
  }
}

@Directive({ selector: "[rindAlertTitle]", exportAs: "rindAlertTitle" })
export class AlertTitle {
  constructor() {
    const root = injectAlert("Title")
    bindProps(() =>
      root.present() ? root.connect().title() : absentProps("alert", root.instance()),
    )
  }
}

@Directive({ selector: "[rindAlertDescription]", exportAs: "rindAlertDescription" })
export class AlertDescription {
  constructor() {
    const root = injectAlert("Description")
    bindProps(() =>
      root.present() ? root.connect().description() : absentProps("alert", root.instance()),
    )
  }
}

/** Whether `el` has text a screen reader reads (an icon-only trigger has none). */
function hasText(el: Element): boolean {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3 && (node.textContent ?? "").trim() !== "") return true
    if (node.nodeType !== 1) continue
    // Hidden text does not name the button.
    if ((node as Element).getAttribute("aria-hidden") === "true") continue
    if (hasText(node as Element)) return true
  }
  return false
}

/** Dismisses the alert; named by `messages.dismiss` when it has no text of its own. */
@Directive({ selector: "[rindAlertCloseTrigger]", exportAs: "rindAlertCloseTrigger" })
export class AlertCloseTrigger {
  constructor() {
    const root = injectAlert("CloseTrigger")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const named =
      inject(new HostAttributeToken("aria-label"), { optional: true }) !== null ||
      inject(new HostAttributeToken("aria-labelledby"), { optional: true }) !== null
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    bindProps(() =>
      root.present()
        ? joinHandlers(
            root.connect().closeTrigger({
              // Read when the props apply: the content exists then.
              named: named || hasText(el),
              focused: focused(),
              modality: modality(),
            }),
            {
              onFocusIn: () => focused.set(true),
              onFocusOut: () => focused.set(false),
              onClick: () => {
                const r = root.el
                const active = r.ownerDocument.activeElement
                root.send({ type: "CLOSE", focusInside: !!active && r.contains(active) })
              },
            },
          )
        : absentProps("alert", root.instance()),
    )
    // Modality tracking runs while a trigger is rendered, so focus-visible is known on focus.
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
}

/** The Alert's parts, for a standalone component's `imports`. */
export const Alert = [
  AlertRoot,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  AlertCloseTrigger,
] as const
