function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const blockedTerms = (process.env.MODERATION_BLOCKED_WORDS ?? "")
  .split(",")
  .map((term) => normalizeText(term))
  .filter(Boolean);

export function hasBlockedTerm(content: string): boolean {
  const normalizedContent = ` ${normalizeText(content)} `;
  return blockedTerms.some((term) => normalizedContent.includes(` ${term} `));
}

export function getBlockedTermCount(): number {
  return blockedTerms.length;
}
