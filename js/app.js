// 우리 아이 그림앨범 — 화면
(function () {
  const $app = document.getElementById('app');
  const PAGE = 10; // 한 벽면에 거는 그림 수
  const DEMO = new URLSearchParams(location.search).has('demo');
  const state = { data: null, local: {} }; // local: 방금 올린 그림의 로컬 미리보기 URL

  // ---------- 작은 도우미 ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = (d) => { const [y, m, dd] = d.split('-').map(Number); const w = new Date(y, m - 1, dd).getDay(); return `${y}. ${pad(m)}. ${pad(dd)}. (${WD[w]})`; };
  const todayStr = (t = new Date()) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  const icon = {
    left: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    note: '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
    click: '<svg viewBox="0 0 24 24"><path d="M9 9l11 4-5 2-2 5z"/><path d="M5 3l1 2M3 7l2 0M9 3v2"/></svg>',
  };
  const canEdit = () => !DEMO && !!GH.getToken();
  const FRAMES = ['f-gold', 'f-champ', 'f-wood'];
  const frameCls = (k) => FRAMES[((k % 3) + 3) % 3];
  const childFrame = (c) => ({ gold: 'f-gold', champ: 'f-champ', wood: 'f-wood' }[c.frame] || 'f-gold');
  // 스티커 아이콘: 직접 고른 것 → 제목 낱말 → 순서대로
  const ICONS = { rainbow: '무지개', heart: '하트', paw: '발자국', wave: '물결', star: '별', tree: '나무', snow: '눈송이', cake: '케이크', flower: '꽃', rocket: '로켓', car: '자동차', palette: '팔레트' };
  const KEYWORDS = [
    [/무지개/, 'rainbow'], [/엄마|아빠|가족|사랑|하트|친구|할머니|할아버지|언니|오빠|누나|형|동생/, 'heart'],
    [/공룡|동물|강아지|고양이|토끼|곰|사자|호랑이|새|펭귄/, 'paw'], [/바다|물|고래|물고기|강|비/, 'wave'],
    [/우주|별|달|밤|행성/, 'star'], [/로켓|비행기|기차/, 'rocket'], [/자동차|차|버스|트럭/, 'car'],
    [/눈|겨울|크리스마스|산타/, 'snow'], [/생일|케이크|파티|축하/, 'cake'], [/꽃|봄|정원/, 'flower'],
    [/나무|숲|집|산|소풍|공원/, 'tree'],
  ];
  const ICON_CYCLE = ['palette', 'heart', 'star', 'flower', 'rainbow', 'tree'];
  function stickerIcon(d, k = 0) {
    if (d.icon && ICONS[d.icon]) return d.icon;
    const hit = KEYWORDS.find(([re]) => re.test(d.title || ''));
    return hit ? hit[1] : ICON_CYCLE[k % ICON_CYCLE.length];
  }
  const HINT_KEY = 'kg_hint_off';
  const hintOff = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };

  function toast(msg, ms = 2600) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
  }

  // 그림 주소: 방금 올린 것 → 로컬 미리보기, 아니면 사이트 파일 (아직 배포 전이면 GitHub 원본으로 대체)
  function src(path) { return state.local[path] || (DEMO ? `demo/${path}` : path); }
  window.__imgFallback = (img) => {
    if (img.dataset.fb || DEMO) return;
    img.dataset.fb = '1';
    img.src = GH.rawUrl(img.dataset.path);
  };
  const imgTag = (path, cls, alt) => `<img class="${cls}" src="${esc(src(path))}" data-path="${esc(path)}" alt="${esc(alt)}" loading="lazy" onerror="__imgFallback(this)">`;

  // ---------- 데이터 ----------
  const childOf = (id) => state.data.children.find((c) => c.id === id);
  const sortKey = (d) => `${d.date}_${pad(d.n || 0)}`;
  const drawingsOf = (cid) => state.data.drawings.filter((d) => d.child === cid).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const pathsFor = (child, date, n) => {
    const [y, m] = date.split('-');
    const name = `${date}_${pad(n)}.jpg`;
    return { file: `drawings/${child}/${y}/${m}/${name}`, thumb: `thumbs/${child}/${y}/${m}/${name}` };
  };
  const nextN = (data, child, date) => Math.max(0, ...data.drawings.filter((d) => d.child === child && d.date === date).map((d) => d.n || 0)) + 1;

  async function load() {
    if (DEMO) {
      const r = await fetch('demo/data.json', { cache: 'no-store' });
      state.data = await r.json();
    } else {
      state.data = await GH.readData();
    }
  }

  // ---------- 라우팅 ----------
  function parse() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    return parts;
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  window.addEventListener('hashchange', render);

  function render() {
    if (!state.data) return;
    const p = parse();
    document.getElementById('homeBtn').hidden = !p.length;
    document.getElementById('uploadBtn').hidden = !(canEdit() && state.data.children.length);
    document.getElementById('settingsBtn').hidden = !canEdit();
    updateLock();
    window.scrollTo({ top: 0 });
    if (p[0] === 'g' && childOf(p[1])) return renderGallery(p[1], +p[2], +p[3], +p[4] || 1);
    if (p[0] === 'd' && childOf(p[1])) return renderDetail(p[1], p[2]);
    renderStart();
  }

  function setBrand(text) {
    document.getElementById('brandTitle').textContent = text;
    document.title = text;
  }

  // ---------- 시작 화면: 누구의 갤러리? ----------
  function renderStart() {
    setBrand('우리 아이 그림앨범');
    const kids = state.data.children.map((c) => {
      const list = drawingsOf(c.id);
      const last = list[list.length - 1];
      const art = c.photo ? imgTag(c.photo, 'art', `${c.name} 사진`)
        : last ? imgTag(last.thumb, 'art', c.name) : `<img class="art" src="assets/easel.webp" alt="" style="object-fit:contain;padding:18px">`;
      return `<a class="kid" href="#/g/${esc(c.id)}">
        ${canEdit() ? `<button class="kid-edit" data-edit="${esc(c.id)}" title="${esc(c.name)} 정보·사진 바꾸기" aria-label="${esc(c.name)} 정보·사진 바꾸기">${icon.pen}</button>` : ''}
        <span class="frame ${childFrame(c)}"><span class="mat">${art}</span></span>
        <div class="plate">${esc(c.name)}의 갤러리</div>
        <div class="meta">작품 ${list.length}점${last ? ` · 최근 ${last.date.replaceAll('-', '.')}` : ''}</div>
      </a>`;
    }).join('');
    const add = canEdit() ? `<button class="kid add" id="addKid">
        <span class="frame f-wood"><span class="mat"><span>${icon.plus}아이 추가</span></span></span>
        <div class="plate" style="background:#efe1cd">새 갤러리</div></button>` : '';
    const empty = !state.data.children.length && !canEdit()
      ? `<div class="empty-wall"><img src="assets/easel.webp" alt=""><p>아직 갤러리가 없어요.<br>오른쪽 위 자물쇠를 눌러 업로드 잠금을 풀고 아이를 추가해 주세요.</p></div>` : '';
    $app.innerHTML = `<section class="wall start">
      ${lamps()}
      <div class="wall-title"><div class="t"><img src="assets/laurel.webp" alt=""> 누구의 갤러리로 갈까요? <img class="flip" src="assets/laurel.webp" alt=""></div>${divider()}</div>
      <div class="kids">${kids}${add}</div>${empty}
      <div class="floor"></div></section>`;
    const a = document.getElementById('addKid');
    if (a) a.onclick = () => openChildForm();
    $app.querySelectorAll('.kid-edit').forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openChildForm(childOf(b.dataset.edit)); });
  }

  const divider = () => `<div class="divider"><i></i><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg><i></i></div>`;
  function stickerHtml(d, k) {
    const ic = stickerIcon(d, k);
    const t = esc(d.title || '제목 없음');
    return `<span class="sticker ${(d.title || '').length > 4 ? 'long' : ''}" style="--tilt:${[-4, 3, -2, 4, -3][k % 5]}deg">
      <img class="ic" src="assets/icons/${ic}.webp" alt=""><span class="st">${t}</span></span>`;
  }
  function lamps() {
    return `<div class="track"><div class="lamps">${'<span class="spot"><img src="assets/track-light.webp" alt=""></span>'.repeat(5)}</div></div>`;
  }

  // ---------- 갤러리 (년·월 전시실) ----------
  function renderGallery(cid, y, m, page) {
    const child = childOf(cid);
    setBrand(`${child.name}의 그림앨범`);
    const all = drawingsOf(cid);
    const now = new Date();
    const years = [...new Set([...all.map((d) => +d.date.slice(0, 4)), now.getFullYear()])].sort((a, b) => a - b);
    if (!y || !m) { // 기본: 가장 최근 그림이 있는 달
      const last = all[all.length - 1];
      if (last) { y = +last.date.slice(0, 4); m = +last.date.slice(5, 7); } else { y = now.getFullYear(); m = now.getMonth() + 1; }
      history.replaceState(null, '', `#/g/${cid}/${y}/${m}`);
    }
    if (!years.includes(y)) years.push(y), years.sort((a, b) => a - b);
    const inYear = all.filter((d) => +d.date.slice(0, 4) === y);
    const counts = Array.from({ length: 12 }, (_, i) => inYear.filter((d) => +d.date.slice(5, 7) === i + 1).length);
    const list = inYear.filter((d) => +d.date.slice(5, 7) === m);
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    page = Math.min(Math.max(1, page), pages);
    const shown = list.slice((page - 1) * PAGE, page * PAGE);
    const yi = years.indexOf(y);
    const latestMonthOf = (yy) => { const l = all.filter((d) => +d.date.slice(0, 4) === yy); return l.length ? +l[l.length - 1].date.slice(5, 7) : (yy === now.getFullYear() ? now.getMonth() + 1 : 1); };

    const months = counts.map((c, i) => `<button class="month ${i + 1 === m ? 'on' : ''} ${c ? '' : 'empty'}" data-m="${i + 1}">${i + 1}월${c ? `<span class="cnt">${c}</span>` : ''}</button>`).join('');
    const pieces = shown.map((d, i) => `
      <button class="piece" data-id="${esc(d.id)}" aria-label="${esc(d.title)} 크게 보기">
        <span class="frame ${frameCls(i + (page - 1) * PAGE)}"><span class="mat">${imgTag(d.thumb, 'art', d.title)}</span></span>
        ${stickerHtml(d, i + (page - 1) * PAGE)}
      </button>`).join('');
    const pager = list.length > PAGE ? `
      <div class="pager">
        <button class="pill-btn" id="prevWall" ${page <= 1 ? 'disabled' : ''}>${icon.left}<span>이전 벽면</span></button>
        <div class="dots">${Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? 'on' : ''}" data-p="${i + 1}" aria-label="${i + 1}번째 벽면"></button>`).join('')}</div>
        <button class="pill-btn" id="nextWall" ${page >= pages ? 'disabled' : ''}><span>다음 벽면</span>${icon.right}</button>
      </div>
      <div class="room-no">전시실 ${page} / ${pages} · 이 달의 작품 ${list.length}점</div>` : '';
    const body = list.length
      ? `<div class="grid">${pieces}</div>${pager}${hintOff() ? '' : `<div class="hint-box" id="hintBox"><div class="hint">${icon.click} 그림을 클릭하면 더 크고 자세히 볼 수 있어요!</div>
         <label class="hint-off"><input type="checkbox" id="hintOff"> 다시 보지 않기</label></div>`}`
      : `<div class="empty-wall"><img src="assets/easel.webp" alt=""><p>${y}년 ${m}월에는 아직 걸린 그림이 없어요.</p>
         ${canEdit() ? `<button class="pill-btn primary" id="emptyUpload">${icon.plus}<span>이 달에 그림 올리기</span></button>` : ''}</div>`;

    $app.innerHTML = `
      <div class="tabs-wrap">
        <div class="year-row">
          <button class="arrow" id="prevYear" ${yi <= 0 ? 'disabled' : ''} aria-label="이전 해">${icon.left}</button>
          <span class="yr">${y}년</span>
          <button class="arrow" id="nextYear" ${yi >= years.length - 1 ? 'disabled' : ''} aria-label="다음 해">${icon.right}</button>
        </div>
        <div class="month-row">${months}</div>
      </div>
      <section class="wall">
        ${lamps()}
        <div class="wall-title"><div class="t"><img src="assets/laurel.webp" alt=""> ${m}월의 그림 갤러리 <img class="flip" src="assets/laurel.webp" alt=""></div>${divider()}</div>
        ${body}
        <div class="floor"></div>
      </section>`;

    const base = `#/g/${cid}`;
    $app.querySelectorAll('.month').forEach((b) => b.onclick = () => go(`${base}/${y}/${b.dataset.m}`));
    $app.querySelector('#prevYear').onclick = () => { const yy = years[yi - 1]; go(`${base}/${yy}/${latestMonthOf(yy)}`); };
    $app.querySelector('#nextYear').onclick = () => { const yy = years[yi + 1]; go(`${base}/${yy}/${latestMonthOf(yy)}`); };
    $app.querySelectorAll('.piece').forEach((b) => b.onclick = () => go(`#/d/${cid}/${b.dataset.id}`));
    const pw = $app.querySelector('#prevWall'), nw = $app.querySelector('#nextWall');
    if (pw) pw.onclick = () => go(`${base}/${y}/${m}/${page - 1}`);
    if (nw) nw.onclick = () => go(`${base}/${y}/${m}/${page + 1}`);
    $app.querySelectorAll('.dots button').forEach((b) => b.onclick = () => go(`${base}/${y}/${m}/${b.dataset.p}`));
    const ho = $app.querySelector('#hintOff');
    if (ho) ho.onchange = () => {
      if (!ho.checked) return;
      try { localStorage.setItem(HINT_KEY, '1'); } catch {}
      const box = $app.querySelector('#hintBox'); box.classList.add('bye');
      setTimeout(() => box.remove(), 350);
    };
    const eu = $app.querySelector('#emptyUpload');
    if (eu) eu.onclick = () => openUpload({ child: cid, date: `${y}-${pad(m)}-${pad(Math.min(now.getDate(), 28))}` });
    // 가로 스크롤 탭에서 선택된 달 보이게
    $app.querySelector('.month.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    window.scrollTo({ top: 0 });
  }

  // ---------- 상세 (크게 보기) ----------
  function renderDetail(cid, id) {
    const child = childOf(cid);
    const all = drawingsOf(cid);
    const i = all.findIndex((d) => d.id === id);
    if (i < 0) return go(`#/g/${cid}`);
    const d = all[i];
    setBrand(`${child.name}의 그림앨범`);
    const y = +d.date.slice(0, 4), m = +d.date.slice(5, 7);
    const monthList = all.filter((x) => x.date.slice(0, 7) === d.date.slice(0, 7));
    const page = Math.floor(monthList.indexOf(d) / PAGE) + 1;
    const backHash = `#/g/${cid}/${y}/${m}${page > 1 ? '/' + page : ''}`;

    $app.innerHTML = `
      <section class="wall detail">
        <a class="pill-btn back" href="${backHash}">${icon.left}<span>갤러리로 돌아가기</span></a>
        <div class="stage">
          <img class="shelf l" src="assets/shelf-left.webp" alt="">
          <img class="shelf r" src="assets/shelf-right.webp" alt="">
          <div class="glow"></div>
          <img class="lamp" src="assets/lamp.webp" alt="">
          <div class="big">
            <img class="laurel" src="assets/laurel.webp" alt="">
            <div style="position:relative">
              <span class="frame ${frameCls(i)}"><span class="mat">${imgTag(d.file, 'art', d.title)}</span></span>
              <button class="nav-arrow prev" id="prevArt" ${i <= 0 ? 'disabled' : ''} aria-label="이전 그림">${icon.left}</button>
              <button class="nav-arrow next" id="nextArt" ${i >= all.length - 1 ? 'disabled' : ''} aria-label="다음 그림">${icon.right}</button>
            </div>
            <img class="laurel r" src="assets/laurel.webp" alt="">
          </div>
        </div>
        <article class="info">
          <div class="info-head">
            <h2>${esc(d.title || '제목 없음')}</h2>
            <span class="date">${icon.cal} ${dateLabel(d.date)}</span>
            ${canEdit() ? `<span class="acts">
              <button class="pill-btn" id="editArt">${icon.pen}<span>수정</span></button>
              <button class="pill-btn danger" id="delArt">${icon.trash}<span>삭제</span></button></span>` : ''}
          </div>
          <div class="info-body">
            <span class="lbl">${icon.note} 내용</span>
            <p class="${d.desc ? '' : 'none'}">${d.desc ? esc(d.desc) : '적어 둔 내용이 없어요.'}</p>
          </div>
        </article>
        <div class="counter">${child.name}의 ${all.length}점 중 ${i + 1}번째 그림 · 키보드 ← → 로도 넘길 수 있어요</div>
        <div class="floor"></div>
      </section>`;
    const goIdx = (k) => { if (all[k]) go(`#/d/${cid}/${all[k].id}`); };
    $app.querySelector('#prevArt').onclick = () => goIdx(i - 1);
    $app.querySelector('#nextArt').onclick = () => goIdx(i + 1);
    renderDetail.keys = (e) => {
      if (document.getElementById('modalBack').hidden === false) return;
      if (e.key === 'ArrowLeft') goIdx(i - 1);
      if (e.key === 'ArrowRight') goIdx(i + 1);
      if (e.key === 'Escape') go(backHash);
    };
    const ed = $app.querySelector('#editArt'), dl = $app.querySelector('#delArt');
    if (ed) ed.onclick = () => openEdit(d);
    if (dl) dl.onclick = () => confirmDelete(d, backHash);
  }
  document.addEventListener('keydown', (e) => { if (parse()[0] === 'd' && renderDetail.keys) renderDetail.keys(e); });

  // ---------- 모달 ----------
  const $back = document.getElementById('modalBack'), $modal = document.getElementById('modal');
  function openModal(html) {
    $modal.innerHTML = html; $back.hidden = false;
    $modal.querySelector('input:not([type=file]), textarea, select')?.focus();
    return $modal;
  }
  function closeModal() { if ($modal.dataset.busy) return; $back.hidden = true; $modal.innerHTML = ''; }
  $back.addEventListener('click', (e) => { if (e.target === $back) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$back.hidden) closeModal(); });
  function busy(on, btn, label) {
    if (on) { $modal.dataset.busy = '1'; btn.disabled = true; btn.dataset.l = btn.textContent; btn.textContent = label; }
    else { delete $modal.dataset.busy; btn.disabled = false; btn.textContent = btn.dataset.l || btn.textContent; }
  }

  // 업로드 잠금
  function updateLock() {
    const b = document.getElementById('lockBtn');
    const on = canEdit();
    b.classList.toggle('unlocked', on);
    b.title = on ? '업로드 가능 (눌러서 이 기기 잠그기)' : '업로드 잠금 해제';
    document.getElementById('lockIcon').innerHTML = on
      ? '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'
      : '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
  }
  document.getElementById('lockBtn').onclick = () => {
    if (DEMO) return toast('미리보기(데모)에서는 업로드할 수 없어요.');
    if (canEdit()) {
      const m = openModal(`<h3>이 기기 잠그기</h3><p class="note">이 기기에서 업로드·수정 권한을 지울까요? 다시 쓰려면 업로드 비밀번호를 입력하면 돼요.</p>
        <div class="row"><button class="pill-btn" data-x>취소</button><button class="pill-btn primary" id="doLock">잠그기</button></div>`);
      m.querySelector('[data-x]').onclick = closeModal;
      m.querySelector('#doLock').onclick = () => { GH.setToken(null); closeModal(); render(); toast('잠갔어요. 이제 보기만 할 수 있어요.'); };
      return;
    }
    if (!GH.configured()) {
      const m = openModal(`<h3>처음 설정이 필요해요</h3><p class="note">아직 업로드 비밀번호가 설정되지 않았어요.<br><b>setup.html</b> 페이지에서 GitHub 토큰과 가족 비밀번호를 한 번만 등록해 주세요.</p>
        <div class="row"><button class="pill-btn" data-x>닫기</button><a class="pill-btn primary" href="setup.html">설정하러 가기</a></div>`);
      m.querySelector('[data-x]').onclick = closeModal;
      return;
    }
    const m = openModal(`<h3>업로드 잠금 풀기</h3>
      <label class="field"><span>가족 업로드 비밀번호</span><input type="password" id="pw" autocomplete="current-password"></label>
      <p class="note">한 번 풀면 이 기기에서는 계속 업로드·수정할 수 있어요.</p>
      <div class="err" id="err"></div>
      <div class="row"><button class="pill-btn" data-x>취소</button><button class="pill-btn primary" id="go">잠금 풀기</button></div>`);
    const btn = m.querySelector('#go');
    const submit = async () => {
      busy(true, btn, '확인 중…');
      try { await GH.unlock(m.querySelector('#pw').value); busy(false, btn); closeModal(); await load(); render(); toast('잠금이 풀렸어요! 이제 그림을 올릴 수 있어요.'); }
      catch (e) { busy(false, btn); m.querySelector('#err').textContent = e.message; }
    };
    btn.onclick = submit;
    m.querySelector('#pw').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    m.querySelector('[data-x]').onclick = closeModal;
  };

  // 아이 추가
  // 설정: 아이 목록 → 이름·사진·액자 수정
  function openSettings() {
    const rows = state.data.children.map((c) => `
      <div class="set-row">
        ${c.photo ? imgTag(c.photo, 'set-photo', c.name) : `<span class="set-photo none">${icon.photo}</span>`}
        <div class="set-name"><b>${esc(c.name)}</b><small>drawings/${esc(c.id)}/ · 작품 ${drawingsOf(c.id).length}점</small></div>
        <button class="pill-btn" data-edit="${esc(c.id)}">${icon.pen}<span>사진·정보 바꾸기</span></button>
      </div>`).join('');
    const m = openModal(`<h3>설정</h3>
      <div class="field"><span>아이 갤러리</span>${rows || '<p class="note">아직 아이가 없어요.</p>'}</div>
      <div class="row" style="justify-content:space-between"><button class="pill-btn" id="addK">${icon.plus}<span>아이 추가</span></button><button class="pill-btn" data-x>닫기</button></div>`);
    m.querySelector('[data-x]').onclick = closeModal;
    m.querySelector('#addK').onclick = () => { closeModal(); openChildForm(); };
    m.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { closeModal(); openChildForm(childOf(b.dataset.edit)); });
  }
  document.getElementById('settingsBtn').onclick = openSettings;

  function openChildForm(child) {
    const edit = !!child; child = child || {};
    const m = openModal(`<h3>${edit ? `${esc(child.name)} 정보 바꾸기` : '아이 추가'}</h3>
      <label class="field"><span>아이 사진 (시작 화면 대표 사진)</span>
        <div class="drop photo-drop" id="pdrop">${child.photo ? `<img src="${esc(src(child.photo))}" alt="">` : `<div>${icon.photo}사진 찍기 / 고르기</div>`}<input type="file" id="pfile" accept="image/*"></div>
        <div class="help">정사각형으로 가운데를 잘라 저장해요. ${edit ? '안 바꾸려면 그대로 두세요.' : '나중에 설정에서 언제든 바꿀 수 있어요.'}</div></label>
      <label class="field"><span>이름 (화면에 보이는 이름)</span><input type="text" id="kname" maxlength="12" placeholder="예: 서윤" value="${esc(child.name || '')}"></label>
      ${edit ? '' : `<label class="field"><span>영문 폴더 이름</span><input type="text" id="kid" maxlength="30" placeholder="예: seoyun" autocapitalize="off" spellcheck="false">
        <div class="help">GitHub에 <b>drawings/<span id="kprev">seoyun</span>/2026/01/…</b> 처럼 저장돼요. 영어 소문자·숫자·- 만, 나중에 바꿀 수 없어요.</div></label>`}
      <label class="field"><span>대표 액자</span><select id="kframe">
        ${[['gold', '금색 액자'], ['champ', '샴페인골드 액자'], ['wood', '나무 액자']].map(([v, t]) => `<option value="${v}" ${child.frame === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="err" id="err"></div>
      <div class="row"><button class="pill-btn" data-x>취소</button><button class="pill-btn primary" id="go">${edit ? '저장하기' : '추가하기'}</button></div>`);
    const idIn = m.querySelector('#kid');
    if (idIn) idIn.oninput = () => { idIn.value = idIn.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); m.querySelector('#kprev').textContent = idIn.value || 'seoyun'; };
    let file = null;
    const fileIn = m.querySelector('#pfile');
    fileIn.onchange = () => {
      file = fileIn.files[0]; if (!file) return;
      const d = m.querySelector('#pdrop');
      d.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="미리보기">`; d.appendChild(fileIn);
    };
    m.querySelector('[data-x]').onclick = closeModal;
    const btn = m.querySelector('#go');
    btn.onclick = async () => {
      const name = m.querySelector('#kname').value.trim(), frame = m.querySelector('#kframe').value;
      const id = edit ? child.id : idIn.value.trim();
      const err = m.querySelector('#err');
      if (!name) return err.textContent = '이름을 적어 주세요.';
      if (!/^[a-z0-9][a-z0-9-]{0,29}$/.test(id)) return err.textContent = '영문 폴더 이름을 영어 소문자/숫자로 적어 주세요.';
      try {
        let photo = null;
        if (file) {
          busy(true, btn, '사진 줄이는 중…');
          const sq = await cropSquare(await loadBitmap(file), 800);
          btn.textContent = 'GitHub에 저장 중…';
          photo = { blob: sq, sha: await GH.createBlob(sq), path: `profiles/${id}_${Date.now()}.jpg` };
        } else busy(true, btn, '저장 중…');
        state.data = await GH.commit(async (data) => {
          let c = data.children.find((x) => x.id === id);
          if (!edit) {
            if (c) throw new Error('같은 폴더 이름의 아이가 이미 있어요.');
            c = { id, createdAt: new Date().toISOString() }; data.children.push(c);
          } else if (!c) throw new Error('이 아이 정보를 찾을 수 없어요.');
          const entries = [];
          if (photo) {
            if (c.photo) entries.push({ path: c.photo, sha: null }); // 예전 사진은 지움
            entries.push({ path: photo.path, sha: photo.sha });
            c.photo = photo.path;
          }
          Object.assign(c, { name, frame, updatedAt: new Date().toISOString() });
          return { entries, message: edit ? `아이 정보 수정: ${name} (${id})${photo ? ' + 사진' : ''}` : `아이 추가: ${name} (${id})` };
        });
        if (photo) state.local[photo.path] = URL.createObjectURL(photo.blob);
        busy(false, btn); closeModal(); render();
        toast(edit ? `${name} 정보를 바꿨어요.` : `${name}의 갤러리를 만들었어요!`);
      } catch (e) { busy(false, btn); err.textContent = e.message; }
    };
  }

  // 가운데를 정사각형으로 잘라 JPG로
  function cropSquare(bmp, size) {
    const side = Math.min(bmp.width, bmp.height), out = Math.min(size, side);
    const c = document.createElement('canvas'); c.width = c.height = out;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out);
    return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
  }

  // 사진 줄이기 (긴 변 2000px JPG + 640px 썸네일)
  async function loadBitmap(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      return await new Promise((ok, no) => {
        const img = new Image(); img.onload = () => ok(img); img.onerror = () => no(new Error('이 사진 형식은 열 수 없어요. (아이폰 HEIC라면 JPG로 바꾸거나 사진 앱에서 공유해 주세요)'));
        img.src = URL.createObjectURL(file);
      });
    }
  }
  function resize(bmp, max, q) {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((ok) => c.toBlob((b) => ok({ blob: b, w: c.width, h: c.height }), 'image/jpeg', q));
  }

  function drawingForm(title, d = {}, withPhoto = true) {
    const kids = state.data.children.map((c) => `<option value="${esc(c.id)}" ${c.id === d.child ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    return `<h3>${title}</h3>
      ${withPhoto ? `<label class="field"><span>그림 사진</span>
        <div class="drop" id="drop"><div>${icon.photo}사진 찍기 / 고르기</div><input type="file" id="file" accept="image/*"></div></label>` : ''}
      ${withPhoto ? `<label class="field"><span>누구 그림?</span><select id="child">${kids}</select></label>` : ''}
      <label class="field"><span>그린 날짜</span><input type="date" id="date" value="${esc(d.date || todayStr())}" max="${todayStr()}"></label>
      <label class="field"><span>제목</span><input type="text" id="title" maxlength="30" placeholder="예: 내가 좋아하는 공룡" value="${esc(d.title || '')}"></label>
      <label class="field"><span>제목 스티커 그림</span><select id="icon"><option value="">자동 (제목 보고 골라요)</option>
        ${Object.entries(ICONS).map(([k, v]) => `<option value="${k}" ${d.icon === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="field"><span>내용 (선택)</span><textarea id="desc" maxlength="1000" placeholder="그림에 담긴 이야기, 아이가 한 말 등을 적어 두세요.">${esc(d.desc || '')}</textarea></label>
      <div class="err" id="err"></div>
      <div class="row"><button class="pill-btn" data-x>취소</button><button class="pill-btn primary" id="go">${withPhoto ? '갤러리에 걸기' : '저장하기'}</button></div>`;
  }

  function openUpload(pre = {}) {
    const p = parse();
    const child = pre.child || (childOf(p[1]) ? p[1] : state.data.children[0]?.id);
    const m = openModal(drawingForm('그림 올리기', { child, date: pre.date }));
    let file = null;
    const fileIn = m.querySelector('#file');
    fileIn.onchange = () => {
      file = fileIn.files[0]; if (!file) return;
      const url = URL.createObjectURL(file);
      m.querySelector('#drop').innerHTML = `<img src="${url}" alt="미리보기">`;
      m.querySelector('#drop').appendChild(fileIn);
      if (!pre.date && file.lastModified) m.querySelector('#date').value = todayStr(new Date(Math.min(file.lastModified, Date.now())));
    };
    m.querySelector('[data-x]').onclick = closeModal;
    const btn = m.querySelector('#go');
    btn.onclick = async () => {
      const err = m.querySelector('#err');
      const cid = m.querySelector('#child').value, date = m.querySelector('#date').value;
      const title = m.querySelector('#title').value.trim(), desc = m.querySelector('#desc').value.trim(), ic = m.querySelector('#icon').value;
      if (!file) return err.textContent = '그림 사진을 골라 주세요.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err.textContent = '날짜를 골라 주세요.';
      if (!title) return err.textContent = '간단한 제목을 적어 주세요.';
      err.textContent = '';
      try {
        busy(true, btn, '사진 줄이는 중…');
        const bmp = await loadBitmap(file);
        const full = await resize(bmp, 2000, 0.86), thumb = await resize(bmp, 640, 0.8);
        btn.textContent = 'GitHub에 저장 중…';
        const [sha, tsha] = await Promise.all([GH.createBlob(full.blob), GH.createBlob(thumb.blob)]);
        let rec;
        state.data = await GH.commit(async (data) => {
          const n = nextN(data, cid, date);
          const paths = pathsFor(cid, date, n);
          const now = new Date().toISOString();
          rec = { id: Math.random().toString(36).slice(2, 10), child: cid, date, n, ...paths, sha, thumbSha: tsha,
            w: full.w, h: full.h, title, desc, icon: ic || undefined, createdAt: now, updatedAt: now };
          data.drawings.push(rec);
          return { entries: [{ path: paths.file, sha }, { path: paths.thumb, sha: tsha }], message: `그림 추가: ${cid} ${date}_${pad(n)} ${title}` };
        });
        state.local[rec.file] = URL.createObjectURL(full.blob);
        state.local[rec.thumb] = URL.createObjectURL(thumb.blob);
        busy(false, btn); closeModal();
        const [y, mo] = date.split('-').map(Number);
        const idx = drawingsOf(cid).filter((x) => x.date.slice(0, 7) === date.slice(0, 7)).findIndex((x) => x.id === rec.id);
        go(`#/g/${cid}/${y}/${mo}${idx >= PAGE ? '/' + (Math.floor(idx / PAGE) + 1) : ''}`);
        toast(`'${title}' 그림을 걸었어요! (${date}_${pad(rec.n)}.jpg)`, 3500);
      } catch (e) { busy(false, btn); err.textContent = e.message; }
    };
  }
  document.getElementById('uploadBtn').onclick = () => openUpload();

  function openEdit(d) {
    const m = openModal(drawingForm('그림 정보 수정', d, false));
    m.querySelector('[data-x]').onclick = closeModal;
    const btn = m.querySelector('#go');
    btn.onclick = async () => {
      const err = m.querySelector('#err');
      const date = m.querySelector('#date').value, title = m.querySelector('#title').value.trim(), desc = m.querySelector('#desc').value.trim(), ic = m.querySelector('#icon').value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err.textContent = '날짜를 골라 주세요.';
      if (!title) return err.textContent = '간단한 제목을 적어 주세요.';
      busy(true, btn, '저장 중…');
      try {
        state.data = await GH.commit(async (data) => {
          const r = data.drawings.find((x) => x.id === d.id);
          if (!r) throw new Error('이 그림이 이미 지워졌어요.');
          const entries = [];
          if (r.date !== date) { // 날짜가 바뀌면 파일 이름도 새 날짜로 옮김
            const n = nextN(data, r.child, date), np = pathsFor(r.child, date, n);
            entries.push({ path: np.file, sha: r.sha }, { path: np.thumb, sha: r.thumbSha }, { path: r.file, sha: null }, { path: r.thumb, sha: null });
            Object.assign(r, { date, n, ...np });
          }
          Object.assign(r, { title, desc, icon: ic || undefined, updatedAt: new Date().toISOString() });
          return { entries, message: `그림 수정: ${r.child} ${r.date}_${pad(r.n)} ${title}` };
        });
        const r = state.data.drawings.find((x) => x.id === d.id);
        if (r.file !== d.file) { state.local[r.file] = state.local[d.file] || GH.rawUrl(r.file); state.local[r.thumb] = state.local[d.thumb] || GH.rawUrl(r.thumb); }
        busy(false, btn); closeModal(); render(); toast('수정했어요.');
      } catch (e) { busy(false, btn); err.textContent = e.message; }
    };
  }

  function confirmDelete(d, backHash) {
    const m = openModal(`<h3>그림 삭제</h3><p class="note">'<b>${esc(d.title)}</b>' (${d.date}) 그림을 갤러리와 GitHub에서 지울까요?<br>
      GitHub 기록(커밋 내역)에는 남아 있어서 꼭 필요하면 되살릴 수 있어요.</p>
      <div class="err" id="err"></div>
      <div class="row"><button class="pill-btn" data-x>취소</button><button class="pill-btn primary" id="go" style="background:var(--danger);border-color:var(--danger)">삭제하기</button></div>`);
    m.querySelector('[data-x]').onclick = closeModal;
    const btn = m.querySelector('#go');
    btn.onclick = async () => {
      busy(true, btn, '삭제 중…');
      try {
        state.data = await GH.commit(async (data) => {
          const r = data.drawings.find((x) => x.id === d.id);
          if (!r) return { entries: [], message: '그림 삭제 (이미 없음)' };
          data.drawings = data.drawings.filter((x) => x.id !== d.id);
          return { entries: [{ path: r.file, sha: null }, { path: r.thumb, sha: null }], message: `그림 삭제: ${r.child} ${r.date}_${pad(r.n)} ${r.title}` };
        });
        busy(false, btn); closeModal(); go(backHash); toast('삭제했어요.');
      } catch (e) { busy(false, btn); m.querySelector('#err').textContent = e.message; }
    };
  }

  // ---------- 시작 ----------
  $app.innerHTML = '<div class="loading">그림을 불러오는 중…</div>';
  load().then(render).catch((e) => { $app.innerHTML = `<div class="loading">불러오지 못했어요: ${esc(e.message)}</div>`; });
})();
