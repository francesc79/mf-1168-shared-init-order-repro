// @spike/beta — a workspace package shared as a SINGLETON.
//
// It depends on ANOTHER shared singleton (@spike/alpha) and uses one of its
// exports SYNCHRONOUSLY, at module-evaluation time — the same thing the
// lowest-level shared lib in the failing app does at the top of its chunk:
//
//   app build:  Vy = b.getLogger('<name>')   (top level of the shared chunk)
//
// If beta's chunk is evaluated while alpha's loadShare wrapper is still in its
// deferred state, the imported `logging` binding is `undefined` here:
//
//   ==> Uncaught TypeError: Cannot read properties of undefined (reading 'getLogger')
import logging from '@spike/alpha';

// Top-level (module-evaluation-time) use of the shared singleton's binding.
const rootLogger = logging.getLogger('beta');

rootLogger.info('beta module evaluated');

export function getValue() {
  return 42;
}

export const BETA_LABEL = 'beta';
