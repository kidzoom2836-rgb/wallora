// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // These React Compiler rules are experimental and flag standard React Native
    // data-fetching patterns (initial loads inside useEffect, unique temp IDs in
    // event handlers). Disable them app-wide; type-safety is enforced by tsc.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
]);
