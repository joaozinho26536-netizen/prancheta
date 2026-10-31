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
  // primeiro acesso: cria a senha
  await page.waitForSelector('.lock [name=p1]');
  await page.fill('.lock [name=p1]', '12');
  await page.fill('.lock [name=p2]', '12');
  await page.press('.lock [name=p2]', 'Enter');
  const shortMsg = await page.locator('.lock-msg').innerText();
  await page.fill('.lock [name=p1]', 'cafe1234');
  await page.fill('.lock [name=p2]', 'cafe1234');
  await page.press('.lock [name=p2]', 'Enter');
  await page.waitForSelector('#nav a');
  // o teste avança o relógio por horas; o bloqueio automático tem verificação própria lá embaixo
  await page.evaluate(() => Store.saveSettings({ autoLockMin: 0 }));
  const dlg = 'dialog[open]';
  const fill = async (k, v) => { const el = page.locator(`${dlg} [name="${k}"]`); (await el.evaluate(e => e.tagName)) === 'SELECT' ? await el.selectOption(v) : await el.fill(v); };
  const submit = () => page.click(`${dlg} button[type=submit]`);
  const go = async r => { await page.evaluate(r => { location.hash = r; }, r); await sleep(50); };
  const text = sel => page.locator(sel).innerText();
  const confirmYes = () => page.click(`${dlg} button[value=yes]`);

  // 15. navegação: todas as páginas abrem sem erro
  const routes = ['dashboard', 'demandas', 'tarefas', 'revisoes', 'solicitantes', 'fluxos', 'arquivos', 'calendario', 'tempo', 'pausas', 'referencias', 'anotacoes', 'cursos', 'biblioteca', 'pratica', 'relatorios', 'metas', 'insights', 'configuracoes'];
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
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('/');
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

  // escrita rápida: digitar e Enter cria, o cursor continua no campo
  await go('tarefas');
  const autofocus = await page.evaluate(() => document.activeElement.dataset.quick);
  await page.keyboard.type('Revisar arte do banner'); await page.keyboard.press('Enter'); await sleep(150);
  await page.keyboard.type('Exportar PDF final'); await page.keyboard.press('Enter'); await sleep(150);
  const quickTasks = await page.evaluate(() => Store.S.tasks.filter(t => ['Revisar arte do banner', 'Exportar PDF final'].includes(t.title)).length);
  const stillFocused = await page.evaluate(() => document.activeElement.dataset.quick === 'tasks' && document.activeElement.value === '');
  await page.keyboard.type('Enviar arte final até sexta 14h !urgente');
  const preview = await text('.quick-tip');
  await page.keyboard.press('Enter'); await sleep(150);
  const parsed = await page.evaluate(() => Store.S.tasks.find(t => t.title === 'Enviar arte final'));
  check('Escrita rápida entende prazo, horário e prioridade', /Prazo: sex 06\/11\/2026 · às 14:00 · Urgente/.test(preview) && parsed && parsed.due === '2026-11-06' && parsed.time === '14:00' && parsed.priority === 'urgent', preview + ' / ' + JSON.stringify(parsed && [parsed.due, parsed.time, parsed.priority]));
  await go('anotacoes');
  await page.keyboard.type('Ideia para o post'); await page.keyboard.press('Shift+Enter'); await page.keyboard.type('Usar fotos da equipe');
  await page.keyboard.press('Control+Enter'); await sleep(150);
  const note = await page.evaluate(() => Store.S.notes.find(n => n.title === 'Ideia para o post'));
  await go('demandas');
  await page.keyboard.type('Convite da festa de fim de ano'); await page.keyboard.press('Enter'); await sleep(150);
  const dem = await page.evaluate(() => Store.S.projects.find(p => p.name === 'Convite da festa de fim de ano'));
  await go('demanda/' + dem.id);
  await page.fill('[data-quick="tasks"]', 'Primeira versão'); await page.press('[data-quick="tasks"]', 'Enter'); await sleep(150);
  const linked = await page.evaluate(id => Store.S.tasks.some(t => t.title === 'Primeira versão' && t.projectId === id), dem.id);
  check('Escrita rápida em tarefas, anotações e demandas (sem formulário)', autofocus === 'tasks' && quickTasks === 2 && stillFocused && note && note.body === 'Usar fotos da equipe' && dem && dem.status && linked,
    JSON.stringify({ autofocus, quickTasks, stillFocused, note: note && note.body, dem: !!dem, linked }));

  // senha: outra aba pede a senha; errada não entra, certa entra com os dados
  const tab = await ctx.newPage();
  tab.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await tab.goto(URL + '#demandas');
  await tab.waitForSelector('.lock [name=p1]');
  const hiddenApp = await tab.evaluate(() => getComputedStyle(document.querySelector('.layout')).display === 'none');
  await tab.fill('.lock [name=p1]', 'errada'); await tab.press('.lock [name=p1]', 'Enter');
  await tab.waitForFunction(() => /incorreta/.test(document.querySelector('.lock-msg').textContent));
  await tab.fill('.lock [name=p1]', 'cafe1234'); await tab.press('.lock [name=p1]', 'Enter');
  await tab.waitForSelector('main h1');
  const inside = await tab.evaluate(() => ({ locked: document.body.classList.contains('locked'), lockGone: !document.querySelector('.lock'), demandas: Store.S.projects.length }));
  const savedLock = await tab.evaluate(async () => { const l = await Store.getMeta('lock'); return !!l && !JSON.stringify(l).includes('cafe1234'); });
  await tab.close();
  check('Senha: criação exige 4+ caracteres, outra aba pede a senha, errada é recusada, só o hash é guardado',
    /pelo menos 4/.test(shortMsg) && hiddenApp && !inside.locked && inside.lockGone && inside.demandas >= 1 && savedLock, JSON.stringify({ shortMsg, hiddenApp, inside, savedLock }));

  // bloqueio automático: 10 min parado trava sem recarregar; atalhos não funcionam travado
  await page.evaluate(() => Store.saveSettings({ autoLockMin: 10 }));
  await go('anotacoes');
  await page.keyboard.type('rascunho em andamento');
  await page.evaluate(() => { window.__semRecarregar = 1; });
  await page.clock.runFor(9 * 60 * 1000);
  const aindaAberto = await page.locator('.lock').count() === 0;
  await page.clock.runFor(2 * 60 * 1000); await sleep(100);
  const travou = await page.locator('.lock [name=p1]').isVisible();
  await page.keyboard.press('Alt+KeyN');
  const atalhoTravado = await page.evaluate(() => !document.querySelector('dialog[open]'));
  await page.fill('.lock [name=p1]', 'cafe1234'); await page.press('.lock [name=p1]', 'Enter');
  await page.waitForSelector('.lock', { state: 'detached' });
  const depois = await page.evaluate(() => ({ marca: window.__semRecarregar, texto: document.querySelector('[data-quick="notes"]').value }));
  check('Bloqueio automático após 10 min parado, sem perder o que estava na tela', aindaAberto && travou && atalhoTravado && depois.marca === 1 && depois.texto === 'rascunho em andamento', JSON.stringify({ aindaAberto, travou, atalhoTravado, depois }));
  // atalho com Option/Alt pela tecla física (no Mac, Option+N não gera a letra "n")
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Alt+KeyN');
  const atalho = await page.locator('dialog[open] h2').innerText().catch(() => '');
  await page.keyboard.press('Escape');
  check('Atalho Alt/Option+N abre nova tarefa', /tarefa/i.test(atalho), atalho);

  // migração: um banco da versão 1, com dados, abre na versão 2 sem perder nada
  {
    const mctx = await browser.newContext({ locale: 'pt-BR' }); const mp = await mctx.newPage();
    mp.on('pageerror', e => errors.push('migração: ' + e.message));
    await mp.goto('file://' + path.resolve(__dirname, 'fixtures/banco-v1.html'));
    await mp.waitForFunction(() => document.title === 'pronto');
    await mp.goto(URL);
    await mp.waitForSelector('.lock [name=p1]');
    await mp.fill('.lock [name=p1]', 'migra1234'); await mp.fill('.lock [name=p2]', 'migra1234'); await mp.press('.lock [name=p2]', 'Enter');
    await mp.waitForSelector('main h1');
    const mig = await mp.evaluate(() => new Promise(ok => { const r = indexedDB.open('prancheta'); r.onsuccess = () => { const d = r.result; ok({ version: d.version, stores: [...d.objectStoreNames].sort().join(','), projects: Store.S.projects.map(p => p.name), tasks: Store.S.tasks.length, sessions: Store.S.sessions.length, name: Store.S.settings.name, theme: document.documentElement.dataset.theme || 'claro', accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }); d.close(); }; }));
    await mctx.close();
    check('Migração do banco v1 → v2 preserva dados e configurações', mig.version === 2 && /courses/.test(mig.stores) && /runs/.test(mig.stores) && mig.projects[0] === 'Demanda da versão 1' && mig.tasks === 1 && mig.sessions === 1 && mig.name === 'Pessoa v1' && mig.accent.toLowerCase() === '#52664f', JSON.stringify(mig));
  }

  // cursos e biblioteca: cria pela escrita rápida, estuda com cronômetro, atualiza progresso, arquiva; material por link
  await page.evaluate(() => Store.saveSettings({ autoLockMin: 0 }));
  await go('cursos');
  await page.keyboard.type('Illustrator essencial'); await page.keyboard.press('Enter'); await sleep(150);
  const cid = await page.evaluate(() => Store.S.courses.find(c => c.name === 'Illustrator essencial').id);
  await page.click(`[data-act="study:${cid}"]`); await page.click('dialog[open] button[type=submit]'); await sleep(150);
  await page.clock.runFor(30 * 60 * 1000);
  await page.click('#timer-chip [data-act="session-stop"]'); await sleep(150);
  await page.click('.toast button'); await page.fill('dialog[open] [name=progress]', '35'); await page.fill('dialog[open] [name=nextActivity]', 'Aula 5'); await page.click('dialog[open] button[type=submit]'); await sleep(150);
  const curso = await page.evaluate(id => { const c = Store.S.courses.find(x => x.id === id); return { status: c.status, progress: c.progress, next: c.nextActivity, min: Math.round(Model.courseStudyMs(Store.S, c, Date.now()) / 60000) }; }, cid);
  await page.click(`[data-act="archive:courses:${cid}"]`); await sleep(150);
  const escondido = await page.locator(`[data-act="study:${cid}"]`).count() === 0;
  await go('biblioteca');
  await page.keyboard.type('https://helpx.adobe.com/illustrator/using/keyboard-shortcuts.html'); await page.keyboard.press('Enter'); await sleep(150);
  const mat = await page.evaluate(() => Store.S.resources.find(r => /keyboard-shortcuts/.test(r.url || '')));
  await page.fill('[data-f="q"]', 'shortcuts'); await sleep(350);
  const achou = await page.locator('main .card.resource').count();
  await page.click(`[data-act="res-note:${mat.id}"]`); await page.click('dialog[open] button[type=submit]'); await sleep(150);
  const nota = await page.evaluate(() => Store.S.notes.some(n => n.title.startsWith('Sobre: ')));
  check('Cursos e Biblioteca (estudo cronometrado sem duplicar, progresso, arquivar, busca, anotação a partir do material)',
    curso.status === 'doing' && curso.progress === 35 && curso.next === 'Aula 5' && curso.min === 30 && escondido && mat && mat.type === 'Tutorial' && achou === 1 && nota, JSON.stringify({ curso, escondido, achou, nota }));

  // prática: cria, pratica com cronômetro, envia para avaliação, avalia; exercício a partir de material; evidência inválida é recusada
  await go('pratica');
  await page.keyboard.type('Recriar cartaz suíço'); await page.keyboard.press('Enter'); await sleep(150);
  const xid = await page.evaluate(() => Store.S.exercises.find(x => x.title === 'Recriar cartaz suíço').id);
  await page.click(`[data-act="practice:${xid}"]`); await page.click('dialog[open] button[type=submit]'); await sleep(150);
  await page.clock.runFor(40 * 60 * 1000);
  await page.click('#timer-chip [data-act="session-stop"]'); await sleep(150);
  const praticaToast = await page.locator('.toast').last().innerText();
  await go('pratica');
  await page.click(`[data-act="ex-review:${xid}"]`); await sleep(150);
  await page.click(`[data-act="evaluate:${xid}"]`);
  await page.selectOption('dialog[open] [name=s0]', '4'); await page.selectOption('dialog[open] [name=s1]', '3'); await page.fill('dialog[open] [name=n1]', 'Grid ainda solto');
  await page.click('dialog[open] button[type=submit]'); await sleep(150);
  const ex = await page.evaluate(id => { const x = Store.S.exercises.find(e => e.id === id); return { status: x.status, avg: Model.avgScore(x), min: Math.round(Model.exerciseMs(Store.S, x, Date.now()) / 60000), notas: x.scores.length }; }, xid);
  await page.click(`[data-act="edit:exercises:${xid}"]`);
  await page.fill('dialog[open] [name=evidence]', 'arquivo.psd');
  await page.click('dialog[open] button[type=submit]');
  const evErr = await page.locator('#f-evidence-err').innerText();
  await page.click('dialog[open] [data-close]'); await page.click('dialog.small[open] button[value=yes]');
  await go('biblioteca');
  const rid = await page.evaluate(() => Store.S.resources[0].id);
  await page.fill('[data-f="q"]', ''); await sleep(300);
  await page.click(`[data-act="res-exercise:${rid}"]`);
  const preTitle = await page.inputValue('dialog[open] [name=title]');
  await page.click('dialog[open] button[type=submit]'); await sleep(150);
  const fromRes = await page.evaluate(id => Store.S.exercises.some(x => x.resourceId === id), rid);
  check('Prática (cronômetro, avaliação por critérios, evidência validada, exercício a partir de material)',
    /40 min registrados no exercício/.test(praticaToast) && ex.status === 'done' && ex.avg === 3.5 && ex.min === 40 && ex.notas === 2 && /Link inválido/.test(evErr) && /^Praticar: /.test(preTitle) && fromRes,
    JSON.stringify({ praticaToast, ex, evErr, preTitle, fromRes }));

  // fluxos: modelos iniciais, aplicar com tarefas e prazos (sem duplicar), itens fecham etapa, editar modelo não muda execução, concluir com pendência pede confirmação
  await go('fluxos'); await page.click('[data-act="wf-starter"]'); await sleep(250);
  const tplId = await page.evaluate(() => Store.S.workflows.find(w => w.name === 'Tratamento de imagem').id);
  await go('demandas'); await page.keyboard.type('Fotos do catálogo até 20/11'); await page.keyboard.press('Enter'); await sleep(150);
  const dId = await page.evaluate(() => Store.S.projects.find(p => p.name === 'Fotos do catálogo').id);
  await go('demanda/' + dId);
  await page.click(`[data-act="wf-apply:${dId}"]`);
  await page.selectOption('dialog[open] [name=templateId]', tplId); await page.check('dialog[open] [name=withTasks]'); await page.check('dialog[open] [name=distribute]');
  await page.click('dialog[open] button[type=submit]'); await page.click('dialog.small[open] button[value=yes]'); await sleep(300);
  const r0 = await page.evaluate(id => Store.S.runs.find(r => r.projectId === id), dId);
  for (const it of r0.steps[0].items) { await page.click(`[data-act="run-item:${r0.id}:${r0.steps[0].id}:${it.id}"]`); await sleep(100); }
  const semDuplicar = await page.locator(`[data-act^="run-task:${r0.id}"]`).count() === 0;
  await go('fluxo/' + tplId);
  await page.fill('.wf-step:first-child [name=st-title]', 'Preparação (nova)'); await page.click('.wf-editor button.primary'); await sleep(200);
  await go('demanda/' + dId);
  await page.click(`[data-act="run-status:${r0.id}:done"]`); const pendTxt = await page.locator('dialog.small[open]').innerText(); await page.click('dialog.small[open] button[value=no]');
  const fl = await page.evaluate(([id, tid]) => { const r = Store.S.runs.find(x => x.projectId === id); return { tasks: Store.S.tasks.filter(t => t.runId === r.id).map(t => t.due), step0: r.steps[0].state, title0: r.steps[0].title, runV: r.templateVersion, tplV: Store.S.workflows.find(w => w.id === tid).version, status: r.status }; }, [dId, tplId]);
  check('Fluxos (aplicar com tarefas e prazos, etapa fecha pelos itens, sem duplicar tarefas, modelo editado não muda a execução, pendências confirmadas)',
    fl.tasks.length === 3 && fl.tasks[2] === '2026-11-20' && fl.step0 === 'done' && semDuplicar && fl.title0 === 'Preparação' && fl.runV === 1 && fl.tplV === 2 && /Concluir com pendências/.test(pendTxt) && fl.status === 'active', JSON.stringify({ fl, semDuplicar }));

  // arquivos: nome padronizado e script de pastas que realmente cria a estrutura
  await go('arquivos');
  await page.fill('#fl-demanda', 'Campanha de Natal'); await page.fill('#fl-solicitante', 'Marketing'); await page.fill('#fl-peca', 'Post feed'); await page.fill('#fl-versao', '2'); await page.fill('#fl-data', '2026-11-02');
  const nomeArq = await page.locator('[data-preview-name]').innerText();
  const [dlSh] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="fl-script"]')]);
  const shFile = path.join(os.tmpdir(), 'prancheta-pastas.sh'); await dlSh.saveAs(shFile);
  const pastaTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prancheta-pastas-'));
  require('child_process').execSync('sh ' + shFile, { cwd: pastaTmp });
  const criadas = fs.readdirSync(path.join(pastaTmp, 'Marketing-Campanha-de-Natal')).sort();
  check('Arquivos (nome padronizado e script de pastas que funciona)', nomeArq === 'Marketing_Campanha-de-Natal_Post-feed_V02_2026-11-02.psd' && criadas.length === 7 && criadas[0] === '01_Briefing', nomeArq + ' / ' + criadas.join(','));

  // backup v2: exporta com os registros novos e, ao mesclar o mesmo arquivo, nada duplica e as ligações continuam
  await go('configuracoes');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="export"]')]);
  const file2 = path.join(os.tmpdir(), 'prancheta-e2e-backup-v2.json'); await dl2.saveAs(file2);
  const bk2 = JSON.parse(fs.readFileSync(file2, 'utf8'));
  const antes = await page.evaluate(() => ['courses', 'resources', 'exercises', 'workflows', 'runs', 'tasks'].map(k => Store.S[k].length));
  await page.setInputFiles('#import-file', file2); await page.check('[name=import-mode][value=merge]');
  await page.click('[data-act="import"]'); await page.click('dialog.small[open] button[value=yes]'); await sleep(300);
  const depoisV2 = await page.evaluate(() => ({ n: ['courses', 'resources', 'exercises', 'workflows', 'runs', 'tasks'].map(k => Store.S[k].length), runsOk: Store.S.runs.every(r => Store.S.projects.some(p => p.id === r.projectId)), stepTasksOk: Store.S.tasks.filter(t => t.runId).every(t => Store.S.runs.some(r => r.id === t.runId)) }));
  check('Backup v2 com cursos, materiais, exercícios e fluxos; mesclar não duplica e mantém ligações',
    bk2.version === 2 && bk2.data.courses.length && bk2.data.resources.length && bk2.data.exercises.length && bk2.data.workflows.length && bk2.data.runs.length && JSON.stringify(antes) === JSON.stringify(depoisV2.n) && depoisV2.runsOk && depoisV2.stepTasksOk, JSON.stringify({ antes, depoisV2 }));

  // abrir aplicativos: links oficiais do app Atalhos do Mac, configuráveis; botão de abrir arquivo pelo caminho
  await page.click('#apps-btn');
  const appLinks = await page.$$eval('#apps-menu a', as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]));
  await page.click('#apps-menu [data-act="apps-help"]');
  const ajuda = await page.locator('dialog[open]').innerText(); await page.click('dialog[open] button');
  await go('configuracoes');
  await page.fill('#s-launch', 'Photoshop | Abrir Photoshop\nIllustrator | Abrir Illustrator\nPremiere Pro | Abrir Premiere');
  await page.click('[data-sf="launchers"] button.primary'); await sleep(200);
  await page.click('#apps-btn');
  const appLinks2 = await page.$$eval('#apps-menu a', as => as.map(a => a.getAttribute('href')));
  await page.click('#apps-btn');
  await go('pratica');
  const xid2 = await page.evaluate(() => Store.S.exercises[0].id);
  await page.evaluate(id => { const x = Store.S.exercises.find(e => e.id === id); return Store.save('exercises', { ...x, filePath: '/Users/eu/Trabalho/cartaz final.ai' }); }, xid2); await sleep(150);
  const abrirArq = await page.$eval('main a[href^="shortcuts://"]', a => a.getAttribute('href'));
  check('Abrir aplicativos pelo app Atalhos (links, configuração, abrir arquivo pelo caminho)',
    appLinks[0][1] === 'shortcuts://run-shortcut?name=Abrir%20Photoshop' && /Illustrator/.test(appLinks[1][0]) && /Abrir App/.test(ajuda) && appLinks2.includes('shortcuts://run-shortcut?name=Abrir%20Premiere') &&
    abrirArq === 'shortcuts://run-shortcut?name=Abrir%20arquivo%20da%20Prancheta&input=text&text=%2FUsers%2Feu%2FTrabalho%2Fcartaz%20final.ai', JSON.stringify({ appLinks, appLinks2, abrirArq }));

  // navegação final com dados, sem erros
  for (const r of routes) await go(r);
  await go('solicitante/' + (await page.evaluate(() => Store.S.clients[0].id)));
  check('Navegação por todas as páginas (com dados), sem erros no console', errors.length === 0, errors.join(' | '));

  await page.screenshot({ path: path.join(__dirname, 'saida-dashboard.png'), fullPage: true }).catch(() => {});
  await browser.close();
  console.log(`\n${results.filter(r => r[0] === 'OK ').length}/${results.length} verificações passaram.`);
})().catch(e => { console.error(e); process.exit(1); });
