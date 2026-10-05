'use strict';
/* Capynote — componentes de interface (toast, modal, menu) e editor de texto rico */

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2800);
}

function modal({ title, body, foot = '', wide = false }) {
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><div class="m-h"><h3>${esc(title)}</h3><button class="ib" data-x>${ic('x')}</button></div><div class="m-b">${body}</div>${foot ? `<div class="m-f">${foot}</div>` : ''}</div>`;
  document.body.append(ov);
  const m = { el: ov, onclose: null, close() { if (!ov.isConnected) return; ov.remove(); if (m.onclose) m.onclose(); } };
  ov._close = m.close;
  ov.addEventListener('mousedown', e => { if (e.target === ov) m.close(); });
  $('[data-x]', ov).onclick = m.close;
  return m;
}

function ask(title, label, value = '', type = 'text') {
  return new Promise(res => {
    const m = modal({ title, body: `<label>${esc(label)}</label><input type="${type}" id="askv" value="${esc(value)}">`, foot: `<button class="btn ghost" data-c>Cancelar</button><button class="btn" data-ok>OK</button>` });
    const inp = $('#askv', m.el);
    let out = null;
    m.onclose = () => res(out);
    const ok = () => { out = inp.value.trim(); m.close(); };
    $('[data-ok]', m.el).onclick = ok; $('[data-c]', m.el).onclick = m.close;
    inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
    setTimeout(() => { inp.focus(); if (type === 'text') inp.select(); }, 30);
  });
}

function confirmBox(title, msg, okLabel = 'Confirmar', danger = false) {
  return new Promise(res => {
    const m = modal({ title, body: `<p>${esc(msg)}</p>`, foot: `<button class="btn ghost" data-c>Cancelar</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(okLabel)}</button>` });
    let out = false;
    m.onclose = () => res(out);
    $('[data-ok]', m.el).onclick = () => { out = true; m.close(); };
    $('[data-c]', m.el).onclick = m.close;
  });
}

/* Lista filtrável; items: [{id, label, sub}] */
function pick(title, items, placeholder = 'Filtrar…') {
  return new Promise(res => {
    const m = modal({ title, body: `<input type="text" id="pickq" placeholder="${esc(placeholder)}"><div id="pickl" style="margin-top:8px;max-height:50dvh;overflow:auto"></div>` });
    let out = null;
    m.onclose = () => res(out);
    const draw = () => {
      const q = norm($('#pickq', m.el).value);
      const rows = items.filter(i => norm(i.label + ' ' + (i.sub || '')).includes(q)).slice(0, 200);
      $('#pickl', m.el).innerHTML = rows.map(i => `<div class="row click" data-id="${esc(i.id)}"><span class="grow">${esc(i.label)}</span><small class="muted">${esc(i.sub || '')}</small></div>`).join('') || '<p class="muted">Nada encontrado.</p>';
    };
    draw();
    $('#pickq', m.el).oninput = draw;
    $('#pickl', m.el).onclick = e => { const r = e.target.closest('[data-id]'); if (r) { out = r.dataset.id; m.close(); } };
    setTimeout(() => $('#pickq', m.el).focus(), 30);
  });
}

/* items: [{label, icon, fn, danger}] ou '-' para separador */
function popmenu(anchor, items) {
  $$('.pop').forEach(p => p.remove());
  const p = document.createElement('div');
  p.className = 'pop';
  p.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span></button>`).join('');
  document.body.append(p);
  const r = anchor.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  p.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
  p.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  p.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { p.remove(); items[+b.dataset.i].fn(); } };
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!p.contains(e.target)) p.remove(); if (!p.isConnected) document.removeEventListener('pointerdown', off); }), 0);
}

function pickFiles(accept = '', multiple = false) {
  return new Promise(res => {
    const f = $('#filepick');
    f.value = ''; f.accept = accept; f.multiple = multiple;
    f.onchange = () => res([...f.files]);
    f.click();
  });
}
async function download(name, mime, data) {
  // Publicado como página no claude.ai, o salvamento passa pela confirmação do visualizador.
  const cap = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if (cap) {
    try {
      if (typeof data === 'string' && data.startsWith('data:')) {
        const [head, b64] = data.split(','), bin = atob(b64), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        data = new Blob([bytes], { type: head.slice(5).split(';')[0] });
      }
      if (/\.enex$/i.test(name)) { name += '.txt'; toast('Salvo como .txt: renomeie para .enex antes de importar'); }
      await cap.save({ filename: name, data });
    } catch (e) {
      if (e.code !== 'declined') toast(e.code === 'rejected_extension' ? 'Este tipo de arquivo não pode ser salvo nesta versão' : 'Não foi possível salvar o arquivo');
    }
    return;
  }
  const a = document.createElement('a');
  a.href = data instanceof Blob || typeof data !== 'string' || !data.startsWith('data:') ? URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: mime })) : data;
  a.download = name; document.body.append(a); a.click(); a.remove();
}
const fileToDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

const Editor = (() => {
  let el = null, onChange = () => {}, saved = null, rec = null;
  const inEl = n => el && n && el.contains(n);
  document.addEventListener('selectionchange', () => { const s = getSelection(); if (s.rangeCount && inEl(s.anchorNode)) saved = s.getRangeAt(0).cloneRange(); });

  function restore() {
    el.focus();
    if (saved && inEl(saved.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
  }
  function exec(cmd, val = null) { restore(); document.execCommand(cmd, false, val); onChange(); }
  function near(sel) {
    const s = getSelection(); let n = s.rangeCount ? s.anchorNode : null;
    if (n && n.nodeType === 3) n = n.parentNode;
    const r = n && n.closest ? n.closest(sel) : null;
    return inEl(r) ? r : null;
  }

  const B = (attr, icon, title, extra = '') => `<button ${attr} title="${title}" ${extra}>${IC[icon] ? ic(icon) : icon}</button>`;
  const toolbar = () => `
    ${B('data-cmd="undo"', 'undo', 'Desfazer')}${B('data-cmd="redo"', 'redo', 'Refazer')}<span class="sep"></span>
    <select data-sel="formatBlock" title="Estilo"><option value="P">Texto normal</option><option value="H1">Título 1</option><option value="H2">Título 2</option><option value="H3">Título 3</option><option value="BLOCKQUOTE">Citação</option><option value="PRE">Código</option></select>
    <select data-sel="fontName" title="Fonte"><option value="Segoe UI, system-ui, sans-serif">Sans</option><option value="Georgia, serif">Serifada</option><option value="Consolas, monospace">Mono</option><option value="Comic Sans MS, cursive">Manuscrita</option></select>
    <select data-sel="fontSize" title="Tamanho"><option value="3">Normal</option><option value="2">Pequeno</option><option value="4">Grande</option><option value="5">Maior</option><option value="6">Enorme</option></select>
    <span class="sep"></span>
    ${B('data-cmd="bold"', '<b>N</b>', 'Negrito (Ctrl+B)')}${B('data-cmd="italic"', '<i>I</i>', 'Itálico (Ctrl+I)')}${B('data-cmd="underline"', '<u>S</u>', 'Sublinhado (Ctrl+U)')}${B('data-cmd="strikeThrough"', '<s>T</s>', 'Tachado')}
    ${B('data-ed="hilite"', '<span style="background:var(--hl);padding:0 5px;border-radius:3px">A</span>', 'Marca-texto')}
    <input type="color" data-color="foreColor" value="#c8402f" title="Cor do texto">
    <span class="sep"></span>
    ${B('data-cmd="insertUnorderedList"', 'ul', 'Lista com marcadores')}${B('data-cmd="insertOrderedList"', 'ol', 'Lista numerada')}${B('data-ed="checklist"', 'todo', 'Lista de verificação')}
    ${B('data-cmd="outdent"', 'outdent', 'Diminuir recuo')}${B('data-cmd="indent"', 'indent', 'Aumentar recuo')}
    ${B('data-cmd="justifyLeft"', 'alignl', 'Alinhar à esquerda')}${B('data-cmd="justifyCenter"', 'alignc', 'Centralizar')}${B('data-cmd="justifyRight"', 'alignr', 'Alinhar à direita')}
    <span class="sep"></span>
    ${B('data-ed="link"', 'link', 'Link')}${B('data-ed="notelink"', 'note', 'Link para outra nota')}${B('data-ed="table"', 'table', 'Tabela')}${B('data-cmd="insertHorizontalRule"', 'hr', 'Linha divisória')}${B('data-ed="code"', 'code', 'Bloco de código')}
    ${B('data-ed="image"', 'img', 'Imagem')}${B('data-ed="attach"', 'clip', 'Anexar arquivo')}${B('data-ed="audio"', 'mic', 'Gravar áudio')}${B('data-ed="sketch"', 'pen', 'Desenho')}${B('data-ed="date"', 'cal', 'Inserir data e hora')}
    <span class="sep"></span>${B('data-ed="clear"', 'erase', 'Limpar formatação')}`;

  async function imageData(f) {
    const url = await fileToDataURL(f);
    if (/gif|svg/.test(f.type) || f.size < 400000) return url;
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', .85);
  }
  async function insertImages(files) {
    for (const f of files) { try { exec('insertHTML', `<img src="${await imageData(f)}" alt="${esc(f.name)}"><p><br></p>`); } catch (e) { toast('Não foi possível ler a imagem'); } }
  }

  const tableOps = {
    row(td, after = true) { const tr = td.parentNode, n = tr.cloneNode(true); $$('td,th', n).forEach(c => c.innerHTML = '<br>'); tr[after ? 'after' : 'before'](n); },
    col(td) { const i = td.cellIndex; $$('tr', td.closest('table')).forEach(tr => { const c = document.createElement(tr.cells[i].tagName); c.innerHTML = '<br>'; tr.cells[i].after(c); }); },
    delRow(td) { const t = td.closest('table'); td.parentNode.remove(); if (!$('tr', t)) t.remove(); },
    delCol(td) { const i = td.cellIndex, t = td.closest('table'); $$('tr', t).forEach(tr => tr.cells[i] && tr.cells[i].remove()); if (!$('td,th', t)) t.remove(); },
  };

  const custom = {
    hilite() { restore(); const on = document.queryCommandValue('hiliteColor'); exec('hiliteColor', /255,\s*242,\s*168|fff2a8/i.test(on) ? 'transparent' : '#fff2a8'); },
    checklist() {
      restore();
      let ul = near('ul');
      if (ul && ul.classList.contains('checklist')) ul.removeAttribute('class');
      else { if (!ul) document.execCommand('insertUnorderedList'); ul = near('ul'); if (ul) { ul.className = 'checklist'; if (ul.parentNode.tagName === 'P') ul.parentNode.replaceWith(ul); } }
      onChange();
    },
    async link() {
      const a = near('a');
      let url = await ask('Link', 'Endereço (URL)', a ? a.getAttribute('href') : 'https://');
      if (!url) return;
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
      if (/^javascript:/i.test(url)) return;
      restore();
      if (a) { a.href = url; onChange(); } else if (getSelection().isCollapsed) exec('insertHTML', `<a href="${esc(url)}">${esc(url)}</a>&nbsp;`);
      else exec('createLink', url);
    },
    async notelink() {
      const id = await pick('Link para nota', Store.live().filter(n => n.id !== S.cur).sort((a, b) => b.updated - a.updated).map(n => ({ id: n.id, label: n.title || 'Sem título', sub: fmtRel(n.updated) })));
      if (id) exec('insertHTML', `<a class="notelink" href="#note/${id}">${esc(Store.note(id).title || 'Sem título')}</a>&nbsp;`);
    },
    async table(btn) {
      const td = near('td,th');
      if (td) {
        const op = (f, ...a) => () => { tableOps[f](td, ...a); onChange(); };
        return popmenu(btn, [{ label: 'Inserir linha abaixo', fn: op('row') }, { label: 'Inserir linha acima', fn: op('row', false) }, { label: 'Inserir coluna à direita', fn: op('col') }, '-', { label: 'Excluir linha', fn: op('delRow'), danger: true }, { label: 'Excluir coluna', fn: op('delCol'), danger: true }, { label: 'Excluir tabela', fn: () => { td.closest('table').remove(); onChange(); }, danger: true }]);
      }
      const v = await ask('Inserir tabela', 'Linhas x colunas', '3x3');
      const m = /(\d+)\D+(\d+)/.exec(v || '');
      if (!m) return;
      const r = Math.min(50, +m[1] || 1), c = Math.min(12, +m[2] || 1);
      exec('insertHTML', `<table><tbody>${Array.from({ length: r }, (_, i) => `<tr>${(i ? '<td><br></td>' : '<th><br></th>').repeat(c)}</tr>`).join('')}</tbody></table><p><br></p>`);
    },
    code() { exec('formatBlock', near('pre') ? 'P' : 'PRE'); },
    async image() { insertImages(await pickFiles('image/*', true)); },
    async attach() {
      for (const f of await pickFiles('', true)) {
        if (f.size > 25 * 1048576) { toast(`"${f.name}" passa de 25 MB`); continue; }
        if (f.type.startsWith('image/')) { await insertImages([f]); continue; }
        exec('insertHTML', `<a class="attach" contenteditable="false" href="${await fileToDataURL(f)}" download="${esc(f.name)}">${esc(f.name)} · ${fmtSize(f.size)}</a>&nbsp;`);
      }
    },
    async audio(btn) {
      if (rec) return rec.stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), chunks = [];
        rec = new MediaRecorder(stream);
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const url = await fileToDataURL(new Blob(chunks, { type: rec.mimeType }));
          rec = null; btn.classList.remove('rec');
          exec('insertHTML', `<audio controls src="${url}"></audio><p><br></p>`);
        };
        rec.start(); btn.classList.add('rec'); toast('Gravando… toque no microfone de novo para parar');
      } catch (e) { rec = null; toast('Microfone indisponível ou sem permissão'); }
    },
    sketch() {
      const m = modal({ title: 'Desenho', wide: true, body: `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px"><input type="color" id="skc" value="#26221c" style="width:40px;height:32px;padding:2px"><input type="range" id="sks" min="1" max="24" value="4" style="flex:1"><button class="btn ghost sm" id="skx">Limpar</button></div><canvas id="sketch" width="1100" height="640"></canvas>`, foot: `<button class="btn" id="skok">Inserir na nota</button>` });
      const c = $('#sketch', m.el), g = c.getContext('2d');
      const blank = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); };
      blank(); g.lineCap = g.lineJoin = 'round';
      let last = null;
      const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
      c.onpointerdown = e => { c.setPointerCapture(e.pointerId); last = pos(e); g.strokeStyle = $('#skc', m.el).value; g.lineWidth = +$('#sks', m.el).value * 1.6; g.beginPath(); g.moveTo(...last); g.lineTo(last[0] + .1, last[1] + .1); g.stroke(); };
      c.onpointermove = e => { if (!last) return; const p = pos(e); g.beginPath(); g.moveTo(...last); g.lineTo(...p); g.stroke(); last = p; };
      c.onpointerup = c.onpointercancel = () => last = null;
      $('#skx', m.el).onclick = blank;
      $('#skok', m.el).onclick = () => { const url = c.toDataURL('image/png'); m.close(); exec('insertHTML', `<img src="${url}" alt="Desenho"><p><br></p>`); };
    },
    date() { exec('insertText', fmtFull(Date.now())); },
    clear() { exec('removeFormat'); exec('formatBlock', 'P'); },
  };

  function mount(body, tb, changed) {
    el = body; onChange = changed; saved = null;
    if (tb) {
      tb.onmousedown = e => { if (e.target.closest('button')) e.preventDefault(); };
      tb.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.cmd) exec(b.dataset.cmd); else if (custom[b.dataset.ed]) custom[b.dataset.ed](b); };
      tb.onchange = e => { const t = e.target; if (t.dataset.sel) { exec(t.dataset.sel, t.value); if (t.dataset.sel === 'formatBlock') t.value = 'P'; } };
      tb.oninput = e => { if (e.target.dataset.color) exec(e.target.dataset.color, e.target.value); };
    }
    el.addEventListener('input', () => onChange());
    el.addEventListener('click', e => {
      const li = e.target.closest('ul.checklist > li');
      if (li && e.target === li && e.clientX - li.getBoundingClientRect().left < 28) {
        if (li.classList.contains('done')) li.removeAttribute('class'); else li.className = 'done';
        return onChange();
      }
      const a = e.target.closest('a');
      if (!a || !inEl(a)) return;
      e.preventDefault();
      const href = a.getAttribute('href') || '';
      if (a.classList.contains('notelink')) return App.openNote(href.replace('#note/', ''));
      if (a.classList.contains('attach')) return popmenu(a, [{ label: 'Baixar arquivo', icon: 'dl', fn: () => download(a.getAttribute('download') || 'anexo', '', href) }, { label: 'Remover anexo', icon: 'trash', danger: true, fn: () => { a.remove(); onChange(); } }]);
      popmenu(a, [{ label: 'Abrir link', icon: 'link', fn: () => { if (/^(https?|mailto|tel):/i.test(href)) window.open(href, '_blank', 'noopener'); } }, { label: 'Editar', icon: 'pen', fn: () => { const r = document.createRange(); r.selectNodeContents(a); saved = r; custom.link(); } }, { label: 'Remover link', icon: 'x', fn: () => { a.replaceWith(...a.childNodes); onChange(); } }]);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
      if (e.key === 'Enter' && near('ul.checklist')) setTimeout(() => { const li = near('li'); if (li && !li.textContent.trim()) li.removeAttribute('class'); }, 0);
    });
    el.addEventListener('paste', e => {
      const cd = e.clipboardData;
      if (!cd) return;
      const imgs = [...cd.files].filter(f => f.type.startsWith('image/'));
      if (imgs.length) { e.preventDefault(); return insertImages(imgs); }
      const html = cd.getData('text/html');
      if (html) {
        e.preventDefault();
        const doc = new DOMParser().parseFromString(sanitize(html), 'text/html');
        doc.querySelectorAll('*').forEach(n => { n.removeAttribute('class'); n.removeAttribute('id'); if (n.style) { n.style.removeProperty('color'); n.style.removeProperty('background'); n.style.removeProperty('background-color'); n.style.removeProperty('font-family'); if (!n.getAttribute('style')) n.removeAttribute('style'); } });
        exec('insertHTML', doc.body.innerHTML);
      }
    });
    el.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    el.addEventListener('drop', e => { const fs = e.dataTransfer ? [...e.dataTransfer.files] : []; if (fs.length) { e.preventDefault(); insertImages(fs.filter(f => f.type.startsWith('image/'))); } });
  }

  return { toolbar, mount };
})();
