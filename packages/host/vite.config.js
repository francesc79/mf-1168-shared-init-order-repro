import { federation } from '@module-federation/vite';
import { defineConfig } from 'vite';

// Three workspace packages shared as SINGLETONS, forming a dependency CYCLE:
//   gamma -> beta -> alpha -> gamma
//
// beta uses alpha's default export (`logging.getLogger(...)`) SYNCHRONOUSLY at
// module top level. Because the cycle gives Module Federation no safe
// "dependency-first" order for the eager init loop, beta's chunk can be
// evaluated while alpha's loadShare wrapper is still deferred -> alpha's
// `logging` binding is `undefined` -> beta throws at evaluation time.
//
// The shared keys are listed beta/gamma BEFORE alpha to bias the init loop
// toward resolving a consumer before its producer.
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
        '@spike/beta': { singleton: true },
        '@spike/gamma': { singleton: true },
        '@spike/alpha': { singleton: true },
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
