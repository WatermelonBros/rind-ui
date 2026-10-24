import {
  afterNextRender,
  Component,
  computed,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
  signal,
  ViewEncapsulation,
} from "@angular/core"
import {
  type KbdKeys,
  type KbdMessages,
  kbdConnect,
  kbdMessages,
  keyShortcuts,
  type MessageOverrides,
  parseKeys,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectEnvironment, injectMessages } from "../provider"
import { RindProps } from "../rind-props"

/**
 * The platform: the input, else the environment's after the first render; the server and
 * hydration render "other", so the first client render matches the server's HTML.
 */
function injectPlatform(own: () => "apple" | "other" | undefined): Signal<"apple" | "other"> {
  const env = injectEnvironment()
  const detected = signal<"apple" | "other">("other")
  if (inject(PLATFORM_ID) === "browser") {
    afterNextRender(() => detected.set(env.platform.apple ? "apple" : "other"))
  }
  return computed(() => own() ?? detected())
}

/**
 * The `aria-keyshortcuts` value for the control a shortcut activates, from the same keys a Kbd
 * shows, on the environment's platform (`undefined` for a sequence). Call it in an injection
 * context (a constructor or a field initializer).
 */
export function injectKeyShortcuts(
  keys: () => KbdKeys,
  platform: () => "apple" | "other" | undefined = () => undefined,
): Signal<string | undefined> {
  const resolved = injectPlatform(platform)
  return computed(() => keyShortcuts(keys(), resolved() === "apple"))
}

/**
 * A keyboard shortcut: `<kbd rindKbdRoot keys="mod+shift+p"></kbd>` renders each key (and
 * what a screen reader says for it); without `keys`, the element keeps its own content.
 */
@Component({
  selector: "[rindKbdRoot]",
  exportAs: "rindKbdRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  template: `@if (keys() === undefined) {
      <ng-content />
    } @else {
      @for (it of api().items; track $index) {
        @if (it.type === "key") {
          <kbd [rindProps]="api().key(it.key)"
            ><span [rindProps]="api().glyph(it.key)">{{ it.key.glyph }}</span
            >@if (api().keyLabel(it.key) !== null) {<span [rindProps]="hidden()">{{
              api().keyLabel(it.key)
            }}</span>}</kbd
          >
        } @else {
          <span [rindProps]="api().separator(it.kind)"
            ><span aria-hidden="true">{{ api().separatorText(it.kind) }}</span
            ><span [rindProps]="hidden()">{{ api().separatorSpoken(it.kind) }}</span></span
          >
        }
      }
    }`,
})
export class KbdRoot {
  /** "mod+shift+p" (a chord), "g i" (a sequence), or one chord's key names. */
  readonly keys = input<KbdKeys>()
  /** Overrides the environment's platform. */
  readonly platform = input<"apple" | "other">()
  readonly messages = input<MessageOverrides<KbdMessages>>()
  readonly id = input<string>()

  /** The platform the keys render for. */
  readonly resolvedPlatform = injectPlatform(() => this.platform())
  private readonly instance = injectRootId(() => this.id())
  private readonly texts = injectMessages("kbd", kbdMessages, () => this.messages())
  /** @internal */
  protected readonly api = computed(() => {
    const keys = this.keys()
    return kbdConnect({
      instance: this.instance(),
      chords: keys === undefined ? [] : parseKeys(keys),
      apple: this.resolvedPlatform() === "apple",
      messages: this.texts(),
    })
  })
  /** @internal */
  protected readonly hidden = computed(() => this.api().hiddenProps())

  constructor() {
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      { owns: ["id", "keys", "platform"] },
    )
  }
}

/** The Kbd's directives, for a standalone component's `imports`. */
export const Kbd = [KbdRoot] as const
