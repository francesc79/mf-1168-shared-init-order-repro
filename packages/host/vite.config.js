import { federation } from '@module-federation/vite';
import { defineConfig } from 'vite';

// Repro for PR 819 follow-up: root shared package + shared subpath.
//
// @spike/core depends on the ROOT package @spike/hooks and synchronously uses
// BaseEvent at module-evaluation time (class extends BaseEvent).
//
// The host also shares @spike/hooks/media. In @module-federation/vite@819,
// orderSharedDependenciesFirst builds a map keyed by getPackageName(sharedKey):
//
//   @spike/hooks       -> package name @spike/hooks
//   @spike/hooks/media -> package name @spike/hooks
//
// The subpath overwrites the root package in that map. When ordering
// @spike/core dependency on @spike/hooks, the algorithm visits
// @spike/hooks/media instead of @spike/hooks. The generated hostInit preload
// order becomes:
//
//   @spike/hooks/media, @spike/core, @spike/hooks
//
// Loading @spike/core before the root @spike/hooks cache is populated makes
// the generated @spike/hooks loadShare wrapper export BaseEvent as undefined,
// and @spike/core throws: Class extends value undefined is not a constructor
// or null.
export default defineConfig({
  plugins: [
    federation({
      name: 'host',
      filename: 'remoteEntry.js',
      manifest: true,
      dts: false,
      remotes: {},
      exposes: {
        './app': './src/app.js',
      },
      shared: {
        '@spike/core': { singleton: true },
        '@spike/hooks': { singleton: true },
        '@spike/hooks/media': { singleton: true },
      },
      runtime: 'enhanced',
      shareStrategy: 'version-first',
    }),
  ],
  build: {
    target: 'esnext',
  },
  preview: {
    port: 4173,
  },
});
