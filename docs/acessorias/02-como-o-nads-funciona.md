# 02 — Como o NADS funciona hoje

Este documento é o retrato do NADS como ele está no código em 17/11/2026: cada aplicativo, cada módulo, o que cada
função faz e em quais arquivos ela mora, os robôs (o que fazem sozinhos e quando) e o fluxo de um mês de trabalho do
escritório, de ponta a ponta. Serve de base para comparar com o Acessórias (documento 01) e para planejar mudanças
(documentos seguintes). Quem for escrever código a partir daqui deve usar os caminhos e nomes como estão escritos;
o que não pôde ser confirmado no código está marcado **(a confirmar)**.

---

## 0. Como ler este documento

**Base da leitura.** Checkout `C:\Users\Pao90\nads-mandei`, ramo `mandei-area-cliente`, sem rodar o app nem os robôs.
A outra cópia, `C:\Users\Pao90\nads` (ramo `conferencia-pelo-saldo`), tem a pasta `robo/` mais antiga: faltam ~31
arquivos, entre eles `mandei.js`, `cartas-fiscal.js`, `boletos-financeiro.js`, `alterdata_fiscal.py` e `pc-alterdata/`.
**Trabalhe sempre no `nads-mandei`.**
**Atenção (revisão de 17/11/2026):** o ramo `mandei-area-cliente` está **79 commits atrás de `origin/desenvolvimento`**
(conferido com `git rev-list --count HEAD..origin/desenvolvimento`). Lá já entraram, entre outros, `robo/whatsapp.js`,
`robo/whatsapp-regras.js`, novos roteiros do Alterdata (`alterdata_balancete_periodo.py`, `alterdata_razao_conta.py`…)
e mudanças em `robo/vigia-robo.js` e `robo/central.js`. Antes de escrever código, traga o `desenvolvimento` para o ramo de
trabalho (com o OK do dono, regra 11) e confira de novo o arquivo que for mexer.

**Abreviações de caminho** (todos relativos à raiz `C:\Users\Pao90\nads-mandei`):

| Sigla | Pasta real |
|---|---|
| `{W}` | `apps/web/src/aplicativos` |
| `{T}` | `apps/web/src/aplicativos/tarefas` |
| `{C}` | `packages/core/src` |
| `robo/` | `robo/` (os robôs, Node e Python) |
| `scripts/` | `scripts/` (publicação, empacotamento, verificações) |

Quando uma linha cita vários arquivos da mesma pasta, a pasta aparece uma vez e os nomes vêm separados por vírgula.

**Correções feitas nas fontes levantadas** (conferidas no código):
- `tarefasDelegadas.firestore.ts`, `avisos.firestore.ts`, `reunioes.firestore.ts` e `convite.firestore.ts` ficam em
  `{T}/dados/`, não no core.
- O Delegador não é mais um item da gaveta: as tarefas delegadas aparecem dentro do **Início** (abas Minhas,
  Delegadas, Concluídas), desde 09/11/2026 (comentário em `{T}/casca/navegacao.ts`). As telas continuam em
  `{T}/telas/delegador/`.
- O app "Contábil" saiu da gaveta em 27/10/2026: a rotina do Contábil é aberta por **Minhas empresas**; a Visão do
  Contábil virou parte de Minhas empresas.
- O "robô do PC" das notas de memória é, no código, o **arquivador do servidor do escritório** (NILMA-SERVER), que
  publica o documento `robo/painelPC`. Existe ainda um terceiro processo, no **PC do escritório**
  (`robo/claude-do-pc.js`), só para o que precisa do Claude instalado. Ver seção 7.

---

## 1. Visão geral da arquitetura

### 1.1 Os aplicativos (pasta `{W}`)

| App | Pasta | Endereço | Quem usa | Login |
|---|---|---|---|---|
| Tarefas (o sistema do escritório) | `{T}` | `/tarefas/...` | equipe | sim (conta do escritório + liberação por computador) |
| Área do Cliente | `{W}/cliente` | `/cliente/<token>/<aba>` | cliente | não: link secreto por empresa (token de 40 letras hexadecimais) |
| Mandei | `{W}/mandei` | `/mandei/<código>` | cliente | não: link do ticket, com prazo |
| Admin | `{W}/admin` | `/admin/<página>` | admin | sim |
| Central dos robôs | `{W}/robos` | `/robos/*` (site robos-nilma) | admin/diretor | sim, com papel ver/comandar/administrar |
| Conversor | `{W}/conversor` | `/conversor/<etapa>` | equipe | não usa banco |

Cada app é publicado como um site próprio do Firebase Hosting por `scripts/sites.mjs` (`npm run sites`).

### 1.2 As camadas (regra 1 e 2 do projeto)

- **Tela** (`*.tsx`): só desenha. Ex.: `{T}/telas/executor/Executor.tsx`.
- **VM** (`use*.ts` ao lado da tela): estado e ações. Ex.: `{T}/telas/executor/useExecutor.ts`.
- **Dados** (`{T}/dados/*.ts`): interface do repositório + versão de exemplo; **o Firebase só aparece em
  `{T}/dados/*.firestore.ts`** (e equivalentes `{W}/<app>/dados/*.firestore.ts`). O `npm run conexoes`
  (`scripts/conexoes.mjs`) falha se outro arquivo tocar o banco ou fizer `fetch` fora da lista de exceções.
- **Regras puras** (`{C}/...`): sem Firebase, com testes vitest (`*.test.ts` ao lado).
- **Robôs** (`robo/`): Node (e Python para o Alterdata), falando com o mesmo Firestore (projeto `entregas-2e5e2`).

### 1.3 Como tela e robô conversam: filas no banco

O padrão é o mesmo em quase tudo: a tela grava um documento "pendente" numa coleção de pedidos; o robô pega o pedido
**em transação** (dois robôs nunca fazem o mesmo pedido), trabalha e responde no próprio documento (andamento,
resultado, erro). Coleções de fila citadas neste documento: `pedidosAlterdata`, `pedidosSieg`, `pedidosFgts`,
`pedidosSituacao`, `nfseEmissoes`, `solicitacoesEmail`, `solicitacoesArquivo`, `enviosSecretario`, `aberturasDrive`,
`leiturasGmail`, `buscasEmail`, `xmlsCliente`, `extratosRecebidos`, `areaClienteChamados`, `areaClienteEnvios`,
`econtadorSaida`, `robosComandos`.

### 1.4 Verificar e publicar

- `npm run verificar` = `tipos` + `lint` + `teste` + `conexoes` + `robo:danfse --conferir` + `robo:cartas --conferir`
  (`package.json`). Pastas soltas na raiz (`capturas/`, `perfil-*`) quebram o lint.
- `scripts/publicacao.mjs` só deixa publicar o que está igual ao ramo `desenvolvimento`; `scripts/versao.mjs` soma 1
  na versão antes de cada publicação.
- Commit, push, merge e publicação: **só com autorização explícita do dono** (regra 11).

---

## 2. Tarefas — o sistema do escritório (`{T}`)

### 2.1 Casca, navegação e acesso

| Função | O que faz | Arquivos |
|---|---|---|
| Mapa das aplicações | Um arquivo só define a gaveta: Início, Minhas empresas, Fiscal, Departamento Pessoal, Entregas (grupo Rotinas); Senhas, Financeiro, Carteira, Administrativo, Configurações, Ferramentas, Desenvolvedor (Escritório); Área do Cliente, Drive, Gmail (Comunicação). `aplicacoesDe` filtra por departamento e nível: Fiscal só Fiscal; DP só DP; Financeiro para Diretor ou quem ele autoriza; Administrativo só Diretor/Dono no modo desenvolvedor; Usuários e Liberação de acessos só Diretor/admin; Desenvolvedor só no modo desenvolvedor. | `{T}/casca/navegacao.ts`, `{T}/rotas.tsx`, `{T}/casca/AplicacaoAberta.tsx` |
| Rotas especiais | `executar/:empresa/:competencia` (executor em tela cheia), `minhas-empresas/empresa/:empresa[/:pagina]`, `cadastro/empresas[/:empresa/:aba]`, `convite/:codigo`, `previa/*`; o resto é `:app/:pagina`. | `{T}/rotas.tsx` |
| Só a minha empresa | Bloqueia, mesmo pelo endereço, a empresa de que a pessoa não é responsável (vale no Fiscal). | `{T}/casca/SoMinhaEmpresa.tsx`, `{T}/telas/empresas/andamento.ts` (`useEmpresasDaPessoa`, `useEmpresasPermitidas`, `SETORES_COM_RESPONSAVEL`) |
| Usuários, cargos e papéis | Cargo = departamento + nível (dono/diretor/sênior/pleno/júnior); departamento e nível geram os papéis; a tabela `ACESSO` diz que papel libera cada recurso. Só o admin cria acesso e muda cargo; só Diretor/Dono exclui, e só usuário inativo sem registros. Mostra online/offline e a etapa em que a pessoa está. | `{T}/telas/cadastro/usuarios/UsuariosDoNads.tsx`, `JanelaDoUsuario.tsx`, `useUsuariosDoNads.ts`, `useNovoUsuario.ts`; `{C}/usuarios/regras/papeis.ts`, `acesso.ts`, `conta.ts`, `exclusao.ts`, `login.ts`, `presenca.ts`; `{C}/usuarios/tipos.ts` |
| Proteção do login por computador | Com a proteção ligada, quem não é admin pede liberação ao entrar num computador novo; o admin vê o pedido em qualquer tela (e recebe push), aprova e passa um código de 6 dígitos; vale até a pessoa sair da conta; pode ser revogado. O Financeiro exige login liberado até do Diretor; ninguém aprova o próprio pedido. | `{T}/telas/acesso/LiberarComputador.tsx`, `AvisosDeLiberacao.tsx`, `LoginLiberadoNoFinanceiro.tsx`, `useLiberacao.ts`; `{C}/usuarios/regras/liberacao.ts`; `robo/avisos-liberacao-nads.js` |
| Entrar | Tela de login e entrada de teste. | `{T}/telas/entrar/Entrar.tsx`, `useEntrar.ts`, `EntradaDeTeste.tsx` |
| Convite por link | O admin gera `/tarefas/convite/<código>`; sem login a pessoa escolhe nome (vira o login) e senha, ou só a nova senha. Convite usado/vencido/inexistente mostra aviso. | `{T}/telas/convite/ConviteDoNads.tsx`, `useConvite.ts`; `{T}/dados/convite.firestore.ts` |
| "Quem está trabalhando?" | Só no modo exemplos (sem login): escolhe o nome na lista para assinar os eventos. | `{T}/telas/quem/QuemSouEu.tsx`, `{T}/casca/operador.tsx` |
| Janela pessoal | Pelo avatar: caixa de entrada (etapas que a pessoa parou, e-mails sem cliente, cobranças, arquivos enviados ao arquivador, pedidos de liberação para o admin), anotações com lembrete, foto/ícone, tema, tela inicial, atualização de versão. | `{T}/telas/pessoal/JanelaPessoal.tsx`, `usePaginaPessoal.ts`, `contexto.tsx`, `iconesDePerfil.ts` |
| Perguntar à IA e FAQ | O chat põe a pergunta numa fila; responde o Claude do PC (`robo/atendente-claude.js`) ou o Gemini da nuvem (`robo/ia-atendente.js`), conforme Ajustes. A FAQ vem de um arquivo que a IA também consulta. | `{T}/telas/pessoal/ChatIA.tsx`, `useChatIA.ts`, `PerguntasFrequentes.tsx`; `{T}/ajuda/faq-tarefas.md`; `scripts/faq-para-ia.mjs` |
| Aviso de certificados | Aviso na casca sobre certificados vencendo. | `{T}/casca/AvisoDeCertificados.tsx`, `useAvisoDeCertificados.ts` |
| Mapa de uso | Coleta visitas por tela e cliques por controle (sem texto digitado nem dado de cliente), grava a cada 5 min em `uso/{dia}`; a tela soma 7/30/90 dias e "Ver os botões" pinta os botões usados/não usados. | `{T}/telas/uso/UsoDoSistema.tsx`, `useUsoDoSistema.ts`; `{T}/casca/ColetaDeUso.tsx`, `MapaNaTela.tsx`; `{C}/uso/index.ts` |
| Feedback da equipe | Feedback com captura de tela, prioridade, Visto/Feito, delegação a quem tem papel desenvolvedor e conversa em balões entre admin e quem mandou. | `{T}/telas/feedback/FeedbacksDoNads.tsx`, `ConversaDoFeedback.tsx`, `useFeedbacks.ts`, `useConversaDoFeedback.ts`, `capturaDeTela.ts`; `{C}/suporte/conversa.ts`, `delegacao.ts` |
| Balão de suporte | Em todas as telas: respostas rápidas que já sabem a tela, a empresa, o período e os botões visíveis; se não resolver, vira ticket de bug que o robô do PC investiga (`robo/suporte-claude.js`). | `{T}/telas/suporte/BalaoDoSuporte.tsx`, `useBalaoDoSuporte.ts`, `JanelaDaConversa.tsx`, `contextoDoSuporte.ts`, `botoesDaPagina.ts`; `{C}/suporte/index.ts` |
| Desenvolvedor › Outros sites | Só no modo desenvolvedor: abre dentro do NADS a Área do Cliente de uma empresa (como o cliente vê) e a Central dos robôs, lendo o banco de verdade e sem gravar nada. | `{T}/telas/desenvolvedor/OutrosSites.tsx`, `useOutrosSites.ts` |

### 2.2 Início (com as tarefas delegadas)

| Função | O que faz | Arquivos |
|---|---|---|
| Painel do Início | Abas Painel, Minhas tarefas, Documentos e Notificações, saudação variável. Calendário do mês com prazos de tarefa, reuniões e feriados/ponto facultativo municipal; o que pede confirmação (presença em reunião, "Recebido" de aviso) fica por cima até a pessoa responder. | `{T}/telas/inicio/InicioNovo.tsx`, `useInicioNovo.ts`, `partes/PainelDoInicio.tsx`, `partes/ListaDoInicio.tsx`, `partes/BuscaDoInicio.tsx`; `{C}/tarefas/regras/agenda.ts`, `saudacao.ts`, `feriados.ts` |
| Mural de avisos | Admin e diretor publicam aviso, reunião, estudo ou comunicado (até 1000 caracteres, link, data, PDF) para todos, setores ou pessoas; podem fixar; aviso com confirmação tem botão "Recebido" e quem escreveu vê quem falta. Coleção `nadsAvisos`. | `{T}/telas/inicio/Inicio.tsx`, `useInicio.ts`, `partes/NotificacoesDoInicio.tsx`; `{C}/tarefas/regras/inicio.ts`; `{T}/dados/avisos.firestore.ts` |
| Reuniões com aprovação | Sênior pede; Diretor/Dono revisa, aprova, recusa ou marca direto. Estados: Em análise → Revisando → Aprovada/Recusada/Remarcada → Em andamento → Finalizada (anexos Problema/Solução) → Concluída (comentário de cada participante) → Encerrada. | `{T}/telas/inicio/partes/ReunioesDoInicio.tsx`, `{T}/telas/inicio/useReunioesDoInicio.ts` (fora de `partes/`); `{C}/tarefas/regras/reunioes.ts`; `{T}/dados/reunioes.firestore.ts` |
| Tarefas avulsas (Delegador) | Qualquer pessoa cria tarefa (título, descrição, até 20 clientes, prioridade, prazo com hora, responsável) para si ou outra; lista agrupada por prazo (Atrasadas, Hoje, Próximos, Depois, Sem prazo); filtra, busca, exporta planilha. Coleção `nadsTarefasDelegadas`. **Não há recorrência nem modelo de tarefa.** | `{T}/telas/delegador/CentralDeTarefas.tsx`, `PaginaDeTarefas.tsx`, `useCentralDeTarefas.ts`, `partes/ListaDeTarefas.tsx`; `{C}/tarefas/regras/delegadas.ts`; `{T}/dados/tarefasDelegadas.firestore.ts` |
| Tarefa aberta | Pendente → Em andamento → Pausada → Concluída/Cancelada; anexos (10 MB cada, 30 MB/20 arquivos por tarefa, em pedaços no banco), pareceres, links fixados, histórico automático. Só quem criou muda prazo/prioridade/clientes e exclui. | `{T}/telas/delegador/TarefaAberta.tsx`, `TarefaAbertaNova.tsx`, `useTarefaAberta.ts`, `partes/AnexosDaTarefa.tsx`, `partes/LinhaDoTempoDaTarefa.tsx` |
| Cronômetro pelo expediente | Fora do expediente (seg–qui 07:00–11:05 e 13:00–18:05; sex até 17:05; sem expediente sáb/dom/feriado de Taiobeiras) a tarefa aparece "Pausada até…"; o tempo trabalhado soma só o expediente. | `{C}/tarefas/regras/delegadas.ts` (`EXPEDIENTE`, `situacaoNoHorario`, `minutosTrabalhados`), `{C}/tarefas/regras/feriados.ts`; `{T}/telas/delegador/useAgoraDoExpediente.ts` |
| Cobrança de atualização | Quem delegou cobra pelo sino; quem faz vê uma janela por cima até responder, podendo pedir +5/+10 min com justificativa (**ainda só no modo desenvolvedor**). | `{T}/casca/useJanelaDaCobranca.ts`, `JanelaDaCobranca.tsx`; `{C}/tarefas/regras/delegadas.ts` (`podeCobrar`, `cobrancasRecebidas`, `problemaDoAdiamento`) |
| Documentos (enviar/requerer) | Enviar arquivo/link a pessoas, com download em .zip e confirmação de recebimento (lembrete a cada 10 min depois de visualizado); Requerer: a pessoa anexa e quem pediu confirma ou contesta. | `{C}/tarefas/regras/delegadas.ts` (`acoesDosDocumentos`, `situacaoDosDocumentos`, `LEMBRETE_DE_RECEBIMENTO_MS`); `{T}/telas/delegador/useLembreteDoRecebimento.ts` |
| Correio de tarefas | Ícone no pé da gaveta com o número de tarefas abertas e aviso na tela por tarefa nova (as já avisadas ficam no navegador). Tarefa a office boy com "Entrega" marcada vai para as Solicitações do Entregas. | `{T}/casca/useCorreioDeTarefas.ts`, `{T}/telas/delegador/partes/CorreioDeTarefas.tsx`; `{C}/entregas/solicitacoes.ts` (`solicitacaoDaTarefa`) |

### 2.3 Minhas empresas, empresa e período

| Função | O que faz | Arquivos |
|---|---|---|
| Lista com andamento | Competência, busca (`/`), filtro de situação; por empresa: etapas feitas/total, situação (Parada, Em andamento, Não iniciada, Concluída), etapa atual, "há 5 horas". Ícones abrem Justificativas (etapas paradas com motivo) e Configurações (históricos do Creditor). **Sem coluna de prazo ou atraso.** | `{T}/telas/empresas/MinhasEmpresas.tsx`, `useMinhasEmpresas.ts`, `andamento.ts`, `partes/JanelaDeMinhasEmpresas.tsx`; `{C}/tarefas/regras/quando.ts` |
| Filtro por responsável | No Fiscal cada um vê só as empresas em que é o responsável do setor; admin, diretor e contas liberadas veem todas. Contábil aberto a todos; DP sem responsável por empresa. | `{T}/telas/empresas/andamento.ts`, `{T}/casca/SoMinhaEmpresa.tsx` |
| Competência em calendário | Janela com grade de 12 meses (só de 2026 em diante e meses já começados). | `{T}/telas/empresas/partes/JanelaDaCompetencia.tsx` |
| Trocas de carteira | Cartão "Trocas para você responder" (ver 2.10). | `{T}/telas/cadastro/responsaveis/TransferenciasPendentes.tsx`, `useTransferenciasPendentes.ts` |
| Página da empresa | Situação, competência e botão do executor; aba Tarefas (cada etapa com quem, quando e por que parou); aba Visão geral (números, histórico dos meses, arquivos do Extrator, iniciar em lote). A barra lateral leva ao Drive, às ferramentas do Fiscal da empresa e à página Alterdata. | `{T}/telas/empresa/EmpresaTarefas.tsx`, `useEmpresa.ts`; `{T}/casca/EmpresaAberta.tsx`, `useEmpresaAberta.ts` |
| Alterdata da empresa | "Pedir ao robô": fila `pedidosAlterdata`; o robô do servidor devolve balancete (.xlsx) e razão de todas as contas (.csv), com posição na fila e barra de andamento. | `{T}/telas/contabil/alterdata/AlterdataDaEmpresa.tsx`, `useAlterdataDaEmpresa.ts`; `{T}/dados/alterdata.ts`, `alterdata.firestore.ts`; `robo/alterdata.js` |
| LCDPR (produtor rural) | Lançamentos por mês: notas do SIEG (ou relatórios), classificação por regra de NCM, conta de pagamento por linha, lançamento manual, planilha `Lancamentos_LCDPR.xls`; cadastros (categorias, regras, plano, tabelas) e configuração. | `{T}/telas/empresa/lcdpr/*`; `{C}/lcdpr/` (`classificar.ts`, `mes.ts`, `sieg.ts`, `planilha.ts`, `historicos.ts`, `manual.ts`); `{C}/tarefas/rotinas/lcdpr.ts` |
| Período ("Quais meses?") | Ao iniciar, De e Até: mesmo mês = um mês; diferentes = Em lote (até 24 meses). O período fica gravado em cada mês (`execucao.periodo`); só a Importação troca o período. | `{T}/telas/periodo/JanelaDoPeriodo.tsx`, `usePerguntaDoPeriodo.ts`; `{T}/telas/executor/partes/SeletorDoPeriodo.tsx`, `PeriodoDaTarefa.tsx`; `{C}/tarefas/regras/competencias.ts` |

### 2.4 Rotinas e Executor (o coração do trabalho mensal)

**Modelo.** Cada departamento tem uma **Rotina** = lista ordenada de **Etapas**. Para cada empresa + competência +
departamento existe uma **Execução** com o estado de cada etapa (pendente, feita, dispensada, interrompida). Etapa pode
ter tela própria, checklist ordenado, objeções (motivos de travar, com solução sugerida), filtro por regime
(`Etapa.regimes`), por mês do ano (`Etapa.meses`) e por obrigação do DP. Tudo vira **Evento** só-acrescentado (início,
feita, dispensada, interrompida, reaberta, valor…) com pessoa e hora. **O tipo `Etapa` não tem campo de prazo.**

| Peça | Arquivos |
|---|---|
| Tipos e regras da execução | `{C}/tarefas/tipos.ts`, `{C}/tarefas/regras/execucao.ts`, `gravacaoDaExecucao.ts`, `verificacao.ts` |
| Rotina do Contábil | `{C}/tarefas/rotinas/contabil.ts` (grupos Preparação, Ativo, Passivo, Resultado; etapas entram/saem pelo Cadastro e pelo balancete) |
| Rotina do LCDPR (uma etapa) | `{C}/tarefas/rotinas/lcdpr.ts`; escolha da rotina em `{C}/tarefas/rotinas/rotinaDo.ts` |
| Rotina do Fiscal | `{C}/tarefas/rotinas/fiscal.ts` (Relatório inicial, Importação de notas, Conferência, Apuração por regime, Obrigações, Certidões trimestrais, Anuais, Envio). **Vencimento só como texto na descrição** ("vence dia 20"). O próprio arquivo diz ser o único lugar a mexer para mudar obrigações. |
| Rotina do DP e prazos legais | `{C}/tarefas/rotinas/dp.ts`; `{C}/tarefas/regras/prazosDoDp.ts` (5º dia útil, dia 15, dia 20, antecipando em fim de semana e feriado nacional, com a fonte legal); obrigações por cliente em `{C}/empresas/dp.ts`. **É o único setor com prazo calculado e "atrasado".** |
| Visão de cima | `{C}/tarefas/regras/visao.ts` (quantas empresas fizeram cada etapa, objeções que mais travam, tempo por etapa); `{T}/telas/contabil/VisaoContabil.tsx`, `useVisaoContabil.ts` |

**Executor** (`/tarefas/executar/<empresa>/<competência>`):

| Função | O que faz | Arquivos |
|---|---|---|
| Tela cheia por etapa | Barra lateral com as etapas em checklist; a página é a ferramenta da etapa da vez; quando a tela diz que não falta nada, a etapa ganha o check e a próxima libera. Etapa feita abre para rever; Editar pergunta antes de desmarcar; empresa concluída pode ser reaberta (quem e quando). | `{T}/telas/executor/Executor.tsx`, `useExecutor.ts`, `etapas/TelaDaEtapa.tsx`, `etapas/contexto.tsx`, `etapas/ponte.tsx` |
| Interromper / Não se aplica / check laranja | ✕ Interromper com motivos (objeções + outro + observação); "Não se aplica" conclui com motivo; check laranja marca feita com pendência registrada. O check automático pelos arquivos do Extrator existe mas está **desligado** (`CONFERIR_NO_PROXIMO = false` em `useExecutor.ts`). | `{T}/telas/executor/useExecutor.ts`; `{C}/tarefas/regras/execucao.ts`, `verificacao.ts` |
| O que falta | Sino com uma linha por pendência e "Resolver" que leva ao ponto. Menu da rotina com grupos e o período em lote. | `{T}/telas/executor/partes/OQueFalta.tsx`, `partes/MenuDaRotina.tsx` |
| Delegar uma etapa | Popup: para quem, todas as contas ou específicas, observação; cria tarefa delegada ligada à etapa/empresa/período; quem recebe vê só as contas pedidas; quem delegou vê o progresso. | `{T}/telas/executor/etapas/delegacao/useDelegacaoDaEtapa.ts`, `JanelaDelegar.tsx`, `FaixaDelegado.tsx`; `{C}/tarefas/regras/delegadas.ts` (`EtapaDelegada`) |
| Tarefa em conjunto | Distribui as etapas que faltam entre pessoas (marca "conjunto"); cada um vê só as suas. | `{T}/telas/executor/etapas/delegacao/useDelegarEmConjunto.ts`, `JanelaEmConjunto.tsx` |
| Onde estou | Grava em `usuarios/{uid}.nadsOnde` a empresa, etapa e período (com o ponto de online, a cada 10 min, aba visível). | `{T}/telas/executor/useOndeEstou.ts`, `ondeEstou.tsx`; `{C}/usuarios/regras/presenca.ts` |
| Guia do mês para o cliente | O PDF solto na etapa é lido (vencimento, valor) e sobe pelo banco para `Claudio Secretario/<mês>/<cliente>` no Drive; o robô arquiva e publica na Área do Cliente. | `{T}/telas/executor/useGuiaParaSubir.ts`, `partes/GuiaParaSubir.tsx`; `{C}/entregas/secretario.ts` |
| Envio do mês pelo Mandei | Em Clientes e Fornecedores, as contas marcadas vão num único ticket do Mandei. | `{T}/telas/executor/etapas/clientes/EnvioDoMes.tsx`, `useEnvioDoMes.ts` |
| Checklist da folha e INSS/FGTS | Itens da folha do balancete marcados em ordem (tiques **só no navegador**); importa razão (XLS) e guias (PDF) e compara provisão × guia × pagamento; gera .xls para o Alterdata. | `{T}/telas/executor/useChecklistDaFolha.ts`, `useInssDaEtapa.ts`, `useFgtsDaEtapa.ts`, `useRazaoDaFolha.ts`, `usePagamentosDoProLabore.ts`, `partes/InssDaEtapa.tsx`, `partes/FgtsDaEtapa.tsx` |
| Checklist "disfarçado" do Fiscal | Cada tarefa fiscal é uma faixa com painel (CFOP, NCM/CST, retenções, faturamento × SIEG, prévia do DAS), "Importar relatórios do Alterdata" e "Conferido" em ordem; o painel do SIEG pede ao robô contagem, XMLs e sequência; XMLs do cliente podem ser soltos ali. | `{T}/telas/executor/partes/ChecklistDisfarcado.tsx`, `partes/PainelDaTarefa.tsx`, `usePainelDoFiscal.ts`, `useSiegDaEtapa.ts`, `useXmlsDoCliente.ts`; `{C}/tarefas/painel/index.ts` |

**Etapas com tela própria** (pastas em `{T}/telas/executor/etapas/`): `importacao`, `cheque`, `conferencia`,
`consulta`, `creditor`, `cartoes`, `vendas`, `caixabancos`, `bancos`, `clientes`, `fornecedores`, `adiantamento`,
`adiantamentosalarial`, `bens`, `salarios`, `prolabore`, `honorarios`, `simples`, `emprestimos`, `resultado`, `lcdpr`,
`delegacao`. As ferramentas maiores vivem em `{T}/etapas/` (`extrator`, `conferencia`, `creditor`, `cartoes`,
`conciliadorzinho`).

### 2.5 Contábil (as ferramentas dentro das etapas)

| Função | O que faz | Arquivos |
|---|---|---|
| Extrator (leitura de extratos) | Lê PDF (texto com posição, OCR de reserva), OFX, Excel, CSV no navegador; guarda os lançamentos; leitor versionado; pré-verificação descarta faturas e aplicações. Conferência extrato × razão em várias passadas (mesmo dia e valor, duplicados, total do dia, data próxima, sinal trocado, valor diferente, faltando, a mais) e "o que corrigir no razão" + lançamentos sugeridos. | `{C}/extratudo/extrator/regras/extrato.ts`, `conferencia.ts`, `correcoes.ts`, `lancamentosParaOSistema.ts`, `preVerificacao.ts`, `importacao.ts`; `{C}/extratudo/extrator/arquivos/leitura.ts`, `pdf.ts`; `{T}/etapas/extrator/telas/` |
| Conferência pelo saldo impresso | Quando o PDF tem coluna Saldo ou "saldo do dia", confere saldo anterior + lançamentos = saldo impresso, em qualquer banco, e marca a leitura que não fecha. | `{C}/extratudo/extrator/tipos.ts` (`ConferenciaPeloSaldo`), `regras/saldoDoPeriodo.ts` |
| Releitura dos extratos (admin) | Relê com o leitor atual os extratos do Drive de todas as empresas, uma por vez, sem trocar leitura que fechava por uma que não fecha. | `{T}/telas/configuracoes/releitura/ReleituraDosExtratos.tsx`, `useReleituraDosExtratos.ts`; `{C}/releitura.ts`; `{C}/extratudo/extrator/regras/releituraGeral.ts` |
| Entrada automática de extratos | Extratos que chegam por Gmail/Drive entram sozinhos na linha do banco certo; buscar no Drive/e-mail; vários meses de uma vez; comprovantes por banco e mês; razões pedidos ao robô do Alterdata; "Pedir extratos" monta e-mail e WhatsApp ao cliente. | `{T}/etapas/extrator/telas/tarefa/useRecebidosPorEmail.ts`, `useDriveDaLinha.ts`, `useEnviarVariosMeses.ts`, `useComprovantes.ts`, `useRazaoDoRobo.ts`, `usePedirExtratos.ts`, `useConfirmarBancos.ts`; `{C}/extratudo/extrator/regras/recebidos.ts`, `comprovantes.ts`, `pedido.ts` |
| Cheque especial | Dias com saldo negativo que o razão não tem viram .xls de importação (ajuste e estorno). | `{C}/extratudo/extrator/regras/chequeEspecial.ts`, `{C}/extratudo/cheque-especial/`; `{T}/telas/executor/etapas/cheque/useChequeEspecial.ts` |
| Conferência fiscal ("Concilia aí") | Balancete + Entradas/Saídas/Tomados/Prestados do Alterdata; concilia notas × saldo da conta; lançamento fora do padrão do CFOP; à vista × a prazo; "Verificar por conta"; notas faltando viram lançamentos no layout de 10 colunas. | `{C}/conferencia/regras/conciliacao.ts`, `divergencias.ts`, `verificarConta.ts`, `lancamentosFaltando.ts`, `pendenciasFiscais.ts`, `vendaVista.ts`, `alterdata.ts`; `{T}/etapas/conferencia/telas/` |
| Creditor (liquidação de cobrança) | Lê o relatório do banco, acha a conta de cada cliente e gera o .xls de 10 colunas; depois confere o saldo dia a dia contra o extrato. | `{C}/extratudo/creditor/`; `{T}/etapas/creditor/telas/` |
| Cartões e Vendas no cartão | Fatura em PDF → razão do cartão casando com notas de entrada; vendas por bandeira conciliadas (bruto e taxa). Só para empresas marcadas no Cadastro. | `{C}/extratudo/cartoes/index.ts`, `{C}/conciliadorzinho/index.ts`; `{T}/etapas/cartoes/telas/compras/useCompras.ts`, `{T}/etapas/conciliadorzinho/telas/` |
| Conferências de contas | Clientes/Fornecedores pelo balancete dinâmico (e envio pelo Mandei); Adiantamentos, Empréstimos, Salários/INSS, Pró-labore, Honorários pelo razão mês a mês; FGTS/INSS razão × guias; Simples a recolher × pagamento; Caixa × Bancos; Despesas e receitas com sinal trocado; Bens pelos CFOPs. | `{T}/telas/executor/etapas/*`; `{C}/extratudo/clientes/`; `{C}/tarefas/regras/fgts.ts`, `inss.ts`, `caixaNoBanco.ts`, `bens.ts`, `emprestimos.ts`, `simples.ts` |
| Configurações de históricos | Códigos de histórico do Creditor e textos das etapas que exportam Excel, com "voltar ao padrão". | `{T}/telas/contabil/configuracoes/ConfiguracoesContabil.tsx`, `useConfiguracoesContabil.ts`; `{C}/tarefas/regras/historicosDoContabil.ts` |

### 2.6 Fiscal (`{T}/telas/fiscal/`)

| Função | O que faz | Arquivos |
|---|---|---|
| Relatório Simples / Lucro Presumido | Uma tabela por regime, linha por empresa: valor de cada tributo (DAS, ICMS antecipado, ST, PIS, COFINS, IRPJ, CSLL, ICMS, ISS, IBS, CBS, parcelamento), data, conferências em bolinhas, como a guia foi entregue (impresso, WhatsApp, e-mail, eContador, SCI Report). Exporta Excel e imprime protocolo; só Fiscal e admin gravam. Coleção `controleTributos`. | `relatorio/RelatorioGeral.tsx`, `useRelatorioGeral.ts`, `PartesDoRelatorio.tsx`; `{C}/tarefas/regras/controleDeTributos.ts`, `protocoloDeTributos.ts`; `{T}/dados/controleTributos.firestore.ts` |
| Enviar guias em lote | Sobe os PDFs; o robô lê (cliente, tributo, competência, valor); revisão por cliente; Disparar: e-mail pelo Gmail, ou entrega impressa no Entregas, ou WhatsApp por `wa.me` com o texto do modelo (manual); grava no Drive e preenche valor, data e "Entregue" no Relatório. Abas Para enviar / Enviados / Modelo do e-mail (`config/envioFiscal`). | `relatorio/JanelaDasGuias.tsx`, `useEnvioDeGuias.ts`; `{T}/dados/loteFiscal.ts`, `loteFiscal.firestore.ts`; `{C}/areaCliente/leitorDeGuia.ts`; `robo/lote-fiscal.js` |
| REINF | Empresas obrigadas, "transmitida até", última transmissão, retificadas; Transmitir marca a REINF no painel do DP e avisa por push o responsável do DP. **Estado ainda no navegador** (o código diz "por enquanto, sem o banco"). | `reinf/Reinf.tsx`, `useReinf.ts`, `useAcoesDaReinf.ts`; `{C}/tarefas/reinf/reinf.ts`; `robo/avisos-reinf-nads.js` |
| SIEG | Contar e baixar XMLs pelo robô do servidor; painel de saídas, entradas, serviços, CT-e, resumo por CFOP/CST/NBS, sequência das saídas (buracos e canceladas); clicar abre a DANFE. | `sieg/BaixarDoSieg.tsx`, `useBaixarDoSieg.ts`; `{C}/tarefas/sieg/index.ts`, `painel.ts` |
| Ver a nota | NF-e/NFC-e em DANFE desenhada do XML; NFS-e no espelho do serviço; CT-e no espelho de itens; XML completo pedido ao robô pela chave. | `partes/VerANota.tsx`, `JanelaDaDanfe.tsx`, `danfePdf.ts`, `useDanfeOriginal.ts`, `useNotaOriginal.ts`, `EspelhoDaNota.tsx`, `EspelhoDoServico.tsx`; `{C}/tarefas/sieg/danfe.ts`, `espelho.ts` |
| SINTEGRA | Lê o arquivo do Convênio ICMS 57/95, acha empresa e período, resume por CFOP, aponta erros e confere com XMLs do SIEG e com o Alterdata. Roda no navegador, não guarda. | `sintegra/LeitorSintegra.tsx`, `useLeitorSintegra.ts`, `PaginaSintegra.tsx`; `{C}/tarefas/sintegra/index.ts` |
| Faturamento dos clientes | Cliente × mês, total e variação, pelas NF-e/NFC-e do SIEG; detalhe por comprador ou CFOP e despesas do balancete. | `faturamento/FaturamentoDosClientes.tsx`, `JanelaDoFaturamento.tsx`, `useFaturamentoDosClientes.ts`, `useDetalheDoFaturamento.ts`; `{C}/tarefas/sieg/faturamento.ts` |
| Rateio de frete | Rateia o CT-e pelas NF-e transportadas, por tributação e NCM, em centavos. | `rateio/RateioDeFrete.tsx`, `useRateioDeFrete.ts`; `{C}/tarefas/sieg/rateio.ts` |
| Calculadora do Simples | RBT12, receita segregada, anexo, Fator R; alíquota efetiva, DAS e aviso de sublimite. É prévia; vale o PGDAS-D. | `simples/CalculadoraDoSimples.tsx`, `useCalculadoraDoSimples.ts`; `{C}/tarefas/sieg/calculadora.ts`, `simples.ts` |
| Antecipação ICMS-ES | Notas interestaduais do SIEG, cálculo linha a linha, relatório técnico e PDF simples para o cliente. | `antecipacao/AntecipacaoIcms.tsx`, `useAntecipacaoIcms.ts`, `relatorioDoClientePdf.ts`; `{C}/tarefas/sieg/antecipacao.ts` |
| Auditoria de itens | Planilha de produtos auditada por NCM/CFOP/CST/CEST: PIS/COFINS e ICMS-ST MG. | `auditoria/AuditoriaDeItens.tsx`, `useAuditoriaDeItens.ts`; `{C}/tarefas/auditoriaItens/regras.ts`, `planilha.ts` |
| Cartas aos clientes | Carta de balanço (o robô assina com o certificado do escritório e envia) e Checklist mensal (o robô manda no último dia útil). **Travado** no robô (`LIBERADO_PARA_CLIENTES = false` em `robo/cartas-fiscal.js`). | `cartas/CartasDoFiscal.tsx`, `useCartasDoFiscal.ts`, `cartaDeBalancoPdf.ts`; `{C}/cartasFiscal/index.ts` |
| Painel do Fiscal | Por cliente: etapa, notas no SIEG, buracos, notas que faltam no Alterdata, valores que não batem, tributação a revisar; prévias de PIS/COFINS, ICMS, IRPJ/CSLL. | `painel/PainelDoFiscal.tsx`, `useVisaoDoFiscal.ts`; `{C}/tarefas/sieg/conferencia.ts`, `lucro.ts` |

### 2.7 Departamento Pessoal (`{T}/telas/dp/`)

| Função | O que faz | Arquivos |
|---|---|---|
| Início/Obrigações (tabelão) | Por competência: clientes do DP × obrigações agrupadas (Folha, eSocial S-1200/S-1210/S-1299, Guias DCTFWeb/DARF/FGTS, REINF, Entrega); clicar na bolinha marca feita com quem e quando. "Atrasado" pelos prazos legais. Em nov/dez, interruptor do 13º. | `PainelDoDp.tsx`, `usePainelDoDp.ts`, `abasDoPainel.ts`, `DecimoTerceiro.tsx`, `useDecimoTerceiro.ts`; `{C}/tarefas/regras/prazosDoDp.ts`, `decimoTerceiro.ts` |
| Resumo do mês | Números, barras por responsável, enquadramento e movimento, progresso de cada pessoa. | `PainelDoDp.tsx` (aba `resumo`) |
| FGTS Digital | Marca clientes com folha e manda emitir (ou ensaio); o robô emite como procurador e devolve o PDF; tela mostra fila e passos. | `FgtsDoDp.tsx`, `useFgtsDoDp.ts`; `{T}/dados/fgts.ts`, `fgts.firestore.ts` |
| Envios ao cliente | O robô acha na pasta do cliente os documentos do mês (folha, DARF, FGTS) e manda por Gmail num clique (um ou todos), com modelo editável (`config/envioDp`); marca sozinho a Entrega nas Obrigações. | `EnviosDoDp.tsx`, `useEnviosDoDp.ts`; `{T}/dados/enviosDp.ts` (`MODELO_PADRAO_DO_ENVIO`); `{C}/tarefas/regras/enviosDoDp.ts`; `robo/envios-do-dp.js` |
| Lote do DP | Sobe vários PDFs; o robô lê cliente/tipo/competência/valor; revisão e disparo; arquivos ao Drive; FGTS e INSS alimentam a execução do DP. | `JanelaDoLote.tsx`, `useLoteDoDp.ts`; `{T}/dados/loteDp.ts`; `robo/lote-dp.js` |
| Configurações do DP | Parâmetros por cliente (movimento, obrigações do mês, forma de entrega, agrupamento) partindo da planilha `{C}/empresas/dp.ts`, marcando o que mudou. | `ConfiguracoesDoDp.tsx`, `useConfiguracoesDoDp.ts`, `useClientesDoDp.ts`, `useDocumentosDoDp.ts` |
| Legislação e etiquetas | Base de textos pesquisável; etiquetas de folha em A4 (sugere o 5º dia útil). | `LegislacaoDoDp.tsx`, `useLegislacaoDoDp.ts`, `JanelaDasEtiquetas.tsx`, `useEtiquetasDaFolha.ts` |

### 2.8 Entregas (`{T}/telas/entregas/`)

Usa os **mesmos documentos do banco do Entregas antigo** (`{T}/dados/entregasDeDocumentos.ts`, `.firestore.ts`); as regras
puras ficam em `{C}/entregas/`.

| Função | O que faz | Arquivos |
|---|---|---|
| Nova entrega | Modo Preparar rota ou Pelo link do cliente; cliente, competência, documentos com valor, honorário com PIX/QR, PDF da guia; o leitor acha cliente, tipo, competência, vencimento, valor e linha digitável/PIX. Vencimento automático para DAS, FGTS, DARF, eSocial e 13º; "Puxar guias da pasta"; "repetir o mês passado". | `NovaEntrega.tsx`, `useNovaEntrega.ts`, `arquivosDaEntrega.ts`; `{C}/entregas/documentos.ts`, `guiasDoPdf.ts`, `confirmacaoDaEntrega.ts` |
| Rota do office boy | Paradas em ordem (arrastada, fixa ou proximidade), agrupando cliente/endereço; previsão pelo ritmo; avisos (fora do horário, dia errado, 2ª tentativa); ler guia pela câmera; Protocolo; Ordem fixa; Qualidade da base. | `RotaDeEntregas.tsx`, `useRotaDeEntregas.ts`; `{C}/entregas/rotaDeEntregas.ts` |
| Vencendo e Obrigações do mês | "Vencendo": paradas com vencimento em até 7 dias ou vencidas. "Obrigações do mês": 5 próximas datas fixas do escritório (padrão FGTS/DAE dia 7, ICMS dia 9, DARF/INSS e DAS dia 20; `config/obrigacoes`). **Não é por cliente.** | `{C}/entregas/rotaDeEntregas.ts` (`vencimentosDaRota`, `OBRIGACOES_PADRAO`, `obrigacoesDoMes`) |
| Confirmar a entrega | Quem recebeu, assinatura (na tela ou no celular do cliente por QR de uso único), foto, localização (acusa divergência), PIX; "cliente ausente" com motivo e foto; várias paradas com uma assinatura; fila offline. | `JanelaDaParada.tsx`, `useJanelaDaParada.ts`, `JanelaDasJuntas.tsx`, `useJanelaDasJuntas.ts`, `JanelasPequenas.tsx`, `localizacao.ts`, `useFaixaDasGravacoes.ts` |
| Painel do mês | Lista com busca e situação, PDF e planilha, "sem entrega há tempo" (3 competências), por dia, ranking com meta, mapa. | `PainelDeEntregas.tsx`, `usePainelDeEntregas.ts`; `{C}/entregas/numerosDasEntregas.ts` |
| Página do cliente e link público | Resumo, entregas mês a mês, cadastro, Receita, contatos, documentos (papéis com validade), ações (localização, aglutinar, criar/enviar/trocar o link público `portais/{token}` com as entregas e o PIX). | `JanelaDoCliente.tsx`, `useJanelaDoCliente.ts`, `JanelasDoCliente.tsx`, `useJanelasDoCliente.ts`; `{C}/entregas/clienteDaEntrega.ts` |
| Protocolos para imprimir | Protocolo da parada, da rota, das escolhidas, do mês do cliente (com QR), fechamento do dia, extrato do mês. | `papeisParaImprimir.ts`; `{C}/entregas/rotaDeEntregas.ts` (`fechamentoDoDia`, `protocolosVisiveis`), `clienteDaEntrega.ts` (`retratoDoProtocolo`) |
| Solicitações para a rua | Pedido de entregar, buscar ou atestado, com "Concluir até" (padrão 2 dias) e prioridade; o office boy vê a fila inteira. | `Solicitacoes.tsx`, `useSolicitacoes.ts`; `{C}/entregas/solicitacoes.ts` |
| 13º do DP para a rota | Empresas do DP com 13º marcado viram paradas com vencimento legal (30/11 ou 20/12). | `JanelaDoDecimoDoDp.tsx`, `useJanelaDoDecimoDoDp.ts`; `{C}/entregas/decimoDoDp.ts` |

### 2.9 Área do Cliente e Mandei — o lado do escritório (app `area-cliente` da gaveta)

| Página | O que faz | Arquivos |
|---|---|---|
| Link do cliente (na janela da empresa) | Gerar, copiar, enviar por WhatsApp, trocar ou revogar o link secreto (admin/diretor); subir a logo. | `{T}/telas/area-cliente/LinkDoClienteNaEmpresa.tsx`, `useLinkDaEmpresa.ts`, `useAcoesDoLink.ts`, `logoDaEmpresa.ts`, `partes/BlocoDoLink.tsx`, `partes/BotoesDoLink.tsx`; `{C}/areaCliente/logo.ts` |
| Solicitações | As solicitações abertas pelo cliente, filtro por situação (aberto, em andamento, respondido, concluído), busca, responder (vai para "respondido") e concluir. **Sem chat**: pedido + resposta; conversa pelo WhatsApp. | `{T}/telas/area-cliente/ChamadosDoCliente.tsx`, `useChamadosDoCliente.ts`, `partes/PedidoDoChamado.tsx`; `{C}/areaCliente/chamados.ts` |
| Recebidos | Arquivos que o cliente mandou e a pasta do Drive em que o robô guardou. | `{T}/telas/area-cliente/RecebidosDoCliente.tsx`, `useRecebidosDoCliente.ts`; `{C}/areaCliente/envios.ts` |
| Meus tickets / Central de tickets (Mandei) | Tickets enviados ao cliente: se o e-mail saiu, se o link foi aberto e respondido; aceitar resposta ou pedir de novo com motivo; nota interna; histórico; "Resolver" devolve para a etapa. Novo ticket avulso por modelo (extratos do mês, faturamento, admissão, pergunta livre). Primeiro link vale 3 dias úteis; vencido sem arquivo sai um 2º de 5 dias corridos (`PRAZO_DO_1O_LINK_DIAS_UTEIS`, `PRAZO_DO_2O_LINK_DIAS` em `{C}/mandei/index.ts`); vencido de novo, aviso para ligar. | `{T}/telas/mandei/Mandei.tsx`, `useMandei.ts`, `NovoTicket.tsx`, `useNovoTicket.ts`; `{C}/mandei/index.ts`, `modelos.ts` (`MODELOS_DE_TICKET`), `banco.ts`; `{T}/dados/mandei.ts`, `mandei.firestore.ts` |

O que o robô publica para o cliente (lista branca): ver seção 3.3.

### 2.10 Configurações (Cadastro) (`{T}/telas/cadastro/`)

| Função | O que faz | Arquivos |
|---|---|---|
| Lista e empresa nova | Todas as empresas com bancos e plano, filtro pelo que falta; "Empresa nova" consulta o CNPJ (BrasilAPI/minhareceita). Janela da empresa com abas (`ABAS_DO_CADASTRO` em `{T}/casca/navegacao.ts`): Dados da empresa; Contábil (Parâmetros, Contas bancárias, Plano de contas, Contas padrão); Fiscal (Parâmetros, Documentos e planilhas, Parcelamentos, Código do Simples); Acessos (Senhas); Registro (Histórico). | `escolher/EscolherEmpresaCadastro.tsx`, `useListaDoCadastro.ts`, `JanelaNovaEmpresa.tsx`, `useNovaEmpresa.ts`; `janela/JanelaDaEmpresa.tsx`; `{C}/empresas/cadastro/receita.ts`, `regras.ts` |
| Dados e parâmetros | Identificação, situação na Receita, contato, sócios (razão social só Diretor/Dono troca). Parâmetros contábeis ligam/desligam etapas; parâmetros fiscais guardam regime, serviços, segmento, monofásico, ST, antecipação, DIFAL, retenções, benefício, parcelamento. | `empresa/DadosDaEmpresa.tsx`, `useDadosDaEmpresa.ts`; `{C}/empresas/cadastro/razaoSocial.ts`, `{C}/empresas/fiscal.ts` |
| Bancos, plano, contas padrão, histórico | Contas bancárias com conta contábil conferida; plano importado do Alterdata com prévia; contas padrão do Creditor; histórico das 200 últimas mudanças. | `bancos/*`, `plano/*`, `contas-padrao/*`, `historico/*`, `useCadastroAberto.ts`; `{C}/empresas/cadastro/` |
| Fiscal da empresa | Links da pasta do Drive e planilhas (DEFIS, Fator R, Rateio); parcelamentos (mesma coleção do Entregas; o robô marca parcela paga pelo comprovante). | `fiscal/DocumentosDoFiscal.tsx`, `fiscal/ParcelamentosDaEmpresa.tsx`; `{C}/entregas/parcelamentos.ts` |
| Papéis do mês | Etiquetas de envelope, Protocolo de entrega de tributos e protocolos anuais (Extratos, REINF). | `escolher/JanelaDosPapeis.tsx`, `usePapeisDoCadastro.ts`; `{C}/tarefas/regras/etiquetasDoEnvelope.ts`, `protocoloDeTributos.ts`, `protocolosDoAno.ts`, `controleDeTributos.ts` |
| Responsáveis e troca de carteira | Responsável no Fiscal e no Contábil por empresa; troca de dois lados que só vale com o aceite dos dois. | `responsaveis/JanelaDosResponsaveis.tsx`, `JanelaDeTroca.tsx`, `EmpresasDaPessoa.tsx`, `TransferenciasPendentes.tsx`, `useEmpresasPorResponsavel.ts`, `useTransferenciasPendentes.ts` |
| Sistema, agentes, painel do robô | Chaves do sistema, saúde ok/atenção/parado, Painel do robô (PC e nuvem: ligado, versão, filas, erros 24 h, arquivados, atividade 7 dias), painel ao vivo das conversas do Claude Code por computador. | `configuracoes/*`, `painel-robo/*`, `agentes/*`; `{C}/entregas/painelRobo.ts`, `saude.ts`, `saudeDosRobos.ts` |
| Páginas do Admin | As mesmas telas do site do admin (seção 6), para o admin, e a Releitura dos extratos. | `{T}/telas/configuracoes/TelaDoAdmin.tsx` |

### 2.11 Financeiro (`{T}/telas/financeiro/`) — regra 6: não cortar leituras do banco aqui

| Função | O que faz | Arquivos |
|---|---|---|
| Painel e Resultado por conta | Entradas, saídas, resultado, saldo do caixa, origem/destino por conta, honorários, saldo dos bancos, notas emitidas, contas a pagar vencidas e dos próximos 7 dias; resultado comparativo pela árvore do plano. | `PainelFinanceiro.tsx`, `usePainelFinanceiro.ts`, `ResultadoPorConta.tsx`, `useResultadoPorConta.ts`; `{C}/financeiro/painel.ts`, `resultado.ts`, `gestao.ts` |
| Caixa e Plano de contas | Movimento com saldos, calculadora, contador de cédulas, exportação; plano em árvore editável. | `Caixa.tsx`, `useCaixaFinanceiro.ts`, `PlanoDeContas.tsx`, `usePlanoDeContas.ts`, `JanelaDoLancamento.tsx`; `{C}/financeiro/index.ts`, `demonstrativo.ts`, `calculadora.ts` |
| Contas a pagar e Fornecedores | Por vencimento; lê a linha digitável do boleto PDF e preenche valor e vencimento; despesa recorrente; só controle (não lança no caixa). | `ContasAPagar.tsx`, `useContasAPagar.ts`, `JanelaDaContaAPagar.tsx`, `useJanelaDaContaAPagar.ts`, `Fornecedores.tsx`; `{C}/financeiro/contasPagar.ts`, `boleto.ts` |
| Boletos de honorários em lote | Lê os PDFs, acha o cliente pelo documento impresso, revisão; só Diretor dispara; o robô envia (liberado para clientes desde 10/11/2026). | `Boletos.tsx`, `useLoteDeBoletos.ts`, `JanelaDoBoleto.tsx`; `{C}/financeiro/loteDeBoletos.ts`; `robo/boletos-financeiro.js` |
| Importar extrato do escritório | Mesmo leitor do Contábil; só importa conta do escritório; id fixo (não duplica); desfazer. | `ImportarExtrato.tsx`, `useImportarExtrato.ts`; `{C}/financeiro/banco.ts` |
| NFS-e de honorários | Nova nota, pelos Honorários ou em lote por planilha; o robô da nuvem emite, consulta, cancela; DANFSe v2.0 e XML; e-mail automático ao tomador se ligado. | `NotasFiscais.tsx`, `useNotasFiscais.ts`, `useNovaNota.ts`, `useJanelaDaNota.ts`, `useImportarPlanilha.ts`, `danfsePdf.ts`, `ConfiguracoesDoFinanceiro.tsx`; `{C}/nfse/` |
| Honorários, Devedores, Reajuste | Previsto/recebido/em aberto por competência; devedores; reajuste por índice com prévia. **Honorários e Devedores saíram do menu.** | `Honorarios.tsx`, `useHonorariosDaCompetencia.ts`, `Devedores.tsx`, `useDevedores.ts`, `JanelaDoReajuste.tsx`, `useReajuste.ts`, `JanelaDosContratos.tsx`, `useJanelaReceber.ts`; `{C}/financeiro/honorarios.ts` |
| Comissões, holerites e insumos da equipe | O Financeiro aprova/paga comissões, sobe holerites e mantém os preços dos insumos (páginas `comissoes-equipe`, `holerites-equipe`, `insumos-equipe`). | ver 2.12 |

### 2.12 Carteira (`{T}/telas/carteira/`)

| Função | O que faz | Arquivos |
|---|---|---|
| Comissões | A pessoa lança; valor = serviço × % do Financeiro; pago no mês seguinte; lançada → aprovada → paga, ou recusada. **Liberada só para um usuário** (`LIBERADA_PARA` em `{C}/carteira/index.ts`); os demais veem "em desenvolvimento". | `Carteira.tsx`, `MinhasComissoes.tsx`, `ComissoesDaEquipe.tsx`, `JanelaDaComissao.tsx`, `JanelaDosServicos.tsx`, `CarteiraEmBreve.tsx`, `useCarteiraDaPessoa.ts`; `{C}/carteira/index.ts`; `robo/comissoes-ocultas.js` |
| Holerites e pagamentos | Holerite e comprovante por pessoa e mês; últimos 6 meses; contas a pagar ligadas à pessoa. | `HoleritesEPagamentos.tsx`, `EnviarHolerites.tsx`, `JanelaDoDocumento.tsx`, `comum.tsx` |
| Insumos | Impressões, envelopes, caixas por cliente, com o preço do dia. | `Insumos.tsx`, `JanelaDoInsumo.tsx`, `JanelaDosInsumos.tsx`, `useInsumos.ts`; `{C}/carteira/insumos.ts` |

### 2.13 Administrativo, Ferramentas, Drive, Gmail, Senhas

| Módulo / função | O que faz | Arquivos |
|---|---|---|
| Administrativo › Entrada de clientes (protótipo) | Ficha pré-cadastral, orçamento em PDF, documentos com destino no Drive, cadastro com responsáveis. **Só Diretor/Dono no modo desenvolvedor, tudo na memória do navegador.** Contratos: em desenvolvimento. | `{T}/telas/administrativo/EntradaDeClientes.tsx`, `useEntradaDeClientes.ts`, `orcamentoPdf.ts`; `{C}/administrativo/entradaDeClientes.ts` |
| Ferramentas de documentos | Separar, juntar, girar, tirar páginas, comprimir, numerar, PDF↔imagem/texto, OCR, planilhas; tudo no navegador. Botão no pé da gaveta. | `{T}/telas/ferramentas/Ferramentas.tsx`, `useFerramentas.ts`, `pdfParaArquivos.ts`; `{C}/ferramentas/` |
| Drive › Pasta do ano | Navega o Drive pelo mapa `driveIndice` que o robô mantém: clientes por ano, árvore, busca, .zip, visualizador de planilha; outros arquivos por link temporário pedido ao robô (`aberturasDrive`). | `{T}/telas/drive/ExploradorDoDrive.tsx`, `useExploradorDoDrive.ts`, `MenuDeContexto.tsx`, `VisualizadorDePlanilha.tsx` |
| Drive › Arquivador ("Claudio Secretário") | Arrastar arquivos para a pasta de entrada; o robô reconhece e move para a pasta do cliente; "Meus envios" mostra o destino; painel da organização. | `{T}/telas/drive/EnviarAoSecretario.tsx`, `useEnvioAoSecretario.ts`, `MeusEnvios.tsx`, `JanelaDoArquivador.tsx`, `useArquivadorDoDrive.ts`, `BotaoDoArquivador.tsx` |
| Gmail › E-mails do robô e Histórico | Pastas De clientes, Sem cliente, Enviados, Spam; abrir, responder (fila do robô), salvar anexos no Drive, vincular cliente, marcar spam; histórico de cada leitura. | `{T}/telas/gmail/CaixaDoRobo.tsx`, `useCaixaDoRobo.ts`, `HistoricoDoRobo.tsx`, `useHistoricoDoRobo.ts`; `{T}/dados/gmail.firestore.ts` |
| Senhas › cofre | Segredos cifrados no navegador (AES-GCM), par RSA por pessoa, liberação de navegador novo por Diretor, código de recuperação; senha gov.br, .pfx e código do Simples por empresa; contas gov.br de pessoas físicas. | `{C}/cofre/cripto.ts`, `tipos.ts`, `regras.ts`; `{T}/telas/senhas/useCofre.ts`, `useSegredos.ts`, `AcessoAoCofre.tsx`, `TelaDeBloqueio.tsx`, `SenhasDasEmpresas.tsx`, `ContasGov.tsx` |
| Senhas › importações e certificados | .pfx em massa associados pelo CNPJ; códigos do Simples lidos de relatórios Word; contas gov.br por planilha; painel de vencimento dos certificados (validade às claras). | `{T}/telas/senhas/ImportarCertificados.tsx`, `useImportarCertificados.ts`, `ImportarCodigosDoSimples.tsx`, `useImportarCodigosDoSimples.ts`, `Certificados.tsx`, `useCertificados.ts`, `useContasGov.ts`; `{C}/cofre/certificado.ts`, `codigosDoSimples.ts`, `planilha.ts` |

---

## 3. Área do Cliente — o app do cliente (`{W}/cliente`)

### 3.1 Como o cliente entra

- Rota: `/cliente/:token/:aba?` (`{W}/cliente/rotas.tsx`). Um **link secreto por empresa**, sem senha; token de 40
  letras hexadecimais minúsculas (`{W}/cliente/dados/espelho.ts`). Link desconhecido ou trocado: só o aviso, sem dado.
- A tela **só lê** o espelho `areasCliente/{token}` (e subcoleções) que o robô grava; o cliente **só cria** documentos
  nas caixas `areaClienteChamados` e `areaClienteEnvios` (`{W}/cliente/dados/areaCliente.firestore.ts`).
- Seções ligadas com o banco: `SECOES_DO_BANCO = { documentos: false, dp: true, pagas: false }`
  (`{W}/cliente/dados/areaCliente.ts`, linha 88). Ou seja: **com o banco, a Central de documentos e as guias Pagas
  ficam escondidas**; só os dados de exemplo as preenchem. Também não têm fonte no banco: certificado, avisos do
  escritório, ficha cadastral completa e contatos por setor (ficam `null`/vazios no espelho).
- Troca de empresa no topo: as empresas já abertas neste aparelho ficam no `localStorage`
  (`{W}/cliente/dados/perfis.ts`), nunca no banco.
- Enxugamento de 16/11/2026: o dono apresentou a área e ouviu "muita informação"; todas as telas foram reduzidas (uma
  ação por linha, o resto no menu "⋯"). Regra 10: função nova precisa resolver tarefa concreta sem encher a tela.

### 3.2 Telas

| Tela (aba) | O que faz | Arquivos |
|---|---|---|
| Casca | Menu lateral (no celular, gaveta ☰ e barra de baixo): Visão geral, Central de documentos, Guias e obrigações, Departamento pessoal (Registro), Solicitações; em Administrativo: Faturamento, Dados cadastrais, Fale com o escritório. No alto: empresa com CNPJ, sino, busca geral. Rodapé com o cartão de atendimento (WhatsApp). Abas sem fonte somem. | `telas/AreaDoCliente.tsx`, `telas/useAreaCliente.ts`; `partes/CartaoDeAtendimento.tsx`, `partes/BuscaGeral.tsx`, `partes/MarcaDoEscritorio.tsx`, `partes/EsqueletoDaArea.tsx`; `dados/busca.ts` |
| Visão geral | Saudação com dois fatos do mês; "Precisa de você" (cada item com UM botão, ou "tudo em dia"); próximas guias (nome, "Vence 19/11", valor, Baixar; ver e copiar no "⋯"); enviar documento; primeiros passos discretos. | `telas/Inicio.tsx`, `telas/useInicio.ts`; `dados/visaoGeral.ts`, `dados/primeirosPassos.ts`; `partes/PrimeirosPassos.tsx`, `partes/LinhaGuiaDoMes.tsx` |
| Guias e obrigações | Resumo com dois fatos; guias do mês com abas A pagar e Pagas (cada uma com data curta, valor e um botão); ao lado, calendário só com os pontos. Saíram o "O que o escritório entrega" e os avisos (16/11/2026). | `telas/Guias.tsx`, `telas/useGuias.ts`; `dados/guiasDoMes.ts`; `partes/CartaoDeGuia.tsx`, `partes/LinhaDeGuia.tsx`, `partes/LinhaDePaga.tsx`, `partes/SiglaDaGuia.tsx`, `partes/guia.ts`, `partes/LinhaDaAgenda.tsx` |
| Central de documentos | Biblioteca com pastas (Tudo, Guias, Folha e DP, Notas, Do escritório, Enviados por você), busca, mês, lista por mês; ver (com setas) e baixar; marcar vários ou "Baixar o mês" em .zip. **Escondida com o banco** (`documentos: false`). | `telas/Documentos.tsx`, `telas/useDocumentos.ts`; `dados/biblioteca.ts`; `telas/useBaixarVarios.ts` |
| Departamento pessoal (Registro) | Dois fatos no alto; funcionários (pelas guias do FGTS, **CPF mascarado**; ativos ou quem saiu) com ficha em janela flutuante; documentos do DP mês a mês por categoria (folha, recibos, pró-labore, férias, rescisões, ponto, FGTS, INSS); pedidos de admissão, férias e desligamento viram solicitação do tipo certo. | `telas/DepartamentoPessoal.tsx`, `telas/useDp.ts`; `dados/registroEnxuto.ts`; `{C}/areaCliente/pessoal.ts`, `folhaLida.ts`, `dp.ts` |
| Solicitações | Lista + painel: filtros Abertas/Respondidas/Concluídas/Todas, prévia da última resposta; a solicitação escolhida (etapas, pedido, resposta do escritório, enviar arquivos, botão WhatsApp) ou a nova (assunto em cartões, depois formulário). **Sem chat**: o cliente não responde por texto, só manda os arquivos pedidos ("Enviei os arquivos: …"). Tipos fixos: admissão, férias, demissão, dúvida, documento, outro. | `telas/Chamados.tsx`, `telas/useChamados.ts`; `dados/solicitacoes.ts`; `{C}/areaCliente/chamados.ts` (`TIPOS_DE_CHAMADO`) |
| Enviar documento | Tipo (extrato, nota, comprovante, outro), soltar/escolher arquivos (PDF, JPG, PNG, XML, ZIP; até 700 KB cada), lista do que foi enviado na visita. | `telas/Enviar.tsx`, `telas/useEnviar.ts`, `telas/JanelaDeEnvio.tsx`; `partes/AreaDeSoltar.tsx` |
| Administrativo › Faturamento | Faturamento pelo SIEG e relatório do dia no estilo de lista (número, destinatário, valor, DANFE; chave no "⋯"). **Nunca CPF/CNPJ de comprador** (regra 5). | `telas/Administrativo.tsx`, `telas/useAdministrativo.ts`; `dados/faturamentoEnxuto.ts`; `{C}/areaCliente/faturamento.ts`, `notasDoMes.ts`, `pedidoDeDanfe.ts` |
| Administrativo › Dados cadastrais | Cartão da empresa (logo, razão, fantasia, CNPJ com copiar, regime; atividade, endereço, sócios). Sem ficha no banco, a tela some. | `telas/Administrativo.tsx`, `telas/useAdministrativo.ts` |
| Administrativo › Fale com o escritório | Telefone, e-mail e WhatsApp do escritório (o robô grava só a constante `ESCRITORIO` de `robo/area-cliente.js`). | `telas/Administrativo.tsx`, `telas/useAdministrativo.ts` |
| Visualizar e baixar | Pré-visualização do PDF em imagens (pdf.js; se passar de 8 s, abre no visualizador do navegador); baixar vários num .zip. | `telas/useVisualizar.ts`, `partes/JanelaDoArquivo.tsx`, `dados/paginasDoPdf.ts`, `dados/baixar.ts`, `telas/useBaixarVarios.ts` |
| Tutorial, aparência, ajuda | Tutorial guiado por capítulos (PC e celular), tema, ajuda da tela. | `dados/tutorial.ts`, `dados/tutorialVisto.ts`, `partes/Tutorial.tsx`, `dados/aparencia.ts`, `partes/Aparencia.tsx`, `partes/AjudaDaTela.tsx` |
| Sino | Mostra as notificações calculadas das guias e "O escritório respondeu" (na hora, a partir de chamados `respondido`); **não há marca de lido persistida** e o robô não manda e-mail/push da resposta. | `telas/useAreaCliente.ts`, `dados/regras.ts` |

### 3.3 O que o robô publica no espelho (lista branca)

Gravado só pelo robô (`robo/area-cliente.js`, regras em `robo/area-cliente-regras.js`, cópia manual das regras do
core, mantida alinhada só por teste; contrato em `docs/area-do-cliente/contrato.md`):
- resumo da empresa; guias com PDF (no código: FGTS pelos `pedidosFgts`; **DAS e DAE** chegam por
  `robo/envios-do-nads.js`; rótulos em `ROTULO_DA_GUIA` de `{C}/areaCliente/guias.ts` só FGTS/DAS/DAE/outra);
- agenda de vencimentos (`{C}/areaCliente/agenda.ts`, `vencimentos.ts`; a tabela tem linhas marcadas
  "PRECISA CONFERIR" no próprio código);
- faturamento dos últimos 12 meses e notas do mês pelo SIEG; DANFE sob pedido;
- RH: funcionários pelas guias do FGTS (CPF mascarado), holerites e previsão de férias lidos dos PDFs do DP, documentos
  do DP dos últimos meses.
- **Nunca sai**: dados internos da rotina, CPF completo, motivo de afastamento, CPF/CNPJ de comprador (regra 5).
- Quando atualiza: ao ligar, a cada 30 min e quando muda link, pedido de FGTS, rotina ou cadastro (grava só o que
  mudou, por hash); apaga espelhos órfãos 1x/dia.
- Caixas do cliente: `areaClienteChamados` (até 20 por link por dia) vira chamado interno e volta ao espelho;
  `areaClienteEnvios` (até 50 por link por dia) é validado pelos primeiros bytes e guardado na pasta "ÁREA DO CLIENTE" do
  cliente no Drive, com recibo.

---

## 4. Mandei — o formulário do cliente (`{W}/mandei`)

| Peça | O que faz | Arquivos |
|---|---|---|
| Rota | `/mandei/<código>`, sem login: só o formulário daquele ticket. | `{W}/mandei/rotas.tsx` |
| Formulário | No alto o N, a Nilma e o prazo em destaque (o número do ticket não aparece); abre direto no primeiro item; Anterior/Próximo e barra de progresso; cada cliente/fornecedor num cartão com o valor; lançamentos em tabela com resposta **por linha** (seleção nativa), "Explique" e comprovante (Galeria, Câmera, Arquivo); revisão; fim; link vencido. | `{W}/mandei/telas/Formulario.tsx` |
| VM | Respostas por linha ou por item, anexos; **rascunho salva sozinho** (o cliente volta e continua); o que o escritório pediu de novo aparece com o motivo; a revisão avisa do comprovante que falta. Vencido ou resolvido, não aceita mais nada. | `{W}/mandei/telas/useFormulario.ts` |
| Dados | Banco: `ticketsLinks/{código}` (no projeto do Entregas) e anexos por `enviosSecretario`; exemplo: `comum/mandeiExemplo.ts`. Registra a primeira abertura (a Central vê "Aberto"), o rascunho e o envio. | `{W}/mandei/dados/formulario.ts`, `formulario.firestore.ts`; `{C}/mandei/banco.ts` |
| E-mail do link | O robô manda pela caixa do setor de quem pediu. **Travado** desde 11/11/2026: `LIBERADO_PARA_CLIENTES = false` (`robo/mandei.js`, linha 12) → só sai para o e-mail do escritório (regra 8). Regras do banco em `docs/mandei/regras-do-banco.md`. | `robo/mandei.js` |

---

## 5. Conversor (`{W}/conversor`)

App de três etapas, **sem empresa e sem banco**: Arquivo → Conferência → Baixar (`/conversor/<etapa>`; etapa travada
volta para a última liberada). Lê PDF (com OCR para escaneado/foto), OFX, Excel ou CSV no navegador e gera o .xls no
layout Data, Valor, Histórico, Finalidade; regras próprias para Banco do Brasil, Nubank, Cora, InfinitePay e Unicred.

Arquivos: `{W}/conversor/rotas.tsx`; `casca/Casca.tsx`, `caminho.ts`, `navegacao.ts`, `sessao.tsx`;
`telas/arquivo/Arquivo.tsx`, `useArquivo.ts`; `telas/conferencia/Conferencia.tsx`, `useConferencia.ts`;
`telas/baixar/Baixar.tsx`, `useBaixar.ts`; `{C}/extratudo/conversor/` (`regras/bancoDoBrasil.ts`, `nubank.ts`, `cora.ts`,
`infinitepay.ts`, `unicred.ts`, `arquivos/xls.ts`).

---

## 6. Site do Admin (`{W}/admin`) e Central dos robôs (`{W}/robos`)

**Admin** (`/admin/<página>`, páginas em `{W}/admin/casca/navegacao.ts`; também dentro de Configurações › Admin):

| Página | O que faz | Arquivos |
|---|---|---|
| Visão geral | Resumo do sistema. | `{W}/admin/telas/visao-geral/VisaoGeral.tsx`, `useVisaoGeral.ts` |
| Robô | Painel do robô (mesma tela da Tarefas). | `{T}/telas/cadastro/painel-robo/*` |
| Saúde dos robôs | Um cartão por robô: ok / atenção / parado. | `{W}/admin/telas/saude-robos/SaudeDosRobos.tsx`, `useSaudeDosRobos.ts` |
| Arquivador | Fila, ritmo, contagens, últimos arquivos com o porquê, "Para resolver" (arquivar escolhendo cliente/tipo/competência ou descartar para quarentena). | `{W}/admin/telas/arquivador/Arquivador.tsx`, `useArquivadorAdmin.ts`, `useGrupos.ts`, `useResolver.ts`, `partes/*`; `{W}/admin/dados/arquivadorNovo.ts`, `.firestore.ts` |
| Uso do sistema | Mesma tela de 2.1. | `{T}/telas/uso/*` |
| Saúde do banco | Tamanho das coleções, órfãos, uso de 30 dias (doc `robo/saudeBanco`). | `{W}/admin/telas/banco/SaudeDoBanco.tsx`, `useSaudeDoBanco.ts`; `{W}/admin/dados/saudeBanco.ts` |
| Cota e custos | Uso da cota. | `{W}/admin/telas/cota/CotaECustos.tsx`, `useCotaECustos.ts` |
| Feedbacks | Feedbacks e bugs (com o relatório do robô de suporte). | `{W}/admin/telas/feedbacks/FeedbacksDoAdmin.tsx` |
| Sistema e agentes | Mesma tela da Tarefas. | `{T}/telas/cadastro/configuracoes/*`, `agentes/*` |

**Central dos robôs** (site robos-nilma): as 3 máquinas (CPU, memória, disco, versão, último sinal) e 10 robôs do
catálogo `{C}/robos/catalogo.json` (servidor: arquivador, sieg, fgts, alterdata; nuvem: vigia/Gmail, nfse, envios,
sefaz; PC: ia, suporte). Cada robô: Geral, Fila, Registros (log ao vivo a cada 10 s), Ações, Configurações. Ações viram
documentos em `robosComandos`; o robô só executa a lista fechada (pausar, retomar, rodar agora, limpar fila travada,
reiniciar com calma, atualizar, refazer, cancelar item, passar na frente, pedir para um cliente, parar/retomar tudo).
Ajustes: horários (`config/robosHorarios`, hora de Brasília), alertas no celular (`config/robosAlertas`, vem desligado)
e papel de cada pessoa (ver, comandar, administrar); o robô relê a cada 5 min.
Arquivos: `{W}/robos/casca/Central.tsx`, `useCentral.ts`, `useAcesso.ts`; `{W}/robos/telas/JanelaDoRobo.tsx`, `FilaDoRobo.tsx`,
`Paineis.tsx`, `Configuracoes.tsx`, `useAjustes.ts`, `useFila.ts`, `useRegistros.ts`; `{W}/robos/dados/central.ts`,
`central.firestore.ts`, `ajustes.ts`, `ajustes.firestore.ts`; `{C}/robos/ajustes.ts`, `central.ts`; `robo/central.js`,
`robo/horarios.js`, `robo/alertas.js`.

---

## 7. Os robôs (`robo/`)

### 7.1 As três máquinas

| Máquina | Processo principal | O que roda lá | Painel | Como atualiza |
|---|---|---|---|---|
| **Nuvem**: VM Google e2-micro `robo-nilma` (1 GB) | `node vigia-robo.js --a-cada 120` (serviço systemd) | Gmail, envios por e-mail, avisos no celular, Drive pela API, NFS-e, SEFAZ, backup, FGTS (variante nuvem), IA Gemini, WhatsApp (em `origin/desenvolvimento` desde 17/11/2026, ainda não neste checkout; ver 7.4) | `robo/painelVM` | Um "interruptor" (timer de 1 min, `robo/nuvem/iniciar-maquina.sh`) lê os metadados `robo-ligado` e `robo-versao`. **O push não basta: é preciso trocar o metadado `robo-versao` da VM pelo gcloud, com o OK do dono** (regra 7). |
| **Servidor do escritório**: NILMA-SERVER (Windows), o "robô do PC" das notas | `arquivador.js` (com `ARQ_SO_SERVIDOR=1`); robôs pesados em processo próprio (`robo/robo-modulo.js`, `robo/satelites.js`) | Arquivador, SIEG, FGTS em lote, Alterdata Contábil/Fiscal, Área do Cliente, eContador, vigias do Drive e da sessão | `robo/painelPC` (só o arquivador escreve) | Tarefa agendada `nads-atualizar-robo` → `D:\nads-dados\atualizar-robo.cmd` (cópia de `robo/servidor/atualizar-robo.cmd`) → `robo/atualizar-robo.js` (ramo `desenvolvimento`). **Em 12/11/2026 o servidor parou de se atualizar: conferir a versão em `robo/painelPC.versao`.** |
| **PC do escritório** | `claude-do-pc.js` | Só o que precisa do Claude instalado: atendente de IA, suporte (investigação de bug), FGTS pelo Claude in Chrome; o Alterdata só se `ALTERDATA_NO_PC=1` | **Não tem painel**: não escreve `robo/painelPC` (comentário no topo de `robo/claude-do-pc.js`); dá sinal só pelo estado da máquina em `robosMaquinas` a cada 5 min (`robo/central.js`, linhas 63–67) | (a confirmar) |
| **Qualquer PC Windows com Alterdata** (opcional) | `alterdata-no-pc.js` | O mesmo robô do Alterdata, disputando a mesma fila por transação; aparece como `pc-<computador>` | (a confirmar) | Sozinho pelo GitHub a cada 5 min (`robo/pc-alterdata/LEIAME.md`, `instalar.ps1`) |

Peças comuns: `robo/atualizar-robo.js` (só reinicia se mudou arquivo carregado, no máximo 1 vez a cada 30 min, fora da
janela das 3h, com saída educada em até 10 min) e `robo/ocupado.js`; `robo/partida.js` (espera o banco quando falta
rede); `robo/lideranca.js` (a "vez" em `robo/lider`: só um vigia atende, o reserva assume quando o prazo vence);
`robo/consumo.js` (passou de ~20 mil leituras ou 5 mil gravações em 10 min, pausa por 15 min a tarefa que mais gastou e
avisa os admins); `robo/batimento.js`; `robo/painel.js` (publica `robo/painelPC` e `robo/painelVM` a cada minuto, só
quando muda; atividade em `roboAtividade`, apagada após 7 dias); `robo/central.js` (comandos da Central e as últimas 200
linhas de log em `robosRegistros`, sem segredos). Visão geral em `robo/LEIAME.md`.

### 7.2 O que cada robô faz sozinho, e quando

| Quando | Máquina | O que faz | Arquivos | Situação |
|---|---|---|---|---|
| A cada 120 min (ou "Ler o Gmail agora") | Nuvem | Lê as caixas do robô e do contábil, casa remetente com cliente, marca Extrato/Comprovante/Aplicação como recebido em `documentosMensal`, reconhece o banco, aprende agência/conta, lista sem-cliente e spam. Durante a leitura: extrato → fila `extratosRecebidos`; XML/.zip → pedido `xmlsCliente`; comprovante de parcela → marca parcela paga (na dúvida, não marca). Só grava no Drive quando alguém clica "Salvar no Drive". | `robo/download-attachments.js`, `bancos.js`, `contas-bancarias.js`, `periodo-extrato.js`, `estado-robo.js`, `gmail-client.js`, `extratos-do-email.js`, `xmls-do-email.js`, `parcela-paga.js` | Ativo |
| A cada minuto (e releitura completa à noite) | Nuvem | Mapa do Drive em `driveIndice`: pergunta o que mudou e relê só a pasta do cliente afetado. | `robo/drive-indice.js`, `drive-arquivos.js` | Ativo |
| 1x por dia útil, a partir das 8h | Nuvem | Push de tarefas e parcelas atrasadas. **Lê as tarefas do sistema antigo (`tarefas.html`), não `nadsTarefasDelegadas`.** | `robo/avisos-atrasados.js`, `avisos-push.js` | Ativo |
| Na hora | Nuvem | Push: parada nova na rota e entrega não realizada; pedido de liberação de login; REINF transmitida (ao responsável do DP). | `robo/avisos-push.js`, `avisos-liberacao-nads.js`, `avisos-reinf-nads.js` | Ativo |
| Por dia do mês e cargo | Nuvem | Lembretes do escritório por cargo (sem empresa). | `robo/lembretes.js` | Ativo |
| Véspera e dia do vencimento | Nuvem | Push ao cliente que tocou "Me avise" no **portal antigo** (`portais/{token}`). | `robo/avisos-vencimento.js` | Ativo |
| 1x por dia, a partir das 8h | Nuvem | Avisa admin e contábil de papéis do cliente vencendo (30/15/3 dias) e do certificado do cofre (30/15/7/3; vencido, toda segunda). Só lê a validade: **não emite nem baixa certidão**. | `robo/papeis-vencendo.js`, `certificados-do-cofre.js` | Ativo |
| 1x por semana | Nuvem | Consulta cada CNPJ na BrasilAPI e registra mudanças em `clientes.receita`; mudança grave avisa o admin. | `robo/vigia-cnpj.js` | Ativo |
| Todo dia a partir das 18h; sexta a partir das 17h | Nuvem | Resumo do dia do Gmail à caixa do escritório (alerta de erro no máximo a cada 6h); resumo da semana (entregas, quem abriu o link, quem deve documento, Receita, backup). | `robo/vigia-robo.js`, `resumo-semanal.js` | Ativo |
| 1x por dia, entre 12h e 20h | Nuvem | Backup do Firestore (JSON, imagens das assinaturas e fotos, planilha .xlsx) subindo ao Drive. | `robo/backup-diario.js`, `backup-firestore.js`, `backup-planilha.js` | Ativo |
| 1x/dia; diário; a cada 30 min | Nuvem | Saúde do banco (`robo/saudeBanco`); faxina dos pedaços usados; uso da cota. | `robo/saude-banco.js`, `faxina-banco.js`, `uso-banco.js` | Ativo |
| ~10 s após mudança | Nuvem | Espelhos de `clientes` e `cadastro` num documento cada; índice de login por nome. | `robo/espelhos.js`, `login-por-nome.js`, `clientes-cache.js` | Ativo |
| Dias do mês escolhidos, a partir das 9h | Nuvem | Régua de cobrança de documentos (1ª/2ª/3ª, até 40 por dia, pula quem foi cobrado há menos de 3 dias). | `robo/regua-cobranca.js` | **Desligada por padrão** |
| Último dia útil, a partir das 8h | Nuvem | Checklist mensal do Fiscal a todos os clientes ativos com e-mail. | `robo/cartas-fiscal.js` | **Travado** (`LIBERADO_PARA_CLIENTES = false`) |
| Quando a NFS-e é autorizada | Nuvem | E-mail ao tomador com DANFSe e XML, nunca duas vezes. | `robo/nfse-email.js`, `robo/gerado/danfse.js` | Depende de `config/nfse.email.automatico` (a confirmar se está ligado) |
| A cada entrega confirmada | Nuvem | E-mail-recibo ao cliente. | `robo/comprovante-email.js` | **Desligado por padrão** |
| Contínuo (evento + varredura de 1 min; arquivo estável há 45 s) | Servidor | Arquivador novo: lê PDF/XML/OFX/SPED/planilha/compactados (OCR local), decide cliente, tipo, competência, pasta e nome por regras e move sem sobrescrever; o que não identifica vai para NÃO IDENTIFICADOS com o motivo. Modo pelo config (desligado, simulação, produção por tipo). | `robo/arquivador-continuo.js`, `arquivador-novo.js`, `arquivador-regras.js`, `arquivador-ocr.js`, `arquivador-chaves.js`, `arquivador-conteudos.js`, `arquivador-retrato.js`, `arquivador-cadastro.js`, `arquivador-acompanhamento.js` | Modo em produção: a confirmar |
| Madrugada, 1h–5h | Servidor | SIEG: conta as notas de cada cliente ativo (mês atual, e o anterior até o dia 10) em `siegContagens` e baixa o mês de quem teve nota nova ou cancelamento. Também o plano fiscal por mês do arquivador. | `robo/sieg.js`, `sieg-portal.js`, `sieg-xmls.js`, `sieg-pdfs.js`, `sieg-estado.js`; `robo/arquivador-fiscal-por-mes.js` | Ativo |
| Ao ligar, a cada 30 min e quando algo muda | Servidor | Espelho da Área do Cliente; esvazia as caixas do cliente; apaga órfãos 1x/dia. | `robo/area-cliente.js`, `area-cliente-regras.js` | Ativo |
| G: sumido por mais de 10 min | Servidor | Fecha e reabre o Google Drive (no máximo a cada 30 min); sessão RDP desconectada passa para o console. | `robo/drive-vigia.js`, `sessao-no-console.js` | Ativo |
| Depois do envio da guia | Servidor | Copia o PDF para a pasta que o UpDocs do eContador vigia. | `robo/econtador.js`, `econtador-api.js` | **Desligado por padrão** (`config/econtador`) |
| Rotina das 9h | Servidor | Rotina antiga `/organizar` pelo Claude. | `robo/arquivador.js`, `arquivo-manifesto.js` | Um comentário diz que foi pausada em 22/10/2026 (a confirmar) |

### 7.3 O que os robôs fazem sob pedido (fila no banco)

| Pedido (coleção) | Quem pede (tela) | Máquina | O que faz | Arquivos |
|---|---|---|---|---|
| `pedidosAlterdata` (tipos balancete, mensal, importar, fiscal) | Conferência, página Alterdata, etapas | Servidor (ou PC com Alterdata) | Roteiros Python (pywinauto) operam o Contábil aberto e logado: exportam o Balancete Dinâmico (XLS) e o Razão (CSV) ou importam a planilha de 10 colunas; o tipo `fiscal` exporta entradas/saídas/tomados/prestados (**em teste, só no modo desenvolvedor**). Um por vez, prazo de 9 min. | `robo/alterdata.js`, `alterdata-fila.js`, `alterdata-numeros.js`, `alterdata_balancete.py`, `alterdata_dinamico.py`, `alterdata_razao.py`, `alterdata_importar.py`, `alterdata_fiscal.py`, `alterdata_processo.py`, `alterdata_login.py` |
| `pedidosSieg` | Fiscal › SIEG, executor | Servidor | Baixa o mês de uma empresa (portal com sessão logada ou API), grava XMLs, resumo em `siegNotas`/`siegSaidas`, gera DANFE/DANFSe. | `robo/sieg.js`, `sieg-portal.js`, `sieg-xmls.js`, `sieg-pdfs.js` |
| `xmlsCliente` | Gmail, executor | Servidor | Lança e arquiva os XMLs que o cliente mandou. | `robo/sieg-xmls.js`, `robo/xmls-do-email.js` |
| `pedidosFgts` | DP › FGTS Digital | Servidor ou PC (`config/fgts.onde`); variante na nuvem | Emite a guia mensal como procurador (lotes de até 12); PDF na pasta do DP e no pedido. **Nunca resolve captcha nem digita senha**: para e avisa. | `robo/fgts-claude.js`, `fgts-extensao.js`, `fgts-extensao/servico.js`, `fgts-chrome.js`, `fgts-digital.js` |
| `nfseEmissoes` | Financeiro › Notas fiscais | Nuvem | Monta a DPS nacional, assina com o e-CNPJ, envia à API da E&L (Taiobeiras/MG), consulta, cancela, reenvia sem duplicar. | `robo/nfse.js`, `robo/nfse-xsd/` |
| `pedidosSituacao` | Fiscal | Nuvem | Consulta na SEFAZ (MG e SVRS) a situação de cada nota emitida do mês e grava as divergências. | `robo/situacao-notas.js` |
| `solicitacoesEmail` (tipos `um`, `lote`, `disparo`, `cartaBalanco`, `mandei`; `whatsapp` só em `origin/desenvolvimento`, ainda não neste checkout) | várias telas | Nuvem | Envia pelo Gmail em HTML, só para e-mails do cadastro, com freio de 60 por hora por caixa; registra depois de o Gmail confirmar. | `robo/vigia-robo.js`, `email-html.js`, `mensagem-gmail.js`, `cartas-fiscal.js`, `mandei.js` |
| Lote do DP / Envios do DP | DP | Nuvem | Lê os PDFs, monta `dpArquivos`, manda um e-mail por cliente e grava no Drive. | `robo/lote-dp.js`, `envios-do-dp.js` |
| Lote fiscal | Fiscal › Enviar guias | Nuvem | Lê, envia, grava na pasta FISCAL e preenche `controleTributos` só onde está vazio; via "impresso" vira entrega na rota; DAS/DAE vão para o espelho da Área do Cliente. | `robo/lote-fiscal.js`, `envios-do-nads.js` |
| Boletos | Financeiro › Boletos | Nuvem | Um e-mail por boleto; o que ficou "enviando" numa queda não é reenviado sozinho. | `robo/boletos-financeiro.js` |
| `enviosSecretario` | Executor, Drive, Mandei | Nuvem | Remonta o arquivo em pedaços e grava na pasta de entrada `Claudio Secretario`; extrato e comprovante vão direto à pasta contábil. | `robo/envios-do-nads.js` |
| `enviosDoPortal` | Portal antigo do cliente | Nuvem | Valida, guarda no Drive e marca o mês como recebido. | `robo/envios-do-portal.js`, `pedidos-do-portal.js` |
| `aberturasDrive` | Drive | Nuvem | Cópia temporária num bucket com link que expira. | `robo/abrir-do-drive.js` |
| `leiturasGmail`, `buscasEmail`, responder | Gmail | Nuvem | Texto completo de um e-mail; busca de anexos; resposta na mesma conversa. Só admin ou contábil. | `robo/leituras-gmail.js`, `buscas-email.js`, `responder-gmail.js` |
| `solicitacoesArquivo` ("Arquivar agora") | Drive | Servidor | Dispara a rotina antiga pelo Claude e publica em `arquivamentos/`. | `robo/arquivador.js` |
| Pedidos do "Para resolver" | Admin › Arquivador | Servidor | Arquiva ou descarta para a quarentena, conferindo caminho e hash. | `robo/arquivador-pedidos.js`, `arquivador-manual.js` |
| Pergunta à IA | Janela pessoal › Perguntar | PC (Claude) ou nuvem (Gemini) | Responde com consultas somente leitura; o Claude só **prepara** ações num cartão que a pessoa confirma. CPF/CNPJ/telefone são tirados antes de ir ao Gemini. | `robo/atendente-claude.js`, `ia-mcp.js`, `ia-banco.js`, `ia-acoes.js`, `ia-arquivos.js`; `robo/ia-atendente.js`, `ia-consultas.js`, `ia-ajuda.js`, `guia-do-app.md` |
| Bug do suporte | Balão de suporte | PC (Claude) | Roda o leitor sobre o arquivo; o Claude lê o código (só leitura) e escreve o relatório para a aba Bugs do admin. | `robo/suporte-claude.js`, `suporte-ler.js`, `aviso-de-falha.js` |
| `robosComandos` | Central dos robôs | todas | Lista fechada de ações. | `robo/central.js` |

### 7.4 WhatsApp

- **Hoje, no código principal**, o WhatsApp é manual: link `wa.me` com o texto do modelo (Fiscal › Enviar guias em
  `{T}/telas/fiscal/relatorio/useEnvioDeGuias.ts`; "Pedir extratos"; botão da Área do Cliente).
- **Ramo `claude/whatsapp-qr`** (worktree `C:\Users\Pao90\nads\.claude\worktrees\whatsapp-qr`; existe também
  `claude/whatsapp-qr-retomada`). **Correção da revisão (17/11/2026):** os dois já estão dentro de
  `origin/desenvolvimento` (último commit do arquivo: "WhatsApp do robô: o QR que o celular lê…", 17/11/2026), mas
  **não** neste checkout `mandei-area-cliente` (ver seção 0). Se já roda na VM depende do metadado `robo-versao`
  (regra 7): (a confirmar). Arquivos: `robo/whatsapp.js` e `robo/whatsapp-regras.js`
  (Baileys; QR lido na Central dos robôs; sessão só no disco da VM; estado em `robo/estado.whatsapp`; envios pela fila
  do Gmail, tipo `whatsapp`, um por vez, intervalo de 20 a 60 s, 30 por hora e 150 por dia, só para o telefone do
  cadastro; não lê mensagens recebidas; `LIBERADO_PARA_CLIENTES = false`). Decisão do dono: o gratuito por QR num chip
  novo, **só no robô da nuvem** (regra 8).

### 7.5 Empacotamento para o robô

`scripts/robo-danfse.mjs` e `scripts/robo-cartas.mjs` juntam o código do core e o desenho do PDF do site em
`robo/gerado/danfse.js` e `robo/gerado/cartas.js` (versionados, porque a VM só faz `git pull`). O `--conferir`
(dentro do `npm run verificar`) falha se o gerado ficou velho.

---

## 8. O dia a dia do escritório no NADS, de ponta a ponta

Um mês típico, na ordem em que as coisas acontecem, com quem faz (pessoa ou robô) e onde. Serve para pôr lado a lado
com o fluxo do Acessórias (catálogo de obrigações → prazos gerados → lista de entregas → robô dá baixa → cliente
recebe).

### 8.1 Antes do mês (cadastro e carteira)

1. **Cliente novo**: Configurações › Empresas › "Empresa nova" (CNPJ consultado na Receita). Preenche Dados da empresa,
   Parâmetros contábeis (ligam ou desligam etapas: cartão, liquidação de cobrança, vende no cartão), Parâmetros fiscais
   (regime, ST, retenções…), contas bancárias e plano de contas (importado do Alterdata). O DP marca as obrigações do
   cliente em DP › Configurações (partindo de `{C}/empresas/dp.ts`). A "Entrada de clientes" do Administrativo é
   protótipo e não grava.
2. **Responsáveis**: Fiscal e Contábil por empresa (troca com aceite dos dois lados).
3. **Acesso do cliente**: admin/diretor gera o link secreto da Área do Cliente na janela da empresa e manda por
   WhatsApp; opcionalmente, o link público do Entregas (`portais/{token}`).
4. **Senhas**: gov.br, certificado A1 e código do Simples no cofre.
5. **Obrigações**: não há tela de catálogo. O que cada empresa faz sai das **rotinas fixas no código**
   (`{C}/tarefas/rotinas/*.ts`), filtradas por regime, mês e parâmetros do cadastro.

### 8.2 Documentos chegando (contínuo, quase tudo por robô)

- **E-mail**: a cada 120 min o robô da nuvem lê o Gmail e encaminha extratos, comprovantes, XMLs e comprovantes de
  parcela (`extratosRecebidos`, `xmlsCliente`, `documentosMensal`). A equipe vê em Gmail › E-mails do robô o que ficou
  sem cliente.
- **Área do Cliente**: o cliente envia arquivos (até 700 KB cada) pela janela "Enviar documento"; o robô do servidor
  guarda na pasta "ÁREA DO CLIENTE"; a equipe vê em Área do Cliente › Recebidos.
- **Mandei**: quando a equipe pede algo por ticket (8.4), o cliente responde no formulário e anexa comprovantes.
- **Notas**: toda madrugada o SIEG conta e baixa os XMLs dos clientes (servidor).
- **Arquivos soltos**: a equipe arrasta para a pasta de entrada (Drive › Arquivador); o arquivador do servidor move
  para a pasta certa do cliente.
- **Cobrança de documentos**: manual (fila `solicitacoesEmail`) ou pela régua automática, que está desligada.

### 8.3 Fiscal (por empresa, a partir do início do mês)

1. Minhas empresas → competência → empresa (só as suas) → Executor do Fiscal.
2. Etapas em checklist: relatório inicial, importação de notas (SIEG e Alterdata, pedindo ao robô), conferência de
   saídas/entradas/retenções (painéis, SINTEGRA, sequência), apuração (prévia do DAS, PIS/COFINS, ICMS, IRPJ/CSLL).
3. **A guia é gerada fora do NADS** (PGDAS-D, SEFAZ, e-CAC…); nenhum robô baixa DAS/DARF/DAE em portal.
4. Envio: Fiscal › Relatório › **Enviar guias em lote**: sobe os PDFs → o robô lê → revisão → Disparar (e-mail, ou
   entrega impressa na rota, ou WhatsApp manual). O robô grava no Drive, preenche o Relatório (`controleTributos`) e
   publica DAS/DAE na Área do Cliente. Alternativa por empresa: "Subir a guia" dentro da etapa.
5. Obrigações acessórias (EFD, REINF, DCTFWeb, declarações) são marcadas nas etapas; a REINF tem tela própria (estado
   no navegador) que avisa o DP. Prazo só como texto na etapa: **no Fiscal não existe "atrasado"**.

### 8.4 Contábil (por empresa)

1. Minhas empresas → Executor do Contábil (aberto a todos); pergunta o período (um mês ou lote de até 24).
2. Importação: os extratos já chegados entram sozinhos na linha do banco; balancete e razão pedidos ao robô do Alterdata.
3. Etapas: cheque especial, conferência fiscal, Creditor, cartões, vendas no cartão, folha, caixa, bancos, clientes,
   fornecedores, adiantamentos, estoque, bens, salários/INSS, pró-labore, honorários, Simples a recolher, empréstimos,
   impostos, despesas e receitas, conciliação. Cada uma trava só por erro objetivo e gera o .xls de importação do
   Alterdata.
4. Dúvidas ao cliente: em Clientes/Fornecedores, as contas marcadas viram **um ticket do Mandei** (link de 3 dias úteis;
   2º link de 5 dias; depois, aviso para ligar). O e-mail do Mandei está **travado** para o escritório até liberar.
5. Etapas podem ser delegadas (contas específicas ou em conjunto); quem está em qual etapa aparece em Usuários.

### 8.5 Departamento Pessoal (5º dia útil, dia 15, dia 20)

1. DP › Início: tabelão por competência com Folha, eSocial, Guias, REINF e Entrega por cliente, com "atrasado" pelos
   prazos legais calculados.
2. Folha e eSocial são feitos no sistema de folha (fora do NADS); a bolinha é marcada no tabelão.
3. FGTS: DP › FGTS Digital → o robô emite as guias como procurador.
4. Envio: DP › Lote (sobe PDFs, o robô lê e dispara) ou DP › Envios (o robô acha na pasta do cliente e manda); a
   Entrega é marcada sozinha. Os documentos do DP aparecem no Registro da Área do Cliente.
5. Nov/dez: 13º no tabelão e "13º para a rota" no Entregas.

### 8.6 Entregas físicas e pelo link

Quem recebe impresso: Nova entrega (ou o próprio lote fiscal, via "impresso") → Rota do office boy → confirmação com
assinatura, foto e localização → protocolos impressos → Painel do mês. Quem tem o link público confirma "recebi" na
página dele (`robo/entrega-pelo-link.js`).

### 8.7 O cliente

Recebe as guias por e-mail (lote fiscal, lote e envios do DP), por entrega física ou na Área do Cliente (Visão geral →
"Precisa de você" e próximas guias; Guias; Registro). Abre solicitações (admissão, férias, demissão, dúvida, documento,
outro) e acompanha a situação; para conversar, o botão do WhatsApp do escritório. Não há aviso ativo (e-mail ou push)
quando o escritório responde; push só no portal antigo, para quem pediu, na véspera e no dia do vencimento.

### 8.8 Gestão e acompanhamento

- Minhas empresas: situação por empresa, justificativas das paradas, histórico.
- Início: tarefas delegadas (prazo e cronômetro pelo expediente), mural com confirmação de leitura, reuniões.
- Avisos no celular: atrasados (do sistema antigo), liberações, REINF, papéis e certificados vencendo, CNPJ mudado.
- Resumo diário (18h) e semanal (sexta 17h) por e-mail; Central dos robôs e site do Admin para a saúde do sistema.

### 8.9 Financeiro do escritório

Honorários: os boletos, gerados fora, sobem em lote e o robô envia (o Diretor dispara); NFS-e emitida pelo robô e
enviada ao tomador; caixa, contas a pagar, extrato do escritório e painel. Comissões, holerites e insumos pela Carteira.

---

## 9. Diferenças de modelo e limites (para a comparação)

1. **Não existe agenda de obrigações com data por empresa** no Fiscal e no Contábil. `Etapa` não tem prazo; o Fiscal
   só traz o vencimento em texto; Minhas empresas não mostra atraso. Só o DP calcula prazo e "atrasado"
   (`{C}/tarefas/regras/prazosDoDp.ts`). A tabela `{C}/areaCliente/vencimentos.ts` serve só à agenda do cliente e tem
   linhas "PRECISA CONFERIR".
2. **Obrigações não são configuráveis por tela**: Fiscal fixo em `{C}/tarefas/rotinas/fiscal.ts`; DP pela planilha
   `{C}/empresas/dp.ts`, com ajuste em DP › Configurações. Obrigação nova = mudar código.
3. **Não há baixa automática pela guia**: o arquivador vigia a pasta de entrada e arquiva, mas não marca a etapa; os
   lotes (fiscal e DP) preenchem o Relatório e a Entrega do DP, não a rotina.
4. **Sem recorrência** nas tarefas delegadas; o aviso de tarefa delegada é só dentro do sistema (nenhum arquivo de
   `robo/` lê `nadsTarefasDelegadas`).
5. **Sem registro de que o cliente abriu a guia** na Área do Cliente (`baixarGuia` em
   `{W}/cliente/dados/areaCliente.firestore.ts` só lê); o portal antigo grava `portais/{token}.visto`.
6. **Área do Cliente sem login por pessoa**: um link por empresa.
7. **Tipos de solicitação e modelos de ticket fixos** no código (`TIPOS_DE_CHAMADO`, `MODELOS_DE_TICKET`).
8. **Comunicados ao cliente sem fonte no banco** (`EstadoDoArea.avisos` só nos exemplos).
9. **Estado só no navegador** em pontos importantes: REINF, tiques do checklist da folha, Entrada de clientes.
10. **Prontas, mas travadas ou desligadas**: e-mail do Mandei, cartas e checklist do Fiscal, régua de cobrança,
    comprovante por e-mail, eContador, alertas da Central; WhatsApp automático (no `origin/desenvolvimento`, com `LIBERADO_PARA_CLIENTES = false` em
    `robo/whatsapp-regras.js`).
11. **Onde o NADS vai além de um controle de entregas**: o trabalho contábil e fiscal acontece dentro da etapa
    (extratos, conciliações, SIEG, Alterdata pelo robô, FGTS Digital, NFS-e, arquivador), com trilha de eventos por
    pessoa e hora.
12. **Dependências operacionais**: Alterdata aberto e logado no servidor; Google Drive montado no G:; login do Claude no
    PC; captcha do gov.br no FGTS; VM de 1 GB; cota grátis do Firestore.

### A confirmar (não dá para saber só pelo código)

- Quais chaves estão ligadas em produção: régua de cobrança, comprovante por e-mail, `config/nfse.email.automatico`,
  `config/fgts.onde`, modo do arquivador novo, alertas e horários da Central.
- Se a rotina antiga de arquivamento pelo Claude ainda roda às 9h.
- Se o FGTS Digital na VM chegou a ser validado no portal.
- A versão em execução em cada máquina (`robo/painelPC.versao`, `robo/painelVM`).
- Como o PC do escritório (`claude-do-pc.js`) se atualiza (painel próprio ele não tem: ver 7.1).
- A tela de "Pendências" (a matriz de `documentosMensal`) é do Entregas antigo (`entregas.html`), que não está neste
  repositório; o NADS lê e grava a coleção por `{T}/dados/entregasDeDocumentos.ts` e `.firestore.ts`.
- Se as regras do Firestore citadas estão publicadas (quem publica regras é o Vitor; regra 3).

---

## 10. Coleções do banco citadas

| Coleção / documento | Para que serve | Quem grava |
|---|---|---|
| `usuarios/{uid}` (`nadsOnde`, tokens FCM) | conta, presença, etapa atual | Tarefas |
| `nadsTarefasDelegadas` | tarefas avulsas e delegações de etapa | Tarefas |
| `nadsAvisos` | mural do Início | Tarefas |
| `uso/{dia}` | mapa de uso | Tarefas |
| `controleTributos` | Relatório Simples/Presumido | Tarefas e robô (lote fiscal) |
| `documentosMensal` | documentos recebidos e cobranças por cliente e mês | robô do Gmail, Entregas |
| `portais/{token}` | link público do Entregas (portal antigo) | Tarefas e robô |
| `areasCliente/{token}/...` | espelho da Área do Cliente | só o robô |
| `areaClienteChamados`, `areaClienteEnvios` | caixas de entrada do cliente | cliente cria, robô esvazia |
| `ticketsLinks/{código}` | ticket do Mandei | Tarefas e formulário do cliente |
| `siegContagens`, `siegNotas`, `siegSaidas` | notas do SIEG | robô do servidor |
| `driveIndice` | mapa do Drive | robô da nuvem |
| `config/obrigacoes`, `config/envioDp`, `config/envioFiscal`, `config/nfse`, `config/fgts`, `config/econtador`, `config/checklistMensal`, `config/robosHorarios`, `config/robosAlertas` | chaves e modelos | Tarefas e Central |
| `robo/painelPC`, `robo/painelVM`, `robo/lider`, `robo/saudeBanco`, `roboAtividade`, `robosRegistros`, `robosComandos` | saúde e comando dos robôs | robôs e Central |
| Filas de pedidos | ver 1.3 e 7.3 | telas criam, robôs atendem |
