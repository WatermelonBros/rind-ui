// Toast: `rindToaster` (the region of one store, rendered while it shows toasts) and the toast
// parts. Wiring only: the store and machines own lifetime, pausing and announcements; the
// connect owns every attribute; core/dom owns the hotkey, focus moves, measurement and the
// swipe.
import { NgTemplateOutlet } from "@angular/common"
import {
  afterEveryRender,
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  Component,
  type ComponentRef,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  effect,
  InjectionToken,
  Injector,
  inject,
  input,
  isDevMode,
  PLATFORM_ID,
  type Signal,
  signal,
  TemplateRef,
  untracked,
  ViewContainerRef,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  measureToast,
  type PartProps,
  resolvePortalTarget,
  type SwipeDirection,
  type Toaster as ToasterStore,
  type ToastMessages,
  type ToastSnapshot,
  toasterConnect,
  toasterMachine,
  toastMessages,
  trackSwipe,
  trackToastRegion,
  visibilityCapability,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps, joinHandlers } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectPresence } from "../inject-presence"
import { injectModality, injectPress } from "../inject-press"
import { injectEnvironment, injectLocale } from "../provider"

/** What the region gives its toasts. */
interface RegionCtx {
  readonly store: () => ToasterStore
  readonly api: Signal<ReturnType<typeof toasterConnect>>
  readonly swipeDirections: Signal<readonly SwipeDirection[]>
  readonly setSwiping: (active: boolean) => void
  readonly leaving: (el: HTMLElement) => void
}

/** One toast, for its parts. */
interface ToastCtx {
  readonly region: RegionCtx
  readonly toast: Signal<ToastSnapshot>
  readonly rendered: Signal<{ readonly title: boolean; readonly description: boolean }>
  readonly mount: (part: "title" | "description", on: boolean) => void
}

const TOAST = new InjectionToken<ToastCtx>("rind-ui.toast")

function injectToast(part: string): ToastCtx {
  const ctx = inject(TOAST, { optional: true })
  if (!ctx) throw new Error(`rindToast${part} must be inside a rindToaster's template`)
  return ctx
}

/** The default swipe: the placement's edge and the inline end. */
function defaultDirections(placement: string, dir: "ltr" | "rtl"): SwipeDirection[] {
  const edge: SwipeDirection = placement.startsWith("top") ? "up" : "down"
  return [edge, dir === "rtl" ? "left" : "right"]
}

/** The template's context: the toast it renders (`let-toast`). */
export interface ToasterContext {
  readonly $implicit: ToastSnapshot
}

/**
 * The region of one store: `<ng-template [rindToaster]="store" let-toast>` holding one toast's
 * markup (`<li rindToastRoot>`), stamped for each toast, newest first. Rendered only while it
 * shows toasts (zag#2988), and only after mount: the server and the first client render show
 * no toast (no hydration mismatch, no region before the store is bound).
 */
@Directive({ selector: "ng-template[rindToaster]", exportAs: "rindToaster" })
export class Toaster {
  readonly toaster = input.required<ToasterStore>({ alias: "rindToaster" })
  /** Base of the region's generated ids (default: generated). */
  readonly id = input<string>()
  readonly messages = input<Partial<ToastMessages>>()
  /** Default true: rendered in the shared portal. */
  readonly portal = input(true, { transform: booleanAttribute })

  /** @internal */
  readonly template = inject<TemplateRef<ToasterContext>>(TemplateRef)
  /** @internal */
  readonly toasts = signal<readonly ToastSnapshot[]>([])
  /** @internal */
  readonly ctx: RegionCtx
  /** @internal */
  readonly regionProps: Signal<PartProps>
  /** @internal */
  region: HTMLElement | null = null

  private readonly injector = inject(Injector)
  private readonly slots = new Map<string, Injector>()

  constructor() {
    const env = injectEnvironment(announcerCapability, visibilityCapability)
    const instance = injectRootId(() => this.id())
    const locale = injectLocale(() => undefined)
    const messages = computed((): ToastMessages => ({ ...toastMessages, ...this.messages() }))
    const { view, send } = injectMachine(toasterMachine, () => ({
      expand: this.toaster().options.expand,
      onReason: (reason, on) => this.toaster().regionReason(reason, on),
    }))
    // Stable across renders: the toasts' swipe effects depend on them (a re-run mid-drag
    // would stop the gesture).
    let stable: readonly SwipeDirection[] = []
    const swipeDirections = computed(() => {
      const store = this.toaster()
      const next =
        store.options.swipeDirections ?? defaultDirections(store.options.placement, locale().dir)
      if (next.join(",") !== stable.join(",")) stable = next
      return stable
    })
    const api = computed(() => {
      const store = this.toaster()
      return toasterConnect({
        instance: instance(),
        placement: store.options.placement,
        toasts: this.toasts(),
        expanded: view().matches("expanded") || store.options.expand,
        paused: view().context.hovered || view().context.focused,
        gap: store.options.gap,
        hotkey: store.options.hotkey,
        messages: messages(),
      })
    })
    let tracker: ReturnType<typeof trackToastRegion> | null = null
    this.ctx = {
      store: () => untracked(this.toaster),
      api,
      swipeDirections,
      setSwiping: (active) => send({ type: "SWIPING", active }),
      leaving: (el) => tracker?.leaving(el),
    }
    const modalityOf = () => env.modality.modality()
    this.regionProps = computed(
      (): PartProps => ({
        ...joinHandlers(api().region(), {
          // Mouse and pen hover pause and expand; a touch never hovers.
          onPointerEnter: (e: PointerEvent) => {
            if (e.pointerType !== "touch") send({ type: "HOVER.START", modality: "pointer" })
          },
          onPointerLeave: (e: PointerEvent) => {
            if (e.pointerType !== "touch") send({ type: "HOVER.END", modality: "pointer" })
          },
          onFocusIn: (e: FocusEvent) => {
            const el = e.currentTarget as Element
            if (!el.contains(e.relatedTarget as Node | null)) {
              send({ type: "FOCUS.ENTER", modality: modalityOf() })
            }
          },
          onFocusOut: (e: FocusEvent) => {
            const el = e.currentTarget as Element
            if (!el.contains(e.relatedTarget as Node | null)) {
              send({ type: "FOCUS.LEAVE", modality: modalityOf() })
            }
          },
        }),
        dir: locale().dir,
        lang: locale().locale,
      }),
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const mounted = signal(false)
    afterNextRender(() => mounted.set(true))
    // Bound to this environment while rendered; the announcer's regions created eagerly.
    effect((onCleanup) => {
      if (!mounted()) return
      const store = this.toaster()
      untracked(() => {
        this.toasts.set(store.toasts())
        const off = store.subscribe(() => this.toasts.set(store.toasts()))
        const stopPrepare = env.announcer.prepare()
        // Read when the store starts a toast: the latest messages.
        const detach = store.attach(env, { messages: messages() })
        onCleanup(() => {
          off()
          detach()
          stopPrepare()
        })
      })
    })
    // The region, while it shows toasts: in place, or in a portal host in the body.
    const container = inject(ViewContainerRef)
    const visible = computed(() => mounted() && api().visible)
    effect((onCleanup) => {
      if (!visible()) return
      const portal = this.portal()
      untracked(() => {
        const ref: ComponentRef<ToastRegion> = container.createComponent(ToastRegion, {
          injector: Injector.create({
            providers: [{ provide: Toaster, useValue: this }],
            parent: this.injector,
          }),
        })
        const section = ref.location.nativeElement as HTMLElement
        let host: HTMLElement | null = null
        if (portal) {
          host = document.createElement("div")
          host.setAttribute("data-rind-portal", "")
          resolvePortalTarget(null, undefined).appendChild(host)
          host.appendChild(section)
        }
        this.region = section
        onCleanup(() => {
          this.region = null
          ref.destroy()
          host?.remove()
        })
      })
    })
    afterRenderEffect((onCleanup) => {
      if (!visible()) return
      const hotkey = this.toaster().options.hotkey
      const t = trackToastRegion(env, {
        region: () => this.region,
        toasts: () =>
          Array.from(
            this.region?.querySelectorAll<HTMLElement>('[data-scope="toast"][data-part="root"]') ??
              [],
          ),
        hotkey,
        onEnter: () => send({ type: "HOTKEY" }),
      })
      tracker = t
      onCleanup(() => {
        t.stop()
        tracker = null
      })
    })
  }

  /** @internal One toast's injector: its parts read it (kept while the toast is listed). */
  slot(toast: ToastSnapshot): Injector {
    const known = this.slots.get(toast.instance)
    if (known) return known
    const id = toast.instance
    const rendered = signal({ title: false, description: false })
    const ctx: ToastCtx = {
      region: this.ctx,
      toast: computed(() => this.toasts().find((t) => t.instance === id) ?? toast),
      rendered,
      mount: (part, on) => {
        if (untracked(rendered)[part] !== on) rendered.set({ ...untracked(rendered), [part]: on })
      },
    }
    const injector = Injector.create({
      providers: [{ provide: TOAST, useValue: ctx }],
      parent: this.injector,
    })
    this.slots.set(id, injector)
    // Forgotten once the store drops the toast.
    for (const key of this.slots.keys()) {
      if (!untracked(this.toasts).some((t) => t.instance === key) && key !== id) {
        this.slots.delete(key)
      }
    }
    return injector
  }
}

/** The region's list: its attributes. Internal. */
@Directive({ selector: "[rindToastList]" })
export class ToastList {
  constructor() {
    const toaster = inject(Toaster)
    bindProps(() => toaster.ctx.api().list())
  }
}

/** The region element the Toaster creates: a named `<section>` with the list. Internal. */
@Component({
  selector: "section[rindToastRegion]",
  imports: [NgTemplateOutlet, ToastList],
  encapsulation: ViewEncapsulation.None,
  template: `<ol rindToastList>
    @for (toast of toaster.toasts(); track toast.instance) {
      <ng-container
        *ngTemplateOutlet="toaster.template; context: { $implicit: toast }; injector: toaster.slot(toast)"
      />
    }
  </ol>`,
})
export class ToastRegion {
  protected readonly toaster = inject(Toaster)
  constructor() {
    bindProps(() => this.toaster.regionProps())
  }
}

/** One toast: `<li rindToastRoot>`, focusable, dismissed by Escape or a swipe. */
@Directive({ selector: "[rindToastRoot]", exportAs: "rindToastRoot" })
export class ToastRoot {
  constructor() {
    const ctx = injectToast("Root")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const store = ctx.region.store
    // Primitives, not the snapshot: every store update (a measured height) is a new snapshot,
    // and the effects below must not re-run on it.
    const instance = computed(() => ctx.toast().instance)
    const service = computed(() => store().service(instance()))
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const open = computed(() => ctx.toast().state !== "dismissed")
    const dismissible = computed(() => ctx.toast().data.dismissible !== false)
    const persistent = computed(() => ctx.toast().state === "persistent")
    const presence = injectPresence(open, el, {
      // The exit ended: the record goes (presses during the exit keep nothing: mui/base-ui#5135).
      onExitComplete: () => store().remove(untracked(ctx.toast).instance),
    })
    bindProps(() => {
      const s = service()
      const toast = ctx.toast()
      if (!presence.mounted() || !s) return absentProps("toast", toast.instance)
      return joinHandlers(
        ctx.region.api().root(toast, {
          rendered: ctx.rendered(),
          focused: focused(),
          modality: modality(),
        }),
        {
          onKeyDown: ctx.region.api().onRootKeyDown(s.send),
          // The toast itself, not its buttons: data-focus(-visible) on the root.
          onFocusIn: (e: FocusEvent) => focused.set(e.target === e.currentTarget),
          onFocusOut: () => focused.set(false),
        },
      )
    })
    if (inject(PLATFORM_ID) !== "browser") return
    // Before it becomes inert for its exit, focus inside moves on (mui/base-ui#3466).
    effect(() => {
      if (!open() && el instanceof HTMLElement) untracked(() => ctx.region.leaving(el))
    })
    // Its layout height, unscaled, on render and on every resize.
    afterRenderEffect((onCleanup) => {
      const s = service()
      if (!(el instanceof HTMLElement) || !s) return
      onCleanup(measureToast(el, (height) => s.send({ type: "MEASURED", height })))
    })
    // The swipe: discrete events only; it pauses the toast while in progress.
    afterRenderEffect((onCleanup) => {
      const s = service()
      const directions = ctx.region.swipeDirections()
      if (!s || !dismissible() || !open()) return
      const tracker = trackSwipe(env, {
        element: () => (el instanceof HTMLElement ? el : null),
        directions: () => directions,
        prefix: "toast",
        onStart: (e) => {
          s.send({ type: "PAUSE", reason: "swipe" })
          s.send({ type: "SWIPE.START", modality: e.modality })
          ctx.region.setSwiping(true)
        },
        onEnd: (e) => {
          s.send({ type: "SWIPE", ...e })
          s.send({ type: "RESUME", reason: "swipe" })
          ctx.region.setSwiping(false)
          if (s.getSnapshot().state !== "dismissed") tracker.reset()
        },
        onCancel: () => {
          s.send({ type: "SWIPE.CANCEL" })
          s.send({ type: "RESUME", reason: "swipe" })
          ctx.region.setSwiping(false)
        },
      })
      onCleanup(() => tracker.stop())
    })
    // Development: a persistent toast without a close trigger strands touch screen readers.
    if (!isDevMode()) return
    afterRenderEffect(() => {
      if (!persistent()) return
      if (!el.querySelector('[data-part="close-trigger"]')) {
        console.warn(
          `[rind-ui] toast "${untracked(ctx.toast).data.id}": a persistent toast without rindToastCloseTrigger; touch screen-reader users cannot press Escape or swipe`,
        )
      }
    })
  }
}

/** Registers a title/description part with its toast while it is rendered. */
function injectTextPart(ctx: ToastCtx, part: "title" | "description") {
  bindProps(() => ctx.region.api()[part](ctx.toast()))
  if (inject(PLATFORM_ID) !== "browser") return
  afterNextRender(() => ctx.mount(part, true))
  inject(DestroyRef).onDestroy(() => ctx.mount(part, false))
}

/** The toast's title: `<div rindToastTitle>`, the toast's `title` unless it has content. */
@Component({
  selector: "[rindToastTitle]",
  exportAs: "rindToastTitle",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>{{ toast().data.title }}</ng-content>`,
})
export class ToastTitle {
  protected readonly toast = injectToast("Title").toast
  constructor() {
    injectTextPart(injectToast("Title"), "title")
  }
}

/** The toast's description: `<div rindToastDescription>`, its `description` unless it has content. */
@Component({
  selector: "[rindToastDescription]",
  exportAs: "rindToastDescription",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>{{ toast().data.description }}</ng-content>`,
})
export class ToastDescription {
  protected readonly toast = injectToast("Description").toast
  constructor() {
    injectTextPart(injectToast("Description"), "description")
  }
}

/** Focus, modality and press of a toast's button. */
function injectToastButton(send: () => void) {
  const env = injectEnvironment()
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  const press = injectPress({
    env,
    send: (e) => {
      if (e.type === "PRESS") send()
    },
  })
  return {
    state: () => ({ focused: focused(), modality: modality(), pressed: press.pressed() }),
    handlers: joinHandlers(press.props, {
      onFocus: () => focused.set(true),
      onBlur: () => focused.set(false),
    }),
  }
}

/** The toast's action: `<button rindToastActionTrigger>`, its action's label unless it has content. */
@Component({
  selector: "[rindToastActionTrigger]",
  exportAs: "rindToastActionTrigger",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>{{ toast().data.action?.label }}</ng-content>`,
})
export class ToastActionTrigger {
  protected readonly toast: Signal<ToastSnapshot>
  constructor() {
    const ctx = injectToast("ActionTrigger")
    this.toast = ctx.toast
    const b = injectToastButton(() =>
      ctx.region
        .store()
        .service(untracked(ctx.toast).instance)
        ?.send({ type: "ACTION_PRESS", modality: "pointer" }),
    )
    bindProps(() =>
      joinHandlers(ctx.region.api().actionTrigger(ctx.toast(), b.state()), b.handlers),
    )
  }
}

/** Dismisses the toast: `<button rindToastCloseTrigger>`; an empty one (an icon) is named. */
@Directive({ selector: "[rindToastCloseTrigger]", exportAs: "rindToastCloseTrigger" })
export class ToastCloseTrigger {
  constructor() {
    const ctx = injectToast("CloseTrigger")
    const el: Element = inject(ElementRef).nativeElement
    const b = injectToastButton(() =>
      ctx.region
        .store()
        .service(untracked(ctx.toast).instance)
        ?.send({ type: "CLOSE_TRIGGER_PRESS", modality: "pointer" }),
    )
    const empty = signal(false)
    bindProps(() =>
      joinHandlers(
        ctx.region.api().closeTrigger(ctx.toast(), {
          ...b.state(),
          empty: empty() || (el.textContent ?? "").trim() === "",
        }),
        b.handlers,
      ),
    )
    if (inject(PLATFORM_ID) === "browser")
      afterEveryRender({ read: () => empty.set((el.textContent ?? "").trim() === "") })
  }
}

/** The Toast's parts (with the Toaster), for a standalone component's `imports`. */
export const Toast = [
  Toaster,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastActionTrigger,
  ToastCloseTrigger,
] as const
