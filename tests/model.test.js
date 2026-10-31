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

test('insights: dia sobrecarregado e projeto atrasado', () => {
  const tasks = Array.from({ length: 6 }, (_, i) => ({ id: 't' + i, title: 'Tarefa ' + i, status: 'todo', priority: 'medium', due: '2026-10-28', created: 0 }));
  const st = base({ tasks, projects: [{ id: 'p', name: 'Atrasado', status: 'doing', due: '2026-10-20' }] });
  const r = M.insights(st, at(0, 12));
  assert.ok(r.items.some(i => i.title.includes('Dia cheio')));
  assert.ok(r.items.some(i => i.title.includes('atrasado')));
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
