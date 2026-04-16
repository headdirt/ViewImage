import json from "eslint-plugin-json";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["node_modules/*", "**/eslint.config.mjs"],
}, ...compat.extends("eslint:recommended"), {
    plugins: {
        json,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
            ...globals.serviceworker,
            chrome: false,
            browser: false,
            // Shared helpers defined in js/i18n.js (loaded alongside other scripts)
            toI18n: false,
            localiseObject: false,
            localisePage: false,
        },

        ecmaVersion: 2020,
        sourceType: "module",
    },

    rules: {
        "no-global-assign": ["error"],
        "no-unused-vars": ["error", { varsIgnorePattern: "^(toI18n|localiseObject|localisePage)$" }],

        indent: ["error", 4, {
            SwitchCase: 1,
        }],

        "linebreak-style": "off",
        quotes: ["error", "single"],
        semi: ["error", "always"],
        "eol-last": "error",
    },
}, {
    files: ["tests/**/*.mjs", "playwright.config.mjs"],

    languageOptions: {
        globals: {
            ...globals.node,
        },
    },
}];
