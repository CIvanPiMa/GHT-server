export interface Identifier {
  name: string;
  edition?: string;
}

export interface Permissions {
  characters?: boolean;
  character?: Identifier[];
  monsters?: boolean;
  monster?: Identifier[];
  scenario?: boolean;
  elements?: boolean;
  round?: boolean;
  level?: boolean;
  attackModifiers?: boolean;
  lootDeck?: boolean;
  party?: boolean;
}

export interface GameModel {
  revision: number;
  revisionOffset?: number;
  server?: boolean;
  [key: string]: unknown;
}

export interface GhtMessage {
  code?: string;
  password?: string; // legacy alias for code
  type: string;
  payload?: unknown;
  undoinfo?: string[];
  revision?: number;
  undolength?: number;
  serverVersion?: string;
  'allow-empty'?: boolean;
  message?: string;
}

export interface PermissionsPayload {
  code?: string;
  password?: string; // legacy alias
  permissions: Permissions | null;
}

export interface SessionMeta {
  gameId: number | null;
  code: string | null;
}
