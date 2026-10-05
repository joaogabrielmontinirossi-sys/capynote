'use strict';
/* Capynote — utilitários, ícones e armazenamento local (IndexedDB) */

const LOGO = 'logo.svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const IC = {
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  book: 'M5 4h13v16H5zM9 4v16',
  stack: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  check: 'M4 12l5 5L20 6',
  tasks: 'M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  bell: 'M6 17v-6a6 6 0 1 1 12 0v6l2 2H4zM10 21h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M15 5l-7 7 7 7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  gear: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M16 4v4M10 10v4M18 16v4',
  moon: 'M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z',
  tpl: 'M4 4h16v5H4zM4 13h7v7H4zM15 13h5v7h-5z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  flag: 'M5 21V4h12l-2 4 2 4H5',
  x: 'M6 6l12 12M18 6L6 18',
  sort: 'M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  clip: 'M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  pen: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  undo: 'M8 5L4 9l4 4M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M16 5l4 4-4 4M20 9H10a6 6 0 0 0 0 12h3',
  ul: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  ol: 'M10 6h10M10 12h10M10 18h10M4 5h1v4M4 15h2l-2 3h2',
  todo: 'M4 5h5v5H4zM4 14h5v5H4zM13 7h7M13 17h7',
  indent: 'M4 6h16M10 12h10M4 18h16M4 10l3 2-3 2',
  outdent: 'M4 6h16M10 12h10M4 18h16M7 10l-3 2 3 2',
  alignl: 'M4 6h16M4 12h10M4 18h14',
  alignc: 'M4 6h16M7 12h10M5 18h14',
  alignr: 'M4 6h16M10 12h10M6 18h14',
  hr: 'M4 12h16',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  erase: 'M5 19h14M7 15l8-8 4 4-6 6H9z',
  chev: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  dl: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  up: 'M12 16V5M7 9l5-5 5 5M5 20h14',
  copy: 'M8 8h11v12H8zM5 16V4h10',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h.01',
  print: 'M7 8V3h10v5M5 8h14v9H5zM8 14h8v7H8z',
  merge: 'M6 4v6a6 6 0 0 0 6 6h6M6 20v-4M15 13l3 3-3 3',
  share: 'M12 15V4M8 8l4-4 4 4M5 12v8h14v-8',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24"><path d="${IC[n] || ''}"/></svg>`;

/* Remove scripts e handlers de HTML vindo de fora (importações, colagem, backups). */
function sanitize(html) {
  const doc = new DOMParser().parseFromString('<body>' + html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form').forEach(e => e.remove());
  doc.querySelectorAll('*').forEach(e => [...e.attributes].forEach(a => {
    const v = a.value.replace(/\s/g, '').toLowerCase();
    if (a.name.startsWith('on') || (/^(href|src|xlink:href|action)$/.test(a.name) && v.startsWith('javascript:'))) e.removeAttribute(a.name);
  }));
  return doc.body.innerHTML;
}
function textOf(html) {
  const spaced = String(html || '').replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/td|\/th|\/pre|\/blockquote)\b[^>]*>/gi, ' $&');
  return new DOMParser().parseFromString('<body>' + spaced, 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
}

const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtFull = ts => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
function fmtRel(ts) {
  const diff = Date.now() - ts, min = 60000, d = new Date(ts);
  if (diff < min) return 'agora';
  if (diff < 60 * min) return `há ${Math.floor(diff / min)} min`;
  if (dayKey(ts) === dayKey(Date.now())) return `há ${Math.floor(diff / (60 * min))} h`;
  if (dayKey(ts) === dayKey(Date.now() - 864e5)) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

const DB = (() => {
  const STORES = ['notes', 'notebooks', 'tags', 'tasks', 'history', 'kv'];
  const SYNCED = ['notes', 'notebooks', 'tags', 'tasks'];
  let db = null, mem = null, tomb = { id: 'tombstones', items: {} };
  const useMem = () => { mem = {}; STORES.forEach(s => mem[s] = new Map()); };
  const run = (store, mode, fn) => new Promise((res, rej) => {
    const t = db.transaction(store, mode), rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
  return {
    STORES, SYNCED,
    onChange: () => {},
    tomb: () => tomb.items,
    setTomb: t => { tomb = t; },
    saveTomb: () => DB.put('kv', tomb),
    persistent: () => !mem,
    open: () => new Promise(res => {
      try {
        const rq = indexedDB.open('capynote', 1);
        rq.onupgradeneeded = () => STORES.forEach(s => rq.result.objectStoreNames.contains(s) || rq.result.createObjectStore(s, { keyPath: 'id' }));
        rq.onsuccess = () => { db = rq.result; res(); };
        rq.onerror = rq.onblocked = () => { useMem(); res(); };
      } catch (e) { useMem(); res(); }
    }),
    all: s => mem ? Promise.resolve([...mem[s].values()]) : run(s, 'readonly', o => o.getAll()),
    // raw = gravação vinda da sincronização: não carimba a data de modificação nem dispara novo envio
    put(s, v, raw) {
      if (!raw && SYNCED.includes(s)) { v.mod = Date.now(); DB.onChange(); }
      return mem ? Promise.resolve(mem[s].set(v.id, v)) : run(s, 'readwrite', o => o.put(v)).catch(e => { console.error(e); toast('Não foi possível salvar: armazenamento cheio?'); });
    },
    del(s, id, raw) {
      if (!raw && SYNCED.includes(s)) { tomb.items[s + ':' + id] = Date.now(); DB.saveTomb(); DB.onChange(); }
      return mem ? Promise.resolve(mem[s].delete(id)) : run(s, 'readwrite', o => o.delete(id));
    },
    clear: s => mem ? Promise.resolve(mem[s].clear()) : run(s, 'readwrite', o => o.clear()),
  };
})();

/* Estado em memória */
const S = {
  notes: [], notebooks: [], tags: [], tasks: [],
  set: { id: 'settings', theme: 'auto', sort: 'updated-desc', mode: 'snippets', scratch: '', searches: [], taskTab: 'open' },
  view: { type: 'home' }, cur: null,
};

const TEMPLATES = [
  ['Ata de reunião', '<h2>Reunião</h2><p><b>Data:</b> </p><p><b>Participantes:</b> </p><h3>Pauta</h3><ul><li><br></li></ul><h3>Decisões</h3><ul><li><br></li></ul><h3>Próximos passos</h3><ul class="checklist"><li><br></li></ul>'],
  ['Lista de tarefas', '<h3>Prioridade alta</h3><ul class="checklist"><li><br></li></ul><h3>Depois</h3><ul class="checklist"><li><br></li></ul>'],
  ['Diário', '<h3>Como foi o dia</h3><p><br></p><h3>Três coisas boas</h3><ol><li><br></li><li><br></li><li><br></li></ol><h3>Amanhã quero</h3><p><br></p>'],
  ['Planejamento semanal', '<table><tbody><tr><th>Dia</th><th>Foco</th><th>Compromissos</th></tr><tr><td>Segunda</td><td></td><td></td></tr><tr><td>Terça</td><td></td><td></td></tr><tr><td>Quarta</td><td></td><td></td></tr><tr><td>Quinta</td><td></td><td></td></tr><tr><td>Sexta</td><td></td><td></td></tr></tbody></table><h3>Metas da semana</h3><ul class="checklist"><li><br></li></ul>'],
  ['Plano de projeto', '<h2>Objetivo</h2><p><br></p><h2>Escopo</h2><ul><li><br></li></ul><h2>Marcos</h2><table><tbody><tr><th>Marco</th><th>Responsável</th><th>Prazo</th></tr><tr><td></td><td></td><td></td></tr></tbody></table><h2>Riscos</h2><ul><li><br></li></ul>'],
  ['Resumo de leitura', '<p><b>Autor:</b> </p><h3>Ideia central</h3><p><br></p><h3>Citações</h3><blockquote><br></blockquote><h3>O que vou aplicar</h3><ul class="checklist"><li><br></li></ul>'],
];

const WELCOME = `<p>Este é o <b>Capynote</b>, seu caderno digital com a calma de uma capivara. Tudo fica salvo neste dispositivo, mesmo sem internet.</p>
<h3>O que dá para fazer</h3>
<ul class="checklist"><li class="done">Abrir o Capynote</li><li>Criar uma nota com <b>Nova nota</b></li><li>Organizar em <b>cadernos</b> e <b>pilhas</b>, e marcar com <b>etiquetas</b></li><li>Inserir imagens, anexos, áudio, desenhos, tabelas e listas de verificação</li><li>Definir um <b>lembrete</b> no sino e fixar a nota nos <b>atalhos</b> com a estrela</li><li>Pesquisar com <code>tag:</code> <code>caderno:</code> <code>intitle:</code> <code>todo:</code> e salvar a pesquisa</li></ul>
<blockquote>Dica: o menu <b>⋯</b> da nota tem histórico de versões, modelos, exportação (HTML, Markdown, ENEX, PDF) e mais.</blockquote>
<p>Em <b>Ajustes</b> você faz backup, importa arquivos <code>.enex</code> do Evernote e troca o tema.</p>`;

const Store = {
  async load() {
    await DB.open();
    [S.notes, S.notebooks, S.tags, S.tasks] = await Promise.all(['notes', 'notebooks', 'tags', 'tasks'].map(DB.all));
    const kv = await DB.all('kv');
    const st = kv.find(k => k.id === 'settings');
    if (st) Object.assign(S.set, st);
    const tb = kv.find(k => k.id === 'tombstones');
    if (tb) DB.setTomb(tb);
    if (!S.notebooks.length) await Store.seed();
  },
  async seed() {
    // seed: true marca o conteúdo de exemplo, descartado se a primeira sincronização já encontrar dados
    const nb = { id: uid(), name: 'Primeiro caderno', stack: '', created: Date.now(), isDefault: true, seed: true };
    S.notebooks.push(nb); await DB.put('notebooks', nb);
    const tag = Store.tagByName('boas-vindas', true);
    tag.seed = true;
    const n = Store.newNote({ title: 'Bem-vindo ao Capynote', content: WELCOME, tags: [tag.id], shortcut: true, seed: true });
    S.cur = n.id;
    for (const [title, content] of TEMPLATES) Store.newNote({ title, content, isTemplate: true, seed: true });
    const t = { id: uid(), title: 'Explorar o Capynote', done: false, due: dayKey(Date.now()), flag: false, noteId: n.id, created: Date.now(), seed: true };
    S.tasks.push(t); await DB.put('tasks', t);
  },
  saveSet: () => DB.put('kv', S.set),
  defaultNb: () => S.notebooks.find(n => n.isDefault) || S.notebooks[0],
  note: id => S.notes.find(n => n.id === id),
  nb: id => S.notebooks.find(n => n.id === id),
  tag: id => S.tags.find(t => t.id === id),
  newNote(p = {}) {
    const now = Date.now();
    const n = Object.assign({ id: uid(), title: '', content: '', text: '', notebookId: Store.defaultNb().id, tags: [], created: now, updated: now, deleted: null, shortcut: false, reminder: null, isTemplate: false }, p);
    n.text = textOf(n.content);
    S.notes.push(n); DB.put('notes', n);
    return n;
  },
  saveNote: n => DB.put('notes', n),
  tagByName(name, create) {
    name = name.trim().replace(/^#/, '');
    if (!name) return null;
    let t = S.tags.find(t => norm(t.name) === norm(name));
    if (!t && create) { t = { id: uid(), name }; S.tags.push(t); DB.put('tags', t); }
    return t;
  },
  async purge(n) {
    S.notes = S.notes.filter(x => x !== n); await DB.del('notes', n.id);
    for (const t of S.tasks.filter(t => t.noteId === n.id)) { S.tasks = S.tasks.filter(x => x !== t); DB.del('tasks', t.id); }
    for (const h of (await DB.all('history')).filter(h => h.noteId === n.id)) DB.del('history', h.id);
  },
  async snapshot(n) {
    if (!n.text && !n.title) return;
    await DB.put('history', { id: uid(), noteId: n.id, at: n.updated, title: n.title, content: n.content });
    const hs = (await DB.all('history')).filter(h => h.noteId === n.id).sort((a, b) => b.at - a.at);
    hs.slice(20).forEach(h => DB.del('history', h.id));
  },
  live: () => S.notes.filter(n => !n.deleted && !n.isTemplate),
};

/* Pesquisa: palavras, "frases", -negação, tag: caderno: intitle: todo: lembrete: */
function parseQuery(q) {
  const out = [], re = /(-?)(?:([a-zA-Z]+):)?(?:"([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(q))) {
    let key = (m[2] || '').toLowerCase(), val = m[3] ?? m[4];
    if (key && !/^(tag|etiqueta|notebook|caderno|intitle|titulo|todo|reminder|lembrete)$/.test(key)) { val = key + ':' + val; key = ''; }
    out.push({ neg: !!m[1], key, val: norm(val) });
  }
  return out;
}
function matchNote(n, terms) {
  return terms.every(t => {
    let r;
    switch (t.key) {
      case 'tag': case 'etiqueta': r = t.val === '*' ? n.tags.length > 0 : n.tags.some(id => norm((Store.tag(id) || {}).name) === t.val); break;
      case 'notebook': case 'caderno': r = norm((Store.nb(n.notebookId) || {}).name).includes(t.val); break;
      case 'intitle': case 'titulo': r = norm(n.title).includes(t.val); break;
      case 'todo': {
        const has = /class="checklist"/.test(n.content), done = /<li class="done"/.test(n.content), open = /<ul class="checklist">(?:(?!<\/ul>).)*<li>/s.test(n.content);
        r = t.val === 'true' ? done : t.val === 'false' ? open : has; break;
      }
      case 'reminder': case 'lembrete': r = !!n.reminder; break;
      default: r = norm(n.title + ' ' + n.text).includes(t.val);
    }
    return t.neg ? !r : r;
  });
}
