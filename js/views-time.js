// Telas de tempo: Controle de tempo, Pausas e Calendário.
(function () {
  'use strict';
  const M = window.Model, U = window.UI, St = window.Store, S = St.S, App = window.App;
  const { h, icon } = U;
  const Views = window.Views;
  const H = Views.helpers;
  const now = () => Date.now(), today = () => M.isoDate(now());
  const tname = id => (St.get('tasks', id) || {}).title;

  // ================= CONTROLE DE TEMPO =================
  const TDEF = { from: '', to: '', kind: 'sessions' };
  function plannedMs(from, to) {
    let ms = 0; const set = S.settings, daily = M.workHoursPerDay(set) * M.HOUR;
    for (let d = from; d < to; d = M.addDays(d, 1)) if (set.workDays.includes(new Date(d).getDay())) ms += daily;
    return ms;
  }
  Views.tempo = {
    render() {
      const t = now(), set = S.settings, w = App.active.workday(), s = App.active.session(), b = App.active.brk();
      const v = H.vs('time', TDEF);
      if (!v.from) { v.from = M.isoDate(M.addDays(t, -6)); v.to = today(); }
      const per = ['day', 'week', 'month'].map(k => { const [a, z] = M.range(k, t, set.weekStart); return { k, sum: M.timeSummary(S, a, z, t), plan: plannedMs(a, z) }; });
      const day = per[0].sum;
      const idle = Math.max(0, day.workdayMs - day.workedMs - day.breakMs);
      const p = s && St.get('projects', s.projectId), paused = App.isPaused(s);
      const from = M.parseDate(v.from), to = M.addDays(M.parseDate(v.to), 1);
      const rows = (v.kind === 'sessions' ? S.sessions : v.kind === 'breaks' ? S.breaks : S.workdays).filter(r => r.start < to && (r.end ?? t) >= from).sort((a, c) => c.start - a.start);
      const range = M.timeSummary(S, from, to, t);
      const days = Object.keys({ ...range.byDay, ...range.breakByDay }).sort().reverse();
      const estRows = S.projects.filter(x => !M.isClosed(set, x) && x.estimateH > 0).map(x => ({ p: x, real: M.spentMs(S, 'projectId', x.id, t), est: x.estimateH * M.HOUR }));
      const dur = r => v.kind === 'sessions' ? M.total(M.workedIntervals(r, S.breaks, t)) : (r.end ?? t) - r.start;
      return h`${App.page('Controle de tempo', 'Expediente, sessões de trabalho e horas registradas', h`<button class="btn" data-act="time-edit:sessions">${icon('plus')} Registrar sessão manual</button><button class="btn" data-act="time-edit:workdays">${icon('plus')} Registrar expediente</button>`)}
      <div class="grid-2">
        <section class="panel timer-panel">
          <header class="panel-head"><h2>Expediente</h2>${w ? U.badge('aberto', 'good') : U.badge('fechado', 'muted')}</header>
          <p class="big-clock mono" data-live="workday">${w ? U.fmtClock(t - w.start) : '00:00:00'}</p>
          <p class="muted">${w ? 'Iniciado às ' + U.fmtTime(w.start) + (M.isoDate(w.start) !== today() ? ' de ' + U.fmtDate(M.isoDate(w.start)) + '. Ficou aberto desde outro dia: encerre ou corrija o horário.' : '') : `Horário habitual: ${set.workStart} às ${set.workEnd}`}</p>
          <div class="row"><button class="btn ${w ? '' : 'primary'}" data-act="workday">${icon('briefcase')} ${w ? 'Encerrar expediente' : 'Iniciar expediente'}</button>${w ? h`<button class="btn ghost" data-act="time-edit:workdays:${w.id}">Corrigir horário</button>` : ''}</div>
        </section>
        <section class="panel timer-panel">
          <header class="panel-head"><h2>Sessão de trabalho</h2>${s ? U.badge(paused ? 'pausada' : b ? 'em pausa registrada' : 'em andamento', paused || b ? 'warn' : 'good') : U.badge('parada', 'muted')}</header>
          <p class="big-clock mono" data-live="session">${s ? U.fmtClock(M.total(M.workedIntervals(s, S.breaks, t))) : '00:00:00'}</p>
          <p class="muted">${s ? [p ? p.name : 'Sem projeto', tname(s.taskId), s.note].filter(Boolean).join(' · ') + ' · desde ' + U.fmtTime(s.start) : 'Escolha um projeto e uma tarefa ao iniciar. Pausas registradas não contam como tempo trabalhado.'}</p>
          <div class="row">${s ? h`<button class="btn" data-act="${paused ? 'session-resume' : 'session-pause'}">${icon(paused ? 'play' : 'pause')} ${paused ? 'Retomar' : 'Pausar sessão'}</button><button class="btn primary" data-act="session-stop">${icon('stop')} Encerrar sessão</button><button class="btn ghost" data-act="time-edit:sessions:${s.id}">Corrigir</button>` : h`<button class="btn primary" data-act="session-start">${icon('play')} Iniciar cronômetro</button>`}</div>
        </section>
      </div>
      <section class="panel"><header class="panel-head"><h2>Hoje</h2><span class="muted">pausas nunca entram como tempo trabalhado</span></header>
        <div class="stats-panel inner">
          <div class="stat"><span class="stat-label">Tempo de expediente</span><span class="stat-value">${U.fmtDur(day.workdayMs)}</span></div>
          <div class="stat"><span class="stat-label">Efetivamente trabalhado</span><span class="stat-value" data-live="today-worked">${U.fmtDur(day.workedMs)}</span></div>
          <div class="stat"><span class="stat-label">Pausas</span><span class="stat-value">${U.fmtDur(day.breakMs)}</span></div>
          <div class="stat"><span class="stat-label">Em projetos</span><span class="stat-value">${U.fmtDur(day.projectMs)}</span></div>
          <div class="stat"><span class="stat-label">Sem classificação</span><span class="stat-value">${U.fmtDur(day.unclassifiedMs)}</span><span class="stat-hint">sessões sem projeto</span></div>
          <div class="stat"><span class="stat-label">Expediente sem sessão</span><span class="stat-value">${U.fmtDur(idle)}</span><span class="stat-hint">aberto, mas sem cronômetro</span></div>
        </div></section>
      <section class="panel"><header class="panel-head"><h2>Planejado × trabalhado</h2><span class="muted">planejado = jornada de ${M.f1(M.workHoursPerDay(set))} h nos dias de trabalho</span></header>
        <ul class="rows">${per.map(x => h`<li class="goal-row"><span class="grow">${{ day: 'Hoje', week: 'Esta semana', month: 'Este mês' }[x.k]}</span><span class="mono">${U.fmtDur(x.sum.workedMs)} / ${U.fmtDur(x.plan)}</span>${U.meter(x.plan ? x.sum.workedMs / x.plan : 0)}</li>`)}</ul></section>
      ${estRows.length ? h`<section class="panel"><header class="panel-head"><h2>Estimado × realizado por projeto</h2><span class="muted">projetos abertos com estimativa</span></header>
        <div class="table-wrap"><table class="table"><thead><tr><th>Projeto</th><th class="num">Estimado</th><th class="num">Realizado</th><th class="num">Diferença</th><th></th></tr></thead><tbody>${estRows.map(x => h`<tr><td><button class="title-btn" data-act="go:projeto:${x.p.id}">${x.p.name}</button></td><td class="num">${U.fmtDur(x.est)}</td><td class="num">${U.fmtDur(x.real)}</td><td class="num ${x.real > x.est ? 'txt-bad' : ''}">${x.real > x.est ? '+' : '−'}${U.fmtDur(Math.abs(x.real - x.est))}</td><td class="w-meter">${U.meter(x.real / x.est, x.real > x.est ? 'bad' : '')}</td></tr>`)}</tbody></table></div></section>` : ''}
      <section class="panel"><header class="panel-head"><h2>Histórico</h2></header>
        <div class="toolbar"><label class="inline">De <input type="date" data-f="from" value="${v.from}"></label><label class="inline">até <input type="date" data-f="to" value="${v.to}"></label>
          ${H.seg('timekind', [['sessions', 'Sessões'], ['workdays', 'Expedientes'], ['breaks', 'Pausas'], ['days', 'Por dia']], v.kind)}</div>
        ${v.kind === 'days' ? (days.length ? h`<div class="table-wrap"><table class="table"><thead><tr><th>Dia</th><th class="num">Trabalhado</th><th class="num">Pausas</th><th class="num">Planejado</th></tr></thead><tbody>${days.map(d => h`<tr><td>${U.fmtDate(d)} <span class="muted">${U.WEEKDAYS[new Date(M.parseDate(d)).getDay()]}</span></td><td class="num">${U.fmtDur(range.byDay[d] || 0)}</td><td class="num">${U.fmtDur(range.breakByDay[d] || 0)}</td><td class="num muted">${U.fmtDur(plannedMs(M.parseDate(d), M.addDays(M.parseDate(d), 1)))}</td></tr>`)}<tr class="total"><td>Total</td><td class="num">${U.fmtDur(range.workedMs)}</td><td class="num">${U.fmtDur(range.breakMs)}</td><td class="num">${U.fmtDur(plannedMs(from, to))}</td></tr></tbody></table></div>` : U.empty('Sem registros neste período', 'Ajuste as datas.'))
        : rows.length ? h`<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Início</th><th>Fim</th><th class="num">Duração</th><th>${v.kind === 'sessions' ? 'Projeto / tarefa' : v.kind === 'breaks' ? 'Tipo' : ''}</th><th></th></tr></thead><tbody>
          ${rows.map(r => h`<tr><td>${U.fmtDate(M.isoDate(r.start))}</td><td class="mono">${U.fmtTime(r.start)}</td><td class="mono">${r.end ? U.fmtTime(r.end) + (M.isoDate(r.end) !== M.isoDate(r.start) ? ' (+1)' : '') : U.badge('em andamento', 'good')}</td><td class="num mono">${U.fmtDur(dur(r))}</td>
            <td class="small">${v.kind === 'sessions' ? [H.pname(r.projectId) || 'Sem projeto', tname(r.taskId), r.note].filter(Boolean).join(' · ') : v.kind === 'breaks' ? r.typeName : ''}${r.manual ? h` ${U.badge('manual', 'muted')}` : ''}${(r.history || []).length ? h` ${U.badge('editado', 'muted')}` : ''}${(r.pauses || []).length ? h` <span class="muted">${r.pauses.length} pausa(s) da sessão</span>` : ''}</td>
            <td><button class="icon-btn" data-act="time-edit:${v.kind}:${r.id}" aria-label="Editar registro">${icon('edit')}</button></td></tr>`)}</tbody></table></div>` : U.empty('Sem registros neste período', 'Ajuste as datas ou registre manualmente.')}
      </section>`;
    },
    act(act, [k, val]) { if (act === 'mode' && k === 'timekind') { H.vs('time', TDEF).kind = val; App.render(); } },
    change(e) { const f = e.target.dataset.f; if (f === 'from' || f === 'to') { if (!e.target.value) return; const v = H.vs('time', TDEF); v[f] = e.target.value; if (v.to < v.from) v[f === 'from' ? 'to' : 'from'] = e.target.value; App.render(); } },
  };

  // ================= PAUSAS =================
  Views.pausas = {
    render() {
      const t = now(), set = S.settings, b = App.active.brk(), s = App.active.session();
      const v = H.vs('breaks', { from: M.isoDate(M.addDays(t, -6)), to: today() });
      const [d0, d1] = M.range('day', t), [w0, w1] = M.range('week', t, set.weekStart);
      const dayS = M.timeSummary(S, d0, d1, t), weekS = M.timeSummary(S, w0, w1, t);
      const todayBreaks = S.breaks.filter(x => x.start >= d0 && x.start < d1);
      const from = M.parseDate(v.from), to = M.addDays(M.parseDate(v.to), 1);
      const hist = S.breaks.filter(x => x.start >= from && x.start < to).sort((a, c) => c.start - a.start);
      const byType = {};
      for (const x of hist) byType[x.typeName || x.type] = (byType[x.typeName || x.type] || 0) + ((x.end ?? t) - x.start);
      return h`${App.page('Pausas', 'Você decide quando a pausa começa e termina', h`<button class="btn" data-act="time-edit:breaks">${icon('plus')} Registrar pausa manual</button><a class="btn ghost" href="#configuracoes">Tipos e lembretes</a>`)}
      <div class="grid-2">
        <section class="panel timer-panel">
          <header class="panel-head"><h2>${b ? b.typeName : 'Nenhuma pausa em andamento'}</h2>${b ? U.badge('em pausa', 'warn') : ''}</header>
          ${b ? h`<div class="ring-wrap"><svg class="ring" viewBox="0 0 120 120" data-ring aria-hidden="true"><circle cx="60" cy="60" r="52" class="ring-bg"/><circle cx="60" cy="60" r="52" class="ring-fg" stroke-dasharray="326.7" stroke-dashoffset="326.7"/></svg>
              <div><p class="big-clock mono" data-live="break-elapsed">${U.fmtClock(t - b.start)}</p><p class="muted" data-live="break-left"></p><p class="small muted">Previsto: ${b.plannedMin} min · desde ${U.fmtTime(b.start)}</p></div></div>
              <div class="row"><button class="btn primary" data-act="break-end">${icon('stop')} Encerrar pausa</button><button class="btn ghost" data-act="time-edit:breaks:${b.id}">Corrigir horário</button></div>`
          : h`<p class="muted">Escolha o tipo para iniciar:</p><div class="break-types">${set.breakTypes.map(x => h`<button class="btn block" data-act="break-start:${x.id}">${icon('coffee')} ${x.name}<span class="muted">${x.min} min</span></button>`)}</div>`}
        </section>
        <section class="panel">
          <header class="panel-head"><h2>Ritmo de hoje</h2></header>
          <div class="stats-panel inner">
            <div class="stat"><span class="stat-label">Trabalhando desde a última pausa</span><span class="stat-value" data-live="since-break">${U.fmtDur(M.sinceLastBreak(S, t))}</span><span class="stat-hint">${set.breakReminderMin ? 'lembrete a cada ' + set.breakReminderMin + ' min' + (s ? '' : ' (com sessão ativa)') : 'lembrete desligado'}</span></div>
            <div class="stat"><span class="stat-label">Pausas hoje</span><span class="stat-value">${U.fmtDur(dayS.breakMs)}</span><span class="stat-hint">${todayBreaks.length} pausa(s)</span></div>
            <div class="stat"><span class="stat-label">Pausas na semana</span><span class="stat-value">${U.fmtDur(weekS.breakMs)}</span></div>
            <div class="stat"><span class="stat-label">Pausa / expediente hoje</span><span class="stat-value">${dayS.workdayMs ? Math.round(dayS.breakMs / dayS.workdayMs * 100) + '%' : '—'}</span></div>
          </div>
        </section>
      </div>
      <section class="panel"><header class="panel-head"><h2>Histórico de pausas</h2></header>
        <div class="toolbar"><label class="inline">De <input type="date" data-f="from" value="${v.from}"></label><label class="inline">até <input type="date" data-f="to" value="${v.to}"></label></div>
        ${Object.keys(byType).length ? U.hbars(Object.entries(byType).map(([label, value]) => ({ label, value })), U.fmtDur) : ''}
        ${hist.length ? h`<div class="table-wrap"><table class="table"><thead><tr><th>Data</th><th>Tipo</th><th>Início</th><th>Fim</th><th class="num">Duração</th><th class="num">Previsto</th><th></th></tr></thead><tbody>${hist.map(x => { const d = (x.end ?? t) - x.start; return h`<tr><td>${U.fmtDate(M.isoDate(x.start))}</td><td>${x.typeName}${x.manual ? h` ${U.badge('manual', 'muted')}` : ''}</td><td class="mono">${U.fmtTime(x.start)}</td><td class="mono">${x.end ? U.fmtTime(x.end) : U.badge('agora', 'warn')}</td><td class="num mono ${x.plannedMin && d > x.plannedMin * M.MIN * 1.2 ? 'txt-warn' : ''}">${U.fmtDur(d)}</td><td class="num muted">${x.plannedMin ? x.plannedMin + ' min' : '—'}</td><td><button class="icon-btn" data-act="time-edit:breaks:${x.id}" aria-label="Editar pausa">${icon('edit')}</button></td></tr>`; })}</tbody></table></div>` : U.empty('Nenhuma pausa neste período', 'As pausas que você iniciar ou registrar aparecem aqui.')}
      </section>`;
    },
    mount(root) { const r = root.querySelector('[data-ring]'); if (r) this.ring(r); },
    ring(el) { const b = App.active.brk(); if (!b) return; const f = Math.min(1, (now() - b.start) / (b.plannedMin * M.MIN || 1)); const fg = el.querySelector('.ring-fg'); fg.setAttribute('stroke-dashoffset', 326.7 * (1 - f)); fg.classList.toggle('over', f >= 1); },
    change(e) { const f = e.target.dataset.f; if ((f === 'from' || f === 'to') && e.target.value) { const v = H.vs('breaks', {}); v[f] = e.target.value; App.render(); } },
  };

  // ================= CALENDÁRIO =================
  const KIND = { meeting: 'Reunião', delivery: 'Entrega', review: 'Revisão', approval: 'Aprovação', personal: 'Pessoal', other: 'Outro', task: 'Tarefa', deadline: 'Prazo de projeto', revision: 'Retorno de revisão', work: 'Expediente', break: 'Pausa', session: 'Sessão' };
  // itens do calendário entre duas datas ISO (inclusive); cada tarefa aparece uma única vez
  function items(a, z, withTime) {
    const td = today(), out = [], inR = d => d && d >= a && d <= z;
    for (const e of S.events) if (inR(e.date)) out.push({ d: e.date, time: e.time, end: e.endTime, title: e.title, kind: e.type, act: 'edit:events:' + e.id, drag: 'e:' + e.id });
    for (const t of S.tasks) {
      const d = t.date || t.due; if (!inR(d)) continue;
      out.push({ d, time: t.time, title: t.title, kind: 'task', done: t.status === 'done', late: M.taskOverdue(t, td), sub: t.date && t.due && t.due !== t.date ? 'prazo ' + U.fmtDate(t.due, { short: true }) : '', act: 'edit:tasks:' + t.id, drag: 't:' + t.id });
    }
    for (const p of S.projects) if (inR(p.due)) out.push({ d: p.due, title: p.name, kind: 'deadline', done: M.isClosed(S.settings, p), late: M.projectOverdue(S.settings, p, td), act: 'go:projeto:' + p.id });
    for (const r of S.revisions) if (r.status !== 'approved' && inR(r.nextDue)) out.push({ d: r.nextDue, title: (H.pname(r.projectId) || '') + ' · ' + r.version, kind: 'revision', act: 'edit:revisions:' + r.id });
    if (withTime) {
      const add = (list, kind, label, act) => { for (const x of list) { const d = M.isoDate(x.start); if (inR(d)) out.push({ d, time: U.fmtTime(x.start), end: x.end ? U.fmtTime(x.end) : 'agora', title: label(x), kind, act: act + x.id, bg: true }); } };
      add(S.workdays, 'work', () => 'Expediente', 'time-edit:workdays:');
      add(S.breaks, 'break', x => x.typeName || 'Pausa', 'time-edit:breaks:');
      if (withTime === 'day') add(S.sessions, 'session', x => [H.pname(x.projectId) || 'Sem projeto', tname(x.taskId)].filter(Boolean).join(' · '), 'time-edit:sessions:');
    }
    return out.sort((x, y) => (x.time || '').localeCompare(y.time || ''));
  }
  const chip = (x, compact) => h`<button class="ev k-${x.kind} ${x.done ? 'done' : ''} ${x.late ? 'late' : ''} ${x.bg ? 'bg' : ''}" data-act="${x.act}" ${x.drag ? U.raw(`draggable="true" data-id="${x.drag}"`) : ''} title="${KIND[x.kind]}: ${x.title}${x.time ? ' · ' + x.time : ''}${x.end ? '–' + x.end : ''}">${x.time ? h`<span class="mono">${x.time}${!compact && x.end ? '–' + x.end : ''}</span> ` : ''}${x.late ? icon('alert', 'sm') : ''}${x.title}${!compact && x.sub ? h` <span class="muted">(${x.sub})</span>` : ''}</button>`;
  Views.calendario = {
    render() {
      const v = App.vs.calendar ||= { view: S.settings.calendarView || 'week', cursor: now() };
      const c = v.cursor, ws = S.settings.weekStart, td = today();
      let title, body;
      if (v.view === 'month') {
        const m0 = M.startOfMonth(c), g0 = M.startOfWeek(m0, ws), m1 = M.addMonths(m0, 1);
        const weeks = Math.ceil((m1 - g0) / (7 * M.DAY) - 0.01);
        const all = items(M.isoDate(g0), M.isoDate(M.addDays(g0, weeks * 7 - 1)));
        const mn = U.MONTHS[new Date(c).getMonth()];
        title = mn[0].toUpperCase() + mn.slice(1) + ' de ' + new Date(c).getFullYear();
        body = h`<div class="month"><div class="mhead">${Array.from({ length: 7 }, (_, i) => h`<span>${U.WEEKDAYS[(i + ws) % 7]}</span>`)}</div>
          <div class="mgrid">${Array.from({ length: weeks * 7 }, (_, i) => { const d = M.addDays(g0, i), iso = M.isoDate(d), its = all.filter(x => x.d === iso); return h`<div class="mcell ${d < m0 || d >= m1 ? 'out' : ''} ${iso === td ? 'today' : ''}" data-drop="${iso}" data-day="${iso}"><span class="mday">${new Date(d).getDate()}</span>${its.slice(0, 4).map(x => chip(x, true))}${its.length > 4 ? h`<button class="more" data-act="goto-day:${iso}">+${its.length - 4} mais</button>` : ''}</div>`; })}</div></div>`;
      } else if (v.view === 'week') {
        const w0 = M.startOfWeek(c, ws), all = items(M.isoDate(w0), M.isoDate(M.addDays(w0, 6)), 'week');
        title = `${U.fmtDate(M.isoDate(w0))} a ${U.fmtDate(M.isoDate(M.addDays(w0, 6)))}`;
        body = h`<div class="week">${Array.from({ length: 7 }, (_, i) => { const d = M.addDays(w0, i), iso = M.isoDate(d), its = all.filter(x => x.d === iso); return h`<section class="wcol ${iso === td ? 'today' : ''}" data-drop="${iso}" data-day="${iso}"><header><button class="link" data-act="goto-day:${iso}">${U.WEEKDAYS[new Date(d).getDay()]} <strong>${new Date(d).getDate()}</strong></button></header>${its.map(x => chip(x))}</section>`; })}</div>`;
      } else {
        const iso = M.isoDate(c), its = items(iso, iso, 'day');
        title = new Date(c).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, x => x.toUpperCase());
        body = its.length ? h`<section class="panel"><ul class="dayline">${its.map(x => h`<li class="${x.bg ? 'bgline' : ''}"><span class="when mono">${x.time || 'dia todo'}${x.end ? '–' + x.end : ''}</span><span class="badge k-${x.kind}">${KIND[x.kind]}</span>${chip({ ...x, time: '' })}</li>`)}</ul></section>` : U.empty('Nada neste dia', 'Clique em “Novo evento” para agendar algo.');
      }
      return h`${App.page('Calendário', 'Prazos, tarefas, reuniões, expediente e pausas', h`<button class="btn primary" data-act="new:events" data-defaults='${JSON.stringify({ date: M.isoDate(c) })}'>${icon('plus')} Novo evento</button>`)}
        <div class="toolbar"><div class="seg"><button data-act="cal-nav:-1" aria-label="Anterior">${icon('left')}</button><button data-act="cal-nav:0">Hoje</button><button data-act="cal-nav:1" aria-label="Próximo">${icon('right')}</button></div>
          <h2 class="cal-title">${title}</h2><span class="grow"></span>${H.seg('cal', [['day', 'Dia'], ['week', 'Semana'], ['month', 'Mês']], v.view)}</div>
        ${body}
        <ul class="legend cal-legend">${['meeting', 'delivery', 'review', 'approval', 'personal', 'task', 'deadline', 'revision', 'work', 'break'].map(k => h`<li><i class="k-${k}"></i>${KIND[k]}</li>`)}<li><i class="late-key"></i>Atrasado</li></ul>
        <p class="muted small">Clique num dia vazio para criar um evento. Arraste eventos e tarefas para outro dia para reagendar.</p>`;
    },
    mount(root) {
      H.kanbanDnD(root, async (drag, iso) => {
        const [kind, id] = drag.split(':');
        try {
          if (kind === 'e') { const e = St.get('events', id); if (e && e.date !== iso) await St.save('events', { ...e, date: iso, remindedAt: null }, { verb: 'reagendado' }); }
          else { const t = St.get('tasks', id); if (!t) return; const key = t.date ? 'date' : 'due'; if (t[key] === iso) return; const rec = { ...t, [key]: iso }; if (key === 'date' && rec.due && rec.due < iso) { if (!await U.ask({ title: 'Mover para depois do prazo?', text: `O prazo desta tarefa é ${U.fmtDate(t.due)}. O prazo também será movido para ${U.fmtDate(iso)}.`, ok: 'Mover' })) return; rec.due = iso; } await St.save('tasks', rec, { verb: 'reagendada' }); }
        } catch (e) { U.fail(e); }
      });
      root.querySelectorAll('[data-day]').forEach(cell => cell.addEventListener('click', e => { if (e.target === cell || e.target.classList.contains('mday')) App.edit('events', null, { date: cell.dataset.day }); }));
    },
    act(act, [a, b]) {
      const v = App.vs.calendar;
      if (act === 'mode') { v.view = b; App.render(); }
      if (act === 'goto-day') { v.view = 'day'; v.cursor = M.parseDate(a); App.render(); }
      if (act === 'cal-nav') {
        const n = Number(a);
        v.cursor = !n ? now() : v.view === 'month' ? M.addMonths(v.cursor, n) : M.addDays(v.cursor, n * (v.view === 'week' ? 7 : 1));
        App.render();
      }
    },
  };
})();
