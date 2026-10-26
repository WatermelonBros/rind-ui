// A closing button that is a form's submit button closes on that form's submit, so the form is
// still connected when it submits (radix#1109, #1779); an invalid form keeps the overlay open.
// Shared by every closing part (close trigger, cancel, action) in every adapter.
import type { DomEnv, SchedulerEnv } from "../env/capabilities"

/** Runs `close` now, or on the submit of the form the button with `id` submits. */
export function closeOnSubmit(env: DomEnv & SchedulerEnv, id: string, close: () => void): void {
  // By tag, not instanceof: the button may live in another window (an iframe).
  const el = env.dom.getById(id)
  const node = el?.tagName === "BUTTON" ? (el as HTMLButtonElement) : null
  if (node?.type === "submit" && node.form) {
    const form = node.form
    // A task later, not in the submit listener: closing there unmounts the form while the
    // submit event is still dispatching, so the consumer's own submit handler never runs.
    const onSubmit = () => env.scheduler.setTimeout(close, 0)
    form.addEventListener("submit", onSubmit, { once: true })
    env.scheduler.setTimeout(() => form.removeEventListener("submit", onSubmit), 0)
    return
  }
  close()
}
