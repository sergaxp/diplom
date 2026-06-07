// Каждое приложение монорепо имеет свой ESLint flat-config (apps/web, apps/api),
// поэтому команды нужно запускать через `pnpm --filter <app> exec`, а не из корня.
const quote = (files) => files.map((f) => `"${f}"`).join(' ');

export default {
  'apps/web/**/*.{ts,tsx}': (files) => [
    `pnpm --filter web exec eslint --fix --max-warnings=0 ${quote(files)}`,
    'pnpm --filter web exec tsc --noEmit',
  ],
  'apps/web/**/*.scss': (files) =>
    `pnpm --filter web exec stylelint --fix ${quote(files)}`,
  'apps/api/**/*.ts': (files) =>
    `pnpm --filter api exec eslint --fix ${quote(files)}`,
};
