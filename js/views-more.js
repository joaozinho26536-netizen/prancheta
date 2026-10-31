// Telas de criação e análise: Referências, Anotações, Relatórios, Metas,
// Insights e Configurações (incluindo backup e importação).
(function () {
  'use strict';
  const M = window.Model, U = window.UI, St = window.Store, S = St.S, App = window.App;
  const { h, icon } = U;
  const Views = window.Views, H = Views.helpers;
  const now = () => Date.now(), today = () => M.isoDate(now());
  const allTags = list => [...new Set(list.flatMap(x => x.tags || []))].sort((a, b) => a.localeCompare(b));

  // ================= REFERÊNCIAS =================
  const RDEF = { q: '', category: '', tag: '', project: '' };
  Views.referencias = {
    render() {
      const v = H.vs('refs', RDEF), q = H.norm(v.q);
      const list = S.refs.filter(r => (!q || H.norm([r.name, r.description, r.typography, r.notes, ...(r.tags || [])].join(' ')).includes(q)) && (!v.category || r.category === v.category) && (!v.tag || (r.tags || []).includes(v.tag)) && (!v.project || r.projectId === v.project)).sort((a, b) => b.updated - a.updated);
      return h`${App.page('Referências criativas', 'Inspirações, paletas, tipografias e links', h`<button class="btn primary" data-act="new:refs">${icon('plus')} Nova referência</button>`)}
      ${S.refs.length ? h`<div class="toolbar"><input type="search" data-f="q" value="${v.q}" placeholder="Buscar por nome, palavra-chave, tipografia" aria-label="Buscar referências">${H.sel('category', S.settings.refCategories.map(c => [c, c]), v.category, 'Todas as categorias')}${H.sel('tag', allTags(S.refs).map(t => [t, t]), v.tag, 'Todas as palavras-chave')}${H.sel('project', App.opt.projects(), v.project, 'Todas as demandas')}</div>` : ''}
      ${!S.refs.length ? U.empty('Biblioteca vazia', 'Guarde links, paletas e tipografias que inspiram suas demandas. Imagens podem ser anexadas (ficam reduzidas no navegador).', h`<button class="btn primary" data-act="new:refs">${icon('plus')} Nova referência</button>`)
        : !list.length ? U.empty('Nada encontrado', 'Ajuste a busca ou os filtros.') : h`<div class="cards refs">${list.map(r => h`<article class="card ref">
          ${M.isImageData(r.image || '') ? h`<button class="ref-img" data-act="edit:refs:${r.id}"><img src="${r.image}" alt="${r.name}" loading="lazy"></button>` : ''}
          <header><button class="title-btn" data-act="edit:refs:${r.id}">${r.name}</button>${U.badge(r.category || 'Geral', 'muted')}</header>
          ${(r.palette || []).length ? h`<div class="palette">${r.palette.filter(M.isHex).map(c => h`<span style="background:${c}" title="${c}"></span>`)}</div><p class="mono small muted">${r.palette.join('  ')}</p>` : ''}
          ${r.typography ? h`<p class="small">${icon('type', 'sm')} ${r.typography}</p>` : ''}
          ${r.description ? h`<p class="small muted clamp">${r.description}</p>` : ''}
          <footer>${(r.tags || []).map(t => h`<button class="tag" data-act="ref-tag:${t}">#${t}</button>`)}<span class="grow"></span>${M.isUrl(r.url || '') ? h`<a href="${r.url}" target="_blank" rel="noopener noreferrer" class="icon-btn" aria-label="Abrir link">${icon('link')}</a>` : ''}</footer>
          ${r.projectId ? h`<p class="small muted">${icon('folder', 'sm')} ${H.pname(r.projectId)}</p>` : ''}${r.filePath ? h`<p class="small muted mono ellipsis" title="${r.filePath}">${r.filePath}</p>` : ''}
        </article>`)}</div>`}`;
    },
    act(act, [a]) { if (act === 'ref-tag') { H.vs('refs', RDEF).tag = a; App.render(); } },
    change: e => H.filterChange(e, 'refs', RDEF), input: e => H.filterInput(e, 'refs', RDEF),
  };

  // ================= ANOTAÇÕES =================
  const NDEF = { q: '', kind: '', tag: '', project: '', client: '' };
  Views.anotacoes = {
    render() {
      const v = H.vs('notes', NDEF), q = H.norm(v.q);
      const list = S.notes.filter(n => (!q || H.norm([n.title, n.body, ...(n.tags || [])].join(' ')).includes(q)) && (!v.kind || n.kind === v.kind) && (!v.tag || (n.tags || []).includes(v.tag)) && (!v.project || n.projectId === v.project) && (!v.client || n.clientId === v.client))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
      const card = n => h`<article class="card note ${n.pinned ? 'pinned' : ''}">
        <header><button class="title-btn" data-act="edit:notes:${n.id}">${n.title}</button><button class="icon-btn" data-act="pin:${n.id}" aria-pressed="${!!n.pinned}" aria-label="${n.pinned ? 'Desafixar' : 'Fixar'}" title="${n.pinned ? 'Desafixar' : 'Fixar'}">${icon('pin')}</button></header>
        <p class="small clamp pre">${n.body || ''}</p>
        <footer>${U.badge(n.kind || 'Nota', 'muted')}${(n.tags || []).map(t => h`<button class="tag" data-act="note-tag:${t}">#${t}</button>`)}<span class="grow"></span><span class="small muted">${U.fmtDate(M.isoDate(n.updated))}</span></footer>
        ${n.projectId || n.clientId ? h`<p class="small muted">${[H.pname(n.projectId), H.cname(n.clientId)].filter(Boolean).join(' · ')}</p>` : ''}</article>`;
      return h`${App.page('Anotações', 'Ideias, briefings, feedbacks e decisões', h`<button class="btn ghost" data-act="new:notes">Formulário completo</button>`)}${App.quick('notes', v.project ? { projectId: v.project } : {})}
      ${S.notes.length ? h`<div class="toolbar"><input type="search" data-f="q" value="${v.q}" placeholder="Buscar em títulos, conteúdo e etiquetas" aria-label="Buscar anotações">${H.sel('kind', S.settings.noteKinds.map(k => [k, k]), v.kind, 'Todos os tipos')}${H.sel('tag', allTags(S.notes).map(t => [t, t]), v.tag, 'Todas as etiquetas')}${H.sel('project', App.opt.projects(), v.project, 'Todas as demandas')}${H.sel('client', App.opt.clients(), v.client, 'Todos os solicitantes')}</div>` : ''}
      ${!S.notes.length ? U.empty('Nenhuma anotação', 'Escreva no campo acima. Depois, clique na anotação para ligar a uma demanda, pôr etiquetas ou fixar.')
        : !list.length ? U.empty('Nada encontrado', 'Ajuste a busca ou os filtros.') : h`<div class="cards notes">${list.map(card)}</div>`}`;
    },
    async act(act, [a]) {
      if (act === 'note-tag') { H.vs('notes', NDEF).tag = a; App.render(); }
      if (act === 'pin') { const n = St.get('notes', a); if (n) try { await St.save('notes', { ...n, pinned: !n.pinned }, { quiet: true }); } catch (e) { U.fail(e); } }
    },
    change: e => H.filterChange(e, 'notes', NDEF), input: e => H.filterInput(e, 'notes', NDEF),
  };

  // ================= RELATÓRIOS =================
  const PERIODS = [['week', 'Esta semana'], ['month', 'Este mês'], ['last30', 'Últimos 30 dias'], ['lastmonth', 'Mês passado'], ['custom', 'Personalizado']];
  function periodRange(v) {
    const t = now(), ws = S.settings.weekStart;
    switch (v.period) {
      case 'week': return M.range('week', t, ws);
      case 'month': return M.range('month', t);
      case 'lastmonth': { const a = M.addMonths(M.startOfMonth(t), -1); return [a, M.startOfMonth(t)]; }
      case 'custom': return [M.parseDate(v.from || today()), M.addDays(M.parseDate(v.to || today()), 1)];
      default: return [M.addDays(M.startOfDay(t), -29), M.addDays(M.startOfDay(t), 1)];
    }
  }
  const REPDEF = { period: 'month', from: '', to: '', project: '', client: '', category: '' };
  Views.relatorios = {
    render() {
      const v = H.vs('report', REPDEF), [from, to] = periodRange(v), t = now();
      const r = M.report(S, { from, to, projectId: v.project, clientId: v.client, category: v.category }, t);
      const sum = r.sum, nDays = Math.round((to - from) / M.DAY);
      const daily = Array.from({ length: nDays }, (_, i) => M.addDays(from, i));
      const byWeek = nDays > 45;
      const series = byWeek ? groupWeeks(daily, sum.byDay) : daily.map(d => ({ label: nDays > 16 ? new Date(d).getDate() : U.fmtDate(M.isoDate(d), { short: true }), value: (sum.byDay[M.isoDate(d)] || 0) / M.HOUR }));
      const doneByDay = daily.map(d => ({ label: nDays > 16 ? new Date(d).getDate() : U.fmtDate(M.isoDate(d), { short: true }), value: r.doneTasks.filter(x => M.isoDate(x.completedAt) === M.isoDate(d)).length }));
      const proj = Object.entries(sum.byProject).map(([id, ms]) => ({ label: H.pname(id) || 'Demanda excluída', value: ms })).sort((a, b) => b.value - a.value);
      const cat = Object.entries(sum.byCategory).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
      // carga das próximas 4 semanas (tarefas abertas com estimativa)
      const ws = M.startOfWeek(t, S.settings.weekStart), cap = M.weeklyCapacityH(S.settings);
      const load = Array.from({ length: 4 }, (_, i) => { const a = M.isoDate(M.addDays(ws, 7 * i)), b = M.isoDate(M.addDays(ws, 7 * i + 7)); return { label: U.fmtDate(a, { short: true }), value: S.tasks.filter(x => x.status !== 'done' && (x.date || x.due) >= a && (x.date || x.due) < b).reduce((s, x) => s + (Number(x.estimateH) || 0), 0) }; });
      const within = r.estimate.filter(x => x.t.status === 'done'), withinOk = within.filter(x => x.real <= x.est).length;
      const stat = (l, val, hint) => h`<div class="stat"><span class="stat-label">${l}</span><span class="stat-value">${val}</span>${hint ? h`<span class="stat-hint">${hint}</span>` : ''}</div>`;
      return h`${App.page('Relatórios', `${U.fmtDate(M.isoDate(from))} a ${U.fmtDate(M.isoDate(to - 1))}`, h`<button class="btn" data-act="csv:sessions">${icon('download')} Sessões (CSV)</button><button class="btn" data-act="csv:projects">${icon('download')} Por demanda (CSV)</button><button class="btn" data-act="csv:tasks">${icon('download')} Tarefas (CSV)</button><button class="btn ghost" data-act="print">${icon('print')} Imprimir</button>`)}
      <div class="toolbar no-print"><select data-f="period" aria-label="Período">${PERIODS.map(([a, b]) => h`<option value="${a}"${a === v.period ? U.raw(' selected') : ''}>${b}</option>`)}</select>
        ${v.period === 'custom' ? h`<label class="inline">De <input type="date" data-f="from" value="${v.from || today()}"></label><label class="inline">até <input type="date" data-f="to" value="${v.to || today()}"></label>` : ''}
        ${H.sel('project', App.opt.projects(), v.project, 'Todas as demandas')}${H.sel('client', App.opt.clients(), v.client, 'Todos os solicitantes')}${H.sel('category', S.settings.categories.map(c => [c, c]), v.category, 'Todas as categorias')}</div>
      <section class="panel"><header class="panel-head"><h2>Indicadores objetivos</h2><span class="muted">contagens e horas registradas</span></header>
        <div class="stats-panel inner">
          ${stat('Horas trabalhadas', U.fmtDur(sum.workedMs), 'pausas descontadas')}
          ${sum.workdayMs != null ? stat('Tempo de expediente', U.fmtDur(sum.workdayMs)) : ''}
          ${sum.breakMs != null ? stat('Pausas', U.fmtDur(sum.breakMs), sum.workdayMs ? Math.round(sum.breakMs / sum.workdayMs * 100) + '% do expediente' : '') : ''}
          ${stat('Em demandas', U.fmtDur(sum.projectMs))}${!v.project ? stat('Sem classificação', U.fmtDur(sum.unclassifiedMs)) : ''}
          ${stat('Tarefas concluídas', r.doneTasks.length)}${stat('Demandas concluídas', r.doneProjects.length, `${r.onTime} no prazo · ${r.lateDone} fora do prazo`)}
          ${stat('Demandas atrasadas agora', r.late.length)}
          ${stat('Tempo médio de execução', r.avgExecDays == null ? '—' : M.f1(r.avgExecDays) + ' dias', 'da criação à conclusão da tarefa')}
          ${stat('Horas médias por tarefa', r.avgTaskWorkedMs == null ? '—' : U.fmtDur(r.avgTaskWorkedMs), 'tarefas concluídas com tempo registrado')}
        </div></section>
      <div class="grid-2">
        <section class="panel"><header class="panel-head"><h2>Horas trabalhadas por ${byWeek ? 'semana' : 'dia'}</h2></header>${U.bars(series, { fmt: x => M.f1(x) + ' h', unit: 'h' })}</section>
        <section class="panel"><header class="panel-head"><h2>Tarefas concluídas por dia</h2></header>${U.bars(doneByDay, { fmt: x => x + ' tarefa(s)' })}</section>
        <section class="panel"><header class="panel-head"><h2>Tempo por demanda</h2></header>${U.hbars(proj.slice(0, 12), U.fmtDur)}</section>
        <section class="panel"><header class="panel-head"><h2>Tempo por categoria de design</h2></header>${U.hbars(cat, U.fmtDur)}</section>
        <section class="panel"><header class="panel-head"><h2>Carga das próximas 4 semanas</h2><span class="muted">capacidade ${M.f1(cap)} h/semana</span></header>${U.bars(load, { fmt: x => M.f1(x) + ' h estimadas', unit: 'h', highlight: d => d.value > cap })}<p class="small muted">Soma das estimativas das tarefas abertas com data ou prazo em cada semana. Barras em destaque passam da capacidade.</p></section>
        <section class="panel"><header class="panel-head"><h2>Metas</h2><a class="link" href="#metas">Ver metas</a></header>${S.goals.length ? h`<ul class="rows">${S.goals.map(g => { const p = M.goalProgress(g, S, t); return h`<li class="goal-row"><span class="grow">${g.title}</span><span class="mono muted">${M.f1(p.value)} / ${g.target}</span>${U.meter(p.ratio, p.ratio >= 1 ? 'good' : '')}</li>`; })}</ul>` : h`<p class="muted">Nenhuma meta cadastrada.</p>`}</section>
      </div>
      <section class="panel"><header class="panel-head"><h2>Estimado × real</h2><span class="muted">tarefas com estimativa e tempo registrado</span></header>
        ${r.estimate.length ? h`<div class="table-wrap"><table class="table"><thead><tr><th>Tarefa</th><th>Demanda</th><th class="num">Estimado</th><th class="num">Real</th><th class="num">Diferença</th></tr></thead><tbody>${r.estimate.sort((a, b) => (b.real - b.est) - (a.real - a.est)).slice(0, 20).map(x => h`<tr><td><button class="title-btn" data-act="edit:tasks:${x.t.id}">${x.t.title}</button></td><td>${H.pname(x.t.projectId) || '—'}</td><td class="num">${U.fmtDur(x.est)}</td><td class="num">${U.fmtDur(x.real)}</td><td class="num ${x.real > x.est ? 'txt-bad' : 'txt-good'}">${x.real > x.est ? '+' : '−'}${U.fmtDur(Math.abs(x.real - x.est))}</td></tr>`)}</tbody></table></div>` : h`<p class="muted">Nenhuma tarefa com estimativa e tempo registrado.</p>`}</section>
      <section class="panel"><header class="panel-head"><h2>Demandas acima do previsto</h2></header>
        ${r.overBudget.length ? h`<ul class="rows">${r.overBudget.map(x => h`<li><button class="row-btn" data-act="go:demanda:${x.p.id}"><span class="grow ellipsis">${x.p.name}</span><span class="mono">${U.fmtDur(x.real)} de ${U.fmtDur(x.est)}</span>${U.badge('+' + Math.round((x.real / x.est - 1) * 100) + '%', 'bad')}</button></li>`)}</ul>` : h`<p class="muted">Nenhuma demanda passou das horas estimadas.</p>`}</section>
      <section class="panel interp"><header class="panel-head"><h2>Leituras interpretativas</h2><span class="muted">pistas, não medidas de qualidade</span></header>
        <p class="small muted">Horas registradas não medem qualidade nem valor do trabalho. Os números abaixo ajudam a calibrar estimativas e rotina.</p>
        <ul class="rows">
          <li class="goal-row"><span class="grow">Tarefas concluídas dentro do tempo estimado</span><span class="mono">${within.length ? Math.round(withinOk / within.length * 100) + '%' : '—'}</span><span class="muted small">${within.length ? withinOk + ' de ' + within.length : 'sem dados'}</span></li>
          ${sum.workdayMs ? h`<li class="goal-row"><span class="grow">Parte do expediente com cronômetro ligado</span><span class="mono">${Math.round(sum.workedMs / sum.workdayMs * 100)}%</span><span class="muted small">o restante inclui pausas e tempo sem sessão</span></li>` : ''}
          <li class="goal-row"><span class="grow">Demandas concluídas no prazo</span><span class="mono">${r.doneProjects.length ? Math.round(r.onTime / r.doneProjects.length * 100) + '%' : '—'}</span></li>
        </ul></section>`;
    },
    act(act, [a]) {
      const v = H.vs('report', REPDEF), [from, to] = periodRange(v), t = now();
      if (act === 'print') window.print();
      if (act !== 'csv') return;
      const stamp = `${M.isoDate(from)}_a_${M.isoDate(to - 1)}`;
      if (a === 'sessions') {
        const rows = [['Data', 'Início', 'Fim', 'Minutos trabalhados', 'Demanda', 'Categoria', 'Solicitante', 'Tarefa', 'Descrição', 'Manual']];
        S.sessions.filter(s => s.start < to && (s.end ?? t) >= from && (!v.project || s.projectId === v.project)).sort((x, y) => x.start - y.start).forEach(s => { const p = St.get('projects', s.projectId) || {}; if ((v.client && p.clientId !== v.client) || (v.category && p.category !== v.category)) return; rows.push([M.isoDate(s.start), U.fmtTime(s.start), s.end ? U.fmtTime(s.end) : '', Math.round(M.total(M.workedIntervals(s, S.breaks, t).map(iv => M.clip(iv, from, to)).filter(Boolean)) / M.MIN), p.name || '', p.category || '', H.cname(p.clientId) || '', (St.get('tasks', s.taskId) || {}).title || '', s.note || '', s.manual ? 'sim' : '']); });
        U.downloadFile(`prancheta-sessoes_${stamp}.csv`, U.csv(rows), 'text/csv');
      }
      if (a === 'projects') {
        const r = M.report(S, { from, to, projectId: v.project, clientId: v.client, category: v.category }, t);
        const rows = [['Demanda', 'Solicitante', 'Categoria', 'Status', 'Prazo', 'Horas no período', 'Horas totais', 'Horas estimadas', 'Progresso %']];
        S.projects.filter(p => (!v.project || p.id === v.project) && (!v.client || p.clientId === v.client) && (!v.category || p.category === v.category)).forEach(p => rows.push([p.name, H.cname(p.clientId) || '', p.category || '', U.projectStatusName(p.status), p.due || '', M.f1((r.sum.byProject[p.id] || 0) / M.HOUR), M.f1(M.spentMs(S, 'projectId', p.id, t) / M.HOUR), p.estimateH || '', Math.round(M.projectProgress(S.settings, p, S.tasks) * 100)]));
        U.downloadFile(`prancheta-projetos_${stamp}.csv`, U.csv(rows), 'text/csv');
      }
      if (a === 'tasks') {
        const rows = [['Tarefa', 'Demanda', 'Status', 'Prioridade', 'Prazo', 'Concluída em', 'Horas estimadas', 'Horas reais']];
        S.tasks.filter(x => (!v.project || x.projectId === v.project) && (!v.client || x.clientId === v.client)).forEach(x => rows.push([x.title, H.pname(x.projectId) || '', U.label(U.TASK_STATUSES, x.status), U.label(U.PRIORITIES, x.priority), x.due || '', x.completedAt ? M.isoDate(x.completedAt) : '', x.estimateH || '', M.f1(M.spentMs(S, 'taskId', x.id, t) / M.HOUR)]));
        U.downloadFile(`prancheta-tarefas_${stamp}.csv`, U.csv(rows), 'text/csv');
      }
      U.toast('Arquivo CSV gerado.', 'good');
    },
    change(e) { const f = e.target.dataset.f; if (!f) return; const v = H.vs('report', REPDEF); v[f] = e.target.value; if (f === 'period' && v.period === 'custom' && !v.from) { v.from = M.isoDate(M.addDays(now(), -6)); v.to = today(); } App.render(); },
  };
  function groupWeeks(days, byDay) {
    const out = [];
    for (let i = 0; i < days.length; i += 7) out.push({ label: U.fmtDate(M.isoDate(days[i]), { short: true }), value: days.slice(i, i + 7).reduce((s, d) => s + (byDay[M.isoDate(d)] || 0), 0) / M.HOUR });
    return out;
  }

  // ================= METAS =================
  Views.metas = {
    render() {
      const t = now();
      return h`${App.page('Metas', 'Alvos que você define; o progresso é calculado a partir dos registros', h`<button class="btn primary" data-act="new:goals">${icon('plus')} Nova meta</button>`)}
      ${!S.goals.length ? U.empty('Nenhuma meta', 'Exemplos: 30 horas por semana, 4 demandas concluídas por mês, 10 pausas por semana. Metas personalizadas aceitam valor manual.', h`<button class="btn primary" data-act="new:goals">${icon('plus')} Criar meta</button>`)
        : h`<div class="cards goals">${S.goals.map(g => {
          const def = M.GOAL_METRICS[g.metric] || M.GOAL_METRICS.custom, cur = M.goalProgress(g, S, t);
          const hist = Array.from({ length: 6 }, (_, i) => M.goalProgress(g, S, t, 5 - i));
          const behind = def.period && g.metric !== 'custom' && cur.ratio < cur.elapsed - 0.2;
          return h`<article class="card goal"><header><button class="title-btn" data-act="edit:goals:${g.id}">${g.title}</button>${cur.ratio >= 1 ? U.badge('atingida', 'good') : behind ? U.badge('abaixo do ritmo', 'warn') : ''}</header>
            <p class="small muted">${def.label} · ${def.period === 'week' ? 'semana atual' : 'mês atual'}</p>
            <p class="goal-value"><span class="stat-value">${M.f1(cur.value)}</span> <span class="muted">de ${g.target}${def.unit ? ' ' + def.unit : ''}</span></p>
            ${U.meter(cur.ratio, cur.ratio >= 1 ? 'good' : '')}
            ${g.metric !== 'custom' ? h`<p class="small muted">${Math.round(cur.elapsed * 100)}% do período já passou</p><div class="mini-hist" aria-label="Histórico dos últimos 6 períodos">${U.bars(hist.map(p => ({ label: def.period === 'week' ? U.fmtDate(M.isoDate(p.from), { short: true }) : U.MONTHS[new Date(p.from).getMonth()].slice(0, 3), value: p.value })), { fmt: x => M.f1(x), height: 110, highlight: d => d.value >= g.target })}</div>` : ''}
          </article>`;
        })}</div>`}`;
    },
  };

  // ================= INSIGHTS =================
  Views.insights = {
    render() {
      const { items, lack } = M.insights(S, now());
      const order = { bad: 0, warn: 1, info: 2, good: 3 }, label = { bad: 'Atenção', warn: 'Alerta', info: 'Sugestão', good: 'Tudo certo' };
      return h`${App.page('Insights e sugestões', 'Regras simples aplicadas aos seus dados, sem serviços externos')}
      ${items.length ? h`<ul class="insights">${items.sort((a, b) => order[a.level] - order[b.level]).map(x => h`<li class="insight ${x.level}"><div class="ins-head">${U.badge(label[x.level], { bad: 'bad', warn: 'warn', good: 'good', info: 'blue' }[x.level])}<span class="muted small">${x.area}</span></div><p class="ins-title">${x.title}</p><p class="small">${x.detail}</p><p class="small muted">Regra: ${x.rule}</p></li>`)}</ul>` : U.empty('Nenhum alerta no momento', 'Com os dados atuais, nenhuma regra apontou problemas.')}
      ${lack.length ? h`<section class="panel"><header class="panel-head"><h2>Dados insuficientes</h2><span class="muted">estas análises ainda não podem ser feitas</span></header><ul class="plain">${lack.map(l => h`<li>${l}</li>`)}</ul></section>` : ''}`;
    },
  };

  // ================= CONFIGURAÇÕES =================
  const KINDS = [['open', 'Aberta (ainda não começou)'], ['active', 'Em execução'], ['waiting', 'Esperando o solicitante'], ['done', 'Concluída'], ['cancelled', 'Cancelada']];
  Views.configuracoes = {
    render() {
      const s = S.settings;
      const used = id => S.projects.some(p => p.status === id);
      return h`${App.page('Configurações', 'Preferências salvas neste navegador')}
      <div class="settings">
      <form class="panel" data-sf="profile"><h2>Perfil e jornada</h2>
        <div class="form-grid">
          <div class="field"><label for="s-name">Seu nome</label><input id="s-name" name="name" value="${s.name}"></div>
          <div class="field"><label for="s-ws">Início do expediente</label><input id="s-ws" type="time" name="workStart" value="${s.workStart}" required></div>
          <div class="field"><label for="s-we">Fim do expediente</label><input id="s-we" type="time" name="workEnd" value="${s.workEnd}" required></div>
          <div class="field"><label for="s-lunch">Intervalo de almoço (min)</label><input id="s-lunch" type="number" min="0" name="lunchMin" value="${s.lunchMin}"></div>
          <div class="field full"><span class="label">Dias de trabalho</span><div class="checks">${[1, 2, 3, 4, 5, 6, 0].map(d => h`<label class="check"><input type="checkbox" name="workDays" value="${d}"${s.workDays.includes(d) ? U.raw(' checked') : ''}> ${U.WEEKDAYS[d]}</label>`)}</div></div>
        </div><p class="small muted">Jornada diária: ${M.f1(M.workHoursPerDay(s))} h · semanal: ${M.f1(M.weeklyCapacityH(s))} h. Usada para comparar planejado e trabalhado e nos alertas de carga.</p>
        <footer><button class="btn primary">Salvar</button></footer></form>

      <form class="panel" data-sf="breaks"><h2>Pausas e lembretes</h2>
        <div class="field full"><label for="s-bt">Tipos de pausa</label><textarea id="s-bt" name="breakTypes" rows="4">${s.breakTypes.map(b => b.name + ' | ' + b.min).join('\n')}</textarea><small class="hint">Um por linha: nome | minutos. Ex.: Alongamento | 5</small></div>
        <div class="form-grid">
          <div class="field"><label for="s-rem">Lembrar de pausar após (min de trabalho)</label><input id="s-rem" type="number" min="0" name="breakReminderMin" value="${s.breakReminderMin}"><small class="hint">0 desliga. O lembrete só avisa; a pausa só começa quando você iniciar.</small></div>
          <div class="field"><span class="label">Notificações do sistema</span><label class="check"><input type="checkbox" name="notify"${s.notify ? U.raw(' checked') : ''}> Mostrar também fora da aba</label><small class="hint">${'Notification' in window ? 'Permissão atual: ' + ({ granted: 'permitida', denied: 'bloqueada no navegador', default: 'ainda não pedida' }[Notification.permission]) : 'Este navegador não oferece notificações.'}</small></div>
        </div><footer><button class="btn primary">Salvar</button></footer></form>

      <form class="panel" data-sf="lists"><h2>Categorias e listas</h2>
        <div class="form-grid">
          <div class="field"><label for="s-cat">Categorias de demanda</label><textarea id="s-cat" name="categories" rows="8">${s.categories.join('\n')}</textarea><small class="hint">Uma por linha.</small></div>
          <div class="field"><label for="s-rc">Categorias de referência</label><textarea id="s-rc" name="refCategories" rows="8">${s.refCategories.join('\n')}</textarea></div>
          <div class="field"><label for="s-nk">Tipos de anotação</label><textarea id="s-nk" name="noteKinds" rows="8">${s.noteKinds.join('\n')}</textarea></div>
          <div class="field"><label for="s-tools">Ferramentas</label><textarea id="s-tools" name="tools" rows="8">${(s.tools || []).join('\n')}</textarea><small class="hint">Usadas em cursos, materiais, exercícios e fluxos.</small></div>
          <div class="field"><label for="s-lc">Categorias de aprendizado</label><textarea id="s-lc" name="learningCategories" rows="8">${(s.learningCategories || []).join('\n')}</textarea></div>
          <div class="field"><label for="s-ec">Critérios de avaliação da prática</label><textarea id="s-ec" name="evalCriteria" rows="8">${(s.evalCriteria || []).join('\n')}</textarea></div>
        </div><footer><button class="btn primary">Salvar</button></footer></form>

      <form class="panel" data-sf="statuses"><h2>Status das demandas</h2>
        <p class="small muted">A ordem define as colunas do Kanban. O “comportamento” diz aos indicadores o que o status significa.</p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>Comportamento</th><th></th></tr></thead><tbody id="status-rows">
          ${s.projectStatuses.map(st => statusRow(st, used(st.id)))}</tbody></table></div>
        <footer><button type="button" class="btn" data-act="add-status">${icon('plus')} Adicionar status</button><span class="grow"></span><button class="btn primary">Salvar</button></footer></form>

      <form class="panel" data-sf="prefs"><h2>Calendário, datas e interface</h2>
        <div class="form-grid">
          <div class="field"><label for="s-wk">Semana começa em</label><select id="s-wk" name="weekStart"><option value="1"${s.weekStart === 1 ? U.raw(' selected') : ''}>segunda-feira</option><option value="0"${s.weekStart === 0 ? U.raw(' selected') : ''}>domingo</option></select></div>
          <div class="field"><label for="s-cv">Visão inicial do calendário</label><select id="s-cv" name="calendarView">${[['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']].map(([a, b]) => h`<option value="${a}"${s.calendarView === a ? U.raw(' selected') : ''}>${b}</option>`)}</select></div>
          <div class="field"><label for="s-df">Formato de data</label><select id="s-df" name="dateFormat"><option value="dd/mm/aaaa"${s.dateFormat === 'dd/mm/aaaa' ? U.raw(' selected') : ''}>31/10/2026</option><option value="aaaa-mm-dd"${s.dateFormat === 'aaaa-mm-dd' ? U.raw(' selected') : ''}>2026-10-31</option></select><small class="hint">Horários sempre em 24 h.</small></div>
          <div class="field"><label for="s-th">Tema</label><select id="s-th" name="theme"><option value="claro"${s.theme !== 'sol' ? U.raw(' selected') : ''}>Claro (verde-musgo)</option><option value="sol"${s.theme === 'sol' ? U.raw(' selected') : ''}>Pôr do sol (vidro escuro)</option></select></div>
          <div class="field"><label for="s-ac">Cor de destaque</label><input id="s-ac" type="color" name="accent" value="${s.accent && !['#4f8bff', '#2f5bd3'].includes(s.accent.toLowerCase()) ? s.accent : App.themeAccent()}"><small class="hint">Deixe na cor sugerida para seguir o tema.</small></div>
          <div class="field"><label for="s-mt">Alerta de dia cheio (tarefas por dia)</label><input id="s-mt" type="number" min="1" name="maxTasksPerDay" value="${s.maxTasksPerDay}"></div>
          <div class="field"><label for="s-sd">Alerta de espera do solicitante (dias)</label><input id="s-sd" type="number" min="1" name="staleDays" value="${s.staleDays}"></div>
          <div class="field full"><span class="label">Blocos da página inicial</span><div class="checks">${[['today', 'Tarefas do dia'], ['deadlines', 'Prazos e compromissos'], ['goals', 'Metas da semana'], ['charts', 'Gráficos'], ['activity', 'Atividades recentes'], ['flows', 'Etapas de fluxo pendentes'], ['learning', 'Aprendizado (cursos e estudo da semana)'], ['practice', 'Exercícios pendentes']].map(([k, l]) => h`<label class="check"><input type="checkbox" name="dash" value="${k}"${s.dashboard[k] ? U.raw(' checked') : ''}> ${l}</label>`)}</div></div>
        </div><footer><button class="btn primary">Salvar</button></footer></form>

      <form class="panel" data-sf="password"><h2>Senha</h2>
        <p class="small muted">A senha é pedida ao abrir a Prancheta numa aba nova. Para travar agora, use o cadeado no trilho de ícones. Ela impede que outra pessoa abra a Prancheta no seu navegador; os dados em si não ficam criptografados.</p>
        <div class="form-grid">
          <div class="field"><label for="s-pw0">Senha atual</label><input id="s-pw0" type="password" name="current" autocomplete="current-password"></div>
          <div class="field"></div>
          <div class="field"><label for="s-pw1">Nova senha</label><input id="s-pw1" type="password" name="next" autocomplete="new-password"></div>
          <div class="field"><label for="s-pw2">Repita a nova senha</label><input id="s-pw2" type="password" name="again" autocomplete="new-password"></div>
        </div><footer><button class="btn primary">Trocar senha</button></footer></form>

      <form class="panel" data-sf="autolock"><h2>Bloqueio automático</h2>
        <div class="form-grid"><div class="field"><label for="s-al">Bloquear sozinho depois de parado por</label><select id="s-al" name="autoLockMin">${[[0, 'Nunca'], [1, '1 minuto'], [5, '5 minutos'], [10, '10 minutos'], [15, '15 minutos'], [30, '30 minutos'], [60, '1 hora']].map(([a, b]) => h`<option value="${a}"${Number(s.autoLockMin) === a ? U.raw(' selected') : ''}>${b}</option>`)}</select>
          <small class="hint">Conta o tempo sem mexer no mouse ou no teclado, também com o Mac em repouso. Ao bloquear, nada se perde: formulários, cronômetro e música continuam.</small></div></div>
        <footer><button class="btn primary">Salvar</button></footer></form>

      <section class="panel" id="dados"><h2>Dados e backup</h2>
        <div class="notice">${icon('info')}<p>Tudo fica no armazenamento local (IndexedDB) <strong>deste navegador neste computador</strong>. Não há sincronização em nuvem nem backup automático externo. Outro navegador ou computador não vê estes dados, e limpar os dados do site apaga tudo. <strong>Exporte um backup regularmente</strong> e guarde o arquivo em local seguro.</p></div>
        <p class="small" id="storage-status">Verificando armazenamento…</p>
        <div class="row"><button class="btn primary" data-act="export">${icon('download')} Exportar backup completo (.json)</button></div>
        <h3>Importar backup</h3>
        <div class="row"><input type="file" id="import-file" accept="application/json,.json" aria-label="Arquivo de backup">
          <label class="check"><input type="radio" name="import-mode" value="merge" checked> Mesclar (sem duplicar; mantém a versão mais recente de cada registro)</label>
          <label class="check"><input type="radio" name="import-mode" value="replace"> Substituir tudo</label>
          <button class="btn" data-act="import">${icon('upload')} Validar e importar</button></div>
        <h3>Demonstração</h3>
        <div class="row"><button class="btn" data-act="load-demo">Carregar dados de demonstração</button><button class="btn" data-act="clear-demo">Remover dados de demonstração</button></div>
        <h3>Atalhos de teclado</h3>
        <ul class="plain small"><li><kbd>/</kbd> buscar</li><li><kbd>${U.keyAlt}</kbd>+<kbd>N</kbd> nova tarefa · <kbd>${U.keyAlt}</kbd>+<kbd>P</kbd> nova demanda · <kbd>${U.keyAlt}</kbd>+<kbd>A</kbd> nova anotação</li><li><kbd>${U.keyAlt}</kbd>+<kbd>T</kbd> iniciar/parar cronômetro · <kbd>${U.keyAlt}</kbd>+<kbd>B</kbd> pausa · <kbd>${U.keyAlt}</kbd>+<kbd>E</kbd> expediente</li></ul>
        <h3 class="txt-bad">Zona de perigo</h3>
        <div class="row"><button class="btn danger ghost" data-act="wipe">${icon('trash')} Apagar todos os dados</button></div>
      </section></div>`;
    },
    async mount(root) {
      const el = root.querySelector('#storage-status');
      try {
        const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
        const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
        const n = M.STORES.reduce((a, s) => a + S[s].length, 0);
        el.textContent = `${n} registros salvos. ${est ? 'Espaço usado pelo site: ' + (est.usage / 1048576).toFixed(1) + ' MB. ' : ''}${persisted === true ? 'O navegador marcou o armazenamento como persistente (não é apagado automaticamente quando falta espaço).' : persisted === false ? 'O navegador não garantiu armazenamento persistente: em falta de espaço, ele pode apagar os dados. Mais um motivo para exportar backups.' : ''}`;
      } catch { el.textContent = 'Não foi possível consultar o armazenamento.'; }
      root.querySelectorAll('form[data-sf]').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); saveSection(f); }));
    },
    async act(act) {
      if (act === 'add-status') { document.getElementById('status-rows').insertAdjacentHTML('beforeend', U.html(statusRow({ id: '', name: '', kind: 'active' }, false))); document.querySelector('#status-rows tr:last-child input').focus(); }
      if (act === 'export') exportBackup();
      if (act === 'import') importBackup();
      if (act === 'wipe') wipe();
    },
  };
  document.addEventListener('click', e => { const b = e.target.closest('[data-del-status]'); if (b) b.closest('tr').remove(); });
  function statusRow(st, used) {
    return h`<tr data-id="${st.id}"><td><input name="st-name" value="${st.name}" aria-label="Nome do status" required></td><td><select name="st-kind" aria-label="Comportamento">${KINDS.map(([a, b]) => h`<option value="${a}"${st.kind === a ? U.raw(' selected') : ''}>${b}</option>`)}</select></td>
      <td>${used ? h`<span class="small muted">em uso</span>` : h`<button type="button" class="icon-btn" data-del-status aria-label="Remover status">${icon('x')}</button>`}</td></tr>`;
  }
  async function saveSection(f) {
    const fd = new FormData(f), sec = f.dataset.sf, lines = k => String(fd.get(k) || '').split('\n').map(x => x.trim()).filter(Boolean);
    const err = msg => U.toast(msg, 'bad', 6000);
    let patch;
    if (sec === 'profile') {
      const workDays = fd.getAll('workDays').map(Number);
      if (fd.get('workStart') >= fd.get('workEnd')) return err('O fim do expediente precisa ser depois do início.');
      if (!workDays.length) return err('Escolha ao menos um dia de trabalho.');
      patch = { name: String(fd.get('name')).trim(), workStart: fd.get('workStart'), workEnd: fd.get('workEnd'), lunchMin: Math.max(0, Number(fd.get('lunchMin')) || 0), workDays };
    }
    if (sec === 'breaks') {
      const types = [];
      for (const l of lines('breakTypes')) { const [name, min] = l.split('|').map(x => x.trim()); if (!name || !(Number(min) > 0)) return err(`Linha inválida: “${l}”. Use nome | minutos.`); const old = S.settings.breakTypes.find(b => b.name === name); types.push({ id: old ? old.id : M.uid(), name, min: Number(min) }); }
      if (!types.length) return err('Cadastre ao menos um tipo de pausa.');
      const notify = fd.get('notify') === 'on';
      if (notify && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission().catch(() => {});
      patch = { breakTypes: types, breakReminderMin: Math.max(0, Number(fd.get('breakReminderMin')) || 0), notify };
    }
    if (sec === 'lists') {
      patch = { categories: [...new Set(lines('categories'))], refCategories: [...new Set(lines('refCategories'))], noteKinds: [...new Set(lines('noteKinds'))], tools: [...new Set(lines('tools'))], learningCategories: [...new Set(lines('learningCategories'))], evalCriteria: [...new Set(lines('evalCriteria'))] };
      if (Object.values(patch).some(l => !l.length)) return err('Nenhuma lista pode ficar vazia.');
    }
    if (sec === 'statuses') {
      const rows = [...f.querySelectorAll('#status-rows tr')].map(tr => ({ id: tr.dataset.id || M.uid(), name: tr.querySelector('[name=st-name]').value.trim(), kind: tr.querySelector('[name=st-kind]').value }));
      if (rows.some(r => !r.name)) return err('Todo status precisa de um nome.');
      if (!rows.some(r => r.kind === 'done')) return err('É preciso ao menos um status com comportamento “Concluída”.');
      if (!rows.some(r => !['done', 'cancelled'].includes(r.kind))) return err('É preciso ao menos um status em aberto.');
      const missing = S.projects.find(p => !rows.some(r => r.id === p.status));
      if (missing) return err(`O status de “${missing.name}” está em uso e não pode ser removido.`);
      patch = { projectStatuses: rows };
    }
    if (sec === 'password') {
      if (fd.get('next') !== fd.get('again')) return err('As novas senhas não são iguais.');
      try { await window.Lock.changePassword(String(fd.get('current')), String(fd.get('next'))); f.reset(); U.toast('Senha trocada.', 'good'); } catch (e) { err(e.message); }
      return;
    }
    if (sec === 'autolock') patch = { autoLockMin: Math.max(0, Number(fd.get('autoLockMin')) || 0) };
    if (sec === 'prefs') {
      const dash = fd.getAll('dash');
      patch = { weekStart: Number(fd.get('weekStart')), calendarView: fd.get('calendarView'), dateFormat: fd.get('dateFormat'), theme: fd.get('theme') === 'sol' ? 'sol' : 'claro', accent: Object.values(App.THEME_ACCENT).includes(String(fd.get('accent')).toLowerCase()) ? '' : fd.get('accent'), maxTasksPerDay: Math.max(1, Number(fd.get('maxTasksPerDay')) || 5), staleDays: Math.max(1, Number(fd.get('staleDays')) || 5), dashboard: Object.fromEntries(['today', 'deadlines', 'goals', 'charts', 'activity', 'flows', 'learning', 'practice'].map(k => [k, dash.includes(k)])) };
    }
    try { await St.saveSettings(patch); U.toast('Configurações salvas.', 'good'); } catch (e) { U.fail(e); }
  }
  function backupName() { return `prancheta-backup_${M.isoDate(now())}_${U.fmtTime(now()).replace(':', 'h')}.json`; }
  function exportBackup() {
    try { U.downloadFile(backupName(), JSON.stringify(St.exportAll(), null, 1), 'application/json'); U.toast('Backup exportado. Guarde o arquivo em local seguro.', 'good', 5000); } catch (e) { U.fail(e); }
  }
  async function importBackup() {
    const file = document.getElementById('import-file').files[0];
    if (!file) return U.toast('Escolha um arquivo de backup (.json).', 'bad');
    const mode = document.querySelector('[name=import-mode]:checked').value;
    let obj;
    try { obj = JSON.parse(await file.text()); } catch { return U.toast('O arquivo não é um JSON válido.', 'bad', 6000); }
    const check = M.validateBackup(obj);
    if (!check.ok) {
      U.dialog(h`<form method="dialog" class="ask"><h2>Backup inválido</h2><p>Nada foi alterado. Problemas encontrados:</p><ul class="plain small">${check.errors.map(e => h`<li>${e}</li>`)}</ul><div class="actions"><button class="btn primary">Fechar</button></div></form>`, 'small');
      return;
    }
    const count = Object.entries(check.counts).filter(([, n]) => n).map(([k, n]) => `${n} ${(St.LABELS[k] || k).toLowerCase()}`).join(', ');
    const ok = await U.ask({ title: mode === 'replace' ? 'Substituir todos os dados?' : 'Mesclar o backup?', text: `O arquivo é válido (${count || 'vazio'}, exportado em ${obj.exportedAt ? new Date(obj.exportedAt).toLocaleString('pt-BR') : 'data desconhecida'}). ${mode === 'replace' ? 'Todos os dados atuais serão apagados e trocados pelos do arquivo. Antes disso, um backup dos dados atuais será baixado.' : 'Registros novos serão adicionados; registros iguais ficam com a versão mais recente. Nada é duplicado.'}`, ok: mode === 'replace' ? 'Substituir' : 'Mesclar', danger: mode === 'replace' });
    if (!ok) return;
    try {
      if (mode === 'replace') U.downloadFile('antes-da-importacao_' + backupName(), JSON.stringify(St.exportAll(), null, 1), 'application/json');
      const res = await St.importAll(obj, mode);
      const added = Object.values(res).reduce((a, x) => a + x.added, 0), upd = Object.values(res).reduce((a, x) => a + x.updated, 0);
      U.toast(`Importação concluída: ${added} adicionado(s), ${upd} atualizado(s).`, 'good', 6000);
    } catch (e) { U.fail(e); }
  }
  async function wipe() {
    const d = U.dialog(h`<form method="dialog" class="ask"><h2>Apagar todos os dados?</h2><p>Demandas, tarefas, solicitantes, horários, anotações e configurações serão apagados deste navegador. Exporte um backup antes se quiser guardar algo.</p><label for="wipe-confirm">Digite <strong>APAGAR</strong> para confirmar</label><input id="wipe-confirm" autocomplete="off"><div class="actions"><button value="no" class="btn">Cancelar</button><button value="yes" class="btn danger">Apagar tudo</button></div></form>`, 'small');
    d.addEventListener('close', async () => {
      if (d.returnValue !== 'yes') return;
      if (d.querySelector('#wipe-confirm').value.trim() !== 'APAGAR') return U.toast('Confirmação incorreta: nada foi apagado.', 'bad');
      try { await St.importAll({ data: {} }, 'replace'); await St.saveSettings(structuredClone(M.DEFAULT_SETTINGS)); U.toast('Todos os dados foram apagados.', 'good'); } catch (e) { U.fail(e); }
    });
  }
})();
