/** Tour's messages (English defaults), overridable per tour and through the provider. */
export type TourMessages = {
  /** An empty `"next"` action trigger. */
  readonly next: string
  /** An empty `"prev"` action trigger. */
  readonly prev: string
  /** An empty `"skip"` action trigger. */
  readonly skip: string
  /** An empty close trigger (and an empty `"dismiss"` action). */
  readonly close: string
  /** An empty `"next"` action on the last step. */
  readonly finish: string
  /** ProgressText; `current` is 1-based, `total` counts steps that are not `wait`. */
  readonly progressText: (p: { readonly current: number; readonly total: number }) => string
  /** The card's name when no Title is rendered and the consumer passes none. */
  readonly stepLabel: (p: { readonly current: number; readonly total: number }) => string
  /** Announced politely when a step is shown and focus did not move to the card. */
  readonly stepAnnouncement: (p: {
    readonly current: number
    readonly total: number
    readonly title: string
  }) => string
}

export const tourMessages: TourMessages = {
  next: "Next",
  prev: "Back",
  skip: "Skip tour",
  close: "Close tour",
  finish: "Done",
  progressText: ({ current, total }) => `${current} of ${total}`,
  stepLabel: ({ current, total }) => `Step ${current} of ${total}`,
  stepAnnouncement: ({ current, total, title }) =>
    title ? `Step ${current} of ${total}: ${title}` : `Step ${current} of ${total}`,
}
