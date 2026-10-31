// Regras de negócio puras: datas, intervalos de tempo, indicadores, metas,
// insights e validação. Não toca no DOM nem no banco, por isso roda no Node
// (tests/model.test.js) e no navegador (window.Model).
(function (root) {
  'use strict';

  const DAY = 86400000, HOUR = 3600000, MIN = 60000;

  // ---------- identificadores e datas ----------
  function uid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  const pad = n => String(n).padStart(2, '0');
  // data local 'AAAA-MM-DD' de um instante (ms)
  function isoDate(ts) { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  // meia-noite local de 'AAAA-MM-DD'
  function parseDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); }
  function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }
  function startOfWeek(ts, weekStart = 1) { const d = new Date(startOfDay(ts)); const diff = (d.getDay() - weekStart + 7) % 7; return addDays(d.getTime(), -diff); }
  function startOfMonth(ts) { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
  function addMonths(ts, n) { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime(); }
  function daysBetween(isoA, isoB) { return Math.round((parseDate(isoB) - parseDate(isoA)) / DAY); }
  // combina 'AAAA-MM-DD' + 'HH:MM' em ms
  function at(iso, hhmm = '00:00') { const [h, m] = hhmm.split(':').map(Number); const t = new Date(parseDate(iso)); t.setHours(h, m, 0, 0); return t.getTime(); }
  function range(kind, now, weekStart = 1) {
    if (kind === 'day') { const a = startOfDay(now); return [a, addDays(a, 1)]; }
    if (kind === 'week') { const a = startOfWeek(now, weekStart); return [a, addDays(a, 7)]; }
    const a = startOfMonth(now); return [a, addMonths(a, 1)];
  }

  // ---------- intervalos [início, fim) em ms ----------
  function clip(iv, from, to) { const a = Math.max(iv[0], from), b = Math.min(iv[1], to); return b > a ? [a, b] : null; }
  function subtract(ivs, cuts) {
    let out = ivs.slice();
    for (const c of cuts) {
      const next = [];
      for (const [a, b] of out) {
        if (c[1] <= a || c[0] >= b) { next.push([a, b]); continue; }
        if (c[0] > a) next.push([a, c[0]]);
        if (c[1] < b) next.push([c[1], b]);
      }
      out = next;
    }
    return out;
  }
  const total = ivs => ivs.reduce((s, [a, b]) => s + (b - a), 0);
  function clipAll(ivs, from, to) { return ivs.map(iv => clip(iv, from, to)).filter(Boolean); }
  // divide intervalos na meia-noite: { 'AAAA-MM-DD': ms }
  function byDay(ivs) {
    const out = {};
    for (let [a, b] of ivs) {
      while (a < b) {
        const end = Math.min(b, addDays(startOfDay(a), 1));
        const k = isoDate(a); out[k] = (out[k] || 0) + (end - a); a = end;
      }
    }
    return out;
  }

  // intervalo de um registro com início/fim (fim aberto = agora)
  const span = (r, now) => [r.start, r.end ?? now];
  // tempo de uma sessão sem as pausas da própria sessão
  function sessionIntervals(s, now) {
    const own = (s.pauses || []).map(p => [p.start, p.end ?? now]);
    return subtract([span(s, now)], own);
  }
  function breakIntervals(breaks, now) { return breaks.map(b => span(b, now)); }
  // tempo efetivamente trabalhado de uma sessão: sem pausas da sessão e sem intervalos registrados
  function workedIntervals(s, breaks, now) { return subtract(sessionIntervals(s, now), breakIntervals(breaks, now)); }

  // ---------- resumo de tempo num período ----------
  function timeSummary(st, from, to, now) {
    const sum = { workdayMs: 0, workedMs: 0, breakMs: 0, projectMs: 0, unclassifiedMs: 0, byProject: {}, byTask: {}, byCategory: {}, byDay: {}, breakByDay: {}, byHour: Array(24).fill(0) };
    const projects = indexBy(st.projects);
    for (const w of st.workdays) { const iv = clip(span(w, now), from, to); if (iv) sum.workdayMs += iv[1] - iv[0]; }
    const brIvs = clipAll(breakIntervals(st.breaks, now), from, to);
    sum.breakMs = total(brIvs); sum.breakByDay = byDay(brIvs);
    for (const s of st.sessions) {
      const ivs = clipAll(workedIntervals(s, st.breaks, now), from, to);
      const ms = total(ivs); if (!ms) continue;
      sum.workedMs += ms;
      for (const [k, v] of Object.entries(byDay(ivs))) sum.byDay[k] = (sum.byDay[k] || 0) + v;
      for (const iv of ivs) addByHour(sum.byHour, iv);
      if (s.taskId) sum.byTask[s.taskId] = (sum.byTask[s.taskId] || 0) + ms;
      const p = s.projectId && projects[s.projectId];
      if (p) {
        sum.projectMs += ms; sum.byProject[p.id] = (sum.byProject[p.id] || 0) + ms;
        const c = p.category || 'Sem categoria'; sum.byCategory[c] = (sum.byCategory[c] || 0) + ms;
      } else sum.unclassifiedMs += ms;
    }
    return sum;
  }
  // saldo da jornada (banco de horas pessoal): por dia com expediente registrado,
  // expediente − pausas − jornada prevista para aquele dia (0 em dia que não é de trabalho = hora extra)
  function jornadaSaldo(st, from, to, now) {
    const wd = byDay(clipAll(st.workdays.map(w => span(w, now)), from, to));
    const br = byDay(clipAll(breakIntervals(st.breaks, now), from, to));
    const daily = workHoursPerDay(st.settings) * HOUR, days = {};
    let total = 0;
    for (const [d, ms] of Object.entries(wd)) {
      const net = ms - (br[d] || 0), plan = st.settings.workDays.includes(new Date(parseDate(d)).getDay()) ? daily : 0;
      days[d] = { workday: ms, net, plan, saldo: net - plan }; total += net - plan;
    }
    return { days, total };
  }
  function addByHour(arr, [a, b]) {
    while (a < b) { const d = new Date(a); const end = Math.min(b, new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime()); arr[d.getHours()] += end - a; a = end; }
  }
  // tempo trabalhado total (sem recorte) numa tarefa / demanda
  function spentMs(st, key, id, now) {
    return st.sessions.filter(s => s[key] === id).reduce((t, s) => t + total(workedIntervals(s, st.breaks, now)), 0);
  }
  // tempo trabalhado desde a última pausa (ou desde o início da sessão contínua)
  function sinceLastBreak(st, now) {
    const lastBreakEnd = Math.max(0, ...st.breaks.filter(b => b.end).map(b => b.end));
    const ivs = st.sessions.flatMap(s => workedIntervals(s, st.breaks, now)).map(iv => clip(iv, Math.max(lastBreakEnd, startOfDay(now)), now)).filter(Boolean);
    return total(ivs);
  }

  // ---------- demandas e tarefas ----------
  const indexBy = (arr, k = 'id') => Object.fromEntries(arr.map(x => [x[k], x]));
  function statusKind(settings, id) { const s = settings.projectStatuses.find(x => x.id === id); return s ? s.kind : 'open'; }
  const isClosed = (settings, p) => ['done', 'cancelled'].includes(statusKind(settings, p.status));
  function projectOverdue(settings, p, today) { return !isClosed(settings, p) && !!p.due && p.due < today; }
  function taskOverdue(t, today) { return t.status !== 'done' && !!t.due && t.due < today; }
  function projectProgress(settings, p, tasks) {
    const own = tasks.filter(t => t.projectId === p.id);
    if (own.length) return own.filter(t => t.status === 'done').length / own.length;
    return statusKind(settings, p.status) === 'done' ? 1 : 0;
  }
  const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

  // ---------- metas ----------
  const GOAL_METRICS = {
    hours_week: { label: 'Horas trabalhadas na semana', period: 'week', unit: 'h' },
    hours_month: { label: 'Horas trabalhadas no mês', period: 'month', unit: 'h' },
    projects_month: { label: 'Demandas concluídas no mês', period: 'month', unit: '' },
    tasks_week: { label: 'Tarefas concluídas na semana', period: 'week', unit: '' },
    priority_tasks_week: { label: 'Tarefas altas/urgentes concluídas na semana', period: 'week', unit: '' },
    breaks_week: { label: 'Pausas registradas na semana', period: 'week', unit: '' },
    within_estimate_week: { label: 'Tarefas concluídas dentro do tempo estimado na semana', period: 'week', unit: '' },
    custom: { label: 'Personalizada (valor manual)', period: 'month', unit: '' },
  };
  function goalValue(goal, st, from, to, now) {
    const inRange = ts => ts && ts >= from && ts < to;
    switch (goal.metric) {
      case 'hours_week': case 'hours_month': return timeSummary(st, from, to, now).workedMs / HOUR;
      case 'projects_month': return st.projects.filter(p => statusKind(st.settings, p.status) === 'done' && inRange(p.completedAt)).length;
      case 'tasks_week': return st.tasks.filter(t => t.status === 'done' && inRange(t.completedAt)).length;
      case 'priority_tasks_week': return st.tasks.filter(t => t.status === 'done' && inRange(t.completedAt) && PRIORITY_RANK[t.priority] <= 1).length;
      case 'breaks_week': return st.breaks.filter(b => inRange(b.start)).length;
      case 'within_estimate_week': return st.tasks.filter(t => t.status === 'done' && inRange(t.completedAt) && t.estimateH > 0 && spentMs(st, 'taskId', t.id, now) <= t.estimateH * HOUR).length;
      default: return Number(goal.manualValue) || 0;
    }
  }
  function goalProgress(goal, st, now, periodsBack = 0) {
    const kind = (GOAL_METRICS[goal.metric] || GOAL_METRICS.custom).period;
    let base = now;
    for (let i = 0; i < periodsBack; i++) base = kind === 'week' ? addDays(range('week', base, st.settings.weekStart)[0], -1) : addMonths(startOfMonth(base), -1);
    const [from, to] = range(kind, base, st.settings.weekStart);
    const value = goalValue(goal, st, from, to, now);
    return { from, to, value, ratio: goal.target > 0 ? value / goal.target : 0, elapsed: Math.min(1, Math.max(0, (now - from) / (to - from))) };
  }

  // ---------- relatórios ----------
  function report(st, f, now) {
    const projects = st.projects.filter(p => (!f.projectId || p.id === f.projectId) && (!f.clientId || p.clientId === f.clientId) && (!f.category || p.category === f.category));
    const pIds = new Set(projects.map(p => p.id));
    const filtered = !!(f.projectId || f.clientId || f.category);
    const sessions = st.sessions.filter(s => !filtered || pIds.has(s.projectId));
    const tasks = st.tasks.filter(t => !filtered || pIds.has(t.projectId));
    const sum = timeSummary({ ...st, sessions }, f.from, f.to, now);
    // pausas e expediente não pertencem a demanda: só entram no relatório sem filtro de demanda
    if (filtered) { sum.workdayMs = null; sum.breakMs = null; }
    const inRange = ts => ts >= f.from && ts < f.to;
    const doneTasks = tasks.filter(t => t.status === 'done' && t.completedAt && inRange(t.completedAt));
    const doneProjects = projects.filter(p => statusKind(st.settings, p.status) === 'done' && p.completedAt && inRange(p.completedAt));
    const onTime = doneProjects.filter(p => !p.due || isoDate(p.completedAt) <= p.due).length;
    const today = isoDate(now);
    const late = projects.filter(p => projectOverdue(st.settings, p, today));
    const execDays = doneTasks.filter(t => t.created).map(t => (t.completedAt - t.created) / DAY);
    const estimate = tasks.filter(t => t.estimateH > 0).map(t => ({ t, est: t.estimateH * HOUR, real: spentMs(st, 'taskId', t.id, now) })).filter(x => x.real > 0);
    const projEstimate = projects.filter(p => p.estimateH > 0).map(p => ({ p, est: p.estimateH * HOUR, real: spentMs(st, 'projectId', p.id, now) }));
    const workedTaskMs = doneTasks.map(t => spentMs(st, 'taskId', t.id, now)).filter(Boolean);
    return {
      sum, doneTasks, doneProjects, onTime, lateDone: doneProjects.length - onTime, late,
      avgExecDays: execDays.length ? execDays.reduce((a, b) => a + b, 0) / execDays.length : null,
      avgTaskWorkedMs: workedTaskMs.length ? workedTaskMs.reduce((a, b) => a + b, 0) / workedTaskMs.length : null,
      estimate, projEstimate,
      overBudget: projEstimate.filter(x => x.real > x.est).sort((a, b) => (b.real / b.est) - (a.real / a.est)),
    };
  }

  // ---------- insights baseados em regras ----------
  function insights(st, now) {
    const out = [], lack = [];
    const s = st.settings, today = isoDate(now);
    const dailyH = workHoursPerDay(s);
    const openTasks = st.tasks.filter(t => t.status !== 'done');
    const activeProjects = st.projects.filter(p => !isClosed(s, p));
    const add = (level, area, title, detail, rule) => out.push({ level, area, title, detail, rule });

    // 1. dias sobrecarregados (14 dias)
    const perDay = {};
    for (const t of openTasks) { const d = t.date || t.due; if (d && d >= today && daysBetween(today, d) < 14) (perDay[d] ||= []).push(t); }
    for (const [d, ts] of Object.entries(perDay).sort()) {
      const est = ts.reduce((a, t) => a + (Number(t.estimateH) || 0), 0);
      if (ts.length > s.maxTasksPerDay || est > dailyH) add('warn', 'Carga', `Dia cheio em ${d}`, `${ts.length} tarefas programadas ou com prazo, somando ${f1(est)} h estimadas para uma jornada de ${f1(dailyH)} h.`, `Mais de ${s.maxTasksPerDay} tarefas no dia ou horas estimadas acima da jornada configurada.`);
    }
    if (!openTasks.some(t => t.date || t.due)) lack.push('Dias sobrecarregados: nenhuma tarefa aberta tem data ou prazo.');

    // 2 e 3. prazos próximos e atrasos
    for (const p of activeProjects) {
      if (!p.due) continue;
      const d = daysBetween(today, p.due);
      if (d < 0) add('bad', 'Prazos', `“${p.name}” está atrasada`, `Prazo era ${p.due} (${-d} dia(s) atrás). Progresso: ${Math.round(projectProgress(s, p, st.tasks) * 100)}%.`, 'Demanda não concluída com prazo anterior a hoje.');
      else if (d <= 3) add('warn', 'Prazos', `“${p.name}” vence em ${d === 0 ? 'hoje' : d + ' dia(s)'}`, `Progresso: ${Math.round(projectProgress(s, p, st.tasks) * 100)}%; ${st.tasks.filter(t => t.projectId === p.id && t.status !== 'done').length} tarefa(s) aberta(s).`, 'Demanda ativa com prazo nos próximos 3 dias.');
    }
    const lateTasks = openTasks.filter(t => taskOverdue(t, today));
    if (lateTasks.length) add('bad', 'Prazos', `${lateTasks.length} tarefa(s) atrasada(s)`, lateTasks.slice(0, 5).map(t => t.title).join(' · '), 'Tarefa aberta com prazo anterior a hoje.');

    // 4. estimativas ultrapassadas
    const est = st.tasks.filter(t => t.status === 'done' && t.estimateH > 0).map(t => ({ t, r: spentMs(st, 'taskId', t.id, now) / (t.estimateH * HOUR) })).filter(x => x.r > 0);
    if (est.length >= 5) {
      const over = est.filter(x => x.r > 1.2);
      const avg = est.reduce((a, x) => a + x.r, 0) / est.length;
      if (over.length / est.length >= 0.4) add('warn', 'Estimativas', `${over.length} de ${est.length} tarefas passaram mais de 20% do estimado`, `Em média, o tempo real foi ${Math.round(avg * 100)}% do estimado. Considere multiplicar novas estimativas por ${f1(avg)}.`, 'Tarefas concluídas com estimativa e tempo registrado; alerta quando 40% ou mais passam 20% do previsto.');
      else add('good', 'Estimativas', 'Estimativas consistentes', `Tempo real médio: ${Math.round(avg * 100)}% do estimado em ${est.length} tarefas.`, 'Menos de 40% das tarefas passaram 20% do previsto.');
    } else lack.push(`Estimativas: são precisas ao menos 5 tarefas concluídas com estimativa e tempo registrado (há ${est.length}).`);

    // 5. prioridades
    const urgent = openTasks.filter(t => t.priority === 'urgent');
    if (urgent.length > 3) add('warn', 'Prioridades', `${urgent.length} tarefas urgentes ao mesmo tempo`, 'Quando quase tudo é urgente, nada se destaca. Reveja quais podem ir para “alta”.', 'Mais de 3 tarefas abertas com prioridade urgente.');
    const highNoDue = openTasks.filter(t => PRIORITY_RANK[t.priority] <= 1 && !t.due);
    if (highNoDue.length) add('info', 'Prioridades', `${highNoDue.length} tarefa(s) alta/urgente sem prazo`, highNoDue.slice(0, 5).map(t => t.title).join(' · '), 'Tarefa aberta de prioridade alta ou urgente sem prazo definido.');

    // 6. tarefas recorrentes
    const norm = t => t.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[0-9#]+/g, '').replace(/\s+/g, ' ').trim();
    const groups = {};
    for (const t of st.tasks) { const k = norm(t); if (k.length > 3) (groups[k] ||= []).push(t); }
    const rec = Object.values(groups).filter(g => g.length >= 3);
    for (const g of rec.slice(0, 3)) add('info', 'Rotina', `“${g[0].title}” aparece ${g.length} vezes`, 'Tarefa repetida: vale padronizar com uma checklist fixa ou duplicar a partir de uma tarefa modelo.', 'Três ou mais tarefas com o mesmo título (ignorando números e acentos).');
    if (st.tasks.length < 6) lack.push('Tarefas recorrentes: poucas tarefas cadastradas para comparar títulos.');

    // 7. categorias que mais consomem tempo (30 dias)
    const sum30 = timeSummary(st, addDays(startOfDay(now), -30), now, now);
    if (sum30.projectMs >= 5 * HOUR) {
      const cats = Object.entries(sum30.byCategory).sort((a, b) => b[1] - a[1]);
      add('info', 'Tempo', `“${cats[0][0]}” concentrou ${Math.round(cats[0][1] / sum30.projectMs * 100)}% do tempo em demandas`, cats.slice(0, 4).map(([c, ms]) => `${c}: ${f1(ms / HOUR)} h`).join(' · '), 'Horas registradas em demandas nos últimos 30 dias, por categoria.');
    } else lack.push('Categorias: são precisas ao menos 5 h registradas em demandas nos últimos 30 dias.');

    // 8. metas
    for (const g of st.goals) {
      if (g.metric === 'custom') continue;
      const pr = goalProgress(g, st, now);
      if (pr.elapsed > 0.5 && pr.ratio < pr.elapsed - 0.2) add('warn', 'Metas', `Meta “${g.title}” abaixo do ritmo`, `${f1(pr.value)} de ${g.target} com ${Math.round(pr.elapsed * 100)}% do período decorrido.`, 'Progresso mais de 20 pontos abaixo da fração do período já passada.');
      else if (pr.ratio >= 1) add('good', 'Metas', `Meta “${g.title}” atingida`, `${f1(pr.value)} de ${g.target}.`, 'Valor do período igual ou acima do alvo.');
    }
    if (!st.goals.length) lack.push('Metas: nenhuma meta cadastrada.');

    // 9. distribuição da carga (4 semanas)
    const cap = weeklyCapacityH(s);
    const ws = startOfWeek(now, s.weekStart);
    let hasEst = false;
    for (let i = 0; i < 4; i++) {
      const a = isoDate(addDays(ws, 7 * i)), b = isoDate(addDays(ws, 7 * i + 7));
      const due = openTasks.filter(t => { const d = t.date || t.due; return d && d >= a && d < b; });
      const h = due.reduce((x, t) => x + (Number(t.estimateH) || 0), 0);
      if (h) hasEst = true;
      if (h > cap) add('warn', 'Carga', `Semana de ${a} acima da capacidade`, `${f1(h)} h estimadas para ${f1(cap)} h de jornada semanal configurada.`, 'Soma das estimativas das tarefas da semana maior que a jornada semanal.');
    }
    if (!hasEst) lack.push('Carga semanal: nenhuma tarefa aberta das próximas 4 semanas tem tempo estimado.');

    // 10. aguardando aprovação há muito tempo
    for (const r of st.revisions.filter(r => r.status === 'waiting' && r.sentAt)) {
      const d = daysBetween(r.sentAt, today);
      if (d >= s.staleDays) { const p = st.projects.find(x => x.id === r.projectId); add('warn', 'Aprovações', `Versão ${r.version} de “${p ? p.name : 'demanda'}” aguarda retorno há ${d} dias`, 'Considere enviar um lembrete ao solicitante.', `Revisão em “aguardando feedback” há ${s.staleDays} dias ou mais.`); }
    }
    for (const p of activeProjects.filter(p => statusKind(s, p.status) === 'waiting')) {
      const since = p.statusSince ? daysBetween(isoDate(p.statusSince), today) : 0;
      if (since >= s.staleDays) add('warn', 'Aprovações', `“${p.name}” aguarda aprovação há ${since} dias`, 'Demanda parada esperando o solicitante.', `Demanda em status de espera há ${s.staleDays} dias ou mais.`);
    }

    // 11. horários com mais horas registradas
    const distinctDays = Object.keys(sum30.byDay).length;
    if (sum30.workedMs >= 20 * HOUR && distinctDays >= 5) {
      let best = 0, bestH = 0;
      for (let h = 0; h < 22; h++) { const v = sum30.byHour[h] + sum30.byHour[h + 1] + sum30.byHour[h + 2]; if (v > best) { best = v; bestH = h; } }
      add('info', 'Rotina', `Você registra mais horas entre ${pad(bestH)}h e ${pad(bestH + 3)}h`, `${Math.round(best / sum30.workedMs * 100)}% das horas dos últimos 30 dias. Isto mede horas registradas, não qualidade: use como pista para agendar trabalho de concentração.`, 'Janela de 3 horas com mais tempo registrado (mínimo 20 h em 5 dias).');
    } else lack.push(`Horários: são precisas ao menos 20 h registradas em 5 dias diferentes nos últimos 30 dias (há ${f1(sum30.workedMs / HOUR)} h em ${distinctDays} dia(s)).`);

    // 12. pausas regulares
    if (distinctDays >= 3 && sum30.workedMs > 0) {
      const breaksCount = st.breaks.filter(b => b.start >= addDays(startOfDay(now), -30)).length;
      const avgStretch = sum30.workedMs / Math.max(1, breaksCount + distinctDays);
      if (avgStretch > s.breakReminderMin * MIN * 1.5) add('info', 'Pausas', 'Blocos de trabalho longos sem pausa', `Em média ${f1(avgStretch / HOUR)} h de trabalho entre pausas, acima do lembrete configurado de ${s.breakReminderMin} min.`, 'Horas registradas divididas pelo número de pausas mais dias trabalhados (30 dias).');
    }
    return { items: out, lack };
  }
  function workHoursPerDay(s) { const [a, b] = [s.workStart, s.workEnd].map(x => { const [h, m] = x.split(':').map(Number); return h + m / 60; }); return Math.max(0, b - a - (s.lunchMin || 0) / 60); }
  function weeklyCapacityH(s) { return workHoursPerDay(s) * s.workDays.length; }
  const round1 = n => Math.round(n * 10) / 10;
  const f1 = n => String(round1(n)).replace('.', ','); // para exibir (vírgula decimal)

  // ---------- validação ----------
  const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(parseDate(v));
  const isTime = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  const isUrl = v => { try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol); } catch { return false; } };
  const isHex = v => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
  // imagem guardada pela própria Prancheta (reduzida no navegador); nunca um endereço externo
  const isImageData = v => /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v);
  const RULES = {
    projects: { required: ['name'], dates: ['start', 'due'], nums: ['estimateH', 'value'], order: [['start', 'due', 'O prazo não pode ser antes do início.']] },
    tasks: { required: ['title'], dates: ['date', 'due'], times: ['time'], nums: ['estimateH'], order: [['date', 'due', 'O prazo não pode ser antes da data de início.']] },
    clients: { required: ['name'], nums: ['agreedValue'] },
    events: { required: ['title', 'date'], dates: ['date'], times: ['time', 'endTime'] },
    revisions: { required: ['projectId', 'version'], dates: ['sentAt', 'nextDue'] },
    refs: { required: ['name'], urls: ['url'] },
    notes: { required: ['title'] },
    goals: { required: ['title', 'metric', 'target'], nums: ['target'] },
    sessions: { required: ['start'] },
    breaks: { required: ['start'] },
    workdays: { required: ['start'] },
    activity: { required: ['at'] },
  };
  function validate(type, r) {
    const rule = RULES[type] || {}, e = {};
    for (const k of rule.required || []) if (r[k] === undefined || r[k] === null || String(r[k]).trim() === '') e[k] = 'Campo obrigatório.';
    for (const k of rule.dates || []) if (r[k] && !isDate(r[k])) e[k] = 'Data inválida.';
    for (const k of rule.times || []) if (r[k] && !isTime(r[k])) e[k] = 'Horário inválido (use HH:MM).';
    for (const k of rule.nums || []) if (r[k] !== undefined && r[k] !== '' && r[k] !== null && (isNaN(Number(r[k])) || Number(r[k]) < 0)) e[k] = 'Informe um número igual ou maior que zero.';
    for (const k of rule.urls || []) if (r[k] && !isUrl(r[k])) e[k] = 'Use um endereço completo começando com https://';
    for (const [a, b, msg] of rule.order || []) if (r[a] && r[b] && r[b] < r[a]) e[b] = msg;
    if (['sessions', 'breaks', 'workdays'].includes(type) && r.end != null && r.end < r.start) e.end = 'O fim não pode ser antes do início.';
    if (type === 'projects' && (r.links || []).some(l => !isUrl(l))) e.links = 'Use só links completos começando com https://';
    if (type === 'refs' && (r.palette || []).some(c => !isHex(c))) e.palette = 'Use cores em hexadecimal, como #1a1a1a.';
    if (type === 'refs' && r.image && !isImageData(r.image)) e.image = 'Imagem inválida.';
    if (type === 'events' && r.time && r.endTime && r.endTime < r.time) e.endTime = 'O término não pode ser antes do início.';
    return e;
  }

  // ---------- backup ----------
  const STORES = ['projects', 'tasks', 'clients', 'sessions', 'breaks', 'workdays', 'events', 'revisions', 'refs', 'notes', 'goals', 'activity'];
  function validateBackup(obj) {
    const errors = [];
    if (!obj || typeof obj !== 'object' || obj.app !== 'prancheta') return { ok: false, errors: ['O arquivo não é um backup da Prancheta.'] };
    if (typeof obj.version !== 'number' || obj.version > 1) errors.push('Versão de backup não suportada.');
    const data = obj.data || {}, counts = {};
    for (const s of STORES) {
      const arr = data[s] ?? [];
      if (!Array.isArray(arr)) { errors.push(`“${s}” deveria ser uma lista.`); continue; }
      const seen = new Set();
      arr.forEach((r, i) => {
        if (!r || typeof r.id !== 'string' || !r.id) { errors.push(`${s} #${i + 1}: registro sem identificador.`); return; }
        if (seen.has(r.id)) errors.push(`${s}: identificador repetido ${r.id}.`);
        seen.add(r.id);
        const e = validate(s, r);
        if (Object.keys(e).length) errors.push(`${s} #${i + 1}: ${Object.entries(e).map(([k, v]) => k + ' – ' + v).join('; ')}`);
      });
      counts[s] = arr.length;
    }
    if (data.settings != null && typeof data.settings !== 'object') errors.push('Configurações inválidas.');
    return { ok: !errors.length, errors: errors.slice(0, 20), counts };
  }
  // mescla por id, sem duplicar: fica a versão com 'updated' mais recente
  function mergeRecords(current, incoming) {
    const map = new Map(current.map(r => [r.id, r]));
    let added = 0, updated = 0;
    for (const r of incoming) {
      const cur = map.get(r.id);
      if (!cur) { map.set(r.id, r); added++; }
      else if ((r.updated || 0) > (cur.updated || 0)) { map.set(r.id, r); updated++; }
    }
    return { records: [...map.values()], added, updated };
  }

  // ---------- escrita rápida: prazo, horário e prioridade no próprio texto ----------
  // "Entregar banner até sexta 14h !urgente" → título "Entregar banner", prazo na próxima sexta, 14:00, urgente
  const WEEK = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
  const PRIO = { urgente: 'urgent', alta: 'high', media: 'medium', baixa: 'low' };
  const fold = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function parseQuick(text, now) {
    const out = {}, today = startOfDay(now), cut = [];
    // cada achado marca o trecho a remover, levando junto uma preposição logo antes ("até sexta", "às 14h")
    const prep = String.raw`(?:(?:ate|para|pra|na|no|dia|as|a partir de)\s+)?`;
    const find = (re, fn) => { const f = fold(text); const m = f.match(re); if (!m) return; if (fn(m) !== false) cut.push([m.index, m.index + m[0].length]); };
    find(/(^|\s)!(urgente|alta|media|baixa)\b/, m => { out.priority = PRIO[m[2]]; });
    find(new RegExp(String.raw`(^|\s)${prep}(\d{1,2})[:h](\d{2})?(?=\s|$)`), m => { const hh = +m[2], mm = +(m[3] || 0); if (hh > 23 || mm > 59) return false; out.time = pad(hh) + ':' + pad(mm); });
    find(new RegExp(String.raw`(^|\s)${prep}(depois de amanha|hoje|amanha)(?=\s|$)`), m => { out.due = isoDate(addDays(today, { hoje: 0, amanha: 1, 'depois de amanha': 2 }[m[2]])); });
    if (!out.due) find(new RegExp(String.raw`(^|\s)${prep}(domingo|segunda|terca|quarta|quinta|sexta|sabado)(-feira)?(?=\s|$)`), m => { const diff = (WEEK[m[2]] - new Date(today).getDay() + 7) % 7; out.due = isoDate(addDays(today, diff)); });
    if (!out.due) find(new RegExp(String.raw`(^|\s)${prep}(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?=\s|$)`), m => {
      const d = +m[2], mo = +m[3], y0 = m[4] ? (m[4].length === 2 ? 2000 + +m[4] : +m[4]) : new Date(today).getFullYear();
      let dt = new Date(y0, mo - 1, d);
      if (dt.getDate() !== d || dt.getMonth() !== mo - 1) return false;          // 31/02 não é data
      if (!m[4] && dt.getTime() < today) dt = new Date(y0 + 1, mo - 1, d);       // 05/01 em dezembro = ano que vem
      out.due = isoDate(dt.getTime());
    });
    if (out.time && !out.due) out.due = isoDate(today);
    // remove os trechos achados (do fim para o começo, para os índices não mudarem)
    let title = text;
    for (const [a, b] of cut.sort((x, y) => y[0] - x[0])) title = title.slice(0, a) + ' ' + title.slice(b);
    out.title = title.replace(/\s+/g, ' ').trim();
    return out;
  }

  // ---------- música (player oficial do Spotify) ----------
  // aceita link do open.spotify.com (com ou sem /intl-xx/) ou URI spotify:tipo:id
  const SPOTIFY_TYPES = ['playlist', 'album', 'track', 'artist', 'show', 'episode'];
  function spotifyEmbed(input) {
    const s = String(input || '').trim();
    let m = s.match(/^spotify:([a-z]+):([A-Za-z0-9]{10,40})$/);
    if (!m) { try { const u = new URL(s); if (u.hostname === 'open.spotify.com') m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?([a-z]+)\/([A-Za-z0-9]{10,40})\/?$/); } catch { /* não é link */ } }
    if (!m || !SPOTIFY_TYPES.includes(m[1])) return null;
    return { type: m[1], id: m[2], url: `https://open.spotify.com/${m[1]}/${m[2]}`, embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=prancheta&theme=0` };
  }

  const DEFAULT_SETTINGS = {
    name: '', workStart: '09:00', workEnd: '18:00', lunchMin: 60, workDays: [1, 2, 3, 4, 5], weekStart: 1,
    dateFormat: 'dd/mm/aaaa', breakReminderMin: 50, notify: false, maxTasksPerDay: 5, staleDays: 5, accent: '#4f8bff', autoLockMin: 10,
    calendarView: 'week', music: { current: '', saved: [] }, dashboard: { charts: true, activity: true, goals: true, deadlines: true },
    breakTypes: [{ id: 'short', name: 'Pausa curta', min: 10 }, { id: 'long', name: 'Pausa longa', min: 20 }, { id: 'lunch', name: 'Almoço', min: 60 }],
    categories: ['Criação de logotipo', 'Identidade visual', 'Branding', 'Posts para redes sociais', 'Banners e anúncios', 'Flyers e panfletos', 'Cartazes', 'Apresentações', 'Materiais impressos', 'Embalagens', 'Edição e tratamento de imagens', 'Peças publicitárias', 'Outros'],
    projectStatuses: [
      { id: 'planning', name: 'Planejamento', kind: 'open' }, { id: 'waiting_start', name: 'Aguardando início', kind: 'open' },
      { id: 'doing', name: 'Em andamento', kind: 'active' }, { id: 'approval', name: 'Aguardando aprovação', kind: 'waiting' },
      { id: 'review', name: 'Em revisão', kind: 'active' }, { id: 'done', name: 'Concluída', kind: 'done' }, { id: 'cancelled', name: 'Cancelada', kind: 'cancelled' }],
    refCategories: ['Branding', 'Tipografia', 'Composição', 'Cores', 'Campanhas', 'Layouts', 'Geral'],
    noteKinds: ['Ideia', 'Briefing', 'Instrução', 'Feedback', 'Decisão criativa', 'Pendência', 'Importante'],
  };

  const Model = {
    DAY, HOUR, MIN, uid, pad, isoDate, parseDate, startOfDay, addDays, startOfWeek, startOfMonth, addMonths, daysBetween, at, range,
    clip, subtract, total, byDay, sessionIntervals, workedIntervals, timeSummary, jornadaSaldo, spentMs, sinceLastBreak,
    indexBy, statusKind, isClosed, projectOverdue, taskOverdue, projectProgress, PRIORITY_RANK,
    GOAL_METRICS, goalProgress, report, insights, workHoursPerDay, weeklyCapacityH, round1, f1,
    parseQuick, spotifyEmbed, validate, isUrl, isHex, isImageData, STORES, validateBackup, mergeRecords, DEFAULT_SETTINGS,
  };
  root.Model = Model;
  if (typeof module !== 'undefined') module.exports = Model;
})(typeof window !== 'undefined' ? window : globalThis);
