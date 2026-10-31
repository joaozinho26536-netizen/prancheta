// Regras de cálculo da Prancheta. Rodar: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const M = require('../js/model.js');

const H = M.HOUR, MIN = M.MIN;
const T0 = new Date(2026, 9, 26, 0, 0).getTime(); // segunda, 26/10/2026, meia-noite local
const at = (day, h, m = 0) => T0 + day * M.DAY + h * H + m * MIN;
const base = (over = {}) => ({ settings: structuredClone(M.DEFAULT_SETTINGS), projects: [], tasks: [], clients: [], sessions: [], breaks: [], workdays: [], events: [], revisions: [], refs: [], notes: [], goals: [], activity: [], ...over });

test('subtrair intervalos', () => {
  assert.deepStrictEqual(M.subtract([[0, 100]], [[20, 30], [50, 60]]), [[0, 20], [30, 50], [60, 100]]);
  assert.deepStrictEqual(M.subtract([[0, 100]], [[-10, 200]]), []);
  assert.deepStrictEqual(M.subtract([[0, 100]], [[100, 120]]), [[0, 100]]);
});

test('pausa registrada não conta como tempo trabalhado', () => {
  const st = base({
    sessions: [{ id: 's', start: at(0, 9), end: at(0, 13), projectId: 'p', pauses: [] }],
    breaks: [{ id: 'b', start: at(0, 10), end: at(0, 10, 30) }],
    workdays: [{ id: 'w', start: at(0, 8, 30), end: at(0, 18) }],
    projects: [{ id: 'p', name: 'P', category: 'Branding', status: 'doing' }],
  });
  const s = M.timeSummary(st, at(0, 0), at(1, 0), at(1, 0));
  assert.strictEqual(s.workedMs, 3.5 * H);
  assert.strictEqual(s.breakMs, 0.5 * H);
  assert.strictEqual(s.workdayMs, 9.5 * H);
  assert.strictEqual(s.projectMs, 3.5 * H);
  assert.strictEqual(s.byCategory.Branding, 3.5 * H);
  assert.strictEqual(s.unclassifiedMs, 0);
});

test('pausas da própria sessão e sessão sem projeto', () => {
  const st = base({ sessions: [{ id: 's', start: at(0, 14), end: at(0, 16), projectId: null, pauses: [{ start: at(0, 15), end: at(0, 15, 15) }] }] });
  const s = M.timeSummary(st, at(0, 0), at(1, 0), at(1, 0));
  assert.strictEqual(s.workedMs, 1.75 * H);
  assert.strictEqual(s.unclassifiedMs, 1.75 * H);
});

test('sessão ativa é calculada pelo horário real (sobrevive a recarregar a página)', () => {
  const st = base({ sessions: [{ id: 's', start: at(0, 9), end: null, pauses: [] }] });
  const now = at(0, 9, 47);
  assert.strictEqual(M.timeSummary(st, at(0, 0), at(1, 0), now).workedMs, 47 * MIN);
});

test('sessão que passa da meia-noite é dividida entre os dias', () => {
  const st = base({ sessions: [{ id: 's', start: at(0, 23), end: at(1, 1), pauses: [] }] });
  const s = M.timeSummary(st, at(0, 0), at(2, 0), at(2, 0));
  assert.strictEqual(s.byDay[M.isoDate(at(0, 12))], H);
  assert.strictEqual(s.byDay[M.isoDate(at(1, 12))], H);
});

test('tempo desde a última pausa', () => {
  const st = base({ sessions: [{ id: 's', start: at(0, 9), end: null, pauses: [] }], breaks: [{ id: 'b', start: at(0, 10), end: at(0, 10, 15) }] });
  assert.strictEqual(M.sinceLastBreak(st, at(0, 11)), 45 * MIN);
});

test('progresso e atraso de projeto', () => {
  const set = M.DEFAULT_SETTINGS;
  const p = { id: 'p', status: 'doing', due: '2026-10-20' };
  const tasks = [{ projectId: 'p', status: 'done' }, { projectId: 'p', status: 'todo' }, { projectId: 'x', status: 'done' }];
  assert.strictEqual(M.projectProgress(set, p, tasks), 0.5);
  assert.strictEqual(M.projectOverdue(set, p, '2026-10-26'), true);
  assert.strictEqual(M.projectOverdue(set, { ...p, status: 'done' }, '2026-10-26'), false);
  assert.strictEqual(M.projectProgress(set, { id: 'q', status: 'done' }, []), 1);
});

test('validação de formulários', () => {
  assert.deepStrictEqual(Object.keys(M.validate('projects', { name: '' })), ['name']);
  assert.ok(M.validate('projects', { name: 'X', start: '2026-10-10', due: '2026-10-01' }).due);
  assert.ok(M.validate('tasks', { title: 'X', estimateH: -1 }).estimateH);
  assert.ok(M.validate('refs', { name: 'X', url: 'javascript:alert(1)' }).url);
  assert.deepStrictEqual(M.validate('tasks', { title: 'Ok', due: '2026-11-01', time: '09:30' }), {});
  assert.ok(M.validate('sessions', { start: 10, end: 5 }).end);
});

test('backup: validação e mescla sem duplicar', () => {
  assert.strictEqual(M.validateBackup({ foo: 1 }).ok, false);
  const bad = M.validateBackup({ app: 'prancheta', version: 1, data: { projects: [{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }] } });
  assert.strictEqual(bad.ok, false);
  assert.match(bad.errors.join(), /repetido/);
  const good = M.validateBackup({ app: 'prancheta', version: 1, data: { projects: [{ id: 'a', name: 'A' }], tasks: [{ id: 't', title: 'T' }] } });
  assert.strictEqual(good.ok, true);
  const m = M.mergeRecords([{ id: 'a', v: 1, updated: 5 }, { id: 'b', updated: 5 }], [{ id: 'a', v: 2, updated: 9 }, { id: 'b', updated: 1 }, { id: 'c', updated: 1 }]);
  assert.strictEqual(m.records.length, 3);
  assert.strictEqual(m.records.find(r => r.id === 'a').v, 2);
  assert.strictEqual(m.added, 1); assert.strictEqual(m.updated, 1);
});

test('metas: horas na semana', () => {
  const st = base({ sessions: [{ id: 's', start: at(1, 9), end: at(1, 15), pauses: [] }], goals: [{ id: 'g', metric: 'hours_week', target: 30 }] });
  const pr = M.goalProgress(st.goals[0], st, at(2, 12));
  assert.strictEqual(pr.value, 6);
  assert.strictEqual(pr.ratio, 0.2);
  assert.strictEqual(M.goalProgress(st.goals[0], st, at(2, 12), 1).value, 0); // semana anterior
});

test('insights: dizem quando faltam dados e não inventam análises', () => {
  const r = M.insights(base(), at(0, 12));
  assert.strictEqual(r.items.length, 0);
  assert.ok(r.lack.length >= 4);
});

test('insights: dia sobrecarregado e demanda atrasada', () => {
  const tasks = Array.from({ length: 6 }, (_, i) => ({ id: 't' + i, title: 'Tarefa ' + i, status: 'todo', priority: 'medium', due: '2026-10-28', created: 0 }));
  const st = base({ tasks, projects: [{ id: 'p', name: 'Atrasado', status: 'doing', due: '2026-10-20' }] });
  const r = M.insights(st, at(0, 12));
  assert.ok(r.items.some(i => i.title.includes('Dia cheio')));
  assert.ok(r.items.some(i => i.title.includes('atrasada')));
  assert.ok(r.items.some(i => /aparece 6 vezes/.test(i.title)));  // título repetido = tarefa recorrente
});

test('relatório: no prazo × fora do prazo e projetos acima do previsto', () => {
  const st = base({
    projects: [{ id: 'a', name: 'A', status: 'done', due: '2026-10-27', completedAt: at(0, 10), estimateH: 1 }, { id: 'b', name: 'B', status: 'done', due: '2026-10-25', completedAt: at(1, 10) }],
    sessions: [{ id: 's', start: at(0, 8), end: at(0, 10), projectId: 'a', pauses: [] }],
  });
  const r = M.report(st, { from: at(0, 0), to: at(7, 0) }, at(2, 0));
  assert.strictEqual(r.doneProjects.length, 2);
  assert.strictEqual(r.onTime, 1);
  assert.strictEqual(r.lateDone, 1);
  assert.strictEqual(r.overBudget[0].p.id, 'a');
});

test('links do Spotify viram player embutido', () => {
  assert.strictEqual(M.spotifyEmbed('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc').embed, 'https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=prancheta&theme=0');
  assert.strictEqual(M.spotifyEmbed('https://open.spotify.com/intl-pt/album/4aawyAB9vmqN3uQ7FjRGTy').type, 'album');
  assert.strictEqual(M.spotifyEmbed('spotify:track:11dFghVXANMlKmJXsNCbNl').url, 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl');
  assert.strictEqual(M.spotifyEmbed('https://evil.com/playlist/37i9dQZF1DXcBWIGoYBM5M'), null);
  assert.strictEqual(M.spotifyEmbed('https://open.spotify.com/user/abcdefghijkl'), null);
  assert.strictEqual(M.spotifyEmbed('qualquer coisa'), null);
});

test('saldo da jornada (banco de horas): expediente − pausas − jornada prevista', () => {
  // jornada padrão: 09–18 com 60 min de almoço = 8 h, seg a sex. T0 é segunda; T0+5 é sábado.
  const st = base({
    workdays: [{ id: 'a', start: at(0, 8), end: at(0, 18) }, { id: 'b', start: at(1, 9), end: at(1, 16) }, { id: 'c', start: at(5, 9), end: at(5, 11) }],
    breaks: [{ id: 'x', start: at(0, 12), end: at(0, 13) }, { id: 'y', start: at(1, 12), end: at(1, 13) }],
  });
  const r = M.jornadaSaldo(st, at(0, 0), at(7, 0), at(7, 0));
  assert.strictEqual(r.days[M.isoDate(at(0, 12))].saldo, H);       // 10 h − 1 h − 8 h = +1 h
  assert.strictEqual(r.days[M.isoDate(at(1, 12))].saldo, -2 * H);   // 7 h − 1 h − 8 h = −2 h
  assert.strictEqual(r.days[M.isoDate(at(5, 12))].saldo, 2 * H);    // sábado: tudo é extra
  assert.strictEqual(r.total, H);
});

test('escrita rápida entende prazo, horário e prioridade no texto', () => {
  const now = at(0, 10); // segunda, 26/10/2026, 10h
  const q = t => M.parseQuick(t, now);
  assert.deepStrictEqual(q('Entregar banner até sexta 14h !urgente'), { priority: 'urgent', time: '14:00', due: '2026-10-30', title: 'Entregar banner' });
  assert.deepStrictEqual(q('Revisar arte amanhã'), { due: '2026-10-27', title: 'Revisar arte' });
  assert.deepStrictEqual(q('Ligar para o RH hoje às 16:30'), { time: '16:30', due: '2026-10-26', title: 'Ligar para o RH' });
  assert.strictEqual(q('Fechar arquivo segunda-feira').due, '2026-10-26');      // hoje mesmo
  assert.strictEqual(q('Post de Natal 20/12').due, '2026-12-20');
  assert.strictEqual(q('Planejamento 05/01').due, '2027-01-05');                // já passou este ano → ano que vem
  assert.strictEqual(q('Algo 31/02').due, undefined);                           // data impossível fica no título
  assert.strictEqual(q('Algo 31/02').title, 'Algo 31/02');
  assert.deepStrictEqual(q('Banner da sexta-feira santa'), { due: '2026-10-30', title: 'Banner da santa' }); // limite conhecido: dia da semana solto vira prazo
  assert.deepStrictEqual(q('Só um título'), { title: 'Só um título' });
  assert.strictEqual(q('Arte !média').priority, 'medium');
});

test('backup forjado com link perigoso, cor ou imagem externa é recusado', () => {
  const bk = data => M.validateBackup({ app: 'prancheta', version: 1, data });
  assert.strictEqual(bk({ projects: [{ id: 'p', name: 'X', links: ['javascript:alert(1)'] }] }).ok, false);
  assert.strictEqual(bk({ refs: [{ id: 'r', name: 'X', palette: ['red;background:url(https://evil.com)'] }] }).ok, false);
  assert.strictEqual(bk({ refs: [{ id: 'r', name: 'X', image: 'https://evil.com/pixel.png' }] }).ok, false);
  assert.strictEqual(bk({ projects: [{ id: 'p', name: 'X', links: ['https://drive.google.com/x'] }], refs: [{ id: 'r', name: 'Y', palette: ['#fff', '#1a1a1a'], image: 'data:image/jpeg;base64,AAAA' }] }).ok, true);
});

test('cursos: tempo de estudo vem das sessões + minutos lançados, sem duplicar', () => {
  const c = { id: 'c', extraMin: 30 };
  const st = base({ courses: [c], sessions: [{ id: 's1', start: at(0, 9), end: at(0, 9, 45), courseId: 'c', pauses: [] }, { id: 's2', start: at(0, 10), end: at(0, 11), projectId: 'p', pauses: [] }] });
  assert.strictEqual(M.courseStudyMs(st, c, at(1, 0)), 75 * MIN);
  assert.strictEqual(M.studyMs(st, at(0, 0), at(1, 0), at(1, 0)), 45 * MIN);       // só a sessão de estudo
  assert.strictEqual(M.timeSummary(st, at(0, 0), at(1, 0), at(1, 0)).workedMs, 105 * MIN); // horas trabalhadas não mudaram de regra
  assert.strictEqual(M.lastActivity(st, 'courseId', c), at(0, 9, 45));
  assert.strictEqual(M.lastActivity(st, 'courseId', { id: 'x' }), null);
});

test('validação dos cadastros novos', () => {
  assert.ok(M.validate('courses', { name: 'X', status: 'doing', progress: 120 }).progress);
  assert.ok(M.validate('courses', { name: 'X', status: 'doing', url: 'javascript:1' }).url);
  assert.deepStrictEqual(M.validate('courses', { name: 'X', status: 'doing', progress: 40 }), {});
  assert.ok(M.validate('resources', { title: 'X' }).type);
  assert.ok(M.validate('exercises', { title: 'X', status: 'planned', evidence: ['ftp://a'] }).evidence);
  assert.ok(M.validate('workflows', { name: 'X', steps: [{ title: '' }] }).steps);
  assert.ok(M.validate('runs', { name: 'X', projectId: 'p' }).steps);
});

test('backup: v1 continua importável, v2 traz as listas novas, versão futura é recusada', () => {
  const v1 = M.validateBackup({ app: 'prancheta', version: 1, data: { projects: [{ id: 'p', name: 'A' }] } });
  assert.strictEqual(v1.ok, true);
  assert.strictEqual(v1.counts.courses, 0);
  const v2 = M.validateBackup({ app: 'prancheta', version: 2, data: { courses: [{ id: 'c', name: 'Curso', status: 'doing' }], resources: [{ id: 'r', title: 'T', type: 'Tutorial' }] } });
  assert.strictEqual(v2.ok, true);
  assert.strictEqual(M.validateBackup({ app: 'prancheta', version: 3, data: {} }).ok, false);
});

test('prática: tempo, média das notas e evolução só com dados suficientes', () => {
  const x = { id: 'x', extraMin: 15, scores: [{ score: 4 }, { score: 2 }, { score: '' }] };
  const st = base({ exercises: [x], sessions: [{ id: 's', start: at(0, 14), end: at(0, 15), exerciseId: 'x', pauses: [] }] });
  assert.strictEqual(M.exerciseMs(st, x, at(1, 0)), 75 * MIN);
  assert.strictEqual(M.avgScore(x), 3);
  assert.strictEqual(M.avgScore({ scores: [] }), null);
  const ev = (d, s) => ({ evaluatedAt: new Date(d).getTime(), scores: [{ score: s }] });
  assert.strictEqual(M.scoreEvolution([ev('2026-10-05', 2), ev('2026-10-20', 3)]), null);            // 2 avaliações: pouco
  assert.strictEqual(M.scoreEvolution([ev('2026-10-05', 2), ev('2026-10-20', 3), ev('2026-10-25', 4)]), null); // 1 mês só
  const evo = M.scoreEvolution([ev('2026-10-05T12:00', 2), ev('2026-10-20T12:00', 4), ev('2026-11-03T12:00', 5)]);
  assert.deepStrictEqual(evo.map(e => [e.month, e.avg, e.count]), [['2026-10', 3, 2], ['2026-11', 5, 1]]);
});

test('fluxos: execução é cópia independente do modelo e acompanha o progresso', () => {
  let n = 0; const id = () => 'id' + (++n);
  const tpl = { id: 'tpl', version: 3, name: 'Impressão', steps: [
    { id: 'a', title: 'Briefing', items: [{ text: 'Ler briefing', required: true }, { text: 'Anotar dúvidas', required: false }] },
    { id: 'b', title: 'Sangria', dependsOn: 'a', items: [{ text: 'Conferir sangria pedida pela gráfica', required: true }] },
    { id: 'c', title: 'Mockup', optional: true, items: [] },
  ] };
  const run = M.instantiateRun(tpl, 'p1', 1000, id);
  assert.strictEqual(run.templateVersion, 3);
  assert.strictEqual(run.steps[1].dependsOn, run.steps[0].id);            // dependência aponta para a cópia
  tpl.steps[0].title = 'MUDOU'; tpl.steps[0].items.push({ text: 'novo' }); // editar o modelo depois...
  assert.strictEqual(run.steps[0].title, 'Briefing');                     // ...não muda a execução
  assert.strictEqual(run.steps[0].items.length, 2);
  let r = M.toggleRunItem(run, run.steps[0].id, run.steps[0].items[0].id);
  assert.strictEqual(r.steps[0].state, 'pending');                        // falta um item
  r = M.toggleRunItem(r, r.steps[0].id, r.steps[0].items[1].id);
  assert.strictEqual(r.steps[0].state, 'done');                           // todos feitos: etapa fecha
  r = M.toggleRunItem(r, r.steps[0].id, r.steps[0].items[1].id);
  assert.strictEqual(r.steps[0].state, 'pending');                        // desmarcou: reabre
  r = M.setStepState(r, r.steps[2].id, 'skipped');
  const pr = M.runProgress(r);
  assert.strictEqual(pr.closed, 1);
  assert.deepStrictEqual(pr.requiredPending.map(x => x.item), ['Conferir sangria pedida pela gráfica']);
  assert.deepStrictEqual(pr.stepsPending, ['Briefing', 'Sangria']);
  assert.strictEqual(M.workflowMinutes([{ estimateMin: 30 }, { estimateMin: '15' }, {}]), 45);
});

test('fluxos: prazos distribuídos até a entrega', () => {
  assert.deepStrictEqual(M.distributeDue(3, '2026-11-02', '2026-11-08'), ['2026-11-04', '2026-11-06', '2026-11-08']);
  assert.deepStrictEqual(M.distributeDue(2, '2026-11-02', '2026-11-01'), ['2026-11-02', '2026-11-02']); // entrega já passou: hoje
});

test('arquivos: nome padronizado e estrutura de pastas', () => {
  const pat = '{solicitante}_{demanda}_{peca}_V{versao}_{data}_{sufixo}';
  assert.strictEqual(M.buildFileName({ solicitante: 'Marketing', demanda: 'Campanha de Natal', peca: 'Post feed', versao: 1, data: '2026-10-31' }, pat, 'PSD'), 'Marketing_Campanha-de-Natal_Post-feed_V01_2026-10-31.psd');
  assert.strictEqual(M.buildFileName({ demanda: 'Ação/Promoção: "Verão"?', versao: '' }, pat, 'pdf'), 'Acao-Promocao-Verao.pdf'); // sem caracteres inválidos e sem "V" solto
  assert.strictEqual(M.buildFileName({}, pat, 'pdf'), '');                                                                    // nada preenchido: sem nome
  assert.strictEqual(M.cleanSegment('  Diretoria  Comercial  '), 'Diretoria-Comercial');
  const paths = M.folderPaths('Marketing Campanha', ['01_Briefing', '05_Exportacoes/Redes', '../../etc', '']);
  assert.deepStrictEqual(paths, ['Marketing-Campanha', 'Marketing-Campanha/01_Briefing', 'Marketing-Campanha/05_Exportacoes/Redes', 'Marketing-Campanha/etc']);
  const sh = M.folderScript(paths);
  assert.match(sh, /mkdir -p 'Marketing-Campanha\/05_Exportacoes\/Redes'/);
  assert.ok(!/\.\./.test(sh.split('\n').filter(l => l.startsWith('mkdir')).join()));                                       // não sobe de pasta
});

test('abrir aplicativos: link do app Atalhos do Mac', () => {
  assert.strictEqual(M.shortcutUrl('Abrir Photoshop'), 'shortcuts://run-shortcut?name=Abrir%20Photoshop');
  assert.strictEqual(M.shortcutUrl('Abrir arquivo da Prancheta', '/Users/eu/Trabalho/Arte final.psd'), 'shortcuts://run-shortcut?name=Abrir%20arquivo%20da%20Prancheta&input=text&text=%2FUsers%2Feu%2FTrabalho%2FArte%20final.psd');
  assert.strictEqual(M.shortcutUrl('  '), '');
  assert.ok(M.isLocalPath('/Users/eu/a.ai') && M.isLocalPath('~/Desktop/b.psd'));
  assert.ok(!M.isLocalPath('C:\\\\x.psd') && !M.isLocalPath('https://x.com/a.psd') && !M.isLocalPath(''));
});
