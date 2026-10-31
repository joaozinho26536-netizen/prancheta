// Prática (Laboratório Criativo): exercícios, evidências, avaliação por critérios e evolução.
(function () {
  'use strict';
  const M = window.Model, U = window.UI, St = window.Store, S = St.S, App = window.App;
  const { h, icon } = U;
  const Views = window.Views, H = Views.helpers;
  const now = () => Date.now(), today = () => M.isoDate(now());
  const EX_STATUSES = [['planned', 'Planejado'], ['doing', 'Em andamento'], ['review', 'Aguardando avaliação'], ['done', 'Concluído']];
  U.EX_STATUSES = EX_STATUSES;
  const rname = id => (St.get('resources', id) || {}).title;
  const cname = id => (St.get('courses', id) || {}).name;
  const fmtScore = v => v == null ? '—' : String(Math.round(v * 10) / 10).replace('.', ',');

  App.FORMS.exercises = {
    title: 'exercício', fields: () => [
      { k: 'title', label: 'Título', required: true, full: true },
      { k: 'status', label: 'Status', type: 'select', required: true, options: EX_STATUSES },
      { k: 'level', label: 'Nível', type: 'select', options: U.LEVELS },
      { k: 'tool', label: 'Ferramenta', type: 'select', options: App.opt.tools }, { k: 'technique', label: 'Técnica estudada', hint: 'Ex.: máscara de recorte, kerning, grid modular.' },
      { k: 'description', label: 'Desafio', type: 'textarea', full: true, rows: 2 },
      { k: 'goal', label: 'Objetivo técnico', type: 'textarea', full: true, rows: 2 },
      { k: 'resourceId', label: 'Material de origem', type: 'select', options: App.opt.resources }, { k: 'courseId', label: 'Curso de origem', type: 'select', options: App.opt.courses },
      { k: 'plannedDate', label: 'Data planejada', type: 'date' },
      { k: 'estimateMin', label: 'Tempo estimado (min)', type: 'number', step: '5' },
      { k: 'extraMin', label: 'Tempo fora do cronômetro (min)', type: 'number', step: '5', hint: 'Somado às sessões de prática cronometradas.' },
      { k: 'criteria', label: 'Critérios de avaliação deste exercício', type: 'textarea', full: true, rows: 2, hint: 'O que precisa estar certo para considerar concluído.' },
      { k: 'difficulties', label: 'Dificuldades', type: 'textarea', full: true, rows: 2 },
      { k: 'result', label: 'Resultado obtido', type: 'textarea', full: true, rows: 2 },
      { k: 'nextSteps', label: 'Próximos passos', type: 'textarea', full: true, rows: 2 },
      { k: 'resultUrl', label: 'Link do resultado (portfólio, Behance, Drive…)', type: 'url', full: true },
      { k: 'evidence', label: 'Outras evidências (links)', type: 'lines', full: true, hint: 'Links completos (https://…), um por linha.' },
      { k: 'filePath', label: 'Caminho do arquivo no computador', full: true, hint: 'Só anotação: o navegador não abre arquivos do seu disco sozinho.' },
      { k: 'image', label: 'Imagem do resultado (opcional)', type: 'image', full: true, hint: 'Fica reduzida a 900 px dentro do navegador e entra no backup. Para arquivos grandes, prefira um link.' },
      { k: 'refsText', label: 'Referências', type: 'textarea', full: true, rows: 2 },
      { k: 'portfolio', type: 'checkbox', text: 'Considerar para o portfólio', full: true },
    ], defaults: () => ({ status: 'planned', evidence: [], scores: [] }),
    check: v => { const bad = (v.evidence || []).filter(x => !M.isUrl(x)); return bad.length ? { evidence: 'Link inválido: ' + bad[0] } : null; },
    before(rec, old) { rec.completedAt = rec.status === 'done' ? (old && old.completedAt) || now() : null; if (rec.status === 'doing' && !rec.plannedDate) rec.plannedDate = today(); },
  };

  // exercício a partir de um material ou curso: pré-preenche, você revisa e salva
  App.newExerciseFrom = function ({ resourceId, courseId }) {
    const r = resourceId && St.get('resources', resourceId), c = courseId && St.get('courses', courseId);
    App.edit('exercises', null, { title: 'Praticar: ' + ((r && r.title) || (c && c.name) || ''), tool: (r && r.tool) || (c && c.tool) || '', level: (r && r.level) || (c && c.level) || '', resourceId: resourceId || '', courseId: courseId || (r && r.courseId) || '' });
  };

  // avaliação por critério (1 a 5) com observação; editável a qualquer momento
  App.evaluateExercise = function (id) {
    const x = St.get('exercises', id); if (!x) return;
    const crit = S.settings.evalCriteria || M.DEFAULT_SETTINGS.evalCriteria;
    const prev = Object.fromEntries((x.scores || []).map(s => [s.criterion, s]));
    const fields = crit.flatMap((c, i) => [
      { k: 's' + i, label: c, type: 'select', options: [['5', '5 · excelente'], ['4', '4 · bom'], ['3', '3 · razoável'], ['2', '2 · fraco'], ['1', '1 · precisa refazer']] },
      { k: 'n' + i, label: 'Observação sobre ' + c.toLowerCase() },
    ]);
    const value = Object.fromEntries(crit.flatMap((c, i) => [['s' + i, prev[c] ? String(prev[c].score) : ''], ['n' + i, prev[c] ? prev[c].note : '']]));
    U.form({
      title: 'Avaliar: ' + x.title, submit: 'Salvar avaliação', fields, value: { ...value, toDone: x.status === 'review' },
      extra: h`<p class="small muted pad">Deixe em branco o que não se aplica. As notas são suas, para comparar sua evolução; a Prancheta não atribui nível profissional.</p>`,
      onSave: async v => {
        const scores = crit.map((c, i) => ({ criterion: c, score: v['s' + i] ? Number(v['s' + i]) : '', note: v['n' + i] })).filter(s => s.score !== '' || s.note);
        const rec = { ...x, scores, evaluatedAt: scores.some(s => s.score) ? now() : x.evaluatedAt || null };
        if (x.status === 'review' && scores.some(s => s.score)) rec.status = 'done';
        App.FORMS.exercises.before(rec, x);
        await St.save('exercises', rec, { verb: 'avaliado' });
        U.toast('Avaliação salva.', 'good');
      },
    });
  };

  const XDEF = { q: '', tool: '', status: '', portfolio: false };
  function card(x) {
    const ms = M.exerciseMs(S, x, now()), avg = M.avgScore(x), late = x.status !== 'done' && x.plannedDate && x.plannedDate < today();
    const tone = { planned: '', doing: 'blue', review: 'warn', done: 'good' }[x.status];
    const links = [x.resultUrl, ...(x.evidence || [])].filter(l => M.isUrl(l || ''));
    return h`<article class="card exercise ${late ? 'is-late' : ''}">
      ${M.isImageData(x.image || '') ? h`<button class="ref-img" data-act="edit:exercises:${x.id}"><img src="${x.image}" alt="Resultado de ${x.title}" loading="lazy"></button>` : ''}
      <header><button class="title-btn" data-act="edit:exercises:${x.id}">${x.title}</button>${U.badge(U.label(EX_STATUSES, x.status), tone)}</header>
      <p class="small muted">${[x.tool, x.technique, x.level ? U.label(U.LEVELS, x.level) : ''].filter(Boolean).join(' · ') || 'Sem ferramenta ou técnica'}</p>
      ${x.resourceId || x.courseId ? h`<p class="small muted">${icon('book', 'sm')}${[rname(x.resourceId), cname(x.courseId)].filter(Boolean).join(' · ')}</p>` : ''}
      <dl class="facts">
        <div><dt>Tempo</dt><dd>${U.fmtDur(ms)}${x.estimateMin ? ' de ' + U.fmtDur(x.estimateMin * M.MIN) : ''}</dd></div>
        <div><dt>${x.status === 'done' ? 'Concluído' : 'Planejado'}</dt><dd class="${late ? 'txt-bad' : ''}">${x.status === 'done' && x.completedAt ? U.fmtDate(M.isoDate(x.completedAt)) : x.plannedDate ? U.fmtDate(x.plannedDate) : '—'}</dd></div>
        <div><dt>Avaliação</dt><dd>${avg == null ? 'não avaliado' : fmtScore(avg) + ' de 5'}</dd></div>
      </dl>
      ${x.portfolio ? h`<p class="small">${U.badge('Portfólio', 'good')}</p>` : ''}
      ${links.length ? h`<ul class="links small">${links.map(l => h`<li><a href="${l}" target="_blank" rel="noopener noreferrer">${icon('link', 'sm')}${l.replace(/^https?:\/\//, '')}</a></li>`)}</ul>` : ''}
      <footer class="card-actions">
        ${x.status !== 'done' ? h`<button class="btn small" data-act="practice:${x.id}">${icon('play')} Praticar agora</button>` : ''}
        <button class="btn small ghost" data-act="evaluate:${x.id}">${avg == null ? 'Avaliar' : 'Rever avaliação'}</button>
        ${x.status === 'doing' ? h`<button class="btn small ghost" data-act="ex-review:${x.id}">Enviar para avaliação</button>` : ''}
      </footer></article>`;
  }

  Views.pratica = {
    render() {
      const v = H.vs('practice', XDEF), q = H.norm(v.q), t = now();
      const all = S.exercises.filter(x => !x.archived);
      const list = all.filter(x => (!q || H.norm([x.title, x.description, x.goal, x.technique, x.tool, x.result, x.difficulties].join(' ')).includes(q)) && (!v.tool || x.tool === v.tool) && (!v.status || x.status === v.status) && (!v.portfolio || x.portfolio))
        .sort((a, b) => (a.plannedDate || '9').localeCompare(b.plannedDate || '9') || b.updated - a.updated);
      const done = all.filter(x => x.status === 'done');
      const practiceMs = all.reduce((s, x) => s + M.exerciseMs(S, x, t), 0);
      const techniques = [...new Set(all.map(x => (x.technique || '').trim()).filter(Boolean))];
      const tools = Object.entries(all.reduce((o, x) => (x.tool && (o[x.tool] = (o[x.tool] || 0) + 1), o), {})).sort((a, b) => b[1] - a[1]);
      const evo = M.scoreEvolution(all);
      const groups = [['doing', 'Em andamento'], ['review', 'Aguardando avaliação'], ['planned', 'Planejados'], ['done', 'Concluídos']];
      return h`${App.page('Prática', 'Laboratório criativo: transforme o que você estudou em habilidade', h`<button class="btn ghost" data-act="new:exercises">Formulário completo</button>`)}
      ${App.quick('exercises')}
      ${all.length ? h`<section class="panel"><header class="panel-head"><h2>Evolução</h2><span class="muted">a partir dos seus registros</span></header>
        <div class="stats-panel inner flat">
          <div class="stat"><span class="stat-label">Exercícios concluídos</span><span class="stat-value">${done.length}</span><span class="stat-hint">de ${all.length}</span></div>
          <div class="stat"><span class="stat-label">Horas de prática</span><span class="stat-value">${U.fmtDur(practiceMs)}</span></div>
          <div class="stat"><span class="stat-label">Técnicas estudadas</span><span class="stat-value">${techniques.length}</span><span class="stat-hint">${techniques.slice(0, 3).join(', ')}</span></div>
          <div class="stat"><span class="stat-label">Ferramentas</span><span class="stat-value">${tools.length}</span><span class="stat-hint">${tools.slice(0, 3).map(([n, c]) => n.replace('Adobe ', '') + ' (' + c + ')').join(', ')}</span></div>
          <div class="stat"><span class="stat-label">Para o portfólio</span><span class="stat-value">${all.filter(x => x.portfolio).length}</span></div>
          <div class="stat"><span class="stat-label">Aguardando avaliação</span><span class="stat-value">${all.filter(x => x.status === 'review').length}</span></div>
        </div>
        <h3>Média das avaliações por mês</h3>
        ${evo ? U.bars(evo.map(e => ({ label: e.month.slice(5) + '/' + e.month.slice(2, 4), value: e.avg })), { fmt: v => fmtScore(v) + ' de 5', height: 150 }) : h`<p class="muted small">Avalie ao menos 3 exercícios, em 2 meses diferentes, para ver a evolução. Com menos que isso, um gráfico mais confundiria que ajudaria.</p>`}
      </section>` : ''}
      ${all.length ? h`<div class="toolbar"><input type="search" data-f="q" value="${v.q}" placeholder="Buscar exercícios" aria-label="Buscar exercícios">${H.sel('tool', App.opt.tools(), v.tool, 'Todas as ferramentas')}${H.sel('status', EX_STATUSES, v.status, 'Todos os status')}<label class="check small"><input type="checkbox" data-f="portfolio"${v.portfolio ? U.raw(' checked') : ''}> Só portfólio</label></div>` : ''}
      ${!all.length ? U.empty('Nenhum exercício ainda', 'Escreva um desafio no campo acima, ou use “Praticar” num material da Biblioteca. Pratique com o cronômetro, registre o resultado e avalie.')
        : !list.length ? U.empty('Nada com estes filtros', 'Ajuste a busca ou os filtros.')
        : groups.map(([st, label]) => { const g = list.filter(x => x.status === st); return g.length ? h`<section class="group"><h2 class="group-title">${label} <span class="muted">${g.length}</span></h2><div class="cards">${g.map(card)}</div></section>` : ''; })}`;
    },
    async act(act, [a]) {
      if (act === 'practice') App.startSession({ exerciseId: a });
      if (act === 'evaluate') App.evaluateExercise(a);
      if (act === 'ex-review') { const x = St.get('exercises', a); if (x) try { await St.save('exercises', { ...x, status: 'review' }, { verb: 'enviado para avaliação' }); } catch (e) { U.fail(e); } }
    },
    change: e => H.filterChange(e, 'practice', XDEF), input: e => H.filterInput(e, 'practice', XDEF),
  };
})();
