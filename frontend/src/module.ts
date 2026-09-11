/** Host-facing entry: no root mount, global theme mutation, or host router dependency. */
import './styles.css';
import './ui/product-tokens.css';
import './ui/glass-select.css';
import './ui/product-layout.css';
export {App as DiagramWorkspace} from './App';
export type {AppProps as DiagramWorkspaceProps} from './App';
export type {HostAdapter} from './adapters/host';
export {standaloneAdapter} from './adapters/host';
export type {GenerationAdapter} from './api/client';
