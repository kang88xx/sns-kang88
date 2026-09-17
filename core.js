export const CHANNELS = [
  { id: 'linkedin', label: 'LinkedIn', short: 'in', color: '#0a66c2', composeUrl: 'https://www.linkedin.com/feed/' },
  { id: 'x', label: 'X', short: 'X', color: '#1f1f1f', composeUrl: 'https://x.com/compose/post' },
  { id: 'threads', label: 'Threads', short: 'Th', color: '#444746', composeUrl: 'https://www.threads.net/' },
  { id: 'instagram', label: 'Instagram', short: 'Ig', color: '#b32679', composeUrl: 'https://www.instagram.com/' },
  { id: 'youtube', label: 'YouTube', short: 'YT', color: '#ff0000', composeUrl: 'https://studio.youtube.com/' },
  { id: 'blog', label: '블로그', short: 'B', color: '#188038', composeUrl: '' },
  { id: 'other', label: '기타', short: '·', color: '#5f6368', composeUrl: '' },
];
export const STATUSES = [
  { id: 'idea', label: '보관', tone: 'neutral' },
  { id: 'draft', label: '작성 중', tone: 'amber' },
  { id: 'ready', label: '준비 완료', tone: 'purple' },
  { id: 'planned', label: '게시 예정', tone: 'blue' },
  { id: 'published', label: '발행 완료', tone: 'green' },
];
export const DATE_MIN = '1900-01-01';
export const DATE_MAX = '2100-12-31';
const dayMs = 86400000;
export function todayKey(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function addDays(date, n) {
  if (!isValidDate(date) || !Number.isInteger(n)) throw new Error('날짜를 확인해 주세요.');
  const result = new Date(Date.parse(`${date}T00:00:00Z`) + n * dayMs).toISOString().slice(0, 10);
  if (!isValidDate(result)) throw new Error('지원하지 않는 날짜입니다.');
  return result;
}
export function shiftMonth(month, n) {
  if (!isValidDate(`${month}-01`) || !Number.isInteger(n)) throw new Error('월을 확인해 주세요.');
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + n);
  const result = date.toISOString().slice(0, 7);
  if (!isValidDate(`${result}-01`)) throw new Error('지원하지 않는 월입니다.');
  return result;
}
export function weekRange(date) {
  if (!isValidDate(date)) throw new Error('날짜를 확인해 주세요.');
  const start = addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
  return { start, end: addDays(start, 6) };
}
export function monthGrid(month, { compact = false } = {}) {
  const start = weekRange(`${month}-01`).start;
  const last = compact ? weekRange(addDays(`${shiftMonth(month, 1)}-01`, -1)).end : '';
  const length = compact ? (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayMs + 1 : 42;
  return Array.from({ length }, (_, i) => addDays(start, i));
}
function field(value, label, max, trim = false) {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new Error(`${label} 형식을 확인해 주세요.`);
  const result = trim ? value.trim() : value;
  if (result.length > max) throw new Error(`${label}은 ${max.toLocaleString('ko-KR')}자 이내로 입력해 주세요.`);
  return result;
}
export function normalizePost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('게시물 형식을 확인해 주세요.');
  const title = field(input.title, '제목', 160, true);
  if (!title) throw new Error('제목을 입력해 주세요.');
  if (!CHANNELS.some(c => c.id === input.platform)) throw new Error('채널을 선택해 주세요.');
  if (!STATUSES.some(s => s.id === input.status)) throw new Error('상태를 선택해 주세요.');
  if (!['ko', 'en', 'zh', 'multi'].includes(input.language)) throw new Error('언어를 선택해 주세요.');
  const date = field(input.date, '날짜', 10);
  const time = field(input.time, '시간', 5);
  if (date && !isValidDate(date)) throw new Error('올바른 날짜를 입력해 주세요.');
  if (date && (date < DATE_MIN || date > DATE_MAX)) throw new Error('날짜는 1900년부터 2100년 사이로 입력해 주세요.');
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('올바른 시간을 입력해 주세요.');
  if (['planned', 'published'].includes(input.status) && !date) throw new Error('계획·발행 완료 게시물에는 날짜가 필요합니다.');
  const url = field(input.url, '링크', 5000, true);
  if (url) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('올바른 http 또는 https 링크를 입력해 주세요.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('http 또는 https 링크만 사용할 수 있습니다.');
  }
  const now = new Date().toISOString();
  const id = input.id === undefined ? globalThis.crypto.randomUUID() : field(input.id, '게시물 ID', 200, true);
  if (!id) throw new Error('게시물 ID가 비어 있습니다.');
  const timestamps = {};
  for (const key of ['createdAt', 'updatedAt']) {
    const value = input[key] === undefined ? now : input[key];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('게시물 저장 시각을 확인해 주세요.');
    timestamps[key] = new Date(value).toISOString();
  }
  return { id, title, platform: input.platform, status: input.status, date, time, language: input.language,
    text: field(input.text, '본문', 50000), url, notes: field(input.notes, '메모', 50000), ...timestamps };
}
export function filterPosts(posts, { platform = 'all', status = 'all', query = '', from = '', to = '' } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return posts.filter(p => (platform === 'all' || p.platform === platform) && (status === 'all' || p.status === status) &&
    (!from || (p.date && p.date >= from)) && (!to || (p.date && p.date <= to)) &&
    (!needle || [p.title, p.text, p.notes, p.url].some(v => v.toLocaleLowerCase().includes(needle))))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}
export function getStats(posts, today = todayKey()) {
  const { start, end } = weekRange(today);
  const published = posts.filter(p => p.status === 'published' && p.date && p.date <= today);
  const days = new Set(published.map(p => p.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  return { weekPublished: published.filter(p => p.date >= start && p.date <= end).length,
    weekPlanned: posts.filter(p => p.status === 'planned' && p.date >= start && p.date <= end).length,
    draftCount: posts.filter(p => p.status === 'draft').length, publishedCount: published.length, streak };
}
