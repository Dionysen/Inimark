/**
 * Minimal Node built-in typings for CLI-only modules in this package.
 * Avoids requiring `@types/node` (browser bundle still must not import these).
 */

declare module "node:fs" {
  export interface Dirent {
    name: string;
    isFile(): boolean;
    isDirectory(): boolean;
    isSymbolicLink(): boolean;
  }

  export function existsSync(path: string): boolean;
  export function readFileSync(
    path: string,
    encoding: "utf8" | "utf-8" | string,
  ): string;
  export function readFileSync(path: string): Uint8Array;
}

declare module "node:fs/promises" {
  import type { Dirent } from "node:fs";

  export function readdir(
    path: string,
    options: { withFileTypes: true },
  ): Promise<Dirent[]>;
  export function readdir(path: string): Promise<string[]>;
  export function readFile(
    path: string,
    encoding: "utf8" | "utf-8" | string,
  ): Promise<string>;
  export function readFile(path: string): Promise<Uint8Array>;
  export function stat(path: string): Promise<{ isFile(): boolean; isDirectory(): boolean }>;
  export function cp(src: string, dest: string, opts?: { recursive?: boolean }): Promise<void>;
  export function mkdir(
    path: string,
    opts?: { recursive?: boolean },
  ): Promise<string | undefined>;
  export function rm(
    path: string,
    opts?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  export function writeFile(
    path: string,
    data: string | Uint8Array,
    encoding?: "utf8" | "utf-8" | string,
  ): Promise<void>;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
  export function basename(path: string, ext?: string): string;
}
