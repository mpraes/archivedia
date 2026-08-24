import nextPlugin from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**"],
  },
  ...nextPlugin,
];
