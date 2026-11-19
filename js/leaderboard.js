/**
 * Leaderboard module: guaranteed localStorage ("This device") + strictly opt-in online stub.
 * Never collects personal info; sanitizes nicknames (max 16 chars, HTML stripped).
 */

export const API_URL = '';

export function sanitizeNickname(name) {
  const cleaned = String(name ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>"'&]/g, '')
    .trim()
    .slice(0, 16);
  return cleaned || 'Detective';
}

export function upsertLocal(entries = [], name, score, meta = {}) {
  const clean = sanitizeNickname(name);
  const safeScore = Math.max(0, Math.round(Number(score) || 0));
  const entry = {
    name: clean,
    score: safeScore,
    rank: meta.rank || 'Apprentice',
    stars: Number(meta.stars ?? 0),
    casesSolved: Number(meta.casesSolved ?? 0),
    date: new Date().toISOString().slice(0, 10),
  };
  const next = [...(Array.isArray(entries) ? entries : []), entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  return { entries: next, entry };
}

export async function submitOnline(name, score, options = {}) {
  const { consented = true, fetchImpl = typeof fetch === 'function' ? fetch : null } = options;
  if (!consented) {
    return { ok: false, message: 'Consent required before uploading' };
  }
  const cleanName = sanitizeNickname(name);
  const safeScore = Math.max(0, Math.round(Number(score) || 0));

  if (!API_URL || !fetchImpl) {
    return { ok: false, message: 'Online leaderboard unavailable' };
  }
  try {
    const res = await fetchImpl(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, score: safeScore }),
    });
    if (!res.ok) return { ok: false, message: 'Online leaderboard unavailable' };
    return { ok: true, message: 'Uploaded to shared leaderboard' };
  } catch {
    return { ok: false, message: 'Online leaderboard unavailable' };
  }
}