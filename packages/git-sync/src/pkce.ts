/** PKCE helpers (S256) for GitHub/Gitee OAuth. */

const VERIFIER_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new Error("code_verifier length must be 43–128");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += VERIFIER_ALPHABET[bytes[i]! % VERIFIER_ALPHABET.length]!;
  }
  return out;
}

export function generateState(length = 32): string {
  return generateCodeVerifier(Math.max(43, length)).slice(0, length);
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
