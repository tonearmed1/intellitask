/**
 * The client (React) already escapes all rendered text by default — we never
 * use dangerouslySetInnerHTML — so the main risk vectors are: (1) control
 * characters / oversized payloads reaching the DB, and (2) untrusted web
 * research content smuggling instructions into an AI prompt. Both are
 * handled here.
 */

function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    const isControl =
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;
    if (!isControl) out += ch;
  }
  return out;
}

export function sanitizePlainText(input: string, maxLength = 10_000): string {
  return stripControlChars(input).trim().slice(0, maxLength);
}

/**
 * Wraps untrusted external content (web research results, previous-project
 * text) before it goes anywhere near a model prompt. The content is fenced
 * with an unambiguous marker and the model is instructed elsewhere (see
 * services/ai/prompts.ts) to treat everything between the markers as
 * reference data only, never as instructions.
 */
export function sanitizeForPrompt(input: string, maxLength = 1500): string {
  const cleaned = stripControlChars(input)
    // Neutralise attempts to break out of the fenced block.
    .replace(/<<<UNTRUSTED_(START|END)>>>/gi, "[redacted-marker]")
    .trim();
  return cleaned.slice(0, maxLength);
}

export function fenceUntrusted(label: string, content: string): string {
  return `<<<UNTRUSTED_START source="${label}">>>\n${content}\n<<<UNTRUSTED_END>>>`;
}
