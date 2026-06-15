// @spike/core - consumer workspace package shared as a SINGLETON.
//
// Alphabetically, @spike/core sorts before @spike/hooks. Dependency-first
// ordering should still preload @spike/hooks first because @spike/core depends
// on it. The bug is that @spike/hooks/media overwrites the root @spike/hooks
// key in the package-name lookup, so the generated host init preloads the
// subpath before core, then core before the root hooks package.
import { BaseEvent } from '@spike/hooks';

export class CurrentRowChangedEvent extends BaseEvent {
  constructor(row) {
    super('currentRowChanged', { row });
  }
}

export function renderCore(el) {
  const evt = new CurrentRowChangedEvent({ id: 42 });
  el.textContent = 'OK - ' + evt.name + ' row id = ' + evt.payload.row.id;
}
