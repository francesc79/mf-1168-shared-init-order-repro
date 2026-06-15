// @spike/hooks/media - subpath export of the same package.
//
// The repro depends on this subpath being shared together with @spike/hooks.
// @module-federation/vite currently maps both to the same package name
// (@spike/hooks) and lets this subpath overwrite the root shared key while
// computing dependency-first preload order.
export const HOOKS_MEDIA_TAG = 'hooks-media';
