// Light or dark: the learner's own choice if they have made one, otherwise what their device asks for.
// Plain JavaScript so a Node test can pin it. index.html repeats the same decision in a tiny inline script that runs before first paint (so a
// light-mode device never flashes dark); scripts/test_theme.mjs runs that script and checks it agrees with this.

/** Where the learner's choice is remembered on this device. Absent until they press the theme button. */
export const THEME_KEY = '4212-theme';

export const THEMES = ['light', 'dark'];

/** The media query that says what the device prefers. */
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The browser chrome colour (address bar on phones) for each theme: the page canvas, as in src/index.css. */
export const THEME_COLOR = { dark: '#061014', light: '#eef4f6' };

/** The 3D viewer studio background colour for each theme: #071418 in dark, #d5dfe3 in light mode (Option 3A). */
export const STAGE_COLOR = { dark: '#071418', light: '#d5dfe3' };

/** The theme to show. `choice` is the saved choice (or undefined), `systemPrefersDark` what the device asks for. */
export const resolveTheme = (choice, systemPrefersDark) => (THEMES.includes(choice) ? choice : systemPrefersDark ? 'dark' : 'light');

export const otherTheme = (theme) => (theme === 'dark' ? 'light' : 'dark');
