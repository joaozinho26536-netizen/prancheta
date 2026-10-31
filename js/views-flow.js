// Fluxos de trabalho e checklists: modelos reutilizáveis (workflows) e execuções por demanda (runs).
// A execução guarda uma CÓPIA das etapas: editar o modelo depois não muda trabalhos já começados.
(function () {
  'use strict';
  const M = window.Model, U = window.UI, St = window.Store, S = St.S, App = window.App;
  const { h, icon } = U;
  const Views = window.Views, H = Views.helpers;
  const now = () => Date.now(), today = () => M.isoDate(now());
  const minText = m => m ? U.fmtDur(m * M.MIN) : '—';

  // ---------- modelos iniciais (exemplos editáveis, só entram se você pedir) ----------
  function starter() {
    const step = (title, estimateMin, items, extra = {}) => ({ id: M.uid(), title, estimateMin, instructions: '', criteria: '', optional: false, dependsOn: null, items: items.map(t => ({ id: M.uid(), text: t, required: true })), ...extra });
    const link = steps => steps.map((s, i) => i ? { ...s, dependsOn: steps[i - 1].id } : s);
    const base = { starter: true, version: 1, archived: false, notes: '' };
    return [
      { ...base, name: 'Peça publicitária digital', kind: 'fluxo', category: 'Peças publicitárias', tool: 'Adobe Photoshop', tools: ['Adobe Illustrator'], description: 'Do briefing à aprovação de uma peça para redes, site ou mídia digital.', criteria: 'Arquivos exportados conferidos e enviados para revisão, com o feedback registrado.',
        steps: link([step('Briefing', 15, ['Conferir o briefing', 'Confirmar objetivo e público', 'Conferir dimensões e formato']), step('Preparação', 20, ['Separar referências e materiais', 'Definir hierarquia visual']),
          step('Produção', 90, ['Produzir a composição']), step('Revisão interna', 15, ['Conferir tipografia, cores e alinhamentos', 'Verificar legibilidade em diferentes tamanhos']),
          step('Exportação', 10, ['Exportar nos formatos solicitados', 'Conferir os arquivos exportados']), step('Aprovação', 10, ['Enviar para revisão', 'Registrar feedback e alterações'])]) },
      { ...base, name: 'Material para impressão', kind: 'fluxo', category: 'Materiais impressos', tool: 'Adobe InDesign', tools: ['Adobe Illustrator', 'Adobe Photoshop', 'Adobe Acrobat'],
        description: 'Fechamento de arquivo para gráfica. Sangria, resolução, perfil de cor e formato vêm das especificações da gráfica e do projeto: o modelo só lembra de conferir.', criteria: 'PDF revisado de acordo com as especificações recebidas e aprovação registrada.',
        steps: link([step('Especificações', 15, ['Conferir briefing e especificações da gráfica', 'Confirmar dimensões e sangria pedidas']),
          step('Conferência do arquivo', 30, ['Conferir resolução e qualidade das imagens', 'Verificar cores e perfil exigidos', 'Conferir fontes e elementos vinculados', 'Revisar margens e áreas de segurança', 'Conferir textos e informações']),
          step('Fechamento', 20, ['Exportar de acordo com as especificações recebidas', 'Revisar o PDF exportado', 'Registrar a aprovação e a entrega'])]) },
      { ...base, name: 'Tratamento de imagem', kind: 'fluxo', category: 'Edição e tratamento de imagens', tool: 'Adobe Photoshop', tools: ['Adobe Lightroom'], description: 'Tratamento preservando o original.', criteria: 'Versão final conferida e exportada no formato adequado.',
        steps: link([step('Preparação', 10, ['Conferir o material original', 'Duplicar ou preservar o original', 'Definir o objetivo do tratamento']),
          step('Tratamento', 45, ['Executar ajustes', 'Conferir recortes e proporções', 'Avaliar cores e detalhes']), step('Finalização', 15, ['Revisar o resultado', 'Exportar no formato adequado', 'Conferir a versão final'])]) },
      { ...base, name: 'Checklist de entrega', kind: 'checklist', category: '', tool: '', tools: [], description: 'Conferência rápida antes de enviar qualquer arquivo.', criteria: '',
        steps: [step('Antes de enviar', 10, ['Revisar ortografia e informações', 'Conferir nome do arquivo e versão', 'Conferir formato e tamanho pedidos', 'Registrar o envio em Revisões'])] },
    ];
  }

  // ---------- aplicar um modelo a uma demanda ----------
  async function createRun(tpl, project, { withTasks, distribute }) {
    const run = { ...M.instantiateRun(tpl, project.id, now()), id: M.uid() };
    if (withTasks) {
      const dues = distribute && project.due ? M.distributeDue(run.steps.length, today(), project.due) : [];
      for (const [i, s] of run.steps.entries()) {
        const t = await St.save('tasks', { title: s.title, projectId: project.id, clientId: project.clientId || null, status: 'todo', priority: project.priority || 'medium', due: dues[i] || '', estimateH: s.estimateMin ? Math.round(s.estimateMin / 15) / 4 : '', description: [s.instructions, s.items.map(x => '• ' + x.text).join('\n')].filter(Boolean).join('\n\n'), checklist: [], runId: run.id, stepId: s.id, completedAt: null }, { verb: 'criada pelo fluxo' });
        s.taskId = t.id;
      }
    }
    return St.save('runs', run, { verb: 'aplicado à demanda' });
  }
  function templateOptions(project) {
    return S.workflows.filter(w => !w.archived).sort((a, b) => (b.category === (project && project.category)) - (a.category === (project && project.category)) || a.name.localeCompare(b.name))
      .map(w => [w.id, w.name + (project && w.category && w.category === project.category ? ' (sugerido para esta categoria)' : '') + (w.kind === 'checklist' ? ' · checklist' : '')]);
  }
  App.applyWorkflow = function (projectId, templateId) {
    const p = St.get('projects', projectId); if (!p) return;
    if (!S.workflows.some(w => !w.archived)) return U.toast('Nenhum modelo ativo. Crie um em Fluxos ou adicione os modelos iniciais.', 'warn', 6000, { label: 'Abrir Fluxos', fn: () => App.go('fluxos') });
    U.form({
      title: 'Aplicar fluxo ou checklist', submit: 'Aplicar', value: { templateId: templateId || '' },
      fields: [
        { k: 'templateId', label: 'Modelo', type: 'select', required: true, options: () => templateOptions(p), full: true },
        { k: 'withTasks', type: 'checkbox', full: true, text: 'Criar também uma tarefa para cada etapa (opcional: sem isso, você acompanha as etapas aqui mesmo)' },
        ...(p.due ? [{ k: 'distribute', type: 'checkbox', full: true, text: `Distribuir os prazos das tarefas de hoje até a entrega (${U.fmtDate(p.due)})` }] : []),
      ],
      check: v => !v.templateId ? { templateId: 'Escolha um modelo.' } : null,
      onSave: async v => {
        const tpl = St.get('workflows', v.templateId);
        if (S.runs.some(r => r.projectId === p.id && r.templateId === tpl.id && r.status === 'active') && !await U.ask({ title: 'Este fluxo já está ativo nesta demanda', text: 'Aplicar de novo cria uma segunda cópia das etapas. Continuar?', ok: 'Aplicar de novo' })) throw Object.assign(new Error(''), { cancelled: true });
        if (v.withTasks && v.distribute) {
          const dues = M.distributeDue(tpl.steps.length, today(), p.due);
          if (!await U.ask({ title: 'Conferir os prazos das tarefas', text: tpl.steps.map((s, i) => `${s.title}: ${U.fmtDate(dues[i])}`).join(' · ') + '. Nenhum prazo existente será alterado.', ok: 'Criar com estes prazos' })) throw Object.assign(new Error(''), { cancelled: true });
        }
        await createRun(tpl, p, v);
        U.toast(`“${tpl.name}” aplicado${v.withTasks ? ' com ' + tpl.steps.length + ' tarefa(s)' : ''}.`, 'good');
      },
    });
  };
  // nova demanda já com o modelo: você revisa os dados antes de criar
  App.newProjectFromTemplate = function () {
    if (!S.workflows.some(w => !w.archived)) return U.toast('Nenhum modelo ativo. Crie um em Fluxos ou adicione os modelos iniciais.', 'warn', 6000, { label: 'Abrir Fluxos', fn: () => App.go('fluxos') });
    U.form({
      title: 'Nova demanda a partir de um modelo', submit: 'Revisar e criar',
      fields: [
        { k: 'templateId', label: 'Modelo', type: 'select', required: true, options: () => templateOptions(null), full: true },
        { k: 'name', label: 'Nome da demanda', required: true, full: true },
        { k: 'clientId', label: 'Solicitante', type: 'select', options: App.opt.clients }, { k: 'due', label: 'Prazo de entrega', type: 'date' },
        { k: 'withTasks', type: 'checkbox', full: true, text: 'Criar também uma tarefa para cada etapa' },
        { k: 'distribute', type: 'checkbox', full: true, text: 'Distribuir os prazos das tarefas até a entrega' },
      ],
      check: v => !v.templateId ? { templateId: 'Escolha um modelo.' } : v.due && v.due < today() ? { due: 'O prazo já passou.' } : null,
      onSave: async v => {
        const tpl = St.get('workflows', v.templateId), min = M.workflowMinutes(tpl.steps);
        const summary = [`Categoria: ${tpl.category || '—'}`, `Ferramentas: ${[tpl.tool, ...(tpl.tools || [])].filter(Boolean).join(', ') || '—'}`, `${tpl.steps.length} etapa(s), ${minText(min)} estimados`, v.withTasks ? `${tpl.steps.length} tarefa(s)` + (v.distribute && v.due ? ' com prazos até ' + U.fmtDate(v.due) : '') : 'sem tarefas'].join(' · ');
        if (!await U.ask({ title: 'Criar a demanda “' + v.name + '”?', text: summary, ok: 'Criar demanda' })) throw Object.assign(new Error(''), { cancelled: true });
        const F = App.FORMS.projects;
        const rec = { ...F.defaults(), name: v.name, clientId: v.clientId || '', due: v.due || '', category: tpl.category || '', estimateH: min ? Math.round(min / 15) / 4 : '', notes: [tpl.description, tpl.criteria && 'Critério de conclusão: ' + tpl.criteria].filter(Boolean).join('\n\n') };
        F.before(rec, null);
        const p = await St.save('projects', rec, { verb: 'criada por modelo' });
        await createRun(tpl, p, v);
        U.toast('Demanda criada com o fluxo “' + tpl.name + '”.', 'good');
        App.go('demanda/' + p.id);
      },
    });
  };
  // concluir a demanda com itens obrigatórios pendentes: avisa (não bloqueia)
  App.warnRunsOnDone = function (projectId) {
    const pend = S.runs.filter(r => r.projectId === projectId && r.status === 'active').flatMap(r => M.runProgress(r).requiredPending);
    if (pend.length) U.toast(`Atenção: ${pend.length} item(ns) obrigatório(s) do fluxo ainda pendente(s): ${pend.slice(0, 3).map(x => x.item).join('; ')}${pend.length > 3 ? '…' : ''}`, 'warn', 9000);
  };

  // ---------- painel de fluxos dentro da demanda ----------
  Views.flowPanel = function (p) {
    const runs = S.runs.filter(r => r.projectId === p.id).sort((a, b) => (a.status !== 'active') - (b.status !== 'active') || b.startedAt - a.startedAt);
    return h`<section class="panel"><header class="panel-head"><h2>Fluxos e checklists</h2><button class="btn small" data-act="wf-apply:${p.id}">${icon('flow')} Aplicar modelo</button></header>
      ${runs.length ? runs.map(runCard) : U.empty('Nenhum fluxo nesta demanda', 'Aplique um modelo para seguir as etapas e checklists sem esquecer nada.')}</section>`;
  };
  function runCard(run) {
    const pr = M.runProgress(run), byId = Object.fromEntries(run.steps.map(s => [s.id, s]));
    const tone = { active: 'blue', done: 'good', cancelled: 'muted' }[run.status], st = { active: 'Em andamento', done: 'Concluído', cancelled: 'Cancelado' }[run.status];
    const tpl = St.get('workflows', run.templateId);
    return h`<article class="run ${run.status !== 'active' ? 'closed' : ''}" data-run="${run.id}">
      <header class="run-head"><div><strong>${run.name}</strong> <span class="small muted">versão ${run.templateVersion}${tpl && tpl.version !== run.templateVersion ? ' (o modelo já está na versão ' + tpl.version + '; esta execução manteve a cópia original)' : ''}</span></div>${U.badge(st, tone)}</header>
      <div class="card-meter">${U.meter(pr.ratio, run.status === 'done' ? 'good' : '')}<span class="mono small">${pr.closed}/${pr.total} etapas</span></div>
      ${pr.requiredPending.length && run.status === 'active' ? h`<p class="small txt-warn">${pr.requiredPending.length} item(ns) obrigatório(s) pendente(s)</p>` : ''}
      <ol class="run-steps">${run.steps.map((s, i) => {
        const dep = s.dependsOn && byId[s.dependsOn], blocked = dep && dep.state !== 'done' && dep.state !== 'skipped' && s.state === 'pending';
        const task = s.taskId && St.get('tasks', s.taskId);
        return h`<li class="run-step st-${s.state}">
          <div class="run-step-head"><span class="step-n">${s.state === 'done' ? icon('check', 'sm') : i + 1}</span><span class="grow"><strong class="${s.state === 'skipped' ? 'done' : ''}">${s.title}</strong>${s.optional ? h` ${U.badge('opcional', 'muted')}` : ''}${s.estimateMin ? h` <span class="small muted">${minText(s.estimateMin)}</span>` : ''}</span>
            ${run.status === 'active' ? h`<span class="row">
              ${s.state === 'pending' ? h`<button class="btn small ghost" data-act="run-step:${run.id}:${s.id}:done">Concluir etapa</button>${s.optional ? h`<button class="btn small ghost" data-act="run-step:${run.id}:${s.id}:skipped">Pular</button>` : ''}` : h`<button class="btn small ghost" data-act="run-step:${run.id}:${s.id}:pending">Reabrir</button>`}
              ${task ? h`<button class="btn small ghost" data-act="edit:tasks:${task.id}">${icon('check', 'sm')}Tarefa${task.status === 'done' ? ' (concluída)' : ''}</button>` : h`<button class="btn small ghost" data-act="run-task:${run.id}:${s.id}">Criar tarefa</button>`}</span>` : ''}</div>
          ${blocked ? h`<p class="small muted">Depende de “${dep.title}”.</p>` : ''}
          ${s.instructions ? h`<p class="small pre">${s.instructions}</p>` : ''}
          ${s.items.length ? h`<ul class="checklist">${s.items.map(it => h`<li><label class="check"><input type="checkbox"${it.done ? U.raw(' checked') : ''}${run.status !== 'active' ? U.raw(' disabled') : ''} data-act="run-item:${run.id}:${s.id}:${it.id}"> <span class="${it.done ? 'done' : ''}">${it.text}</span>${it.required ? '' : h` <span class="small muted">(opcional)</span>`}</label></li>`)}</ul>` : ''}
          ${s.criteria ? h`<p class="small muted">Concluída quando: ${s.criteria}</p>` : ''}
          ${task && task.status === 'done' && s.state === 'pending' ? h`<p class="small txt-good">A tarefa desta etapa foi concluída. Confira os itens e conclua a etapa.</p>` : ''}
          <textarea class="run-note" rows="1" placeholder="Observações e pendências desta etapa" aria-label="Observações da etapa ${s.title}" data-run-note="${run.id}:${s.id}"${run.status !== 'active' ? U.raw(' readonly') : ''}>${s.note || ''}</textarea>
        </li>`;
      })}</ol>
      <footer class="row">${run.status === 'active' ? h`<button class="btn small primary" data-act="run-status:${run.id}:done">Concluir fluxo</button><button class="btn small ghost" data-act="run-status:${run.id}:cancelled">Cancelar fluxo</button>` : h`<button class="btn small ghost" data-act="run-status:${run.id}:active">Retomar</button>`}<span class="grow"></span><button class="btn small danger ghost" data-act="del:runs:${run.id}">Excluir</button></footer>
    </article>`;
  }
  async function saveRun(run, verb) { try { await St.save('runs', run, verb ? { verb } : { quiet: true }); } catch (e) { U.fail(e); } }
  async function runAct(act, [runId, stepId, x]) {
    const run = St.get('runs', runId);
    if (act === 'wf-apply') return App.applyWorkflow(runId);
    if (!run) return;
    if (act === 'run-item') return saveRun(M.toggleRunItem(run, stepId, x));
    if (act === 'run-step') return saveRun(M.setStepState(run, stepId, x));
    if (act === 'run-task') {
      const s = run.steps.find(z => z.id === stepId), p = St.get('projects', run.projectId);
      if (!s || s.taskId) return;
      const t = await St.save('tasks', { ...App.FORMS.tasks.defaults(), title: s.title, projectId: run.projectId, clientId: p && p.clientId || null, estimateH: s.estimateMin ? Math.round(s.estimateMin / 15) / 4 : '', description: [s.instructions, s.items.map(i => '• ' + i.text).join('\n')].filter(Boolean).join('\n\n'), runId: run.id, stepId: s.id, completedAt: null }, { verb: 'criada pelo fluxo' });
      await saveRun({ ...run, steps: run.steps.map(z => z.id === stepId ? { ...z, taskId: t.id } : z) });
      U.toast('Tarefa criada para a etapa “' + s.title + '”.', 'good');
    }
    if (act === 'run-status') {
      x = stepId; // run-status:<execução>:<novo status>
      if (!['done', 'cancelled', 'active'].includes(x)) return;
      if (x === 'done') {
        const pr = M.runProgress(run);
        if ((pr.requiredPending.length || pr.stepsPending.length) && !await U.ask({ title: 'Concluir com pendências?', text: [pr.stepsPending.length && 'Etapas abertas: ' + pr.stepsPending.join(', '), pr.requiredPending.length && 'Itens obrigatórios: ' + pr.requiredPending.map(p => p.item).join('; ')].filter(Boolean).join('. ') + '.', ok: 'Concluir mesmo assim' })) return;
      }
      if (x === 'cancelled' && !await U.ask({ title: 'Cancelar este fluxo?', text: 'As marcações ficam guardadas e você pode retomá-lo depois.', ok: 'Cancelar fluxo' })) return;
      return saveRun({ ...run, status: x, closedAt: x === 'active' ? null : now() }, { done: 'concluído', cancelled: 'cancelado', active: 'retomado' }[x]);
    }
  }
  // observações das etapas: salvam ao sair do campo
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-run-note]'); if (!el) return;
    const [runId, stepId] = el.dataset.runNote.split(':'), run = St.get('runs', runId);
    if (run) saveRun({ ...run, steps: run.steps.map(s => s.id === stepId ? { ...s, note: el.value } : s) });
  });
  // a página da demanda e a de fluxos tratam estas ações
  const RUN_ACTS = ['wf-apply', 'run-item', 'run-step', 'run-task', 'run-status'];
  for (const v of ['demanda', 'fluxos']) { const prev = Views[v] && Views[v].act; if (Views[v]) Views[v].act = (act, args, el, e) => RUN_ACTS.includes(act) ? runAct(act, args, el) : prev && prev(act, args, el, e); }

  // ---------- página de fluxos: modelos e execuções em andamento ----------
  Views.fluxos = Object.assign(Views.fluxos || {}, {
    render() {
      const v = H.vs('flows', { archived: false });
      const list = S.workflows.filter(w => v.archived || !w.archived).sort((a, b) => a.name.localeCompare(b.name));
      const active = S.runs.filter(r => r.status === 'active').sort((a, b) => b.startedAt - a.startedAt);
      return h`${App.page('Fluxos de trabalho', 'Modelos de etapas e checklists que você aplica às demandas', h`<button class="btn" data-act="wf-new:checklist">${icon('check')} Novo checklist</button><button class="btn primary" data-act="wf-new:fluxo">${icon('plus')} Novo fluxo</button>`)}
      ${active.length ? h`<section class="panel"><header class="panel-head"><h2>Em andamento nas demandas</h2><span class="muted">${active.length}</span></header><ul class="rows">${active.map(r => { const pr = M.runProgress(r); return h`<li><button class="row-btn" data-act="go:demanda:${r.projectId}"><span class="grow"><span class="ellipsis block">${r.name} · ${H.pname(r.projectId) || 'demanda excluída'}</span>${U.meter(pr.ratio)}</span><span class="mono small">${pr.closed}/${pr.total}</span>${pr.requiredPending.length ? U.badge(pr.requiredPending.length + ' obrigatório(s)', 'warn') : ''}</button></li>`; })}</ul></section>` : ''}
      ${S.workflows.length ? h`<div class="toolbar"><label class="check small"><input type="checkbox" data-f="archived"${v.archived ? U.raw(' checked') : ''}> Mostrar arquivados</label></div>` : ''}
      ${!S.workflows.length ? h`<div class="empty"><p class="empty-title">Nenhum modelo ainda</p><p>Crie um fluxo com etapas e checklists, ou comece pelos modelos iniciais (peça digital, material para impressão, tratamento de imagem e checklist de entrega). Eles são exemplos editáveis.</p><div class="row"><button class="btn primary" data-act="wf-starter">Adicionar modelos iniciais</button><button class="btn" data-act="wf-new:fluxo">Criar do zero</button></div></div>`
        : h`<div class="cards">${list.map(w => { const min = M.workflowMinutes(w.steps), uses = S.runs.filter(r => r.templateId === w.id).length, items = w.steps.reduce((a, s) => a + (s.items || []).length, 0); return h`<article class="card wf">
            <header><button class="title-btn" data-act="go:fluxo:${w.id}">${w.name}</button>${w.archived ? U.badge('arquivado', 'muted') : w.starter ? U.badge('modelo inicial', 'muted') : U.badge(w.kind === 'checklist' ? 'checklist' : 'fluxo', 'blue')}</header>
            <p class="small muted">${[w.category, [w.tool, ...(w.tools || [])].filter(Boolean).map(t => t.replace('Adobe ', '')).join(', ')].filter(Boolean).join(' · ') || 'Sem categoria'}</p>
            ${w.description ? h`<p class="small clamp">${w.description}</p>` : ''}
            <dl class="facts"><div><dt>Etapas</dt><dd>${w.steps.length} · ${items} itens</dd></div><div><dt>Estimado</dt><dd>${minText(min)}</dd></div><div><dt>Versão</dt><dd>${w.version || 1} · usado ${uses}×</dd></div></dl>
            <footer class="card-actions"><button class="btn small" data-act="go:fluxo:${w.id}">Editar</button><button class="btn small ghost" data-act="wf-dup:${w.id}">Duplicar</button><button class="btn small ghost" data-act="archive:workflows:${w.id}">${w.archived ? 'Desarquivar' : 'Arquivar'}</button></footer>
          </article>`; })}</div>`}`;
    },
    async act(act, [a]) {
      if (act === 'wf-new') return App.go('fluxo/novo-' + a);
      if (act === 'wf-starter') {
        try { for (const w of starter()) await St.save('workflows', w, { verb: 'adicionado (modelo inicial)' }); U.toast('Modelos iniciais adicionados. Edite à vontade.', 'good'); } catch (e) { U.fail(e); }
      }
      if (act === 'wf-dup') {
        const w = St.get('workflows', a); if (!w) return;
        const map = {}; w.steps.forEach(s => { map[s.id] = M.uid(); });
        const copy = { name: w.name + ' (cópia)', kind: w.kind, category: w.category, tool: w.tool, tools: w.tools, description: w.description, criteria: w.criteria, notes: w.notes, version: 1, archived: false, starter: false,
          steps: w.steps.map(s => ({ ...s, id: map[s.id], dependsOn: s.dependsOn ? map[s.dependsOn] || null : null, items: (s.items || []).map(i => ({ ...i, id: M.uid() })) })) };
        try { const c = await St.save('workflows', copy, { verb: 'duplicado' }); App.go('fluxo/' + c.id); } catch (e) { U.fail(e); }
      }
    },
    change: e => H.filterChange(e, 'flows', { archived: false }),
  });
  { const prev = Views.fluxos.act; Views.fluxos.act = (act, args, el, e) => RUN_ACTS.includes(act) ? runAct(act, args, el) : prev(act, args, el, e); }

  // ---------- editor de modelo (#fluxo/<id> ou #fluxo/novo-fluxo / novo-checklist) ----------
  let dirty = false;
  App.leaveGuard = () => dirty && location.hash.slice(1).split('/')[0] !== 'fluxo';
  App.resetGuard = () => { dirty = false; };
  const blankStep = () => ({ id: M.uid(), title: '', instructions: '', estimateMin: '', optional: false, dependsOn: null, criteria: '', items: [] });
  const itemRow = it => h`<div class="wf-item" data-item-id="${it.id}"><input name="it-text" value="${it.text}" placeholder="Item do checklist" aria-label="Item do checklist"><label class="check small"><input type="checkbox" name="it-req"${it.required !== false ? U.raw(' checked') : ''}> obrigatório</label><button type="button" class="icon-btn" data-wf="del-item" aria-label="Remover item">${icon('x')}</button></div>`;
  const stepBlock = (s, i, prevId) => h`<section class="wf-step" data-step-id="${s.id}">
    <header><span class="step-n wf-num">${i + 1}</span><input name="st-title" value="${s.title}" placeholder="Título da etapa" aria-label="Título da etapa" required class="grow">
      <button type="button" class="icon-btn" data-wf="up" aria-label="Subir etapa" title="Subir">${icon('left', 'rot90')}</button><button type="button" class="icon-btn" data-wf="down" aria-label="Descer etapa" title="Descer">${icon('right', 'rot90')}</button><button type="button" class="icon-btn" data-wf="del-step" aria-label="Remover etapa" title="Remover etapa">${icon('trash')}</button></header>
    <div class="wf-grid"><label class="inline small">Tempo (min) <input name="st-min" type="number" min="0" step="5" value="${s.estimateMin}"></label>
      <label class="check small"><input type="checkbox" name="st-opt"${s.optional ? U.raw(' checked') : ''}> pode pular (opcional)</label>
      <label class="check small"><input type="checkbox" name="st-dep"${s.dependsOn && s.dependsOn === prevId ? U.raw(' checked') : ''}> depende da etapa anterior</label></div>
    <textarea name="st-inst" rows="2" placeholder="Instruções (o que fazer e onde, ex.: atalhos ou menus do aplicativo)" aria-label="Instruções">${s.instructions}</textarea>
    <input name="st-crit" value="${s.criteria}" placeholder="Critério de conclusão (opcional)" aria-label="Critério de conclusão">
    <div class="wf-items">${(s.items || []).map(itemRow)}</div>
    <button type="button" class="btn small ghost" data-wf="add-item">${icon('plus')} Item do checklist</button>
  </section>`;
  Views.fluxo = {
    render(id) {
      const isNew = !id || id.startsWith('novo');
      const w = isNew ? { name: '', kind: (id || '').endsWith('checklist') ? 'checklist' : 'fluxo', category: '', tool: '', tools: [], description: '', criteria: '', notes: '', steps: [{ ...blankStep(), title: (id || '').endsWith('checklist') ? 'Checklist' : '' }] } : St.get('workflows', id);
      if (!w) return U.empty('Modelo não encontrado', 'Ele pode ter sido excluído.', h`<a class="btn" href="#fluxos">Voltar para Fluxos</a>`);
      const uses = isNew ? 0 : S.runs.filter(r => r.templateId === w.id).length;
      return h`<nav class="crumbs"><a href="#fluxos">Fluxos</a> / <span>${w.name || 'Novo modelo'}</span></nav>
      ${App.page(isNew ? (w.kind === 'checklist' ? 'Novo checklist' : 'Novo fluxo') : w.name, isNew ? 'Etapas em ordem, cada uma com seu checklist' : `Versão ${w.version || 1} · usado em ${uses} demanda(s)`, isNew ? '' : h`<button class="btn danger ghost" data-act="del:workflows:${w.id}">${icon('trash')} Excluir</button>`)}
      ${uses ? h`<div class="notice">${icon('info')}<p>Alterar este modelo cria uma nova versão. As ${uses} demanda(s) que já usam este fluxo mantêm a cópia das etapas de quando ele foi aplicado.</p></div>` : ''}
      <form class="panel wf-editor" data-wf-id="${isNew ? '' : w.id}" data-kind="${w.kind || 'fluxo'}" novalidate>
        <div class="form-grid">
          <div class="field full"><label for="wf-name">Nome <span class="req">*</span></label><input id="wf-name" name="name" value="${w.name}" required></div>
          <div class="field"><label for="wf-cat">Tipo de trabalho (categoria)</label><select id="wf-cat" name="category"><option value="">—</option>${S.settings.categories.map(c => h`<option${c === w.category ? U.raw(' selected') : ''}>${c}</option>`)}</select><small class="hint">Ao aplicar, aparece como sugerido para demandas desta categoria.</small></div>
          <div class="field"><label for="wf-tool">Ferramenta principal</label><select id="wf-tool" name="tool"><option value="">—</option>${(S.settings.tools || []).map(c => h`<option${c === w.tool ? U.raw(' selected') : ''}>${c}</option>`)}</select></div>
          <div class="field full"><label for="wf-tools">Ferramentas complementares</label><input id="wf-tools" name="tools" value="${(w.tools || []).join(', ')}" placeholder="separe por vírgula"></div>
          <div class="field full"><label for="wf-desc">Descrição</label><textarea id="wf-desc" name="description" rows="2">${w.description}</textarea></div>
          <div class="field full"><label for="wf-crit">Critérios de conclusão</label><textarea id="wf-crit" name="criteria" rows="2">${w.criteria}</textarea></div>
          <div class="field full"><label for="wf-notes">Observações</label><textarea id="wf-notes" name="notes" rows="2">${w.notes}</textarea></div>
        </div>
        <h2 class="wf-title">Etapas <span class="muted small" data-wf-total></span></h2>
        <div class="wf-steps">${w.steps.map((s, i) => stepBlock(s, i, i ? w.steps[i - 1].id : null))}</div>
        <button type="button" class="btn" data-wf="add-step">${icon('plus')} Adicionar etapa</button>
        <p class="form-error" role="alert"></p>
        <footer class="row"><span class="grow"></span><a class="btn" href="#fluxos">Voltar</a><button class="btn primary">Salvar modelo</button></footer>
      </form>`;
    },
    mount(root) {
      dirty = false;
      const form = root.querySelector('.wf-editor'); if (!form) return;
      const steps = form.querySelector('.wf-steps');
      const renum = () => { steps.querySelectorAll('.wf-num').forEach((n, i) => { n.textContent = i + 1; }); const min = [...steps.querySelectorAll('[name=st-min]')].reduce((a, i) => a + (Number(i.value) || 0), 0); form.querySelector('[data-wf-total]').textContent = `${steps.children.length} etapa(s) · ${minText(min)}`; };
      renum();
      form.addEventListener('input', () => { dirty = true; renum(); });
      form.addEventListener('click', e => {
        const b = e.target.closest('[data-wf]'); if (!b) return;
        const sec = b.closest('.wf-step'); dirty = true;
        switch (b.dataset.wf) {
          case 'add-step': steps.insertAdjacentHTML('beforeend', U.html(stepBlock(blankStep(), steps.children.length, null))); steps.lastElementChild.querySelector('[name=st-title]').focus(); break;
          case 'del-step': if (steps.children.length > 1) sec.remove(); else U.toast('O modelo precisa de ao menos uma etapa.', 'warn'); break;
          case 'up': if (sec.previousElementSibling) sec.parentNode.insertBefore(sec, sec.previousElementSibling); break;
          case 'down': if (sec.nextElementSibling) sec.parentNode.insertBefore(sec.nextElementSibling, sec); break;
          case 'add-item': { const box = sec.querySelector('.wf-items'); box.insertAdjacentHTML('beforeend', U.html(itemRow({ id: M.uid(), text: '', required: true }))); box.lastElementChild.querySelector('input').focus(); break; }
          case 'del-item': b.closest('.wf-item').remove(); break;
        }
        renum();
      });
      // Enter num item cria o próximo item (montar checklist só no teclado)
      form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.name === 'it-text') { e.preventDefault(); e.target.closest('.wf-step').querySelector('[data-wf="add-item"]').click(); } });
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const err = form.querySelector('.form-error'); err.textContent = '';
        const secs = [...steps.children];
        const stepsData = secs.map((sec, i) => ({
          id: sec.dataset.stepId, title: sec.querySelector('[name=st-title]').value.trim(), instructions: sec.querySelector('[name=st-inst]').value.trim(), criteria: sec.querySelector('[name=st-crit]').value.trim(),
          estimateMin: Number(sec.querySelector('[name=st-min]').value) || 0, optional: sec.querySelector('[name=st-opt]').checked,
          dependsOn: i && sec.querySelector('[name=st-dep]').checked ? secs[i - 1].dataset.stepId : null,
          items: [...sec.querySelectorAll('.wf-item')].map(r => ({ id: r.dataset.itemId, text: r.querySelector('[name=it-text]').value.trim(), required: r.querySelector('[name=it-req]').checked })).filter(i => i.text),
        }));
        const name = form.elements.name.value.trim();
        if (!name) { err.textContent = 'Dê um nome ao modelo.'; form.elements.name.focus(); return; }
        const emptyIdx = stepsData.findIndex(s => !s.title);
        if (emptyIdx >= 0) { err.textContent = `A etapa ${emptyIdx + 1} está sem título.`; secs[emptyIdx].querySelector('[name=st-title]').focus(); return; }
        const id = form.dataset.wfId, old = id ? St.get('workflows', id) : null;
        const rec = { ...(old || { archived: false, starter: false }), name, kind: form.dataset.kind, category: form.elements.category.value, tool: form.elements.tool.value, tools: form.elements.tools.value.split(',').map(x => x.trim()).filter(Boolean), description: form.elements.description.value.trim(), criteria: form.elements.criteria.value.trim(), notes: form.elements.notes.value.trim(), steps: stepsData };
        rec.version = !old ? 1 : JSON.stringify(old.steps) !== JSON.stringify(stepsData) ? (old.version || 1) + 1 : (old.version || 1);
        try { const saved = await St.save('workflows', rec); dirty = false; U.toast(old ? (rec.version !== old.version ? `Modelo salvo (versão ${rec.version}).` : 'Modelo salvo.') : 'Modelo criado.', 'good'); if (!old) App.go('fluxo/' + saved.id); }
        catch (e2) { err.textContent = e2.fields ? Object.values(e2.fields).join(' ') : 'Não foi possível salvar: ' + e2.message; }
      });
    },
  };
})();
