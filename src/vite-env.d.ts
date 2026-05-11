/// <reference types="vite/client" />

// Static asset imports — Vite resolves these to URLs at build time.
// TypeScript needs the declaration so `import url from './foo.png'`
// type-checks. Vite also supports `?url` / `?raw` suffixes for explicit
// modes; the bare form works for static asset modules.
declare module '*.png' {
  const url: string;
  export default url;
}

declare module '*.jpg' {
  const url: string;
  export default url;
}

declare module '*.svg' {
  const url: string;
  export default url;
}
