import {
  afterNextRender,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  type Signal,
  signal,
  untracked,
} from "@angular/core"
import {
  createHover,
  createPress,
  type HoverOptions,
  type Modality,
  type ModalitySource,
  type PressOptions,
} from "@rind-ui/core"

const inBrowser = () => inject(PLATFORM_ID) === "browser"

/**
 * One press handle per element for the part's lifetime. Options are read at event time, so
 * `send` and `disabled` may close over signals.
 */
export function injectPress(options: PressOptions) {
  const handle = createPress(options)
  const pressed = signal(false)
  const destroy = inject(DestroyRef)
  if (inBrowser()) afterNextRender(() => destroy.onDestroy(handle.subscribe((p) => pressed.set(p))))
  destroy.onDestroy(() => handle.dispose())
  return { props: handle.props, pressed: pressed.asReadonly() }
}

/** Hover for a part that opts in: mouse and pen only. */
export function injectHover(options: HoverOptions) {
  const handle = createHover(options)
  const hovered = signal(false)
  const destroy = inject(DestroyRef)
  if (inBrowser()) {
    afterNextRender(() =>
      destroy.onDestroy(handle.subscribe(() => hovered.set(handle.isHovered()))),
    )
  }
  return { props: handle.props, hovered: hovered.asReadonly() }
}

/**
 * The current modality, subscribed only while `active` (an instance with a focused part), so a
 * modality change updates focused instances only.
 */
export function injectModality(source: ModalitySource, active: () => boolean): Signal<Modality> {
  const browser = inBrowser()
  const modality = signal<Modality>(browser ? source.modality() : "keyboard")
  if (browser) {
    effect((onCleanup) => {
      const on = active()
      untracked(() => modality.set(source.modality()))
      if (on) onCleanup(source.subscribe(() => modality.set(source.modality())))
    })
  }
  return modality.asReadonly()
}
