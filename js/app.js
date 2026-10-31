// Casca da aplicação: rotas, barra superior, formulários de cada cadastro,
// ações de tempo (expediente, sessões, pausas), busca global, lembretes,
// atalhos de teclado e dados de demonstração.
(function () {
  'use strict';
  const M = window.Model, U = window.UI, St = window.Store, S = St.S;
  const { h, icon } = U;
  const Views = window.Views = window.Views || {};
  const App = window.App = { vs: {} };
  const now = () => Date.now();
  const today = () => M.isoDate(now());

  // ---------- opções compartilhadas pelos formulários ----------
  const opt = {
    projects: () => S.projects.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => [p.id, p.name]),
    openProjects: () => S.projects.filter(p => !M.isClosed(S.settings, p)).sort((a, b) => a.name.localeCompare(b.name)).map(p => [p.id, p.name]),
    clients: () => S.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.id, c.name]),
    tasks: () => S.tasks.filter(t => t.status !== 'done').sort((a, b) => a.title.localeCompare(b.title)).map(t => [t.id, t.title]),
    categories: () => S.settings.categories.map(c => [c, c]),
    pstatus: () => S.settings.projectStatuses.map(s => [s.id, s.name]),
    tools: () => (S.settings.tools || []).map(t => [t, t]),
    lcats: () => (S.settings.learningCategories || []).map(t => [t, t]),
    courses: () => S.courses.filter(c => !c.archived).sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.id, c.name]),
    openCourses: () => S.courses.filter(c => !c.archived && c.status !== 'done').sort((a, b) => a.name.localeCompare(b.name)).map(c => [c.id, c.name]),
    exercises: () => S.exercises.filter(x => !x.archived).sort((a, b) => a.title.localeCompare(b.title)).map(x => [x.id, x.title]),
    resources: () => S.resources.filter(r => !r.archived).sort((a, b) => a.title.localeCompare(b.title)).map(r => [r.id, r.title]),
  };
  App.opt = opt;
  const urlCheck = k => v => { const bad = (v[k] || []).filter(x => !M.isUrl(x)); return bad.length ? { [k]: 'Endereço inválido: ' + bad[0] + ' (use https://…)' } : null; };

  const FORMS = {
    projects: {
      title: 'demanda', fields: () => [
        { k: 'name', label: 'Nome da demanda', required: true, full: true },
        { k: 'clientId', label: 'Solicitante', type: 'select', options: opt.clients },
        { k: 'category', label: 'Categoria', type: 'select', options: opt.categories },
        { k: 'status', label: 'Status', type: 'select', options: opt.pstatus, required: true },
        { k: 'priority', label: 'Prioridade', type: 'select', options: U.PRIORITIES, required: true },
        { k: 'start', label: 'Início', type: 'date' }, { k: 'due', label: 'Prazo de entrega', type: 'date' },
        { k: 'estimateH', label: 'Horas estimadas', type: 'number', step: '0.5' },
        { k: 'description', label: 'Descrição', type: 'textarea', full: true },
        { k: 'goal', label: 'Objetivo', type: 'textarea', full: true, rows: 2 },
        { k: 'stages', label: 'Etapas de produção', type: 'checklist', full: true },
        { k: 'links', label: 'Arquivos e links de referência', type: 'lines', full: true, hint: 'Links completos (https://…), um por linha.' },
        { k: 'notes', label: 'Observações', type: 'textarea', full: true },
      ], defaults: () => ({ status: S.settings.projectStatuses[0].id, priority: 'medium', start: today(), stages: [] }),
      check: urlCheck('links'),
      before(rec, old) {
        if (!old || old.status !== rec.status) rec.statusSince = now();
        const done = M.statusKind(S.settings, rec.status) === 'done';
        rec.completedAt = done ? (old && old.completedAt) || now() : null;
      },
    },
    tasks: {
      title: 'tarefa', fields: () => [
        { k: 'title', label: 'Título', required: true, full: true },
        { k: 'projectId', label: 'Demanda', type: 'select', options: opt.projects },
        { k: 'clientId', label: 'Solicitante', type: 'select', options: opt.clients, hint: 'Vazio: usa o solicitante da demanda.' },
        { k: 'courseId', label: 'Curso (tarefa de estudo)', type: 'select', options: opt.courses },
        { k: 'status', label: 'Status', type: 'select', options: U.TASK_STATUSES, required: true },
        { k: 'priority', label: 'Prioridade', type: 'select', options: U.PRIORITIES, required: true },
        { k: 'date', label: 'Início previsto', type: 'date' }, { k: 'time', label: 'Horário programado', type: 'time' },
        { k: 'due', label: 'Prazo final', type: 'date' },
        { k: 'estimateH', label: 'Tempo estimado (h)', type: 'number', step: '0.25' },
        { k: 'reminder', label: 'Lembrete', type: 'datetime-local', hint: 'Avisa enquanto a Prancheta estiver aberta.' },
        { k: 'description', label: 'Descrição', type: 'textarea', full: true },
        { k: 'checklist', label: 'Subtarefas', type: 'checklist', full: true },
        { k: 'notes', label: 'Observações', type: 'textarea', full: true, rows: 2 },
      ], defaults: () => ({ status: 'todo', priority: 'medium', checklist: [] }),
      before(rec, old) {
        if (!rec.clientId && rec.projectId) rec.clientId = (St.get('projects', rec.projectId) || {}).clientId || '';
        rec.completedAt = rec.status === 'done' ? (old && old.completedAt) || now() : null;
        if (!old || old.reminder !== rec.reminder) rec.remindedAt = null;
      },
      after(rec, old) {
        if (!old && (rec.due || rec.date)) U.toast('Tarefa criada. Ela aparece no calendário em ' + U.fmtDate(rec.date || rec.due) + '.', '', 5000, { label: 'Ver no calendário', fn: () => { App.vs.calendar = { ...(App.vs.calendar || {}), cursor: M.parseDate(rec.date || rec.due) }; go('calendario'); } });
      },
    },
    clients: {
      title: 'solicitante', fields: () => [
        { k: 'name', label: 'Setor, área ou pessoa', required: true, full: true, hint: 'Ex.: Marketing, RH, Diretoria comercial.' },
        { k: 'contactName', label: 'Pessoa de contato' }, { k: 'email', label: 'E-mail', type: 'email' },
        { k: 'phone', label: 'Telefone ou ramal', type: 'tel' },
        { k: 'description', label: 'Descrição', type: 'textarea', full: true, rows: 2 },
        { k: 'notes', label: 'Observações', type: 'textarea', full: true },
      ], defaults: () => ({}),
      check: v => v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email) ? { email: 'E-mail inválido.' } : null,
    },
    events: {
      title: 'evento', fields: () => [
        { k: 'title', label: 'Título', required: true, full: true },
        { k: 'type', label: 'Tipo', type: 'select', options: U.EVENT_TYPES, required: true },
        { k: 'date', label: 'Data', type: 'date', required: true },
        { k: 'time', label: 'Início', type: 'time' }, { k: 'endTime', label: 'Término', type: 'time' },
        { k: 'projectId', label: 'Demanda', type: 'select', options: opt.projects },
        { k: 'reminderMin', label: 'Lembrar (minutos antes)', type: 'number' },
        { k: 'notes', label: 'Observações', type: 'textarea', full: true },
      ], defaults: () => ({ type: 'meeting', date: today() }),
      before(rec, old) { if (!old || old.date !== rec.date || old.time !== rec.time || old.reminderMin !== rec.reminderMin) rec.remindedAt = null; },
    },
    revisions: {
      title: 'revisão', fields: () => [
        { k: 'projectId', label: 'Demanda', type: 'select', options: opt.projects, required: true },
        { k: 'version', label: 'Versão do material', required: true, hint: 'Ex.: v2, R3, “versão final”.' },
        { k: 'sentAt', label: 'Data de envio', type: 'date' },
        { k: 'status', label: 'Status', type: 'select', options: U.REVISION_STATUSES, required: true },
        { k: 'nextDue', label: 'Próxima entrega prevista', type: 'date' },
        { k: 'feedback', label: 'Feedback recebido', type: 'textarea', full: true },
        { k: 'changes', label: 'Alterações solicitadas', type: 'textarea', full: true },
        { k: 'notes', label: 'Observações e decisões', type: 'textarea', full: true, rows: 2 },
      ], defaults: () => ({ status: 'waiting', sentAt: today() }),
    },
    refs: {
      title: 'referência', fields: () => [
        { k: 'name', label: 'Nome', required: true, full: true },
        { k: 'category', label: 'Categoria', type: 'select', options: () => S.settings.refCategories.map(c => [c, c]) },
        { k: 'url', label: 'Link externo', type: 'url' },
        { k: 'projectId', label: 'Demanda', type: 'select', options: opt.projects },
        { k: 'tags', label: 'Palavras-chave', type: 'tags' },
        { k: 'palette', label: 'Paleta de cores', type: 'tags', hint: 'Códigos hexadecimais, ex.: #1a1a1a, #f2c14e' },
        { k: 'typography', label: 'Tipografia' },
        { k: 'filePath', label: 'Caminho do arquivo no computador', hint: 'Só anotação: o navegador não abre arquivos do seu disco sozinho.' },
        { k: 'image', label: 'Imagem (opcional)', type: 'image', full: true },
        { k: 'description', label: 'Descrição', type: 'textarea', full: true, rows: 2 },
        { k: 'notes', label: 'Observações', type: 'textarea', full: true, rows: 2 },
      ], defaults: () => ({ category: 'Geral', tags: [], palette: [] }),
      check: v => { const bad = (v.palette || []).filter(c => !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)); return bad.length ? { palette: 'Cor inválida: ' + bad[0] } : null; },
    },
    notes: {
      title: 'anotação', fields: () => [
        { k: 'title', label: 'Título', required: true, full: true },
        { k: 'kind', label: 'Tipo', type: 'select', options: () => S.settings.noteKinds.map(c => [c, c]) },
        { k: 'pinned', label: '', type: 'checkbox', text: 'Fixar no topo' },
        { k: 'body', label: 'Conteúdo', type: 'textarea', full: true, rows: 8 },
        { k: 'tags', label: 'Etiquetas', type: 'tags' },
        { k: 'projectId', label: 'Demanda', type: 'select', options: opt.projects },
        { k: 'clientId', label: 'Solicitante', type: 'select', options: opt.clients },
      ], defaults: () => ({ kind: 'Ideia', tags: [] }),
    },
    goals: {
      title: 'meta', fields: () => [
        { k: 'title', label: 'Nome da meta', required: true, full: true },
        { k: 'metric', label: 'O que medir', type: 'select', required: true, options: () => Object.entries(M.GOAL_METRICS).map(([k, v]) => [k, v.label]) },
        { k: 'target', label: 'Alvo', type: 'number', required: true, step: '0.5' },
        { k: 'manualValue', label: 'Valor atual (só para meta personalizada)', type: 'number', step: '0.5' },
        { k: 'notes', label: 'Observações', type: 'textarea', full: true, rows: 2 },
      ], defaults: () => ({ metric: 'hours_week' }),
    },
    courses: {
      title: 'curso', fields: () => [
        { k: 'name', label: 'Nome do curso', required: true, full: true },
        { k: 'platform', label: 'Plataforma ou instituição' }, { k: 'instructor', label: 'Instrutor' },
        { k: 'tool', label: 'Ferramenta', type: 'select', options: opt.tools }, { k: 'category', label: 'Categoria', type: 'select', options: opt.lcats },
        { k: 'level', label: 'Nível', type: 'select', options: U.LEVELS }, { k: 'priority', label: 'Prioridade', type: 'select', options: U.PRIORITIES, required: true },
        { k: 'status', label: 'Status', type: 'select', options: U.COURSE_STATUSES, required: true },
        { k: 'progress', label: 'Progresso (%)', type: 'number', step: '1', hint: 'Você atualiza: a Prancheta não acessa a plataforma do curso.' },
        { k: 'start', label: 'Início', type: 'date' }, { k: 'due', label: 'Previsão de conclusão', type: 'date' },
        { k: 'totalH', label: 'Carga horária total (h)', type: 'number', step: '0.5' },
        { k: 'extraMin', label: 'Tempo estudado fora do cronômetro (min)', type: 'number', step: '5', hint: 'Somado às sessões de estudo cronometradas.' },
        { k: 'url', label: 'Link do curso', type: 'url', full: true },
        { k: 'nextActivity', label: 'Próxima atividade de estudo', full: true, hint: 'Ex.: “Módulo 4 — máscaras de camada”.' },
        { k: 'description', label: 'Descrição', type: 'textarea', full: true, rows: 2 },
        { k: 'learnings', label: 'Avaliação pessoal e principais aprendizados', type: 'textarea', full: true, rows: 3 },
        { k: 'notes', label: 'Observações', type: 'textarea', full: true, rows: 2 },
      ], defaults: () => ({ status: 'not_started', priority: 'medium', progress: 0 }),
      before(rec, old) {
        rec.progress = rec.progress === '' || rec.progress == null ? 0 : Math.round(Number(rec.progress));
        if (!old || old.progress !== rec.progress || old.nextActivity !== rec.nextActivity) rec.progressAt = now();
        if (rec.status === 'done' && rec.progress < 100 && (!old || old.status !== 'done')) rec.progress = 100;
        rec.completedAt = rec.status === 'done' ? (old && old.completedAt) || now() : null;
        if (rec.status === 'doing' && !rec.start) rec.start = today();
      },
    },
    resources: {
      title: 'material', fields: () => [
        { k: 'title', label: 'Título', required: true, full: true },
        { k: 'type', label: 'Tipo', type: 'select', required: true, options: () => U.RESOURCE_TYPES.map(t => [t, t]) },
        { k: 'status', label: 'Status', type: 'select', required: true, options: U.RESOURCE_STATUSES },
        { k: 'url', label: 'Link', type: 'url', full: true, hint: 'Abre numa aba nova. A Prancheta não confere o conteúdo do link.' },
        { k: 'tool', label: 'Ferramenta (opcional)', type: 'select', options: opt.tools }, { k: 'category', label: 'Categoria', type: 'select', options: opt.lcats },
        { k: 'level', label: 'Nível', type: 'select', options: U.LEVELS },
        { k: 'rating', label: 'Sua avaliação', type: 'select', options: [['5', '★★★★★ Excelente'], ['4', '★★★★ Muito bom'], ['3', '★★★ Bom'], ['2', '★★ Fraco'], ['1', '★ Ruim']] },
        { k: 'tags', label: 'Etiquetas', type: 'tags' },
        { k: 'favorite', type: 'checkbox', text: 'Favorito' },
        { k: 'courseId', label: 'Curso relacionado', type: 'select', options: opt.courses },
        { k: 'exerciseId', label: 'Exercício relacionado', type: 'select', options: opt.exercises },
        { k: 'projectId', label: 'Demanda relacionada', type: 'select', options: opt.projects },
        { k: 'filePath', label: 'Caminho do arquivo no computador', hint: 'Só anotação: o navegador não abre arquivos do seu disco sozinho.' },
        { k: 'description', label: 'Descrição', type: 'textarea', full: true, rows: 2 },
        { k: 'summary', label: 'Resumo e principais aprendizados', type: 'textarea', full: true, rows: 3 },
        { k: 'notes', label: 'Anotações', type: 'textarea', full: true, rows: 2 },
      ], defaults: () => ({ type: 'Tutorial', status: 'new', tags: [] }),
    },
  };
  App.FORMS = FORMS;

  // abre o formulário de criação/edição de qualquer cadastro
  App.edit = function (type, id, defaults = {}) {
    const F = FORMS[type], old = id ? St.get(type, id) : null;
    if (id && !old) return U.toast('Registro não encontrado (pode ter sido excluído).', 'bad');
    U.form({
      title: (old ? 'Editar ' : 'Novo(a) ') + F.title, fields: F.fields(), value: old || { ...F.defaults(), ...defaults }, check: F.check,
      onSave: async vals => {
        const rec = { ...(old || {}), ...vals };
        if (F.before) F.before(rec, old);
        const saved = await St.save(type, rec);
        U.toast(old ? 'Alterações salvas.' : `${St.LABELS[type]} criado(a).`, 'good');
        if (F.after) F.after(saved, old);
      },
      onDelete: old ? () => App.del(type, id) : null,
    });
  };
  const DELETE_TEXT = {
    projects: 'As tarefas, sessões, notas, referências e eventos ligados a ele continuam existindo, sem demanda. As revisões da demanda serão excluídas.',
    clients: 'Demandas, tarefas e notas deste solicitante continuam existindo, sem solicitante.',
    tasks: 'As sessões de tempo desta tarefa continuam registradas, sem tarefa.',
    courses: 'Tarefas, sessões de estudo, materiais e exercícios ligados continuam existindo, sem o curso. Para guardar o histórico, prefira Arquivar.',
    resources: 'Exercícios ligados continuam existindo, sem o material. Para guardar, prefira o status Arquivado.',
    exercises: 'Sessões de prática e materiais ligados continuam existindo, sem o exercício.',
    workflows: 'Fluxos já aplicados às demandas continuam com a cópia das etapas deles. Para só esconder o modelo, prefira Arquivar.',
    runs: 'As marcações deste fluxo serão perdidas. Tarefas criadas a partir das etapas continuam existindo.',
  };
  App.del = async function (type, id) {
    const r = St.get(type, id); if (!r) return false;
    const name = r.name || r.title || r.version || '';
    if (!await U.ask({ title: `Excluir ${(St.LABELS[type] || 'registro').toLowerCase()}?`, text: `${name ? '“' + name + '” será excluído(a). ' : ''}${DELETE_TEXT[type] || ''} Esta ação não pode ser desfeita.`, ok: 'Excluir', danger: true })) return false;
    try { await St.remove(type, id); U.toast('Excluído.', 'good'); if (type === 'projects' && location.hash.startsWith('#demanda/')) go('demandas'); return true; } catch (e) { U.fail(e); return false; }
  };
  App.toggleTask = async function (id) {
    const t = St.get('tasks', id); if (!t) return;
    const done = t.status !== 'done';
    try { await St.save('tasks', { ...t, status: done ? 'done' : 'todo', completedAt: done ? now() : null }, { verb: done ? 'concluída' : 'reaberta' }); } catch (e) { U.fail(e); }
  };
  App.toggleCheck = async function (type, id, key, itemId) {
    const r = St.get(type, id); if (!r) return;
    const list = (r[key] || []).map(c => c.id === itemId ? { ...c, done: !c.done } : c);
    try { await St.save(type, { ...r, [key]: list }, { quiet: true }); } catch (e) { U.fail(e); }
  };

  // ---------- escrita rápida: digitar e apertar Enter, sem formulário ----------
  const QUICK_HINT = { exercises: 'Novo exercício: escreva o desafio e aperte Enter', courses: 'Novo curso: escreva o nome e aperte Enter', resources: 'Novo material: escreva o título ou cole um link e aperte Enter', tasks: 'Nova tarefa: escreva e aperte Enter', projects: 'Nova demanda: escreva e aperte Enter', notes: 'Escreva uma anotação. A primeira linha vira o título.' };
  const PARSES = ['tasks', 'projects']; // só estes entendem prazo e prioridade no texto
  App.quick = (type, extra = {}) => {
    const attrs = h` data-quick="${type}" data-extra='${JSON.stringify(extra)}' placeholder="${QUICK_HINT[type]}" aria-label="${QUICK_HINT[type]}"`;
    return type === 'notes'
      ? h`<form class="quick note-quick"><textarea rows="3"${attrs}></textarea><div class="quick-foot"><span class="small muted"><kbd>${U.keyMod}</kbd>+<kbd>Enter</kbd> salva</span><button class="btn primary small">Salvar anotação</button></div></form>`
      : h`<form class="quick"><span class="quick-plus" aria-hidden="true">${icon('plus')}</span><input autocomplete="off"${attrs}><span class="small muted quick-tip">${PARSES.includes(type) ? 'Enter cria · ex.: “até sexta 14h !urgente”' : 'Enter cria · clique no item para detalhar'}</span></form>`;
  };
  document.addEventListener('submit', async e => {
    const f = e.target.closest('form.quick'); if (!f) return;
    e.preventDefault();
    const el = f.querySelector('[data-quick]'), text = el.value.trim();
    if (!text || f.dataset.busy) return;
    f.dataset.busy = '1';
    const type = el.dataset.quick, F = FORMS[type];
    const rec = { ...F.defaults(), ...JSON.parse(el.dataset.extra || '{}') };
    if (type === 'courses') rec.name = text;
    else if (type === 'exercises') rec.title = text;
    else if (type === 'resources') { if (M.isUrl(text)) { rec.url = text; rec.title = new URL(text).hostname.replace(/^www\./, '') + new URL(text).pathname.replace(/\/$/, ''); } else rec.title = text; }
    else if (type === 'notes') { const [first, ...rest] = text.split('\n'); rec.title = first.trim().slice(0, 120); rec.body = first.trim().length > 120 ? text : rest.join('\n').trim(); }
    else {
      const q = M.parseQuick(text, now());
      rec[type === 'projects' ? 'name' : 'title'] = q.title || text;
      if (q.due) rec.due = q.due;
      if (q.priority) rec.priority = q.priority;
      if (q.time && type === 'tasks') rec.time = q.time;
    }
    if (F.before) F.before(rec, null);
    try { await St.save(type, rec); el.value = ''; } catch (err) { U.fail(err); } finally { delete f.dataset.busy; }
  });
  // prévia do que foi entendido no texto (prazo, horário, prioridade), antes do Enter
  document.addEventListener('input', e => {
    const el = e.target.closest('input[data-quick]'); if (!el || !PARSES.includes(el.dataset.quick)) return;
    const tip = el.parentElement.querySelector('.quick-tip'), q = M.parseQuick(el.value, now());
    const bits = [q.due && 'Prazo: ' + U.WEEKDAYS[new Date(M.parseDate(q.due)).getDay()] + ' ' + U.fmtDate(q.due), q.time && el.dataset.quick === 'tasks' && 'às ' + q.time, q.priority && U.label(U.PRIORITIES, q.priority)].filter(Boolean);
    tip.textContent = bits.length ? bits.join(' · ') : 'Enter cria · ex.: “até sexta 14h !urgente”';
    tip.classList.toggle('parsed', bits.length > 0);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('textarea[data-quick]')) { e.preventDefault(); e.target.form.requestSubmit(); }
  });

  // ---------- tempo: expediente, sessões e pausas ----------
  const active = {
    workday: () => S.workdays.find(w => !w.end),
    session: () => S.sessions.find(s => !s.end),
    brk: () => S.breaks.find(b => !b.end),
  };
  App.active = active;
  App.isPaused = s => !!(s && (s.pauses || []).some(p => !p.end));
  App.startWorkday = async function () {
    await St.reload();
    if (active.workday()) return U.toast('O expediente já está aberto.');
    try { await St.save('workdays', { start: now(), end: null }, { verb: 'iniciado' }); U.toast('Expediente iniciado.', 'good'); } catch (e) { U.fail(e); }
  };
  App.endWorkday = async function () {
    await St.reload();
    const w = active.workday(); if (!w) return;
    const s = active.session(), b = active.brk();
    if ((s || b) && !await U.ask({ title: 'Encerrar o expediente?', text: `Há ${[s && 'uma sessão de trabalho', b && 'uma pausa'].filter(Boolean).join(' e ')} em andamento. Elas também serão encerradas agora.`, ok: 'Encerrar tudo' })) return;
    try {
      const t = now();
      if (b) await St.save('breaks', { ...b, end: t }, { verb: 'encerrada' });
      if (s) await St.save('sessions', closeSession(s, t), { verb: 'encerrada' });
      await St.save('workdays', { ...w, end: t }, { verb: 'encerrado' });
      U.toast('Expediente encerrado.', 'good');
    } catch (e) { U.fail(e); }
  };
  function closeSession(s, t) { return { ...s, end: t, pauses: (s.pauses || []).map(p => p.end ? p : { ...p, end: t }) }; }
  // pergunta demanda/tarefa e inicia uma sessão (só uma ativa por vez)
  App.startSession = async function (pre = {}) {
    await St.reload();
    const cur = active.session();
    if (cur && !await U.ask({ title: 'Já existe uma sessão ativa', text: 'Só uma sessão de trabalho fica ativa por vez. Encerrar a atual e iniciar uma nova?', ok: 'Encerrar e iniciar nova' })) return;
    U.form({
      title: 'Iniciar cronômetro', submit: 'Iniciar', value: pre,
      fields: [
        { k: 'projectId', label: 'Demanda', type: 'select', options: opt.openProjects },
        { k: 'taskId', label: 'Tarefa', type: 'select', options: opt.tasks },
        { k: 'courseId', label: 'Curso (sessão de estudo)', type: 'select', options: opt.openCourses },
        { k: 'exerciseId', label: 'Exercício (sessão de prática)', type: 'select', options: () => S.exercises.filter(x => !x.archived && x.status !== 'done').map(x => [x.id, x.title]) },
        { k: 'note', label: 'O que você vai fazer (opcional)', full: true },
        ...(active.workday() ? [] : [{ k: 'withWorkday', type: 'checkbox', text: 'Iniciar o expediente também', full: true }]),
      ],
      check: v => { const t = v.taskId && St.get('tasks', v.taskId); return t && v.projectId && t.projectId && t.projectId !== v.projectId ? { taskId: 'Esta tarefa pertence a outra demanda.' } : null; },
      onSave: async v => {
        const t = now();
        const c2 = active.session(); if (c2) await St.save('sessions', closeSession(c2, t), { verb: 'encerrada' });
        if (v.withWorkday && !active.workday()) await St.save('workdays', { start: t, end: null }, { verb: 'iniciado' });
        const task = v.taskId && St.get('tasks', v.taskId);
        const projectId = v.projectId || (task && task.projectId) || null;
        const courseId = v.courseId || (task && task.courseId) || null;
        await St.save('sessions', { start: t, end: null, projectId, taskId: v.taskId || null, courseId, exerciseId: v.exerciseId || pre.exerciseId || null, note: v.note, pauses: [] }, { verb: 'iniciada' });
        if (task && task.status === 'todo') await St.save('tasks', { ...task, status: 'doing' }, { quiet: true });
        const ex = (v.exerciseId || pre.exerciseId) && St.get('exercises', v.exerciseId || pre.exerciseId);
        if (ex && ex.status === 'planned') await St.save('exercises', { ...ex, status: 'doing' }, { verb: 'iniciado' });
        const course = courseId && St.get('courses', courseId);
        if (course && course.status === 'not_started') await St.save('courses', { ...course, status: 'doing', start: course.start || today() }, { verb: 'iniciado' });
        U.toast('Cronômetro iniciado.', 'good');
      },
    });
  };
  App.stopSession = async function () {
    await St.reload();
    const s = active.session(); if (!s) return;
    try {
      await St.save('sessions', closeSession(s, now()), { verb: 'encerrada' });
      const dur = U.fmtDur(M.total(M.workedIntervals({ ...s, end: now() }, S.breaks, now())));
      // sessão de estudo: o tempo já foi registrado; oferece só atualizar progresso e próxima atividade
      if (s.courseId && St.get('courses', s.courseId)) U.toast(`Estudo encerrado: ${dur} registrados no curso.`, 'good', 9000, { label: 'Atualizar progresso', fn: () => App.courseProgress(s.courseId) });
      else if (s.exerciseId && St.get('exercises', s.exerciseId)) U.toast(`Prática encerrada: ${dur} registrados no exercício.`, 'good', 9000, { label: 'Registrar resultado', fn: () => App.edit('exercises', s.exerciseId) });
      else U.toast('Sessão encerrada: ' + dur + ' trabalhados.', 'good');
    } catch (e) { U.fail(e); }
  };
  App.pauseSession = async function () {
    const s = active.session(); if (!s || App.isPaused(s)) return;
    try { await St.save('sessions', { ...s, pauses: [...(s.pauses || []), { start: now(), end: null }] }, { quiet: true }); } catch (e) { U.fail(e); }
  };
  App.resumeSession = async function () {
    const s = active.session(); if (!s || !App.isPaused(s)) return;
    try { await St.save('sessions', { ...s, pauses: s.pauses.map(p => p.end ? p : { ...p, end: now() }) }, { quiet: true }); } catch (e) { U.fail(e); }
  };
  App.startBreak = async function (typeId) {
    await St.reload();
    if (active.brk()) return U.toast('Já existe uma pausa em andamento.');
    const type = S.settings.breakTypes.find(b => b.id === typeId) || S.settings.breakTypes[0];
    try { await St.save('breaks', { start: now(), end: null, type: type.id, typeName: type.name, plannedMin: type.min }, { verb: 'iniciada' }); U.toast(`${type.name} iniciada (${type.min} min).`, 'good'); } catch (e) { U.fail(e); }
  };
  App.endBreak = async function () {
    await St.reload();
    const b = active.brk(); if (!b) return;
    try { await St.save('breaks', { ...b, end: now() }, { verb: 'encerrada' }); U.toast('Pausa encerrada.', 'good'); } catch (e) { U.fail(e); }
  };
  App.chooseBreak = function () {
    if (active.brk()) return App.endBreak();
    const d = U.dialog(h`<form method="dialog" class="ask"><h2>Iniciar pausa</h2><div class="stack">${S.settings.breakTypes.map(b => h`<button class="btn block" value="${b.id}">${b.name} · ${b.min} min</button>`)}</div><div class="actions"><button value="" class="btn">Cancelar</button></div></form>`, 'small');
    d.addEventListener('close', () => { if (d.returnValue) App.startBreak(d.returnValue); });
  };

  // registro manual / edição de horários (com confirmação, o histórico fica no registro)
  App.editTime = function (type, id) {
    const old = id ? St.get(type, id) : null;
    const base = old ? old.start : at9();
    const v = old ? { date: M.isoDate(old.start), startT: U.fmtTime(old.start), endT: old.end ? U.fmtTime(old.end) : '', endDate: old.end ? M.isoDate(old.end) : '', ...old } : { date: M.isoDate(base), type: S.settings.breakTypes[0].id };
    const fields = [{ k: 'date', label: 'Data de início', type: 'date', required: true }, { k: 'startT', label: 'Início', type: 'time', required: true }, { k: 'endT', label: 'Fim', type: 'time', hint: old && !old.end ? 'Vazio: continua em andamento.' : '' }, { k: 'endDate', label: 'Data do fim (se outro dia)', type: 'date' }];
    if (type === 'sessions') fields.push({ k: 'courseId', label: 'Curso (estudo)', type: 'select', options: opt.courses }, { k: 'exerciseId', label: 'Exercício (prática)', type: 'select', options: opt.exercises }, { k: 'projectId', label: 'Demanda', type: 'select', options: opt.projects }, { k: 'taskId', label: 'Tarefa', type: 'select', options: () => S.tasks.map(t => [t.id, t.title]) }, { k: 'note', label: 'Descrição', full: true });
    if (type === 'breaks') fields.push({ k: 'type', label: 'Tipo de pausa', type: 'select', required: true, options: () => S.settings.breakTypes.map(b => [b.id, b.name]) }, { k: 'note', label: 'Observação', full: true });
    U.form({
      title: (old ? 'Editar ' : 'Registrar ') + { sessions: 'sessão de trabalho', breaks: 'pausa', workdays: 'expediente' }[type], fields, value: v,
      check: x => {
        const e = {};
        if (!x.endT && (!old || old.end)) e.endT = 'Informe o horário de fim.';
        if (x.endT) { const s = M.at(x.date, x.startT), en = M.at(x.endDate || x.date, x.endT); if (en <= s) e.endT = 'O fim deve ser depois do início.'; if (en > now()) e.endT = 'O fim não pode estar no futuro.'; }
        if (x.startT && M.at(x.date, x.startT) > now()) e.startT = 'O início não pode estar no futuro.';
        return e;
      },
      onSave: async x => {
        if (old && !await U.ask({ title: 'Alterar este registro de horário?', text: 'Os totais de horas serão recalculados. A alteração fica guardada no histórico do registro.', ok: 'Alterar' })) throw Object.assign(new Error('cancelado'), { cancelled: true });
        const rec = { ...(old || { pauses: [] }), start: M.at(x.date, x.startT), end: x.endT ? M.at(x.endDate || x.date, x.endT) : null, manual: true };
        if (type === 'sessions') Object.assign(rec, { projectId: x.projectId || (St.get('tasks', x.taskId) || {}).projectId || null, taskId: x.taskId || null, courseId: x.courseId || (St.get('tasks', x.taskId) || {}).courseId || null, exerciseId: x.exerciseId || null, note: x.note });
        if (type === 'breaks') { const bt = S.settings.breakTypes.find(b => b.id === x.type); Object.assign(rec, { type: x.type, typeName: bt ? bt.name : x.type, plannedMin: bt ? bt.min : null, note: x.note }); }
        if (rec.end == null && !old) throw Object.assign(new Error(''), { fields: { endT: 'Informe o horário de fim.' } });
        if (type === 'sessions' && rec.end == null && S.sessions.some(s => !s.end && s.id !== rec.id)) throw Object.assign(new Error(''), { fields: { endT: 'Já existe outra sessão ativa.' } });
        await St.save(type, rec, { verb: old ? 'editado(a) manualmente' : 'registrado(a) manualmente' });
        U.toast('Registro salvo.', 'good');
      },
      onDelete: old ? () => App.del(type, id) : null,
    });
    function at9() { return M.at(today(), S.settings.workStart); }
  };

  // ---------- rotas ----------
  // [rota, título, ícone, onde aparece: menu em pílula no topo ou trilho de ícones, rótulo curto da pílula]
  const ROUTES = [
    ['dashboard', 'Dashboard', 'home', 'top', 'Início'], ['demandas', 'Demandas', 'folder', 'top'], ['tarefas', 'Tarefas', 'check', 'top'], ['anotacoes', 'Anotações', 'note', 'top'],
    ['calendario', 'Calendário', 'calendar', 'top'], ['tempo', 'Controle de tempo', 'clock', 'top', 'Tempo'], ['relatorios', 'Relatórios', 'chart', 'top'],
    // na barra lateral: [..., 'rail', rótulo curto, grupo]
    ['revisoes', 'Revisões', 'rotate', 'rail', '', 'Trabalho'], ['solicitantes', 'Solicitantes', 'users', 'rail', '', 'Trabalho'],
    ['pausas', 'Pausas', 'coffee', 'rail', '', 'Tempo'],
    ['referencias', 'Referências criativas', 'image', 'rail', 'Referências', 'Criação'],
    ['cursos', 'Cursos', 'cap', 'rail', '', 'Aprendizado'], ['biblioteca', 'Biblioteca', 'book', 'rail', '', 'Aprendizado'], ['pratica', 'Prática', 'flask', 'rail', '', 'Aprendizado'],
    ['metas', 'Metas', 'target', 'rail', '', 'Análise'], ['insights', 'Insights e sugestões', 'bulb', 'rail', 'Insights', 'Análise'],
  ];
  App.ROUTES = ROUTES;
  function go(r) { location.hash = r; }
  App.go = go;
  function current() { const [r, id] = location.hash.slice(1).split('/'); return { r: r || 'dashboard', id }; }
  let lastRoute = '';
  function render() {
    const { r, id } = current();
    const view = Views[r] || Views.dashboard;
    const main = document.getElementById('main');
    const keep = lastRoute === location.hash ? window.scrollY : 0;
    const typing = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.quick : null;
    try { main.innerHTML = U.html(view.render(id)); }
    catch (e) { console.error(e); main.innerHTML = U.html(h`<div class="empty"><p class="empty-title">Algo deu errado ao abrir esta página.</p><p>${e.message}</p></div>`); }
    if (view.mount) view.mount(main, id);
    const active = r === 'demanda' ? 'demandas' : r === 'solicitante' ? 'solicitantes' : Views[r] ? r : 'dashboard';
    document.querySelectorAll('[data-r]').forEach(a => a.toggleAttribute('aria-current', a.dataset.r === active));
    movePill();
    const title = (ROUTES.find(x => x[0] === r) || [, r === 'configuracoes' ? 'Configurações' : r === 'demanda' ? 'Demanda' : r === 'solicitante' ? 'Solicitante' : 'Dashboard'])[1];
    document.title = title + ' · Prancheta';
    renderDemoBanner(); tick();
    // páginas com escrita rápida já abrem com o cursor no campo; depois de salvar, ele continua lá
    const quick = main.querySelector(typing && lastRoute === location.hash ? `[data-quick="${typing}"]` : '[data-quick]');
    if (lastRoute !== location.hash) { window.scrollTo(0, 0); (quick || main).focus({ preventScroll: true }); } else { window.scrollTo(0, keep); if (typing && quick) quick.focus({ preventScroll: true }); }
    lastRoute = location.hash;
  }
  App.render = render;
  // destaque que desliza até a pílula ativa; a borda que vai na frente anda mais rápido que a de trás
  function movePill() {
    const nav = document.getElementById('nav'), ind = nav.querySelector('.pill-ind'), a = nav.querySelector('a[aria-current]');
    if (!a) { ind.style.opacity = 0; return; }
    const left = a.offsetLeft, right = nav.scrollWidth - left - a.offsetWidth;
    ind.dataset.dir = left < (parseFloat(ind.style.left) || 0) ? 'left' : 'right';
    Object.assign(ind.style, { left: left + 'px', right: right + 'px', opacity: 1 });
  }
  window.addEventListener('resize', movePill);
  App.page = (title, sub, actions = '') => h`<header class="page-head"><div><h1>${title}</h1>${sub ? h`<p class="sub">${sub}</p>` : ''}</div><div class="page-actions">${actions}</div></header>`;

  // ---------- ações por atributo data-act ----------
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const [act, a, b, c] = el.dataset.act.split(':');
    switch (act) {
      case 'new': App.edit(a, null, el.dataset.defaults ? JSON.parse(el.dataset.defaults) : {}); break;
      case 'edit': App.edit(a, b); break;
      case 'del': App.del(a, b); break;
      case 'archive': App.toggleArchive(a, b); break;
      case 'go': go(a + (b ? '/' + b : '')); break;
      case 'toggle-task': App.toggleTask(a); break;
      case 'toggle-check': App.toggleCheck(a, b, c, el.dataset.item); break;
      case 'workday': active.workday() ? App.endWorkday() : App.startWorkday(); break;
      case 'session-start': App.startSession({ projectId: a || '', taskId: b || '' }); break;
      case 'session-stop': App.stopSession(); break;
      case 'session-pause': App.pauseSession(); break;
      case 'session-resume': App.resumeSession(); break;
      case 'break': App.chooseBreak(); break;
      case 'break-start': App.startBreak(a); break;
      case 'break-end': App.endBreak(); break;
      case 'time-edit': App.editTime(a, b); break;
      case 'clear-demo': clearDemo(); break;
      case 'load-demo': loadDemo(); break;
      default: { const v = Views[current().r]; if (v && v.act) v.act(act, [a, b, c], el, e); }
    }
  });
  document.addEventListener('change', e => { const v = Views[current().r]; if (v && v.change) v.change(e); });
  document.addEventListener('input', e => { const v = Views[current().r]; if (v && v.input && e.target.closest('#main')) v.input(e); });

  // ---------- barra superior: relógio, cronômetro e menu "Novo" ----------
  function tick() {
    const s = active.session(), b = active.brk(), w = active.workday(), t = now();
    const chip = document.getElementById('timer-chip');
    if (b) {
      const el = t - b.start, rest = b.plannedMin * M.MIN - el;
      chip.innerHTML = U.html(h`<span class="dot warn"></span><span>${b.typeName} · ${U.fmtClock(el)}${rest < 0 ? ' (passou ' + U.fmtDur(-rest) + ')' : ''}</span><button class="btn small" data-act="break-end">Encerrar pausa</button>`);
    } else if (s) {
      const ms = M.total(M.workedIntervals(s, S.breaks, t)), p = St.get('projects', s.projectId), tk = St.get('tasks', s.taskId);
      const paused = App.isPaused(s);
      chip.innerHTML = U.html(h`<span class="dot ${paused ? 'warn' : 'good'}"></span><span class="mono">${U.fmtClock(ms)}</span><span class="chip-label">${tk ? tk.title : p ? p.name : 'Sem demanda'}</span><button class="icon-btn" data-act="${paused ? 'session-resume' : 'session-pause'}" aria-label="${paused ? 'Retomar' : 'Pausar sessão'}">${icon(paused ? 'play' : 'pause')}</button><button class="icon-btn" data-act="session-stop" aria-label="Encerrar sessão">${icon('stop')}</button>`);
    } else chip.innerHTML = U.html(h`${w ? h`<span class="dot good"></span><span>Expediente desde ${U.fmtTime(w.start)}</span>` : ''}<button class="btn small" data-act="session-start">${icon('play')} Iniciar cronômetro</button>`);
    document.querySelectorAll('[data-live]').forEach(el => { const f = LIVE[el.dataset.live]; if (f) el.textContent = f(el); });
  }
  // valores da página que mudam a cada segundo
  const LIVE = {
    session: () => { const s = active.session(); return s ? U.fmtClock(M.total(M.workedIntervals(s, S.breaks, now()))) : '00:00:00'; },
    workday: () => { const w = active.workday(); return w ? U.fmtClock(now() - w.start) : '00:00:00'; },
    'break-elapsed': () => { const b = active.brk(); return b ? U.fmtClock(now() - b.start) : '00:00:00'; },
    'break-left': () => { const b = active.brk(); if (!b) return ''; const r = b.plannedMin * M.MIN - (now() - b.start); return r >= 0 ? U.fmtClock(r) + ' restantes' : 'passou ' + U.fmtDur(-r) + ' do previsto'; },
    'since-break': () => U.fmtDur(M.sinceLastBreak(S, now())),
    'today-worked': () => U.fmtDur(M.timeSummary(S, ...M.range('day', now()), now()).workedMs),
  };
  App.LIVE = LIVE;
  setInterval(() => { tick(); const ring = document.querySelector('[data-ring]'); if (ring && Views.pausas.ring) Views.pausas.ring(ring); }, 1000);

  // ---------- lembretes (só com a Prancheta aberta) ----------
  let lastBreakReminder = Number(sessionStorage.getItem('prancheta.breakReminder')) || 0;
  async function reminders() {
    const t = now();
    const notify = (title, body) => { U.toast(title + (body ? ' — ' + body : ''), 'warn', 10000); if (S.settings.notify && 'Notification' in window && Notification.permission === 'granted') try { new Notification(title, { body }); } catch { /* sem suporte */ } };
    for (const task of S.tasks) {
      if (task.reminder && !task.remindedAt && task.status !== 'done' && new Date(task.reminder).getTime() <= t) { notify('Lembrete: ' + task.title, task.due ? 'Prazo ' + U.fmtDate(task.due) : ''); await St.save('tasks', { ...task, remindedAt: t }, { quiet: true }).catch(() => {}); }
    }
    for (const ev of S.events) {
      if (ev.reminderMin === '' || ev.reminderMin == null || ev.remindedAt) continue;
      const when = M.at(ev.date, ev.time || '09:00') - Number(ev.reminderMin) * M.MIN;
      if (when <= t && t - when < M.DAY) { notify('Em breve: ' + ev.title, `${U.fmtDate(ev.date)} ${ev.time || ''}`); await St.save('events', { ...ev, remindedAt: t }, { quiet: true }).catch(() => {}); }
    }
    const s = active.session();
    if (s && !active.brk() && !App.isPaused(s) && S.settings.breakReminderMin > 0) {
      const since = M.sinceLastBreak(S, t);
      if (since >= S.settings.breakReminderMin * M.MIN && t - lastBreakReminder >= S.settings.breakReminderMin * M.MIN) {
        lastBreakReminder = t; sessionStorage.setItem('prancheta.breakReminder', t);
        notify('Hora de uma pausa?', `Você está há ${U.fmtDur(since)} trabalhando sem pausa. A pausa só começa se você iniciar.`);
      }
    }
  }
  setInterval(() => reminders().catch(console.error), 30000);

  // ---------- busca global ----------
  function search(q) {
    q = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    if (q.length < 2) return [];
    const has = (...xs) => xs.flat().filter(Boolean).join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q);
    const out = [];
    S.projects.forEach(p => has(p.name, p.description, p.category, p.notes) && out.push(['Demanda', p.name, 'go:demanda:' + p.id]));
    S.tasks.forEach(t => has(t.title, t.description, t.notes, (t.checklist || []).map(c => c.text)) && out.push(['Tarefa', t.title, 'edit:tasks:' + t.id]));
    S.clients.forEach(c => has(c.name, c.contactName, c.email, c.notes) && out.push(['Solicitante', c.name, 'go:solicitante:' + c.id]));
    S.notes.forEach(n => has(n.title, n.body, n.tags) && out.push(['Anotação', n.title, 'edit:notes:' + n.id]));
    S.refs.forEach(r => has(r.name, r.description, r.tags, r.typography) && out.push(['Referência', r.name, 'edit:refs:' + r.id]));
    S.revisions.forEach(r => has(r.version, r.feedback, r.changes) && out.push(['Revisão', (St.get('projects', r.projectId) || {}).name + ' · ' + r.version, 'edit:revisions:' + r.id]));
    S.events.forEach(ev => has(ev.title, ev.notes) && out.push(['Evento', ev.title + ' · ' + U.fmtDate(ev.date), 'edit:events:' + ev.id]));
    S.courses.forEach(c => has(c.name, c.platform, c.instructor, c.description, c.learnings, c.notes, c.nextActivity) && out.push(['Curso', c.name, 'edit:courses:' + c.id]));
    S.resources.forEach(r => has(r.title, r.description, r.summary, r.notes, r.tags, r.tool) && out.push(['Material', r.title, 'edit:resources:' + r.id]));
    S.exercises.forEach(x => has(x.title, x.description, x.goal, x.technique, x.result, x.difficulties) && out.push(['Exercício', x.title, 'edit:exercises:' + x.id]));
    return out.slice(0, 30);
  }
  function setupSearch() {
    const inp = document.getElementById('search'), box = document.getElementById('search-results');
    let sel = -1;
    const show = () => {
      const res = search(inp.value); sel = -1;
      box.hidden = inp.value.trim().length < 2;
      box.innerHTML = U.html(res.length ? res.map(([k, t, act], i) => h`<li><button data-act="${act}" id="sr-${i}"><span class="badge muted">${k}</span> ${t}</button></li>`) : h`<li class="muted pad">Nada encontrado para “${inp.value}”.</li>`);
    };
    inp.addEventListener('input', show);
    inp.addEventListener('keydown', e => {
      const items = box.querySelectorAll('button');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); items.forEach((b, i) => b.classList.toggle('sel', i === sel)); }
      if (e.key === 'Enter' && items.length) { e.preventDefault(); items[Math.max(0, sel)].click(); }
      if (e.key === 'Escape') closeSearch();
    });
    box.addEventListener('click', closeSearch);
    document.addEventListener('click', e => { if (!e.target.closest('.search, [data-open-search]')) closeSearch(); });
  }
  // a busca abre por cima do conteúdo, pelo ícone do trilho ou pela tecla /
  function openSearch() { document.getElementById('search-pop').hidden = false; document.getElementById('search').focus(); }
  function closeSearch() {
    const inp = document.getElementById('search');
    inp.value = ''; document.getElementById('search-results').hidden = true; document.getElementById('search-pop').hidden = true;
  }

  // ---------- atalhos ----------
  document.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || document.body.classList.contains('locked')) return;
    const typing = e.target.matches('input, textarea, select');
    if (e.key === '/' && !typing) { e.preventDefault(); openSearch(); return; }
    if (!e.altKey) return;
    const k = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : '';
    const map = { n: () => App.edit('tasks'), p: () => App.edit('projects'), a: () => App.edit('notes'), t: () => active.session() ? App.stopSession() : App.startSession(), b: () => App.chooseBreak(), e: () => active.workday() ? App.endWorkday() : App.startWorkday() };
    if (map[k]) { e.preventDefault(); map[k](); }
  });
  window.addEventListener('beforeunload', e => { if (document.querySelector('dialog[open]') && window.__dirtyForm && window.__dirtyForm()) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- dados de demonstração ----------
  function renderDemoBanner() {
    const n = St.S.projects.filter(p => p.demo).length + St.S.tasks.filter(t => t.demo).length;
    const el = document.getElementById('demo-banner');
    el.hidden = !n;
    if (n) el.innerHTML = U.html(h`${icon('info')} Dados de demonstração carregados: não são registros seus. <button class="btn small" data-act="clear-demo">Remover dados de demonstração</button>`);
  }
  async function clearDemo() {
    if (!await U.ask({ title: 'Remover dados de demonstração?', text: 'Somente os registros marcados como demonstração serão apagados. O que você cadastrou continua.', ok: 'Remover', danger: true })) return;
    try { const n = await St.clearDemo(); U.toast(`${n} registros de demonstração removidos.`, 'good'); } catch (e) { U.fail(e); }
  }
  async function loadDemo() {
    if (S.projects.some(p => p.demo)) return U.toast('Os dados de demonstração já estão carregados.');
    const t = now(), d = n => M.isoDate(M.addDays(t, n)), id = () => M.uid(), base = { demo: true, created: t, updated: t, history: [] };
    const c1 = { ...base, id: id(), name: '[Demo] Marketing', contactName: 'Marina', email: 'marina@exemplo.com' };
    const c2 = { ...base, id: id(), name: '[Demo] RH' };
    const P = (name, clientId, category, status, priority, start, due, estimateH, extra = {}) => ({ ...base, id: id(), name, clientId, category, status, priority, start, due, estimateH, stages: [], links: [], statusSince: t - 6 * M.DAY, ...extra });
    const p1 = P('[Demo] Campanha de Black Friday', c1.id, 'Banners e anúncios', 'doing', 'high', d(-12), d(3), 30);
    const p2 = P('[Demo] Posts de novembro', c1.id, 'Posts para redes sociais', 'approval', 'medium', d(-5), d(8), 12);
    const p3 = P('[Demo] Manual de integração', c2.id, 'Apresentações', 'done', 'medium', d(-30), d(-10), 10, { completedAt: M.addDays(t, -11) });
    const T = (title, projectId, status, priority, due, estimateH, extra = {}) => ({ ...base, id: id(), title, projectId, clientId: projectId === p3.id ? c2.id : c1.id, status, priority, due, estimateH, checklist: [], completedAt: status === 'done' ? M.addDays(t, -2) : null, ...extra });
    const tasks = [
      T('[Demo] Moodboard', p1.id, 'done', 'medium', d(-8), 3), T('[Demo] Esboços do símbolo', p1.id, 'done', 'high', d(-4), 5),
      T('[Demo] Refinar tipografia', p1.id, 'doing', 'high', d(1), 4, { checklist: [{ id: id(), text: 'Testar 3 famílias', done: true }, { id: id(), text: 'Ajustar kerning', done: false }] }),
      T('[Demo] Manual da marca', p1.id, 'todo', 'urgent', d(3), 8), T('[Demo] Calendário editorial', p2.id, 'done', 'medium', d(-3), 2),
      T('[Demo] Artes da semana 1', p2.id, 'waiting', 'medium', d(2), 3), T('[Demo] Vetorizar logo final', p3.id, 'done', 'medium', d(-12), 2),
      T('[Demo] Responder e-mails', null, 'todo', 'low', d(0), 0.5, { clientId: null }),
    ];
    const sess = [], dayAt = (n, hh, mm = 0) => { const x = new Date(M.addDays(M.startOfDay(t), n)); x.setHours(hh, mm); return x.getTime(); };
    [[-3, 9, 12, tasks[0]], [-3, 13, 17, tasks[1]], [-2, 9, 11, tasks[4]], [-2, 14, 18, tasks[1]], [-1, 9, 12, tasks[2]], [-1, 13, 16, tasks[6]]].forEach(([n, a, b, tk]) => sess.push({ ...base, id: id(), start: dayAt(n, a), end: dayAt(n, b), projectId: tk.projectId, taskId: tk.id, pauses: [], manual: true }));
    const wds = [-3, -2, -1].map(n => ({ ...base, id: id(), start: dayAt(n, 8, 50), end: dayAt(n, 18, 10), manual: true }));
    const brs = [-3, -2, -1].map(n => ({ ...base, id: id(), start: dayAt(n, 12), end: dayAt(n, 13), type: 'lunch', typeName: 'Almoço', plannedMin: 60, manual: true }));
    const list = [['clients', c1], ['clients', c2], ['projects', p1], ['projects', p2], ['projects', p3], ...tasks.map(x => ['tasks', x]), ...sess.map(x => ['sessions', x]), ...wds.map(x => ['workdays', x]), ...brs.map(x => ['breaks', x]),
      ['events', { ...base, id: id(), title: '[Demo] Apresentação da marca', type: 'meeting', date: d(2), time: '15:00', endTime: '16:00', projectId: p1.id }],
      ['revisions', { ...base, id: id(), projectId: p2.id, version: 'v1', sentAt: d(-6), status: 'waiting', feedback: '', changes: '' }],
      ['notes', { ...base, id: id(), title: '[Demo] Briefing Black Friday', kind: 'Briefing', body: 'Peças para site, e-mail e redes. Tom urgente, cores da marca.', tags: ['black-friday'], projectId: p1.id, clientId: c1.id, pinned: true }],
      ['refs', { ...base, id: id(), name: '[Demo] Paleta outono', category: 'Cores', tags: ['quente'], palette: ['#7a3e1d', '#d98e48', '#f3e3c3'], typography: 'Fraunces + Inter', projectId: p1.id }],
      ['goals', { ...base, id: id(), title: '[Demo] 30 h por semana', metric: 'hours_week', target: 30 }]];
    try { await St.bulkPut(list); U.toast('Dados de demonstração carregados. Remova quando quiser pelo aviso no topo.', 'good', 6000); } catch (e) { U.fail(e); }
  }

  // ---------- música: player oficial do Spotify, fora do <main> para seguir tocando entre as páginas ----------
  function renderMusic() {
    const box = document.getElementById('music'), mu = S.settings.music || { current: '', saved: [] };
    const cur = M.spotifyEmbed(mu.current);
    const slot = box.querySelector('.music-player');
    // só recria o iframe quando o link muda; recriar interromperia a música
    if (slot.dataset.src !== (cur ? cur.embed : '')) {
      slot.dataset.src = cur ? cur.embed : '';
      slot.innerHTML = cur ? U.html(h`<iframe title="Player do Spotify" src="${cur.embed}" height="${['track', 'episode'].includes(cur.type) ? 152 : 352}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`)
        : U.html(h`<p class="muted small">Cole o link de uma playlist, álbum, música, artista ou podcast do Spotify (no app: Compartilhar → Copiar link).</p>`);
    }
    box.querySelector('.music-saved').innerHTML = U.html(mu.saved.length ? mu.saved.map((f, i) => h`<li><button class="row-btn" data-music-play="${i}"${f.url === mu.current ? U.raw(' aria-current="true"') : ''}>${icon('play', 'sm')}<span class="grow ellipsis">${f.name}</span></button><button class="icon-btn" data-music-del="${i}" aria-label="Remover ${f.name} dos favoritos">${icon('x')}</button></li>`) : '');
    document.getElementById('music-btn').classList.toggle('playing', !!cur);
  }
  async function setMusic(patch) { try { await St.saveSettings({ music: { ...(S.settings.music || { current: '', saved: [] }), ...patch } }); renderMusic(); } catch (e) { U.fail(e); } }
  function setupMusic() {
    const box = document.getElementById('music'), btn = document.getElementById('music-btn');
    const toggle = open => { box.hidden = !open; btn.setAttribute('aria-expanded', open); if (open) box.querySelector('#music-link').focus(); };
    btn.addEventListener('click', () => toggle(box.hidden));
    box.querySelector('[data-music-close]').addEventListener('click', () => toggle(false));
    box.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, link = f.elements.link.value.trim(), name = f.elements.name.value.trim();
      const err = box.querySelector('.err'); err.textContent = '';
      const sp = M.spotifyEmbed(link);
      if (!sp) { err.textContent = 'Não reconheci o link. Use um link do Spotify, como https://open.spotify.com/playlist/…'; f.elements.link.focus(); return; }
      const saved = (S.settings.music || {}).saved || [];
      const save = e.submitter && e.submitter.value === 'save';
      await setMusic({ current: sp.url, saved: save && !saved.some(x => x.url === sp.url) ? [...saved, { name: name || ({ playlist: 'Playlist', album: 'Álbum', track: 'Música', artist: 'Artista', show: 'Podcast', episode: 'Episódio' }[sp.type] + ' ' + (saved.length + 1)), url: sp.url }] : saved });
      f.reset();
    });
    box.addEventListener('click', async e => {
      const p = e.target.closest('[data-music-play]'), d = e.target.closest('[data-music-del]'), mu = S.settings.music;
      if (p) setMusic({ current: mu.saved[+p.dataset.musicPlay].url });
      if (d) setMusic({ saved: mu.saved.filter((_, i) => i !== +d.dataset.musicDel) });
      if (e.target.closest('[data-music-stop]')) setMusic({ current: '' });
    });
    renderMusic();
  }

  // ---------- início ----------
  // tema (claro verde-musgo ou pôr do sol) e cor de destaque opcional por cima dele
  const THEME_ACCENT = { claro: '#52664f', sol: '#4f8bff' };
  const OLD_DEFAULTS = ['#4f8bff', '#2f5bd3']; // cores padrão de versões anteriores: seguem o tema
  App.THEME_ACCENT = THEME_ACCENT;
  App.themeAccent = () => THEME_ACCENT[S.settings.theme === 'sol' ? 'sol' : 'claro'];
  App.applyAccent = () => {
    const root = document.documentElement, sol = S.settings.theme === 'sol';
    if (sol) root.dataset.theme = 'sol'; else delete root.dataset.theme;
    const a = (S.settings.accent || '').toLowerCase();
    const custom = a && !OLD_DEFAULTS.includes(a) && a !== App.themeAccent();
    for (const [k, v] of [['--accent', a], ['--accent-strong', `color-mix(in srgb, ${a} 80%, black)`], ['--accent-soft', `color-mix(in srgb, ${a} ${sol ? 24 : 14}%, ${sol ? 'transparent' : 'white'})`], ['--hi', `color-mix(in srgb, ${a} ${sol ? 20 : 12}%, ${sol ? 'transparent' : 'white'})`]])
      custom ? root.style.setProperty(k, v) : root.style.removeProperty(k);
  };
  async function boot() {
    const nav = document.getElementById('nav');
    nav.insertAdjacentHTML('beforeend', U.html(ROUTES.filter(x => x[3] === 'top').map(([r, t, , , short]) => h`<a href="#${r}" data-r="${r}">${short || t}</a>`)));
    // barra lateral recolhível: aberta mostra rótulos e grupos; recolhida, só ícones (o nome aparece ao passar o mouse)
    const railLink = ([r, t, ic, , short]) => h`<a class="rail-btn" href="#${r}" data-r="${r}" data-tip="${short || t}">${icon(ic)}<span class="rail-label">${short || t}</span></a>`;
    const railGroups = [...new Set(ROUTES.filter(x => x[3] === 'rail').map(x => x[5]))];
    document.getElementById('rail').innerHTML = U.html(h`<button class="rail-btn rail-toggle" data-rail-toggle data-tip="Abrir menu">${icon('sidebar')}<span class="rail-label">Recolher menu</span></button>
      <button class="rail-btn" data-open-search data-tip="Buscar">${icon('search')}<span class="rail-label">Buscar <kbd>/</kbd></span></button>
      ${railGroups.map(g => h`<p class="rail-group rail-label">${g}</p>${ROUTES.filter(x => x[3] === 'rail' && x[5] === g).map(railLink)}`)}
      <span class="rail-sep" aria-hidden="true"></span><button class="rail-btn" data-lock-now data-tip="Bloquear">${icon('lock')}<span class="rail-label">Bloquear</span></button>${railLink(['configuracoes', 'Configurações', 'gear'])}`);
    const setRail = open => { document.body.classList.toggle('rail-open', open); const tg = document.querySelector('[data-rail-toggle]'); tg.setAttribute('aria-expanded', open); tg.querySelector('.rail-label').textContent = open ? 'Recolher menu' : 'Abrir menu'; try { localStorage.setItem('prancheta.rail', open ? '1' : '0'); } catch { /* sem localStorage */ } movePill(); };
    let railPref = null; try { railPref = localStorage.getItem('prancheta.rail'); } catch { /* sem localStorage */ }
    setRail(railPref ? railPref === '1' : innerWidth >= 1200);
    document.querySelector('[data-rail-toggle]').addEventListener('click', () => setRail(!document.body.classList.contains('rail-open')));
    document.querySelector('[data-lock-now]').addEventListener('click', () => window.Lock.lockNow());
    document.querySelector('[data-open-search]').addEventListener('click', openSearch);
    document.getElementById('new-menu').innerHTML = U.html([['projects', 'Demanda', 'folder'], ['tasks', 'Tarefa', 'check'], ['clients', 'Solicitante', 'users'], ['events', 'Evento', 'calendar'], ['revisions', 'Revisão', 'rotate'], ['refs', 'Referência', 'image'], ['notes', 'Anotação', 'note'], ['goals', 'Meta', 'target'], ['courses', 'Curso', 'cap'], ['resources', 'Material', 'book'], ['exercises', 'Exercício', 'flask']].map(([t, l, ic]) => h`<button data-act="new:${t}" role="menuitem">${icon(ic)} ${l}</button>`));
    const nb = document.getElementById('new-btn'), nm = document.getElementById('new-menu');
    nb.addEventListener('click', () => { nm.hidden = !nm.hidden; nb.setAttribute('aria-expanded', !nm.hidden); });
    document.addEventListener('click', e => { if (!e.target.closest('.new-wrap')) { nm.hidden = true; nb.setAttribute('aria-expanded', 'false'); } });
    setupSearch();
    try { await St.init(); }
    catch (e) {
      document.getElementById('main').innerHTML = U.html(h`<div class="empty"><p class="empty-title">Não foi possível abrir o armazenamento local</p><p>${e.message}</p><p>A Prancheta guarda os dados no IndexedDB do navegador. Em janelas anônimas ou com dados de sites bloqueados, ele pode não estar disponível.</p></div>`);
      return;
    }
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    App.applyAccent();
    window.addEventListener('prancheta-outdated', () => U.toast('A Prancheta foi atualizada em outra aba. Recarregue esta aba para continuar salvando.', 'warn', 3600000, { label: 'Recarregar', fn: () => location.reload() }));
    await window.Lock.gate();
    setupMusic();
    St.onChange(() => { App.applyAccent(); render(); renderMusic(); });
    window.addEventListener('hashchange', render);
    render();
    reminders().catch(console.error);
    document.body.classList.remove('loading');
  }
  // as telas (views-*.js) carregam depois deste arquivo; o início espera por elas
  document.addEventListener('DOMContentLoaded', boot);
})();
