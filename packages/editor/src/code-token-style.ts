/** Shared Lezer tag → token-class mapping for editor and static export. */

import { tags } from "@lezer/highlight";
import type { Tag } from "@lezer/highlight";

export type CodeTokenClass =
  | "tok-comment"
  | "tok-keyword"
  | "tok-string"
  | "tok-literal"
  | "tok-type"
  | "tok-function"
  | "tok-name"
  | "tok-punctuation"
  | "tok-meta"
  | "tok-invalid";

/**
 * HighlightStyle entries keyed by CSS class (site) or mapped to CSS vars (editor).
 * More specific tags (e.g. standard/function) must be listed so they win over
 * plain `variableName` — Shell marks commands as `standard(variableName)`.
 */
export const CODE_TOKEN_TAG_CLASSES: Array<{
  tag: Tag | readonly Tag[];
  class: CodeTokenClass;
}> = [
  { tag: tags.comment, class: "tok-comment" },
  {
    tag: [tags.keyword, tags.operatorKeyword, tags.modifier],
    class: "tok-keyword",
  },
  {
    tag: [tags.string, tags.character, tags.attributeValue],
    class: "tok-string",
  },
  {
    tag: [tags.number, tags.bool, tags.null, tags.atom],
    class: "tok-literal",
  },
  {
    tag: [tags.typeName, tags.className, tags.namespace],
    class: "tok-type",
  },
  // Shell builtins/commands, JS stdlib names, etc.
  { tag: tags.standard(tags.variableName), class: "tok-function" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    class: "tok-function",
  },
  {
    tag: [tags.variableName, tags.propertyName, tags.attributeName],
    class: "tok-name",
  },
  {
    tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator],
    class: "tok-punctuation",
  },
  { tag: [tags.meta, tags.annotation], class: "tok-meta" },
  { tag: tags.invalid, class: "tok-invalid" },
];

/** CSS custom properties used by the live editor HighlightStyle. */
export const CODE_TOKEN_CSS_VARS: Record<CodeTokenClass, string> = {
  "tok-comment": "var(--tw-code-comment, #77736c)",
  "tok-keyword": "var(--tw-code-keyword, #7b4f9d)",
  "tok-string": "var(--tw-code-string, #8a5a28)",
  "tok-literal": "var(--tw-code-literal, #6c6f1f)",
  "tok-type": "var(--tw-code-type, #0f766e)",
  "tok-function": "var(--tw-code-function, #2468a2)",
  "tok-name": "var(--tw-code-name, inherit)",
  "tok-punctuation": "var(--tw-code-punctuation, #6f6a64)",
  "tok-meta": "var(--tw-code-meta, #77736c)",
  "tok-invalid": "var(--tw-code-invalid, #b42318)",
};
