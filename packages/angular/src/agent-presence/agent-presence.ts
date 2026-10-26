// Agent Presence (add-agent-presence): a voice agent's state in words and as a visual. The
// audio level is never state: `startLevelLoop` writes it to the Root each frame (custom
// properties and a coarse `data-level`) while listening or speaking, motion allowed.
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
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
  ViewEncapsulation,
} from "@angular/core"
import {
  type AgentPresenceMessages,
  type AgentState,
  agentPresenceConnect,
  agentPresenceMachine,
  agentPresenceMessages,
  announcerCapability,
  type LevelChannel,
  type MessageOverrides,
  type PartProps,
  partId,
  startLevelLoop,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectEnvironment, injectLocale, injectMessages } from "../provider"
import { injectPartRegistry, injectRegisterPart, injectRenderedId } from "../registry"
import { RindProps } from "../rind-props"

/** The presence's state, for the template (`#a="rindAgentPresenceRoot"`, `a.state()`). */
export interface AgentPresenceRenderState {
  readonly state: AgentState
  readonly previous: AgentState | null
  readonly stale: boolean
  readonly muted: boolean
  readonly motion: "full" | "reduced" | "off"
}

const AGENT_PRESENCE = new InjectionToken<AgentPresenceRoot>("rind-ui.agent-presence")

function injectAgentPresence(part: string): AgentPresenceRoot {
  const root = inject(AGENT_PRESENCE, { optional: true })
  if (!root) throw new Error(`rindAgentPresence${part} must be inside rindAgentPresenceRoot`)
  return root
}

/**
 * A voice agent's presence: `<div rindAgentPresenceRoot [state]="state" [getLevel]="level">`
 * with a Visual (your orb), a Label and a Status; it renders a hidden Status when you compose
 * none.
 */
@Component({
  selector: "[rindAgentPresenceRoot]",
  exportAs: "rindAgentPresenceRoot",
  imports: [RindProps],
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: AGENT_PRESENCE, useExisting: forwardRef(() => AgentPresenceRoot) }],
  template: `<ng-content />@if (!composed()) {<span [rindProps]="hiddenStatus()">{{
      statusText()
    }}</span>}`,
})
export class AgentPresenceRoot {
  /** Required. Map it from your voice runtime. */
  readonly state = input.required<AgentState>()
  /** Why, for `error`. */
  readonly reason = input<string>()
  /** The microphone is muted. */
  readonly muted = input(false, { transform: booleanAttribute })
  /** The audio level 0–1, read each frame while listening (input) or speaking (output). */
  readonly getLevel = input<(channel: LevelChannel) => number>()
  /** Announce the first listening, a long think, the end and errors (assertive). */
  readonly announce = input<"off" | "polite">()
  /** A think is announced after this (ms). Default 1500. */
  readonly thinkingDelay = input<number>()
  /** A state lasting longer is stale (`data-stale`, `stale`). */
  readonly staleAfter = input<Partial<Record<AgentState, number>>>()
  /** "off" stops the level loop; "auto" follows the reduced-motion preference. Default "auto". */
  readonly motion = input<"auto" | "off">("auto")
  readonly messages = input<MessageOverrides<AgentPresenceMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  readonly id = input<string>()
  /** Each change. */
  readonly stateChange = output<{ state: AgentState; from: AgentState }>()
  /** A state became stale. */
  readonly stale = output<AgentState>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof agentPresenceConnect>>
  /** @internal */
  readonly registry: ReturnType<typeof injectPartRegistry<"status">>
  /** @internal */
  readonly statusId: () => string
  readonly current: Signal<AgentPresenceRenderState>
  /** @internal */
  protected readonly composed: Signal<boolean>
  /** @internal */
  protected readonly hiddenStatus: Signal<PartProps>
  /** @internal */
  protected readonly statusText: Signal<string>

  constructor() {
    const instance = injectRootId(() => this.id())
    const env = injectEnvironment(announcerCapability)
    const messages = injectMessages("agent-presence", agentPresenceMessages, () => this.messages())
    const locale = injectLocale(() => this.locale())
    this.registry = injectPartRegistry<"status">(() => ({
      scope: "agent-presence",
      root: instance(),
    }))
    this.statusId = () => partId("agent-presence", instance(), "status")
    const rendered = injectRenderedId(this.registry, "status")
    this.composed = computed(() => rendered() !== undefined)
    // Read lazily (a provider's inputs are set after this constructor), and again on change.
    const changed = signal(0)
    const reduced = computed(() => {
      changed()
      return env.motion.reducedMotion()
    })
    if (inject(PLATFORM_ID) === "browser") {
      const destroy = inject(DestroyRef)
      afterNextRender(() =>
        destroy.onDestroy(env.motion.subscribeReducedMotion(() => changed.update((n) => n + 1))),
      )
    }
    const motion = computed(() =>
      this.motion() === "off" ? "off" : reduced() ? "reduced" : ("full" as const),
    )
    const { view } = injectMachine(
      agentPresenceMachine,
      () => ({
        state: this.state(),
        reason: this.reason(),
        muted: this.muted(),
        announce: this.announce(),
        thinkingDelay: this.thinkingDelay(),
        staleAfter: this.staleAfter(),
        onStale: (s: AgentState) => this.stale.emit(s),
        onStateChange: (s: AgentState, d: { from: AgentState }) =>
          this.stateChange.emit({ state: s, from: d.from }),
        messages: messages(),
        id: instance(),
        lang: locale().locale,
      }),
      env,
    )
    this.api = computed(() =>
      agentPresenceConnect({
        instance: instance(),
        state: view().context.current,
        previous: view().context.previous,
        stale: view().context.stale,
        muted: this.muted(),
        motion: motion(),
        reason: this.reason(),
        messages: messages(),
      }),
    )
    this.hiddenStatus = computed(() => this.api().hiddenStatus())
    this.statusText = computed(() => this.api().statusText)
    this.current = computed(() => ({
      state: view().context.current,
      previous: view().context.previous,
      stale: view().context.stale,
      muted: this.muted(),
      motion: motion(),
    }))
    bindProps(
      () => ({ ...this.api().root(), ...(this.id() === undefined ? {} : { id: this.id() }) }),
      {
        owns: [
          "announce",
          "getlevel",
          "id",
          "locale",
          "messages",
          "motion",
          "muted",
          "reason",
          "staleafter",
          "state",
          "thinkingdelay",
        ],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    // The level is written to the Root each frame, outside rendering (design §4).
    const el: HTMLElement = inject(ElementRef).nativeElement
    const ready = signal(false)
    afterNextRender(() => ready.set(true))
    const channel = computed(() => (this.getLevel() ? this.api().levelChannel : null))
    effect((onCleanup) => {
      const c = channel()
      if (!ready() || c === null) return
      onCleanup(
        untracked(() =>
          startLevelLoop(el, {
            channel: c,
            getLevel: (ch) => untracked(this.getLevel)?.(ch) ?? 0,
            scheduler: env.scheduler,
            now: () => env.clock.now(),
          }),
        ),
      )
    })
  }
}

/** `aria-hidden`: put your orb, bars or canvas here. */
@Directive({ selector: "[rindAgentPresenceVisual]", exportAs: "rindAgentPresenceVisual" })
export class AgentPresenceVisual {
  constructor() {
    const root = injectAgentPresence("Visual")
    bindProps(() => root.api().visual())
  }
}

/** The state in words ("Listening"); not a live region. Its content replaces it. */
@Component({
  selector: "[rindAgentPresenceStatus]",
  exportAs: "rindAgentPresenceStatus",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class AgentPresenceStatus {
  readonly id = input<string>()
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectAgentPresence("Status")
    const own = () => this.id() ?? root.statusId()
    injectRegisterPart(root.registry, "status", own)
    this.text = computed(() => root.api().statusText)
    bindProps(() => ({ ...root.api().status(), id: own() }), { owns: ["id"] })
  }
}

/** The agent's name or a caption. */
@Directive({ selector: "[rindAgentPresenceLabel]", exportAs: "rindAgentPresenceLabel" })
export class AgentPresenceLabel {
  constructor() {
    const root = injectAgentPresence("Label")
    bindProps(() => root.api().label())
  }
}

/** More about the state (an error's `reason` in `data-reason`). */
@Directive({ selector: "[rindAgentPresenceDetail]", exportAs: "rindAgentPresenceDetail" })
export class AgentPresenceDetail {
  constructor() {
    const root = injectAgentPresence("Detail")
    bindProps(() => root.api().detail())
  }
}

/** The Agent Presence's parts, for a standalone component's `imports`. */
export const AgentPresence = [
  AgentPresenceRoot,
  AgentPresenceVisual,
  AgentPresenceStatus,
  AgentPresenceLabel,
  AgentPresenceDetail,
] as const
