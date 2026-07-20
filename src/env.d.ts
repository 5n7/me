/// <reference types="astro/client" />
/* oxlint-disable no-underscore-dangle -- vite.define globals use the __X__ convention */

// Injected at build time via vite.define in astro.config.mjs.
declare const __BUILD_DATE__: string;
declare const __COMMIT_HASH__: string;
