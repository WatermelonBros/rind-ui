import type { Href, Router } from "@rind-ui/core"
import { computed, defineComponent, h, type PropType } from "vue"
import { RindProvider } from "../provider"

/** Client routing for every link part below; the innermost provider wins. */
export const RouterProvider = defineComponent({
  name: "RouterProvider",
  props: {
    /** Client navigation, e.g. vue-router's `router.push`. */
    navigate: { type: Function as PropType<Router["navigate"]>, required: true },
    /** The rendered href (basename): a plain function. */
    href: Function as PropType<(href: Href) => string>,
  },
  setup(props, { slots }) {
    const environment = computed(() => ({
      router: props.href
        ? { navigate: props.navigate, href: props.href }
        : { navigate: props.navigate },
    }))
    return () => h(RindProvider, { environment: environment.value }, slots)
  },
})
