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
  | { readonly role: AriaRole; readonly name?: string | RegExp }
  | { readonly text: string | RegExp }

/** Modifier keys held during a click (Shift+click extends, mod+click toggles a selection). */
export interface ClickOptions {
  readonly shift?: boolean
  /** Ctrl on Windows/Linux, Meta on macOS (per the driver's platform). */
  readonly mod?: boolean
  /** Default "primary". A middle click opens a link elsewhere (no keyboard twin). */
  readonly button?: "primary" | "middle"
}

/** A lazy handle, like a Playwright Locator: resolved on every call, never cached. */
export interface Part {
  click(options?: ClickOptions): Promise<void>
  tap(): Promise<void>
  hover(options?: PartHoverOptions): Promise<void>
  focus(): Promise<void>
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
  pressAtPosition(): Promise<void>
  /** Resolves once no element matches the part (exit animations finished). */
  waitForDetach(): Promise<void>
  /** The part is inside an `inert` subtree (computed from its ancestors). */
  isInert(): Promise<boolean>
  attr(name: string): Promise<string | null>
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
