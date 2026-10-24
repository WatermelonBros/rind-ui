import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  Directive,
  ElementRef,
  forwardRef,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type MessageOverrides,
  type SkeletonMessages,
  skeletonConnect,
  skeletonMachine,
  skeletonMessages,
  warnStatusPlacement,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"

export interface SkeletonState {
  readonly loading: boolean
}

const SKELETON = new InjectionToken<SkeletonRoot>("rind-ui.skeleton")

function injectSkeleton(part: string): SkeletonRoot {
  const root = inject(SKELETON, { optional: true })
  if (!root) throw new Error(`rindSkeleton${part} must be inside rindSkeletonRoot`)
  return root
}

/** `undefined` stays undefined (the default); a bare attribute is `true`. */
const optionalBoolean = (v: boolean | "" | undefined) => (v === undefined ? undefined : v !== false)

/**
 * A loading area: `<div rindSkeletonRoot [loading]="loading">` with a Status, the Content
 * (`aria-busy` while loading) and Items (placeholders, or wrappers hiding stale content).
 */
@Directive({
  selector: "[rindSkeletonRoot]",
  exportAs: "rindSkeletonRoot",
  providers: [{ provide: SKELETON, useExisting: forwardRef(() => SkeletonRoot) }],
})
export class SkeletonRoot {
  /** Default `true`: the whole area is loading. */
  readonly loading = input(true, { transform: booleanAttribute })
  /** Announce politely on `loading → loaded`: `true` for `messages.loaded`, or the text. */
  readonly announceOnLoad = input<boolean | string | undefined>(undefined)
  /** Default `true`: Items carry `data-animate` while loading. */
  readonly animate = input(true, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<SkeletonMessages>>()
  readonly id = input<string>()

  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly texts = injectMessages("skeleton", skeletonMessages, () => this.messages())
  /** @internal */
  readonly connect: () => ReturnType<typeof skeletonConnect>
  /** The area's state, for the template (`#s="rindSkeletonRoot"`, `s.state()`). */
  readonly state: () => SkeletonState

  constructor() {
    const locale = injectLocale(() => undefined)
    const env = injectEnvironment(announcerCapability)
    const { view } = injectMachine(
      skeletonMachine,
      () => ({
        loading: this.loading(),
        announceOnLoad: this.announceOnLoad(),
        messages: this.texts(),
        id: this.instance(),
        lang: locale().locale,
      }),
      env,
    )
    const loading = computed(() => view().state === "loading")
    const connect = computed(() =>
      skeletonConnect({ instance: this.instance(), loading: loading(), animate: this.animate() }),
    )
    this.connect = connect
    this.state = computed(() => ({ loading: loading() }))
    bindProps(
      () => ({ ...connect().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      { owns: ["animate", "announceonload", "id", "loading", "messages"] },
    )
  }
}

/**
 * The loading text, visually hidden, outside Content: its content, or `messages.loading`.
 * Once loaded it is hidden (React renders nothing).
 */
@Component({
  selector: "[rindSkeletonStatus]",
  exportAs: "rindSkeletonStatus",
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content>@if (root.state().loading) {{{ root.texts().loading }}}</ng-content>`,
})
export class SkeletonStatus {
  /** @internal */
  protected readonly root = injectSkeleton("Status")
  constructor() {
    const el: Element = inject(ElementRef).nativeElement
    bindProps(() => this.root.connect().status() ?? absentProps("skeleton", this.root.instance()))
    if (inject(PLATFORM_ID) !== "browser") return
    afterRenderEffect(() => {
      if (this.root.state().loading) warnStatusPlacement(el)
    })
  }
}

/** The loading region: `aria-busy` while loading. */
@Directive({ selector: "[rindSkeletonContent]", exportAs: "rindSkeletonContent" })
export class SkeletonContent {
  constructor() {
    const root = injectSkeleton("Content")
    bindProps(() => root.connect().content())
  }
}

/** A placeholder, or a wrapper hiding stale content while loading. */
@Directive({ selector: "[rindSkeletonItem]", exportAs: "rindSkeletonItem" })
export class SkeletonItem {
  /** Overrides the Root's state for this Item. */
  readonly loading = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  /** Overrides the Root's `animate`. */
  readonly animate = input<boolean | undefined, boolean | "" | undefined>(undefined, {
    transform: optionalBoolean,
  })
  constructor() {
    const root = injectSkeleton("Item")
    const el: Element = inject(ElementRef).nativeElement
    bindProps(
      () =>
        root.connect().item({
          loading: this.loading(),
          animate: this.animate(),
          // Stale content when it has any (read when the props apply: its children exist then);
          // none: a placeholder.
          // ponytail: content added later by @if is not seen until the Item's inputs change.
          hasChildren: el.childNodes.length > 0,
        }),
      { owns: ["animate", "loading"] },
    )
  }
}

/** The Skeleton's parts, for a standalone component's `imports`. */
export const Skeleton = [SkeletonRoot, SkeletonStatus, SkeletonContent, SkeletonItem] as const
