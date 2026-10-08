// Lints the app source for the React hook rules and for names that are used without being defined or imported
// (the safety net when code is moved between files). Files: the single source file at the repo root and web/src/lib,
// web/src/components (modules it imports).
//   npm run lint                       -> what the files report with their disable comments honoured
//   npm run lint -- --no-inline-config -> everything those comments hide (only the one in useEffectOn should show)
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import globals from "globals";

export default [
  {
    files: ["blood-donation-tracker.jsx", "web/src/lib/**/*.{js,jsx}", "web/src/components/**/*.{js,jsx}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks, react },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-undef": "error",
      "react/jsx-no-undef": "error", // eslint core no-undef does not look at <Component /> names
      "no-import-assign": "error",
    },
  },
];
