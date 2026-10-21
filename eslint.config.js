import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Audit L-16: .gitignore excludes .commandcode/ and .kiro/ as well as .kilo/,
  // but only .kilo was ignored here — so on a developer machine `npm run lint`
  // walked those directories (one of which contains a full duplicate of the
  // frontend source) and reported errors for a tree that is not committed.
  { ignores: ["dist", "node_modules", ".kilo", ".kiro", ".commandcode", "coverage"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
  // Audit M-34: the type-aware rules are what catch the class of defect this
  // codebase actually shipped — a floating promise on a mutating API call
  // (`void serverBlockUser(...)`, `void reportProfile(...)`) whose result was
  // discarded, so the UI reported a success that never happened. They need a
  // typed program, so they live in their own block.
  //
  // Only the promise rules are enabled. The full `recommendedTypeChecked`
  // set reports 770+ findings on this codebase (mostly `no-unsafe-*` on the
  // deliberately-typed API boundary and `no-unnecessary-type-assertion`),
  // which would bury the three rules that matter. Those can be adopted
  // incrementally.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      // `checksVoidReturn: false` — React event handlers legitimately return a
      // promise (`onClick={async () => {...}}`), and flagging every one of
      // them buries the rules that matter. The checks-conditions and
      // checks-return-values halves stay on.
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    },
  },
  // The server is plain ESM JavaScript (no type information available), so it
  // is linted with the base recommended rules rather than the typed ones.
  {
    files: ["server/**/*.mjs", "scripts/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-undef": "error",
      // The backend deliberately swallows failures in best-effort paths
      // (`catch { /* ignore */ }`). The one case where swallowing was a real
      // bug — the notification INSERT that aborted the enclosing transaction —
      // is fixed with a SAVEPOINT (server/src/domain.mjs), and the ones that
      // matter now surface a real error to the caller.
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["**/*.config.{ts,js,mjs}", "scripts/**/*.mjs", "server/tests/**/*.mjs"],
    rules: {
      "no-undef": "off",
    },
  },
);
