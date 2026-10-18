// The environment contracts are written against: no DOM, no adapter code. Adapters in
// @rind-ui/testing implement it on Testing Library and on Playwright.

/** The closed set of keys a contract can press. */
export type Key =
  | "Enter"
  | "Escape"
  | "Space"
  | "Tab"
  | "Home"
  | "End"
  | "PageUp"
  | "PageDown"
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "Backspace"
  | "Delete"
  | "F10"
  | "ContextMenu"
  /** The letter A, for the select-all shortcut (mod+A). */
  | "A"

export interface KeyOptions {
  readonly shift?: boolean
  readonly alt?: boolean
  /** Ctrl on Windows/Linux, Meta on macOS (per the driver's platform). */
  readonly mod?: boolean
  /** An IME is composing: `isComposing: true`, `keyCode: 229`, no text input. */
  readonly composing?: boolean
}

export interface PartHoverOptions {
  /** Default "mouse". A touch "hover" must never hover (accessibility.md rule 20). */
  readonly pointerType?: "mouse" | "pen" | "touch"
}

/**
 * How an action is performed. `virtual` reproduces assistive technology: activation is a
 * bare `click` (`detail: 0`, nothing before it) and focus is programmatic.
 */
export type Modality = "pointer" | "keyboard" | "touch" | "virtual"

/** An ARIA role name, e.g. "button", "dialog", "option". */
export type AriaRole = string

/** How to find an element. Role + exact accessible name first; text as a fallback. */
export type By =
  /**
   * A role, or a set of roles for a part whose role changes with its state (an empty Tag
   * Group's list is a `group`, a full one a `grid`): any one of them with the exact name.
   */
  | { readonly role: AriaRole | readonly AriaRole[]; readonly name?: string | RegExp }
  /** A labelable control by its exact accessible name, for controls with no role (password). */
  | { readonly label: string | RegExp }
  | { readonly text: string | RegExp }
  /**
   * The contract's own `data-scope` and this `data-part`, inside the driver's target (a
   * container): for an unnamed part that may not be exposed (a decorative Separator).
   */
  | { readonly part: string }

/** Modifier keys held during a click (Shift+click extends, mod+click toggles a selection). */
export interface ClickOptions {
  readonly shift?: boolean
  /** Ctrl on Windows/Linux, Meta on macOS (per the driver's platform). */
  readonly mod?: boolean
  /** Default "primary". A middle click opens a link elsewhere (no keyboard twin). */
  readonly button?: "primary" | "middle"
}

/** A part's bounding box in CSS pixels. */
export interface PartBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PointerStepOptions {
  /** Where, as fractions of the part's box (0 to 1). */
  readonly at: { readonly x: number; readonly y: number }
  /** Default "mouse". One pointer id is kept across a gesture (down, moves, up). */
  readonly pointerType?: "mouse" | "pen" | "touch"
}

export interface DragOptions {
  /** Default "mouse". */
  readonly pointerType?: "mouse" | "pen" | "touch"
  /** Default 300. */
  readonly durationMs?: number
  /** Default 10. */
  readonly steps?: number
}

/** A lazy handle, like a Playwright Locator: resolved on every call, never cached. */
export interface Part {
  click(options?: ClickOptions): Promise<void>
  tap(): Promise<void>
  hover(options?: PartHoverOptions): Promise<void>
  focus(): Promise<void>
  /**
   * Moves focus onto the part with Tab from the tab stop before it: keyboard modality and a
   * key-caused focus (the keyboard twin of hovering it).
   */
  focusWithTab(): Promise<void>
  /** Focuses the part first if it is not focused. */
  press(key: Key, options?: KeyOptions): Promise<void>
  type(text: string): Promise<void>
  /**
   * An IME composition on a text-entry part: each of `updates` as the composing text, then
   * `commit` committed (an empty commit cancels it). Without `commit` the composition stays
   * open, and a later call continues it.
   */
  compose(updates: readonly string[], commit?: string): Promise<void>
  /** A mouse press at the part's centre that reaches whatever is hit there (a backdrop above). */
  /**
   * `corner`: near the part's top-left corner instead of its centre (a full-screen backdrop
   * whose centre is covered by the dialog content it surrounds).
   */
  pressAtPosition(options?: { readonly corner?: boolean }): Promise<void>
  /**
   * The secondary action on the part at `at` (fractions of its box; default its centre),
   * dispatched as a PointerEvent `contextmenu`: a right click (pointer, touch, keyboard
   * runs), or a bare `contextmenu` with no press before it (virtual: AT's "shortcut menu").
   */
  contextMenu(options?: { readonly at?: { readonly x: number; readonly y: number } }): Promise<void>
  /**
   * A touch (or `pointerType`) held on the part for `ms` (the environment's time: fake
   * timers when given), then released. Works without layout (at the part's origin).
   */
  longPress(options?: {
    readonly ms?: number
    readonly at?: { readonly x: number; readonly y: number }
    readonly pointerType?: "touch" | "pen"
  }): Promise<void>
  /**
   * A drag of `vector` (CSS px) from the part's centre: `steps` moves over `durationMs` of the
   * environment's time (fake timers when given, so a swipe's velocity is deterministic), by
   * mouse/pen (pointer events) or touch (touch events), then a release.
   */
  drag(vector: { readonly x: number; readonly y: number }, options?: DragOptions): Promise<void>
  /** The part's bounding box, or `null` when the environment has no layout (jsdom). */
  box(): Promise<PartBox | null>
  /**
   * One pointer step at a position inside the part, so a contract drives each machine step of
   * a drag (`cancel`: the browser's pointercancel). Rejects without layout.
   */
  pointer(phase: "down" | "move" | "up" | "cancel", options: PointerStepOptions): Promise<void>
  /**
   * Sets a native input's value through the property setter and dispatches bubbling `input`
   * and `change`, with no key or pointer event: what assistive technology does.
   */
  fill(value: string): Promise<void>
  /**
   * A paste into a text input at its selection, in the real order: a cancelable `paste`
   * (clipboardData `text/plain`), a cancelable `beforeinput` (`insertFromPaste`), then, unless
   * either was prevented, the native insertion and its `input` event. No OS clipboard.
   */
  paste(text: string): Promise<void>
  /** Resolves once no element matches the part (exit animations finished). */
  waitForDetach(): Promise<void>
  /** The part is inside an `inert` subtree (computed from its ancestors). */
  isInert(): Promise<boolean>
  attr(name: string): Promise<string | null>
  /** Descendant parts of another component, by `data-scope` and `data-part` (any instance). */
  scoped(scope: string, part: string): Part
  /** Descendants carrying the attribute `name` (`value` when given), in document order. */
  withAttr(name: `data-${string}`, value?: string): Part
  /** The element's tag name, lowercase ("h3", "div"). */
  tagName(): Promise<string>
  /** Its accessible name (accname computation). */
  accessibleName(): Promise<string>
  /** Its accessible description (`aria-describedby`, accname computation). */
  accessibleDescription(): Promise<string>
  /** The control this label names (`for`, wrapping, or `aria-labelledby`), as a lazy part. */
  labelled(): Part
  /** Two pointer clicks in a row (the second with `detail: 2`). */
  doubleClick(): Promise<void>
  /** Whitespace-normalised textContent. */
  text(): Promise<string>
  /** The value of a form control. */
  value(): Promise<string>
  /** A native input's `checked` property (never the attribute). */
  checked(): Promise<boolean>
  /** A native input's `indeterminate` property. */
  indeterminate(): Promise<boolean>
  /** Attached and not hidden. */
  exists(): Promise<boolean>
  /** Also true when the part is the `aria-activedescendant` of the focused element. */
  isFocused(): Promise<boolean>
  count(): Promise<number>
  nth(index: number): Part
  all(): Promise<readonly Part[]>
}

export interface Env<P extends string = string> {
  /** A part of *this* instance, wherever it is portalled. Refine with `by`. */
  part(name: P, by?: By): Part
  /** Anywhere in the document. */
  find(by: By): Part
  focused(): Part
  /** Presses a key on the active element. */
  keyboard(key: Key, options?: KeyOptions): Promise<void>
  /** Presses on the document outside every layer. */
  pointerOutside(): Promise<void>
  /** Moves the pointer onto the document outside every layer, with no press (a hover leaves). */
  pointerAway(): Promise<void>
  /** Polls `read` until `accept` holds or the timeout ends. */
  until<T>(read: () => Promise<T>, accept: (value: T) => boolean): Promise<T>
  /** Advances fake timers when the test uses them; otherwise waits a frame. */
  advance(ms: number): Promise<void>
  /**
   * A navigation happened since the current action began: a client router call (the
   * testing `fakeRouter`) or a document navigation, or, with `newTab`, a link the browser
   * opened elsewhere (another tab or window, a download).
   */
  navigated(options?: { readonly newTab?: boolean }): Promise<boolean>
  /** The document's selected text (`""` when nothing is selected). */
  selectedText(): Promise<string>
  readonly modality: Modality
}
