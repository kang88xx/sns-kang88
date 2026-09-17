export const PHOTO_BUCKET = 'content-photos';
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const MAX_PHOTOS = 10;

const SESSION_KEY_PREFIX = 'sns-kang88:supabase-photo-session:';
const REQUEST_TIMEOUT_MS = 15000;
const PHOTO_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp']
]);

function photoError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

function normalizeProjectUrl(url) {
  if (typeof url !== 'string' || !url.trim()) throw photoError('Supabase 주소를 확인해 주세요.');
  let parsed;
  try { parsed = new URL(url); } catch { throw photoError('Supabase 주소를 확인해 주세요.'); }
  if (parsed.protocol !== 'https:') throw photoError('Supabase 주소는 HTTPS여야 합니다.');
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || !parsed.hostname.endsWith('.supabase.co')) {
    throw photoError('Supabase 프로젝트 주소를 확인해 주세요.');
  }
  return parsed.origin;
}

function decodeJwtPayload(token) {
  if (typeof token !== 'string') return null;
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = typeof atob === 'function'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function assertPublishableKey(key) {
  if (typeof key !== 'string' || !key.trim()) throw photoError('Supabase 공개 키를 확인해 주세요.');
  const trimmed = key.trim();
  if (trimmed.startsWith('sb_secret_') || trimmed.includes('service_role')) {
    throw photoError('서비스 역할 키는 브라우저에 넣을 수 없습니다.', 'SECRET_KEY_REJECTED');
  }
  if (trimmed.startsWith('sb_publishable_')) return trimmed;
  const payload = decodeJwtPayload(trimmed);
  if (payload?.role !== 'anon') throw photoError('Supabase 공개 키를 확인해 주세요.', 'PUBLIC_KEY_REQUIRED');
  return trimmed;
}

function sessionKeyFor(url) {
  return `${SESSION_KEY_PREFIX}${url}`;
}

function userFromSession(session) {
  if (!session?.access_token) return null;
  const user = session.user || decodeJwtPayload(session.access_token);
  const id = user?.id || user?.sub;
  if (typeof id !== 'string' || !id) return null;
  return { id, email: typeof user.email === 'string' ? user.email : '' };
}

function safeSession(session) {
  const user = userFromSession(session);
  if (!user || typeof session.refresh_token !== 'string' || !session.refresh_token) return null;
  const expiresAt = Number.isFinite(session.expires_at)
    ? session.expires_at
    : (Number.isFinite(session.expires_in) ? Date.now() + session.expires_in * 1000 : Date.now() + 55 * 60 * 1000);
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: expiresAt < 1000000000000 ? expiresAt * 1000 : expiresAt,
    user
  };
}

function readStoredSession(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return safeSession(JSON.parse(raw));
  } catch {
    throw photoError('브라우저 세션 저장소를 읽을 수 없습니다.', 'SESSION_STORAGE');
  }
}

function writeStoredSession(storage, key, session) {
  try {
    storage.setItem(key, JSON.stringify(session));
  } catch {
    throw photoError('브라우저 세션 저장소에 로그인 상태를 저장할 수 없습니다.', 'SESSION_STORAGE');
  }
}

function removeStoredSession(storage, key) {
  try { storage.removeItem(key); } catch { /* Sign-out should still clear memory. */ }
}

function encodeSegment(value) {
  return encodeURIComponent(value).replace(/%2F/gi, '%252F');
}

function encodePath(path) {
  return path.split('/').map(encodeSegment).join('/');
}

function jsonHeaders(key, token) {
  const headers = {
    apikey: key,
    'Content-Type': 'application/json'
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseJson(response) {
  if (response.status === 204) return null;
  try { return await response.json(); } catch { return null; }
}

function messageForStatus(status) {
  if (status === 401 || status === 403) return '사진 보관 권한을 확인해 주세요.';
  if (status === 404) return '사진 보관 위치를 찾을 수 없습니다.';
  if (status === 409) return '이미 같은 이름의 사진이 보관되어 있습니다.';
  if (status === 400) return '사진 보관 요청을 확인해 주세요.';
  if (status === 413) return '사진 파일이 너무 큽니다.';
  return '사진 보관 서버 요청에 실패했습니다.';
}

async function request(fetchImpl, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      const error = photoError(messageForStatus(response.status), `HTTP_${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  } catch (error) {
    if (error.name === 'AbortError') throw photoError('사진 보관 서버 응답이 지연되고 있습니다.', 'TIMEOUT');
    if (error.code) throw error;
    throw photoError('사진 보관 서버에 연결할 수 없습니다.', 'NETWORK');
  } finally {
    clearTimeout(timeout);
  }
}

function recordFolder(recordId) {
  if (typeof recordId !== 'string' || !recordId) throw photoError('사진을 연결할 기록을 확인해 주세요.');
  const bytes = new TextEncoder().encode(recordId);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function assertOwnPath(path, session) {
  const user = userFromSession(session);
  if (!user || typeof path !== 'string') throw photoError('사진 보관 로그인이 필요합니다.', 'AUTH_REQUIRED');
  const prefix = `${user.id}/`;
  if (!path.startsWith(prefix) || path.includes('..') || path.split('/').some(part => part === '')) {
    throw photoError('사진 경로 권한을 확인해 주세요.', 'PATH_FORBIDDEN');
  }
}

function folderFor(recordId, session) {
  const user = userFromSession(session);
  if (!user) throw photoError('사진 보관 로그인이 필요합니다.', 'AUTH_REQUIRED');
  return `${user.id}/${recordFolder(recordId)}/`;
}

function extensionFor(file) {
  return PHOTO_TYPES.get(file.type) || 'jpg';
}

function normalizedName(file, name) {
  if (name === undefined || name === null || name === '') {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${id}.${extensionFor(file)}`;
  }
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp)$/i.test(name)) {
    throw photoError('사진 파일 이름을 확인해 주세요.');
  }
  return name.toLowerCase().replace(/\.jpeg$/, '.jpg');
}

function hasMagic(bytes, type) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === 'image/webp') {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  return false;
}

export async function validatePhoto(file) {
  if (!file || typeof file.size !== 'number' || typeof file.slice !== 'function') {
    throw photoError('사진 파일을 선택해 주세요.');
  }
  if (file.size <= 0) throw photoError('비어 있는 사진은 첨부할 수 없습니다.');
  if (file.size > MAX_PHOTO_BYTES) throw photoError('사진은 6MB 이하만 첨부할 수 있습니다.');
  if (!PHOTO_TYPES.has(file.type)) throw photoError('JPG, PNG, WebP 사진만 첨부할 수 있습니다.');
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!hasMagic(header, file.type)) throw photoError('사진 파일 형식을 확인해 주세요.');
  return { type: file.type, bytes: file.size, ext: extensionFor(file) };
}

export { recordFolder };

function defaultSessionStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function unconfiguredCloud(message = 'Supabase 사진 보관 설정이 필요합니다.') {
  async function fail() { throw photoError(message, 'NOT_CONFIGURED'); }
  return {
    configured: false,
    get user() { return null; },
    signIn: fail,
    signOut: fail,
    restore: fail,
    list: fail,
    upload: fail,
    read: fail,
    remove: fail,
    clearRecord: fail
  };
}

export function createPhotoCloud(config, options = {}) {
  let url;
  let key;
  try {
    url = normalizeProjectUrl(config?.url);
    key = assertPublishableKey(config?.publishableKey);
  } catch (error) {
    return unconfiguredCloud(error.message);
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw photoError('사진 보관 통신을 사용할 수 없습니다.');
  const storage = options.sessionStorage || defaultSessionStorage();
  const storageKey = sessionKeyFor(url);
  let session = null;
  let refreshPromise = null;

  async function authRequest(path, body) {
    const response = await request(fetchImpl, `${url}${path}`, {
      method: 'POST',
      headers: jsonHeaders(key),
      body: JSON.stringify(body)
    });
    return parseJson(response);
  }

  async function persistSession(next) {
    const normalized = safeSession(next);
    if (!normalized) throw photoError('로그인 응답을 확인할 수 없습니다.');
    if (!storage) throw photoError('브라우저 세션 저장소에 로그인 상태를 저장할 수 없습니다.', 'SESSION_STORAGE');
    writeStoredSession(storage, storageKey, normalized);
    session = normalized;
    return normalized.user;
  }

  async function refreshSession() {
    if (!session?.refresh_token) throw photoError('사진 보관 로그인이 필요합니다.', 'AUTH_REQUIRED');
    if (!refreshPromise) {
      refreshPromise = authRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then(next => persistSession(next))
        .catch(error => {
          session = null;
          if (storage) removeStoredSession(storage, storageKey);
          throw error;
        })
        .finally(() => { refreshPromise = null; });
    }
    await refreshPromise;
  }

  async function authed(path, init = {}, retried = false) {
    if (!session) throw photoError('사진 보관 로그인이 필요합니다.', 'AUTH_REQUIRED');
    if (session.expires_at - Date.now() < 60000) await refreshSession();
    const headers = { ...(init.headers || {}), apikey: key, Authorization: `Bearer ${session.access_token}` };
    try {
      return await request(fetchImpl, `${url}${path}`, { ...init, headers });
    } catch (error) {
      if (!retried && error.status === 401 && session?.refresh_token) {
        await refreshSession();
        return authed(path, init, true);
      }
      throw error;
    }
  }

  async function assertOwnerAllowed() {
    if (!session?.user?.id) throw photoError('사진 보관 로그인이 필요합니다.', 'AUTH_REQUIRED');
    const query = `/rest/v1/photo_owners?select=user_id&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`;
    const response = await authed(query, { headers: { Accept: 'application/json' } });
    const rows = await parseJson(response);
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw photoError('사진 보관 관리자 권한이 없습니다.', 'OWNER_NOT_ALLOWED');
    }
  }

  return {
    configured: true,
    get user() { return session?.user || null; },
    async signIn(email, password) {
      if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
        throw photoError('이메일과 비밀번호를 입력해 주세요.');
      }
      const next = await authRequest('/auth/v1/token?grant_type=password', { email, password });
      const normalized = safeSession(next);
      if (!normalized) throw photoError('로그인 응답을 확인할 수 없습니다.');
      const previous = session;
      session = normalized;
      try {
        await assertOwnerAllowed();
        if (!storage) throw photoError('브라우저 세션 저장소에 로그인 상태를 저장할 수 없습니다.', 'SESSION_STORAGE');
        writeStoredSession(storage, storageKey, normalized);
        return normalized.user;
      } catch (error) {
        session = previous;
        throw error;
      }
    },
    async signOut() {
      const active = session;
      session = null;
      if (storage) removeStoredSession(storage, storageKey);
      if (active?.access_token) {
        try {
          await request(fetchImpl, `${url}/auth/v1/logout?scope=local`, {
            method: 'POST',
            headers: jsonHeaders(key, active.access_token)
          });
        } catch { /* Local sign-out should not be blocked by network cleanup. */ }
      }
    },
    async restore() {
      if (!storage) throw photoError('브라우저 세션 저장소를 읽을 수 없습니다.', 'SESSION_STORAGE');
      session = readStoredSession(storage, storageKey);
      if (!session) return null;
      try {
        if (session.expires_at - Date.now() < 60000) await refreshSession();
        await assertOwnerAllowed();
        return session.user;
      } catch (error) {
        session = null;
        removeStoredSession(storage, storageKey);
        throw error;
      }
    },
    async list(recordId) {
      const prefix = folderFor(recordId, session);
      const found = [];
      for (let offset = 0; ; offset += 100) {
        const response = await authed(`/storage/v1/object/list/${PHOTO_BUCKET}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
        });
        const rows = await parseJson(response);
        if (!Array.isArray(rows)) throw photoError('사진 목록 응답을 확인할 수 없습니다.');
        for (const row of rows) {
          if (typeof row.name === 'string' && row.name && !row.name.includes('/')) {
            found.push({ name: row.name, path: `${prefix}${row.name}` });
          }
        }
        if (rows.length < 100) return found;
      }
    },
    async upload(recordId, file, name) {
      await validatePhoto(file);
      const current = await this.list(recordId);
      const fileName = normalizedName(file, name);
      if (current.some(photo => photo.name === fileName)) return current.find(photo => photo.name === fileName);
      if (current.length >= MAX_PHOTOS) throw photoError(`사진은 기록당 ${MAX_PHOTOS}장까지 첨부할 수 있습니다.`);
      const path = `${folderFor(recordId, session)}${fileName}`;
      const response = await authed(`/storage/v1/object/${PHOTO_BUCKET}/${encodePath(path)}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'x-upsert': 'false', 'cache-control': '3600' },
        body: file
      });
      await parseJson(response);
      return { name: fileName, path };
    },
    async read(path) {
      assertOwnPath(path, session);
      const response = await authed(`/storage/v1/object/authenticated/${PHOTO_BUCKET}/${encodePath(path)}`, { headers: { Accept: '*/*' } });
      const blob = await response.blob();
      await validatePhoto(blob);
      return blob;
    },
    async remove(paths) {
      if (!Array.isArray(paths)) throw photoError('삭제할 사진을 확인해 주세요.');
      const prefixes = paths.filter(Boolean);
      for (const path of prefixes) assertOwnPath(path, session);
      if (prefixes.length === 0) return [];
      const deleted = [];
      for (let index = 0; index < prefixes.length; index += 100) {
        const batch = prefixes.slice(index, index + 100);
        const response = await authed(`/storage/v1/object/${PHOTO_BUCKET}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: batch })
        });
        const rows = await parseJson(response);
        if (Array.isArray(rows)) deleted.push(...rows);
      }
      return deleted;
    },
    async clearRecord(recordId) {
      const photos = await this.list(recordId);
      await this.remove(photos.map(photo => photo.path));
      if ((await this.list(recordId)).length > 0) throw photoError('삭제되지 않은 사진이 남아 있습니다.', 'DELETE_INCOMPLETE');
      return photos.length;
    }
  };
}
