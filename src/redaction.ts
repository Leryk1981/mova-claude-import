import crypto from "node:crypto";

export type RedactionHit = {
  rule_id: string;
  key?: string;
  len?: number;
};

const KEY_RE = /(api[_-]?key|token|secret|password|authorization|bearer)/i;
const INLINE_SECRET_RE = /(sk-[a-zA-Z0-9]{8,})/g; // best‑effort

export function redactText(input: string): { redacted: string; hits: RedactionHit[] } {
  const hits: RedactionHit[] = [];
  let out = input;

  // redact obvious inline tokens
  out = out.replace(INLINE_SECRET_RE, (m) => {
    hits.push({ rule_id: "inline_token_like", len: m.length });
    return "[REDACTED_TOKEN]";
  });

  // redact KEY=VALUE lines (best‑effort)
  out = out.replace(/^([A-Z0-9_]{3,80})\s*=\s*(.+)$/gmi, (line, k, v) => {
    if (!KEY_RE.test(k)) return line;
    hits.push({ rule_id: "key_value_line", key: k, len: String(v).length });
    return `${k}=[REDACTED_VALUE_LEN_${String(v).length}]`;
  });

  return { redacted: out, hits };
}

export function redactJson(obj: unknown): { redacted: unknown; hits: RedactionHit[] } {
  const hits: RedactionHit[] = [];

  function walk(x: any): any {
    if (x === null || x === undefined) return x;
    if (typeof x === "string") {
      const r = redactText(x);
      hits.push(...r.hits);
      return r.redacted;
    }
    if (Array.isArray(x)) return x.map(walk);
    if (typeof x === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(x)) {
        if (KEY_RE.test(k) && typeof v === "string") {
          hits.push({ rule_id: "json_secret_field", key: k, len: v.length });
          out[k] = `[REDACTED_VALUE_LEN_${v.length}]`;
        } else {
          out[k] = walk(v);
        }
      }
      return out;
    }
    return x;
  }

  return { redacted: walk(obj), hits };
}

export function stableSha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
