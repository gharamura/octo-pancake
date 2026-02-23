import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface CoaOption {
  code: string;
  name: string;
}

/**
 * Given a list of transaction descriptions and the full active COA list,
 * returns a Map<description, { coaCode, coaName } | null>.
 * Descriptions that can't be matched confidently map to null.
 * Throws on API or parse errors — callers should handle.
 */
export async function suggestCoaForDescriptions(
  descriptions: string[],
  coaOptions:   CoaOption[],
): Promise<Map<string, { coaCode: string; coaName: string } | null>> {
  if (descriptions.length === 0) return new Map();

  const coaList = coaOptions.map((c) => `${c.code} – ${c.name}`).join("\n");

  // Use index-based keys so Claude doesn't need to reproduce the exact description string.
  // We map back by index after parsing.
  const indexedDescs = descriptions.map((d, i) => `${i}: ${d}`).join("\n");

  const prompt = `You are a bookkeeping assistant for a Brazilian personal finance app.
Given a list of bank transaction descriptions (already uppercased), assign each one the most appropriate Chart of Accounts (COA) code from the list below.
If you are not confident about a description, use null.

COA accounts:
${coaList}

Transaction descriptions to classify (format: index: description):
${indexedDescs}

Respond ONLY with a valid JSON object mapping each index (as a string) to its COA code string, or null if unsure.
Example: {"0": "5.1.3", "1": null, "2": "3.2.1"}`;

  const message = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages:   [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(json) as Record<string, string | null>;

  const coaByCode = new Map(coaOptions.map((c) => [c.code, c.name]));
  const result    = new Map<string, { coaCode: string; coaName: string } | null>();

  for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i];
    const code = parsed[String(i)] ?? null;
    if (code && coaByCode.has(code)) {
      result.set(desc, { coaCode: code, coaName: coaByCode.get(code)! });
    } else {
      result.set(desc, null);
    }
  }

  return result;
}
