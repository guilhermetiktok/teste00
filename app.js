import { firebaseConfig, ADS } from './firebase-config.js';
const G = 'https://www.gstatic.com/firebasejs/10.12.2/';
const [{ initializeApp }, A, F] = await Promise.all([import(G + 'firebase-app.js'), import(G + 'firebase-auth.js'), import(G + 'firebase-firestore.js')]);
const fb = initializeApp(firebaseConfig), auth = A.getAuth(fb), db = F.getFirestore(fb);

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const h = t => { const d = document.createElement('div'); d.innerHTML = t.trim(); return d.firstChild; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safe = u => /^https?:\/\//.test(u || '') ? esc(u) : '#';
const uniq = a => [...new Map(a.map(x => [x.mal_id, x])).values()];
const J = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const go = x => { location.hash = x; };
const AV = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%238b5cf6' width='1' height='1'/%3E%3C/svg%3E";
let app = $('#app'), user = null, prof = {}, lists = J('av_lists', {});
const LN = { quero: 'Quero assistir', assistindo: 'Assistindo', assistido: 'Já assisti', abandonado: 'Abandonados', favorito: 'Favoritos' };
const lname = s => LN[s] || s.slice(2);
const has = (s, id) => !!lists[s]?.[id];
const toast = (m, t = 'ok') => { const d = h(`<div class="toast ${t}">${esc(m)}</div>`); $('#toasts').append(d); setTimeout(() => d.remove(), 3200); };
const AE = c => ({ 'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/email-already-in-use': 'E-mail já cadastrado.', 'auth/weak-password': 'Senha muito fraca (mínimo 6).', 'auth/popup-closed-by-user': 'Login cancelado.', 'auth/unauthorized-domain': 'Domínio não autorizado no Firebase.', 'auth/invalid-email': 'E-mail inválido.', 'auth/too-many-requests': 'Muitas tentativas. Aguarde.' }[c] || 'Erro: ' + c);

/* ---------- Jikan API com fila (limite 3 req/s), retry e cache ---------- */
let chain = Promise.resolve(), last = 0;
function api(p) {
  const k = 'jk' + p, c = sessionStorage.getItem(k);
  if (c) return Promise.resolve(JSON.parse(c));
  const run = chain.catch(() => {}).then(async () => {
    for (let i = 0; i < 4; i++) {
      await new Promise(r => setTimeout(r, Math.max(0, last + 400 - Date.now())));
      const r = await fetch('https://api.jikan.moe/v4' + p); last = Date.now();
      if (r.status == 429 || r.status >= 500) { await new Promise(r => setTimeout(r, 1200 * (i + 1))); continue; }
      if (!r.ok) throw Error(r.status);
      const j = await r.json();
      try { sessionStorage.setItem(k, JSON.stringify(j)); } catch { sessionStorage.clear(); }
      return j;
    }
    throw Error('API indisponível');
  });
  chain = run; return run;
}

/* ---------- listas (LocalStorage + Firestore) ---------- */
async function saveLists() {
  localStorage.setItem('av_lists', JSON.stringify(lists));
  if (user) try { await F.setDoc(F.doc(db, 'private', user.uid), { lists, pi: !!prof.pi }); } catch { toast('Não foi possível sincronizar com a conta.', 'err'); }
}
function toggle(s, a) {
  lists[s] ??= {};
  if (lists[s][a.id]) delete lists[s][a.id]; else lists[s][a.id] = { t: a.t, img: a.img, g: a.g || [] };
  saveLists(); return has(s, a.id);
}
const topGenre = () => { const c = {}; Object.values(lists).forEach(l => Object.values(l).forEach(i => (i.g || []).forEach(g => c[g] = (c[g] || 0) + 1))); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]; };
const hist = n => { const x = J('av_h', []).filter(i => i.id != n.id); x.unshift({ id: n.id, t: n.t, img: n.img }); localStorage.setItem('av_h', JSON.stringify(x.slice(0, 20))); };

/* ---------- componentes ---------- */
const norm = a => ({ id: a.mal_id, t: a.title || a.name, img: a.images?.webp?.large_image_url || a.images?.jpg?.large_image_url || a.images?.webp?.image_url || a.images?.jpg?.image_url || '', g: (a.genres || []).slice(0, 3).map(x => x.mal_id), sc: a.score, y: a.year || a.aired?.prop?.from?.year, gn: a.genres?.[0]?.name });
const card = (n, x = '', base = '#/anime/', s = 'favorito') => {
  const sub = [n.sc != null && '⭐ ' + n.sc, n.y, n.gn].filter(Boolean).join(' · ');
  return `<a class="card rv" href="${base}${n.id}"><img loading="lazy" decoding="async" src="${esc(n.img)}" alt="${esc(n.t)}"><button class="fav ${has(s, n.id) ? 'on' : ''}" aria-label="Favoritar" data-s="${s}" data-a="${esc(JSON.stringify({ id: n.id, t: n.t, img: n.img, g: n.g }))}">♥</button><div class="ci"><h3>${esc(n.t)}</h3><small>${esc(sub)}</small>${x}</div></a>`;
};
const ad = () => ADS.client ? `<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(ADS.client)}" data-ad-slot="${esc(ADS.slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>` : '<div class="ad">Espaço publicitário</div>';
if (ADS.client) document.head.append(Object.assign(document.createElement('script'), { async: true, crossOrigin: 'anonymous', src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS.client }));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 });
const reveal = () => document.querySelectorAll('.rv:not(.in)').forEach(x => io.observe(x));
const fail = '<p class="empty">API indisponível no momento. <a href="" style="color:var(--ne)">Tentar de novo</a></p>';
async function sec(el, title, path, base = '#/anime/') {
  const s = h(`<section class="sec"><h2>${title}</h2><div class="grid">${'<i class="skel"></i>'.repeat(6)}</div></section>`); el.append(s);
  const g = s.querySelector('.grid');
  try { const d = uniq((await api(path)).data); g.innerHTML = d.length ? d.map(a => card(norm(a), '', base)).join('') : '<p class="empty">Nenhum resultado.</p>'; } catch { g.outerHTML = fail; }
  reveal();
}
const listBtns = n => [...Object.keys(LN), ...Object.keys(lists).filter(k => k.startsWith('c:'))].map(s => `<button class="chip ${has(s, n.id) ? 'on' : ''}" data-s="${s}" data-a="${esc(JSON.stringify({ id: n.id, t: n.t, img: n.img, g: n.g }))}">${esc(lname(s))}</button>`).join('');

/* ---------- comentários e avaliações ---------- */
const BAD = /https?:\/\/|www\.|\.(com|net|ru|xyz|top)\b|porra|caralho|puta\b|fdp|nigger/i;
async function comments(box, key, title, rate = true) {
  box.innerHTML = `<h2>Comunidade</h2>${user ? `<form class="cf"><textarea maxlength="500" required placeholder="Escreva seu comentário (sem links)..."></textarea>${rate ? '<select><option value="">Nota (0 a 10)</option>' + Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i}</option>`).join('') + '</select>' : ''}<button class="btn">Publicar</button></form>` : '<p class="mu">Entre na sua conta para comentar e avaliar. <a href="#/login" style="color:var(--ne)">Entrar</a></p>'}<div class="cl"></div>`;
  const f = box.querySelector('form');
  if (f) f.onsubmit = async e => {
    e.preventDefault(); const t = f.querySelector('textarea').value.trim(), sel = f.querySelector('select');
    if (t.length < 2 || BAD.test(t)) return toast('Conteúdo inválido: sem links ou termos ofensivos.', 'err');
    if (Date.now() - J('av_cd', 0) < 30000) return toast('Aguarde 30s para publicar novamente.', 'err');
    try { await F.addDoc(F.collection(db, 'comments'), { key, t: title, uid: user.uid, name: user.displayName || 'Otaku', text: t, score: sel && sel.value !== '' ? +sel.value : null, ts: F.serverTimestamp() }); localStorage.setItem('av_cd', Date.now()); toast('Publicado!'); comments(box, key, title, rate); }
    catch { toast('Erro ao publicar (verifique as regras do Firestore).', 'err'); }
  };
  const cl = box.querySelector('.cl');
  try {
    const s = await F.getDocs(F.query(F.collection(db, 'comments'), F.where('key', '==', key), F.limit(50)));
    const d = s.docs.map(x => x.data()).sort((a, b) => (b.ts?.seconds || 9e9) - (a.ts?.seconds || 9e9)), sc = d.filter(x => x.score != null);
    cl.innerHTML = (sc.length ? `<p class="gn">Nota da comunidade: ⭐ ${(sc.reduce((s, x) => s + x.score, 0) / sc.length).toFixed(1)} (${sc.length} avaliações)</p>` : '') + (d.map(x => `<div class="cmt"><a href="#/u/${esc(x.uid)}"><b>${esc(x.name)}</b></a>${x.score != null ? ' ⭐' + x.score : ''}<p>${esc(x.text)}</p></div>`).join('') || '<p class="mu">Seja o primeiro a comentar.</p>');
  } catch { cl.innerHTML = '<p class="mu">Comentários indisponíveis (configure o Firestore).</p>'; }
}

/* ---------- páginas ---------- */
async function home(el) {
  if (!localStorage.av_seen) { localStorage.av_seen = 1; toast('Bem-vindo ao AniVerse! 🎌'); }
  const hero = h('<section class="hero skel"></section>'); el.append(hero);
  try {
    const a = (await api('/top/anime?filter=airing&limit=12&sfw=true')).data[0], n = norm(a);
    hero.replaceWith(h(`<section class="hero" style="--bg-img:url('${esc(n.img)}')"><div><span class="tag">🔥 Em destaque</span><h1>${esc(a.title)}</h1><p class="gn">${a.genres.map(g => esc(g.name)).join(' · ')} · ⭐ ${a.score ?? '–'}</p><p>${esc((a.synopsis || '').slice(0, 240))}…</p><a class="btn" href="#/anime/${a.mal_id}">Saiba mais</a></div></section>`));
  } catch { hero.remove(); }
  await sec(el, '🔥 Em alta', '/top/anime?filter=airing&limit=12&sfw=true');
  const g = topGenre();
  await sec(el, g ? '✨ Recomendados para você' : '✨ Você pode gostar', g ? `/anime?genres=${g}&order_by=score&sort=desc&min_score=7&limit=12&sfw=true` : '/top/anime?filter=favorite&limit=12&sfw=true');
  el.append(h(ad()));
  await sec(el, '⭐ Mais populares', '/top/anime?filter=bypopularity&limit=12&sfw=true');
  await sec(el, '🏆 Mais bem avaliados', '/top/anime?limit=12&sfw=true');
  await sec(el, '🆕 Lançamentos recentes', '/seasons/now?limit=12&sfw=true');
  await sec(el, '📅 Próximos lançamentos', '/seasons/upcoming?limit=12&sfw=true');
}

async function animes(el, _, q) {
  const gs = (await api('/genres/anime')).data, f = { q: q.get('q') || '', g: q.get('g') || '' }; let page = 1;
  const form = h(`<form class="filters"><select name="g"><option value="">Gênero</option>${gs.map(x => `<option value="${x.mal_id}" ${x.mal_id == f.g ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select><select name="y"><option value="">Ano</option>${Array.from({ length: 30 }, (_, i) => 2026 - i).map(y => `<option>${y}</option>`).join('')}</select><select name="s"><option value="">Status</option><option value="airing">Em lançamento</option><option value="complete">Finalizado</option></select><select name="o"><option value="popularity:asc">Popularidade</option><option value="score:desc">Avaliação</option><option value="start_date:desc">Mais recentes</option><option value="title:asc">A–Z</option></select></form>`);
  const list = h('<div class="grid"></div>'), more = h('<button class="btn alt more" hidden>Carregar mais</button>');
  async function load(reset) {
    if (reset) { page = 1; list.innerHTML = Array(8).fill('<i class="skel"></i>').join(''); }
    const d = Object.fromEntries(new FormData(form)), [ob, so] = d.o.split(':'), u = new URLSearchParams({ page, limit: 24, sfw: true, order_by: ob, sort: so });
    if (f.q) u.set('q', f.q); if (d.g) u.set('genres', d.g); if (d.s) u.set('status', d.s); if (d.y) { u.set('start_date', d.y + '-01-01'); u.set('end_date', d.y + '-12-31'); }
    more.hidden = true;
    try { const j = await api('/anime?' + u); if (reset) list.innerHTML = ''; list.insertAdjacentHTML('beforeend', uniq(j.data).map(a => card(norm(a))).join('')); if (reset && !j.data.length) list.innerHTML = '<p class="empty">Nenhum anime encontrado.</p>'; more.hidden = !j.pagination.has_next_page; reveal(); }
    catch { list.innerHTML = fail; }
  }
  form.onchange = () => load(true); more.onclick = () => { page++; load(); };
  el.append(h(`<h1>${f.q ? 'Busca: ' + esc(f.q) : 'Catálogo de Animes'}</h1>`), form, list, more, h(ad())); load(true);
}

async function anime(el, id) {
  const a = (await api(`/anime/${+id}/full`)).data, n = norm(a); document.title = a.title + ' · AniVerse'; hist(n);
  el.append(h(`<section class="det"><img src="${esc(n.img)}" alt="${esc(a.title)}"><div><h1>${esc(a.title)}</h1><p class="mu">${esc(a.title_english || '')} ${a.title_japanese ? '· ' + esc(a.title_japanese) : ''}</p><p class="gn">⭐ ${a.score ?? '–'} · ${a.year || '?'} · ${a.episodes ?? '?'} eps · ${esc(a.status)} · ${esc(a.studios.map(s => s.name).join(', ') || '—')}</p><p>${a.genres.map(g => `<a class="chip" href="#/animes?g=${g.mal_id}">${esc(g.name)}</a>`).join('')}</p><p>${esc(a.synopsis || 'Sem sinopse.')}</p><div>${listBtns(n)}</div><p><a class="btn" href="#/assistir/${a.mal_id}">Onde assistir</a></p></div></section>`), h(ad()));
  if (a.background) el.append(h(`<section class="sec"><h2>Curiosidades</h2><p class="about">${esc(a.background)}</p></section>`));
  const cm = h('<section class="sec"></section>'); el.append(cm); comments(cm, 'a' + a.mal_id, a.title);
  try { const c = (await api(`/anime/${a.mal_id}/characters`)).data.sort((x, y) => y.favorites - x.favorites).slice(0, 8); el.append(h(`<section class="sec"><h2>Personagens principais</h2><div class="grid">${c.map(x => card({ id: x.character.mal_id, t: x.character.name, img: x.character.images.webp.image_url, g: [] }, `<small> ${esc(x.role)}</small>`, '#/personagem/', 'cf')).join('')}</div></section>`)); } catch {}
  try { const r = (await api(`/anime/${a.mal_id}/recommendations`)).data.slice(0, 6); if (r.length) el.append(h(`<section class="sec"><h2>Animes semelhantes</h2><div class="grid">${r.map(x => card(norm(x.entry))).join('')}</div></section>`)); } catch {}
  reveal();
}

async function assistir(el, id) {
  if (!id) { el.append(h('<h1>Assistir</h1><p class="mu">Escolha um anime para ver as plataformas oficiais onde ele está disponível.</p>')); return sec(el, 'Em exibição', '/top/anime?filter=airing&limit=24&sfw=true', '#/assistir/'); }
  const a = (await api(`/anime/${+id}/full`)).data, n = norm(a), st = a.streaming || [];
  el.append(h(`<section class="det"><img src="${esc(n.img)}" alt=""><div><h1>${esc(a.title)}</h1><p class="gn">${esc([a.season, a.year].filter(Boolean).join(' ') || 'Temporada n/d')} · ${a.episodes ?? '?'} episódios</p><p>${esc((a.synopsis || '').slice(0, 600))}</p><h2>Plataformas oficiais</h2><p>${st.length ? st.map(s => `<a class="btn sm" style="margin:3px" href="${safe(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`).join('') : 'Não foi possível encontrar uma opção oficial para este anime.'}</p><a class="chip" href="#/anime/${a.mal_id}">Ver detalhes</a></div></section>`), h(ad()));
  try { const e = (await api(`/anime/${a.mal_id}/episodes`)).data; el.append(h(`<section class="sec"><h2>Episódios</h2>${e.length ? e.map(x => `<div class="cmt">${x.mal_id}. ${esc(x.title)} <small class="mu">${esc((x.aired || '').slice(0, 10))}</small></div>`).join('') : '<p class="mu">Sem lista de episódios disponível.</p>'}</section>`)); } catch {}
}

async function temporadas(el, _, q) {
  const m = new Date().getMonth(), ds = ['winter', 'spring', 'summer', 'fall'][Math.floor(m / 3)], y = q.get('y') || new Date().getFullYear(), s = q.get('s') || ds;
  const sel = h(`<form class="filters"><select name="y">${Array.from({ length: 20 }, (_, i) => new Date().getFullYear() + 1 - i).map(v => `<option ${v == y ? 'selected' : ''}>${v}</option>`).join('')}</select><select name="s">${[['winter', 'Inverno'], ['spring', 'Primavera'], ['summer', 'Verão'], ['fall', 'Outono']].map(([v, l]) => `<option value="${v}" ${v == s ? 'selected' : ''}>${l}</option>`).join('')}</select></form>`);
  sel.onchange = () => { const d = Object.fromEntries(new FormData(sel)); go(`#/temporadas?y=${d.y}&s=${d.s}`); };
  el.append(h('<h1>Temporadas</h1>'), sel); await sec(el, `Temporada ${esc(s)} ${esc(y)}`, `/seasons/${encodeURIComponent(y)}/${encodeURIComponent(s)}?limit=24&sfw=true`);
}

async function generos(el) {
  el.append(h('<h1>Gêneros</h1>')); const gs = (await api('/genres/anime')).data;
  el.append(h(`<div>${gs.map(g => `<a class="chip" href="#/animes?g=${g.mal_id}">${esc(g.name)} <small>(${g.count})</small></a>`).join('')}</div>`));
}

async function personagens(el) { el.append(h('<h1>Personagens</h1>')); const g = h('<div class="grid"></div>'); el.append(g, h(ad()));
  const d = (await api('/top/characters?limit=24')).data; g.innerHTML = d.map(c => card({ id: c.mal_id, t: c.name, img: c.images.webp.image_url, g: [] }, `<small>❤ ${c.favorites}</small>`, '#/personagem/', 'cf')).join(''); reveal(); }

async function personagem(el, id) {
  const c = (await api(`/characters/${+id}/full`)).data; document.title = c.name + ' · AniVerse';
  el.append(h(`<section class="det"><img src="${esc(c.images.webp.image_url)}" alt=""><div><h1>${esc(c.name)}</h1><p class="mu">${esc((c.nicknames || []).join(', '))}</p><p class="gn">Anime: ${(c.anime || []).slice(0, 3).map(x => `<a href="#/anime/${x.anime.mal_id}">${esc(x.anime.title)}</a>`).join(', ') || '—'}</p><p class="about">${esc((c.about || 'Sem descrição.').slice(0, 1400))}</p><p class="mu">Dublagem: ${esc((c.voices || []).slice(0, 4).map(v => v.person.name + ' (' + v.language + ')').join(', ') || '—')}</p></div></section>`));
  const cm = h('<section class="sec"></section>'); el.append(cm); comments(cm, 'c' + c.mal_id, c.name, false);
}

async function noticias(el) {
  el.append(h('<h1>Notícias</h1>'), h(ad())); const box = h('<div class="news"></div>'); el.append(box);
  const top = (await api('/top/anime?filter=airing&limit=12&sfw=true')).data.slice(0, 4);
  for (const a of top) try { const n = (await api(`/anime/${a.mal_id}/news`)).data.slice(0, 3); box.insertAdjacentHTML('beforeend', n.map(x => `<a class="nw rv" href="${safe(x.url)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="${esc(x.images?.jpg?.image_url || '')}" alt=""><div><small class="mu">${esc(a.title)} · ${esc((x.date || '').slice(0, 10))}</small><h3>${esc(x.title)}</h3><p>${esc((x.excerpt || '').slice(0, 140))}</p></div></a>`).join('')); reveal(); } catch {}
  if (!box.children.length) box.innerHTML = '<p class="empty">Sem notícias no momento.</p>';
}

async function calendario(el, d0) {
  const days = [['monday', 'Seg'], ['tuesday', 'Ter'], ['wednesday', 'Qua'], ['thursday', 'Qui'], ['friday', 'Sex'], ['saturday', 'Sáb'], ['sunday', 'Dom']], day = d0 || days[(new Date().getDay() + 6) % 7][0];
  el.append(h('<h1>Calendário de lançamentos</h1>'), h(`<div class="tabs">${days.map(([v, l]) => `<a class="chip ${v == day ? 'on' : ''}" href="#/calendario/${v}">${l}</a>`).join('')}</div>`));
  const s = h(`<div class="grid">${'<i class="skel"></i>'.repeat(6)}</div>`); el.append(s);
  try { const d = uniq((await api(`/schedules?filter=${encodeURIComponent(day)}&sfw=true&limit=24`)).data); s.innerHTML = d.length ? d.map(a => card(norm(a), `<br><small class="gn">${esc(a.broadcast?.string || 'Horário n/d')}</small><br><small>${esc([a.season, a.year].filter(Boolean).join(' '))} · ${esc(a.status)}</small>`)).join('') : '<p class="empty">Sem lançamentos neste dia.</p>'; reveal(); } catch { s.outerHTML = fail; }
}

function favoritos(el, _, q) {
  const cur = q.get('l') || 'favorito', ks = [...Object.keys(LN), ...Object.keys(lists).filter(k => k.startsWith('c:'))];
  el.append(h('<h1>Minhas listas</h1>'), h(`<div class="tabs">${ks.map(k => `<a class="chip ${k == cur ? 'on' : ''}" href="#/favoritos?l=${encodeURIComponent(k)}">${esc(lname(k))} (${Object.keys(lists[k] || {}).length})</a>`).join('')}</div>`));
  const f = h('<form class="filters"><input name="n" maxlength="30" placeholder="Nova lista personalizada" required><button class="btn sm">Criar lista</button></form>');
  f.onsubmit = e => { e.preventDefault(); const n = new FormData(f).get('n').trim(); if (n.length < 2) return; lists['c:' + n] = lists['c:' + n] || {}; saveLists(); toast('Lista criada!'); go('#/favoritos?l=' + encodeURIComponent('c:' + n)); route(); };
  const it = Object.entries(lists[cur] || {});
  el.append(f, h(it.length ? `<div class="grid">${it.map(([id, v]) => card({ id, ...v }, '', '#/anime/', cur)).join('')}</div>` : '<p class="empty">Esta lista está vazia. Adicione animes pelo coração ♥ ou pela página do anime.</p>'));
  if (!user) el.append(h('<p class="mu">Você está como visitante: listas salvas neste navegador. <a href="#/login" style="color:var(--ne)">Entre</a> para sincronizar.</p>'));
}

async function comunidade(el) {
  el.append(h('<h1>Comunidade Otaku</h1>'));
  const pf = h(user ? '<form class="cf box wide"><textarea maxlength="500" required placeholder="Compartilhe algo com a comunidade (sem links)..."></textarea><button class="btn">Publicar</button></form>' : '<p class="mu">Entre para publicar e curtir. <a href="#/login" style="color:var(--ne)">Entrar</a></p>');
  const posts = h('<div></div>'), rank = h('<section class="sec"><h2>🏅 Mais comentados</h2><div></div></section>'); el.append(pf, posts, h(ad()), rank);
  const draw = async () => {
    try { const s = await F.getDocs(F.query(F.collection(db, 'posts'), F.orderBy('ts', 'desc'), F.limit(30)));
      posts.innerHTML = s.docs.map(d => { const x = d.data(), l = x.likes || []; return `<div class="cmt"><a href="#/u/${esc(x.uid)}"><b>${esc(x.name)}</b></a><p>${esc(x.text)}</p><button class="chip ${user && l.includes(user.uid) ? 'on' : ''}" data-like="${d.id}">♥ ${l.length}</button>${user && x.uid == user.uid ? `<button class="chip" data-del="${d.id}">Apagar</button>` : ''}</div>`; }).join('') || '<p class="empty">Nenhuma publicação ainda.</p>';
    } catch { posts.innerHTML = '<p class="empty">Publicações indisponíveis (configure o Firestore).</p>'; }
  };
  posts.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; if (!user) return toast('Entre para interagir.', 'err');
    try { if (b.dataset.like) { const r = F.doc(db, 'posts', b.dataset.like), on = b.classList.contains('on'); await F.updateDoc(r, { likes: on ? F.arrayRemove(user.uid) : F.arrayUnion(user.uid) }); }
      if (b.dataset.del) await F.deleteDoc(F.doc(db, 'posts', b.dataset.del)); draw(); } catch { toast('Ação não permitida.', 'err'); }
  };
  if (user) pf.onsubmit = async e => {
    e.preventDefault(); const t = pf.querySelector('textarea').value.trim();
    if (t.length < 2 || BAD.test(t)) return toast('Conteúdo inválido: sem links ou termos ofensivos.', 'err');
    if (Date.now() - J('av_cd', 0) < 30000) return toast('Aguarde 30s para publicar novamente.', 'err');
    try { await F.addDoc(F.collection(db, 'posts'), { uid: user.uid, name: user.displayName || 'Otaku', text: t, likes: [], ts: F.serverTimestamp() }); localStorage.setItem('av_cd', Date.now()); pf.reset(); toast('Publicado!'); draw(); } catch { toast('Erro ao publicar.', 'err'); }
  };
  draw();
  try { const s = await F.getDocs(F.query(F.collection(db, 'comments'), F.orderBy('ts', 'desc'), F.limit(200))), c = {};
    s.docs.forEach(d => { const x = d.data(); if (x.key[0] == 'a') c[x.key] = { t: x.t, n: (c[x.key]?.n || 0) + 1 }; });
    const r = Object.entries(c).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
    rank.lastChild.innerHTML = r.map(([k, v], i) => `<div class="cmt">${i + 1}. <a href="#/anime/${esc(k.slice(1))}" style="color:var(--ne)">${esc(v.t)}</a> · ${v.n} comentários</div>`).join('') || '<p class="mu">Sem dados ainda.</p>';
  } catch { rank.lastChild.innerHTML = '<p class="mu">Ranking indisponível.</p>'; }
}

function login(el) {
  if (user) return go('#/perfil');
  el.append(h(`<section class="box"><h1>Entrar</h1><button id="g" class="btn g">Entrar com Google</button><form id="lf"><input id="nm" maxlength="40" placeholder="Nome (apenas no cadastro)"><input id="em" type="email" required placeholder="E-mail" autocomplete="email"><input id="pw" type="password" minlength="6" required placeholder="Senha" autocomplete="current-password"><button class="btn">Entrar</button><button type="button" id="up" class="btn alt">Criar conta</button></form><a href="#" id="fg" style="color:var(--ne)">Esqueci a senha</a><p id="msg" class="mu"></p></section>`));
  const msg = (t, e) => { $('#msg').textContent = t; $('#msg').style.color = e ? '#f43f5e' : 'var(--ne)'; };
  const run = async fn => { try { await fn(); go('#/perfil'); } catch (e) { msg(AE(e.code), 1); } };
  $('#g').onclick = () => run(() => A.signInWithPopup(auth, new A.GoogleAuthProvider()));
  $('#lf').onsubmit = e => { e.preventDefault(); run(() => A.signInWithEmailAndPassword(auth, $('#em').value, $('#pw').value)); };
  $('#up').onclick = () => { if (!$('#lf').reportValidity()) return; run(async () => { const c = await A.createUserWithEmailAndPassword(auth, $('#em').value, $('#pw').value); await A.updateProfile(c.user, { displayName: $('#nm').value.trim() || 'Otaku' }); }); };
  $('#fg').onclick = async e => { e.preventDefault(); if (!$('#em').value) return msg('Digite seu e-mail acima.', 1); try { await A.sendPasswordResetEmail(auth, $('#em').value); msg('E-mail de recuperação enviado!'); } catch (x) { msg(AE(x.code), 1); } };
}

async function perfil(el) {
  if (!user) { toast('Entre para acessar seu perfil.', 'err'); return go('#/login'); }
  const ks = Object.keys(lists);
  el.append(h(`<section class="box wide"><h1>Meu perfil</h1><div class="pf"><img class="av" src="${esc(user.photoURL || prof.photo || AV)}" alt=""><form id="pf"><input name="name" maxlength="40" minlength="2" required value="${esc(user.displayName || '')}" placeholder="Nome de exibição"><input name="photo" type="url" maxlength="400" value="${esc(prof.photo || user.photoURL || '')}" placeholder="URL https da foto de perfil"><textarea name="bio" maxlength="300" placeholder="Sua biografia">${esc(prof.bio || '')}</textarea><button class="btn">Salvar perfil</button></form></div><p><a class="chip" href="#/u/${user.uid}">Perfil público</a><a class="chip" href="#/favoritos">Minhas listas</a><button id="out" class="chip">Sair</button></p></section>`));
  $('#pf').onsubmit = async e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d.photo && !/^https:\/\//.test(d.photo)) return toast('A foto deve ser um link https.', 'err');
    try { await A.updateProfile(user, { displayName: d.name.trim(), photoURL: d.photo || null }); prof = { ...prof, name: d.name.trim(), bio: d.bio.trim(), photo: d.photo }; await F.setDoc(F.doc(db, 'users', user.uid), { name: prof.name, bio: prof.bio, photo: prof.photo }, { merge: true }); $('#account').textContent = prof.name; toast('Perfil salvo!'); } catch { toast('Erro ao salvar o perfil.', 'err'); }
  };
  $('#out').onclick = async () => { await A.signOut(auth); toast('Você saiu da conta.'); go('#/'); };
  el.append(h(`<section class="sec"><h2>Resumo</h2><p>${ks.map(k => `<a class="chip" href="#/favoritos?l=${encodeURIComponent(k)}">${esc(lname(k))}: ${Object.keys(lists[k]).length}</a>`).join('')}</p></section>`));
  const hs = J('av_h', []); el.append(h(`<section class="sec"><h2>Histórico</h2>${hs.length ? `<div class="grid">${hs.slice(0, 8).map(i => card(i)).join('')}</div>` : '<p class="mu">Nenhum anime visitado ainda.</p>'}</section>`));
  const rv = h('<section class="sec"><h2>Minhas avaliações</h2></section>'); el.append(rv);
  try { const s = await F.getDocs(F.query(F.collection(db, 'comments'), F.where('uid', '==', user.uid), F.limit(30))); rv.append(h(`<div>${s.docs.map(d => d.data()).filter(x => x.score != null).map(x => `<div class="cmt"><a href="#/anime/${esc(x.key.slice(1))}" style="color:var(--ne)">${esc(x.t)}</a> ⭐${x.score}</div>`).join('') || '<p class="mu">Nenhuma avaliação.</p>'}</div>`)); } catch { rv.append(h('<p class="mu">Indisponível.</p>')); }
  reveal();
}

async function usuario(el, id) {
  const p = await F.getDoc(F.doc(db, 'users', String(id))).catch(() => null), d = p?.data();
  if (!d) return el.append(h('<p class="empty">Perfil não encontrado.</p>'));
  el.append(h(`<section class="box"><div class="pf"><img class="av" src="${/^https:\/\//.test(d.photo || '') ? esc(d.photo) : AV}" alt=""><div><h1>${esc(d.name)}</h1><p class="about">${esc(d.bio || 'Sem biografia.')}</p></div></div></section>`));
}

function premium(el) {
  el.append(h(`<section class="box"><h1>AniVerse Premium</h1><p class="mu">Em breve. Estrutura preparada — nenhum pagamento é processado nesta versão.</p><ul style="margin:14px 20px"><li>Perfil personalizado e temas exclusivos</li><li>Listas adicionais</li><li>Experiência sem anúncios</li></ul><button id="pi" class="btn">${prof.pi ? 'Interesse registrado ✓' : 'Quero ser avisado'}</button></section>`));
  $('#pi').onclick = async () => { if (!user) { toast('Entre para registrar interesse.', 'err'); return go('#/login'); } prof.pi = true; await saveLists(); $('#pi').textContent = 'Interesse registrado ✓'; toast('Avisaremos você!'); };
}

const page = (t, b) => el => el.append(h(`<section class="box wide"><h1>${t}</h1>${b}</section>`));
const sobre = page('Sobre nós', `<p>O AniVerse nasceu com a proposta de reunir informações, novidades, recomendações e conteúdos sobre o universo dos animes em um único lugar.</p><h2 style="margin-top:20px">Sobre o Projeto</h2><p>Plataforma com catálogo dinâmico (Jikan API), calendário de lançamentos, comunidade, listas pessoais e links oficiais para assistir.</p><h2 style="margin-top:20px">Créditos</h2><p>Desenvolvido por <b>Guilherme Barreto</b>.</p><p class="mu" style="margin-top:14px;font-size:.9rem">Este projeto está em constante desenvolvimento. Novas funcionalidades, melhorias e atualizações estão sendo implementadas para proporcionar a melhor experiência possível aos usuários.</p>`);
const privacidade = page('Política de Privacidade', '<p>Coletamos apenas e-mail, nome, foto e biografia informados por você, além de listas, comentários e publicações, armazenados no Firebase (Google). Senhas são gerenciadas pelo Firebase Authentication e nunca ficam em texto puro. Visitantes têm listas salvas apenas no navegador (LocalStorage). Anúncios (Google AdSense), quando ativados, podem usar cookies. Você pode solicitar a exclusão dos seus dados a qualquer momento.</p>');
const termos = page('Termos de Uso', '<p>Ao usar o AniVerse você concorda em não publicar conteúdo ofensivo, ilegal, spam ou links maliciosos. Conteúdos podem ser removidos. O AniVerse não hospeda episódios: apenas indica plataformas oficiais. Dados de animes vêm da Jikan API/MyAnimeList e pertencem aos seus titulares. O serviço está em desenvolvimento e é fornecido sem garantias.</p>');
const nf = el => el.append(h('<div style="text-align:center;padding:60px 0"><h1 class="big">404</h1><p>Esta página se perdeu em outro universo.</p><br><a class="btn" href="#/">Voltar ao início</a></div>'));

/* ---------- roteador ---------- */
const R = { '': home, animes, anime, assistir, temporadas, generos, personagens, personagem, noticias, calendario, favoritos, comunidade, login, perfil, u: usuario, premium, sobre, privacidade, termos };
async function route() {
  const [p, qs] = (location.hash.slice(2) || '').split('?'), [n, arg] = p.split('/'), el = h('<main class="fade"></main>');
  app.replaceWith(el); app = el; el.id = 'app'; $('#nav').classList.remove('open'); document.title = 'AniVerse · Plataforma de Animes';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('act', a.getAttribute('href') == '#/' + n || (!n && a.getAttribute('href') == '#/')));
  try { await (R[n] || nf)(el, arg, new URLSearchParams(qs || '')); } catch (e) { el.append(h(fail)); console.warn(e); }
  reveal(); document.querySelectorAll('ins.adsbygoogle:not([data-done])').forEach(i => { i.dataset.done = 1; try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {} });
  if (el === app && !(n == 'calendario' && arg)) scrollTo(0, 0);
}

/* ---------- interações globais ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return; e.preventDefault();
  const s = b.dataset.s || 'favorito', on = toggle(s, JSON.parse(b.dataset.a));
  b.classList.toggle('on', on); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); toast(on ? 'Adicionado a ' + lname(s) : 'Removido de ' + lname(s));
});
$('#search').onsubmit = e => { e.preventDefault(); const q = $('#q').value.trim(); if (q) go('#/animes?q=' + encodeURIComponent(q)); };
$('#burger').onclick = () => $('#nav').classList.toggle('open');
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.av_t = t; $('#theme').textContent = t == 'light' ? '☀️' : '🌙'; };
setTheme(localStorage.av_t || 'dark'); $('#theme').onclick = () => setTheme(document.documentElement.dataset.theme == 'light' ? 'dark' : 'light');
$('#top').onclick = () => scrollTo({ top: 0, behavior: 'smooth' }); addEventListener('scroll', () => $('#top').classList.toggle('show', scrollY > 500), { passive: true });
addEventListener('hashchange', route);

let first = true;
A.onAuthStateChanged(auth, async u => {
  user = u; prof = {};
  if (u) {
    try {
      const [p, l] = await Promise.all([F.getDoc(F.doc(db, 'users', u.uid)), F.getDoc(F.doc(db, 'private', u.uid))]);
      prof = p.data() || {}; prof.pi = !!l.data()?.pi; const r = l.data()?.lists || {};
      for (const s in r) lists[s] = { ...r[s], ...lists[s] }; await saveLists();
    } catch { toast('Não foi possível sincronizar (configure o Firestore).', 'err'); }
  } else if (!first) { lists = {}; localStorage.removeItem('av_lists'); }
  $('#account').textContent = u ? (u.displayName || 'Perfil') : 'Entrar'; $('#account').href = u ? '#/perfil' : '#/login';
  if (u && !first) toast('Bem-vindo, ' + (u.displayName || 'otaku') + '!');
  first = false; $('#loader').classList.add('off'); route();
});
setTimeout(() => $('#loader').classList.add('off'), 4000);
