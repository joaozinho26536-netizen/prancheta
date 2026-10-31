// Teste de ponta a ponta no Chromium (Playwright), abrindo index.html direto do disco.
// Rodar: node tests/e2e.js   (Playwright precisa estar instalado)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const results = [];
const errors = [];
function check(name, ok, detail = '') { results.push([ok ? 'OK ' : 'FALHOU', name, detail]); console.log((ok ? 'OK     ' : 'FALHOU ') + name + (ok ? '' : '  → ' + detail)); if (!ok) process.exitCode = 1; }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  // relógio controlado: segunda-feira, 2 de novembro de 2026, 09:00
  await page.clock.install({ time: new Date('2026-11-02T09:00:00-03:00') });
  await page.goto(URL);
  await page.waitForSelector('#nav a');
  const dlg = 'dialog[open]';
  const fill = async (k, v) => { const el = page.locator(`${dlg} [name="${k}"]`); (await el.evaluate(e => e.tagName)) === 'SELECT' ? await el.selectOption(v) : await el.fill(v); };
  const submit = () => page.click(`${dlg} button[type=submit]`);
  const go = async r => { await page.evaluate(r => { location.hash = r; }, r); await sleep(50); };
  const text = sel => page.locator(sel).innerText();
  const confirmYes = () => page.click(`${dlg} button[value=yes]`);

  // 15. navegação: todas as páginas abrem sem erro
  const routes = ['dashboard', 'demandas', 'tarefas', 'revisoes', 'solicitantes', 'calendario', 'tempo', 'pausas', 'referencias', 'anotacoes', 'relatorios', 'metas', 'insights', 'configuracoes'];
  for (const r of routes) await go(r);
  check('Navegação por todas as páginas (vazio)', errors.length === 0, errors.join(' | '));

  // 10. dados inválidos: demanda sem nome e prazo antes do início
  await go('demandas');
  await page.click('main [data-act="new:projects"] >> nth=0');
  await fill('name', '');
  await submit();
  const err1 = await text('#f-name-err');
  await fill('name', 'Identidade Café Lua');
  await fill('start', '2026-11-10'); await fill('due', '2026-11-01');
  await submit();
  const err2 = await text('#f-due-err');
  check('Validação de formulário (obrigatório e datas)', /obrigatório/.test(err1) && /antes do início/.test(err2), `${err1} / ${err2}`);

  // 1. criar demanda (com solicitante)
  await fill('start', '2026-11-02'); await fill('due', '2026-11-06'); await fill('estimateH', '10'); await fill('category', 'Identidade visual'); await fill('priority', 'high');
  await submit();
  await page.waitForSelector(`${dlg}`, { state: 'detached' });
  check('Criar demanda', (await page.locator('.card .title-btn', { hasText: 'Identidade Café Lua' }).count()) === 1);

  // solicitante
  await go('solicitantes');
  await page.click('main [data-act="new:clients"] >> nth=0');
  await fill('name', 'Café Lua'); await fill('email', 'invalido');
  await submit();
  const emailErr = await text('#f-email-err');
  await fill('email', 'contato@cafelua.com'); await submit(); await page.waitForSelector(dlg, { state: 'detached' });
  check('Solicitante com validação de e-mail', /inválido/.test(emailErr) && (await page.locator('td .title-btn', { hasText: 'Café Lua' }).count()) === 1, emailErr + ' / ' + await page.locator('main').innerText());

  // editar demanda: vincular solicitante
  await go('demandas');
  await page.click('.card .title-btn:has-text("Identidade Café Lua")');
  const pid = (await page.evaluate(() => location.hash)).split('/')[1];
  await page.click('[data-act^="edit:projects"]');
  await page.locator(`${dlg} [name=clientId]`).selectOption({ label: 'Café Lua' });
  await fill('description', 'Logo, paleta e papelaria');
  await submit();
  await page.waitForSelector(`${dlg}`, { state: 'detached' });
  const hist = await text('.history');
  check('Editar demanda e histórico de alterações', /Solicitante/.test(hist) && /Café Lua/.test(await text('.page-head .sub')), hist.slice(0, 80));

  // 2. tarefas: criar duas, concluir uma
  for (const [title, est] of [['Esboços do símbolo', '2'], ['Paleta de cores', '1']]) {
    await page.click('main [data-act="new:tasks"]');
    await fill('title', title); await fill('estimateH', est); await fill('due', '2026-11-04');
    await submit(); await page.waitForSelector(`${dlg}`, { state: 'detached' });
  }
  check('Criar tarefas ligadas ao demanda', (await page.locator('.task-row').count()) === 2);
  await page.click('.task-row:has-text("Paleta de cores") input[type=checkbox]');
  await sleep(100);
  const prog = await page.locator('.stat:has-text("Progresso") .stat-value').innerText();
  check('Concluir tarefa e progresso da demanda', prog === '50%', prog);

  // 3. dashboard
  await go('dashboard');
  const dash = await text('.stats-panel');
  check('Indicadores do dashboard', /Demandas em andamento\s*1/.test(dash) && /Tarefas pendentes\s*1/.test(dash) && /Concluídas hoje\s*1/.test(dash), dash.replace(/\s+/g, ' '));

  // 6, 7, 8. expediente, cronômetro na tarefa, pausa, recarregar
  await go('tempo');
  await page.click('main [data-act="workday"]');
  await sleep(100);
  await page.click('main [data-act="session-start"]');
  await page.locator(`${dlg} [name=projectId]`).selectOption(pid);
  await page.locator(`${dlg} [name=taskId]`).selectOption({ label: 'Esboços do símbolo' });
  await submit(); await page.waitForSelector(`${dlg}`, { state: 'detached' });
  // tentar outra sessão: deve pedir confirmação (impede duas ativas)
  await page.evaluate(() => { App.startSession(); });
  await page.waitForSelector(`${dlg}`);
  const twoMsg = await text(dlg);
  await page.click(`${dlg} button[value=no]`);
  check('Impede duas sessões ativas', /Só uma sessão/.test(twoMsg));
  await page.clock.runFor(30 * 60 * 1000);          // 09:30
  await page.click('main [data-act="session-stop"]').catch(() => {}); // garante que o botão existe; reabre abaixo
  await sleep(100);
  // reabre sessão e simula fechar o navegador no meio
  await page.click('main [data-act="session-start"]');
  await page.locator(`${dlg} [name=taskId]`).selectOption({ label: 'Esboços do símbolo' });
  await submit(); await page.waitForSelector(`${dlg}`, { state: 'detached' });
  await page.clock.runFor(20 * 60 * 1000);          // 09:50
  await page.reload(); await page.waitForSelector('#nav a');
  await page.clock.runFor(10 * 60 * 1000);          // 10:00, sessão rodou 30 min (20 antes + 10 depois do reload)
  const clock = await text('[data-live="session"]');
  // o relógio do teste segue andando em tempo real entre os passos; 20 + 10 min = 00:30:xx (se reiniciasse no reload, mostraria 00:10)
  check('Cronômetro recupera a sessão após recarregar', /^00:30:/.test(clock), clock);
  // pausa de 15 min durante a sessão
  await go('pausas');
  await page.click('[data-act="break-start:short"]');
  await page.clock.runFor(15 * 60 * 1000);          // 10:15
  const left = await text('[data-live="break-left"]');
  await page.click('main [data-act="break-end"]');
  await page.clock.runFor(15 * 60 * 1000);          // 10:30
  await go('tempo');
  await page.click('main [data-act="session-stop"]');
  await sleep(100);
  const today = (await text('.panel:has(h2:text-is("Hoje")) .stats-panel')).replace(/\s+/g, ' ');
  // trabalhado: 09:00-09:30 (30) + 09:30-10:30 menos pausa 15 = 45 → 75 min = 1 h 15
  check('Cálculo de horas e pausas (pausa não conta como trabalho)', /Efetivamente trabalhado 1 h 15/.test(today) && /Pausas 15 min/.test(today) && /Tempo de expediente 1 h 30/.test(today) && /Em demandas 1 h 15/.test(today), today);
  check('Temporizador de pausa mostra tempo restante', /restantes|passou/.test(left), left);
  await go('demanda/' + pid);
  const taskTime = await text('.task-row:has-text("Esboços do símbolo") .tr-time');
  check('Associação tarefa → demanda → tempo', /1 h 15/.test(taskTime) && /1 h 15/.test(await text('.stat:has-text("Horas") .stat-value')), taskTime);

  // 5. persistência após recarregar
  await page.reload(); await page.waitForSelector('#nav a');
  await go('demandas');
  check('Persistência após recarregar', (await page.locator('.card .title-btn', { hasText: 'Identidade Café Lua' }).count()) === 1);

  // 4. filtros e busca
  await go('tarefas');
  await page.selectOption('[data-f="status"]', 'all');
  const allCount = await page.locator('.task-row').count();
  await page.selectOption('[data-f="status"]', 'done');
  const doneCount = await page.locator('.task-row').count();
  await page.locator('body').press('/');
  await page.fill('#search', 'esboço');
  const sr = await text('#search-results');
  await page.keyboard.press('Escape');
  check('Filtros e busca global', allCount === 2 && doneCount === 1 && /Esboços do símbolo/.test(sr), `${allCount}/${doneCount}/${sr}`);
  await page.selectOption('[data-f="status"]', 'open');

  // 13. calendário: a tarefa aparece uma vez na semana; troca de visualizações
  await go('calendario');
  await page.click('[data-act="mode:cal:week"]');
  const inWeek = await page.locator('.ev', { hasText: 'Esboços do símbolo' }).count();
  await page.click('[data-act="mode:cal:month"]');
  const inMonth = await page.locator('.mcell .ev', { hasText: 'Esboços do símbolo' }).count();
  await page.click('[data-act="mode:cal:day"]');
  const dayOk = (await page.locator('.dayline, .empty').count()) > 0;
  check('Calendário dia/semana/mês sem duplicar', inWeek === 1 && inMonth === 1 && dayOk, `${inWeek}/${inMonth}`);

  // 14. relatórios refletem os dados
  await go('relatorios');
  const rep1 = (await text('.stats-panel')).replace(/\s+/g, ' ');
  await go('demanda/' + pid);
  await page.click('.task-row:has-text("Esboços do símbolo") input[type=checkbox]');
  await sleep(100);
  await go('relatorios');
  const rep2 = (await text('.stats-panel')).replace(/\s+/g, ' ');
  check('Relatórios atualizam após mudanças', /Horas trabalhadas 1 h 15/.test(rep1) && /Tarefas concluídas 1/.test(rep1) && /Tarefas concluídas 2/.test(rep2), rep2);

  // 11. confirmação antes de excluir (cancelar mantém)
  await go('tarefas'); await page.selectOption('[data-f="status"]', 'all');
  await page.click('.task-row:has-text("Paleta de cores") .title-btn');
  await page.click(`${dlg} [data-delete]`);
  const askText = await page.locator('dialog.small[open]').innerText();
  await page.click('dialog.small[open] button[value=no]');
  await page.click(`${dlg} [data-close]`);
  check('Confirmação antes de excluir', /não pode ser desfeita/.test(askText) && (await page.locator('.task-row:has-text("Paleta de cores")').count()) === 1);

  // 9. exportar backup
  await go('configuracoes');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
  const file = path.join(os.tmpdir(), 'prancheta-e2e-backup.json');
  await dl.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('Exportar backup', backup.app === 'prancheta' && backup.data.projects.length === 1 && backup.data.sessions.length === 2 && backup.data.breaks.length === 1);

  // 12. importar o mesmo backup em modo mesclar: nada duplica
  await page.setInputFiles('#import-file', file);
  await page.click('[data-act="import"]'); await confirmYes();
  await sleep(200);
  const counts = await page.evaluate(() => ({ p: Store.S.projects.length, t: Store.S.tasks.length, s: Store.S.sessions.length }));
  check('Importação mesclada sem duplicar', counts.p === 1 && counts.t === 2 && counts.s === 2, JSON.stringify(counts));

  // excluir demanda (confirmando) e restaurar com "substituir"
  await go('demanda/' + pid);
  await page.click('main [data-act^="del:projects"]'); await confirmYes();
  await sleep(100);
  const afterDel = await page.evaluate(() => ({ p: Store.S.projects.length, t: Store.S.tasks.filter(t => t.projectId).length, tasks: Store.S.tasks.length }));
  check('Excluir demanda (tarefas ficam, sem demanda)', afterDel.p === 0 && afterDel.t === 0 && afterDel.tasks === 2, JSON.stringify(afterDel));
  await go('configuracoes');
  await page.setInputFiles('#import-file', file);
  await page.check('[name=import-mode][value=replace]');
  const [safety] = await Promise.all([page.waitForEvent('download'), (async () => { await page.click('[data-act="import"]'); await confirmYes(); })()]);
  await sleep(200);
  const restored = await page.evaluate(() => ({ p: Store.S.projects.length, linked: Store.S.tasks.filter(t => t.projectId).length }));
  check('Restaurar backup (substituir) com backup de segurança', restored.p === 1 && restored.linked === 2 && /antes-da-importacao/.test(safety.suggestedFilename()), JSON.stringify(restored));

  // backup inválido é recusado sem alterar nada
  const badFile = path.join(os.tmpdir(), 'prancheta-e2e-bad.json');
  fs.writeFileSync(badFile, JSON.stringify({ app: 'prancheta', version: 1, data: { projects: [{ id: 'x' }] } }));
  await page.setInputFiles('#import-file', badFile);
  await page.click('[data-act="import"]');
  const badMsg = await page.locator('dialog.small[open]').innerText();
  await page.click('dialog.small[open] button');
  check('Backup inválido é recusado', /Backup inválido/.test(badMsg) && (await page.evaluate(() => Store.S.projects.length)) === 1, badMsg.slice(0, 120));

  // dados de demonstração: marcados e removíveis
  await go('dashboard');
  await page.evaluate(() => document.querySelector('[data-act="load-demo"]') ? null : null);
  await go('configuracoes'); await page.click('main [data-act="load-demo"]'); await sleep(200);
  const demoBanner = await page.locator('#demo-banner').isVisible();
  await page.click('#demo-banner [data-act="clear-demo"]'); await confirmYes(); await sleep(200);
  const afterDemo = await page.evaluate(() => ({ p: Store.S.projects.length, demo: Store.S.projects.filter(p => p.demo).length }));
  check('Dados de demonstração identificados e removíveis', demoBanner && afterDemo.p === 1 && afterDemo.demo === 0, JSON.stringify(afterDemo));

  // música: link inválido é recusado; o player fica fora das páginas e não reinicia ao navegar
  await page.route('https://open.spotify.com/**', r => r.fulfill({ contentType: 'text/html', body: '<p>player</p>' })); // sem rede no teste
  await page.click('#music-btn');
  await page.fill('#music-link', 'https://exemplo.com/playlist/123');
  await page.click('#music [value=play]');
  const musicErr = await text('#music .err');
  await page.fill('#music-link', 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=x');
  await page.fill('#music [name=name]', 'Foco');
  await page.click('#music [value=save]');
  await sleep(150);
  await page.evaluate(() => { document.querySelector('#music iframe').dataset.marca = '1'; });
  await go('tarefas'); await go('calendario');
  const sameIframe = await page.evaluate(() => document.querySelector('#music iframe').dataset.marca === '1');
  const src = await page.getAttribute('#music iframe', 'src');
  await page.reload(); await page.waitForSelector('#nav a');
  const fav = await page.locator('#music .music-saved').innerText();
  check('Música do Spotify (validação, player contínuo, favoritos salvos)', /Não reconheci/.test(musicErr) && sameIframe && /embed\/playlist\/37i9dQZF1DXcBWIGoYBM5M/.test(src) && /Foco/.test(fav), `${musicErr} / ${sameIframe} / ${src} / ${fav}`);

  // navegação final com dados, sem erros
  for (const r of routes) await go(r);
  await go('solicitante/' + (await page.evaluate(() => Store.S.clients[0].id)));
  check('Navegação por todas as páginas (com dados), sem erros no console', errors.length === 0, errors.join(' | '));

  await page.screenshot({ path: path.join(__dirname, 'saida-dashboard.png'), fullPage: true }).catch(() => {});
  await browser.close();
  console.log(`\n${results.filter(r => r[0] === 'OK ').length}/${results.length} verificações passaram.`);
})().catch(e => { console.error(e); process.exit(1); });
