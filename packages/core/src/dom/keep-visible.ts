// The one keep-visible rule: what every rind-ui operation that makes content outside a
// layer inert or aria-hidden must leave exposed — the announcer, rind-ui top layers, and
// any live region — together with their ancestors (add-overlay-infrastructure's
// inertOutside imports this).

export const KEEP_VISIBLE_SELECTOR =
  "[data-live-announcer], [data-rind-top-layer], [aria-live], [role='status'], [role='alert'], [role='log']"

/** True when `el` must stay exposed: it matches the rule or contains something that does. */
export function isKeptVisible(el: Element): boolean {
  return el.matches(KEEP_VISIBLE_SELECTOR) || el.querySelector(KEEP_VISIBLE_SELECTOR) !== null
}
