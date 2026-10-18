/** The toaster's assistive-technology strings (English defaults), overridable per region. */
export const toastMessages = {
  /** The region's name, with the hotkey's spoken label. */
  regionLabel: (hotkey: string) => `Notifications (${hotkey})`,
  /** A close trigger that renders no content of its own. */
  close: "Dismiss notification",
  /** Appended to an actionable toast's announcement. */
  actionHint: (hotkey: string) => `Press ${hotkey} to reach the action.`,
  /** The spoken label of a hotkey spec ("F6", "Alt+T"). */
  hotkeyLabel: (spec: string) => spec,
} as const

export interface ToastMessages {
  readonly regionLabel: (hotkey: string) => string
  readonly close: string
  readonly actionHint: (hotkey: string) => string
  readonly hotkeyLabel: (spec: string) => string
}

/** The announcement text: title and description, then the action hint (no markup). */
export function toastAnnouncement(
  data: {
    readonly title?: string | undefined
    readonly description?: string | undefined
    readonly action?: unknown
  },
  messages: ToastMessages,
  hotkey: string,
): string {
  // "Saved" + "3 files" → "Saved. 3 files"; a part ending in its own punctuation keeps it.
  const hint = data.action ? messages.actionHint(messages.hotkeyLabel(hotkey)) : undefined
  return [data.title, data.description, hint]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .reduce(
      (acc, next) => (acc === "" ? next : `${acc}${/[.!?…:]$/.test(acc) ? " " : ". "}${next}`),
      "",
    )
}
