// The site's wave: inside a view transition, the new page spreads from a point. Round and
// overshooting in juicy, a hard-edged diamond that snaps open in crisp. Used by the phase
// switch (phase.tsx) and by moves between pages (route-wave.tsx), where the page being left
// also dims under it.

export function wave(x: number, y: number, round: boolean, { dim = false } = {}) {
  const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const r = far * 1.5
  document.documentElement.animate(
    {
      clipPath: round
        ? [`circle(0px at ${x}px ${y}px)`, `circle(${far}px at ${x}px ${y}px)`]
        : [
            `polygon(${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px)`,
            `polygon(${x}px ${y - r}px, ${x + r}px ${y}px, ${x}px ${y + r}px, ${x - r}px ${y}px)`,
          ],
    },
    {
      duration: round ? 1100 : 700,
      easing: round
        ? "linear(0, 0.22 8%, 0.62 20%, 0.94 32%, 1.06 42%, 1.08 50%, 1.03 62%, 0.99 76%, 1)"
        : "cubic-bezier(0.85, 0, 0.15, 1)",
      pseudoElement: "::view-transition-new(root)",
    },
  )
  // between pages, the page being left darkens and blurs under the wave, as if a backdrop came
  // down over it: it reads as the old page, going
  if (dim)
    document.documentElement.animate(
      {
        filter: ["brightness(1) blur(0px)", "brightness(0.45) blur(3px)"],
        scale: [1, 0.97],
      },
      {
        duration: round ? 900 : 600,
        easing: "cubic-bezier(0.3, 0, 0.2, 1)",
        fill: "forwards",
        pseudoElement: "::view-transition-old(root)",
      },
    )
}
