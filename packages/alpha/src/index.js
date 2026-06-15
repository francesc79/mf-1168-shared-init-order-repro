// @spike/alpha — a workspace package shared as a SINGLETON.
//
// Exposes a DEFAULT EXPORT that is an OBJECT with methods (a "logging
// service"). Its shared binding carries a `getLogger(name)` method — the same
// shape as the logging instance re-exported by the lowest-level shared lib in
// the failing app:
//
//   app build:  b.getLogger('<name>')   // b === undefined  -> throws
//   here:       logging.getLogger('beta')
//
// alpha also imports @spike/gamma, closing a dependency CYCLE:
//   alpha -> gamma -> beta -> alpha
// The cycle prevents Module Federation from ordering the shared singletons
// "dependency-first" in the eager init loop. With no safe topological order, a
// consumer's loadShare wrapper can be evaluated BEFORE its dependency's
// `loadShare` has populated the share cache. On 1.16.6+ that wrapper assigns
// its exported bindings inside a deferred `initPromise.then(import(...))`
// continuation, so the bindings stay `undefined` for the whole synchronous
// phase.
import { GAMMA_TAG } from '@spike/gamma';

function getLogger(name) {
  return {
    error: (...args) => console.error(`[${name}]`, ...args),
    warn: (...args) => console.warn(`[${name}]`, ...args),
    info: (...args) => console.info(`[${name}]`, ...args),
  };
}

const logging = { getLogger };

export { getLogger };
export const LABEL = 'alpha';
export function whichGamma() {
  return GAMMA_TAG;
}
export default logging;
