import { normalizePost } from './core.js';

export const STORAGE_KEY = 'sns-kang88:v1';
function validateState(data, requireVersion = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.posts) || (requireVersion && data.version !== 1)) {
    throw new Error('지원하는 버전 1 백업 파일이 아닙니다.');
  }
  const seen = new Set();
  const posts = data.posts.map(input => {
    if (!input || typeof input.id !== 'string' || !input.id.trim() || typeof input.createdAt !== 'string' || typeof input.updatedAt !== 'string') {
      throw new Error('게시물 ID 또는 저장 시각이 누락되었습니다.');
    }
    const post = normalizePost(input);
    if (seen.has(post.id)) throw new Error('백업에 중복된 게시물 ID가 있습니다.');
    seen.add(post.id);
    return post;
  });
  const goal = data.settings?.weeklyGoal;
  if (!Number.isInteger(goal) || goal < 1 || goal > 100) throw new Error('주간 목표는 1~100 사이의 정수여야 합니다.');
  return { posts, settings: { weeklyGoal: goal } };
}
function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('JSON 파일을 읽을 수 없습니다. 파일 내용을 확인해 주세요.'); }
  return validateState(data, true);
}
function exportState(state) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...validateState(state) }, null, 2);
}
export function createStore(storage) {
  let snapshot;
  let hasSnapshot = false;
  return {
    load(seed = []) {
      let raw;
      try { raw = storage.getItem(STORAGE_KEY); }
      catch { return { posts: [], settings: { weeklyGoal: 3 }, warning: '브라우저 저장소를 읽을 수 없습니다. 백업을 보관하고 저장소 권한을 확인해 주세요.' }; }
      snapshot = raw;
      hasSnapshot = true;
      if (raw === null) return { posts: seed.map(normalizePost), settings: { weeklyGoal: 3 } };
      try { return parseImport(raw); }
      catch (error) { return { posts: [], settings: { weeklyGoal: 3 }, warning: `저장된 데이터를 읽을 수 없습니다. 원본은 유지됩니다. ${error.message}` }; }
    },
    save(state) {
      const text = exportState(state);
      let current;
      try { current = storage.getItem(STORAGE_KEY); }
      catch { throw new Error('브라우저 저장소를 확인할 수 없어 저장하지 못했습니다. 저장소 권한을 확인하고 JSON 백업을 내려받아 주세요.'); }
      if (!hasSnapshot) {
        snapshot = current;
        hasSnapshot = true;
      }
      if (current !== snapshot) {
        const error = new Error('다른 탭에서 저장된 데이터가 변경되었습니다. 작성 중인 내용을 복사한 뒤 최신 데이터를 다시 불러와 주세요.');
        error.code = 'STALE_STORAGE';
        throw error;
      }
      try { storage.setItem(STORAGE_KEY, text); }
      catch { throw new Error('브라우저에 저장하지 못했습니다. 저장 공간·권한을 확인하고 JSON 백업을 내려받아 주세요.'); }
      snapshot = text;
    },
    export: exportState,
    parseImport,
    merge(current, incoming) {
      const existing = validateState(current);
      const imported = validateState(incoming);
      const byId = new Map(existing.posts.map(p => [p.id, p]));
      for (const post of imported.posts) {
        const previous = byId.get(post.id);
        if (!previous || Date.parse(post.updatedAt) > Date.parse(previous.updatedAt)) byId.set(post.id, post);
      }
      return { posts: [...byId.values()], settings: existing.settings };
    },
  };
}
