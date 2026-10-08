// Lints only the React hook rules on the app file -- the 16 `eslint-disable-next-line react-hooks/exhaustive-deps`
// comments in blood-donation-tracker.jsx were hiding warnings from a linter nobody ran.
//   npm run lint                    -> what the file reports with its disable comments honoured
//   npm run lint -- --no-inline-config -> everything those comments hide
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["blood-donation-tracker.jsx"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn" },
  },
];
