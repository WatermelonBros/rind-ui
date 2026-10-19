// Marquee's strings: the PauseTrigger's name, from the user pause.

export interface MarqueeMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The PauseTrigger's name while the band moves. */
  readonly pause: string
  /** The PauseTrigger's name while the user pause holds. */
  readonly play: string
}

export const marqueeMessages: MarqueeMessages = {
  pause: "Pause animation",
  play: "Play animation",
}
