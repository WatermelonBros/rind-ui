// Drawer: the Dialog's parts with the drawer machine, plus Handle, Indent and IndentBackground.
// Wiring only: the drawer's own attributes come from `drawerExtras`, a layer over the Dialog
// part each Drawer part hosts.
import {
  afterEveryRender,
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  InjectionToken,
  inject,
  input,
  isDevMode,
  numberAttribute,
  output,
  PLATFORM_ID,
  signal,
  untracked,
} from "@angular/core"
import {
  type DialogMessages,
  type DrawerEvent,
  type DrawerMessages,
  type DrawerSide,
  type dialogMachine,
  dialogMessages,
  drawerExtras,
  drawerIndentProps,
  drawerMachine,
  drawerMessages,
  drawerSide,
  drawerStack,
  type MessageOverrides,
  resolvedPoints,
  type Service,
  type SnapPoint,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import {
  DIALOG,
  DialogBackdrop,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogPortal,
  DialogPositioner,
  DialogRootBase,
  DialogTitle,
  DialogTrigger,
  injectDialog,
} from "../dialog/dialog"
import { type ChangeEvent, changeEmitter } from "../emit-change"
import { injectModality, injectPress } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

type DrawerService = Service<typeof drawerMachine>

const DRAWER = new InjectionToken<DrawerRoot>("rind-ui.drawer")

const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)
const optionalNumber = (v: number | string | undefined) =>
  v === undefined ? undefined : numberAttribute(v)

/**
 * A panel sliding in from an edge, dismissed by a swipe: the Dialog's parts
 * (`<ng-container rindDrawerRoot>`, Trigger, Portal, Backdrop, Positioner, Content, Title,
 * Description, CloseTrigger) plus a Handle and the page's Indent.
 */
@Directive({
  selector: "[rindDrawerRoot]",
  exportAs: "rindDrawerRoot",
  providers: [
    { provide: DIALOG, useExisting: forwardRef(() => DrawerRoot) },
    { provide: DRAWER, useExisting: forwardRef(() => DrawerRoot) },
  ],
})
export class DrawerRoot extends DialogRootBase {
  readonly messages = input<MessageOverrides<DrawerMessages>>()
  /** Default "bottom". Logical sides resolve from the direction. */
  readonly side = input<DrawerSide>()
  /** Fraction of the content's size a release must reach to dismiss (default 0.5). */
  readonly swipeThreshold = input<number | undefined, number | string | undefined>(undefined, {
    transform: optionalNumber,
  })
  /** px/ms toward the edge that dismisses (default 0.5). */
  readonly swipeVelocityThreshold = input<number | undefined, number | string | undefined>(
    undefined,
    { transform: optionalNumber },
  )
  /** Default true; false keeps the gesture for snap points only. */
  readonly closeOnSwipe = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  readonly snapPoints = input<readonly SnapPoint[]>()
  /** Controlled snap point (`[(snapPoint)]`). */
  readonly snapPoint = input<SnapPoint>()
  readonly defaultSnapPoint = input<SnapPoint>()
  readonly snapToSequentialPoints = input<boolean | undefined, boolean | "" | undefined>(
    undefined,
    { transform: optionalBoolean },
  )
  readonly snapPointChangeDetails = output<ChangeEvent<SnapPoint, DrawerEvent>>()
  /** The accepted snap point, for `[(snapPoint)]`. */
  readonly snapPointChange = output<SnapPoint>()

  /** @internal */
  readonly drawerTexts = injectMessages("drawer", drawerMessages, () => this.messages())
  /** @internal */
  readonly locale = injectLocale(() => undefined)

  constructor() {
    super()
    const onSnapPointChange = changeEmitter<SnapPoint, DrawerEvent>(
      this.snapPointChangeDetails,
      this.snapPointChange,
    )
    this.wire(
      {
        scope: "drawer",
        kind: "drawer",
        // Sound: the drawer machine is the Dialog's pieces plus its own; every Dialog part
        // reads and sends only the Dialog's context, values and events, which it keeps.
        machine: drawerMachine as unknown as typeof dialogMachine,
      },
      // The Dialog's messages, its close label the drawer's.
      injectMessages<DialogMessages>("dialog", dialogMessages, () => ({
        close: this.drawerTexts().close,
      })),
      // The drawer's props ride along: the drawer machine reads them.
      () => ({
        side: this.side(),
        dir: this.locale().dir,
        swipeThreshold: this.swipeThreshold(),
        swipeVelocityThreshold: this.swipeVelocityThreshold(),
        closeOnSwipe: this.closeOnSwipe(),
        snapPoints: this.snapPoints(),
        snapPoint: this.snapPoint(),
        defaultSnapPoint: this.defaultSnapPoint(),
        onSnapPointChange,
        snapToSequentialPoints: this.snapToSequentialPoints(),
      }),
    )
  }

  /**
   * Whether the Handle is a button (two or more measured snap points): the element picks the
   * part, `@if (d.handleIsButton()) { <button rindDrawerHandle> } @else { <div rindDrawerHandle> }`.
   */
  readonly handleIsButton = computed(() => this.extras().handleIsButton)

  /** @internal The drawer's own attributes, for the Dialog parts and the Handle. */
  extras() {
    // Sound: this Root's view is the drawer machine's (its context and values extend the Dialog's).
    const view = this.view() as unknown as ReturnType<DrawerService["view"]>
    const props = { side: this.side(), dir: this.locale().dir, snapPoints: this.snapPoints() }
    return drawerExtras(
      {
        instance: this.root(),
        open: view.matches("open"),
        closeReason: view.context.closeReason,
        side: drawerSide(props),
        swipe: view.context.swipe,
        nested: view.context.nested,
        size: view.context.sizes.content,
        resolved: resolvedPoints(props, view.context.sizes),
        snapPoint: view.values.snapPoint ?? null,
        messages: this.drawerTexts(),
      },
      // Sound: the service is the drawer machine's (see the constructor).
      this.send as unknown as DrawerService["send"],
    )
  }
}

function injectDrawer(part: string): DrawerRoot {
  injectDialog(part)
  const root = inject(DRAWER, { optional: true })
  if (!root) throw new Error(`${part} must be inside rindDrawerRoot`)
  return root
}

/** Places the sheet at its side: `<div rindDrawerPositioner>`. */
@Directive({
  selector: "[rindDrawerPositioner]",
  exportAs: "rindDrawerPositioner",
  hostDirectives: [DialogPositioner],
})
export class DrawerPositioner {
  constructor() {
    const root = injectDrawer("rindDrawerPositioner")
    bindProps(() => root.extras().positioner())
  }
}

@Directive({
  selector: "[rindDrawerBackdrop]",
  exportAs: "rindDrawerBackdrop",
  hostDirectives: [DialogBackdrop],
})
export class DrawerBackdrop {
  constructor() {
    const root = injectDrawer("rindDrawerBackdrop")
    bindProps(() => root.extras().backdrop())
  }
}

/** The sheet: `<div rindDrawerContent>`; a swipe toward its edge dismisses it. */
@Directive({
  selector: "[rindDrawerContent]",
  exportAs: "rindDrawerContent",
  hostDirectives: [DialogContent],
})
export class DrawerContent {
  constructor() {
    const root = injectDrawer("rindDrawerContent")
    bindProps(() => root.extras().content())
  }
}

/**
 * Inside the content: with two or more measured snap points a button cycling them
 * (`<button rindDrawerHandle>`), else decorative (`<div rindDrawerHandle>`). The element picks
 * the part: switch it on the Root's `handleIsButton()`.
 */
@Directive({ selector: "[rindDrawerHandle]", exportAs: "rindDrawerHandle" })
export class DrawerHandle {
  constructor() {
    const root = injectDrawer("rindDrawerHandle")
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const focused = signal(false)
    const modality = injectModality(env.modality, focused)
    const press = injectPress({
      env,
      send: (e) => {
        if (e.type === "PRESS") untracked(() => root.extras()).pressHandle(e.modality)
      },
      disabled: () => !untracked(() => root.extras()).handleIsButton,
    })
    bindProps(() => {
      const x = root.extras()
      const own = x.handle({ focused: focused(), modality: modality(), pressed: press.pressed() })
      if (!x.handleIsButton) return own
      return joinHandlers(own, press.props, {
        onFocus: () => focused.set(true),
        onBlur: () => focused.set(false),
      })
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
    if (!isDevMode()) return
    // Once rendered (the template's @if has switched the element): the element must match.
    let warned = false
    afterEveryRender(() => {
      const wanted = untracked(root.handleIsButton)
      if (warned || (el.tagName === "BUTTON") === wanted) return
      warned = true
      console.warn(
        `[rind-ui] drawer #${untracked(root.root)}: the handle is a <${el.tagName.toLowerCase()}>; with ${wanted ? "two or more" : "fewer than two"} measured snap points it is ${wanted ? "a <button>" : "decorative (a <div>)"}: switch it on handleIsButton()`,
      )
    })
  }
}

/** `data-active` while a modal drawer is open in the document; the progress after render. */
@Directive()
abstract class IndentPart {
  protected wire(part: "indent" | "indent-background") {
    const env = injectEnvironment()
    const el: Element = inject(ElementRef).nativeElement
    const active = signal(false)
    bindProps(() => drawerIndentProps(part, active()))
    // After render: the server and the first client render carry no variable (base-ui#4509).
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      const stack = drawerStack(env)
      active.set(stack.active())
      destroy.onDestroy(stack.subscribe(() => active.set(stack.active())))
      if (el instanceof HTMLElement) destroy.onDestroy(stack.registerIndent(el))
    })
  }
}

/** The page behind the drawers, scaled back while one is open: `<div rindDrawerIndent>`. */
@Directive({ selector: "[rindDrawerIndent]", exportAs: "rindDrawerIndent" })
export class DrawerIndent extends IndentPart {
  constructor() {
    super()
    this.wire("indent")
  }
}

/** Behind the Indent: `<div rindDrawerIndentBackground>`. */
@Directive({ selector: "[rindDrawerIndentBackground]", exportAs: "rindDrawerIndentBackground" })
export class DrawerIndentBackground extends IndentPart {
  constructor() {
    super()
    this.wire("indent-background")
  }
}

/** The Drawer's parts (the Dialog's own Trigger, Title, Description, CloseTrigger and Portal). */
export const Drawer = [
  DrawerRoot,
  DialogTrigger,
  DrawerBackdrop,
  DrawerPositioner,
  DrawerContent,
  DrawerHandle,
  DialogTitle,
  DialogDescription,
  DialogCloseTrigger,
  DialogPortal,
  DrawerIndent,
  DrawerIndentBackground,
] as const
