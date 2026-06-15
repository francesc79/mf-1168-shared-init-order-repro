// Exposed entry module (mirrors an app entry point exposed by the host).
// It pulls in the shared-singleton cycle gamma -> beta -> alpha.
import { renderApp } from '@spike/gamma';

export { renderApp };
