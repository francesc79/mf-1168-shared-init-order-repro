// Host entry. Statically imports @spike/core so host auto-init eagerly preloads
// the shared singleton set before this entry executes.
import { renderCore } from '@spike/core';

renderCore(document.getElementById('app'));
