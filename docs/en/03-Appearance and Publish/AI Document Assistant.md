---
title: AI Document Assistant
lang: en
translationKey: ai-assistant
---

# AI Document Assistant

**中文:** [[AI 文档助手|中文]] · [[Settings Overview]] · [[Libraries and Files]]

The **AI** tab in the right sidebar is a vault-aware document assistant: ask questions, attach notes or folders, and let it read or edit notes when you clearly ask (disk writes are undoable).

## First-time setup

1. Open **Settings → AI**.
2. Choose a **provider** (DeepSeek / OpenAI / Anthropic / Google Gemini, or a custom OpenAI-compatible endpoint).
3. Enter that provider’s **API key** (keys are stored per provider on this device only).
4. Pick a **model** from the dropdown (for custom endpoints, type the Base URL and model id).
5. Return to the AI sidebar and send a message.

If no key is set, sending shows a prompt to finish setup.

## Providers and models

Built-in providers use an in-app catalog: after you pick a vendor, the model dropdown lists only that vendor’s models. Each model declares which **thinking intensity** levels it supports and how those map to native API parameters—you only choose Off / Low / Medium / High in the product UI.

DeepSeek’s current official models (see [Models & pricing](https://api-docs.deepseek.com/quick_start/pricing)):

| Model id | Notes |
| --- | --- |
| `deepseek-flash` | DeepSeek-V4.1-Flash (default); non-thinking / thinking |
| `deepseek-v4-pro` | DeepSeek-V4-Pro; stronger, higher price |

Legacy ids such as `deepseek-v4-flash` may still be routed server-side to Flash, but the app catalog only lists the formal ids above. Retired `deepseek-chat` / `deepseek-reasoner` prefs fall back to Flash.

| Provider | How to set the model | Notes |
| --- | --- | --- |
| DeepSeek / OpenAI / Anthropic / Gemini | Dropdown | Thinking levels follow the model |
| Custom (OpenAI-compatible) | Type Base URL + model id | No deep-thinking level mapping by default |

Keep the default Base URL unless you need a proxy or regional endpoint.

## Thinking intensity

The control next to the input shows **model name (primary) + intensity (secondary)**. Open it to pick a model first, then an intensity level for that model (hover for the submenu). If you have API keys for multiple providers, models are grouped by vendor for quick switching.

- **Off / Low**: Faster and cheaper; good for everyday edits and Q&A.
- **Medium / High**: More deliberate reasoning; replies may include a collapsible thinking block.

Which levels exist—and whether vault tools stay enabled—depends on the model.

## Attachments and the open note

- Attach files or folders as context for the turn.
- With “Attach current note when empty” enabled, the open note is included silently when you have not attached anything (no chip).
- Explicit attachments take priority and show as chips; click a chip to open that note.

## History and undo

- Chat history is stored per vault; you can start a new chat, switch, or delete sessions.
- After the assistant writes a note, **Undo last write** restores the previous content.

## Privacy

API keys and provider prefs stay on this device and are not broadcast with settings. Conversation content is sent to the provider you chose—follow that vendor’s privacy policy.
