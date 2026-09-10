/** Thin host boundary. No binding to query strings or an unfinished host protocol. */
export interface HostAdapter { getInitialText(): Promise<string> }
export const standaloneAdapter: HostAdapter = { async getInitialText() { return ''; } };
