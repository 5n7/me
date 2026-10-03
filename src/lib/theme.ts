// Browser UI colors matching the --background token of each theme.
export const themeColors = { light: "#ffffff", dark: "#181a1d" } as const;

export type Theme = keyof typeof themeColors;

export const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && Object.hasOwn(themeColors, value);

export const themeStorageKey = "theme";
