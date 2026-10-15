import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  // Resolve workspace packages to their TypeScript sources (see the
  // `@rind-ui/source` export condition), so stories never wait for a build.
  viteFinal: (config) => ({
    ...config,
    resolve: { ...config.resolve, conditions: ["@rind-ui/source", "module", "browser", "default"] },
  }),
}

export default config
