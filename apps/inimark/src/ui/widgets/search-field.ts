import {
  createSearchField as createSearchFieldBase,
  type SearchFieldController,
  type SearchFieldOptions,
} from "@dionysen/ui";
import { t } from "../../i18n/index.ts";

export type { SearchFieldController, SearchFieldOptions };

/** Inimark search field — injects localized clear-label default. */
export function createSearchField(options: SearchFieldOptions = {}): SearchFieldController {
  return createSearchFieldBase({
    ...options,
    clearLabel: options.clearLabel ?? t("common.clearSearch"),
    placeholder: options.placeholder ?? t("common.search"),
  });
}
