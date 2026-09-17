import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  PHOTO_BUCKET,
  createPhotoCloud,
  recordFolder,
  validatePhoto
} from '../photos.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

function jwt(payload) {
  return `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
}

function memorySession(fail = {}) {
  const values = new Map();
  return {
    getItem(key) {
      if (fail.get) throw new Error('blocked');
      return values.get(key) || null;
    },
    setItem(key, value) {
      if (fail.set) throw new Error('blocked');
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
    raw() {
      return values;
    }
  };
}

function pngBlob(size = 16) {
  const bytes = new Uint8Array(Math.max(size, 8));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Blob([bytes], { type: 'image/png' });
}

function jpegBlob() {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb])], { type: 'image/jpeg' });
}

function webpBlob() {
  return new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])], { type: 'image/webp' });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function photoResponse(body = pngBlob()) {
  return new Response(body, { status: 200, headers: { 'Content-Type': body.type } });
}

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return handler(new URL(url), init, calls.length);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function signedInFetch(options = {}) {
  const access = jwt({ sub: USER_ID, email: 'owner@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
  const refreshed = jwt({ sub: USER_ID, email: 'owner@example.com', exp: Math.floor(Date.now() / 1000) + 7200 });
  const objects = options.objects || new Map();
  let ownerAllowed = options.ownerAllowed ?? true;
  let firstListUnauthorized = options.firstListUnauthorized || false;
  let rejectUploads = options.rejectUploads || false;
  let partialDelete = options.partialDelete || false;
  const fetchImpl = mockFetch((url, init) => {
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      return jsonResponse({
        access_token: access,
        refresh_token: 'refresh-1',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: USER_ID, email: 'owner@example.com' }
      });
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      return jsonResponse({
        access_token: refreshed,
        refresh_token: 'refresh-2',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: USER_ID, email: 'owner@example.com' }
      });
    }
    if (url.pathname === '/rest/v1/photo_owners') {
      return jsonResponse(ownerAllowed ? [{ user_id: USER_ID }] : []);
    }
    if (url.pathname === `/storage/v1/object/list/${PHOTO_BUCKET}`) {
      if (firstListUnauthorized) {
        firstListUnauthorized = false;
        return jsonResponse({ message: 'expired' }, 401);
      }
      const { prefix, limit = 100, offset = 0 } = JSON.parse(init.body);
      const rows = [...objects.keys()]
        .filter(path => path.startsWith(prefix))
        .map(path => ({ name: path.slice(prefix.length) }))
        .slice(offset, offset + limit);
      return jsonResponse(rows);
    }
    if (url.pathname === `/storage/v1/object/${PHOTO_BUCKET}` && init.method === 'DELETE') {
      const { prefixes } = JSON.parse(init.body);
      const removed = partialDelete ? prefixes.slice(0, 1) : prefixes;
      for (const path of removed) objects.delete(path);
      return jsonResponse(prefixes.map(name => ({ name })));
    }
    if (url.pathname.startsWith(`/storage/v1/object/${PHOTO_BUCKET}/`) && init.method === 'POST') {
      const path = decodeURIComponent(url.pathname.slice(`/storage/v1/object/${PHOTO_BUCKET}/`.length));
      if (rejectUploads) return jsonResponse({ message: 'bad request' }, 400);
      if (objects.has(path)) return jsonResponse({ message: 'duplicate' }, 400);
      objects.set(path, init.body);
      return jsonResponse({ Key: path });
    }
    if (url.pathname.startsWith(`/storage/v1/object/authenticated/${PHOTO_BUCKET}/`) && (!init.method || init.method === 'GET')) {
      const path = decodeURIComponent(url.pathname.slice(`/storage/v1/object/authenticated/${PHOTO_BUCKET}/`.length));
      return photoResponse(objects.get(path) || pngBlob());
    }
    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
    throw new Error(`unexpected ${init.method || 'GET'} ${url.pathname}`);
  });
  fetchImpl.setOwnerAllowed = value => { ownerAllowed = value; };
  return fetchImpl;
}

test('validates real image magic, MIME type and size limits', async () => {
  assert.deepEqual(await validatePhoto(jpegBlob()), { type: 'image/jpeg', bytes: 4, ext: 'jpg' });
  assert.deepEqual(await validatePhoto(pngBlob()), { type: 'image/png', bytes: 16, ext: 'png' });
  assert.deepEqual(await validatePhoto(webpBlob()), { type: 'image/webp', bytes: 12, ext: 'webp' });
  await assert.rejects(() => validatePhoto(new Blob([new Uint8Array([0xff])], { type: 'image/svg+xml' })), /JPG, PNG, WebP/);
  await assert.rejects(() => validatePhoto(new Blob([], { type: 'image/png' })), /비어/);
  await assert.rejects(() => validatePhoto(new Blob([new Uint8Array(MAX_PHOTO_BYTES + 1)], { type: 'image/png' })), /6MB/);
  await assert.rejects(() => validatePhoto(new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'image/png' })), /형식/);
});

test('encodes arbitrary stable record ids as URL-safe folders', () => {
  assert.equal(recordFolder('abc/한글 id'), 'YWJjL-2VnOq4gCBpZA');
  assert.doesNotMatch(recordFolder('abc/한글 id'), /[+/=]/);
});

test('accepts only publishable keys or anon JWT keys and validates hosted project URLs', () => {
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'service_role' }) }, { fetchImpl: async () => jsonResponse({}) });
  assert.equal(cloud.configured, false);
  assert.equal(cloud.user, null);
  assert.equal(createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: 'sb_secret_x' }, { fetchImpl: async () => jsonResponse({}) }).configured, false);
  assert.equal(createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'authenticated' }) }, { fetchImpl: async () => jsonResponse({}) }).configured, false);
  assert.equal(createPhotoCloud({ url: 'https://demo.supabase.co/path', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: async () => jsonResponse({}) }).configured, false);
  assert.equal(createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: 'sb_publishable_test' }, { fetchImpl: async () => jsonResponse({}), sessionStorage: memorySession() }).configured, true);
});

test('signs in only after allowlist check and stores tab-scoped session', async () => {
  const fetchImpl = signedInFetch();
  const storage = memorySession();
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl, sessionStorage: storage });
  const user = await cloud.signIn('owner@example.com', 'pw');
  assert.deepEqual(user, { id: USER_ID, email: 'owner@example.com' });
  assert.equal(cloud.user.id, USER_ID);
  assert.equal(storage.raw().size, 1);
  assert.ok(fetchImpl.calls.some(call => call.url.includes('/rest/v1/photo_owners')));
});

test('does not keep a usable session when allowlist or session storage fails', async () => {
  const deniedFetch = signedInFetch({ ownerAllowed: false });
  const denied = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: deniedFetch, sessionStorage: memorySession() });
  await assert.rejects(() => denied.signIn('owner@example.com', 'pw'), /관리자 권한/);
  assert.equal(denied.user, null);

  const blocked = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: signedInFetch(), sessionStorage: memorySession({ set: true }) });
  await assert.rejects(() => blocked.signIn('owner@example.com', 'pw'), /세션 저장소/);
  assert.equal(blocked.user, null);

  const noStorage = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: signedInFetch() });
  assert.equal(noStorage.configured, true);
  await assert.rejects(() => noStorage.signIn('owner@example.com', 'pw'), /세션 저장소/);
  assert.equal(noStorage.user, null);
});

test('uploads to the owner record folder with deterministic names and rejects foreign paths', async () => {
  const objects = new Map();
  const fetchImpl = signedInFetch({ objects });
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl, sessionStorage: memorySession() });
  await cloud.signIn('owner@example.com', 'pw');
  const uploaded = await cloud.upload('post/한글', pngBlob(), 'retry-id.png');
  assert.equal(uploaded.name, 'retry-id.png');
  assert.equal(uploaded.path, `${USER_ID}/${recordFolder('post/한글')}/retry-id.png`);
  assert.equal(objects.size, 1);
  assert.equal((await cloud.upload('post/한글', pngBlob(), 'retry-id.png')).path, uploaded.path);
  assert.ok(fetchImpl.calls.some(call => new URL(call.url).pathname.startsWith(`/storage/v1/object/${PHOTO_BUCKET}/`)));
  assert.deepEqual(await cloud.read(uploaded.path), objects.get(uploaded.path));
  assert.ok(fetchImpl.calls.some(call => new URL(call.url).pathname.startsWith(`/storage/v1/object/authenticated/${PHOTO_BUCKET}/`)));
  await assert.rejects(() => cloud.read(`${OTHER_ID}/${recordFolder('post/한글')}/x.png`), /경로 권한/);
  await assert.rejects(() => cloud.remove([`${OTHER_ID}/${recordFolder('post/한글')}/x.png`]), /경로 권한/);
});

test('lists more than one page and enforces photo count limit', async () => {
  const prefix = `${USER_ID}/${recordFolder('busy')}/`;
  const objects = new Map(Array.from({ length: MAX_PHOTOS }, (_, index) => [`${prefix}${String(index).padStart(3, '0')}.png`, pngBlob()]));
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: signedInFetch({ objects }), sessionStorage: memorySession() });
  await cloud.signIn('owner@example.com', 'pw');
  assert.equal((await cloud.list('busy')).length, MAX_PHOTOS);
  assert.equal((await cloud.upload('busy', pngBlob(), '000.png')).path, `${prefix}000.png`);
  await assert.rejects(() => cloud.upload('busy', pngBlob(), 'overflow.png'), /10장/);

  const manyPrefix = `${USER_ID}/${recordFolder('many')}/`;
  const many = new Map(Array.from({ length: 125 }, (_, index) => [`${manyPrefix}${String(index).padStart(3, '0')}.png`, pngBlob()]));
  const manyCloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: signedInFetch({ objects: many }), sessionStorage: memorySession() });
  await manyCloud.signIn('owner@example.com', 'pw');
  assert.equal((await manyCloud.list('many')).length, 125);
});

test('uses neutral bad-request errors for upload races', async () => {
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: signedInFetch({ rejectUploads: true }), sessionStorage: memorySession() });
  await cloud.signIn('owner@example.com', 'pw');
  await assert.rejects(() => cloud.upload('race', pngBlob(), 'new.png'), /요청/);
});

test('refreshes JWT once across concurrent authenticated requests', async () => {
  const expired = {
    access_token: jwt({ sub: USER_ID, email: 'owner@example.com', exp: Math.floor(Date.now() / 1000) - 10 }),
    refresh_token: 'refresh-old',
    expires_at: Date.now() - 1000,
    user: { id: USER_ID, email: 'owner@example.com' }
  };
  const storage = memorySession();
  storage.setItem('sns-kang88:supabase-photo-session:https://demo.supabase.co', JSON.stringify(expired));
  const fetchImpl = signedInFetch();
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl, sessionStorage: storage });
  await Promise.all([cloud.restore(), cloud.restore()]);
  assert.equal(fetchImpl.calls.filter(call => call.url.includes('grant_type=refresh_token')).length, 1);
  assert.equal(cloud.user.id, USER_ID);
});

test('restore failure clears unusable stored sessions', async () => {
  const session = {
    access_token: jwt({ sub: USER_ID, email: 'owner@example.com', exp: Math.floor(Date.now() / 1000) + 3600 }),
    refresh_token: 'refresh-old',
    expires_at: Date.now() + 3600_000,
    user: { id: USER_ID, email: 'owner@example.com' }
  };
  const storage = memorySession();
  storage.setItem('sns-kang88:supabase-photo-session:https://demo.supabase.co', JSON.stringify(session));
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: signedInFetch({ ownerAllowed: false }), sessionStorage: storage });
  await assert.rejects(() => cloud.restore(), /관리자 권한/);
  assert.equal(cloud.user, null);
  assert.equal(storage.raw().size, 0);
});

test('clearRecord deletes only owned listed photos and signOut does not delete cloud objects', async () => {
  const prefix = `${USER_ID}/${recordFolder('draft')}/`;
  const objects = new Map([
    [`${prefix}a.png`, pngBlob()],
    [`${prefix}b.png`, pngBlob()],
    [`${OTHER_ID}/${recordFolder('draft')}/c.png`, pngBlob()]
  ]);
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl: signedInFetch({ objects }), sessionStorage: memorySession() });
  await cloud.signIn('owner@example.com', 'pw');
  await cloud.signOut();
  assert.equal(objects.size, 3);
  await cloud.signIn('owner@example.com', 'pw');
  assert.equal(await cloud.clearRecord('draft'), 2);
  assert.deepEqual([...objects.keys()], [`${OTHER_ID}/${recordFolder('draft')}/c.png`]);
});

test('signOut uses local scope and clearRecord detects partial deletion', async () => {
  const prefix = `${USER_ID}/${recordFolder('draft')}/`;
  const objects = new Map([
    [`${prefix}a.png`, pngBlob()],
    [`${prefix}b.png`, pngBlob()]
  ]);
  const fetchImpl = signedInFetch({ objects, partialDelete: true });
  const cloud = createPhotoCloud({ url: 'https://demo.supabase.co', publishableKey: jwt({ role: 'anon' }) }, { fetchImpl, sessionStorage: memorySession() });
  await cloud.signIn('owner@example.com', 'pw');
  await cloud.signOut();
  assert.ok(fetchImpl.calls.some(call => call.url.includes('/auth/v1/logout?scope=local')));
  await cloud.signIn('owner@example.com', 'pw');
  await assert.rejects(() => cloud.clearRecord('draft'), /삭제되지 않은 사진/);
});
