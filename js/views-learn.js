// Aprendizado: Cursos e Biblioteca (a Prática fica em views-practice.js).
(function () {
  'use strict';
  const M = window.Model, U = window.UI, St = window.Store, S = St.S, App = window.App;
  const { h, icon } = U;
  const Views = window.Views, H = Views.helpers;
  const now = () => Date.now(), today = () => M.isoDate(now());
  const cname = id => (St.get('courses', id) || {}).name;
  const stars = n => n ? h`<span class="stars" title="Sua avaliação: ${n} de 5" aria-label="${n} de 5">${'★'.repeat(n)}<span class="muted">${'★'.repeat(5 - n)}</span></span>` : '';
  const lastText = ts => ts ? U.fmtDate(M.isoDate(ts)) + ' · ' + U.relDay(M.isoDate(ts)) : 'sem atividade registrada';
  Views.helpers.cname2 = cname;

  // arquivar guarda o histórico e tira o registro das listas principais
  App.toggleArchive = async function (type, id) {
    const r = St.get(type, id); if (!r) return;
    try { await St.save(type, { ...r, archived: !r.archived }, { verb: r.archived ? 'desarquivado(a)' : 'arquivado(a)' }); U.toast(r.archived ? 'Restaurado.' : 'Arquivado. Use “Mostrar arquivados” para ver de novo.', 'good'); } catch (e) { U.fail(e); }
  };

  // atualização rápida do curso: progresso, próxima atividade e minutos estudados fora do cronômetro
  App.courseProgress = function (id) {
    const c = St.get('courses', id); if (!c) return;
    U.form({
      title: 'Atualizar curso: ' + c.name, submit: 'Salvar progresso', value: { progress: c.progress || 0, nextActivity: c.nextActivity, status: c.status },
      fields: [
        { k: 'progress', label: 'Progresso (%)', type: 'number', step: '1', required: true },
        { k: 'status', label: 'Status', type: 'select', options: U.COURSE_STATUSES, required: true },
        { k: 'addMin', label: 'Somar minutos estudados fora do cronômetro', type: 'number', step: '5', hint: 'Sessões cronometradas já contam sozinhas; não some de novo.' },
        { k: 'nextActivity', label: 'Próxima atividade', full: true },
      ],
      check: v => (v.progress === '' || v.progress < 0 || v.progress > 100) ? { progress: 'Informe um valor de 0 a 100.' } : null,
      onSave: async v => {
        const rec = { ...c, progress: v.progress, status: v.status, nextActivity: v.nextActivity, extraMin: (Number(c.extraMin) || 0) + (Number(v.addMin) || 0) };
        App.FORMS.courses.before(rec, c);
        await St.save('courses', rec, { verb: 'atualizado' });
        U.toast('Curso atualizado.', 'good');
      },
    });
  };

  // ================= CURSOS =================
  const CDEF = { q: '', tool: '', category: '', status: '', priority: '', archived: false };
  function courseCard(c) {
    const t = now(), ms = M.courseStudyMs(S, c, t), last = M.lastActivity(S, 'courseId', c), late = c.status !== 'done' && c.due && c.due < today();
    return h`<article class="card course ${late ? 'is-late' : ''}">
      <header><button class="title-btn" data-act="edit:courses:${c.id}">${c.name}</button>${U.priorityBadge(c.priority)}</header>
      <p class="small muted">${[c.platform, c.instructor, c.tool, c.level ? U.label(U.LEVELS, c.level) : ''].filter(Boolean).join(' · ') || 'Sem plataforma informada'}</p>
      <div class="card-meter">${U.meter((c.progress || 0) / 100, c.status === 'done' ? 'good' : '')}<span class="mono small">${c.progress || 0}%</span></div>
      <dl class="facts">
        <div><dt>Estudado</dt><dd>${U.fmtDur(ms)}${c.totalH ? ' de ' + c.totalH + ' h' : ''}</dd></div>
        <div><dt>Última atividade</dt><dd>${lastText(last)}</dd></div>
        ${c.due ? h`<div><dt>Previsão</dt><dd class="${late ? 'txt-bad' : ''}">${U.fmtDate(c.due)}</dd></div>` : ''}
      </dl>
      ${c.nextActivity && c.status !== 'done' ? h`<p class="next">${icon('right', 'sm')}${c.nextActivity}</p>` : ''}
      <footer class="card-actions">
        ${c.status !== 'done' && !c.archived ? h`<button class="btn small" data-act="study:${c.id}">${icon('play')} Estudar agora</button><button class="btn small ghost" data-act="course-progress:${c.id}">Atualizar progresso</button><button class="btn small ghost" data-act="course-task:${c.id}">Criar tarefa de estudo</button>` : ''}
        ${c.url ? h`<a class="btn small ghost" href="${M.isUrl(c.url) ? c.url : '#'}" target="_blank" rel="noopener noreferrer">${icon('link')} Abrir curso</a>` : ''}
        <button class="btn small ghost" data-act="archive:courses:${c.id}">${c.archived ? 'Desarquivar' : 'Arquivar'}</button>
      </footer>
    </article>`;
  }
  Views.cursos = {
    render() {
      const v = H.vs('courses', CDEF), q = H.norm(v.q);
      const list = S.courses.filter(c => (v.archived || !c.archived) && (!q || H.norm([c.name, c.platform, c.instructor, c.description, c.nextActivity].join(' ')).includes(q))
        && (!v.tool || c.tool === v.tool) && (!v.category || c.category === v.category) && (!v.status || c.status === v.status) && (!v.priority || c.priority === v.priority))
        .sort((a, b) => M.PRIORITY_RANK[a.priority] - M.PRIORITY_RANK[b.priority] || (a.due || '9').localeCompare(b.due || '9') || a.name.localeCompare(b.name));
      const groups = [['doing', 'Em andamento'], ['not_started', 'Planejados'], ['paused', 'Pausados'], ['done', 'Concluídos']];
      const [w0, w1] = M.range('week', now(), S.settings.weekStart);
      const weekStudy = M.studyMs(S, w0, w1, now());
      return h`${App.page('Cursos', `${S.courses.filter(c => c.status === 'doing' && !c.archived).length} em andamento · ${U.fmtDur(weekStudy)} de estudo e prática nesta semana`, h`<button class="btn ghost" data-act="new:courses">Formulário completo</button>`)}
      ${App.quick('courses')}
      ${S.courses.length ? h`<div class="toolbar"><input type="search" data-f="q" value="${v.q}" placeholder="Buscar cursos" aria-label="Buscar cursos">
        ${H.sel('tool', App.opt.tools(), v.tool, 'Todas as ferramentas')}${H.sel('category', App.opt.lcats(), v.category, 'Todas as categorias')}
        ${H.sel('status', U.COURSE_STATUSES, v.status, 'Todos os status')}${H.sel('priority', U.PRIORITIES, v.priority, 'Todas as prioridades')}
        <label class="check small"><input type="checkbox" data-f="archived"${v.archived ? U.raw(' checked') : ''}> Mostrar arquivados</label></div>` : ''}
      ${!S.courses.length ? U.empty('Nenhum curso ainda', 'Escreva o nome de um curso no campo acima. Depois, registre o progresso e use “Estudar agora” para cronometrar o estudo.')
        : !list.length ? U.empty('Nenhum curso com estes filtros', 'Ajuste a busca ou os filtros.')
        : groups.map(([st, label]) => { const g = list.filter(c => c.status === st); return g.length ? h`<section class="group"><h2 class="group-title">${label} <span class="muted">${g.length}</span></h2><div class="cards">${g.map(courseCard)}</div></section>` : ''; })}`;
    },
    act(act, [a]) {
      if (act === 'study') App.startSession({ courseId: a });
      if (act === 'course-progress') App.courseProgress(a);
      if (act === 'course-task') { const c = St.get('courses', a); if (c) App.edit('tasks', null, { title: 'Estudar: ' + c.name + (c.nextActivity ? ' — ' + c.nextActivity : ''), courseId: c.id, estimateH: 1, priority: c.priority || 'medium' }); }
    },
    change: e => H.filterChange(e, 'courses', CDEF), input: e => H.filterInput(e, 'courses', CDEF),
  };

  // ================= BIBLIOTECA =================
  const BDEF = { q: '', tool: '', category: '', type: '', status: '', fav: false, sort: 'created', mode: 'cards' };
  function filteredResources(v) {
    const q = H.norm(v.q);
    const by = { created: (a, b) => b.created - a.created, updated: (a, b) => b.updated - a.updated, name: (a, b) => a.title.localeCompare(b.title) };
    // sem filtro de status, a lista esconde os arquivados
    const statusOk = r => v.status === 'all' || (v.status ? r.status === v.status : r.status !== 'archived');
    return S.resources.filter(r => statusOk(r)
      && (!q || H.norm([r.title, r.description, r.summary, r.notes, r.type, r.tool, r.category, r.url, ...(r.tags || [])].join(' ')).includes(q))
      && (!v.tool || r.tool === v.tool) && (!v.category || r.category === v.category) && (!v.type || r.type === v.type)
      && (!v.fav || r.favorite))
      .sort(by[v.sort] || by.created);
  }
  function resActions(r) {
    return h`<button class="icon-btn" data-act="res-fav:${r.id}" aria-pressed="${!!r.favorite}" title="${r.favorite ? 'Tirar dos favoritos' : 'Favoritar'}" aria-label="${r.favorite ? 'Tirar dos favoritos' : 'Favoritar'}">${icon('star')}</button>
      ${M.isUrl(r.url || '') ? h`<a class="icon-btn" href="${r.url}" target="_blank" rel="noopener noreferrer" title="Abrir link" aria-label="Abrir link de ${r.title}">${icon('link')}</a>` : ''}
      <button class="btn small ghost" data-act="res-note:${r.id}">Anotar</button>
      ${Views.pratica ? h`<button class="btn small ghost" data-act="res-exercise:${r.id}">Praticar</button>` : ''}
      <button class="btn small ghost" data-act="res-link:${r.id}">${r.projectId ? 'Trocar demanda' : 'Vincular a demanda'}</button>`;
  }
  const resMeta = r => [r.tool, r.category, r.level ? U.label(U.LEVELS, r.level) : '', r.courseId && 'Curso: ' + cname(r.courseId), r.projectId && 'Demanda: ' + H.pname(r.projectId)].filter(Boolean).join(' · ');
  Views.biblioteca = {
    render() {
      const v = H.vs('library', BDEF), list = filteredResources(v);
      const tone = { new: '', studying: 'blue', consulted: 'good', archived: 'muted' };
      const body = !S.resources.length ? U.empty('Biblioteca vazia', 'Cole um link ou escreva o título de um tutorial, artigo, vídeo ou atalho no campo acima e aperte Enter.')
        : !list.length ? U.empty('Nada encontrado', 'Ajuste a busca ou os filtros.')
        : v.mode === 'list' ? h`<div class="table-wrap"><table class="table"><thead><tr><th>Material</th><th>Tipo</th><th>Ferramenta</th><th>Status</th><th>Avaliação</th><th></th></tr></thead><tbody>${list.map(r => h`<tr><td><button class="title-btn" data-act="edit:resources:${r.id}">${r.favorite ? icon('star', 'sm fav') : ''}${r.title}</button>${(r.tags || []).length ? h`<div class="small muted">${r.tags.map(t => '#' + t).join(' ')}</div>` : ''}</td><td class="small">${r.type}</td><td class="small">${r.tool || '—'}</td><td>${U.badge(U.label(U.RESOURCE_STATUSES, r.status), tone[r.status])}</td><td>${stars(Number(r.rating))}</td><td class="row-actions">${resActions(r)}</td></tr>`)}</tbody></table></div>`
        : h`<div class="cards">${list.map(r => h`<article class="card resource">
            <header><button class="title-btn" data-act="edit:resources:${r.id}">${r.title}</button>${U.badge(r.type, 'muted')}</header>
            <p class="small muted">${resMeta(r) || 'Sem ferramenta ou categoria'}</p>
            ${r.summary || r.description ? h`<p class="small clamp pre">${r.summary || r.description}</p>` : ''}
            <div class="row small">${U.badge(U.label(U.RESOURCE_STATUSES, r.status), tone[r.status])}${stars(Number(r.rating))}${(r.tags || []).map(t => h`<button class="tag" data-act="lib-tag:${t}">#${t}</button>`)}</div>
            <footer class="card-actions">${resActions(r)}</footer></article>`)}</div>`;
      return h`${App.page('Biblioteca', `${S.resources.filter(r => r.status !== 'archived').length} materiais · ${S.resources.filter(r => r.favorite).length} favoritos`, h`<button class="btn ghost" data-act="new:resources">Formulário completo</button>`)}
      ${App.quick('resources')}
      ${S.resources.length ? h`<div class="toolbar"><input type="search" data-f="q" value="${v.q}" placeholder="Buscar em títulos, resumos, anotações e etiquetas" aria-label="Buscar na biblioteca">
        ${H.sel('type', U.RESOURCE_TYPES.map(t => [t, t]), v.type, 'Todos os tipos')}${H.sel('tool', App.opt.tools(), v.tool, 'Todas as ferramentas')}${H.sel('category', App.opt.lcats(), v.category, 'Todas as categorias')}
        ${H.sel('status', [...U.RESOURCE_STATUSES.filter(x => x[0] !== 'archived'), ['all', 'Todos, inclusive arquivados'], ['archived', 'Só arquivados']], v.status, 'Ativos (não arquivados)')}
        ${H.sel('sort', [['created', 'Mais recentes'], ['updated', 'Atualizados por último'], ['name', 'Nome']], v.sort, 'Ordenar')}
        <label class="check small"><input type="checkbox" data-f="fav"${v.fav ? U.raw(' checked') : ''}> Só favoritos</label>
        <span class="grow"></span>${H.seg('library', [['cards', 'Cards', 'grid'], ['list', 'Lista', 'list']], v.mode)}</div>` : ''}
      ${body}`;
    },
    async act(act, [a, b]) {
      const r = St.get('resources', a);
      if (act === 'mode') { H.vs('library', BDEF).mode = b; H.savePref('library', { mode: b }); App.render(); }
      if (act === 'lib-tag') { H.vs('library', BDEF).q = a; App.render(); }
      if (!r) return;
      if (act === 'res-fav') try { await St.save('resources', { ...r, favorite: !r.favorite }, { quiet: true }); } catch (e) { U.fail(e); }
      if (act === 'res-note') App.edit('notes', null, { title: 'Sobre: ' + r.title, body: [r.summary, M.isUrl(r.url || '') ? r.url : ''].filter(Boolean).join('\n\n'), kind: 'Ideia', tags: r.tags || [], projectId: r.projectId || '' });
      if (act === 'res-exercise' && App.newExerciseFrom) App.newExerciseFrom({ resourceId: r.id });
      if (act === 'res-link') U.form({
        title: 'Vincular a uma demanda', submit: 'Vincular', value: { projectId: r.projectId || '' },
        fields: [{ k: 'projectId', label: 'Demanda', type: 'select', options: App.opt.projects, full: true, hint: 'Deixe vazio para tirar o vínculo.' }],
        onSave: async v => { await St.save('resources', { ...r, projectId: v.projectId || null }, { verb: v.projectId ? 'vinculado a uma demanda' : 'desvinculado' }); U.toast(v.projectId ? 'Material vinculado à demanda.' : 'Vínculo removido.', 'good'); },
      });
    },
    change: e => H.filterChange(e, 'library', BDEF), input: e => H.filterInput(e, 'library', BDEF),
  };
})();
