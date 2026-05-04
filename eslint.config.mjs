import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      ".wrangler-bundle/**",
      "node_modules/**",
      "coverage/**",
      "out/**",
      "build/**",
      "next-env.d.ts"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "error",
      "no-var": "error",
      "no-console": ["warn", {
        "allow": ["warn", "error"]
      }],
      "no-debugger": "error",
      "no-alert": "warn",
      "eqeqeq": ["error", "always"],
      "no-duplicate-imports": "error",
      "no-unused-expressions": "error",
      "react-hooks/set-state-in-effect": "off"
    }
  }
];

export default eslintConfig;
