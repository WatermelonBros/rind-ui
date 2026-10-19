// Stepper's strings: each step's status in its name, the progress text, the announcement.

export type StepStatus = "completed" | "current" | "upcoming"

export interface StepperMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** Appended to a step's title in its name ("Shipping (completed)"). */
  readonly status: (status: StepStatus) => string
  /** "Step 2 of 4" (`index` is 0-based). */
  readonly progress: (index: number, count: number, locale: string) => string
  /** Announced when the user moves: "Step 2 of 4: Shipping". */
  readonly stepAnnouncement: (index: number, count: number, title: string, locale: string) => string
  readonly prevLabel: string
  readonly nextLabel: string
}

const n = (value: number, locale: string) => new Intl.NumberFormat(locale).format(value)

export const stepperMessages: StepperMessages = {
  status: (status) =>
    status === "completed" ? "completed" : status === "current" ? "current" : "not started",
  progress: (index, count, locale) => `Step ${n(index + 1, locale)} of ${n(count, locale)}`,
  stepAnnouncement: (index, count, title, locale) =>
    `Step ${n(index + 1, locale)} of ${n(count, locale)}${title ? `: ${title}` : ""}`,
  prevLabel: "Previous",
  nextLabel: "Next",
}
