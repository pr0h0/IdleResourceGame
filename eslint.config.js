// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // "75% strict" settings - loosen up some common strict TS rules for rapid prototyping
      "@typescript-eslint/no-explicit-any": "warn", // Allow 'any' but warn about it
      "@typescript-eslint/no-non-null-assertion": "off", // Allow ! operator (common in game dev for entity lookups)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ], // Warn instead of Error
      "@typescript-eslint/ban-ts-comment": "off", // Allow @ts-ignore for "syntax hacks"
      "no-constant-condition": "warn",
    },
    ignores: ["dist/*", "node_modules/*"],
  },
);
