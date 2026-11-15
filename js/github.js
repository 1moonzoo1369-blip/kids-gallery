// GitHub 저장소 읽기/쓰기 + 업로드 토큰 암호화
(function () {
  const API = 'https://api.github.com';
  const cfg = () => window.GALLERY_CONFIG || null;
  const TOKEN_KEY = 'kg_token_v1';

  // ---------- 암호화 (비밀번호 → AES-GCM) ----------
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const ITER = 600000;

  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptToken(token, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
    return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) };
  }
  async function decryptToken(box, password) {
    const key = await deriveKey(password, unb64(box.salt));
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.data));
    return dec.decode(data);
  }

  // ---------- 토큰 보관 (이 기기) ----------
  function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} }

  async function unlock(password) {
    const c = cfg();
    if (!c || !c.enc) throw new Error('아직 설정(setup.html)이 안 되어 있어요.');
    let token;
    try { token = await decryptToken(c.enc, password); }
    catch { throw new Error('비밀번호가 맞지 않아요.'); }
    setToken(token);
    return true;
  }

  // ---------- API ----------
  function repoPath(p) { const c = cfg(); return `${API}/repos/${c.owner}/${c.repo}${p}`; }
  async function gh(path, opts = {}, token = getToken()) {
    const headers = { Accept: 'application/vnd.github+json', ...(opts.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body && typeof opts.body !== 'string') { opts.body = JSON.stringify(opts.body); headers['Content-Type'] = 'application/json'; }
    // '/repos/...' 처럼 전체 API 경로면 그대로, '/git/...' 같은 짧은 경로면 이 레포 기준으로
    const url = path.startsWith('http') ? path : path.startsWith('/repos/') ? API + path : repoPath(path);
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) { setToken(null); throw Object.assign(new Error('업로드 권한이 만료됐어요. 잠금을 다시 풀어주세요.'), { status: 401 }); }
    if (!res.ok) {
      let msg = ''; try { msg = (await res.json()).message; } catch {}
      throw Object.assign(new Error(msg || `GitHub 오류 ${res.status}`), { status: res.status });
    }
    return res.status === 204 ? null : res.json();
  }

  const EMPTY = () => ({ version: 1, children: [], drawings: [] });

  // data.json 읽기: API(즉시 반영) → 실패하면 사이트에 배포된 파일
  async function readData() {
    const c = cfg();
    if (c && c.owner) {
      try {
        const res = await fetch(repoPath(`/contents/data.json?ref=${c.branch || 'main'}&t=${Date.now()}`), {
          headers: { Accept: 'application/vnd.github.raw+json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
          cache: 'no-store',
        });
        if (res.ok) return normalize(await res.json());
        if (res.status === 404) return EMPTY();
      } catch {}
    }
    try {
      const res = await fetch(`data.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) return normalize(await res.json());
    } catch {}
    return EMPTY();
  }
  function normalize(d) { d = d || {}; return { version: 1, children: d.children || [], drawings: d.drawings || [] }; }

  // 바이너리 → base64
  function blobToB64(blob) {
    return new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = no; r.readAsDataURL(blob);
    });
  }
  function utf8ToB64(s) { return b64(enc.encode(s)); }

  async function createBlob(blob) {
    const res = await gh('/git/blobs', { method: 'POST', body: { content: await blobToB64(blob), encoding: 'base64' } });
    return res.sha;
  }

  // 한 번의 커밋으로 data.json + 파일 변경을 같이 저장.
  // mutate(data) 는 최신 data.json을 받아 수정하고 { entries:[{path, sha|null}], message } 를 돌려준다.
  async function commit(mutate) {
    const branch = cfg().branch || 'main';
    for (let attempt = 0; attempt < 4; attempt++) {
      const ref = await gh(`/git/ref/heads/${branch}`);
      const head = ref.object.sha;
      const headCommit = await gh(`/git/commits/${head}`);
      let data;
      try {
        const res = await fetch(repoPath(`/contents/data.json?ref=${head}`), {
          headers: { Accept: 'application/vnd.github.raw+json', Authorization: `Bearer ${getToken()}` }, cache: 'no-store' });
        data = res.ok ? normalize(await res.json()) : EMPTY();
      } catch { data = EMPTY(); }

      const { entries = [], message } = await mutate(data);
      const dataBlob = await gh('/git/blobs', { method: 'POST', body: { content: utf8ToB64(JSON.stringify(data, null, 2) + '\n'), encoding: 'base64' } });
      const tree = await gh('/git/trees', { method: 'POST', body: {
        base_tree: headCommit.tree.sha,
        tree: [
          ...entries.map((e) => ({ path: e.path, mode: '100644', type: 'blob', sha: e.sha })),
          { path: 'data.json', mode: '100644', type: 'blob', sha: dataBlob.sha },
        ],
      } });
      const newCommit = await gh('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [head] } });
      try {
        await gh(`/git/refs/heads/${branch}`, { method: 'PATCH', body: { sha: newCommit.sha, force: false } });
        return data;
      } catch (e) {
        if (e.status === 422 || e.status === 409) continue; // 그 사이 다른 사람이 저장함 → 최신 상태로 다시
        throw e;
      }
    }
    throw new Error('동시에 저장하는 사람이 있어 실패했어요. 잠시 후 다시 해주세요.');
  }

  function rawUrl(path) {
    const c = cfg();
    return c && c.owner ? `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch || 'main'}/${path}` : path;
  }

  window.GH = { encryptToken, decryptToken, unlock, getToken, setToken, gh, readData, createBlob, commit, rawUrl, utf8ToB64,
    configured: () => !!(cfg() && cfg().owner && cfg().enc) };
})();
