// Peças de interface reutilizáveis: formatação, avisos, confirmação,
// formulários a partir de uma lista de campos e gráficos em SVG.
(function () {
  'use strict';
  const M = window.Model;
  const S = () => window.Store.S;

  // ---------- texto e formatação ----------
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // template que escapa tudo, exceto valores marcados com raw()
  const RAW = Symbol('raw');
  const raw = s => ({ [RAW]: String(s) });
  function h(strings, ...vals) {
    return raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? piece(vals[i]) : ''), ''));
  }
  function piece(v) { if (Array.isArray(v)) return v.map(piece).join(''); if (v && v[RAW] !== undefined) return v[RAW]; if (v === false || v == null) return ''; return esc(v); }
  const html = v => piece(v);

  function fmtDate(iso, opts = {}) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    if (opts.short) return `${d}/${m}`;
    return S().settings.dateFormat === 'aaaa-mm-dd' ? iso : `${d}/${m}/${y}`;
  }
  const fmtTime = ts => { const d = new Date(ts); return `${M.pad(d.getHours())}:${M.pad(d.getMinutes())}`; };
  const fmtDateTime = ts => ts ? `${fmtDate(M.isoDate(ts))} ${fmtTime(ts)}` : '—';
  function fmtDur(ms) {
    if (ms == null) return '—';
    const m = Math.round(ms / 60000);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h${m % 60 ? ' ' + M.pad(m % 60) : ''}`;
  }
  function fmtClock(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${M.pad(Math.floor(s / 3600))}:${M.pad(Math.floor(s / 60) % 60)}:${M.pad(s % 60)}`; }
  const fmtHours = ms => (ms / M.HOUR).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h';
  const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function relDay(iso) {
    const d = M.daysBetween(M.isoDate(Date.now()), iso);
    if (d === 0) return 'hoje'; if (d === 1) return 'amanhã'; if (d === -1) return 'ontem';
    return d < 0 ? `há ${-d} dias` : `em ${d} dias`;
  }

  // no Mac, mostra ⌘ e ⌥ nos atalhos (Cmd+Enter salva; Option+letra é tratado pela tecla física)
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const keyMod = isMac ? '⌘' : 'Ctrl', keyAlt = isMac ? '⌥' : 'Alt';
  const LEVELS = [['beginner', 'Iniciante'], ['intermediate', 'Intermediário'], ['advanced', 'Avançado']];
  const COURSE_STATUSES = [['not_started', 'Não iniciado'], ['doing', 'Em andamento'], ['paused', 'Pausado'], ['done', 'Concluído']];
  const RESOURCE_TYPES = ['Tutorial', 'Artigo', 'Documentação oficial', 'Vídeo', 'Curso', 'Livro', 'Arquivo local', 'Guia ou manual', 'Referência de design', 'Técnica', 'Atalhos de teclado', 'Processo de produção', 'Material próprio'];
  const RESOURCE_STATUSES = [['new', 'Não estudado'], ['studying', 'Em estudo'], ['consulted', 'Consultado'], ['archived', 'Arquivado']];
  const PRIORITIES = [['low', 'Baixa'], ['medium', 'Média'], ['high', 'Alta'], ['urgent', 'Urgente']];
  const TASK_STATUSES = [['todo', 'A fazer'], ['doing', 'Em andamento'], ['waiting', 'Aguardando'], ['done', 'Concluída']];
  const REVISION_STATUSES = [['waiting', 'Aguardando feedback'], ['changes', 'Alterações solicitadas'], ['reviewing', 'Em revisão'], ['approved', 'Aprovado']];
  const EVENT_TYPES = [['meeting', 'Reunião'], ['delivery', 'Entrega'], ['review', 'Revisão'], ['approval', 'Aprovação'], ['personal', 'Pessoal'], ['other', 'Outro']];
  const label = (list, v) => (list.find(x => x[0] === v) || [, v || '—'])[1];
  const projectStatusName = id => (S().settings.projectStatuses.find(s => s.id === id) || { name: id || '—' }).name;

  function icon(name, cls = '') { return raw(`<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`); }
  function badge(text, tone = '') { return h`<span class="badge ${tone}">${text}</span>`; }
  function priorityBadge(p) { return badge(label(PRIORITIES, p), { urgent: 'bad', high: 'warn', medium: '', low: 'muted' }[p] || ''); }
  function empty(title, text, action) { return h`<div class="empty"><p class="empty-title">${title}</p><p>${text}</p>${action || ''}</div>`; }

  // ---------- aviso (toast) ----------
  function toast(text, tone = '', ms = 3500, action) {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + tone; el.setAttribute('role', tone === 'bad' ? 'alert' : 'status'); el.textContent = text;
    if (action) { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = action.label; b.onclick = () => { el.remove(); action.fn(); }; el.append(b); }
    box.append(el); setTimeout(() => el.remove(), ms);
  }
  function fail(e) { console.error(e); toast(e && e.fields ? 'Confira os campos destacados.' : 'Não foi possível salvar: ' + (e && e.message || e), 'bad', 6000); }

  // ---------- diálogos ----------
  function dialog(inner, cls = '') {
    const d = document.createElement('dialog');
    d.className = cls; d.innerHTML = html(inner);
    document.body.append(d); d.showModal();
    d.addEventListener('close', () => d.remove());
    return d;
  }
  function ask({ title, text, ok = 'Confirmar', danger = false }) {
    return new Promise(res => {
      const d = dialog(h`<form method="dialog" class="ask"><h2>${title}</h2><p>${text}</p><div class="actions"><button value="no" class="btn">Cancelar</button><button value="yes" class="btn ${danger ? 'danger' : 'primary'}">${ok}</button></div></form>`, 'small');
      d.addEventListener('close', () => res(d.returnValue === 'yes'));
    });
  }

  // ---------- formulários ----------
  // field: {k, label, type, required, options, hint, full, min, step}
  function fieldHtml(f, v) {
    const id = 'f-' + f.k, req = f.required ? raw(' required') : '';
    const lab = h`<label for="${id}">${f.label}${f.required ? raw(' <span class="req" aria-hidden="true">*</span>') : ''}</label>`;
    const opts = typeof f.options === 'function' ? f.options() : (f.options || []);
    let input;
    switch (f.type) {
      case 'textarea': input = h`<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}"${req}>${v ?? ''}</textarea>`; break;
      case 'select': input = h`<select id="${id}" name="${f.k}"${req}>${f.required ? '' : raw('<option value="">—</option>')}${opts.map(([val, txt]) => h`<option value="${val}"${val === v ? raw(' selected') : ''}>${txt}</option>`)}</select>`; break;
      case 'tags': input = h`<input id="${id}" name="${f.k}" value="${(v || []).join(', ')}" placeholder="separe por vírgula">`; break;
      case 'lines': input = h`<textarea id="${id}" name="${f.k}" rows="3" placeholder="um por linha">${(v || []).join('\n')}</textarea>`; break;
      case 'checkbox': input = h`<label class="check"><input type="checkbox" id="${id}" name="${f.k}"${v ? raw(' checked') : ''}> ${f.text || ''}</label>`; return h`<div class="field ${f.full ? 'full' : ''}">${input}</div>`;
      case 'checks': input = h`<div class="checks" id="${id}">${opts.map(([val, txt]) => h`<label class="check"><input type="checkbox" name="${f.k}" value="${val}"${(v || []).map(String).includes(String(val)) ? raw(' checked') : ''}> ${txt}</label>`)}</div>`; break;
      case 'checklist': input = h`<div class="checklist-edit" id="${id}" data-k="${f.k}">${(v || []).map(c => checklistRow(c))}<button type="button" class="btn small" data-add-check>${icon('plus')} Adicionar item</button></div>`; break;
      case 'image': input = h`<div class="img-field"><input type="file" id="${id}" accept="image/*" data-image="${f.k}">${v && window.Model.isImageData(v) ? h`<img src="${v}" alt="Imagem atual"><button type="button" class="btn small" data-clear-image="${f.k}">Remover imagem</button>` : ''}<input type="hidden" name="${f.k}" value="${v || ''}"></div>`; break;
      default: input = h`<input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${v ?? ''}"${f.step ? raw(` step="${f.step}"`) : ''}${f.type === 'number' ? raw(' min="0" inputmode="decimal"') : ''}${req}>`;
    }
    return h`<div class="field ${f.full ? 'full' : ''}">${lab}${input}${f.hint ? h`<small class="hint">${f.hint}</small>` : ''}<small class="err" id="${id}-err"></small></div>`;
  }
  function checklistRow(c) { return h`<div class="cl-row" data-id="${c.id}"><input type="checkbox"${c.done ? raw(' checked') : ''} aria-label="Concluído"><input value="${c.text}" aria-label="Item da checklist"><button type="button" class="icon-btn" data-del-check aria-label="Remover item">${icon('x')}</button></div>`; }
  function readForm(form, fields) {
    const out = {};
    for (const f of fields) {
      const el = form.elements[f.k];
      switch (f.type) {
        case 'number': out[f.k] = el.value === '' ? '' : Number(el.value.replace(',', '.')); break;
        case 'tags': out[f.k] = el.value.split(',').map(s => s.trim()).filter(Boolean); break;
        case 'lines': out[f.k] = el.value.split('\n').map(s => s.trim()).filter(Boolean); break;
        case 'checkbox': out[f.k] = el.checked; break;
        case 'checks': out[f.k] = [...form.querySelectorAll(`input[name="${f.k}"]:checked`)].map(i => isNaN(i.value) ? i.value : Number(i.value)); break;
        case 'checklist': out[f.k] = [...form.querySelectorAll(`[data-k="${f.k}"] .cl-row`)].map(r => ({ id: r.dataset.id, done: r.children[0].checked, text: r.children[1].value.trim() })).filter(c => c.text); break;
        default: out[f.k] = el.value.trim();
      }
    }
    return out;
  }
  // abre um formulário; onSave recebe os valores e deve gravar (erros com .fields voltam para os campos)
  function form({ title, fields, value = {}, onSave, onDelete, extra, submit = 'Salvar', check }) {
    const d = dialog(h`<form class="form" novalidate><header><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Fechar">${icon('x')}</button></header>
      <div class="form-grid">${fields.map(f => fieldHtml(f, value[f.k]))}</div>${extra || ''}
      <p class="form-error" role="alert"></p>
      <footer>${onDelete ? h`<button type="button" class="btn danger ghost" data-delete>${icon('trash')} Excluir</button>` : ''}<span class="grow"></span><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">${submit}</button></footer></form>`, 'wide');
    const f = d.querySelector('form');
    let dirty = false, busy = false;
    f.addEventListener('input', () => { dirty = true; });
    const close = async () => { if (!dirty || await ask({ title: 'Descartar alterações?', text: 'O que você preencheu neste formulário não foi salvo.', ok: 'Descartar', danger: true })) { dirty = false; d.close(); } };
    d.addEventListener('cancel', e => { e.preventDefault(); close(); });
    f.addEventListener('click', async e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.matches('[data-close]')) close();
      if (t.matches('[data-add-check]')) { t.insertAdjacentHTML('beforebegin', html(checklistRow({ id: M.uid(), text: '', done: false }))); t.previousElementSibling.children[1].focus(); dirty = true; }
      if (t.matches('[data-del-check]')) { t.closest('.cl-row').remove(); dirty = true; }
      if (t.matches('[data-clear-image]')) { f.elements[t.dataset.clearImage].value = ''; t.previousElementSibling.remove(); t.remove(); dirty = true; }
      if (t.matches('[data-delete]')) { if (await onDelete()) { dirty = false; d.close(); } }
    });
    f.addEventListener('change', async e => {
      const inp = e.target.closest('[data-image]'); if (!inp || !inp.files[0]) return;
      try { f.elements[inp.dataset.image].value = await shrinkImage(inp.files[0]); dirty = true; toast('Imagem carregada. Salve para guardar.'); }
      catch (err) { toast(err.message, 'bad'); inp.value = ''; }
    });
    f.addEventListener('submit', async e => {
      e.preventDefault(); if (busy) return;
      f.querySelectorAll('.err').forEach(x => x.textContent = ''); f.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
      f.querySelector('.form-error').textContent = '';
      const vals = readForm(f, fields);
      const pre = check ? check(vals) : null;
      try {
        if (pre && Object.keys(pre).length) { const er = new Error('Há campos inválidos.'); er.fields = pre; throw er; }
        busy = true; f.querySelector('[type=submit]').disabled = true; f.querySelector('[type=submit]').textContent = 'Salvando…';
        await onSave(vals); dirty = false; d.close();
      } catch (err) {
        if (err.cancelled) return;
        if (err.fields) {
          for (const [k, msg] of Object.entries(err.fields)) { const el = f.querySelector('#f-' + k + '-err'); if (el) el.textContent = msg; const inp = f.elements[k]; if (inp && inp.setAttribute) inp.setAttribute('aria-invalid', 'true'); }
          f.querySelector('.form-error').textContent = 'Confira os campos destacados.';
          const first = f.querySelector('[aria-invalid]'); if (first) first.focus();
        } else { f.querySelector('.form-error').textContent = 'Não foi possível salvar: ' + err.message; console.error(err); }
      } finally { busy = false; const b = f.querySelector('[type=submit]'); if (b) { b.disabled = false; b.textContent = submit; } }
    });
    window.__dirtyForm = () => dirty;
    return d;
  }
  // reduz a imagem para no máximo 900 px, guardada como data URL (cabe no backup)
  function shrinkImage(file) {
    return new Promise((ok, no) => {
      if (!file.type.startsWith('image/')) return no(new Error('Escolha um arquivo de imagem.'));
      if (file.size > 15e6) return no(new Error('Imagem muito grande (máximo 15 MB).'));
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 900 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); no(new Error('Não foi possível ler a imagem.')); };
      img.src = url;
    });
  }

  // ---------- gráficos ----------
  // barras verticais com eixo de 0 a um valor "redondo"
  function bars(data, { fmt = v => v, height = 180, unit = '', highlight } = {}) {
    if (!data.length || data.every(d => !d.value)) return h`<p class="muted chart-empty">Sem registros neste período.</p>`;
    const max = niceMax(Math.max(...data.map(d => d.value)));
    const W = 600, H = height, L = 40, B = 22, T = 10, bw = (W - L) / data.length;
    const y = v => T + (H - T - B) * (1 - v / max);
    const ticks = [0, max / 2, max];
    return h`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${data.map(d => d.label + ': ' + fmt(d.value)).join(', ')}">
      ${ticks.map(t => h`<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${round(t)}${unit}</text>`)}
      ${data.map((d, i) => { const x = L + i * bw + bw * 0.18, w = bw * 0.64, top = y(d.value); return h`<g><title>${d.label}: ${fmt(d.value)}</title><rect x="${x}" y="${top}" width="${w}" height="${Math.max(0, H - B - top)}" rx="3" class="${highlight && highlight(d, i) ? 'bar hi' : 'bar'}"/>${data.length <= 16 || i % 2 === 0 ? h`<text x="${x + w / 2}" y="${H - 6}" class="tick" text-anchor="middle">${d.label}</text>` : ''}</g>`; })}
    </svg>`;
  }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  const round = v => String(Math.round(v * 10) / 10).replace('.', ',');
  // barras horizontais em HTML (lista com rótulo, medidor e valor)
  function hbars(rows, fmt) {
    if (!rows.length) return h`<p class="muted chart-empty">Sem registros neste período.</p>`;
    const max = Math.max(...rows.map(r => r.value)) || 1;
    return h`<ul class="hbars">${rows.map(r => h`<li><span class="hb-label" title="${r.label}">${r.label}</span><span class="meter"><i style="width:${r.value / max * 100}%"></i></span><span class="hb-val">${fmt(r.value)}</span></li>`)}</ul>`;
  }
  function meter(ratio, tone = '') { return h`<span class="meter ${tone}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(1, ratio) * 100)}"><i style="width:${Math.min(1, Math.max(0, ratio)) * 100}%"></i></span>`; }

  // ---------- arquivos ----------
  function downloadFile(name, text, type) {
    const blob = new Blob([text], { type }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function csv(rows) { return '﻿' + rows.map(r => r.map(c => { const s = String(c ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\n'); }

  window.UI = {
    esc, raw, h, html, fmtDate, fmtTime, fmtDateTime, fmtDur, fmtClock, fmtHours, WEEKDAYS, MONTHS, relDay,
    LEVELS, COURSE_STATUSES, RESOURCE_TYPES, RESOURCE_STATUSES, PRIORITIES, TASK_STATUSES, REVISION_STATUSES, EVENT_TYPES, label, projectStatusName,
    isMac, keyMod, keyAlt, icon, badge, priorityBadge, empty, toast, fail, dialog, ask, form, bars, hbars, meter, downloadFile, csv,
  };
})();
