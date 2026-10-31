# Prancheta

Central de gestão pessoal para trabalho de design gráfico (pensada para designer CLT organizar as demandas que recebe dos setores da empresa): demandas, tarefas, revisões, solicitantes, calendário, controle de jornada, pausas, referências, anotações, relatórios, metas e insights. Roda no navegador, sem servidor e sem instalar nada.

## Como usar

1. Baixe ou copie a pasta `prancheta/` para o computador.
2. Abra o arquivo `index.html` no Chrome, Edge ou Firefox (duplo clique).
3. Use sempre **o mesmo navegador e o mesmo arquivo**. Os dados ficam ligados a ele (veja "Onde ficam os dados").

Se preferir abrir por um endereço local (por exemplo, para fixar como app), qualquer servidor estático serve: `python3 -m http.server` dentro da pasta e acesse `http://localhost:8000`. **Atenção:** o navegador trata `file://…/index.html` e `http://localhost:8000` como lugares diferentes, cada um com seus próprios dados. Para levar os dados de um para o outro, use Exportar e Importar backup.

## Arquitetura

Arquivos estáticos, JavaScript puro, nenhuma dependência e nenhuma etapa de build.

| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura da página, ícones e ordem dos scripts |
| `css/app.css` | Visual: painéis de vidro sobre um quarto ao pôr do sol (fontes Sora e Manrope), cor de destaque configurável, versão clara para impressão |
| `js/model.js` | Regras de negócio puras: datas, cálculo de horas e pausas, progresso, atrasos, metas, relatórios, insights, validação e checagem de backup. Não toca na tela nem no banco, por isso é testado no Node. |
| `js/db.js` | Persistência em IndexedDB, histórico de alterações, registro de atividades, exclusões com relacionamentos, importação e exportação |
| `js/ui.js` | Peças de interface: formulários a partir de uma lista de campos, confirmações, avisos, gráficos em SVG e formatação |
| `js/app.js` | Rotas, barra superior, formulários de cada cadastro, ações de tempo (expediente, sessão, pausa), busca global, lembretes, atalhos e dados de demonstração |
| `js/views-work.js` | Dashboard, Demandas (cards, lista, Kanban, detalhe), Tarefas (lista, Kanban, agenda), Revisões e Solicitantes |
| `js/views-time.js` | Controle de tempo, Pausas e Calendário (dia, semana, mês) |
| `js/views-more.js` | Referências, Anotações, Relatórios, Metas, Insights e Configurações |

Os scripts são clássicos (não módulos ES) de propósito: módulos não carregam quando o arquivo é aberto direto do disco (`file://`).

### Modelo de dados

Cada cadastro tem um `id` único (UUID), `created` e `updated`, e os registros editáveis guardam `history` (as últimas 50 alterações, campo a campo).

- **projects**: nome, `clientId`, categoria, `status` (id de um status configurável), prioridade, início, prazo, horas estimadas, descrição, objetivo, etapas (checklist), links, observações, `statusSince` e `completedAt`
- **tasks**: título, `projectId` e `clientId` (opcionais), status (a fazer, em andamento, aguardando, concluída), prioridade (baixa, média, alta, urgente), início previsto, horário, prazo, estimativa, lembrete, subtarefas, observações e `completedAt`
- **clients** (na tela, Solicitantes): setor, área ou pessoa que pede o trabalho, com contato, e-mail, ramal e observações
- **workdays** (expedientes), **sessions** (sessões de trabalho, com `projectId`, `taskId` e as pausas da própria sessão) e **breaks** (pausas com tipo e duração prevista): todos guardam `start` e `end` como data e hora reais (ms). `end` vazio significa "em andamento".
- **events**: reuniões, entregas, revisões, aprovações e compromissos pessoais, com data, horário e lembrete
- **revisions**: versão enviada, data, feedback, alterações pedidas, status e próxima entrega, ligadas a uma demanda
- **refs**: referência criativa com link, palavras-chave, paleta, tipografia, imagem reduzida e caminho de arquivo
- **notes**: anotações com tipo, etiquetas, fixação e vínculo opcional a demanda e solicitante
- **goals**: meta com métrica calculada (horas na semana ou no mês, demandas concluídas, tarefas, pausas, tarefas dentro do estimado) ou valor manual
- **activity**: registro das ações recentes (limitado a 500)
- **meta/settings**: todas as preferências

### Como o tempo é calculado

- O cronômetro nunca "conta segundos". Ele guarda o horário de início e calcula `agora − início` sempre que a tela atualiza. Por isso, depois de recarregar ou fechar o navegador, o tempo continua certo.
- **Tempo trabalhado** = intervalos das sessões − pausas da própria sessão − pausas registradas que se sobrepõem a elas. Uma pausa nunca conta como trabalho, mesmo que você esqueça a sessão ligada.
- Os resumos separam **expediente**, **trabalhado**, **pausas**, **em demandas**, **sem classificação** (sessão sem demanda) e **expediente sem sessão**.
- Só uma sessão fica ativa por vez. Antes de iniciar outra, o sistema relê o banco (cobre outra aba aberta) e pede confirmação para encerrar a atual.
- Intervalos que passam da meia-noite são divididos entre os dias.

## No Mac

- **Navegador:** Chrome ou Edge são a escolha mais segura para os dados. No **Safari**, a Apple apaga os dados guardados por sites que você não abre há 7 dias (proteção de rastreamento do Safari). Usando todo dia, não acontece; mas férias ou uma semana sem abrir podem apagar tudo. Se usar o Safari, exporte backups com frequência.
- **Como app:** no Chrome, menu ⋮ → Salvar e compartilhar → Criar atalho (marque "Abrir como janela"); no Safari (macOS 14 ou mais novo), Arquivo → Adicionar ao Dock.
- **Atalhos:** `⌥ Option` no lugar de `Alt` (⌥N tarefa, ⌥P demanda, ⌥A anotação, ⌥T cronômetro, ⌥B pausa, ⌥E expediente) e `⌘ Enter` para salvar anotação. A Prancheta mostra os símbolos do Mac nas telas.
- Os testes automáticos rodam no Chrome; o Safari não foi testado automaticamente.

## Onde ficam os dados

- Tudo fica no **IndexedDB deste navegador, neste computador**. As preferências de exibição (modo de visualização, aviso já lido) ficam no `localStorage`.
- **Não há nuvem nem sincronização.** Outro navegador ou outro computador não vê os dados.
- **Limpar os dados do site** (ou do navegador) **apaga tudo.** Janelas anônimas apagam ao fechar.
- Ao abrir, a Prancheta pede ao navegador armazenamento persistente. Em Configurações → Dados você vê se ele concedeu e quanto espaço está em uso.
- Cada gravação só aparece na tela depois que o banco confirma. Se falhar (por exemplo, disco cheio), aparece uma mensagem de erro e nada é perdido em silêncio.
- Abas abertas ao mesmo tempo se avisam a cada mudança (BroadcastChannel) e recarregam os dados.

## Senha e segurança

- **Senha:** no primeiro acesso, a Prancheta pede para criar uma senha (mínimo de 4 caracteres). Depois, ela é pedida ao abrir a Prancheta numa aba ou janela nova, numa tela no estilo da tela de bloqueio do Mac. Recarregar a mesma aba não pede de novo. O cadeado no trilho de ícones trava na hora. Após 5 tentativas erradas, é preciso esperar 30 s. A troca de senha fica em Configurações → Senha.
- **Bloqueio automático:** depois de 10 minutos sem mexer no mouse ou no teclado, a Prancheta trava sozinha (ajustável em Configurações → Bloqueio automático, de 1 minuto a 1 hora, ou nunca). Conta pelo relógio, então vale também quando o Mac dorme e acorda. Travar não recarrega a página: formulário aberto, texto digitado, cronômetro e música continuam como estavam.
- **Como a senha é guardada:** só um hash (PBKDF2-SHA256, 210 mil iterações, sal aleatório), nunca a senha. Ele fica fora do backup.
- **Esqueceu a senha?** Não há recuperação. A tela de senha oferece apagar tudo e começar de novo; um backup exportado pode ser importado depois.
- **Limite:** a senha é uma trava de acesso, não criptografia. Quem tiver o computador destravado e souber usar as ferramentas de desenvolvedor do navegador consegue ler os dados. Proteja também o usuário do computador.
- **A página não envia dados a lugar nenhum:** uma regra de segurança (Content-Security-Policy) só permite o próprio código, as fontes do Google e o player do Spotify, e bloqueia qualquer envio de dados (`connect-src 'none'`) ou imagem de outro site.
- **Backup forjado:** links precisam começar com `https://` (ou `http://`), cores precisam ser hexadecimais e imagens precisam ser as reduzidas pela própria Prancheta. Isso vale no formulário, na importação e na hora de mostrar.
- **Conta do GitHub:** como o site é publicado pelo repositório, quem tomar a conta poderia alterar o código. Mantenha a verificação em duas etapas ligada.

## Backup e recuperação

**Fazer backup:** Configurações → Dados e backup → **Exportar backup completo**. O arquivo `prancheta-backup_AAAA-MM-DD_HHhMM.json` traz todos os registros e as configurações. Guarde-o num lugar seguro (pendrive, Drive, e-mail para você mesmo). Faça isso com frequência.

**Restaurar:** Configurações → Importar backup → escolha o arquivo → **Validar e importar**.

- Antes de alterar qualquer coisa, o arquivo é validado: formato, versão, identificadores repetidos e os mesmos campos obrigatórios dos formulários. Se houver erro, nada muda e a lista de problemas aparece.
- **Mesclar:** adiciona o que é novo e, quando o mesmo registro existe nos dois lados, fica a versão alterada por último. Importar o mesmo arquivo duas vezes não duplica nada.
- **Substituir tudo:** apaga os dados atuais e grava os do arquivo. Antes, um backup dos dados atuais é baixado automaticamente (`antes-da-importacao_…json`).
- A importação acontece numa única transação: ou entra tudo, ou nada.

## Funcionalidades

- **Dashboard:** demandas em andamento, concluídas e atrasadas; tarefas pendentes e concluídas hoje; horas trabalhadas hoje e na semana; pausas de hoje; próximos prazos e compromissos; demandas prioritárias; metas da semana; gráficos de horas por demanda, andamento das tarefas e horas por dia; atividades recentes; atalhos rápidos. Os blocos podem ser ligados e desligados. Quando não há dados, aparece um começo guiado.
- **Demandas:** cadastro completo; cards, lista e Kanban com arrastar entre colunas; filtros (status, categoria, solicitante, prioridade), busca e ordenação; página de detalhe com progresso, horas estimadas e reais, tarefas, revisões, tempo registrado, etapas, links, anotações, referências e histórico de alterações.
- **Tarefas:** subtarefas, lembrete, estimativa e tempo real; lista, Kanban e agenda; filtros por status, prazo, demanda, solicitante e prioridade; ordenação; atrasadas marcadas com uma faixa discreta; cronômetro direto da tarefa; concluir atualiza o progresso do demanda.
- **Revisões e aprovações:** várias versões por demanda, com feedback, alterações e status; lista do que está parado esperando o solicitante.
- **Solicitantes:** só o nome é obrigatório; detalhe com histórico de solicitações, entregas (no prazo ou fora dele), tarefas abertas, aprovações e anotações.
- **Calendário:** dia, semana e mês; prazos, tarefas, eventos, retornos de revisão, expedientes e pausas; arrastar para reagendar; clicar num dia vazio cria um evento; cada tarefa aparece uma única vez.
- **Controle de tempo:** expediente, sessões com demanda e tarefa, pausar e retomar, registro e correção manual (com confirmação e histórico), totais de dia, semana e mês contra o planejado, estimado contra realizado por demanda, saldo de jornada (banco de horas pessoal: expediente − pausas − jornada prevista; o oficial continua sendo o ponto da empresa), histórico por registro ou por dia.
- **Pausas:** tipos configuráveis (curta, longa, almoço e outros), temporizador com anel de progresso e tempo restante, tempo desde a última pausa, totais, histórico e registro manual. A pausa só começa e termina quando você manda.
- **Referências criativas:** link, categoria, palavras-chave, paleta (com amostras), tipografia, imagem e caminho de arquivo; busca e filtros.
- **Anotações:** tipos, etiquetas, fixar no topo, vínculo com demanda e solicitante, busca no título, no conteúdo e nas etiquetas.
- **Relatórios:** filtros por período, demanda, solicitante e categoria; indicadores objetivos separados das leituras interpretativas; gráficos; estimado contra real; demandas acima do previsto; carga das próximas semanas; exportação em CSV (sessões, demandas, tarefas) e versão para impressão.
- **Metas:** horas por semana ou mês, demandas e tarefas concluídas, pausas, tarefas dentro do estimado ou valor manual; progresso atual e histórico dos últimos 6 períodos.
- **Insights:** 12 regras transparentes, cada uma mostrando a regra usada; quando faltam dados, a análise diz o que falta em vez de inventar.
- **Configurações:** nome, jornada e dias de trabalho, tipos de pausa e lembretes, notificações do sistema, categorias, tipos de nota, status de demanda com comportamento, início da semana, formato de data, cor de destaque, blocos do dashboard, limites dos alertas, backup, demonstração e apagar tudo.
- **Navegação:** menu em pílula no topo com as seções principais (Início, Demandas, Tarefas, Anotações, Calendário, Tempo, Relatórios) e um destaque que desliza até a página aberta; trilho de ícones à esquerda com Busca, Revisões, Solicitantes, Pausas, Referências, Metas, Insights e Configurações.
- **Escrita rápida:** Tarefas, Anotações e Demandas abrem com o cursor num campo no topo. Digite e aperte Enter para criar (nas anotações, a primeira linha vira o título e `Ctrl+Enter` salva). O cursor continua no campo para a próxima. Detalhes como prazo e prioridade ficam para depois, clicando no item; o "Formulário completo" continua disponível. Com uma demanda filtrada, ou dentro da página de uma demanda, a tarefa já nasce ligada a ela.
  - Em Tarefas e Demandas, o texto pode trazer prazo, horário e prioridade, que saem do título: `hoje`, `amanhã`, `depois de amanhã`, dias da semana (`sexta`, `segunda-feira`, sempre a próxima, contando hoje), datas `20/12` ou `20/12/2026` (data já passada sem ano vai para o ano seguinte), horários `14h` ou `14:30` (só em tarefas; sem data, o prazo vira hoje) e `!urgente`, `!alta`, `!média`, `!baixa`. Pode vir antes `até`, `para`, `pra`, `na`, `no`, `dia` ou `às`. Ex.: “Enviar arte até sexta 14h !urgente”.
  - Uma prévia ao lado do campo mostra o que foi entendido antes do Enter. Limite: um dia da semana no meio do nome (“Banner da sexta-feira santa”) também vira prazo; a prévia mostra isso, e dá para corrigir depois no item.
- **Geral:** busca global (ícone do trilho ou `/`), menu Novo, cronômetro sempre visível na barra superior, atalhos de teclado (`Alt+N` tarefa, `Alt+P` demanda, `Alt+A` anotação, `Alt+T` cronômetro, `Alt+B` pausa, `Alt+E` expediente), aviso ao fechar com formulário não salvo, confirmação antes de excluir e dados de demonstração marcados com "[Demo]" e removíveis com um clique.

## Limitações conhecidas

- Os dados ficam só neste navegador e computador. Não há nuvem, conta nem acesso pelo celular.
- Lembretes e notificações só funcionam com a Prancheta aberta numa aba. Não há aviso com o navegador fechado.
- O visual é um só (vidro sobre pôr do sol); não há tema claro alternativo na tela. A impressão sai em fundo branco. As fontes Sora e Manrope vêm do Google Fonts: sem internet, o navegador usa a fonte do sistema.
- Tarefas recorrentes e modelos de demanda ainda não existem como recurso. O Insight de "tarefas recorrentes" aponta as repetições para você padronizar.
- O navegador não acessa arquivos do computador por conta própria. Imagens de referência são copiadas reduzidas (até 900 px) para dentro do banco, e o "caminho do arquivo" é só um texto de anotação.
- O calendário da semana lista os itens por horário, sem uma grade de horas desenhada.
- Feito para uso no computador. Funciona em telas menores (o menu em pílula rola na horizontal e o trilho de ícones vai para o rodapé), mas não foi refinado para celular.
- Volumes muito grandes (dezenas de milhares de sessões) deixariam os relatórios mais lentos, porque tudo é calculado em memória.

## Testes

```sh
node --test tests/model.test.js   # regras de cálculo (Node 18+)
node tests/e2e.js                 # fluxos no navegador (precisa do Playwright com Chromium)
```

- `tests/model.test.js`: 17 testes de regras. Cobrem subtração de intervalos, pausa que não conta como trabalho, pausas da sessão, sessão ativa calculada pelo horário real, divisão na meia-noite, tempo desde a última pausa, progresso e atraso, validação, backup (validação e mescla sem duplicar), metas, insights (com e sem dados suficientes), relatório (no prazo e fora do prazo), saldo de jornada e leitura de links do Spotify.
- `tests/e2e.js`: abre `index.html` direto do disco no Chromium, com relógio controlado, e faz 31 verificações dos 15 fluxos exigidos: criar, editar e excluir demanda; criar e concluir tarefa; indicadores do dashboard; filtros e busca; persistência após recarregar; recuperação do cronômetro após recarregar; cálculo de horas e pausas; associação demanda, tarefa e tempo; exportar, mesclar e substituir backup; dados inválidos (formulário e backup); confirmação antes de excluir; ausência de duplicação; calendário nas três visões; relatórios atualizados; navegação por todas as páginas sem erros no console.
