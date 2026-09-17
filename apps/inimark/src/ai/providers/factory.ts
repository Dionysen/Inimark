/** Create a ChatProvider from a resolved catalog call. */

import type { ResolvedChatCall } from "../catalog/index.ts";
import type { ChatProvider } from "../types.ts";
import { createAnthropicProvider } from "./anthropic.ts";
import { createGeminiProvider } from "./gemini.ts";
import { createOpenAiCompatProvider } from "./openai-compat.ts";

export function createProviderForResolved(
  resolved: ResolvedChatCall,
  useSystemProxy: boolean,
): ChatProvider {
  const shared = {
    id: resolved.providerId,
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey,
    useSystemProxy,
  };

  switch (resolved.protocol) {
    case "anthropic":
      return createAnthropicProvider(shared);
    case "gemini":
      return createGeminiProvider(shared);
    case "openai_compat":
    default:
      return createOpenAiCompatProvider(shared);
  }
}
