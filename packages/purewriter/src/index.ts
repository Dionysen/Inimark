/**
 * `@inimark/purewriter` — independent Pure Writer ↔ vault serialize/deserialize.
 *
 * Pure (browser-safe) surface: domain model, vault mapping, Room.db codec.
 * Node FS / `.pwb` helpers live in `@inimark/purewriter/node`.
 */

export type {
  VaultRelativePath,
  VaultNote,
  VaultContent,
  PureWriterFolder,
  PureWriterCategory,
  PureWriterArticle,
  PureWriterSetting,
  PureWriterLibrary,
  VaultMapOptions,
  LibraryToVaultOptions,
  RoomCodecOptions,
} from "./types.ts";

export {
  normalizeVaultPath,
  isNoteFileName,
  splitNotePath,
  joinNotePath,
  hashHex,
  formatOrderKey,
  buildSummary,
} from "./paths.ts";

export {
  DEFAULT_FOLDER_ID,
  TRASH_FOLDER_ID,
  ROOM_USER_VERSION,
  ROOM_IDENTITY_HASH,
  vaultToLibrary,
  libraryToVault,
} from "./vault-map.ts";

/** @deprecated Prefer {@link vaultToLibrary} — same function, backup-oriented name. */
export { vaultToLibrary as serializeVault } from "./vault-map.ts";
/** @deprecated Prefer {@link libraryToVault} — same function, restore-oriented name. */
export { libraryToVault as deserializeLibrary } from "./vault-map.ts";

export { ROOM_DDL } from "./room-schema.ts";

export {
  initRoomSqlJs,
  resetRoomSqlJsForTests,
  decodeRoomDatabase,
  encodeRoomDatabase,
  decodeRoomDatabaseAsync,
  encodeRoomDatabaseAsync,
} from "./room-codec.ts";
