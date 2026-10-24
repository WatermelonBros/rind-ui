import { partId } from "@rind-ui/core"

/** The calendar's tab stop in the open content: the initial focus (spec "Initial Focus"). */
export const calendarTabStop = (instance: string) => (): HTMLElement | null =>
  (typeof document === "undefined"
    ? null
    : document
        .getElementById(partId("date-field", instance, "content"))
        ?.querySelector<HTMLElement>('[data-scope="calendar"][data-part="cell"][tabindex="0"]')) ??
  null

/** The picker's Control is the anchor and dismissal-inside element (spec "Dismissal"). */
export const controlElement = (instance: string): HTMLElement | null =>
  typeof document === "undefined"
    ? null
    : document.getElementById(partId("date-field", instance, "anchor"))
