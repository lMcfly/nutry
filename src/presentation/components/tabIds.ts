/** Identifiants partagés entre les onglets (`SegmentedTabs`) et leurs panneaux. */
export const tabId = (prefix: string, id: string): string => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string): string => `${prefix}-panel-${id}`;
