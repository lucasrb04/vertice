import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// O Biome cuida de formatação e da maior parte do lint. O ESLint fica só com o que o Biome
// não cobre: regras do Next e do react-hooks (inclusive as do React Compiler).
const keep = (rule) => rule.startsWith("@next/next/") || rule.startsWith("react-hooks/");

const onlyNextAndHooks = (config) =>
  config.rules
    ? { ...config, rules: Object.fromEntries(Object.entries(config.rules).filter(([rule]) => keep(rule))) }
    : config;

const eslintConfig = defineConfig([
  ...[...nextVitals, ...nextTs].map(onlyNextAndHooks),
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "reports/**", "research_notes/**"]),
]);

export default eslintConfig;
