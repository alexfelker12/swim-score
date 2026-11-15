//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "import/consistent-type-specifier-style": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    // UI comes from shadcn/ui on Base UI (docs/adr/0009). Outside the
    // components in src/components/ui, use those instead of raw elements.
    // A warning until all screens are migrated (#41–#45), an error with #46.
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        ...["button", "input", "select", "textarea", "table"].map((tag) => ({
          selector: `JSXOpeningElement[name.name='${tag}']`,
          message: `No raw <${tag}>: use the matching shadcn component from @/components/ui (Button, Input/InputGroup, NativeSelect, Textarea, Table).`,
        })),
        ...[
          "JSXAttribute[name.name='role'][value.value='dialog']",
          "JSXAttribute[name.name='role'] > JSXExpressionContainer > Literal[value='dialog']",
        ].map((selector) => ({
          selector,
          message:
            'No hand-made role="dialog": use Drawer (bottom sheet) or Dialog from @/components/ui.',
        })),
      ],
    },
  },
  {
    ignores: [
      "eslint.config.js",
      ".prettierrc",
      ".vercel/**",
      ".output/**",
      "src/routeTree.gen.ts",
      "docs/**",
    ],
  },
]
