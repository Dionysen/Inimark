import { base64ToBytes, bytesToBase64 } from "./pkce.ts";
import type {
  AppProfileSummary,
  OssConfigInput,
  OssObjectMeta,
  OssObjectSummary,
} from "../vault/types.ts";
import {
  csConfigureOss,
  csOssDelete,
  csOssGet,
  csOssHead,
  csOssList,
  csOssPut,
} from "../tauri-bridge.ts";

export function configureOss(
  appId: string,
  config: OssConfigInput,
): Promise<AppProfileSummary> {
  return csConfigureOss(appId, {
    ...config,
    prefix: config.prefix ?? "",
  });
}

export function listObjects(
  appId: string,
  options: { prefix?: string; marker?: string; maxKeys?: number } = {},
): Promise<OssObjectSummary[]> {
  return csOssList({
    appId,
    prefix: options.prefix,
    marker: options.marker,
    maxKeys: options.maxKeys,
  });
}

export async function getObject(
  appId: string,
  key: string,
): Promise<Uint8Array> {
  const { base64 } = await csOssGet(appId, key);
  return base64ToBytes(base64);
}

export async function getObjectText(
  appId: string,
  key: string,
): Promise<string> {
  const bytes = await getObject(appId, key);
  return new TextDecoder().decode(bytes);
}

export function putObject(
  appId: string,
  key: string,
  data: Uint8Array | string,
  contentType?: string,
): Promise<void> {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return csOssPut({
    appId,
    key,
    base64: bytesToBase64(bytes),
    contentType,
  });
}

export function deleteObject(appId: string, key: string): Promise<void> {
  return csOssDelete(appId, key);
}

export function headObject(appId: string, key: string): Promise<OssObjectMeta> {
  return csOssHead(appId, key);
}
