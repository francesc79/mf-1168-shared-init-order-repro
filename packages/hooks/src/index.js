// @spike/hooks - root workspace package shared as a SINGLETON.
//
// This mirrors @flex4/hooks: @spike/core imports BaseEvent from the root
// package and uses it synchronously in a class extends expression.
export class BaseEvent {
  constructor(name, payload) {
    this.type = 'event';
    this.name = name;
    this.payload = payload;
  }
}

export const HOOKS_ROOT_TAG = 'hooks-root';
