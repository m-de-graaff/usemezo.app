// Next.js 15 still loads this file; Next 16 renames the convention to
// `proxy.ts`. Delete this shim after upgrading.
export { config, proxy as middleware } from "./proxy";
