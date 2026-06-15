// @spike/gamma — a workspace package shared as a SINGLETON.
// It depends on @spike/beta and uses it at module top level. The host entry
// consumes gamma, so the whole cycle (gamma -> beta -> alpha -> gamma) is
// pulled in eagerly.
import { getValue, BETA_LABEL } from '@spike/beta';

export const GAMMA_TAG = 'gamma';

export function renderApp(el) {
  el.textContent = `OK — ${BETA_LABEL} getValue() = ${getValue()}`;
}
