# `@module-federation/vite` 1.16.8 — cyclic shared singletons get `undefined` bindings in production builds (`Cannot read properties of undefined`)

## TL;DR

In a **production build**, when several workspace packages are shared as
**singletons** and they form a **dependency cycle**, Module Federation can no
longer order them "dependency-first" in the eager init loop. A consumer package
is then eagerly loaded **before** the producer it depends on. The producer's
generated `loadShare` wrapper assigns its exported bindings **asynchronously**
(inside `initPromise.then(() => import(...).then(...))`), so any consumer that
touches one of those bindings **synchronously, at module-evaluation time**, sees
`undefined`:

```
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'getLogger')
```

If a second chunk then consumes the (now half-initialised) consumer, you also
get the follow-on error:

```
Uncaught (in promise) TypeError: <fn> is not a function
```

Both are the **same** failure mode that an app on 1.16.8 hits in its build, e.g.:

```
core-….js          Uncaught TypeError: Cannot read properties of undefined (reading 'getLogger')
UseApplication-….js Uncaught TypeError: h is not a function
store-….js          Uncaught TypeError: l is not a function
```

## Versions

| | |
|---|---|
| `@module-federation/vite` | **1.16.8** |
| `@module-federation/enhanced` | 2.5.1 (`runtime: 'enhanced'`) |
| `vite` | 8.x (Rolldown) |
| node | 24.x |
| package manager | pnpm workspaces |

> Note: the simpler two-package case (one singleton consumed synchronously,
> no cycle) was a regression in 1.16.6 and is **fixed** in 1.16.8 — that minimal
> repro no longer crashes on 1.16.8. The variant in *this* repo (a **cycle**
> among shared singletons) still crashes on 1.16.8.

## Reproduction

pnpm workspace with four packages forming a cycle `gamma → beta → alpha → gamma`:

```
packages/
  alpha/   @spike/alpha  — logging service; default export is an object with getLogger()
                            (imports @spike/gamma -> closes the cycle)
  beta/    @spike/beta   — imports alpha's default export and calls
                            logging.getLogger('beta') AT MODULE TOP LEVEL
  gamma/   @spike/gamma  — imports beta's getValue(); the host entry renders through it
  host/    @spike/host   — MF host; shares alpha/beta/gamma as singletons
```

```bash
pnpm install
pnpm --filter @spike/host build
pnpm --filter @spike/host preview     # http://localhost:4173
#  (or any static server over packages/host/dist)
```

Open the page.

### Expected

```
OK — beta getValue() = 42
```

### Actual on 1.16.8

The page stays on `loading…`, console shows:

```
Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'getLogger')
    at assets/src-XXXX.js          (the `beta` chunk)
```

## Root cause

### 1. The cycle defeats dependency-first ordering

`host/vite.config.js` lists the shared keys `@spike/beta`, `@spike/gamma`,
`@spike/alpha` and they import each other in a cycle. With no valid topological
order, the generated **eager init loop** in `hostInit-….js` keeps the
registration order and loads the **consumer before the producer**:

```js
// hostInit-….js  (sequential, awaited)
const shared = {
  "@spike/beta":  { shareConfig: { singleton: true, requiredVersion: "^0.0.1" } },
  "@spike/gamma": { shareConfig: { singleton: true, requiredVersion: "^0.0.1" } },
  "@spike/alpha": { shareConfig: { singleton: true, requiredVersion: "^0.0.1" } }, // <- LAST
};
for (const [name, cfg] of Object.entries(shared)) {
  cache.share[key] === undefined &&
    await runtime.loadShare(name, …).then(/* cache.share[key] = … */);
}
```

`loadShare('@spike/beta')` evaluates the `beta` chunk, whose top level needs
`@spike/alpha` — but `@spike/alpha` is loaded **last**, so its share cache entry
is still empty at that moment.

### 2. The producer wrapper hands out a deferred (undefined) binding

Generated wrapper for `@spike/alpha` (`_virtual_mf…alpha__loadShare__.js`):

```js
let s;                                  // the default-export binding (undefined)
const c = (mod) => { /* … */ s = mod.default ?? mod };
const l = cache.share["@spike/alpha"];
l === undefined
  ? initPromise.then(() =>
      import("./src-alpha.js").then((mod) => {  // <-- async continuation
        cache.share["@spike/alpha"] = normalize(mod);
        c(cache.share["@spike/alpha"]);          // <-- s assigned HERE, later
      }))
  : c(l);
export { s as t };                      // <-- exported binding, undefined until the .then runs
```

Because the share cache is empty when this wrapper is first evaluated, it takes
the **deferred** branch: `s` is only assigned inside the `initPromise.then(...)`
continuation.

> ⚠️ Note the decoupling: `loadShare` later populates `cache.share["@spike/alpha"]`,
> but that does **not** retroactively assign the wrapper's local `s`. Only the
> wrapper's own `c(...)` call (sync branch, or the deferred `.then`) assigns it.

### 3. The consumer reads the binding synchronously → throws

Generated `beta` chunk (`src-XXXX.js`):

```js
import { t as logging } from "./_virtual_mf…alpha__loadShare__.js";
logging.getLogger("beta").info("beta module evaluated");  // logging === undefined -> THROW
export function getValue() { return 42; }
export const BETA_LABEL = "beta";
```

`logging` is the still-`undefined` `s` binding → `logging.getLogger` throws
`Cannot read properties of undefined (reading 'getLogger')`. Because `beta`'s
evaluation aborts, its `getValue` / `BETA_LABEL` exports never initialise either,
so any later consumer of `beta` throws `<fn> is not a function` — the analogue
of the app's `h is not a function` / `l is not a function`.

## Why it matters

Any monorepo that shares its workspace packages as singletons will, in practice,
have **cycles** between those packages (e.g. a `utility` ⇄ `core` ⇄ `framework`
triangle, where the lowest-level lib obtains a logger at module top level). On
1.16.8 the deferred-assignment wrapper makes that arrangement crash at startup in
production builds.

## Suggested fix

Either:

- For the production-build path, restore the **top-level `await import(...)`**
  form so the wrapper's exported bindings are live before the module finishes
  evaluating (this is what made the simple case work again); or
- Guarantee the share cache for every shared singleton is populated **before**
  any consumer wrapper can be evaluated, even when the shared graph is cyclic
  (i.e. don't rely on dependency-first ordering, which a cycle makes impossible).

## Notes

- No framework (React/etc.) is needed to reproduce; the failure is purely in the
  generated MF shared-init code.
- The deterministic trigger here is the **cycle** + a **top-level synchronous
  use** of a shared singleton's binding. Remove either (break the cycle, or make
  the use lazy/async) and the page renders `OK`.
