import {
  afterNextRender,
  Component,
  computed,
  Directive,
  forwardRef,
  HostAttributeToken,
  InjectionToken,
  inject,
  input,
  output,
  PLATFORM_ID,
  ViewEncapsulation,
} from "@angular/core"
import {
  type AvatarMessages,
  type AvatarProps,
  type AvatarStatus,
  avatarConnect,
  avatarGroupOverflowProps,
  avatarGroupProps,
  avatarMessages,
  checkAvatarGroupName,
  checkAvatarName,
  checkImageAlt,
  checkImageCount,
  isAvatarHidden,
  isAvatarNamed,
  visuallyHiddenStyle,
} from "@rind-ui/core"
import { absentProps } from "../absent"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { type ImageHost, injectImageStatusRoot, injectStatusImage } from "../image-status"
import { injectMessages } from "../provider"
import { RindProps } from "../rind-props"

export interface AvatarState {
  readonly status: AvatarStatus
}

type StatusChange = Parameters<NonNullable<AvatarProps["onStatusChange"]>>

const AVATAR = new InjectionToken<AvatarRoot>("rind-ui.avatar")

function injectAvatar(part: string): AvatarRoot {
  const root = inject(AVATAR, { optional: true })
  if (!root) throw new Error(`rindAvatar${part} must be inside rindAvatarRoot`)
  return root
}

/** The consumer's static naming attributes on the host. */
const injectNaming = () => {
  const read = (name: string) =>
    inject(new HostAttributeToken(name), { optional: true }) ?? undefined
  return {
    "aria-label": read("aria-label"),
    "aria-labelledby": read("aria-labelledby"),
    "aria-hidden": read("aria-hidden"),
  }
}

/**
 * A person's picture with a fallback: `<span rindAvatarRoot aria-label="Ada Lovelace">`
 * holding an `<img rindAvatarImage>` and a `rindAvatarFallback` (initials).
 */
@Directive({
  selector: "[rindAvatarRoot]",
  exportAs: "rindAvatarRoot",
  providers: [{ provide: AVATAR, useExisting: forwardRef(() => AvatarRoot) }],
})
export class AvatarRoot {
  /** Milliseconds the Fallback waits while the image is loading (default 0). Client-only. */
  readonly fallbackDelay = input<number>()
  readonly id = input<string>()
  /** Every status change (observed, not controlled). */
  readonly statusChange = output<StatusChange>()

  /** @internal */
  readonly instance = injectRootId(() => this.id())
  /** @internal */
  readonly host: ImageHost
  /** @internal */
  readonly api: () => ReturnType<typeof avatarConnect>
  /** @internal */
  readonly fallback: () => boolean
  /** @internal The consumer's `aria-label`. */
  readonly name: string | undefined
  /** The avatar's state, for the template (`#a="rindAvatarRoot"`, `a.state()`). */
  readonly state: () => AvatarState

  constructor() {
    const own = injectNaming()
    this.name = own["aria-label"]
    const { status, fallback, host } = injectImageStatusRoot(
      () => ({
        fallbackDelay: this.fallbackDelay(),
        onStatusChange: (...args: StatusChange) => this.statusChange.emit(args),
      }),
      () => checkAvatarName(own, this.instance()),
    )
    this.host = host
    this.fallback = fallback
    const api = computed(() =>
      avatarConnect({
        instance: this.instance(),
        status: status(),
        named: isAvatarNamed(own),
        hidden: isAvatarHidden(own),
      }),
    )
    this.api = api
    this.state = computed(() => ({ status: status() }))
    bindProps(() => ({ ...api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }), {
      owns: ["fallbackdelay", "id"],
    })
  }
}

/** The `<img>`: named by its own `alt`, or decorative inside a named Root. */
@Directive({ selector: "[rindAvatarImage]", exportAs: "rindAvatarImage" })
export class AvatarImage {
  readonly src = input<string>()
  readonly srcset = input<string>()
  readonly sizes = input<string>()
  readonly loading = input<string>()
  constructor() {
    const root = injectAvatar("Image")
    const props = injectStatusImage(
      root.host,
      (has) => root.api().image(has),
      {
        src: () => this.src(),
        srcset: () => this.srcset(),
        sizes: () => this.sizes(),
        loading: () => this.loading(),
      },
      checkImageCount,
    )
    bindProps(() => props(), { owns: ["loading", "sizes", "src", "srcset"] })
    if (inject(PLATFORM_ID) !== "browser") return
    const alt = inject(new HostAttributeToken("alt"), { optional: true }) ?? undefined
    afterNextRender(() => checkImageAlt(alt, root.name))
  }
}

/** Shown while there is no image to show; hidden otherwise (React renders nothing). */
@Directive({ selector: "[rindAvatarFallback]", exportAs: "rindAvatarFallback" })
export class AvatarFallback {
  constructor() {
    const root = injectAvatar("Fallback")
    bindProps(() =>
      root.fallback() ? root.api().fallback() : absentProps("avatar", root.instance()),
    )
  }
}

/** A group of avatars: `<div rindAvatarGroup aria-label="Team">`. */
@Directive({ selector: "[rindAvatarGroup]", exportAs: "rindAvatarGroup" })
export class AvatarGroup {
  readonly id = input<string>()
  constructor() {
    const instance = injectRootId(() => this.id())
    const own = injectNaming()
    bindProps(
      () => ({
        ...avatarGroupProps(instance()),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      { owns: ["id"] },
    )
    // A development check, once.
    if (inject(PLATFORM_ID) === "browser") afterNextRender(() => checkAvatarGroupName(own))
  }
}

/** "+3" for the avatars not shown, and what a screen reader says for it. */
@Component({
  selector: "[rindAvatarGroupOverflow]",
  exportAs: "rindAvatarGroupOverflow",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `<span aria-hidden="true">+{{ count() }}</span
    ><span [rindProps]="hidden">{{ texts().overflowLabel(count()) }}</span>`,
})
export class AvatarGroupOverflow {
  /** How many avatars are not shown. */
  readonly count = input.required<number>()
  readonly messages = input<Partial<AvatarMessages>>()
  readonly id = input<string>()
  /** @internal */
  protected readonly texts = injectMessages("avatar", avatarMessages, () => this.messages())
  /** @internal */
  protected readonly hidden = { "data-visually-hidden": "", style: visuallyHiddenStyle }
  constructor() {
    const instance = injectRootId(() => this.id())
    bindProps(
      () => ({
        ...avatarGroupOverflowProps(instance()),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      { owns: ["count", "id", "messages"] },
    )
  }
}

/** The Avatar's parts, for a standalone component's `imports`. */
export const Avatar = [
  AvatarRoot,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupOverflow,
] as const
