// toast-stack (add-toast design §5): a toast's layout height, ignoring CSS transforms (a
// collapsed sibling scaled to 0.9 measures unscaled: zag#3173), then again whenever its size
// changes (a promise's longer text: mui/base-ui#3336).

/** Measures `el` now and on every resize; returns the cleanup. */
export function measureToast(el: HTMLElement, onHeight: (height: number) => void): () => void {
  const measure = () => {
    // offsetHeight is the layout box: transforms do not change it. An inline height set
    // by an animation is lifted for the read.
    const inline = el.style.height
    el.style.height = "auto"
    const h = el.offsetHeight
    el.style.height = inline
    onHeight(h)
  }
  measure()
  if (typeof ResizeObserver === "undefined") return () => {}
  // The read lifts the inline height, which resizes the observed box: inside the observer's own
  // callback that is a resize it cannot deliver ("ResizeObserver loop completed with undelivered
  // notifications" in WebKit). The next frame reads the same layout, outside the delivery.
  let frame = 0
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(measure)
  })
  observer.observe(el)
  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
  }
}
