// The site's wave: inside a view transition, the new page spreads from a point. Round, with a
// bounce half way, in juicy; a hard-edged diamond that snaps open in crisp. Used by the phase
// switch (phase.tsx) and by moves between pages (route-wave.tsx), where the page being left
// also dims under it.

export function wave(x: number, y: number, round: boolean, { dim = false } = {}) {
  const far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const r = far * 1.5
  // percentages of the snapshot, not px: a Chrome on a 2x screen read px on the transition's
  // pseudo-element at half scale, so the wave grew from the wrong point to half its size and
  // vanished midway (a circle's % is of the box's diagonal over √2)
  const px = (v: number) => `${(v / innerWidth) * 100}%`
  const py = (v: number) => `${(v / innerHeight) * 100}%`
  const pr = (v: number) => `${(v / (Math.hypot(innerWidth, innerHeight) / Math.SQRT2)) * 100}%`
  const at = `at ${px(x)} ${py(y)}`
  // juicy: out to half way with a bounce (past it, back a little, settled), then on to the edge;
  // crisp: a hard-edged diamond that snaps open
  const bounce: [number, number, string][] = [
    [0, 0, "cubic-bezier(0.2, 0.8, 0.3, 1)"],
    [0.52, 0.3, "ease-in-out"],
    [0.44, 0.42, "ease-in-out"],
    [0.47, 0.5, "cubic-bezier(0.6, 0, 0.3, 1)"],
    [1, 1, "linear"],
  ]
  document.documentElement.animate(
    round
      ? bounce.map(([k, offset, easing]) => ({
          clipPath: `circle(${pr(far * k)} ${at})`,
          offset,
          easing,
        }))
      : {
          clipPath: [
            `polygon(${px(x)} ${py(y)}, ${px(x)} ${py(y)}, ${px(x)} ${py(y)}, ${px(x)} ${py(y)})`,
            `polygon(${px(x)} ${py(y - r)}, ${px(x + r)} ${py(y)}, ${px(x)} ${py(y + r)}, ${px(x - r)} ${py(y)})`,
          ],
        },
    {
      duration: round ? 1200 : 700,
      easing: round ? "linear" : "cubic-bezier(0.85, 0, 0.15, 1)",
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
