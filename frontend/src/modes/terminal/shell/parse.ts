/**
 * Command-line parsing for the Terminal mode. Pure functions only.
 *
 *   tokenize('set projects/x summary "two words"')
 *     → ["set", "projects/x", "summary", "two words"]
 *
 * Quotes ('…' or "…") group words; a backslash escapes the next character.
 */

export interface ParsedLine {
  name: string;
  /** Every token after the command name, flags included, quotes removed. */
  tokens: string[];
  /** Tokens that are not flags. */
  args: string[];
  /** Flags without dashes: `-l` → "l", `--long` → "long"; `-la` → "l", "a". */
  flags: Set<string>;
}

export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let started = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length) {
      current += line[++i];
      started = true;
    } else if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) tokens.push(current);
      current = "";
      started = false;
    } else {
      current += ch;
      started = true;
    }
  }
  if (started) tokens.push(current);
  return tokens;
}

const isFlag = (t: string) => /^-{1,2}[a-zA-Z][\w-]*$/.test(t);

export function parseLine(line: string): ParsedLine | null {
  const [name, ...tokens] = tokenize(line.trim());
  if (!name) return null;
  const flags = new Set<string>();
  const args: string[] = [];
  for (const t of tokens) {
    if (isFlag(t)) {
      if (t.startsWith("--")) flags.add(t.slice(2));
      else for (const ch of t.slice(1)) flags.add(ch);
    } else {
      args.push(t);
    }
  }
  return { name: name.toLowerCase(), tokens, args, flags };
}

/** Levenshtein distance, for "did you mean …?" suggestions. */
export function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** The closest candidate within `max` edits, or null. */
export function closest(input: string, candidates: string[], max = 2): string | null {
  let best: string | null = null;
  let bestScore = max + 1;
  for (const c of candidates) {
    const d = distance(input.toLowerCase(), c.toLowerCase());
    if (d < bestScore) {
      best = c;
      bestScore = d;
    }
  }
  return best;
}
