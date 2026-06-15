// Host entry. STATICALLY imports the shared-singleton cycle through gamma, so
// gamma -> beta -> alpha are part of the initial synchronous module graph and
// are evaluated as soon as the entry chunk runs.
import { renderApp } from '@spike/gamma';

renderApp(document.getElementById('app'));
