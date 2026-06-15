# @module-federation/vite PR 819 follow-up: shared root package is ordered after its shared subpath

This repository is a minimal production-build repro for a remaining shared init ordering bug with `@module-federation/vite@https://pkg.pr.new/@module-federation/vite@819`.

The original cyclic singleton repro now passes with PR 819. This reduced case still fails when a workspace package is shared both as a root package and as a subpath export.

## Versions

| package | version |
|---|---|
| `@module-federation/vite` | `https://pkg.pr.new/@module-federation/vite@819` |
| `@module-federation/enhanced` | `2.5.1` |
| `vite` | `8.0.16` |
| node | `24.x` |
| package manager | pnpm workspaces |

## Reproduction

The host shares these workspace singleton keys:

```js
shared: {
  '@spike/core': { singleton: true },
  '@spike/hooks': { singleton: true },
  '@spike/hooks/media': { singleton: true },
}
```

Package graph:

```txt
@spike/core  -> depends on @spike/hooks
@spike/hooks -> exports root package and ./media subpath
```

`@spike/core` imports `BaseEvent` from the root package `@spike/hooks` and uses it synchronously at module evaluation time:

```js
import { BaseEvent } from '@spike/hooks';

export class CurrentRowChangedEvent extends BaseEvent {
  constructor(row) {
    super('currentRowChanged', { row });
  }
}
```

Run:

```bash
pnpm install
pnpm --filter @spike/host build
pnpm --filter @spike/host preview
# open http://localhost:4173
```

## Expected

The page renders:

```txt
OK - currentRowChanged row id = 42
```

## Actual with PR 819

The page stays on `loading...` and the browser reports:

```txt
Uncaught (in promise) TypeError: Class extends value undefined is not a constructor or null
    at assets/src-*.js:1:125
```

The generated `hostInit-*.js` preloads shared packages in this order:

```txt
@spike/hooks/media
@spike/core
@spike/hooks
```

That is wrong: `@spike/core` depends on the root package `@spike/hooks`, but the root package is preloaded after `@spike/core`.

## Root cause

PR 819 adds dependency-first ordering via `orderSharedDependenciesFirst`. The bug is in the package-name lookup used by that function:

```js
const sharedKeyByPackageName = new Map(
  sharedPackages.map((pkg) => [getPackageName(pkg), pkg])
);
```

For these shared keys:

```txt
@spike/hooks
@spike/hooks/media
```

`getPackageName(...)` returns `@spike/hooks` for both keys. Since the map is built from all entries, the subpath overwrites the root package:

```txt
@spike/hooks -> @spike/hooks/media
```

Then, while ordering `@spike/core`, its package.json dependency on `@spike/hooks` is resolved to the shared subpath `@spike/hooks/media` instead of the root `@spike/hooks`. The resulting order is:

```txt
@spike/hooks/media, @spike/core, @spike/hooks
```

When `@spike/core` is evaluated, the generated `@spike/hooks` loadShare wrapper has not yet populated its root share cache. Its exported `BaseEvent` binding is still undefined, so `class CurrentRowChangedEvent extends BaseEvent` throws.

## Verified local fix

Changing the lookup to prefer an explicit root shared key fixes this repro:

```js
function orderSharedDependenciesFirst(sharedPackages) {
  const sharedKeyByPackageName = new Map();

  sharedPackages.forEach((pkg) => {
    const packageName = getPackageName(pkg);
    const existing = sharedKeyByPackageName.get(packageName);

    if (!existing || pkg === packageName) {
      sharedKeyByPackageName.set(packageName, pkg);
    }
  });

  // existing visit logic...
}
```

With that local patch, the generated order becomes:

```txt
@spike/hooks
@spike/core
@spike/hooks/media
```

and the page renders `OK - currentRowChanged row id = 42` with no browser errors.
