// Timeline's strings: each event's status, appended to its title on a progress timeline.

export type TimelineStatus = "completed" | "current" | "pending" | "upcoming"

export interface TimelineMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** Appended to a title ("Shipped (completed)"). */
  readonly status: (status: TimelineStatus) => string
}

export const timelineMessages: TimelineMessages = {
  status: (status) =>
    status === "completed"
      ? "completed"
      : status === "current"
        ? "current"
        : status === "pending"
          ? "in progress"
          : "not started",
}
