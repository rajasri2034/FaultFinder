const KEY = 'faultfinder-save-v1';

export function defaultSave() {
  return {
    version: 1,
    xp: 0,
    best: {},
    solved: {},
    leaderboard: [],
    sound: false,
    run: null,
  };
}

function storeFrom(storage) {
  if (storage) return storage;
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch (error) {
    return null;
  }
}

export function loadSave(storage) {
  try {
    const store = storeFrom(storage);
    if (!store) return defaultSave();
    const raw = store.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed !== 'object') return defaultSave();
    return {
      ...defaultSave(),
      ...parsed,
      best: parsed.best && typeof parsed.best === 'object' ? parsed.best : {},
      solved: parsed.solved && typeof parsed.solved === 'object' ? parsed.solved : {},
      leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
    };
  } catch (error) {
    return defaultSave();
  }
}

export function writeSave(save, storage) {
  try {
    const store = storeFrom(storage);
    if (!store) return { ok: false, error: 'unavailable' };
    store.setItem(KEY, JSON.stringify(save));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: 'failed' };
  }
}
