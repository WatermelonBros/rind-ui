// Message Actions (add-message-actions): a Toolbar (roving focus, one Tab stop) of the actions
// on a chat message. Copy is a Clipboard and Feedback a Toggle Group, both hosted by the
// Toolbar; each part binds this component's attributes after the composed one's, so the theme
// and the contract find them by this component's scope.
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
  numberAttribute,
  output,
  PLATFORM_ID,
  type Signal,
  signal,
  ViewEncapsulation,
} from "@angular/core"
import {
  announcerCapability,
  type MessageActionsButtonInput,
  type MessageActionsEvent,
  type MessageActionsMessages,
  type MessageOverrides,
  messageActionsActive,
  messageActionsConnect,
  messageActionsMachine,
  messageActionsMessages,
  type PartProps,
} from "@rind-ui/core"
import { bindProps, joinHandlers } from "../bind-props"
import { ClipboardRoot, ClipboardTrigger } from "../clipboard/clipboard"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectModality } from "../inject-press"
import { injectEnvironment, injectLocale, injectMessages, withCapabilities } from "../provider"
import { ToggleGroupItem, ToggleGroupRoot } from "../toggle-group/toggle-group"
import { ToolbarItem, ToolbarRoot } from "../toolbar/toolbar"

const MESSAGE_ACTIONS = new InjectionToken<MessageActionsRoot>("rind-ui.message-actions")

function injectMessageActions(part: string): MessageActionsRoot {
  const root = inject(MESSAGE_ACTIONS, { optional: true })
  if (!root) throw new Error(`rindMessageActions${part} must be inside rindMessageActionsRoot`)
  return root
}

const optionalNumber = (v: unknown) => (v == null || v === "" ? undefined : numberAttribute(v))

/**
 * The actions on a chat message: `<div rindMessageActionsRoot [count]="versions">`, a Toolbar
 * shown while the message (its parent, or `host`) is hovered, focused or touched.
 */
@Directive({
  selector: "[rindMessageActionsRoot]",
  exportAs: "rindMessageActionsRoot",
  hostDirectives: [{ directive: ToolbarRoot, inputs: ["orientation", "disabled", "id"] }],
  providers: [{ provide: MESSAGE_ACTIONS, useExisting: forwardRef(() => MessageActionsRoot) }],
})
export class MessageActionsRoot {
  /** Forces the row visible. */
  readonly active = input(false, { transform: booleanAttribute })
  /** Regenerate the message. */
  readonly onRegenerate = input<() => void | Promise<void>>()
  /** Controlled editing (`[(editing)]`). */
  readonly editing = input<boolean | undefined>(undefined)
  /** Uncontrolled editing. */
  readonly defaultEditing = input(false, { transform: booleanAttribute })
  /** How many versions the message has. */
  readonly count = input(0, { transform: numberAttribute })
  /** Controlled version index (`[(index)]`, 0-based). */
  readonly index = input(undefined, { transform: optionalNumber })
  readonly defaultIndex = input(undefined, { transform: optionalNumber })
  /** The version buttons wrap around. */
  readonly loop = input(false, { transform: booleanAttribute })
  readonly messages = input<MessageOverrides<MessageActionsMessages>>()
  /** Default: the provider's locale. */
  readonly locale = input<string>()
  /** The message element whose hover, focus and touch show the row (default: the parent). */
  readonly host = input<() => Element | null>()
  readonly editingChange = output<boolean>()
  readonly indexChange = output<number>()

  /** @internal */
  readonly api: Signal<ReturnType<typeof messageActionsConnect>>
  /** @internal */
  readonly send: (event: MessageActionsEvent) => void
  /** @internal Edit, for the focus back after editing. */
  editEl: HTMLElement | null = null

  constructor() {
    const toolbar = inject(ToolbarRoot)
    const instance = injectRootId(() => toolbar.id())
    const env = injectEnvironment(announcerCapability)
    const messages = injectMessages("message-actions", messageActionsMessages, () =>
      this.messages(),
    )
    const locale = injectLocale(() => this.locale())
    const { view, send } = injectMachine(
      messageActionsMachine,
      () => ({
        active: this.active(),
        onRegenerate: () => this.onRegenerate()?.(),
        ...(this.editing() === undefined ? {} : { editing: this.editing() }),
        defaultEditing: this.defaultEditing(),
        onEditingChange: (e: boolean) => this.editingChange.emit(e),
        count: this.count(),
        ...(this.index() === undefined ? {} : { index: this.index() }),
        defaultIndex: this.defaultIndex(),
        onIndexChange: (i: number) => this.indexChange.emit(i),
        loop: this.loop(),
        messages: messages(),
        id: instance(),
        lang: locale().locale,
      }),
      withCapabilities(env, {
        // After editing ends, the focus comes back to Edit unless it went somewhere on purpose.
        restoreEditFocus: () => {
          const edit = this.editEl
          const active = edit?.ownerDocument.activeElement
          if (edit && (active == null || active === edit.ownerDocument.body))
            edit.focus({ preventScroll: true })
        },
      }),
    )
    this.send = send
    const read = (name: string) => inject(new HostAttributeToken(name), { optional: true })
    const named = read("aria-label") !== null || read("aria-labelledby") !== null
    this.api = computed(() =>
      messageActionsConnect(
        {
          instance: instance(),
          active: messageActionsActive(view().context, { active: this.active() }),
          editing: view().values.editing === true,
          regenerate: view().context.regenerate,
          count: this.count(),
          index: view().values.index ?? 0,
          loop: this.loop(),
          messages: messages(),
          named,
        },
        env,
      ),
    )
    // After the Toolbar's layer: this component's scope and state win.
    bindProps(() => this.api().root(), {
      owns: [
        "active",
        "count",
        "defaultediting",
        "defaultindex",
        "editing",
        "host",
        "index",
        "locale",
        "loop",
        "messages",
        "onregenerate",
      ],
    })
    if (inject(PLATFORM_ID) !== "browser") return
    const el: HTMLElement = inject(ElementRef).nativeElement
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
      // The message's own hover, focus and touch show the row (design §1).
      const found = this.host()?.() ?? el.parentElement
      if (!found) return
      // Elements dispatch the HTMLElement events listened to here (SVG ones included).
      const host = found as HTMLElement
      const on = (type: string, event: MessageActionsEvent) => {
        const listener = () => send(event)
        host.addEventListener(type, listener, { passive: true })
        destroy.onDestroy(() => host.removeEventListener(type, listener))
      }
      on("pointerenter", { type: "POINTER.ENTER" })
      on("pointerleave", { type: "POINTER.LEAVE" })
      on("focusin", { type: "FOCUS.IN" })
      on("touchstart", { type: "TOUCH" })
      // Out of the message only: a move between its own elements stays inside.
      const out = (e: FocusEvent) => {
        if (!(e.relatedTarget instanceof Node && host.contains(e.relatedTarget)))
          send({ type: "FOCUS.OUT" })
      }
      host.addEventListener("focusout", out)
      destroy.onDestroy(() => host.removeEventListener("focusout", out))
    })
  }
}

/** A Toolbar item with this component's attributes and press, from `own(b)`. */
function injectActionButton(
  part: string,
  own: (api: ReturnType<typeof messageActionsConnect>, b: MessageActionsButtonInput) => PartProps,
  press?: MessageActionsEvent,
) {
  const root = injectMessageActions(part)
  const el: HTMLElement = inject(ElementRef).nativeElement
  const env = injectEnvironment()
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    // Tracks the modality from the first render, so the first keyboard focus is visible.
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  bindProps(() =>
    joinHandlers(
      own(root.api(), {
        tag: el.tagName.toLowerCase(),
        focused: focused(),
        modality: modality(),
      }),
      {
        onClick: () => {
          if (press && !el.hasAttribute("data-disabled")) root.send(press)
        },
        onFocusIn: () => focused.set(true),
        onFocusOut: () => focused.set(false),
      },
    ),
  )
  return root
}

const ITEM_HOST = [{ directive: ToolbarItem, inputs: ["disabled", "focusableWhenDisabled"] }]

/** Your own action: `<button rindMessageActionsItem>`, a Toolbar item. */
@Directive({
  selector: "[rindMessageActionsItem]",
  exportAs: "rindMessageActionsItem",
  hostDirectives: ITEM_HOST,
})
export class MessageActionsItem {
  constructor() {
    const root = injectMessageActions("Item")
    bindProps(() => root.api().item())
  }
}

/** Calls `onRegenerate`; disabled and busy until its promise settles. */
@Directive({
  selector: "[rindMessageActionsRegenerate]",
  exportAs: "rindMessageActionsRegenerate",
  hostDirectives: [{ directive: ToolbarItem }],
})
export class MessageActionsRegenerate {
  constructor() {
    injectActionButton("Regenerate", (api, b) => api.regenerate(b), { type: "PRESS.REGENERATE" })
  }
}

/** Toggles editing (`aria-pressed`); the focus comes back to it when editing ends. */
@Directive({
  selector: "[rindMessageActionsEdit]",
  exportAs: "rindMessageActionsEdit",
  hostDirectives: [{ directive: ToolbarItem }],
})
export class MessageActionsEdit {
  constructor() {
    const root = injectActionButton("Edit", (api, b) => api.edit(b), { type: "PRESS.EDIT" })
    root.editEl = inject(ElementRef).nativeElement
  }
}

/** The previous version; disabled but focusable on the first (unless `loop`). */
@Directive({
  selector: "[rindMessageActionsVersionPrevious]",
  exportAs: "rindMessageActionsVersionPrevious",
  hostDirectives: [{ directive: ToolbarItem }],
})
export class MessageActionsVersionPrevious {
  constructor() {
    injectActionButton("VersionPrevious", (api, b) => api.versionPrevious(b), {
      type: "PRESS.PREVIOUS",
    })
  }
}

/** The next version; disabled but focusable on the last (unless `loop`). */
@Directive({
  selector: "[rindMessageActionsVersionNext]",
  exportAs: "rindMessageActionsVersionNext",
  hostDirectives: [{ directive: ToolbarItem }],
})
export class MessageActionsVersionNext {
  constructor() {
    injectActionButton("VersionNext", (api, b) => api.versionNext(b), { type: "PRESS.NEXT" })
  }
}

/**
 * Copies `value` with Clipboard's states and announcements: `<span rindMessageActionsCopy
 * [value]="text">⧉</span>`; its content goes in the trigger, a Toolbar item named "Copy".
 */
@Component({
  selector: "[rindMessageActionsCopy]",
  exportAs: "rindMessageActionsCopy",
  // ToolbarItem before ClipboardTrigger: the trigger binds after, so its scope wins.
  imports: [ClipboardRoot, ToolbarItem, ClipboardTrigger],
  encapsulation: ViewEncapsulation.None,
  template: `<span rindClipboardRoot [value]="text()" [messages]="{ copy: name() }"
    ><button rindToolbarItem rindClipboardTrigger><ng-content /></button
  ></span>`,
})
export class MessageActionsCopy {
  /**
   * What a press copies; a function is read on each render (the message's latest text, as
   * signals change it).
   */
  readonly value = input.required<string | (() => string)>()
  /** @internal */
  protected readonly text = computed(() => {
    const v = this.value()
    return typeof v === "function" ? v() : v
  })
  /** @internal */
  protected readonly name: Signal<string>
  constructor() {
    const root = injectMessageActions("Copy")
    this.name = computed(() => root.api().names.copy)
    bindProps(() => root.api().copy(), { owns: ["value"] })
  }
}

/** Thumbs up/down: a single, deselectable Toggle Group named `messages.feedback`. */
@Directive({
  selector: "[rindMessageActionsFeedback]",
  exportAs: "rindMessageActionsFeedback",
  hostDirectives: [
    {
      directive: ToggleGroupRoot,
      inputs: ["value", "defaultValue"],
      outputs: ["valueChange", "valueChangeDetails"],
    },
  ],
})
export class MessageActionsFeedback {
  constructor() {
    const root = injectMessageActions("Feedback")
    bindProps(() => ({ "aria-label": root.api().names.feedback, ...root.api().feedback() }))
  }
}

/** `value="up"` or `"down"`, named "Good response" / "Bad response". */
@Directive({
  selector: "[rindMessageActionsFeedbackItem]",
  exportAs: "rindMessageActionsFeedbackItem",
  hostDirectives: [{ directive: ToggleGroupItem, inputs: ["value"] }],
})
export class MessageActionsFeedbackItem {
  constructor() {
    const root = injectMessageActions("FeedbackItem")
    const item = inject(ToggleGroupItem)
    bindProps(() => {
      const value = item.value() === "down" ? "down" : "up"
      return {
        "aria-label": value === "up" ? root.api().names.up : root.api().names.down,
        ...root.api().feedbackItem(value),
      }
    })
  }
}

/** A group ("Versions"); hidden and empty below two versions. */
@Component({
  selector: "[rindMessageActionsVersions]",
  exportAs: "rindMessageActionsVersions",
  encapsulation: ViewEncapsulation.None,
  template: "@if (shown()) {<ng-content />}",
})
export class MessageActionsVersions {
  /** @internal */
  protected readonly shown: Signal<boolean>
  constructor() {
    const root = injectMessageActions("Versions")
    this.shown = computed(() => root.api().hasVersions)
    bindProps(() => ({ ...root.api().versions(), hidden: root.api().hasVersions ? undefined : "" }))
  }
}

/** "2 / 3", `aria-hidden` (a move announces "Version 2 of 3"); its content replaces it. */
@Component({
  selector: "[rindMessageActionsVersionStatus]",
  exportAs: "rindMessageActionsVersionStatus",
  encapsulation: ViewEncapsulation.None,
  template: "<ng-content>{{ text() }}</ng-content>",
})
export class MessageActionsVersionStatus {
  /** @internal */
  protected readonly text: Signal<string>
  constructor() {
    const root = injectMessageActions("VersionStatus")
    this.text = computed(() => root.api().versionText)
    bindProps(() => root.api().versionStatus())
  }
}

/** The Message Actions' parts, for a standalone component's `imports`. */
export const MessageActions = [
  MessageActionsRoot,
  MessageActionsItem,
  MessageActionsCopy,
  MessageActionsRegenerate,
  MessageActionsEdit,
  MessageActionsFeedback,
  MessageActionsFeedbackItem,
  MessageActionsVersions,
  MessageActionsVersionPrevious,
  MessageActionsVersionNext,
  MessageActionsVersionStatus,
] as const
