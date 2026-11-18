/** Local board always works. Online upload is opt-in and has no endpoint in Stage 1. */

export const API_URL = '';

export function sanitizeNickname(value) {
  const stripped = String(value ?? '').replace(/<[^>]*>/g, '');
  const clean = stripped.replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  return clean.slice(0, 16);
}

export function localBoard(entries) {
  return [...(entries || [])].sort((a, b) => b.score - a.score).slice(0, 10);
}

export function upsertLocal(entries, nickname, score) {
  const name = sanitizeNickname(nickname);
  if (!name) return { entries: localBoard(entries), error: 'Enter a nickname (letters, numbers, spaces).' };
  if (!Number.isFinite(score)) return { entries: localBoard(entries), error: 'Score could not be saved.' };
  const next = (entries || []).filter((entry) => entry.name !== name);
  next.push({ name, score: Math.round(score), at: new Date().toISOString() });
  return { entries: localBoard(next), error: null };
}

export async function submitOnline(nickname, score) {
  const name = sanitizeNickname(nickname);
  if (!API_URL) {
    return { ok: false, message: 'Online leaderboard unavailable' };
  }
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: name, score }),
    });
    if (!response.ok) return { ok: false, message: 'Online leaderboard unavailable' };
    return { ok: true, message: 'Score uploaded' };
  } catch (error) {
    return { ok: false, message: 'Online leaderboard unavailable' };
  }
}
