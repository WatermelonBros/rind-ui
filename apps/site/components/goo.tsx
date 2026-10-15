/** SVG filters shared by the page: `goo` melts the wordmark, `goo-curtain` shapes the phase curtain. */
export function GooFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <filter id="goo" x="-20%" y="-40%" width="140%" height="180%">
        <feGaussianBlur stdDeviation="7" />
        <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" />
      </filter>
      <filter id="goo-curtain">
        <feGaussianBlur stdDeviation="22" />
        <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -12" />
      </filter>
    </svg>
  )
}
