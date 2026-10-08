'use strict';
const GSync = window.GSyncLib || { web: false, on: () => false, io: null, html: () => '', off() {}, onChange: null };
/* Capynote — telas, navegação e ações */

const App = (() => {
  const LIST_VIEWS = ['notes', 'notebook', 'stack', 'tag', 'shortcuts', 'trash', 'search', 'templates', 'reminders'];
  const isList = () => LIST_VIEWS.includes(S.view.type);
  const isMobile = () => innerWidth <= 820;
  const lastSnap = new Map();
  let dirty = false, calMonth = new Date(), calSel = dayKey(Date.now()), installEvt = null;
  const today = () => dayKey(Date.now());
  const ttl = n => n.title || 'Sem título';
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- Consulta da visão atual ---------- */
  function viewNotes() {
    const v = S.view, live = Store.live();
    let ns;
    switch (v.type) {
      case 'trash': ns = S.notes.filter(n => n.deleted); break;
      case 'templates': ns = S.notes.filter(n => n.isTemplate && !n.deleted); break;
      case 'notebook': ns = live.filter(n => n.notebookId === v.id); break;
      case 'stack': ns = live.filter(n => (Store.nb(n.notebookId) || {}).stack === v.id); break;
      case 'tag': ns = live.filter(n => n.tags.includes(v.id)); break;
      case 'shortcuts': ns = live.filter(n => n.shortcut); break;
      case 'reminders': return live.filter(n => n.reminder).sort((a, b) => a.reminder.at - b.reminder.at);
      case 'search': { const t = parseQuery(v.q || ''); ns = live.filter(n => matchNote(n, t)); break; }
      default: ns = live;
    }
    const [k, dir] = S.set.sort.split('-'), s = dir === 'asc' ? 1 : -1;
    return ns.sort((a, b) => (k === 'title' ? norm(a.title).localeCompare(norm(b.title)) : a[k] - b[k]) * s);
  }
  function viewTitle() {
    const v = S.view;
    return ({ notes: 'Notas', shortcuts: 'Atalhos', trash: 'Lixeira', templates: 'Modelos', reminders: 'Lembretes', search: 'Resultados da pesquisa', stack: v.id,
      notebook: (Store.nb(v.id) || {}).name, tag: '#' + ((Store.tag(v.id) || {}).name || '') })[v.type] || '';
  }

  /* ---------- Barra lateral ---------- */
  function renderSidebar() {
    const v = S.view, live = Store.live();
    const item = (attrs, icon, label, cls = '', cnt = '') => `<button class="nav-i ${cls}" ${attrs}>${ic(icon)}<span class="lbl">${esc(label)}</span>${cnt !== '' ? `<span class="cnt">${cnt}</span>` : ''}</button>`;
    const nav = (type, icon, label, cnt = '') => item(`data-act="go" data-type="${type}"`, icon, label, v.type === type ? 'on' : '', cnt);
    const nbItem = (nb, cls) => item(`data-act="go" data-type="notebook" data-id="${nb.id}"`, 'book', nb.name, cls + (v.type === 'notebook' && v.id === nb.id ? ' on' : ''), live.filter(n => n.notebookId === nb.id).length);
    const byName = (a, b) => norm(a.name).localeCompare(norm(b.name));
    const stacks = [...new Set(S.notebooks.map(n => n.stack).filter(Boolean))].sort();
    const shortcuts = live.filter(n => n.shortcut).map(n => item(`data-act="open" data-id="${n.id}"`, 'note', ttl(n), 'sub'))
      .concat(S.notebooks.filter(n => n.shortcut).map(nb => nbItem(nb, 'sub'))).join('');
    const openTasks = S.tasks.filter(t => !t.done).length;
    $('#sidebar').innerHTML = `
      <div class="brand"><img src="${LOGO}" alt=""><span>Capynote</span></div>
      <div class="newrow"><button class="btn" data-act="newNote">${ic('plus')} Nova nota</button><button class="btn" data-act="newMenu" title="Mais opções">${ic('down')}</button></div>
      <div class="nav">
        ${nav('home', 'home', 'Início')}
        ${item('data-act="quick"', 'search', 'Buscar e ir para…', '', '<kbd style="font:inherit">Ctrl K</kbd>')}
        ${nav('shortcuts', 'star', 'Atalhos')}${shortcuts}
        ${nav('notes', 'note', 'Notas', live.length)}
        ${nav('tasks', 'tasks', 'Tarefas', openTasks || '')}
        ${nav('calendar', 'cal', 'Calendário')}
        ${nav('reminders', 'bell', 'Lembretes', live.filter(n => n.reminder && !n.reminder.done).length || '')}
        <div class="nav-h"><span class="sp">Cadernos</span><button data-act="newNotebook" title="Novo caderno">${ic('plus')}</button></div>
        ${nav('notebooks', 'grid', 'Todos os cadernos')}
        ${stacks.map(s => item(`data-act="go" data-type="stack" data-id="${esc(s)}"`, 'stack', s, 'sub' + (v.type === 'stack' && v.id === s ? ' on' : '')) + S.notebooks.filter(n => n.stack === s).sort(byName).map(nb => nbItem(nb, 'sub2')).join('')).join('')}
        ${S.notebooks.filter(n => !n.stack).sort(byName).map(nb => nbItem(nb, 'sub')).join('')}
        <div class="nav-h"><span class="sp">Etiquetas</span></div>
        ${nav('tags', 'tag', 'Todas as etiquetas', S.tags.length || '')}
        ${[...S.tags].sort(byName).slice(0, 30).map(t => item(`data-act="go" data-type="tag" data-id="${t.id}"`, 'tag', t.name, 'sub' + (v.type === 'tag' && v.id === t.id ? ' on' : ''), live.filter(n => n.tags.includes(t.id)).length)).join('')}
        ${S.set.searches.length ? `<div class="nav-h"><span class="sp">Pesquisas salvas</span></div>` + S.set.searches.map(q => item(`data-act="go" data-type="search" data-q="${esc(q)}"`, 'search', q, 'sub' + (v.type === 'search' && v.q === q ? ' on' : ''))).join('') : ''}
        <div class="nav-h"><span class="sp">Mais</span></div>
        ${nav('templates', 'tpl', 'Modelos')}
        ${nav('trash', 'trash', 'Lixeira', S.notes.filter(n => n.deleted).length || '')}
      </div>
      <div class="side-foot"><button class="ib" data-act="settings" title="Ajustes">${ic('gear')} Ajustes</button><span class="sp"></span><button class="ib" data-act="theme" title="Alternar tema">${ic('moon')}</button></div>`;
  }

  function renderBottom() {
    const t = S.view.type, b = (act, attrs, icon, label, on) => `<button data-act="${act}" ${attrs} class="${on ? 'on' : ''}">${ic(icon)}${label}</button>`;
    $('#bottomnav').innerHTML = b('go', 'data-type="home"', 'home', 'Início', t === 'home') + b('go', 'data-type="notes"', 'note', 'Notas', isList())
      + `<button class="fab" data-act="newNote" title="Nova nota">${ic('plus')}</button>` + b('go', 'data-type="tasks"', 'tasks', 'Tarefas', t === 'tasks') + b('openSide', '', 'menu', 'Menu', false);
  }

  /* ---------- Lista de notas ---------- */
  function noteItem(n) {
    const thumb = (/<img[^>]+src="([^"]+)"/.exec(n.content) || [])[1];
    const tags = n.tags.map(id => Store.tag(id)).filter(Boolean).slice(0, 3).map(t => `<span class="chip">${esc(t.name)}</span>`).join('');
    const rem = n.reminder ? `<span class="chip ${n.reminder.done ? '' : 'warn'}">${ic('bell')}${fmtFull(n.reminder.at)}</span>` : '';
    return `<div class="ni ${n.id === S.cur ? 'on' : ''}" data-act="open" data-id="${n.id}"><div class="ni-b"><div class="ni-t">${esc(ttl(n))}</div><div class="ni-s">${esc(n.text.slice(0, 160))}</div><div class="ni-m"><span>${fmtRel(S.view.type === 'trash' ? n.deleted : n.updated)}</span>${n.shortcut ? ic('star') : ''}${rem}${tags}</div></div>${thumb ? `<img class="ni-th" src="${thumb}" alt="" loading="lazy">` : ''}</div>`;
  }
  function renderList() {
    const ns = viewNotes(), v = S.view;
    const extra = { trash: ns.length ? `<button class="btn ghost sm" data-act="emptyTrash">Esvaziar lixeira</button>` : '', search: v.q && !S.set.searches.includes(v.q) ? `<button class="btn ghost sm" data-act="saveSearch">Salvar pesquisa</button>` : v.q ? `<button class="btn ghost sm" data-act="dropSearch">Remover pesquisa salva</button>` : '' }[v.type] || '';
    $('#lphead').innerHTML = `<div class="lp-head"><button class="ib only-m" data-act="openSide">${ic('menu')}</button><h2>${esc(viewTitle())}</h2>
      ${['notebook', 'tag', 'stack'].includes(v.type) ? `<button class="ib" data-act="viewMenu" title="Opções">${ic('more')}</button>` : ''}
      <button class="ib" data-act="sortMenu" title="Ordenar">${ic('sort')}</button><button class="ib" data-act="modeMenu" title="Visualização">${ic('grid')}</button></div>
      <div class="lp-sub"><span>${count(ns.length, 'nota', 'notas')}</span><span class="sp"></span>${extra}</div>`;
    const list = $('#list');
    list.className = S.set.mode === 'snippets' ? '' : S.set.mode;
    list.innerHTML = ns.map(noteItem).join('') || `<div class="empty" style="grid-column:1/-1"><img src="${LOGO}" alt=""><h3>${v.type === 'search' ? 'Nada encontrado' : v.type === 'trash' ? 'Lixeira vazia' : 'Nenhuma nota aqui'}</h3><p>${v.type === 'search' ? 'Tente outras palavras ou filtros como tag: e caderno:' : v.type === 'trash' ? 'Notas excluídas aparecem aqui.' : 'Crie uma com o botão Nova nota.'}</p></div>`;
  }

  /* ---------- Editor ---------- */
  const tagChips = n => n.tags.map(id => Store.tag(id)).filter(Boolean).map(t => `<span class="chip">${esc(t.name)}<button data-act="rmTag" data-id="${t.id}" title="Remover">×</button></span>`).join('');
  const reminderChip = n => n.reminder ? `<button class="chip ${n.reminder.done ? '' : 'warn'}" data-act="reminder">${ic('bell')}${n.reminder.done ? 'Concluído · ' : ''}${fmtFull(n.reminder.at)}</button>` : '';
  function taskRow(t, showNote = true) {
    const late = !t.done && t.due && t.due < today(), n = showNote && t.noteId && Store.note(t.noteId);
    return `<div class="row task ${t.done ? 'done' : ''}" data-tid="${t.id}"><input type="checkbox" data-change="taskDone" ${t.done ? 'checked' : ''}><input type="text" value="${esc(t.title)}" data-change="taskTitle"><input type="date" class="${late ? 'late' : ''}" value="${t.due || ''}" data-change="taskDue" title="Prazo">${n ? `<button class="ib" data-act="open" data-id="${n.id}" title="Nota: ${esc(ttl(n))}">${ic('note')}</button>` : ''}<button class="ib flag ${t.flag ? 'on' : ''}" data-act="taskFlag" title="Sinalizar">${ic('flag')}</button><button class="ib" data-act="taskDel" title="Excluir">${ic('x')}</button></div>`;
  }
  const noteTasks = n => S.tasks.filter(t => t.noteId === n.id).sort((a, b) => a.done - b.done || a.created - b.created).map(t => taskRow(t, false)).join('')
    + `<div class="addrow"><input type="text" placeholder="Adicionar tarefa a esta nota…" data-enter="addTask" data-note="${n.id}"></div>`;

  function renderEditor() {
    const n = Store.note(S.cur), main = $('#main');
    if (!n) { main.innerHTML = `<div class="empty" style="margin:auto"><img src="${LOGO}" alt=""><h3>Nenhuma nota aberta</h3><p>Escolha uma nota na lista ou crie uma nova.</p><p><button class="btn" data-act="newNote">${ic('plus')} Nova nota</button></p></div>`; return; }
    const ro = !!n.deleted;
    main.innerHTML = `
      <div class="ed-head"><button class="ib only-m" data-act="back" title="Voltar">${ic('back')}</button><button class="ib only-d" data-act="focus" title="Modo foco">${ic('expand')}</button>
        <select data-change="moveNote" title="Caderno" ${ro ? 'disabled' : ''}>${S.notebooks.map(b => `<option value="${b.id}" ${b.id === n.notebookId ? 'selected' : ''}>${esc((b.stack ? b.stack + ' / ' : '') + b.name)}</option>`).join('')}</select>
        <span class="saved" id="savedAt">${ro ? '' : 'Salvo ' + fmtRel(n.updated)}</span><span class="sp"></span>
        ${ro ? '' : `<button class="ib ${n.shortcut ? 'on' : ''}" data-act="toggleShortcut" title="Atalho">${ic('star')}</button><button class="ib" data-act="reminder" title="Lembrete">${ic('bell')}</button>`}
        <button class="ib" data-act="noteMenu" title="Mais ações">${ic('more')}</button></div>
      ${ro ? `<div class="banner trash">Esta nota está na lixeira.<span class="sp"></span><button class="btn sm" data-act="restore">Restaurar</button><button class="btn sm danger" data-act="purge">Excluir para sempre</button></div>` : `<div class="tb">${Editor.toolbar()}</div>`}
      ${n.isTemplate && !ro ? `<div class="banner">Você está editando um modelo.<span class="sp"></span><button class="btn sm" data-act="useTpl" data-id="${n.id}">Criar nota a partir dele</button></div>` : ''}
      <div class="ed-scroll"><div class="ed-in">
        <input id="title" placeholder="Título" value="${esc(n.title)}" ${ro ? 'readonly' : ''} autocomplete="off">
        <div class="meta"><span>Criada em ${fmtFull(n.created)}</span><span>·</span><span>Editada ${fmtRel(n.updated)}</span><span id="remchip">${reminderChip(n)}</span></div>
        <div id="body" ${ro ? '' : 'contenteditable="true"'} spellcheck="true"></div>
        ${ro || n.isTemplate ? '' : `<div class="note-tasks"><h3>Tarefas desta nota</h3><div id="ntasks">${noteTasks(n)}</div></div>`}
      </div></div>
      ${ro ? '' : `<div class="ed-tags">${ic('tag')}<span id="tagchips" style="display:contents">${tagChips(n)}</span><input type="text" id="taginp" placeholder="Adicionar etiqueta…" list="taglist" data-enter="addTag"><datalist id="taglist">${S.tags.map(t => `<option value="${esc(t.name)}">`).join('')}</datalist></div>`}`;
    $('#body').innerHTML = n.content;
    if (!ro) {
      Editor.mount($('#body'), $('.tb'), onEdit);
      $('#title').oninput = onEdit;
      $('#title').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#body').focus(); } };
    }
  }
  const saveSoon = debounce(() => commit(), 500);
  function onEdit() { dirty = true; const s = $('#savedAt'); if (s) s.textContent = 'Salvando…'; saveSoon(); }
  function commit() {
    if (!dirty) return;
    dirty = false;
    const n = Store.note(S.cur), b = $('#body'), t = $('#title');
    if (!n || !b || !t || n.deleted) return;
    if (Date.now() - (lastSnap.get(n.id) || 0) > 600000) { lastSnap.set(n.id, Date.now()); Store.snapshot({ ...n }); }
    delete n.seed;
    n.title = t.value.trim(); n.content = b.innerHTML; n.text = textOf(n.content); n.updated = Date.now();
    Store.saveNote(n);
    const s = $('#savedAt'); if (s) s.textContent = 'Salvo agora';
    if (isList()) renderList();
  }

  /* ---------- Visões cheias ---------- */
  const fvHead = (title, right = '') => `<div class="fv-head"><button class="ib only-m" data-act="openSide">${ic('menu')}</button><h1>${esc(title)}</h1>${right}</div>`;

  function homeHTML() {
    const live = Store.live(), h = new Date().getHours(), recents = [...live].sort((a, b) => b.updated - a.updated).slice(0, 12);
    const tasks = S.tasks.filter(t => !t.done).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1).slice(0, 6);
    const rems = live.filter(n => n.reminder && !n.reminder.done).sort((a, b) => a.reminder.at - b.reminder.at).slice(0, 5);
    const stars = live.filter(n => n.shortcut).slice(0, 6);
    const row = (n, right) => `<div class="row click" data-act="open" data-id="${n.id}">${ic('note')}<span class="grow">${esc(ttl(n))}</span><small class="muted">${right}</small></div>`;
    return `<div class="fv"><div class="fv-in">
      <div class="hero"><img src="${LOGO}" alt=""><div><h1>${h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}!</h1><p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${count(live.length, 'nota', 'notas')} · ${count(S.tasks.filter(t => !t.done).length, 'tarefa pendente', 'tarefas pendentes')}</p></div><span class="sp"></span><button class="ib only-m" style="color:#fff" data-act="openSide">${ic('menu')}</button></div>
      <div class="wgrid">
        <div class="w wide"><div class="w-h"><span class="sp">Notas recentes</span><button class="lnk" data-act="go" data-type="notes">Ver todas</button></div>
          <div class="recents">${recents.map(n => `<div class="rc" data-act="open" data-id="${n.id}"><b>${esc(ttl(n))}</b><span>${esc(n.text.slice(0, 140))}</span><small>${fmtRel(n.updated)}</small></div>`).join('') || '<span class="muted">Suas notas aparecerão aqui.</span>'}
          <div class="rc" data-act="newNote" style="align-items:center;justify-content:center;color:var(--brand)">${ic('plus')}<b>Nova nota</b></div></div></div>
        <div class="w"><div class="w-h"><span class="sp">Rascunho rápido</span><button class="lnk" data-act="scratchToNote">Virar nota</button></div><textarea id="scratch" data-input="scratch" placeholder="Anote qualquer coisa…">${esc(S.set.scratch)}</textarea></div>
        <div class="w"><div class="w-h"><span class="sp">Tarefas</span><button class="lnk" data-act="go" data-type="tasks">Ver todas</button></div>${tasks.map(t => taskRow(t)).join('')}<div class="addrow"><input type="text" placeholder="Nova tarefa…" data-enter="addTask"></div></div>
        <div class="w"><div class="w-h"><span class="sp">Lembretes</span><button class="lnk" data-act="go" data-type="reminders">Ver todos</button></div>${rems.map(n => row(n, fmtFull(n.reminder.at))).join('') || '<span class="muted">Use o sino de uma nota para criar um lembrete.</span>'}</div>
        <div class="w"><div class="w-h"><span class="sp">Atalhos</span></div>${stars.map(n => row(n, fmtRel(n.updated))).join('') || '<span class="muted">Marque notas com a estrela para vê-las aqui.</span>'}</div>
        <div class="w"><div class="w-h"><span class="sp">Cadernos</span><button class="lnk" data-act="go" data-type="notebooks">Gerenciar</button></div>${S.notebooks.slice(0, 6).map(b => `<div class="row click" data-act="go" data-type="notebook" data-id="${b.id}">${ic('book')}<span class="grow">${esc(b.name)}</span><small class="muted">${live.filter(n => n.notebookId === b.id).length}</small></div>`).join('')}</div>
      </div></div></div>`;
  }

  function tasksHTML() {
    const tab = S.set.taskTab, td = today();
    const f = { open: t => !t.done, today: t => !t.done && t.due && t.due <= td, due: t => !t.done && t.due, flag: t => !t.done && t.flag, done: t => t.done }[tab] || (t => !t.done);
    const ts = S.tasks.filter(f).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : (a.due || '9') > (b.due || '9') ? 1 : a.created - b.created);
    const tabs = [['open', 'Pendentes'], ['today', 'Hoje e atrasadas'], ['due', 'Com prazo'], ['flag', 'Sinalizadas'], ['done', 'Concluídas']];
    return `<div class="fv"><div class="fv-in" style="max-width:780px">${fvHead('Tarefas')}
      <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-act="taskTab" data-id="${k}">${l} <small>${S.tasks.filter({ open: t => !t.done, today: t => !t.done && t.due && t.due <= td, due: t => !t.done && t.due, flag: t => !t.done && t.flag, done: t => t.done }[k]).length}</small></button>`).join('')}</div>
      <div class="w"><div class="addrow"><input type="text" placeholder="Nova tarefa… (Enter para adicionar)" data-enter="addTask"></div>${ts.map(t => taskRow(t)).join('') || '<p class="muted">Nenhuma tarefa nesta lista.</p>'}
      ${tab === 'done' && ts.length ? `<p style="margin:10px 0 0"><button class="btn ghost sm" data-act="clearDone">Limpar concluídas</button></p>` : ''}</div></div></div>`;
  }

  function calendarHTML() {
    const y = calMonth.getFullYear(), m = calMonth.getMonth(), start = new Date(y, m, 1 - new Date(y, m, 1).getDay());
    const evs = {}, add = (k, o) => (evs[k] = evs[k] || []).push(o);
    Store.live().forEach(n => { add(dayKey(n.created), { c: '', l: ttl(n), id: n.id }); if (n.reminder) add(dayKey(n.reminder.at), { c: 'r', l: ttl(n), id: n.id }); });
    S.tasks.forEach(t => t.due && add(t.due, { c: 't', l: t.title, t }));
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), k = dayKey(d), e = evs[k] || [];
      cells += `<div class="day ${d.getMonth() !== m ? 'out' : ''} ${k === today() ? 'today' : ''} ${k === calSel ? 'sel' : ''}" data-act="calDay" data-id="${k}"><span class="n">${d.getDate()}</span>${e.slice(0, 3).map(x => `<div class="ev ${x.c}">${esc(x.l)}</div>`).join('')}${e.length > 3 ? `<div class="ev" style="background:none">+${e.length - 3}</div>` : ''}</div>`;
    }
    const sel = evs[calSel] || [], [sy, sm, sd] = calSel.split('-').map(Number);
    return `<div class="fv"><div class="fv-in">${fvHead(calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase()), `<button class="btn ghost sm" data-act="calNav" data-id="-1">${ic('back')}</button><button class="btn ghost sm" data-act="calNav" data-id="0">Hoje</button><button class="btn ghost sm" data-act="calNav" data-id="1">${ic('chev')}</button>`)}
      <div class="cal">${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>
      <div class="w" style="margin-top:16px"><div class="w-h"><span class="sp">${new Date(sy, sm - 1, sd).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span class="chip">nota</span><span class="chip warn">tarefa</span><span class="chip" style="background:#e2e6fb;color:#2a357a">lembrete</span></div>
        ${sel.map(x => x.t ? taskRow(x.t) : `<div class="row click" data-act="open" data-id="${x.id}">${ic(x.c === 'r' ? 'bell' : 'note')}<span class="grow">${esc(x.l)}</span><small class="muted">${x.c === 'r' ? 'lembrete' : 'criada'}</small></div>`).join('') || '<p class="muted">Nada neste dia.</p>'}
        <div class="addrow"><input type="text" placeholder="Nova tarefa para este dia…" data-enter="addTask" data-due="${calSel}"></div></div></div></div>`;
  }

  function notebooksHTML() {
    const live = Store.live(), stacks = [...new Set(S.notebooks.map(n => n.stack).filter(Boolean))].sort();
    const row = b => `<div class="row click" data-act="go" data-type="notebook" data-id="${b.id}">${ic('book')}<span class="grow"><b>${esc(b.name)}</b> ${b.isDefault ? '<span class="chip">padrão</span>' : ''} ${b.shortcut ? '<span class="chip warn">atalho</span>' : ''}</span><small class="muted">${count(live.filter(n => n.notebookId === b.id).length, 'nota', 'notas')}</small><button class="ib" data-act="nbMenu" data-id="${b.id}">${ic('more')}</button></div>`;
    return `<div class="fv"><div class="fv-in" style="max-width:780px">${fvHead('Cadernos', `<button class="btn" data-act="newNotebook">${ic('plus')} Novo caderno</button>`)}
      ${stacks.map(s => `<div class="w" style="margin-bottom:14px"><div class="w-h">${ic('stack')}<span class="sp">${esc(s)}</span><button class="lnk" data-act="go" data-type="stack" data-id="${esc(s)}">Ver notas da pilha</button></div>${S.notebooks.filter(b => b.stack === s).map(row).join('')}</div>`).join('')}
      <div class="w">${stacks.length ? `<div class="w-h">Sem pilha</div>` : ''}${S.notebooks.filter(b => !b.stack).map(row).join('') || '<p class="muted">Todos os cadernos estão em pilhas.</p>'}</div>
      <p class="muted">Pilhas agrupam cadernos. Use o menu ⋯ de um caderno para movê-lo para uma pilha.</p></div></div>`;
  }

  function tagsHTML() {
    const live = Store.live();
    return `<div class="fv"><div class="fv-in" style="max-width:780px">${fvHead('Etiquetas', `<button class="btn" data-act="newTag">${ic('plus')} Nova etiqueta</button>`)}
      <div class="w">${[...S.tags].sort((a, b) => norm(a.name).localeCompare(norm(b.name))).map(t => `<div class="row click" data-act="go" data-type="tag" data-id="${t.id}">${ic('tag')}<span class="grow">${esc(t.name)}</span><small class="muted">${count(live.filter(n => n.tags.includes(t.id)).length, 'nota', 'notas')}</small><button class="ib" data-act="tagMenu" data-id="${t.id}">${ic('more')}</button></div>`).join('') || '<p class="muted">Nenhuma etiqueta ainda. Adicione etiquetas no rodapé de uma nota.</p>'}</div></div></div>`;
  }

  function renderMain() {
    const t = S.view.type;
    if (isList()) return renderEditor();
    $('#main').innerHTML = ({ home: homeHTML, tasks: tasksHTML, calendar: calendarHTML, notebooks: notebooksHTML, tags: tagsHTML }[t] || homeHTML)();
  }
  function render() {
    document.body.classList.toggle('full', !isList());
    renderSidebar(); renderBottom();
    if (isList()) renderList();
    renderMain();
  }
  function refreshTasks() {
    const n = Store.note(S.cur);
    if (isList() && $('#ntasks') && n) $('#ntasks').innerHTML = noteTasks(n); else if (!isList()) renderMain();
    renderSidebar();
  }

  /* ---------- Navegação ---------- */
  function go(view) {
    commit();
    S.view = view;
    document.body.classList.remove('side-open', 'm-main', 'focus');
    $('#q').value = view.type === 'search' ? view.q : '';
    if (isList()) { const ns = viewNotes(); if (!ns.some(n => n.id === S.cur)) S.cur = !isMobile() && ns[0] ? ns[0].id : null; }
    render();
  }
  function openNote(id) {
    const n = Store.note(id);
    if (!n) return toast('Nota não encontrada');
    commit();
    S.cur = id;
    if (!isList() || !viewNotes().includes(n)) { S.view = { type: n.deleted ? 'trash' : n.isTemplate ? 'templates' : 'notes' }; $('#q').value = ''; }
    document.body.classList.remove('side-open');
    document.body.classList.add('m-main');
    render();
  }
  function createNote(p = {}) {
    commit();
    const v = S.view;
    const n = Store.newNote(Object.assign({ notebookId: v.type === 'notebook' ? v.id : Store.defaultNb().id, tags: v.type === 'tag' ? [v.id] : [] }, p));
    if (!['notes', 'notebook', 'tag'].includes(v.type)) S.view = { type: 'notes' };
    openNote(n.id);
    setTimeout(() => { const t = $('#title'); if (t) t.focus(); }, 50);
    return n;
  }
  const cur = () => Store.note(S.cur);
  const touch = n => { n.updated = Date.now(); Store.saveNote(n); };

  /* ---------- Exportar / importar ---------- */
  const safeName = s => (s || 'nota').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'nota';
  const noteDoc = n => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(ttl(n))}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 9px}ul.checklist{list-style:none;padding-left:4px}ul.checklist li::before{content:"\\2610  "}ul.checklist li.done::before{content:"\\2611  "}blockquote{border-left:4px solid #17905a;margin:0;padding:4px 14px;color:#555}pre{background:#f4f4f4;padding:12px;border-radius:8px}</style></head><body><h1>${esc(ttl(n))}</h1>${n.content}</body></html>`;

  function toMarkdown(html) {
    const doc = new DOMParser().parseFromString('<body>' + html, 'text/html');
    const kids = n => [...n.childNodes].map(walk).join('');
    function walk(n) {
      if (n.nodeType === 3) return n.textContent;
      if (n.nodeType !== 1) return '';
      const t = n.tagName;
      switch (t) {
        case 'H1': case 'H2': case 'H3': return `\n${'#'.repeat(+t[1])} ${kids(n).trim()}\n\n`;
        case 'B': case 'STRONG': return `**${kids(n)}**`;
        case 'I': case 'EM': return `*${kids(n)}*`;
        case 'S': case 'STRIKE': return `~~${kids(n)}~~`;
        case 'CODE': return '`' + kids(n) + '`';
        case 'PRE': return '\n```\n' + n.textContent + '\n```\n\n';
        case 'BLOCKQUOTE': return '\n> ' + kids(n).trim().replace(/\n/g, '\n> ') + '\n\n';
        case 'BR': return '\n';
        case 'HR': return '\n---\n\n';
        case 'A': return n.classList.contains('attach') ? `[anexo: ${n.textContent}]` : `[${kids(n)}](${n.getAttribute('href')})`;
        case 'IMG': { const s = n.getAttribute('src') || ''; return `![${n.alt || 'imagem'}](${s.startsWith('data:') ? 'imagem-incorporada' : s})`; }
        case 'AUDIO': return '[áudio]';
        case 'UL': case 'OL': return '\n' + [...n.children].map((li, i) => (t === 'OL' ? `${i + 1}. ` : n.classList.contains('checklist') ? `- [${li.classList.contains('done') ? 'x' : ' '}] ` : '- ') + kids(li).trim()).join('\n') + '\n\n';
        case 'TABLE': { const rows = [...n.querySelectorAll('tr')].map(tr => '| ' + [...tr.cells].map(c => kids(c).trim().replace(/\n/g, ' ')).join(' | ') + ' |'); if (rows.length) rows.splice(1, 0, '|' + ' --- |'.repeat(n.querySelector('tr').cells.length)); return '\n' + rows.join('\n') + '\n\n'; }
        case 'P': case 'DIV': return kids(n) + '\n\n';
        default: return kids(n);
      }
    }
    return kids(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function mdToHtml(md) {
    const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
    const out = [];
    let list = null;
    const close = () => { if (list) { out.push(`</${list.split(' ')[0]}>`); list = null; } };
    const open = tag => { if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; } };
    for (const line of md.split(/\r?\n/)) {
      let m;
      if ((m = /^(#{1,3})\s+(.*)/.exec(line))) { close(); out.push(`<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`); }
      else if ((m = /^\s*[-*]\s+\[( |x)\]\s+(.*)/i.exec(line))) { open('ul class="checklist"'); out.push(`<li${m[1] !== ' ' ? ' class="done"' : ''}>${inl(m[2])}</li>`); }
      else if ((m = /^\s*[-*]\s+(.*)/.exec(line))) { open('ul'); out.push(`<li>${inl(m[1])}</li>`); }
      else if ((m = /^\s*\d+\.\s+(.*)/.exec(line))) { open('ol'); out.push(`<li>${inl(m[1])}</li>`); }
      else if ((m = /^>\s?(.*)/.exec(line))) { close(); out.push(`<blockquote>${inl(m[1])}</blockquote>`); }
      else if (/^-{3,}$/.test(line.trim())) { close(); out.push('<hr>'); }
      else if (line.trim()) { close(); out.push(`<p>${inl(line)}</p>`); }
      else close();
    }
    close();
    return out.join('');
  }

  const enDate = ts => new Date(ts).toISOString().replace(/[-:]|\.\d{3}/g, '');
  function toEnex(notes) {
    const xs = new XMLSerializer();
    const xhtml = n => [...new DOMParser().parseFromString('<body>' + n.content, 'text/html').body.childNodes].map(c => xs.serializeToString(c)).join('').replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '').replace(/]]>/g, ']]]]><![CDATA[>');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">\n<en-export export-date="${enDate(Date.now())}" application="Capynote" version="1.0">\n`
      + notes.map(n => `<note><title>${esc(ttl(n))}</title><content><![CDATA[<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>${xhtml(n)}</en-note>]]></content><created>${enDate(n.created)}</created><updated>${enDate(n.updated)}</updated>${n.tags.map(id => Store.tag(id)).filter(Boolean).map(t => `<tag>${esc(t.name)}</tag>`).join('')}</note>`).join('\n') + '\n</en-export>\n';
  }
  function fromEnex(text, notebookId) {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('ENEX inválido');
    const pd = s => { const m = /(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z/.exec(s || ''); return m ? Date.UTC(m[1], m[2] - 1, m[3], m[4], m[5], m[6]) : Date.now(); };
    let k = 0;
    for (const x of doc.querySelectorAll('note')) {
      const g = t => { const e = [...x.children].find(c => c.tagName === t); return e ? e.textContent : ''; };
      let c = g('content');
      const m = /<en-note[^>]*>([\s\S]*)<\/en-note>/.exec(c);
      c = (m ? m[1] : c).replace(/<en-todo[^>]*checked="true"[^>]*\/?>(<\/en-todo>)?/g, '☑ ').replace(/<en-todo[^>]*\/?>(<\/en-todo>)?/g, '☐ ').replace(/<en-media[^>]*\/?>(<\/en-media>)?/g, '').replace(/<(div|span|p)([^>]*)\/>/g, '<$1$2></$1>');
      for (const r of [...x.children].filter(c => c.tagName === 'resource')) {
        const mime = (r.querySelector('mime') || {}).textContent || 'application/octet-stream', data = ((r.querySelector('data') || {}).textContent || '').replace(/\s+/g, ''), name = (r.querySelector('file-name') || {}).textContent || 'anexo';
        if (!data) continue;
        c += mime.startsWith('image/') ? `<p><img src="data:${mime};base64,${data}" alt="${esc(name)}"></p>` : `<p><a class="attach" contenteditable="false" href="data:${mime};base64,${data}" download="${esc(name)}">${esc(name)}</a></p>`;
      }
      const tags = [...x.children].filter(c => c.tagName === 'tag').map(t => Store.tagByName(t.textContent, true)).filter(Boolean).map(t => t.id);
      Store.newNote({ title: g('title'), content: sanitize(c), created: pd(g('created')), updated: pd(g('updated') || g('created')), tags, notebookId });
      k++;
    }
    return k;
  }
  function backupData() { return JSON.stringify({ app: 'capynote', version: 1, exported: Date.now(), notes: S.notes, notebooks: S.notebooks, tags: S.tags, tasks: S.tasks, settings: S.set }); }
  async function restoreBackup(text) {
    const d = JSON.parse(text);
    if (d.app !== 'capynote' || !Array.isArray(d.notes)) throw new Error('Arquivo de backup inválido');
    const merge = (key, arr) => { for (const o of arr || []) { if (!o || !o.id) continue; const i = S[key].findIndex(x => x.id === o.id); if (i >= 0) S[key][i] = o; else S[key].push(o); DB.put(key, o); } };
    d.notes.forEach(n => { n.content = sanitize(n.content || ''); n.text = textOf(n.content); n.tags = n.tags || []; });
    merge('notebooks', d.notebooks); merge('tags', d.tags); merge('tasks', d.tasks); merge('notes', d.notes);
    const def = S.notebooks.filter(b => b.isDefault);
    def.slice(1).forEach(b => { b.isDefault = false; DB.put('notebooks', b); });
    return d.notes.length;
  }
  async function importFiles() {
    const files = await pickFiles('.enex,.json,.html,.htm,.md,.markdown,.txt', true);
    let total = 0;
    for (const f of files) {
      try {
        const text = await f.text(), ext = f.name.split('.').pop().toLowerCase(), base = f.name.replace(/\.[^.]+$/, '');
        if (ext === 'json') total += await restoreBackup(text);
        else if (ext === 'enex') { const nb = { id: uid(), name: base, stack: '', created: Date.now() }; S.notebooks.push(nb); await DB.put('notebooks', nb); total += fromEnex(text, nb.id); }
        else { Store.newNote({ title: base, content: ext === 'txt' ? text.split(/\r?\n/).map(l => `<p>${esc(l) || '<br>'}</p>`).join('') : /^(md|markdown)$/.test(ext) ? mdToHtml(text) : sanitize(text) }); total++; }
      } catch (e) { console.error(e); toast(`Falha ao importar "${f.name}": ${e.message}`); }
    }
    if (total) { toast(count(total, 'nota importada', 'notas importadas')); go({ type: 'notes' }); }
  }

  /* ---------- Sincronização com pasta do Google Drive (só no app de Windows) ---------- */
  const Sync = { avail: false, on: false, folder: null, detected: null, busy: false, again: false, last: 0, error: '' };
  const api = (path, opt = {}) => fetch('api/' + path, Object.assign({ cache: 'no-store' }, opt, { headers: { 'X-Capynote': '1' } }));
  async function syncInfo(r) {
    try {
      r = r || await api('sync/info');
      if (!r.ok) throw new Error('sem API');
      const j = await r.json();
      Object.assign(Sync, { avail: true, on: j.enabled, folder: j.folder, detected: j.detected, drives: j.drives || [] });
    } catch (e) { Sync.avail = Sync.on = false; }
  }
  const syncSig = d => DB.SYNCED.map(k => (d[k] || []).map(o => o.id + ':' + (o.mod || 0)).sort().join(',')).join('|') + '|' + Object.keys(d.tombstones || {}).sort().join(',');
  function mergeRemote(remote) {
    const tomb = DB.tomb();
    let n = 0;
    for (const [k, ts] of Object.entries(remote.tombstones || {})) {
      const [store, id] = k.split(':'), i = S[store] ? S[store].findIndex(o => o.id === id) : -1;
      if (i >= 0 && (S[store][i].mod || 0) <= ts) { S[store].splice(i, 1); DB.del(store, id, true); n++; }
      if (!(tomb[k] >= ts)) tomb[k] = ts;
    }
    for (const store of DB.SYNCED) {
      for (const o of remote[store] || []) {
        if (!o || !o.id || (tomb[store + ':' + o.id] || 0) >= (o.mod || 0)) continue;
        const i = S[store].findIndex(x => x.id === o.id);
        if (i >= 0 && (o.mod || 0) <= (S[store][i].mod || 0)) continue;
        if (store === 'notes') { o.content = sanitize(o.content || ''); o.text = textOf(o.content); o.tags = o.tags || []; }
        if (i < 0) S[store].push(o); else S[store][i] = o;
        DB.put(store, o, true); n++;
      }
    }
    DB.saveTomb();
    return n;
  }
  /* Primeira sincronização num aparelho novo: troca o conteúdo de exemplo pelo que já está no Drive. */
  function dropSeed() {
    const drop = (store, keep) => S[store].filter(o => o.seed && !keep(o)).forEach(o => { S[store] = S[store].filter(x => x !== o); DB.del(store, o.id, true); });
    drop('tasks', () => false); drop('notes', () => false);
    drop('notebooks', b => S.notes.some(n => n.notebookId === b.id));
    drop('tags', t => S.notes.some(n => n.tags.includes(t.id)));
  }
  async function syncNow(manual) {
    if (!Sync.on && !GSync.on()) return;
    if (Sync.busy) { Sync.again = true; return; }
    Sync.busy = true;
    try {
      commit();
      const r = await (Sync.on ? api('sync') : GSync.io());
      if (!r.ok) throw new Error('não foi possível ler a pasta');
      const text = r.status === 200 ? await r.text() : '', remote = text.trim() ? JSON.parse(text) : null;
      let pulled = 0;
      if (remote && remote.app === 'capynote') {
        if (!S.set.syncedOnce) dropSeed();
        pulled = mergeRemote(remote);
        if (!S.notebooks.length) await Store.seed();
        const defs = S.notebooks.filter(b => b.isDefault).sort((a, b) => a.created - b.created);
        if (!defs.length) { S.notebooks[0].isDefault = true; DB.put('notebooks', S.notebooks[0]); }
        defs.slice(1).forEach(b => { b.isDefault = false; DB.put('notebooks', b); });
      }
      const local = { app: 'capynote', version: 1, exported: Date.now(), notes: S.notes, notebooks: S.notebooks, tags: S.tags, tasks: S.tasks, tombstones: DB.tomb() };
      if (!remote || syncSig(remote) !== syncSig(local)) {
        const w = await (Sync.on ? api('sync', { method: 'POST', body: JSON.stringify(local) }) : GSync.io({ method: 'POST', body: JSON.stringify(local) }));
        if (!w.ok) throw new Error('não foi possível gravar na pasta');
      }
      if (!S.set.syncedOnce) { S.set.syncedOnce = true; Store.saveSet(); }
      Sync.last = Date.now(); Sync.error = '';
      if (pulled) { if (!Store.note(S.cur)) S.cur = null; if (dirty) { renderSidebar(); if (isList()) renderList(); } else render(); }
      if (manual) toast(pulled ? `Sincronizado: ${count(pulled, 'item atualizado', 'itens atualizados')}` : 'Sincronizado com o Google Drive');
    } catch (e) {
      console.error(e); Sync.error = e.message;
      if (manual) toast('Falha ao sincronizar: ' + e.message);
    }
    Sync.busy = false;
    if (Sync.again) { Sync.again = false; syncSoon(); }
  }
  const syncSoon = debounce(() => syncNow(), 4000);
  async function syncConfig(route, body) {
    await syncInfo(await api(route, { method: 'POST', body }));
    if (Sync.on) await syncNow(true);
  }

  /* ---------- Tema, lembretes ---------- */
  function applyTheme() { const t = S.set.theme; if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; }
  function notify(title, body, onclick) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try { const nt = new Notification(title, { body, icon: 'icons/icon-192.png' }); nt.onclick = () => { window.focus(); onclick(); }; }
      catch (e) { navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, icon: 'icons/icon-192.png' })); }
    } catch (e) { /* notificações indisponíveis */ }
  }
  function checkReminders() {
    const now = Date.now();
    for (const n of Store.live()) {
      if (n.reminder && !n.reminder.done && !n.reminder.fired && n.reminder.at <= now) {
        n.reminder.fired = true; Store.saveNote(n);
        toast('Lembrete: ' + ttl(n));
        notify('Capynote — lembrete', ttl(n), () => openNote(n.id));
      }
    }
  }
  function reminderModal() {
    const n = cur();
    if (!n) return;
    const loc = ts => { const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
    const tm = new Date(); tm.setDate(tm.getDate() + 1); tm.setHours(9, 0, 0, 0);
    const wk = new Date(tm); wk.setDate(wk.getDate() + 6);
    const m = modal({ title: 'Lembrete', body: `<label>Quando</label><input type="datetime-local" id="remat" value="${loc(n.reminder ? n.reminder.at : tm.getTime())}">
      <div class="tabs" style="margin-top:10px"><button class="tab" data-t="${Date.now() + 36e5}">Em 1 hora</button><button class="tab" data-t="${tm.getTime()}">Amanhã 9h</button><button class="tab" data-t="${wk.getTime()}">Em 1 semana</button></div>
      <p class="muted" style="margin:6px 0 0">Com o Capynote aberto, você recebe um aviso na hora marcada.</p>`,
      foot: `${n.reminder ? `<button class="btn ghost" data-rm>Remover</button><button class="btn ghost" data-done>${n.reminder.done ? 'Reabrir' : 'Concluir'}</button>` : ''}<button class="btn" data-ok>Salvar</button>` });
    const done = () => { touch(n); m.close(); $('#remchip').innerHTML = reminderChip(n); renderList(); renderSidebar(); };
    m.el.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.dataset.t) $('#remat', m.el).value = loc(+t.dataset.t);
      if ('rm' in t.dataset) { n.reminder = null; done(); }
      if ('done' in t.dataset) { n.reminder.done = !n.reminder.done; done(); }
      if ('ok' in t.dataset) {
        const at = new Date($('#remat', m.el).value).getTime();
        if (!at) return toast('Escolha data e hora');
        n.reminder = { at, done: false, fired: at <= Date.now() };
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        done();
      }
    });
  }

  /* ---------- Modais maiores ---------- */
  async function historyModal() {
    const n = cur();
    commit();
    const hs = (await DB.all('history')).filter(h => h.noteId === n.id).sort((a, b) => b.at - a.at);
    if (!hs.length) return toast('Ainda não há versões anteriores desta nota');
    const m = modal({ title: 'Histórico da nota', wide: true, body: `<div class="hist"><div id="hlist">${hs.map((h, i) => `<div class="row click" data-i="${i}"><span class="grow">${fmtFull(h.at)}</span></div>`).join('')}</div><div class="hist-prev" id="hprev"></div></div>`, foot: `<button class="btn" id="hrest">Restaurar esta versão</button>` });
    let sel = 0;
    const show = i => { sel = i; $('#hprev', m.el).innerHTML = `<h2>${esc(hs[i].title || 'Sem título')}</h2>` + sanitize(hs[i].content); $$('#hlist .row', m.el).forEach((r, j) => r.style.background = j === i ? 'var(--sel)' : ''); };
    show(0);
    $('#hlist', m.el).onclick = e => { const r = e.target.closest('[data-i]'); if (r) show(+r.dataset.i); };
    $('#hrest', m.el).onclick = async () => { await Store.snapshot({ ...n }); n.title = hs[sel].title; n.content = hs[sel].content; n.text = textOf(n.content); touch(n); m.close(); render(); toast('Versão restaurada'); };
  }
  function infoModal() {
    const n = cur();
    commit();
    const words = n.text ? n.text.split(/\s+/).length : 0, nb = Store.nb(n.notebookId);
    const r = (a, b) => `<div class="row"><span class="muted" style="width:130px">${a}</span><span class="grow">${esc(b)}</span></div>`;
    modal({ title: 'Informações da nota', body: r('Título', ttl(n)) + r('Caderno', nb ? nb.name : '—') + r('Criada', fmtFull(n.created)) + r('Atualizada', fmtFull(n.updated)) + r('Palavras', words) + r('Caracteres', n.text.length) + r('Tamanho', fmtSize(n.content.length)) + r('Imagens', (n.content.match(/<img/g) || []).length) + r('Anexos', (n.content.match(/class="attach"/g) || []).length) });
  }
  async function settingsModal() {
    let usage = '';
    try { const e = await navigator.storage.estimate(); usage = `${fmtSize(e.usage)} usados neste dispositivo`; } catch (e) { /* sem estimativa */ }
    const np = 'Notification' in window ? Notification.permission : 'unsupported';
    const m = modal({ title: 'Ajustes', body: `
      <label>Tema</label><select id="settheme"><option value="auto">Automático (segue o sistema)</option><option value="light">Claro</option><option value="dark">Escuro</option></select>
      ${Sync.avail ? `<label>Sincronização com o Google Drive</label>
      <p style="margin:0 0 6px">${Sync.on ? `Ativa em <b>${esc(Sync.folder)}</b>${Sync.error ? ` · <span style="color:var(--danger)">${esc(Sync.error)}</span>` : Sync.last ? ` · última vez ${fmtRel(Sync.last)}` : ''}` : Sync.detected ? 'Desativada. Google Drive encontrado neste computador.' : 'Desativada. Não encontrei o Google Drive; escolha uma pasta sincronizada.'}</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${Sync.on ? `<button class="btn ghost sm" data-k="syncnow">Sincronizar agora</button><button class="btn ghost sm" data-k="syncoff">Desativar</button>` : Sync.detected ? `<button class="btn sm" data-k="syncauto">Ativar no Google Drive</button>` : ''}${(Sync.drives || []).filter(d => d !== Sync.folder && (Sync.on || d !== Sync.detected)).map(d => `<button class="btn ghost sm" data-k="syncuse" data-path="${esc(d)}">Usar ${esc(d)}</button>`).join('')}<button class="btn ghost sm" data-k="syncpick">Escolher outra pasta…</button></div>
      ${(Sync.drives || []).length > 1 ? '<p class="muted" style="margin:6px 0 0">Há mais de uma conta do Google Drive neste computador: cada unidade (G:, H:…) é uma conta.</p>' : ''}
      <p class="muted" style="margin:6px 0 0">O Capynote grava o arquivo capynote-sync.json nessa pasta a cada alteração e o Google Drive o envia para a sua conta. Outro computador com o Capynote e o mesmo Drive recebe as notas automaticamente.</p>` : ''}
      ${!Sync.avail && GSync.web ? GSync.html() : ''}<label>Backup e migração</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn ghost sm" data-k="backup">${ic('dl')} Exportar backup (.json)</button><button class="btn ghost sm" data-k="enex">${ic('dl')} Exportar tudo (.enex)</button><button class="btn ghost sm" data-k="import">${ic('up')} Importar…</button></div>
      <p class="muted" style="margin:6px 0 0">Importa backups do Capynote, arquivos .enex do Evernote, HTML, Markdown e texto. Para levar suas notas a outro aparelho, exporte o backup aqui e importe lá.</p>
      <label>Aplicativo</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${installEvt ? `<button class="btn sm" data-k="install">Instalar o Capynote neste aparelho</button>` : ''}${np === 'default' ? `<button class="btn ghost sm" data-k="notif">${ic('bell')} Ativar notificações</button>` : `<span class="chip">Notificações: ${{ granted: 'ativadas', denied: 'bloqueadas', unsupported: 'indisponíveis' }[np]}</span>`}</div>
      <p class="muted" style="margin:10px 0 0">${DB.persistent() ? 'Dados salvos localmente' : 'Atenção: armazenamento indisponível, os dados somem ao fechar'}${usage ? ' · ' + usage : ''} · Capynote 1.0</p>
      <label>Zona de perigo</label><button class="btn danger sm" data-k="wipe">Apagar todos os dados</button>` });
    $('#settheme', m.el).value = S.set.theme;
    $('#settheme', m.el).onchange = e => { S.set.theme = e.target.value; Store.saveSet(); applyTheme(); };
    m.el.addEventListener('click', async e => {
      const k = (e.target.closest('[data-k]') || { dataset: {} }).dataset.k, stamp = today();
      if (k === 'backup') download(`capynote-backup-${stamp}.json`, 'application/json', backupData());
      if (k === 'enex') download(`capynote-${stamp}.enex`, 'application/xml', toEnex(Store.live()));
      if (k === 'import') { m.close(); importFiles(); }
      if (k === 'install') { installEvt.prompt(); installEvt = null; m.close(); }
      if (k === 'notif') { await Notification.requestPermission(); m.close(); settingsModal(); }
      if (k === 'syncnow') { await syncNow(true); m.close(); settingsModal(); }
      if (k === 'syncoff') { await syncConfig('sync/config', 'off'); m.close(); settingsModal(); }
      if (k === 'syncauto') { await syncConfig('sync/config', 'auto'); m.close(); settingsModal(); }
      if (k === 'syncuse') { await syncConfig('sync/config', e.target.closest('[data-k]').dataset.path); m.close(); settingsModal(); }
      if (k === 'syncpick') { toast('Escolha a pasta na janela que abriu'); await syncConfig('sync/choose', ''); m.close(); settingsModal(); }
      if (k === 'wipe' && await confirmBox('Apagar tudo', 'Todas as notas, cadernos, etiquetas e tarefas deste dispositivo serão apagados. Isso não pode ser desfeito.' + (Sync.on ? ' A sincronização será desativada e a cópia no Google Drive continua lá.' : ''), 'Apagar tudo', true)) {
        if (Sync.on) await api('sync/config', { method: 'POST', body: 'off' }); GSync.off();
        for (const s of DB.STORES) await DB.clear(s);
        location.reload();
      }
    });
  }
  async function quick() {
    const items = [
      ...Store.live().sort((a, b) => b.updated - a.updated).map(n => ({ id: 'n:' + n.id, label: ttl(n), sub: 'nota · ' + fmtRel(n.updated) })),
      ...S.notebooks.map(b => ({ id: 'b:' + b.id, label: b.name, sub: 'caderno' })),
      ...S.tags.map(t => ({ id: 't:' + t.id, label: '#' + t.name, sub: 'etiqueta' })),
      ...[['home', 'Início'], ['tasks', 'Tarefas'], ['calendar', 'Calendário'], ['templates', 'Modelos'], ['trash', 'Lixeira']].map(([k, l]) => ({ id: 'v:' + k, label: l, sub: 'ir para' })),
    ];
    const r = await pick('Buscar e ir para…', items, 'Digite o nome de uma nota, caderno ou etiqueta');
    if (!r) return;
    const [k, id] = [r[0], r.slice(2)];
    if (k === 'n') openNote(id); else go(k === 'b' ? { type: 'notebook', id } : k === 't' ? { type: 'tag', id } : { type: id });
  }
  async function useTemplate(id) {
    const tpls = S.notes.filter(n => n.isTemplate && !n.deleted);
    id = id || await pick('Nova nota de modelo', tpls.map(t => ({ id: t.id, label: ttl(t), sub: t.text.slice(0, 40) })));
    const t = Store.note(id);
    if (t) { S.view = { type: 'notes' }; createNote({ title: t.title, content: t.content, notebookId: Store.defaultNb().id, tags: [] }); }
  }
  async function newNotebook() {
    const name = await ask('Novo caderno', 'Nome do caderno');
    if (!name) return;
    const nb = { id: uid(), name, stack: S.view.type === 'stack' ? S.view.id : '', created: Date.now() };
    S.notebooks.push(nb); await DB.put('notebooks', nb);
    go({ type: 'notebook', id: nb.id });
  }
  function notebookMenu(anchor, nb) {
    const save = () => { DB.put('notebooks', nb); render(); };
    popmenu(anchor, [
      { label: 'Renomear', icon: 'pen', fn: async () => { const v = await ask('Renomear caderno', 'Nome', nb.name); if (v) { nb.name = v; save(); } } },
      { label: nb.stack ? 'Mudar de pilha…' : 'Adicionar a uma pilha…', icon: 'stack', fn: async () => { const v = await ask('Pilha', 'Nome da pilha (existente ou nova)', nb.stack || ''); if (v !== null) { nb.stack = v; save(); } } },
      ...(nb.stack ? [{ label: 'Remover da pilha', icon: 'x', fn: () => { nb.stack = ''; save(); } }] : []),
      { label: nb.shortcut ? 'Remover dos atalhos' : 'Adicionar aos atalhos', icon: 'star', fn: () => { nb.shortcut = !nb.shortcut; save(); } },
      ...(nb.isDefault ? [] : [{ label: 'Definir como padrão', icon: 'check', fn: () => { S.notebooks.forEach(b => { if (b.isDefault) { b.isDefault = false; DB.put('notebooks', b); } }); nb.isDefault = true; save(); } }]),
      { label: 'Exportar caderno (.enex)', icon: 'dl', fn: () => download(safeName(nb.name) + '.enex', 'application/xml', toEnex(Store.live().filter(n => n.notebookId === nb.id))) },
      '-',
      { label: 'Excluir caderno', icon: 'trash', danger: true, fn: async () => {
        if (S.notebooks.length < 2) return toast('É preciso manter ao menos um caderno');
        if (!await confirmBox('Excluir caderno', `As notas de "${nb.name}" irão para a lixeira.`, 'Excluir', true)) return;
        S.notebooks = S.notebooks.filter(b => b !== nb); await DB.del('notebooks', nb.id);
        if (nb.isDefault) { S.notebooks[0].isDefault = true; DB.put('notebooks', S.notebooks[0]); }
        const def = Store.defaultNb();
        S.notes.filter(n => n.notebookId === nb.id).forEach(n => { n.notebookId = def.id; if (!n.deleted && !n.isTemplate) n.deleted = Date.now(); Store.saveNote(n); });
        go({ type: 'notebooks' });
      } },
    ]);
  }
  function tagMenu(anchor, t) {
    popmenu(anchor, [
      { label: 'Renomear', icon: 'pen', fn: async () => { const v = await ask('Renomear etiqueta', 'Nome', t.name); if (v) { t.name = v.replace(/^#/, ''); DB.put('tags', t); render(); } } },
      { label: 'Excluir etiqueta', icon: 'trash', danger: true, fn: async () => {
        if (!await confirmBox('Excluir etiqueta', `"${t.name}" será removida de todas as notas. As notas continuam.`, 'Excluir', true)) return;
        S.tags = S.tags.filter(x => x !== t); DB.del('tags', t.id);
        S.notes.filter(n => n.tags.includes(t.id)).forEach(n => { n.tags = n.tags.filter(i => i !== t.id); Store.saveNote(n); });
        go({ type: 'tags' });
      } },
    ]);
  }
  const taskOf = el => S.tasks.find(t => t.id === el.closest('[data-tid]').dataset.tid);
  const saveTask = t => { DB.put('tasks', t); refreshTasks(); };

  /* ---------- Ações (data-act / data-change / data-enter / data-input) ---------- */
  const A = {
    go: el => go({ type: el.dataset.type, id: el.dataset.id, q: el.dataset.q }),
    open: el => openNote(el.dataset.id),
    back() { commit(); document.body.classList.remove('m-main'); renderList(); },
    openSide: () => document.body.classList.add('side-open'),
    closeSide: () => document.body.classList.remove('side-open'),
    focus: () => document.body.classList.toggle('focus'),
    quick,
    settings: settingsModal,
    theme() { const dark = S.set.theme === 'dark' || (S.set.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches); S.set.theme = dark ? 'light' : 'dark'; Store.saveSet(); applyTheme(); },
    newNote: () => createNote(),
    newMenu: el => popmenu(el, [{ label: 'Nova nota', icon: 'note', fn: () => createNote() }, { label: 'Nova nota de modelo…', icon: 'tpl', fn: () => useTemplate() }, { label: 'Novo caderno', icon: 'book', fn: newNotebook }, { label: 'Nova tarefa', icon: 'tasks', fn: () => { go({ type: 'tasks' }); setTimeout(() => $('[data-enter="addTask"]').focus(), 50); } }, '-', { label: 'Importar arquivos…', icon: 'up', fn: importFiles }]),
    useTpl: el => useTemplate(el.dataset.id),
    newNotebook,
    async newTag() { const v = await ask('Nova etiqueta', 'Nome'); if (v) { Store.tagByName(v, true); render(); } },
    nbMenu: (el, e) => { e.stopPropagation(); notebookMenu(el, Store.nb(el.dataset.id)); },
    tagMenu: (el, e) => { e.stopPropagation(); tagMenu(el, Store.tag(el.dataset.id)); },
    viewMenu(el) {
      const v = S.view;
      if (v.type === 'notebook') return notebookMenu(el, Store.nb(v.id));
      if (v.type === 'tag') return tagMenu(el, Store.tag(v.id));
      const nbs = S.notebooks.filter(b => b.stack === v.id), apply = name => { nbs.forEach(b => { b.stack = name; DB.put('notebooks', b); }); go(name ? { type: 'stack', id: name } : { type: 'notebooks' }); };
      popmenu(el, [{ label: 'Renomear pilha', icon: 'pen', fn: async () => { const n = await ask('Renomear pilha', 'Nome', v.id); if (n) apply(n); } }, { label: 'Novo caderno nesta pilha', icon: 'book', fn: newNotebook }, { label: 'Desfazer pilha', icon: 'x', danger: true, fn: () => apply('') }]);
    },
    sortMenu: el => popmenu(el, [['updated-desc', 'Atualizadas recentemente'], ['updated-asc', 'Atualizadas há mais tempo'], ['created-desc', 'Criadas recentemente'], ['created-asc', 'Criadas há mais tempo'], ['title-asc', 'Título A–Z'], ['title-desc', 'Título Z–A']].map(([k, l]) => ({ label: l, icon: S.set.sort === k ? 'check' : '', fn: () => { S.set.sort = k; Store.saveSet(); renderList(); } }))),
    modeMenu: el => popmenu(el, [['snippets', 'Lista com resumo'], ['cards', 'Cartões'], ['compact', 'Lista compacta']].map(([k, l]) => ({ label: l, icon: S.set.mode === k ? 'check' : '', fn: () => { S.set.mode = k; Store.saveSet(); renderList(); } }))),
    saveSearch() { S.set.searches.push(S.view.q); Store.saveSet(); renderSidebar(); renderList(); toast('Pesquisa salva na barra lateral'); },
    dropSearch() { S.set.searches = S.set.searches.filter(q => q !== S.view.q); Store.saveSet(); renderSidebar(); renderList(); },
    async emptyTrash() {
      const ns = S.notes.filter(n => n.deleted);
      if (await confirmBox('Esvaziar lixeira', `${count(ns.length, 'nota será excluída', 'notas serão excluídas')} para sempre.`, 'Esvaziar', true)) { for (const n of ns) await Store.purge(n); S.cur = null; render(); }
    },
    toggleShortcut(el) { const n = cur(); n.shortcut = !n.shortcut; Store.saveNote(n); el.classList.toggle('on', n.shortcut); renderSidebar(); renderList(); },
    reminder: reminderModal,
    restore() { const n = cur(); n.deleted = null; touch(n); toast('Nota restaurada'); S.view = { type: 'notes' }; render(); },
    async purge() { const n = cur(); if (await confirmBox('Excluir para sempre', `"${ttl(n)}" não poderá ser recuperada.`, 'Excluir', true)) { await Store.purge(n); S.cur = null; document.body.classList.remove('m-main'); render(); } },
    rmTag(el) { const n = cur(); n.tags = n.tags.filter(i => i !== el.dataset.id); touch(n); $('#tagchips').innerHTML = tagChips(n); renderList(); renderSidebar(); },
    addTag(el) {
      const n = cur();
      for (const name of el.value.split(',')) { const t = Store.tagByName(name, true); if (t && !n.tags.includes(t.id)) n.tags.push(t.id); }
      el.value = ''; touch(n); $('#tagchips').innerHTML = tagChips(n); renderList(); renderSidebar();
    },
    moveNote(el) { const n = cur(); n.notebookId = el.value; touch(n); renderSidebar(); if (isList()) renderList(); toast('Nota movida para ' + Store.nb(el.value).name); },
    noteMenu(el) {
      const n = cur();
      commit();
      if (n.deleted) return popmenu(el, [{ label: 'Restaurar', icon: 'undo', fn: A.restore }, { label: 'Excluir para sempre', icon: 'trash', danger: true, fn: A.purge }]);
      const file = safeName(ttl(n));
      popmenu(el, [
        { label: 'Duplicar', icon: 'copy', fn: () => { const c = Store.newNote({ title: ttl(n) + ' (cópia)', content: n.content, notebookId: n.notebookId, tags: [...n.tags], isTemplate: n.isTemplate }); openNote(c.id); } },
        { label: 'Mesclar com outra nota…', icon: 'merge', fn: async () => {
          const id = await pick('Mesclar com…', Store.live().filter(x => x.id !== n.id).map(x => ({ id: x.id, label: ttl(x), sub: fmtRel(x.updated) })));
          const o = Store.note(id);
          if (!o) return;
          await Store.snapshot({ ...n });
          n.content += `<hr><h2>${esc(ttl(o))}</h2>` + o.content; n.text = textOf(n.content); n.tags = [...new Set([...n.tags, ...o.tags])]; touch(n);
          o.deleted = Date.now(); Store.saveNote(o); render(); toast('Notas mescladas; a outra foi para a lixeira');
        } },
        { label: n.isTemplate ? 'Criar nota a partir do modelo' : 'Salvar como modelo', icon: 'tpl', fn: () => { if (n.isTemplate) return useTemplate(n.id); Store.newNote({ title: ttl(n), content: n.content, isTemplate: true }); renderSidebar(); toast('Modelo criado em Modelos'); } },
        { label: 'Histórico de versões', icon: 'clock', fn: historyModal },
        { label: 'Informações da nota', icon: 'info', fn: infoModal },
        '-',
        { label: 'Compartilhar…', icon: 'share', fn: async () => { const text = ttl(n) + '\n\n' + toMarkdown(n.content); try { if (navigator.share) await navigator.share({ title: ttl(n), text }); else { await navigator.clipboard.writeText(text); toast('Texto da nota copiado'); } } catch (e) { /* cancelado */ } } },
        { label: 'Exportar como HTML', icon: 'dl', fn: () => download(file + '.html', 'text/html', noteDoc(n)) },
        { label: 'Exportar como Markdown', icon: 'dl', fn: () => download(file + '.md', 'text/markdown', `# ${ttl(n)}\n\n` + toMarkdown(n.content)) },
        { label: 'Exportar como ENEX (Evernote)', icon: 'dl', fn: () => download(file + '.enex', 'application/xml', toEnex([n])) },
        { label: 'Imprimir / salvar em PDF', icon: 'print', fn: () => window.print() },
        '-',
        { label: 'Mover para a lixeira', icon: 'trash', danger: true, fn: () => { n.deleted = Date.now(); Store.saveNote(n); S.cur = null; document.body.classList.remove('m-main'); if (isList()) { const ns = viewNotes(); if (!isMobile() && ns[0]) S.cur = ns[0].id; } render(); toast('Nota movida para a lixeira'); } },
      ]);
    },
    scratch: debounce(el => { S.set.scratch = el.value; Store.saveSet(); }, 400),
    scratchToNote() { const v = $('#scratch').value.trim(); if (!v) return toast('O rascunho está vazio'); S.set.scratch = ''; Store.saveSet(); createNote({ title: v.split('\n')[0].slice(0, 60), content: v.split('\n').map(l => `<p>${esc(l) || '<br>'}</p>`).join('') }); },
    addTask(el) {
      const title = el.value.trim();
      if (!title) return;
      const t = { id: uid(), title, done: false, due: el.dataset.due || '', flag: false, noteId: el.dataset.note || null, created: Date.now() };
      S.tasks.push(t); DB.put('tasks', t); el.value = '';
      refreshTasks();
      const again = $(`[data-enter="addTask"]${t.noteId ? '[data-note]' : ''}`); if (again) again.focus();
    },
    taskDone(el) { const t = taskOf(el); t.done = el.checked; saveTask(t); },
    taskTitle(el) { const t = taskOf(el); t.title = el.value.trim() || t.title; saveTask(t); },
    taskDue(el) { const t = taskOf(el); t.due = el.value; saveTask(t); },
    taskFlag(el) { const t = taskOf(el); t.flag = !t.flag; saveTask(t); },
    taskDel(el) { const t = taskOf(el); S.tasks = S.tasks.filter(x => x !== t); DB.del('tasks', t.id); refreshTasks(); },
    taskTab(el) { S.set.taskTab = el.dataset.id; Store.saveSet(); renderMain(); },
    clearDone() { S.tasks.filter(t => t.done).forEach(t => DB.del('tasks', t.id)); S.tasks = S.tasks.filter(t => !t.done); renderMain(); },
    calDay(el) { calSel = el.dataset.id; renderMain(); },
    calNav(el) { const d = +el.dataset.id; calMonth = d ? new Date(calMonth.getFullYear(), calMonth.getMonth() + d, 1) : new Date(); if (!d) calSel = today(); renderMain(); },
  };

  /* ---------- Inicialização ---------- */
  async function init() {
    await Store.load();
    applyTheme();
    document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t && A[t.dataset.act]) A[t.dataset.act](t, e); });
    document.addEventListener('change', e => { const f = e.target.dataset && A[e.target.dataset.change]; if (f) f(e.target, e); });
    document.addEventListener('input', e => { const f = e.target.dataset && A[e.target.dataset.input]; if (f) f(e.target, e); });
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Enter' && e.target.dataset && A[e.target.dataset.enter]) { e.preventDefault(); return A[e.target.dataset.enter](e.target, e); }
      if (e.key === 'Escape') { const ov = $$('.ov').pop(); if (ov) ov._close(); else document.body.classList.remove('focus', 'side-open'); }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); quick(); }
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); dirty = dirty || !!$('#body[contenteditable]'); commit(); toast('Nota salva'); }
      if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); createNote(); }
    });
    $('#q').addEventListener('input', debounce(() => {
      const q = $('#q').value.trim();
      commit();
      if (q) { S.view = { type: 'search', q }; const ns = viewNotes(); if (!isMobile()) S.cur = ns[0] ? ns[0].id : null; }
      else { S.view = { type: 'notes' }; }
      renderSidebar(); renderList(); renderMain();
    }, 200));
    window.addEventListener('beforeunload', commit);
    document.addEventListener('visibilitychange', () => { if (document.hidden) commit(); else checkReminders(); });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    S.view = { type: 'home' };
    render();
    if (location.hash === '#new') { history.replaceState(null, '', location.pathname); createNote(); }
    checkReminders();
    setInterval(checkReminders, 30000);
    if (/^https?:$/.test(location.protocol)) await syncInfo();
    if (Sync.avail || GSync.web) {
      GSync.onChange = () => syncNow(true);
      const first = Sync.on && !S.set.syncedOnce;
      DB.onChange = () => { if (Sync.on || GSync.on()) syncSoon(); };
      await syncNow();
      if (first && !Sync.error) toast('Sincronizando com o Google Drive: ' + Sync.folder);
      setInterval(() => syncNow(), 60000);
      window.addEventListener('focus', () => syncNow());
    }
  }
  init();

  return { openNote, go };
})();
