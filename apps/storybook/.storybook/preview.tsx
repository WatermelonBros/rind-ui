import "@rind-ui/theme"
import "@rind-ui/theme/presets/crisp.css"
import type { Preview } from "@storybook/react-vite"
import { brands, injectBrands } from "./brands"

injectBrands()

const preview: Preview = {
  globalTypes: {
    brand: {
      description: "Brand (theme scope)",
      toolbar: { icon: "paintbrush", items: brands, dynamicTitle: true },
    },
    theme: {
      description: "Colour scheme",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "system", title: "System" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
    tone: {
      description: "Tone (accent roles)",
      toolbar: {
        icon: "circlehollow",
        items: ["accent", "neutral", "danger", "warning", "success"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { brand: "calm", theme: "system", tone: "accent" },
  decorators: [
    (Story, { globals }) => (
      <div
        data-rind-theme={globals["brand"]}
        data-theme={globals["theme"] === "system" ? undefined : globals["theme"]}
        data-tone={globals["tone"] === "accent" ? undefined : globals["tone"]}
        style={{ padding: "var(--rind-space-6)", minHeight: "100vh" }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    // Fail stories on axe violations instead of only listing them.
    a11y: { test: "error" },
  },
}

export default preview
