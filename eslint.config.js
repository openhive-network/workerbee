import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixupPluginRules } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import _import from "eslint-plugin-import";
import globals from "globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [ {
  ignores: [
    "**/node_modules",
    "**/dist",
    "examples"
  ]
}, ...compat.extends("eslint:recommended"), {
  plugins: {
    import: fixupPluginRules(_import)
  },
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
      ...globals.es2020
    },
    ecmaVersion: 11,
    sourceType: "module",
  },

  rules: {
    "require-atomic-updates": 1,
    "no-unused-private-class-members": 1,
    "capitalized-comments": 1,
    "multiline-comment-style": 1,
    "no-else-return": 1,
    "curly": [ 1, "multi" ],
    "default-case": [ 1, {
      commentPattern: "^[sS]kip\\sdefault"
    } ],
    "consistent-return": 0,
    "consistent-this": 2,
    "no-console": 1,
    "no-eval": 2,
    "no-extra-bind": 2,
    "no-useless-return": 2,
    "no-var": 2,
    "prefer-const": 2,
    "prefer-object-spread": 2,
    "prefer-spread": 2,
    "require-await": 2,
    "func-style": [ 2, "expression" ],
    "quote-props": [ 2, "consistent-as-needed" ],
    "no-restricted-syntax": [ 2, "WithStatement" ],
    "id-length": [ 2, {
      min: 2,
      max: 30,
      exceptionPatterns: [ "[_ei-l]" ]
    } ],
    "eol-last": 1,
    "no-multiple-empty-lines": 1,
    "max-len": [ 1, {
      code: 160
    } ],
    "comma-spacing": 2,
    "linebreak-style": 2,
    "no-tabs": 2,
    "no-trailing-spaces": 2,
    "indent": [ 2, 2 ],
    "semi-style": [ 2, "last" ],
    "comma-style": [ 2, "last" ],
    "quotes": [ 2, "double" ],
    "brace-style": [ 2, "1tbs", {
      allowSingleLine: true
    } ],
    "import/no-self-import": 2,
    "import/no-cycle": 2,
    "import/export": 2,
    "import/no-unused-modules": 1,
    "import/no-commonjs": 1,
    "import/newline-after-import": 2,
    "import/first": 2,
    "import/no-duplicates": 2,
    "import/order": [ 2, {
      alphabetize: {
        order: "asc",
        caseInsensitive: true
      }
    } ],
    // Those will be handled later in the TypeScript section
    "no-redeclare": 0,
    "no-undef": 0
  }
}, {
  files: [ "**/*.ts" ],
  plugins: {
    "@typescript-eslint": typescriptEslint
  },
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
      ...globals.es2020
    },
    parser: tsParser,
    ecmaVersion: 11,
    sourceType: "module"
  },
  rules: {
    ...typescriptEslint.configs.recommended.rules,
    "@typescript-eslint/no-unused-vars": [ 1, {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_"
    } ],
    "@typescript-eslint/explicit-member-accessibility": 2,
    "@typescript-eslint/explicit-function-return-type": 0,
    "@typescript-eslint/no-non-null-assertion": 0,
    "@typescript-eslint/no-inferrable-types": 0,
    "@typescript-eslint/no-explicit-any": 0,
    "@typescript-eslint/typedef": 0,
    "@typescript-eslint/no-extra-semi": 0,
    "@typescript-eslint/no-empty-function": 0,
    "@typescript-eslint/no-empty-object-type": 0
  }
} ];
