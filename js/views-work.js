// Telas de trabalho: Dashboard, Demandas (+ detalhe), Tarefas, Revisões e Solicitantes (+ detalhe).
(function () {
  'use strict';
  const M = window.Model, U = window.UI, St = window.Store, S = St.S, App = window.App;
  const { h, icon } = U;
  const Views = window.Views = window.Views || {};
  const now = () => Date.now(), today = () => M.isoDate(now());
  const pname = id => (St.get('projects', id) || {}).name;
  const cname = id => (St.get('clients', id) || {}).name;
  const vs = (k, def) => (App.vs[k] ||= { ...def, ...readPref(k) });
  function readPref(k) { try { return JSON.parse(localStorage.getItem('prancheta.view.' + k)) || {}; } catch { return {}; } }
  function savePref(k, obj) { try { localStorage.setItem('prancheta.view.' + k, JSON.stringify(obj)); } catch { /* armazenamento indisponível: só não lembra a preferência */ } }
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const statusTone = kind => ({ done: 'good', cancelled: 'muted', waiting: 'warn', active: 'blue' }[kind] || '');
  const pBadge = p => U.badge(U.projectStatusName(p.status), statusTone(M.statusKind(S.settings, p.status)));
  function dueText(iso, closed) {
    if (!iso) return h`<span class="muted">sem prazo</span>`;
    const late = !closed && iso < today(), soon = !closed && !late && M.daysBetween(today(), iso) <= 3;
    return h`<span class="${late ? 'txt-bad' : soon ? 'txt-warn' : ''}" title="${U.fmtDate(iso)}">${late ? icon('alert', 'sm') : ''}${U.fmtDate(iso)} · ${U.relDay(iso)}</span>`;
  }
  const sel = (name, list, value, all) => h`<select data-f="${name}" aria-label="${all}"><option value="">${all}</option>${list.map(([v, t]) => h`<option value="${v}"${v === value ? U.raw(' selected') : ''}>${t}</option>`)}</select>`;
  const seg = (name, list, value) => h`<div class="seg" role="group">${list.map(([v, t, ic]) => h`<button data-act="mode:${name}:${v}" aria-pressed="${v === value}">${ic ? icon(ic) : ''}${t}</button>`)}</div>`;
  Views.helpers = { pname, cname, pBadge, dueText, sel, seg, vs, savePref, norm, statusTone };

  // ================= DASHBOARD =================
  Views.dashboard = {
    render() {
      const t = now(), td = today(), set = S.settings, w = App.active.workday(), s = App.active.session(), b = App.active.brk();
      const dayS = M.timeSummary(S, ...M.range('day', t), t), weekS = M.timeSummary(S, ...M.range('week', t, set.weekStart), t);
      const kinds = p => M.statusKind(set, p.status);
      const doing = S.projects.filter(p => ['active', 'open', 'waiting'].includes(kinds(p)));
      const done = S.projects.filter(p => kinds(p) === 'done'), late = S.projects.filter(p => M.projectOverdue(set, p, td));
      const pending = S.tasks.filter(x => x.status !== 'done'), doneToday = S.tasks.filter(x => x.status === 'done' && x.completedAt && M.isoDate(x.completedAt) === td);
      const hasAny = S.projects.length || S.tasks.length || S.sessions.length;
      const greet = (new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite') + (set.name ? ', ' + set.name : '');
      const quick = h`<div class="quick">
        <button class="btn" data-act="new:projects">${icon('folder')} Nova demanda</button>
        <button class="btn" data-act="new:tasks">${icon('check')} Nova tarefa</button>
        <button class="btn" data-act="workday">${icon('briefcase')} ${w ? 'Encerrar expediente' : 'Iniciar expediente'}</button>
        <button class="btn" data-act="${s ? 'session-stop' : 'session-start'}">${icon(s ? 'stop' : 'play')} ${s ? 'Parar cronômetro' : 'Iniciar cronômetro'}</button>
        <button class="btn" data-act="break">${icon('coffee')} ${b ? 'Encerrar pausa' : 'Iniciar pausa'}</button>
        <button class="btn" data-act="new:notes">${icon('note')} Nova anotação</button></div>`;
      const head = App.page(greet, new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      if (!hasAny) return h`${head}${quick}${storageNotice()}
        <section class="panel welcome"><h2>Comece por aqui</h2>
          <ol class="steps"><li><strong>Cadastre uma demanda</strong> com solicitante, categoria e prazo.</li><li><strong>Crie as tarefas</strong> da demanda, com estimativa de tempo.</li><li><strong>Inicie o expediente e o cronômetro</strong> ao trabalhar; registre suas pausas.</li></ol>
          <p class="muted">Os indicadores, gráficos, relatórios e insights aparecem conforme você registra o seu trabalho.</p>
          <div class="row"><button class="btn primary" data-act="new:projects">${icon('plus')} Criar a primeira demanda</button><button class="btn ghost" data-act="load-demo">Ver com dados de demonstração</button></div></section>`;

      const stat = (label, value, hint, tone = '') => h`<div class="stat"><span class="stat-label">${label}</span><span class="stat-value ${tone}">${value}</span>${hint ? h`<span class="stat-hint">${hint}</span>` : ''}</div>`;
      const deadlines = [
        ...S.projects.filter(p => p.due && !M.isClosed(set, p) && M.daysBetween(td, p.due) <= 14).map(p => ({ d: p.due, kind: 'Demanda', title: p.name, act: 'go:demanda:' + p.id })),
        ...pending.filter(x => x.due && M.daysBetween(td, x.due) <= 14).map(x => ({ d: x.due, kind: 'Tarefa', title: x.title, act: 'edit:tasks:' + x.id, sub: pname(x.projectId) })),
      ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 8);
      const agenda = [
        ...S.events.filter(e => e.date >= td && M.daysBetween(td, e.date) <= 7).map(e => ({ d: e.date, time: e.time, title: e.title, kind: U.label(U.EVENT_TYPES, e.type), act: 'edit:events:' + e.id })),
        ...pending.filter(x => x.date && x.date >= td && M.daysBetween(td, x.date) <= 7).map(x => ({ d: x.date, time: x.time, title: x.title, kind: 'Tarefa', act: 'edit:tasks:' + x.id })),
      ].sort((a, b) => (a.d + (a.time || '')).localeCompare(b.d + (b.time || ''))).slice(0, 8);
      const priority = doing.filter(p => M.PRIORITY_RANK[p.priority] <= 1).sort((a, b) => (M.PRIORITY_RANK[a.priority] - M.PRIORITY_RANK[b.priority]) || (a.due || '9').localeCompare(b.due || '9')).slice(0, 6);
      const weekGoals = S.goals.filter(g => (M.GOAL_METRICS[g.metric] || {}).period === 'week');
      // gráficos
      const byProj = Object.entries(weekS.byProject).map(([id, ms]) => ({ label: pname(id) || '—', value: ms })).sort((a, b) => b.value - a.value).slice(0, 6);
      if (weekS.unclassifiedMs) byProj.push({ label: 'Sem demanda', value: weekS.unclassifiedMs });
      const days14 = Array.from({ length: 14 }, (_, i) => M.addDays(M.startOfDay(t), i - 13));
      const sum14 = M.timeSummary(S, days14[0], M.addDays(M.startOfDay(t), 1), t);
      const statusCount = U.TASK_STATUSES.map(([k, l]) => [k, l, S.tasks.filter(x => x.status === k).length]);
      const totalTasks = S.tasks.length || 1;
      return h`${head}${quick}${storageNotice()}
      <section class="panel stats-panel" aria-label="Indicadores">
        ${stat('Demandas em andamento', doing.length)}${stat('Demandas concluídas', done.length)}${stat('Demandas atrasadas', late.length, '', late.length ? 'txt-bad' : '')}
        ${stat('Tarefas pendentes', pending.length)}${stat('Concluídas hoje', doneToday.length)}
        ${stat('Trabalhado hoje', U.fmtDur(dayS.workedMs), w ? 'expediente aberto' : '')}${stat('Trabalhado na semana', U.fmtDur(weekS.workedMs), 'jornada: ' + M.f1(M.weeklyCapacityH(set)) + ' h')}${stat('Pausas hoje', U.fmtDur(dayS.breakMs))}
      </section>
      <div class="grid-2">
        ${set.dashboard.deadlines ? h`<section class="panel"><header class="panel-head"><h2>Próximos prazos</h2><a href="#calendario" class="link">Calendário</a></header>
          ${deadlines.length ? h`<ul class="rows">${deadlines.map(x => h`<li><button class="row-btn" data-act="${x.act}"><span class="badge muted">${x.kind}</span><span class="grow ellipsis">${x.title}${x.sub ? h` <span class="muted">· ${x.sub}</span>` : ''}</span>${dueText(x.d)}</button></li>`)}</ul>` : U.empty('Nenhum prazo nos próximos 14 dias', 'Prazos de demandas e tarefas aparecem aqui.')}</section>
        <section class="panel"><header class="panel-head"><h2>Próximos compromissos</h2><button class="link" data-act="new:events">Novo evento</button></header>
          ${agenda.length ? h`<ul class="rows">${agenda.map(x => h`<li><button class="row-btn" data-act="${x.act}"><span class="when">${U.fmtDate(x.d, { short: true })}${x.time ? ' ' + x.time : ''}</span><span class="grow ellipsis">${x.title}</span><span class="badge muted">${x.kind}</span></button></li>`)}</ul>` : U.empty('Agenda livre nos próximos 7 dias', 'Reuniões, entregas e tarefas com data aparecem aqui.')}</section>` : ''}
        <section class="panel"><header class="panel-head"><h2>Demandas prioritárias</h2><a href="#demandas" class="link">Todas</a></header>
          ${priority.length ? h`<ul class="rows">${priority.map(p => h`<li><button class="row-btn" data-act="go:demanda:${p.id}"><span class="grow"><span class="ellipsis block">${p.name}</span>${U.meter(M.projectProgress(set, p, S.tasks))}</span>${U.priorityBadge(p.priority)}${dueText(p.due)}</button></li>`)}</ul>` : U.empty('Nenhuma demanda de prioridade alta ou urgente', 'Demandas ativas com prioridade alta ou urgente aparecem aqui.')}</section>
        ${set.dashboard.goals ? h`<section class="panel"><header class="panel-head"><h2>Metas da semana</h2><a href="#metas" class="link">Metas</a></header>
          ${weekGoals.length ? h`<ul class="rows">${weekGoals.map(g => { const pr = M.goalProgress(g, S, t); return h`<li class="goal-row"><span class="grow">${g.title}</span><span class="muted mono">${M.f1(pr.value)} / ${g.target}</span>${U.meter(pr.ratio, pr.ratio >= 1 ? 'good' : '')}</li>`; })}</ul>` : U.empty('Nenhuma meta semanal', 'Defina, por exemplo, quantas horas quer trabalhar por semana.', h`<button class="btn small" data-act="new:goals">Criar meta</button>`)}</section>` : ''}
      </div>
      ${set.dashboard.charts ? h`<div class="grid-3">
        <section class="panel"><header class="panel-head"><h2>Horas por demanda</h2><span class="muted">esta semana</span></header>${U.hbars(byProj, U.fmtDur)}</section>
        <section class="panel"><header class="panel-head"><h2>Andamento das tarefas</h2><span class="muted">${S.tasks.length} no total</span></header>
          ${S.tasks.length ? h`<div class="stack-bar">${statusCount.filter(x => x[2]).map(([k, l, n]) => h`<i class="st-${k}" style="width:${n / totalTasks * 100}%" title="${l}: ${n}"></i>`)}</div><ul class="legend">${statusCount.map(([k, l, n]) => h`<li><i class="st-${k}"></i>${l} <strong>${n}</strong></li>`)}</ul>` : h`<p class="muted chart-empty">Nenhuma tarefa cadastrada.</p>`}</section>
        <section class="panel"><header class="panel-head"><h2>Horas por dia</h2><span class="muted">14 dias</span></header>${U.bars(days14.map(d => ({ label: new Date(d).getDate(), value: (sum14.byDay[M.isoDate(d)] || 0) / M.HOUR })), { fmt: v => M.f1(v) + ' h', unit: 'h', height: 160, highlight: (d, i) => i === 13 })}</section>
      </div>` : ''}
      ${set.dashboard.activity ? h`<section class="panel"><header class="panel-head"><h2>Atividades recentes</h2></header>
        ${S.activity.length ? h`<ul class="activity">${S.activity.slice(0, 10).map(a => h`<li><span class="when">${U.fmtDateTime(a.at)}</span><span>${a.text}</span></li>`)}</ul>` : U.empty('Nada registrado ainda', 'Criações, conclusões e alterações aparecem aqui.')}</section>` : ''}`;
    },
  };
  function storageNotice() {
    let seen = false; try { seen = localStorage.getItem('prancheta.notice') === '1'; } catch { /* sem localStorage: mostra sempre */ }
    return seen ? '' : h`<div class="notice">${icon('info')}<p>Seus dados ficam guardados <strong>neste navegador, neste computador</strong>. Eles não aparecem em outro navegador ou computador, e limpar os dados do site apaga tudo. Exporte um backup de vez em quando em <a href="#configuracoes">Configurações</a>.</p><button class="btn small" data-act="dismiss-notice">Entendi</button></div>`;
  }
  Views.dashboard.act = act => { if (act === 'dismiss-notice') { try { localStorage.setItem('prancheta.notice', '1'); } catch { /* ignora */ } App.render(); } };

  // ================= PROJETOS =================
  const PDEF = { mode: 'cards', q: '', status: '', category: '', client: '', priority: '', sort: 'due', closed: false };
  function filteredProjects(v) {
    const q = norm(v.q);
    let list = S.projects.filter(p => (!q || norm([p.name, p.description, cname(p.clientId), p.category].join(' ')).includes(q))
      && (!v.status || p.status === v.status) && (!v.category || p.category === v.category) && (!v.client || p.clientId === v.client) && (!v.priority || p.priority === v.priority)
      && (v.closed || v.status || !M.isClosed(S.settings, p)));
    const by = { due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999'), name: (a, b) => a.name.localeCompare(b.name), priority: (a, b) => M.PRIORITY_RANK[a.priority] - M.PRIORITY_RANK[b.priority], created: (a, b) => b.created - a.created };
    return list.sort(by[v.sort] || by.due);
  }
  function projectCard(p, small) {
    const prog = M.projectProgress(S.settings, p, S.tasks), spent = M.spentMs(S, 'projectId', p.id, now()), closed = M.isClosed(S.settings, p);
    const open = S.tasks.filter(t => t.projectId === p.id && t.status !== 'done').length;
    return h`<article class="card ${M.projectOverdue(S.settings, p, today()) ? 'is-late' : ''}" draggable="${small ? 'true' : 'false'}" data-id="${p.id}">
      <header><button class="title-btn" data-act="go:demanda:${p.id}">${p.name}</button>${small ? '' : pBadge(p)}</header>
      <p class="muted small">${[cname(p.clientId), p.category].filter(Boolean).join(' · ') || 'Sem solicitante'}</p>
      <div class="card-meter">${U.meter(prog)}<span class="mono small">${Math.round(prog * 100)}%</span></div>
      <footer>${U.priorityBadge(p.priority)}<span class="small">${dueText(p.due, closed)}</span></footer>
      ${small ? '' : h`<p class="small muted">${open} tarefa(s) aberta(s) · ${U.fmtDur(spent)}${p.estimateH ? ' de ' + p.estimateH + ' h' : ''}</p>`}
    </article>`;
  }
  Views.demandas = {
    render() {
      const v = vs('projects', PDEF), list = filteredProjects(v);
      const tools = h`<div class="toolbar">
        <input type="search" data-f="q" value="${v.q}" placeholder="Buscar demandas" aria-label="Buscar demandas">
        ${sel('status', S.settings.projectStatuses.map(s => [s.id, s.name]), v.status, 'Todos os status')}
        ${sel('category', S.settings.categories.map(c => [c, c]), v.category, 'Todas as categorias')}
        ${sel('client', App.opt.clients(), v.client, 'Todos os solicitantes')}
        ${sel('priority', U.PRIORITIES, v.priority, 'Todas as prioridades')}
        ${v.mode !== 'kanban' ? sel('sort', [['due', 'Ordenar por prazo'], ['priority', 'Ordenar por prioridade'], ['name', 'Ordenar por nome'], ['created', 'Mais recentes']], v.sort, 'Ordenar') : ''}
        <label class="check small"><input type="checkbox" data-f="closed"${v.closed ? U.raw(' checked') : ''}> Mostrar concluídas e canceladas</label>
        <span class="grow"></span>${seg('projects', [['cards', 'Cards', 'grid'], ['list', 'Lista', 'list'], ['kanban', 'Kanban', 'columns']], v.mode)}</div>`;
      let body;
      if (!S.projects.length) body = U.empty('Nenhuma demanda ainda', 'Escreva o nome da primeira demanda no campo acima e aperte Enter.');
      else if (v.mode === 'kanban') {
        const all = filteredProjects({ ...v, closed: true, status: '' });
        body = h`<div class="kanban">${S.settings.projectStatuses.filter(s => v.closed || s.kind !== 'cancelled').map(s => { const col = all.filter(p => p.status === s.id); return h`<section class="kcol" data-drop="${s.id}" aria-label="${s.name}"><header><h3>${s.name}</h3><span class="badge muted">${col.length}</span></header>${col.map(p => projectCard(p, true))}</section>`; })}</div><p class="muted small">Arraste os cards entre as colunas para mudar o status.</p>`;
      } else if (!list.length) body = U.empty('Nenhuma demanda com estes filtros', 'Ajuste a busca ou os filtros acima.');
      else if (v.mode === 'list') body = h`<div class="table-wrap"><table class="table"><thead><tr><th>Demanda</th><th>Solicitante</th><th>Categoria</th><th>Status</th><th>Prioridade</th><th>Prazo</th><th>Progresso</th><th class="num">Horas</th></tr></thead><tbody>
          ${list.map(p => { const sp = M.spentMs(S, 'projectId', p.id, now()); return h`<tr class="${M.projectOverdue(S.settings, p, today()) ? 'is-late' : ''}"><td><button class="title-btn" data-act="go:demanda:${p.id}">${p.name}</button></td><td>${cname(p.clientId) || '—'}</td><td>${p.category || '—'}</td><td>${pBadge(p)}</td><td>${U.priorityBadge(p.priority)}</td><td>${dueText(p.due, M.isClosed(S.settings, p))}</td><td class="w-meter">${U.meter(M.projectProgress(S.settings, p, S.tasks))}</td><td class="num mono">${U.fmtDur(sp)}${p.estimateH ? ' / ' + p.estimateH + ' h' : ''}</td></tr>`; })}</tbody></table></div>`;
      else body = h`<div class="cards">${list.map(p => projectCard(p))}</div>`;
      return h`${App.page('Demandas', `${list.length} de ${S.projects.length} demanda(s)`, h`<button class="btn ghost" data-act="new:projects">Formulário completo</button>`)}${App.quick('projects', v.client ? { clientId: v.client } : {})}${S.projects.length ? tools : ''}${body}`;
    },
    mount(root) { kanbanDnD(root, async (id, status) => { const p = St.get('projects', id); if (!p || p.status === status) return; const rec = { ...p, status, statusSince: now() }; rec.completedAt = M.statusKind(S.settings, status) === 'done' ? p.completedAt || now() : null; try { await St.save('projects', rec, { verb: 'movida para ' + U.projectStatusName(status) }); } catch (e) { U.fail(e); } }); },
    act(act, [k, val]) { if (act === 'mode') { const v = vs('projects', PDEF); v.mode = val; savePref('projects', { mode: val }); App.render(); } },
    change: e => filterChange(e, 'projects', PDEF), input: e => filterInput(e, 'projects', PDEF),
  };
  function filterChange(e, key, def) { const f = e.target.dataset.f; if (!f || f === 'q') return; const v = vs(key, def); v[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; App.render(); }
  let qTimer;
  function filterInput(e, key, def) { if (e.target.dataset.f !== 'q') return; const v = vs(key, def); v.q = e.target.value; clearTimeout(qTimer); qTimer = setTimeout(() => { App.render(); const el = document.querySelector('[data-f="q"]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 200); }
  Views.helpers.filterChange = filterChange; Views.helpers.filterInput = filterInput;
  // arrastar e soltar entre colunas (quadro Kanban e calendário)
  function kanbanDnD(root, onDrop) {
    root.querySelectorAll('[draggable="true"]').forEach(c => c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); }));
    root.querySelectorAll('[draggable="true"]').forEach(c => c.addEventListener('dragend', () => c.classList.remove('dragging')));
    root.querySelectorAll('[data-drop]').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id) onDrop(id, col.dataset.drop); });
    });
  }
  Views.helpers.kanbanDnD = kanbanDnD;

  // ================= DETALHE DO PROJETO =================
  const FIELD_LABELS = { name: 'Nome', title: 'Título', clientId: 'Solicitante', projectId: 'Demanda', category: 'Categoria', status: 'Status', priority: 'Prioridade', start: 'Início', due: 'Prazo', date: 'Data', time: 'Horário', estimateH: 'Horas estimadas', description: 'Descrição', goal: 'Objetivo', links: 'Links', notes: 'Observações', stages: 'Etapas', completedAt: 'Concluído em', statusSince: 'Status desde', end: 'Fim' };
  function fmtVal(k, v) {
    if (v === '' || v == null) return '—';
    if (k === 'status') return U.projectStatusName(v) !== v ? U.projectStatusName(v) : U.label(U.TASK_STATUSES, v);
    if (k === 'priority') return U.label(U.PRIORITIES, v);
    if (k === 'clientId') return cname(v) || '—';
    if (k === 'projectId') return pname(v) || '—';
    if (['completedAt', 'statusSince', 'start', 'end'].includes(k) && typeof v === 'number') return U.fmtDateTime(v);
    if (Array.isArray(v)) return v.map(x => x.text || x).join(', ');
    const s = String(v); return s.length > 60 ? s.slice(0, 60) + '…' : s;
  }
  function historyList(rec) {
    const hist = (rec.history || []).filter(x => Object.keys(x.changes).some(k => k !== 'statusSince'));
    if (!hist.length) return h`<p class="muted">Sem alterações desde a criação (${U.fmtDateTime(rec.created)}).</p>`;
    return h`<ul class="history">${hist.map(x => h`<li><span class="when">${U.fmtDateTime(x.at)}</span><span>${Object.entries(x.changes).filter(([k]) => k !== 'statusSince').map(([k, [a, b]]) => h`<span class="chg"><strong>${FIELD_LABELS[k] || k}</strong>: ${fmtVal(k, a)} → ${fmtVal(k, b)}</span>`)}</span></li>`)}<li><span class="when">${U.fmtDateTime(rec.created)}</span><span>Criado</span></li></ul>`;
  }
  Views.helpers.historyList = historyList;
  function taskRow(t, opts = {}) {
    const spent = M.spentMs(S, 'taskId', t.id, now()), cl = t.checklist || [], late = M.taskOverdue(t, today());
    return h`<li class="task-row ${t.status === 'done' ? 'done' : ''} ${late ? 'is-late' : ''}">
      <input type="checkbox" ${t.status === 'done' ? U.raw('checked') : ''} data-act="toggle-task:${t.id}" aria-label="Concluir ${t.title}">
      <button class="title-btn grow ellipsis" data-act="edit:tasks:${t.id}">${t.title}</button>
      ${opts.project && t.projectId ? h`<span class="muted small ellipsis tr-proj">${pname(t.projectId)}</span>` : ''}
      ${t.status !== 'done' && t.status !== 'todo' ? U.badge(U.label(U.TASK_STATUSES, t.status), t.status === 'waiting' ? 'warn' : 'blue') : ''}
      ${cl.length ? h`<span class="small muted" title="Subtarefas">${icon('list', 'sm')}${cl.filter(c => c.done).length}/${cl.length}</span>` : ''}
      ${U.priorityBadge(t.priority)}
      <span class="small tr-due">${t.due ? dueText(t.due, t.status === 'done') : ''}</span>
      <span class="small mono muted tr-time" title="Trabalhado / estimado">${spent || t.estimateH ? U.fmtDur(spent) + (t.estimateH ? ' / ' + t.estimateH + ' h' : '') : ''}</span>
      ${t.status !== 'done' ? h`<button class="icon-btn" data-act="session-start:${t.projectId || ''}:${t.id}" aria-label="Iniciar cronômetro nesta tarefa" title="Iniciar cronômetro">${icon('play')}</button>` : ''}
    </li>`;
  }
  Views.helpers.taskRow = taskRow;
  Views.demanda = {
    render(id) {
      const p = St.get('projects', id);
      if (!p) return U.empty('Demanda não encontrada', 'Ela pode ter sido excluída.', h`<a class="btn" href="#demandas">Voltar para demandas</a>`);
      const t = now(), tasks = S.tasks.filter(x => x.projectId === id).sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.due || '9').localeCompare(b.due || '9'));
      const prog = M.projectProgress(S.settings, p, S.tasks), spent = M.spentMs(S, 'projectId', id, t);
      const sessions = S.sessions.filter(s => s.projectId === id).sort((a, b) => b.start - a.start);
      const revs = S.revisions.filter(r => r.projectId === id).sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
      const notes = S.notes.filter(n => n.projectId === id), refs = S.refs.filter(r => r.projectId === id);
      const est = p.estimateH ? p.estimateH * M.HOUR : 0;
      return h`<nav class="crumbs"><a href="#demandas">Demandas</a> / <span>${p.name}</span></nav>
      ${App.page(p.name, [cname(p.clientId), p.category].filter(Boolean).join(' · '), h`<button class="btn" data-act="session-start:${id}">${icon('play')} Cronômetro</button><button class="btn" data-act="edit:projects:${id}">${icon('edit')} Editar</button><button class="btn danger ghost" data-act="del:projects:${id}">${icon('trash')} Excluir</button>`)}
      <section class="panel stats-panel">
        <div class="stat"><span class="stat-label">Status</span><span>${pBadge(p)} ${U.priorityBadge(p.priority)}</span><span class="stat-hint">desde ${p.statusSince ? U.fmtDate(M.isoDate(p.statusSince)) : '—'}</span></div>
        <div class="stat"><span class="stat-label">Progresso</span><span class="stat-value">${Math.round(prog * 100)}%</span>${U.meter(prog)}<span class="stat-hint">${tasks.length ? tasks.filter(x => x.status === 'done').length + ' de ' + tasks.length + ' tarefas' : 'sem tarefas: segue o status'}</span></div>
        <div class="stat"><span class="stat-label">Prazo</span><span>${dueText(p.due, M.isClosed(S.settings, p))}</span><span class="stat-hint">início ${U.fmtDate(p.start)} · criado ${U.fmtDate(M.isoDate(p.created))}</span></div>
        <div class="stat"><span class="stat-label">Horas</span><span class="stat-value ${est && spent > est ? 'txt-bad' : ''}">${U.fmtDur(spent)}</span>${est ? U.meter(spent / est, spent > est ? 'bad' : '') : ''}<span class="stat-hint">${est ? 'de ' + p.estimateH + ' h estimadas' : 'sem estimativa'}</span></div>
      </section>
      <div class="grid-2 wide-left">
        <div class="stack-lg">
          <section class="panel"><header class="panel-head"><h2>Tarefas</h2><button class="btn small ghost" data-act="new:tasks" data-defaults='${JSON.stringify({ projectId: id, clientId: p.clientId || '' })}'>Formulário completo</button></header>
            ${App.quick('tasks', { projectId: id })}
            ${tasks.length ? h`<ul class="task-list">${tasks.map(x => taskRow(x))}</ul>` : U.empty('Sem tarefas', 'Divida a demanda em tarefas para acompanhar o progresso.')}</section>
          <section class="panel"><header class="panel-head"><h2>Revisões e aprovações</h2><button class="btn small" data-act="new:revisions" data-defaults='${JSON.stringify({ projectId: id })}'>${icon('plus')} Registrar versão</button></header>
            ${revs.length ? h`<ul class="rows">${revs.map(r => revRow(r))}</ul>` : U.empty('Nenhuma versão enviada', 'Registre cada versão enviada ao solicitante e o retorno recebido.')}</section>
          <section class="panel"><header class="panel-head"><h2>Tempo registrado</h2><span class="muted">${sessions.length} sessão(ões)</span></header>
            ${sessions.length ? h`<ul class="rows">${sessions.slice(0, 8).map(s => h`<li><button class="row-btn" data-act="time-edit:sessions:${s.id}"><span class="when">${U.fmtDateTime(s.start)}</span><span class="grow ellipsis">${(St.get('tasks', s.taskId) || {}).title || s.note || 'Sem tarefa'}</span><span class="mono">${s.end ? U.fmtDur(M.total(M.workedIntervals(s, S.breaks, t))) : 'em andamento'}</span></button></li>`)}</ul>` : U.empty('Nenhuma hora registrada', 'Inicie o cronômetro nesta demanda para registrar o tempo.')}</section>
          <section class="panel"><header class="panel-head"><h2>Histórico de alterações</h2></header>${historyList(p)}</section>
        </div>
        <div class="stack-lg">
          ${p.description || p.goal ? h`<section class="panel">${p.description ? h`<h3>Descrição</h3><p class="pre">${p.description}</p>` : ''}${p.goal ? h`<h3>Objetivo</h3><p class="pre">${p.goal}</p>` : ''}</section>` : ''}
          <section class="panel"><header class="panel-head"><h2>Etapas de produção</h2></header>
            ${(p.stages || []).length ? h`<ul class="checklist">${p.stages.map(c => h`<li><label class="check"><input type="checkbox"${c.done ? U.raw(' checked') : ''} data-act="toggle-check:projects:${id}:stages" data-item="${c.id}"> <span class="${c.done ? 'done' : ''}">${c.text}</span></label></li>`)}</ul>` : h`<p class="muted">Nenhuma etapa. Adicione em Editar.</p>`}</section>
          <section class="panel"><header class="panel-head"><h2>Arquivos e links</h2></header>
            ${(p.links || []).length ? h`<ul class="links">${p.links.filter(M.isUrl).map(l => h`<li><a href="${l}" target="_blank" rel="noopener noreferrer">${icon('link', 'sm')}${l.replace(/^https?:\/\//, '')}</a></li>`)}</ul>` : h`<p class="muted">Nenhum link.</p>`}</section>
          ${p.notes ? h`<section class="panel"><h3>Observações</h3><p class="pre">${p.notes}</p></section>` : ''}
          <section class="panel"><header class="panel-head"><h2>Anotações</h2><button class="btn small" data-act="new:notes" data-defaults='${JSON.stringify({ projectId: id, clientId: p.clientId || '' })}'>${icon('plus')}</button></header>
            ${notes.length ? h`<ul class="rows">${notes.map(n => h`<li><button class="row-btn" data-act="edit:notes:${n.id}">${n.pinned ? icon('pin', 'sm') : ''}<span class="grow ellipsis">${n.title}</span><span class="badge muted">${n.kind}</span></button></li>`)}</ul>` : h`<p class="muted">Nenhuma anotação.</p>`}</section>
          <section class="panel"><header class="panel-head"><h2>Referências</h2><button class="btn small" data-act="new:refs" data-defaults='${JSON.stringify({ projectId: id })}'>${icon('plus')}</button></header>
            ${refs.length ? h`<ul class="rows">${refs.map(r => h`<li><button class="row-btn" data-act="edit:refs:${r.id}"><span class="grow ellipsis">${r.name}</span><span class="swatches">${(r.palette || []).filter(M.isHex).map(c => h`<i style="background:${c}"></i>`)}</span></button></li>`)}</ul>` : h`<p class="muted">Nenhuma referência.</p>`}</section>
        </div>
      </div>`;
    },
  };
  function revRow(r, withProject) {
    const stale = r.status === 'waiting' && r.sentAt ? M.daysBetween(r.sentAt, today()) : 0;
    const tone = { approved: 'good', changes: 'warn', reviewing: 'blue', waiting: stale >= S.settings.staleDays ? 'bad' : '' }[r.status];
    return h`<li><button class="row-btn" data-act="edit:revisions:${r.id}"><strong class="mono">${r.version}</strong><span class="grow ellipsis">${withProject ? pname(r.projectId) + ' · ' : ''}${r.changes || r.feedback || 'Sem feedback registrado'}</span>${U.badge(U.label(U.REVISION_STATUSES, r.status), tone)}<span class="small muted">${r.sentAt ? 'enviado ' + U.fmtDate(r.sentAt) : ''}${r.status === 'waiting' && stale ? ' · ' + stale + ' dia(s) sem retorno' : ''}</span></button></li>`;
  }

  // ================= TAREFAS =================
  const TDEF = { mode: 'list', q: '', project: '', client: '', priority: '', status: 'open', due: '', sort: 'due' };
  function filteredTasks(v) {
    const td = today(), wk = M.isoDate(M.addDays(now(), 7)), q = norm(v.q);
    const dueOk = t => { const d = t.due; switch (v.due) { case 'late': return M.taskOverdue(t, td); case 'today': return d === td || t.date === td; case 'week': return d && d >= td && d <= wk; case 'none': return !d; default: return true; } };
    const list = S.tasks.filter(t => (!q || norm([t.title, t.description, t.notes, ...(t.checklist || []).map(c => c.text)].join(' ')).includes(q))
      && (!v.project || (v.project === '-' ? !t.projectId : t.projectId === v.project)) && (!v.client || t.clientId === v.client) && (!v.priority || t.priority === v.priority)
      && (v.status === 'all' || (v.status === 'open' ? t.status !== 'done' : (!v.status || t.status === v.status))) && dueOk(t));
    const by = { due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || M.PRIORITY_RANK[a.priority] - M.PRIORITY_RANK[b.priority], priority: (a, b) => M.PRIORITY_RANK[a.priority] - M.PRIORITY_RANK[b.priority] || (a.due || '9').localeCompare(b.due || '9'), created: (a, b) => b.created - a.created, project: (a, b) => (pname(a.projectId) || '~').localeCompare(pname(b.projectId) || '~') };
    return list.sort(by[v.sort] || by.due);
  }
  Views.tarefas = {
    render() {
      const v = vs('tasks', TDEF), list = filteredTasks(v), td = today();
      const tools = h`<div class="toolbar">
        <input type="search" data-f="q" value="${v.q}" placeholder="Buscar tarefas e subtarefas" aria-label="Buscar tarefas">
        <select data-f="status" aria-label="Status">${[['open', 'Abertas'], ['all', 'Todas'], ...U.TASK_STATUSES].map(([a, b]) => h`<option value="${a}"${a === v.status ? U.raw(' selected') : ''}>${b}</option>`)}</select>
        ${sel('due', [['late', 'Atrasadas'], ['today', 'Hoje'], ['week', 'Próximos 7 dias'], ['none', 'Sem prazo']], v.due, 'Qualquer prazo')}
        ${sel('project', [['-', 'Sem demanda'], ...App.opt.projects()], v.project, 'Todas as demandas')}
        ${sel('client', App.opt.clients(), v.client, 'Todos os solicitantes')}
        ${sel('priority', U.PRIORITIES, v.priority, 'Todas as prioridades')}
        ${v.mode === 'list' ? sel('sort', [['due', 'Ordenar por prazo'], ['priority', 'Ordenar por prioridade'], ['project', 'Ordenar por demanda'], ['created', 'Mais recentes']], v.sort, 'Ordenar') : ''}
        <span class="grow"></span>${seg('tasks', [['list', 'Lista', 'list'], ['kanban', 'Kanban', 'columns'], ['agenda', 'Agenda', 'calendar']], v.mode)}</div>`;
      let body;
      if (!S.tasks.length) body = U.empty('Nenhuma tarefa ainda', 'Escreva a primeira no campo acima e aperte Enter.');
      else if (v.mode === 'kanban') {
        const all = filteredTasks({ ...v, status: 'all' });
        body = h`<div class="kanban">${U.TASK_STATUSES.map(([k, l]) => { const col = all.filter(t => t.status === k).slice(0, k === 'done' ? 30 : 200); return h`<section class="kcol" data-drop="${k}" aria-label="${l}"><header><h3>${l}</h3><span class="badge muted">${all.filter(t => t.status === k).length}</span></header>${col.map(t => h`<article class="card ${M.taskOverdue(t, td) ? 'is-late' : ''}" draggable="true" data-id="${t.id}"><header><button class="title-btn" data-act="edit:tasks:${t.id}">${t.title}</button></header><p class="small muted">${pname(t.projectId) || 'Sem demanda'}</p><footer>${U.priorityBadge(t.priority)}<span class="small">${t.due ? dueText(t.due, t.status === 'done') : ''}</span></footer></article>`)}</section>`; })}</div><p class="muted small">Arraste para mudar o status. A coluna Concluída mostra as 30 mais recentes.</p>`;
      } else if (!list.length) body = U.empty('Nenhuma tarefa com estes filtros', 'Ajuste a busca ou os filtros acima.');
      else if (v.mode === 'agenda') {
        const groups = {};
        for (const t of list) { const d = t.date || t.due; const k = !d ? '~' : (t.status !== 'done' && d < td) ? '!' : d; (groups[k] ||= []).push(t); }
        body = Object.keys(groups).sort().map(k => h`<section class="panel"><header class="panel-head"><h2>${k === '!' ? 'Atrasadas' : k === '~' ? 'Sem data' : U.fmtDate(k) + ' · ' + U.relDay(k)}</h2><span class="muted">${groups[k].length}</span></header><ul class="task-list">${groups[k].map(t => taskRow(t, { project: true }))}</ul></section>`);
      } else body = h`<section class="panel flush"><ul class="task-list">${list.map(t => taskRow(t, { project: true }))}</ul></section>`;
      return h`${App.page('Tarefas', `${list.length} tarefa(s) neste filtro · ${S.tasks.filter(t => M.taskOverdue(t, td)).length} atrasada(s)`, h`<button class="btn ghost" data-act="new:tasks">Formulário completo</button>`)}${App.quick('tasks', v.project && v.project !== '-' ? { projectId: v.project } : {})}${S.tasks.length ? tools : ''}${body}`;
    },
    mount(root) { kanbanDnD(root, async (id, status) => { const t = St.get('tasks', id); if (!t || t.status === status) return; try { await St.save('tasks', { ...t, status, completedAt: status === 'done' ? t.completedAt || now() : null }, { verb: status === 'done' ? 'concluída' : 'movida para ' + U.label(U.TASK_STATUSES, status) }); } catch (e) { U.fail(e); } }); },
    act(act, [k, val]) { if (act === 'mode') { const v = vs('tasks', TDEF); v.mode = val; savePref('tasks', { mode: val }); App.render(); } },
    change: e => filterChange(e, 'tasks', TDEF), input: e => filterInput(e, 'tasks', TDEF),
  };

  // ================= REVISÕES =================
  const RDEF = { project: '', status: '' };
  Views.revisoes = {
    render() {
      const v = vs('revisions', RDEF), td = today();
      const list = S.revisions.filter(r => (!v.project || r.projectId === v.project) && (!v.status || r.status === v.status)).sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
      const stale = S.revisions.filter(r => r.status === 'waiting' && r.sentAt && M.daysBetween(r.sentAt, td) >= S.settings.staleDays);
      const waitingProjects = S.projects.filter(p => !M.isClosed(S.settings, p) && M.statusKind(S.settings, p.status) === 'waiting');
      const byProject = {};
      for (const r of list) (byProject[r.projectId] ||= []).push(r);
      return h`${App.page('Revisões e aprovações', 'Versões enviadas, retornos dos solicitantes e decisões', h`<button class="btn primary" data-act="new:revisions">${icon('plus')} Registrar versão</button>`)}
      ${stale.length || waitingProjects.length ? h`<section class="panel"><header class="panel-head"><h2>Parados aguardando retorno</h2><span class="muted">há ${S.settings.staleDays}+ dias, ou com status de espera</span></header><ul class="rows">
        ${stale.map(r => revRow(r, true))}${waitingProjects.map(p => h`<li><button class="row-btn" data-act="go:demanda:${p.id}"><span class="grow ellipsis">${p.name}</span>${pBadge(p)}<span class="small muted">${p.statusSince ? M.daysBetween(M.isoDate(p.statusSince), td) + ' dia(s) neste status' : ''}</span></button></li>`)}</ul></section>` : ''}
      ${S.revisions.length ? h`<div class="toolbar">${sel('project', App.opt.projects(), v.project, 'Todas as demandas')}${sel('status', U.REVISION_STATUSES, v.status, 'Todos os status')}</div>` : ''}
      ${!S.revisions.length ? U.empty('Nenhuma revisão registrada', 'Ao enviar uma versão para o solicitante, registre aqui. Assim você sabe o que foi pedido, o que foi aprovado e o que está parado.', h`<button class="btn primary" data-act="new:revisions">${icon('plus')} Registrar versão</button>`)
        : !list.length ? U.empty('Nada com estes filtros', 'Ajuste os filtros.') : Object.entries(byProject).map(([pid, rs]) => h`<section class="panel"><header class="panel-head"><h2><button class="title-btn" data-act="go:demanda:${pid}">${pname(pid) || 'Demanda excluída'}</button></h2><span class="muted">${rs.length} versão(ões)</span></header><ul class="rows">${rs.map(r => revRow(r))}</ul></section>`)}`;
    },
    change: e => filterChange(e, 'revisions', RDEF),
  };

  // ================= CLIENTES =================
  const CDEF = { q: '' };
  Views.solicitantes = {
    render() {
      const v = vs('clients', CDEF), q = norm(v.q);
      const list = S.clients.filter(c => (!q || norm([c.name, c.contactName, c.email, c.phone, c.notes].join(' ')).includes(q))).sort((a, b) => a.name.localeCompare(b.name));
      return h`${App.page('Solicitantes', `${S.clients.length} solicitante(s)`, h`<button class="btn primary" data-act="new:clients">${icon('plus')} Novo solicitante</button>`)}
      ${S.clients.length ? h`<div class="toolbar"><input type="search" data-f="q" value="${v.q}" placeholder="Buscar solicitantes" aria-label="Buscar solicitantes"></div>` : ''}
      ${!S.clients.length ? U.empty('Nenhum solicitante ainda', 'Cadastre os setores ou pessoas que pedem trabalho para você. Só o nome é obrigatório.', h`<button class="btn primary" data-act="new:clients">${icon('plus')} Novo solicitante</button>`)
        : !list.length ? U.empty('Nenhum solicitante encontrado', 'Ajuste a busca.') : h`<div class="table-wrap"><table class="table"><thead><tr><th>Solicitante</th><th>Contato</th><th class="num">Demandas ativas</th><th class="num">Tarefas abertas</th><th class="num">Aguardando aprovação</th></tr></thead><tbody>
        ${list.map(c => { const ps = S.projects.filter(p => p.clientId === c.id); return h`<tr><td><button class="title-btn" data-act="go:solicitante:${c.id}">${c.name}</button></td><td class="small">${[c.contactName, c.email, c.phone].filter(Boolean).join(' · ') || '—'}</td><td class="num">${ps.filter(p => !M.isClosed(S.settings, p)).length} / ${ps.length}</td><td class="num">${S.tasks.filter(t => t.clientId === c.id && t.status !== 'done').length}</td><td class="num">${ps.filter(p => !M.isClosed(S.settings, p) && M.statusKind(S.settings, p.status) === 'waiting').length || '—'}</td></tr>`; })}</tbody></table></div>`}`;
    },
    change: e => filterChange(e, 'clients', CDEF), input: e => filterInput(e, 'clients', CDEF),
  };
  Views.solicitante = {
    render(id) {
      const c = St.get('clients', id);
      if (!c) return U.empty('Solicitante não encontrado', 'Ele pode ter sido excluído.', h`<a class="btn" href="#solicitantes">Voltar</a>`);
      const ps = S.projects.filter(p => p.clientId === id).sort((a, b) => b.created - a.created);
      const delivered = ps.filter(p => M.statusKind(S.settings, p.status) === 'done').sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      const tasks = S.tasks.filter(t => t.clientId === id && t.status !== 'done');
      const revs = S.revisions.filter(r => ps.some(p => p.id === r.projectId)).sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
      const notes = S.notes.filter(n => n.clientId === id);
      return h`<nav class="crumbs"><a href="#solicitantes">Solicitantes</a> / <span>${c.name}</span></nav>
      ${App.page(c.name, c.description || '', h`<button class="btn" data-act="new:projects" data-defaults='${JSON.stringify({ clientId: id })}'>${icon('plus')} Nova demanda</button><button class="btn" data-act="edit:clients:${id}">${icon('edit')} Editar</button><button class="btn danger ghost" data-act="del:clients:${id}">${icon('trash')} Excluir</button>`)}
      <section class="panel stats-panel">
        <div class="stat"><span class="stat-label">Contato</span><span>${c.contactName || '—'}</span><span class="stat-hint">${[c.email, c.phone].filter(Boolean).join(' · ')}</span></div>
        <div class="stat"><span class="stat-label">Demandas</span><span class="stat-value">${ps.length}</span><span class="stat-hint">${delivered.length} entregue(s)</span></div>
        <div class="stat"><span class="stat-label">Em aberto</span><span class="stat-value">${ps.filter(p => !M.isClosed(S.settings, p)).length}</span><span class="stat-hint">${tasks.length} tarefa(s) aberta(s)</span></div>
      </section>
      <div class="grid-2">
        <section class="panel"><header class="panel-head"><h2>Histórico de solicitações</h2><span class="muted">demandas por data de pedido</span></header>
          ${ps.length ? h`<ul class="rows">${ps.map(p => h`<li><button class="row-btn" data-act="go:demanda:${p.id}"><span class="when">${U.fmtDate(M.isoDate(p.created))}</span><span class="grow ellipsis">${p.name}</span>${pBadge(p)}</button></li>`)}</ul>` : U.empty('Nenhuma demanda', 'Demandas deste solicitante aparecem aqui.')}</section>
        <section class="panel"><header class="panel-head"><h2>Entregas</h2></header>
          ${delivered.length ? h`<ul class="rows">${delivered.map(p => h`<li><button class="row-btn" data-act="go:demanda:${p.id}"><span class="when">${p.completedAt ? U.fmtDate(M.isoDate(p.completedAt)) : '—'}</span><span class="grow ellipsis">${p.name}</span>${p.due && p.completedAt ? (M.isoDate(p.completedAt) <= p.due ? U.badge('no prazo', 'good') : U.badge('fora do prazo', 'warn')) : ''}</button></li>`)}</ul>` : h`<p class="muted">Nenhuma entrega concluída.</p>`}</section>
        <section class="panel"><header class="panel-head"><h2>Tarefas abertas</h2></header>${tasks.length ? h`<ul class="task-list">${tasks.map(t => taskRow(t, { project: true }))}</ul>` : h`<p class="muted">Nenhuma tarefa aberta.</p>`}</section>
        <section class="panel"><header class="panel-head"><h2>Aprovações</h2></header>${revs.length ? h`<ul class="rows">${revs.map(r => revRow(r, true))}</ul>` : h`<p class="muted">Nenhuma revisão registrada.</p>`}</section>
        <section class="panel"><header class="panel-head"><h2>Anotações</h2><button class="btn small" data-act="new:notes" data-defaults='${JSON.stringify({ clientId: id })}'>${icon('plus')}</button></header>${notes.length ? h`<ul class="rows">${notes.map(n => h`<li><button class="row-btn" data-act="edit:notes:${n.id}"><span class="grow ellipsis">${n.title}</span><span class="badge muted">${n.kind}</span></button></li>`)}</ul>` : h`<p class="muted">Nenhuma anotação.</p>`}</section>
        <section class="panel">${c.description ? h`<h3>Descrição</h3><p class="pre">${c.description}</p>` : ''}<h3>Observações</h3><p class="pre">${c.notes || '—'}</p><h3>Histórico do cadastro</h3>${historyList(c)}</section>
      </div>`;
    },
  };
})();
