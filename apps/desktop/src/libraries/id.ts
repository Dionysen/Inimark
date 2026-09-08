export function libraryIdFromPath(rootPath: string): string {
  return rootPath.replace(/\\/g, "/").toLowerCase();
}
