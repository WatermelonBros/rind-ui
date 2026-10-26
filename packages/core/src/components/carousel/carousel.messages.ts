// Carousel's strings (spec "Carousel Messages").

export interface CarouselMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly roleDescription: string
  readonly slideRoleDescription: string
  /** A slide's name. */
  readonly slideLabel: (slide: number, slides: number) => string
  readonly indicatorGroupLabel: string
  /** An indicator's name (one per page). */
  readonly indicatorLabel: (page: number, pages: number) => string
  readonly prev: string
  readonly next: string
  readonly play: string
  readonly stop: string
  /** Announced after a user page change. */
  readonly announcement: (page: number, pages: number) => string
  /** The visible Status text. */
  readonly status: (page: number, pages: number) => string
}

export const carouselMessages: CarouselMessages = {
  roleDescription: "carousel",
  slideRoleDescription: "slide",
  slideLabel: (slide, slides) => `${slide} of ${slides}`,
  indicatorGroupLabel: "Choose a slide",
  indicatorLabel: (page) => `Slide ${page}`,
  prev: "Previous slide",
  next: "Next slide",
  play: "Start automatic slide show",
  stop: "Stop automatic slide show",
  announcement: (page, pages) => `Slide ${page} of ${pages}`,
  status: (page, pages) => `${page} / ${pages}`,
}
