/**
 * Characters that must never appear in text we accept or display: control characters and
 * invisible direction overrides (the "Trojan Source" trick). ZWJ and ZWNJ stay allowed
 * because Devanagari and other Indic scripts need them.
 */

/** Control characters and bidirectional overrides. */
const UNSAFE_CHARACTERS = /[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;

/** True when the text contains a control character or a hidden direction override. */
export function hasUnsafeCharacters(text: string): boolean {
  return UNSAFE_CHARACTERS.test(text);
}
