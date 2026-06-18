// Type declarations for vite-imagetools query imports.
// `?...&as=srcset` yields a srcset string; `?...&as=url` yields a single URL string.
declare module "*&as=srcset" {
  const srcset: string;
  export default srcset;
}

declare module "*&as=url" {
  const src: string;
  export default src;
}
