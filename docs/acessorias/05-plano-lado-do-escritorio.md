# Plano de execução: o lado do escritório (Tarefas e robôs)

Este arquivo é o plano para trazer ao NADS, do lado do escritório (o app Tarefas, as Configurações e os robôs), o que o
Acessórias faz melhor: controle de prazos de todas as obrigações, motivo de atraso, dispensa, cadastro de obrigações por
empresa, indicadores de pontualidade, baixa a partir da pasta, envio agendado, tarefas recorrentes, processos com passos,
registro de alterações e aviso de acesso novo. Ele foi escrito em 17/11/2026 para **outro modelo, que vai escrever o
código**: cada item é uma ficha com os arquivos reais, o caminho no banco, a regra do banco proposta, os testes e o que
conferir na tela. As fontes são `01-como-o-acessorias-funciona.md`, `02-como-o-nads-funciona.md` e `03-comparacao.md`
(desta pasta, itens A12 a A18 e A23), mais a conferência no código do checkout `C:\Users\Pao90\nads-mandei` (ramo
`mandei-area-cliente`, commit `2f571f8c`). O lado do cliente (Área do Cliente) tem plano próprio e não entra aqui.

Nada aqui foi feito ainda. Onde a fonte e o código não dizem, está escrito **"a confirmar"**: não invente.

---

## 1. Antes de começar qualquer ficha (vale para todas)

As regras do projeto, numeradas, que as fichas citam como **R1** a **R12**:

| Nº | Regra | O que significa na prática |
|---|---|---|
| R1 | Telas só desenham; a lógica fica nas VMs (`use*.ts`); regras puras em `dados/*.ts` ou `packages/core` com testes vitest. Comentários em português, com a data e a frase do dono que motivou a mudança. | O `.tsx` não calcula nada: chama o hook. Cálculo de prazo, situação e contagem vai para `packages/core/src/...` com `*.test.ts` ao lado. No comentário do topo de cada arquivo novo: a data e a frase do dono que liberou a ficha. Sem a frase, escreva `(plano do Acessórias, 17/11/2026, ficha EXX; frase do dono: a confirmar)`. |
| R2 | Firebase só em `dados/*.firestore.ts` (o `npm run conexoes` confere). | `scripts/conexoes.mjs` reprova qualquer `firebase/*`, `getFirestore` ou `fetch` fora de `apps/web/src/aplicativos/<app>/dados/<nome>.firestore.ts`. O padrão do repositório é: interface + versão de exemplo em `dados/<nome>.ts`, versão do banco em `dados/<nome>.firestore.ts`, hook `use<Nome>()` em `apps/web/src/aplicativos/tarefas/dados/repo.tsx`. |
| R3 | Regra do banco quem publica é o Vitor. | A ficha que precisa de regra traz o texto proposto. O código fica pronto, mas a tela avisa "o banco ainda não aceita" até a regra sair (como em `docs/area-do-cliente/contrato.md`, logo das empresas). O arquivo de regras **não** pode ficar no repositório (`conexoes.mjs` reprova `*.rules`): o texto vai num `.md` em `docs/`. As funções que as regras do Entregas já têm e que os textos abaixo usam: `membroNoNads()`, `membro()`, `ehAdmin()`, `ehDiretorNads()` (vistas em `docs/area-do-cliente/contrato.md` e `docs/aplicativos/tarefas/regra-feedbacks-conversa.md`). |
| R4 | Área do Cliente sem chat. | Nada deste plano abre conversa com o cliente dentro do sistema. Pedido ao cliente = ticket do Mandei ou solicitação com situação. |
| R5 | Privacidade no espelho do cliente. | Nada deste plano grava no espelho `areasCliente/{token}`. Se alguma ficha for estendida para o cliente, nunca CPF/CNPJ de comprador, nunca CPF completo de funcionário, nunca motivo de afastamento. |
| R6 | Financeiro: não cortar leituras. | Nenhuma ficha mexe nas telas de `telas/financeiro`. A E23 lê honorários fora do Financeiro, uma vez. |
| R7 | Robô da nuvem: push não basta. | Depois de mudar um módulo do robô que roda na nuvem (VM `robo-nilma`), além do push é preciso trocar o metadado `robo-versao` da VM pelo gcloud, **com o OK do dono**. O robô do PC parou de se atualizar em 12/11/2026: antes de contar com ele, conferir o campo `versao` do documento `robo/painelPC` no banco (o painel do robô em Configurações › Admin › Robô mostra). |
| R8 | Mandei com trava; WhatsApp só na nuvem. | `robo/mandei.js` tem `LIBERADO_PARA_CLIENTES = false` desde 11/11/2026: e-mail do Mandei só para o escritório. Ficha que cobra o cliente por ticket só funciona de verdade depois da liberação. WhatsApp (Baileys, chip novo) só no robô da nuvem. |
| R9 | "Voltar" sempre no canto superior esquerdo. | Toda tela nova com nível de detalhe (abrir uma empresa, abrir um processo) tem o Voltar no alto à esquerda. |
| R10 | Cada função nova resolve uma tarefa concreta, sem encher a tela. | Uma aplicação nova no máximo por fase; números só para quem decide (Diretor e Dono); nada de painel com 15 cartões. |
| R11 | `npm run verificar` antes de qualquer commit; commit, push, merge e publicação só com autorização explícita do dono. | Pastas soltas como `capturas/` e `perfil-*` quebram o lint no checkout principal: rode o verificar num checkout limpo ou tire essas pastas de lado antes (sem apagar nada do dono). Publicar (`npm run sites`) só com o OK. |
| R12 | Não copiar o Acessórias. | Usar as ideias de funcionamento com nomes e textos próprios. Nada de "Lista de Entregas", "Prazo Técnico", "e-Contínuo", "Multipages", "APLA", nem os ícones de envelope e joinha. Os nomes usados neste plano ("Prazos do mês", "prazo interno", "motivo do atraso", "lote a partir da pasta") já são do NADS. |

E três práticas do repositório que todas as fichas seguem:

- **Novidade em teste.** Toda tela nova entra em `apps/web/src/comum/novidades.ts` (objeto `NOVIDADES`) com
  `aprovada: false` e só aparece com o modo desenvolvedor ligado. Só o Vitor aprova (`aprovada: true`). Para esconder a
  aplicação, siga o exemplo do `administrativo` em `apps/web/src/aplicativos/tarefas/casca/navegacao.ts` (linha com
  `novidadeLigada('administrativo')`).
- **Uma aplicação nova** precisa de: o id em `IdAplicacao` e a entrada em `APLICACOES` (`casca/navegacao.ts`), a regra
  de quem vê no filtro do mesmo arquivo (o bloco com `(a.id !== 'administrativo' || ...)`), e o `case` no `switch` de
  `Tela` em `apps/web/src/aplicativos/tarefas/casca/AplicacaoAberta.tsx` (com `pedaco(() => import(...))`).
- **Rodar local.** `npm run dev` abre com os dados de exemplo (memória do navegador; não grava no banco). `npm run
  dev:banco` usa o banco de verdade e exige login: só use com o OK do dono. O endereço é `http://localhost:<porta>/tarefas`
  (a porta o Vite mostra). Ligue o modo desenvolvedor para ver as novidades.

---

## 2. O que a conferência no código mudou nas fontes

As fontes de 17/11/2026 disseram algumas coisas que o código desmente ou completa. O plano já usa a versão corrigida:

1. **O instante da conclusão já é gravado.** A lacuna "indicadores" dizia que as tarefas não guardam quando foram
   concluídas. Guardam: cada etapa tem `EstadoEtapa { situacao, por, em }` (`packages/core/src/tarefas/tipos.ts`) no
   documento `rotinas/{empresa}_{competência}_{departamento}`, e cada mudança gera um evento só acrescentado em
   `rotinas/{id}/eventos` (`TipoEvento`: `inicio`, `feita`, `dispensada`, `interrompida`, `reaberta` etc.). Logo há
   histórico desde que as rotinas começaram a ser usadas (a confirmar a partir de qual competência há dados).
2. **O "filtro forçado" já existe no Fiscal.** `useEmpresasPermitidas()` em
   `apps/web/src/aplicativos/tarefas/telas/empresas/andamento.ts` deixa cada pessoa do Fiscal ver só as empresas de que é
   responsável no Cadastro (`SETORES_COM_RESPONSAVEL = ['fiscal']`; o Contábil foi liberado para todos em 06/11/2026). É
   filtro na tela, não na regra do banco. O DP **não** tem responsável no Cadastro: `DepartamentoDoResponsavel` em
   `packages/core/src/empresas/cadastro/tipos.ts` é só `'fiscal' | 'contabil'`.
3. **A troca de responsável já existe**, com pedido e aceite dos dois lados: `telas/cadastro/responsaveis/`
   (`JanelaDeTroca.tsx`, `useEmpresasPorResponsavel.ts`, `useTransferenciasPendentes.ts`). Só o Diretor troca.
4. **Juntar num e-mail as guias de setores diferentes contraria uma decisão do dono.** O cabeçalho de
   `robo/envios-do-dp.js` registra: 11/11/2026, "os gmails sejam separados por setor, então envios do fiscal nao devem se
   envolver com dp e vice versa". Por isso a ficha de envio (E17) só agenda **dentro do setor**. Agrupar entre setores
   fica fora até o dono mudar a decisão.
5. **Há três calendários de dia útil diferentes**: `feriadoNacional()` em
   `packages/core/src/tarefas/regras/etiquetasDaFolha.ts` (feriados nacionais fixos + Sexta-feira Santa),
   `packages/core/src/tarefas/regras/feriados.ts` (feriados e pontos facultativos de Taiobeiras, decreto 4068/2026, só
   2026 e 01/01/2027), e os auxiliares de `packages/core/src/areaCliente/vencimentos.ts` (só segunda a sexta, sem
   feriado). O robô `robo/lembretes.js` ainda busca feriados na BrasilAPI. A ficha E01 junta isso.
6. **A proteção do login por computador já existe** (`packages/core/src/usuarios/regras/liberacao.ts`, coleções
   `nadsPedidos` e `nadsSessoes`), mas **o admin fica de fora** (`useLiberacao` em
   `telas/acesso/useLiberacao.ts`: `precisa` só quando `!admin`, menos no Financeiro, que pede para todos). O IP e a cidade
   do navegador já são lidos em `dados/rede.ts` para o cofre (Senhas › Acesso).
7. **A Entrada de clientes é protótipo em memória**: `dados/administrativo.ts` diz "tudo fica na memória do navegador";
   a novidade `administrativo` está `aprovada: false`.
8. **Os módulos de aviso rodam no vigia** (`robo/vigia-robo.js`: `resumo-semanal`, `papeis-vencendo`, `lembretes`,
   `avisos-atrasados`), que atende na máquina que tem a vez em `robo/lider` (normalmente a nuvem). O arquivador por
   evento (`robo/arquivador-continuo.js`) é iniciado por `robo/arquivador.js` na máquina que publica `robo/painelPC`.
   Qual máquina física é essa hoje (servidor ou PC do escritório): **a confirmar** no painel do robô.

---

## 3. Mapa geral

| O que o Acessórias tem | O NADS hoje | Ficha |
|---|---|---|
| Feriados por cidade, antecipar/postergar/manter, sábado útil | três calendários soltos (item 2.5) | E01 (melhoria) |
| Prazo legal e prazo interno por obrigação, "passível de multa" | só o DP tem prazo (`prazosDoDp.ts`); agenda do cliente com linhas "PRECISA CONFERIR" | E02 |
| Permissões finas (dispensa em 4 níveis, alterar prazos) | tabela `ACESSO` em `packages/core/src/usuarios/regras/acesso.ts` + níveis | E03 |
| Lista única de entregas com situação | espalhado: tabelão do DP, Relatórios do Fiscal, Minhas empresas | E04 |
| Justificativa de atraso (texto livre) | objeções por etapa no Interromper; nada depois da baixa | E05 |
| Dispensa uma a uma e em massa | "Não se aplica" por etapa, uma a uma | E06 |
| Lembrar o responsável N dias antes | `avisos-atrasados.js` só para tarefas delegadas e parcelas | E07 |
| Obrigação ligada ou desligada por empresa, regime como pacote | etapas fixas em código por regime e mês; só o DP liga/desliga por cliente | E08 |
| Responsável por departamento em cada empresa, filtro forçado | Fiscal e Contábil sim; DP não | E09 (melhoria) |
| "Prazos a partir de" na troca de regime | regime sem data de início | E10 |
| Performance por analista e departamento | resumo do DP por responsável; nada de no prazo x atrasado | E11 |
| Painel de números na tela inicial | Início novo sem números de prazo | E12 |
| Planejamento semanal por pessoa | "Esta semana" do Início só com tarefas delegadas | E13 |
| Filtro de envios que falharam | erros espalhados por lote e por ticket | E14 (melhoria) |
| Robô que lê a guia na pasta e dá baixa | arquivador só arquiva; lotes pedem subir à mão | E15 |
| PDF com guias de vários clientes | separar PDF só à mão (Ferramentas) | E16 |
| Envio agendado | lote dispara na hora | E17 |
| Tarefas agendadas por empresa, todo ano | Delegador sem repetição; lembretes só por cargo | E18 |
| Processos com passos e cobrança ao cliente | Entrada de clientes em protótipo | E19 |
| Log de alterações | histórico do cadastro da empresa e eventos da rotina; nada para usuários e acessos | E20 |
| Alerta de novo acesso com "Não fui eu" | liberação por computador, sem aviso à pessoa | E21 |
| Segundo fator obrigatório | admin isento da liberação | E22 |
| Lucro por cliente (honorário x tempo) | honorários no Financeiro; cronômetro só nas delegadas | E23 |
| WhatsApp multiatendente | só envio (Baileys) | E24 (decisão) |
| — melhorias do que já existe — | | M01 a M04 |

### Lacuna do 03 → ficha do 05

A comparação (`03-comparacao.md`) chama as lacunas do escritório por ids com nome (seções A12 a A18, A23 e D2). Este
plano usa ids próprios (`E..`, `M..`). A ligação, conferida em 17/11/2026:

| Lacuna no 03 | Seção do 03 | Ficha principal | Fichas que completam | O que fica fora (seção 13) |
|---|---|---|---|---|
| `lista-de-entregas-com-prazos` | A12 | E04 | E01, E02, E03, E05, E06, E07, M04 | — |
| `cadastro-de-obrigacoes` | A13 | E08 | E10 | o catálogo inteiro de obrigações no banco |
| `tarefas-recorrentes-anuais` | A14 | E18 | M03 | — |
| `gestao-de-processos` | A15 | E19 | — | o processo visto pelo cliente: é a `processos-visiveis` do plano 04 (ficha 2A.14) |
| `baixa-automatica-pela-pasta` | A16 | E15 | E16, E14 | OCR de guia escaneada na nuvem |
| `indicadores-de-pontualidade` | A17 | E11 | E12, E13, M01 | painéis montáveis, NPS da equipe |
| `emails-agrupados-e-modelos` | A18 | E17 (só dentro do setor) | — | juntar setores num e-mail e remetente editável (decisão do dono de 11/11/2026) |
| `lucratividade-por-cliente` | A23 | E23 | — | — |
| `whatsapp-integrado` | D2 | E24 (só a decisão) | — | o atendimento multiatendente |

As fichas E09, E20, E21, E22, M02 não vêm de uma lacuna com id no 03: são melhorias e segurança achadas na conferência
(E20 a E22 vêm do retrato do Acessórias no `01-como-o-acessorias-funciona.md`: seção 2, o log de usuários; seção 3,
Segurança de acesso; seção 7, a linha do tempo do cadastro). Nenhuma ficha deste plano
repete uma ficha do plano 04: as vizinhas estão anotadas na própria ficha (E19 × `processos-visiveis`; E01 ×
`lembrete-de-vencimento`; E24 × `guias-pelo-whatsapp`, que dividem o mesmo WhatsApp por QR code do robô da nuvem).

### Ordem das fases

| Fase | Fichas | Por quê nesta ordem |
|---|---|---|
| 0. Base | E01, E02, E03 | Sem calendário e tabela de prazos, todo "atrasado" sai errado. |
| 1. Prazos do mês | E04, E05, E06, E07 | É o que o escritório mais ganha (A12 da comparação). Só lê o que já é gravado. |
| 2. Obrigações por empresa | E08, E09, E10 | Tira falsos atrasos (etapa que a empresa não tem). |
| 3. Indicadores | E11, E12, E13, M01 | Só faz sentido com prazos certos. Só para Diretor e Dono. |
| 4. Envio e robô | E14, E15, E16, E17 | Mexe no robô; depende de R7 e do arquivador estar atualizado. |
| 5. Recorrentes e processos | E18, E19, M03 | Coleções novas: dependem de regra (R3). |
| 6. Segurança e registro | E20, E21, E22 | Independentes; podem andar em paralelo com a fase 1. |
| 7. Decidir antes | E23, E24 | Baixa importância ou risco alto. |
| Melhorias soltas | M02, M04 | Encaixam depois de E02/E09. |

Tamanhos: **pequeno** (até 1 dia de trabalho, poucos arquivos), **médio** (2 a 4 dias), **grande** (uma semana ou mais,
muitas telas ou robô).

---

## 4. Fase 0: a base

### E01. Um calendário só de dias úteis e feriados (melhoria)

- **Id:** `E01-calendario-de-dias-uteis`
- **O que o escritório ganha:** todo prazo do sistema (DP, Fiscal, agenda do cliente, lembretes) passa a pular os mesmos
  feriados, inclusive os de Taiobeiras, e a decidir do mesmo jeito se antecipa ou posterga. Fim de "o DP diz dia 20 e a
  agenda diz dia 19".
- **Como é no Acessórias:** feriados nacionais prontos, estaduais e municipais cadastrados à mão por cidade; cada obrigação
  escolhe antecipar, postergar ou manter quando o dia cai em dia não útil (o artigo 294577 confirma isto; "sábado útil"
  ele não menciona: **a confirmar** no 599023).
  https://acessorias.movidesk.com/kb/pt-br/article/599023 ;
  https://acessorias.movidesk.com/kb/pt-br/article/294577/como-funcionam-o-prazo-tecnico-e-o-prazo-legal-no-acessorias
  (ponto fraco de lá: feriado com ano fixo e feriado municipal deslocando tributo federal; aqui não repita isso).
- **Como está hoje no NADS:** `packages/core/src/tarefas/regras/etiquetasDaFolha.ts` (`feriadoNacional`,
  `quintoDiaUtilDoMesSeguinte`), `packages/core/src/tarefas/regras/feriados.ts` (`FERIADOS`, `feriadoDoDia`,
  `feriadosDoMes`; Taiobeiras 2026), `packages/core/src/tarefas/regras/prazosDoDp.ts` (função local `util`),
  `packages/core/src/areaCliente/vencimentos.ts` (`diaUtilAnterior`, `proximoDiaUtil`, `ultimoDiaUtilDoMes`, sem
  feriado), `robo/lembretes.js` (BrasilAPI).
- **Passo a passo:**
  1. Criar `packages/core/src/tarefas/regras/diasUteis.ts` com:
     - `type Esfera = 'federal' | 'estadual' | 'municipal'` e `type Ajuste = 'antecipa' | 'posterga' | 'mantem'`;
     - `ehFeriado(iso: string, esfera: Esfera): boolean`: federal = `feriadoNacional`; municipal = federal +
       `feriadoDoDia(iso)?.tipo === 'feriado'` (o ponto facultativo **não** fecha prazo; o meio expediente também não);
       estadual = federal (feriados de MG: **a confirmar** com o Fiscal; deixe a lista vazia com comentário);
     - `ehDiaUtil(iso, esfera, sabadoUtil = false)`;
     - `ajustar(iso, ajuste, esfera, sabadoUtil = false): string` (anda para trás ou para frente até um dia útil);
     - `enesimoDiaUtil(ano, mes0, n, esfera, sabadoUtil)` e `ultimoDiaUtil(ano, mes0, esfera)`.
     Comentário no topo explicando que o feriado municipal só vale para tributo municipal (a lição do ponto fraco do
     Acessórias) e que `FERIADOS` precisa receber o decreto de cada ano.
  2. Exportar em `packages/core/src/tarefas/index.ts`: `export * as diasUteis from './regras/diasUteis';`.
  3. `prazosDoDp.ts`: trocar a função local `util` e o laço do 5º dia útil por `diasUteis.ehDiaUtil(..., 'federal')` e
     `diasUteis.enesimoDiaUtil(..., 5, 'federal', true)`. O resultado de hoje não pode mudar: rode `prazosDoDp.test.ts`.
  4. `vencimentos.ts`: manter as funções exportadas (outros arquivos usam), mas por dentro chamar `diasUteis` com a
     esfera da linha. Acrescentar `esfera` em `Vencimento` (DAS, PIS/COFINS, DARF = federal; ICMS = estadual; ISS =
     municipal). **Atenção:** isso muda as datas da agenda do cliente (hoje sem feriado). Isso é desejado, mas avise o dono
     no relatório final, porque mexe no que o cliente vê.
  5. `robo/lembretes.js`: **não mexer nesta ficha** (é robô; R7). Anotar na seção "Depois" do relatório.
- **Dados e caminho no banco:** nenhum.
- **Regra do banco:** nenhuma.
- **Robô:** nenhum nesta ficha.
- **Testes vitest:** `packages/core/src/tarefas/regras/diasUteis.test.ts`: 20/04/2026 (ponto facultativo) é dia útil;
  18/05/2026 (Nossa Senhora de Fátima transferida) não é útil na esfera municipal e é na federal; 03/04/2026 (Paixão) não
  é útil em nenhuma; 24/12/2026 (meio expediente) é útil; `ajustar('2026-11-15','antecipa','federal')` = `2026-11-13`;
  `ajustar(...,'mantem',...)` devolve a mesma data; 5º dia útil de dez/2026 com sábado. Rodar também
  `prazosDoDp.test.ts`, `etiquetasDaFolha.test.ts`, `feriados.test.ts` (os três em `packages/core/src/tarefas/regras/`) e os testes de
  `packages/core/src/areaCliente` (alguns podem mudar de data por causa do passo 4: atualize o esperado só se a data nova
  estiver certa e diga no relatório quais mudaram).
- **Como conferir na tela:** `npm run dev`, DP › Início: as colunas de prazo continuam iguais às de antes para nov/2026.
  Área do Cliente (exemplo) › agenda: o ISS de uma competência cujo dia 10 caia em feriado municipal passa para o dia útil
  seguinte.
- **Critérios de aceite:** um só lugar decide dia útil; `npm run verificar` passa; nenhuma data do DP mudou; a lista das
  datas da agenda que mudaram está no relatório.
- **Riscos:** feriado estadual de MG sem fonte (fica vazio e marcado "a confirmar"); `FERIADOS` só cobre 2026: em 2027 os
  feriados municipais somem até alguém pôr o decreto novo. Os testes usam datas fixas (nunca a data de hoje); o aviso de
  "ponha o decreto do ano" fica só num comentário claro no topo de `feriados.ts` e no relatório final.
- **Dependências:** nenhuma. É pré-requisito de E02, E04, E07, E13.
- **Tamanho:** pequeno.

### E02. A tabela de prazos das etapas (prazo legal, prazo interno, multa)

- **Id:** `E02-tabela-de-prazos-das-etapas`
- **O que o escritório ganha:** cada etapa das rotinas do Fiscal, do DP e do Contábil passa a ter (quando tiver
  obrigação legal) a data-limite oficial, uma data interna alguns dias antes para começar a cobrar o responsável, e a
  marca "atraso gera multa". É a base da lista de prazos (E04) e dos indicadores (E11).
- **Como é no Acessórias:** cada obrigação tem tabela de 12 meses com o dia, "lembrar o responsável N dias antes" (úteis
  ou corridos), sábado útil, "passível de multa". Cores: antes do prazo interno, entre o interno e o legal, depois do
  legal. https://acessorias.movidesk.com/kb/pt-br/article/413347/como-criar-e-editar-uma-nova-obrigacao ;
  https://acessorias.movidesk.com/kb/pt-br/article/294577/como-funcionam-o-prazo-tecnico-e-o-prazo-legal-no-acessorias
- **Como está hoje no NADS:** só o DP tem prazo por parte (`PRAZOS_DO_DP` em
  `packages/core/src/tarefas/regras/prazosDoDp.ts`, usado em `telas/dp/usePainelDoDp.ts`). O Fiscal tem a tabela da
  agenda do cliente (`VENCIMENTOS` em `packages/core/src/areaCliente/vencimentos.ts`, chave = id da etapa, várias linhas
  "PRECISA CONFERIR"). O Contábil não tem prazo (só "competência fechada").
- **Passo a passo:**
  1. Criar `packages/core/src/tarefas/regras/prazos.ts`:
     ```ts
     export interface PrazoDaEtapa {
       /** o departamento e o id REAL da etapa (tarefas/rotinas/*.ts) */
       departamento: 'fiscal' | 'dp' | 'contabil';
       etapa: string;
       /** dia do mês, 'quinto-dia-util' ou 'ultimo-util' */
       dia: number | 'quinto-dia-util' | 'ultimo-util';
       mesesDepois: number;            // 1 = mês seguinte à competência
       ajuste: 'antecipa' | 'posterga' | 'mantem';
       esfera: 'federal' | 'estadual' | 'municipal';
       sabadoUtil?: boolean;
       /** quantos dias úteis antes do prazo legal começa o prazo interno (padrão 3; a confirmar com cada setor) */
       diasAntes: number;
       /** o atraso desta obrigação gera multa ao cliente */
       multa: boolean;
       fonte: string;                  // a lei ou "pedido do Vitor em dd/mm/aaaa"
       conferir?: string;              // o que falta o setor confirmar
     }
     export const PRAZOS: readonly PrazoDaEtapa[] = [ ... ];
     export function prazoDaEtapa(departamento, etapa, competencia): { legal: string; interno: string; multa: boolean } | null;
     ```
     As linhas do DP vêm de `PRAZOS_DO_DP` (mesmos dias e fontes; a etapa do DP liga pela `Etapa.obrigacaoDp` de
     `rotinas/dp.ts`: confira o id real de cada etapa no arquivo). As do Fiscal vêm de `VENCIMENTOS` com o mesmo
     `conferir`. O Contábil fica **sem linhas** (não há prazo legal mensal definido nas fontes; a confirmar com o
     Contábil se há algum, por exemplo o fechamento até o dia X para o Fiscal).
     `multa: true` para DCTFWeb, eSocial, REINF, EFD, DAS, DARF, FGTS (as que a lei multa por atraso). Marque cada uma
     com `conferir: 'multa a confirmar com o setor'` se a fonte não disser.
  2. `prazosDoDp.ts` passa a ler de `PRAZOS` (mantendo as funções exportadas e os nomes, para não quebrar
     `usePainelDoDp.ts`).
  3. `vencimentos.ts` passa a ler o dia e o ajuste de `PRAZOS` pela chave `etapa`; a lista do que o **cliente** vê
     continua sendo só as linhas de `VENCIMENTOS` (o resto da rotina não sai para o cliente).
  4. Exportar em `packages/core/src/tarefas/index.ts`: `export * from './regras/prazos';`.
  5. Escrever em `docs/acessorias/prazos-a-conferir.md` (arquivo novo, curto) a tabela que o Fiscal e o DP precisam
     conferir: etapa, dia, ajuste, multa, `conferir`. Este é o pedido ao dono (sem a conferência, E04 mostra a marca
     "prazo a confirmar" nessas linhas).
- **Dados e caminho no banco:** nenhum (a tabela fica em código, como as rotinas; ver E08 para ajuste por empresa).
- **Regra do banco:** nenhuma.
- **Robô:** nenhum.
- **Testes vitest:** `packages/core/src/tarefas/regras/prazos.test.ts`: para a competência 2026-10, o FGTS (dia 20,
  antecipa; 20/11/2026 é Consciência Negra, feriado nacional em `feriadoNacional`) dá `2026-11-19` e o interno 3 dias
  úteis antes (`2026-11-16`); o S-1200 (dia 15, antecipa; 15/11 é feriado,
  14 e 15 fim de semana) dá `2026-11-13`; etapa do Contábil devolve `null`; toda etapa de `PRAZOS` existe na rotina do
  departamento (`rotinaDo(dep).etapas.some(e => e.id === p.etapa)`): esse teste pega id errado.
  `prazosDoDp.test.ts` continua passando sem mudar o esperado.
- **Como conferir na tela:** DP › Início continua igual. Nenhuma tela nova nesta ficha.
- **Critérios de aceite:** uma tabela só; teste de ids passando; arquivo de conferência escrito; verificar passa.
- **Riscos:** prazo errado gera falso atraso (por isso o `conferir` aparece na tela da E04); ICMS e ISS variam por
  atividade e município (ficam "a confirmar").
- **Dependências:** E01.
- **Tamanho:** médio.

### E03. Permissões novas na tabela de acesso

- **Id:** `E03-permissoes-de-prazos`
- **O que o escritório ganha:** fica claro quem pode dispensar em lote, quem muda prazo de uma empresa e quem vê os
  números da equipe, num lugar só.
- **Como é no Acessórias:** permissão de dispensa em quatro níveis (não; uma por vez; exigindo justificativa; em massa),
  permissão de alterar prazos, nível de visão da lista.
  https://acessorias.movidesk.com/kb/pt-br/article/413346/como-cadastrar-um-novo-usuario-no-sistema ;
  https://app.acessorias.com/sysajuda.php?p=129&ctg=1
- **Como está hoje no NADS:** `packages/core/src/usuarios/regras/acesso.ts` (`Recurso`, `ACESSO`, `pode`) e níveis em
  `packages/core/src/usuarios/regras/papeis.ts` (`nivelDeDiretor`). Cada tela decide sozinha (ex.: `podeTrocar = !!op?.admin`
  em `useEmpresasPorResponsavel.ts`).
- **Passo a passo:**
  1. Em `acesso.ts`, acrescentar ao tipo `Recurso`: `'prazos-dispensar-lote' | 'prazos-ajustar' | 'indicadores-equipe'`
     e no `ACESSO` os três com `[]`. **Atenção:** `pode(u, recurso)` olha só `u.papeis` (o papel `admin` libera tudo) e
     **não** olha o nível; um Diretor sem o papel `admin` não passaria. O resto do app trata "Diretor" como
     `op.admin || usuarios.nivelDeDiretor(op.nivel)` (`ehDiretor` em `casca/navegacao.ts`; `nivelDeDiretor` em `papeis.ts`
     = nível `'dono'` ou `'diretor'`). Por isso crie também, em `acesso.ts`,
     `podeNosPrazos(u: Pick<Usuario, 'papeis' | 'ativo' | 'nivel'>, recurso)` = `u.ativo && (pode(u, recurso) ||
     nivelDeDiretor(u.nivel))`, e as fichas E06, E08, E11 e E12 usam esta função, não `pode` direto.
  2. Criar em `packages/core/src/usuarios/regras/acesso.ts` (mesmo arquivo) a função
     `podeDispensar(u, emLote: boolean): 'nao' | 'com-motivo'`: qualquer membro ativo dispensa **uma** etapa com motivo
     (é o "Não se aplica" que já existe); em lote, só quem `pode(u, 'prazos-dispensar-lote')`. Quem pode o quê fora disso:
     **a confirmar com o dono** (por exemplo, se o Sênior dispensa em lote). Deixe o comentário com a pergunta.
  3. Não mudar nenhuma tela existente nesta ficha.
- **Dados e caminho no banco:** nenhum (o papel `admin` já vem de `usuarios/{uid}`).
- **Regra do banco:** nenhuma nesta ficha (a trava de verdade das gravações fica nas fichas que gravam).
- **Robô:** nenhum.
- **Testes vitest:** em `packages/core/src/usuarios/usuarios.test.ts` (ou arquivo novo `acesso.test.ts` na mesma
  pasta): Júnior ativo não pode `prazos-dispensar-lote`; conta com papel `admin` pode; nível `diretor` sem papel `admin`
  pode pela `podeNosPrazos`; conta desativada não pode nada; `podeDispensar(junior, false)` = `'com-motivo'`.
- **Como conferir na tela:** nada visível.
- **Critérios de aceite:** testes passando; nenhuma tela muda.
- **Riscos:** baixo. No checkout principal `C:\Users\Pao90\nads` (não no `nads-mandei`), `packages/core/src/usuarios/index.ts`
  e `usuarios.test.ts` estão modificados e sem commit, e há `packages/core/src/usuarios/regras/modoDesenvolvedor.ts` novo
  (git status de 17/11/2026): se trabalhar lá, **não** sobrescreva; edite por cima do que está lá.
- **Dependências:** nenhuma.
- **Tamanho:** pequeno.

---

## 5. Fase 1: os prazos do mês

### E04. Prazos do mês: a lista única de todas as obrigações

- **Id:** `E04-prazos-do-mes`
- **O que o escritório ganha:** numa tela, por competência, todas as obrigações com prazo de todas as empresas e dos três
  setores, com a situação de cada uma: a fazer, no prazo interno, atrasada, entregue antes, entregue no prazo, entregue
  com atraso, dispensada. Filtros por setor, responsável e situação. É o "o que está para vencer e o que já venceu" que
  hoje está espalhado.
- **Como é no Acessórias:** a lista central das demandas com quatro grupos de situação (Pendentes, Justificadas,
  Entregues, Dispensadas), cada um com subdivisões (ex.: Pendente, Prazo Técnico e Atrasada dentro de Pendentes), responsável pelo prazo e pela entrega,
  filtros e exportação em PDF/Excel.
  https://acessorias.movidesk.com/kb/pt-br/article/294938/status-da-lista-de-entregas ;
  https://acessorias.movidesk.com/kb/pt-br/article/337272/exibicao-do-responsavel-pelo-prazo-e-pela-entrega-na-lista-de-en ;
  https://acessorias.movidesk.com/kb/pt-br/article/596919
- **Como está hoje no NADS:** DP › Início (`telas/dp/PainelDoDp.tsx`, `usePainelDoDp.ts`) com Atrasado/Pendente por
  prazo; Fiscal › Relatório Simples/Presumido (`controleDeTributos.ts`, coleção `controleTributos`) com "Entregue";
  Minhas empresas (`telas/empresas/useMinhasEmpresas.ts`) com Parada / Em andamento / Não iniciada / Concluída, sem
  prazo; Visão (`telas/contabil/useVisaoContabil.ts`). As execuções: `useExecucoes(competencia, departamento)` em
  `apps/web/src/aplicativos/tarefas/dados/repo.tsx` (uma consulta por competência e departamento, coleção `rotinas`).
- **Passo a passo:**
  1. Regra pura `packages/core/src/tarefas/regras/situacaoDoPrazo.ts`:
     ```ts
     export type SituacaoDoPrazo = 'a-fazer' | 'prazo-interno' | 'atrasada' | 'entregue-antes' | 'entregue-no-prazo'
       | 'entregue-com-atraso' | 'dispensada' | 'sem-prazo';
     export interface LinhaDoPrazo {
       codigo: number | null; empresa: string; departamento: 'fiscal' | 'dp' | 'contabil'; etapa: string; nomeDaEtapa: string;
       competencia: string; legal: string | null; interno: string | null; multa: boolean; aConfirmar: boolean;
       situacao: SituacaoDoPrazo; responsavel: string;   // o do Cadastro (responsável pelo prazo)
       feitaPor: string; feitaEm: string;               // de EstadoEtapa.por / .em (quem entregou e quando)
       atraso?: MotivoDoAtraso;                         // da E05, quando houver
     }
     export function situacaoDoPrazo(estado: EstadoEtapa | undefined, legal: string | null, interno: string | null, hoje: string): SituacaoDoPrazo;
     export function linhasDoMes(entrada: { execucoes: Execucao[]; empresas: {...}[]; competencia: string; hoje: string;
       responsavelDe: (codigo, dep) => string; etapasDaEmpresa: (dep, codigo) => Etapa[] }): LinhaDoPrazo[];
     export function contar(linhas: LinhaDoPrazo[]): Record<SituacaoDoPrazo, number>;
     ```
     Regras: `feita` com `em` (só a data, em Brasília: use `diaEmBrasilia` de `packages/core/src/formatos`) antes do
     interno = entregue-antes; até o legal = entregue-no-prazo; depois = entregue-com-atraso. `dispensada` = dispensada.
     Pendente/interrompida: hoje antes do interno = a-fazer; entre interno e legal = prazo-interno; depois = atrasada.
     Etapa sem prazo em `PRAZOS` = sem-prazo (não aparece por padrão). A empresa entra só nas etapas que a rotina dela
     tem: pegue a rotina com `rotinaDaEmpresa(departamento, codigo)` (`packages/core/src/tarefas/rotinas/rotinaDo.ts`; no
     Contábil, empresa com LCDPR recebe só a rotina LCDPR) e filtre cada etapa com `etapaNoMes(execucao, etapa.id)` de
     `packages/core/src/tarefas/regras/execucao.ts` (respeita `soQuandoAdicionada`/`adicionadas`, `retiradas`,
     `Etapa.regimes`, `Etapa.meses` via `etapaNoMesDoAno` e o `obrigacaoDp` do cliente). Para empresa sem execução no mês,
     passe `execucaoNova(empresa, codigo, competencia, departamento)`, porque `etapaNoMes(null, ...)` não aplica regime nem
     mês. Atenção: `etapaNoMes` usa o regime injetado por `usarRegimesDoCadastro` e o cliente do DP; no teste, configure-os
     como os testes existentes de `execucao` fazem.
  2. Exportar em `packages/core/src/tarefas/index.ts`.
  3. VM `apps/web/src/aplicativos/tarefas/telas/prazos/usePrazosDoMes.ts`: competência (padrão: a de trabalho de cada
     setor; use `competenciasDaTela` de `casca/navegacao.ts`), `useExecucoes(comp, 'fiscal')`, `useExecucoes(comp, 'dp')`,
     `useExecucoes(comp, 'contabil')`, `useTodosOsCadastros()` (responsáveis), e o filtro `useEmpresasPermitidas()` (cada
     pessoa do Fiscal só vê as suas). Filtros: setor, responsável, situação (padrão: atrasada + prazo-interno), busca por
     empresa. Linha clicável abre o Executor da empresa na competência (`/tarefas/executar/<empresa>/<competência>`, o
     mesmo caminho que Minhas empresas usa).
  4. Tela `apps/web/src/aplicativos/tarefas/telas/prazos/PrazosDoMes.tsx`: só desenha. Barra: competência, setor,
     responsável, situação, busca. Tabela: Empresa, Setor, Obrigação, Prazo (legal), Situação (selo com cor), Responsável,
     Entregue por / em. Linha com `aConfirmar` mostra o selo "prazo a confirmar". Nada de gráficos aqui (R10).
     Exportar planilha: use o mesmo utilitário que o DP usa para exportar (procure `exportar` em `telas/dp/`; a confirmar
     o nome).
  5. Navegação: em `casca/navegacao.ts` acrescentar `'prazos'` em `IdAplicacao` e em `APLICACOES`, grupo `'Rotinas'`,
     `{ id: 'prazos', nome: 'Prazos', icone: 'clock', grupo: 'Rotinas', pronta: true, paginas: [{ id: 'mes', rotulo:
     'Prazos do mês', icone: 'clock', titulo: 'Prazos do mês' }] }` (confira se o ícone `clock` existe em `NomeIcone`; o
     Gmail › Histórico usa). No filtro: `(a.id !== 'prazos' || novidadeLigada('prazos'))`. Em `AplicacaoAberta.tsx`:
     `case 'prazos': return <PrazosDoMes />;`.
  6. `apps/web/src/comum/novidades.ts`: `prazos: { desde: '<data do dia>', aprovada: false }` com o comentário da frase do
     dono.
- **Dados e caminho no banco:** só leitura de `rotinas` (consulta por `competencia` e `departamento`: 3 consultas por
  competência, as mesmas que as telas de cada setor já fazem) e do cadastro (já carregado pelo repo). Nada gravado.
- **Regra do banco:** nenhuma (as regras de leitura de `rotinas` e `cadastro` já existem para a equipe).
- **Robô:** nenhum.
- **Testes vitest:** `packages/core/src/tarefas/regras/situacaoDoPrazo.test.ts`: as oito situações com datas fixas
  (hoje = `2026-11-17`); etapa feita no dia exato do legal = entregue-no-prazo; empresa do Simples não recebe a linha de
  PIS/COFINS (etapa só do Presumido); empresa sem execução no mês gera linhas `a-fazer`/`atrasada` (não some);
  `contar` soma certo. Use as execuções de exemplo `execucoesDeExemplo` de `packages/core/src/tarefas/repo.memoria.ts`
  quando servirem.
- **Como conferir na tela:** `npm run dev`, ligar o modo desenvolvedor, gaveta › Prazos › Prazos do mês. Com os dados
  de exemplo, ver ao menos uma linha de cada cor; trocar a competência; filtrar por setor DP e conferir que as datas são as
  mesmas de DP › Início. Desligar o modo desenvolvedor: a aplicação some.
- **Critérios de aceite:** uma linha por empresa × etapa com prazo; datas iguais às do DP › Início; as pessoas do Fiscal
  só veem as empresas delas; nenhum documento gravado; abre em menos de 3 s com os exemplos; verificar passa.
- **Riscos:** leituras do banco (3 consultas por competência; trocar de competência repete): não ouvir ao vivo várias
  competências ao mesmo tempo. Etapas do Contábil não aparecem (sem prazo), o que pode parecer falha: escrever na tela
  "o Contábil ainda não tem prazos cadastrados". Prazos "a confirmar" geram falso atraso: o selo avisa.
- **Dependências:** E01, E02. E05 e E06 se encaixam nesta tela depois.
- **Tamanho:** grande.

### E05. Motivo do atraso, guardado mesmo depois da entrega

- **Id:** `E05-motivo-do-atraso`
- **O que o escritório ganha:** quando uma obrigação atrasa, quem cuida dela escolhe o motivo (o cliente não mandou os
  documentos; órgão ou portal fora do ar; erro ou falta de tempo do escritório; outro) e escreve uma linha. O motivo fica
  guardado mesmo depois da entrega, então dá para saber quanto do atraso é culpa do cliente e quanto é do escritório. O
  sistema já sugere "o cliente não mandou" quando há ticket do Mandei aberto ou documento do mês pendente.
- **Como é no Acessórias:** justificativa em texto livre na demanda (limite de 200 caracteres: **a confirmar**, o artigo
  294938 não diz), que muda a situação sozinha;
  para dar baixa é preciso **apagar** a justificativa (o motivo se perde); não há motivos padronizados.
  https://acessorias.movidesk.com/kb/pt-br/article/294938/status-da-lista-de-entregas ;
  https://acessorias.movidesk.com/kb/pt-br/article/584134/atualizacoes-acessorias-melhorias-que-fazem-diferenca-na-sua-rot
  O NADS deve fazer melhor: motivo padronizado e preservado.
- **Como está hoje no NADS:** o Interromper do Executor já pede motivo (objeções da etapa, `Objecao` com `soMotivo`, em
  `packages/core/src/tarefas/tipos.ts`) e grava em `EstadoEtapa.objecao/observacao`; ao marcar a etapa feita, o estado é
  trocado e o motivo some do estado (fica só no evento `interrompida`). As "Justificativas" de Minhas empresas
  (`telas/empresas/partes/JanelaDeMinhasEmpresas.tsx`) listam as etapas paradas.
- **Passo a passo:**
  1. Em `packages/core/src/tarefas/tipos.ts`:
     ```ts
     export type CausaDoAtraso = 'cliente' | 'orgao' | 'escritorio' | 'outro';
     export interface MotivoDoAtraso { causa: CausaDoAtraso; texto: string; por: string; em: string }
     ```
     e em `Execucao` o campo opcional `atrasos?: Record<string, MotivoDoAtraso>` (chave = id da etapa). **Fica fora de
     `EstadoEtapa`** de propósito: marcar a etapa como feita troca o estado e não pode apagar o motivo.
  2. Em `packages/core/src/tarefas/regras/execucao.ts` (onde já estão `fazer`, `dispensar`, `interromper`, todas no
     formato `(ex, etapa, ..., por, agora) => { execucao, evento }`; o `gravacaoDaExecucao.ts` só calcula a diferença
     para o banco), uma função pura `motivoDoAtraso(ex, etapa, motivo | null, por, agora): { execucao, evento }` que
     valida `texto` de 1 a 200 caracteres e `causa` da lista (com `null`, tira a chave de `atrasos`). Acrescentar o tipo
     de evento `'atraso'` em `TipoEvento` (`packages/core/src/tarefas/tipos.ts`) para guardar o histórico.
  3. Regra pura `sugestaoDeCausa({ ticketsAbertos: number, documentosPendentes: boolean }): CausaDoAtraso | null`: com
     ticket do Mandei aberto para a empresa ou documento do mês pendente, sugere `'cliente'`. De onde vêm esses dois sinais:
     os tickets estão em `tickets` (repo `dados/mandei.ts`, a confirmar se há consulta por empresa sem ler todos); os
     documentos do mês estão em `documentosMensal` (usado por `robo/regua-cobranca.js`; a leitura pela tela é **a
     confirmar**). Se algum sinal exigir ler uma coleção inteira, deixe a sugestão desligada e anote no relatório.
  4. Repositório: **não** criar método novo. `RepoTarefas.gravar(execucao, evento, antes?)` (`packages/core/src/tarefas/repo.ts`)
     já grava só os campos que mudaram (`diferencaDaExecucao` trata qualquer mapa chave por chave, então `atrasos.<etapa>`
     vai sozinho) e o evento em `rotinas/{id}/eventos`, num `writeBatch` com a trava `guardarLote` do modo desenvolvedor
     (`apps/web/src/aplicativos/tarefas/dados/tarefas.firestore.ts`, função `lote`). A VM chama
     `repo.gravar(execucao, evento, antes)` com o resultado do passo 2. Conferir só que `repo.memoria.ts` guarda o campo
     novo (teste).
  5. Tela: em `PrazosDoMes.tsx` (E04), nas linhas `atrasada`, `prazo-interno` e `entregue-com-atraso`, um botão
     "Motivo" que abre uma janela pequena (causa em 4 botões, texto curto, sugestão já marcada). A VM é
     `telas/prazos/useMotivoDoAtraso.ts`. Mostrar o motivo na linha (ícone + texto ao passar o mouse).
  6. Executor: **não** mexer no Interromper nesta ficha. Opcional depois: ao interromper uma etapa com prazo vencido,
     já gravar o motivo do atraso a partir da objeção (anotar como ideia no relatório).
- **Dados e caminho no banco:** `rotinas/{empresa}_{competência}_{departamento}.atrasos.<etapa> = { causa, texto, por,
  em }` e o evento `rotinas/{id}/eventos/{auto} { tipo: 'atraso', etapa, por, em, observacao }`.
- **Regra do banco proposta:** **a confirmar** se o `match /rotinas/{id}` do `firestore.rules` do Entregas limita os
  campos com `keys().hasOnly(...)` ou `diff().affectedKeys()`. Se limitar, acrescentar `'atrasos'` à lista e, para o
  evento, `'atraso'` aos tipos aceitos. Texto proposto para o Vitor (a parte nova):
  ```
      // o motivo do atraso (plano do Acessórias, ficha E05): só a equipe do nads, só o mapa atrasos, texto curto
      function atrasosOk() {
        return request.resource.data.atrasos is map
          && request.resource.data.atrasos.size() <= 60;
      }
      // no allow update de /rotinas/{id}: acrescentar 'atrasos' aos campos aceitos e && (!('atrasos' in request.resource.data) || atrasosOk())
  ```
  Até a regra sair, a gravação falha com "permissão negada": a VM mostra "O banco ainda não aceita o motivo do atraso
  (falta a regra)".
- **Robô:** nenhum.
- **Testes vitest:** em `packages/core/src/tarefas/tarefas.test.ts` ou arquivo novo `motivoDoAtraso.test.ts`: o motivo
  sobrevive a marcar a etapa como feita; texto vazio ou com 201 caracteres é recusado; `sugestaoDeCausa` com ticket
  aberto = cliente; o `repo.memoria` grava e devolve; `situacaoDoPrazo` com motivo continua `entregue-com-atraso` (o
  motivo não muda a situação: ele explica). 
- **Como conferir na tela:** `npm run dev` + modo desenvolvedor › Prazos do mês › uma linha atrasada › Motivo › escolher
  "Cliente" e escrever › Salvar. Abrir a empresa no Executor, marcar a etapa como feita, voltar: a linha está
  "entregue com atraso" e o motivo continua lá.
- **Critérios de aceite:** motivo gravado, preservado após a entrega, com evento; quatro causas fixas; nada muda na
  situação; verificar passa.
- **Riscos:** regra do banco (R3); o campo novo em `Execucao` precisa ser aceito por quem lê o documento (procure
  leituras que fazem `Object.keys(execucao)`; a confirmar).
- **Dependências:** E04. Regra do Vitor.
- **Tamanho:** médio.

### E06. Dispensa em lote, com motivo e desfazer

- **Id:** `E06-dispensa-em-lote`
- **O que o escritório ganha:** quando uma obrigação não se aplica a muitas empresas no mês (ex.: sem movimento), o
  Diretor dispensa todas de uma vez, com um motivo, em vez de abrir empresa por empresa. Dá para desfazer.
- **Como é no Acessórias:** dispensa uma a uma (X ao lado do joinha), em massa com permissão própria ("Sim, inclusive em
  massa"), filtrando por Pendentes/Justificadas e "Prazo téc até" e confirmando com a senha; o artigo 294920 não fala de
  justificativa na dispensa em massa e avisa que ela não se desfaz em lote; histórico de quem dispensou: **a confirmar**.
  https://acessorias.movidesk.com/kb/pt-br/article/596983/acessorias-como-dispensar-demandas-na-lista-de-entregas-uma-por- ;
  https://acessorias.movidesk.com/kb/pt-br/article/294920/como-fazer-a-dispensa-de-prazos-em-massa
- **Como está hoje no NADS:** "Não se aplica" por etapa no Executor (objeção com `solucao.tipo = 'nao-se-aplica'`,
  situação `dispensada`, evento `dispensada`), uma etapa por vez. Desfazer pela reabertura (`reabertas`,
  `packages/core/src/tarefas/regras/reabrirRotina.test.ts` mostra o fluxo).
- **Passo a passo:**
  1. Regra pura em `packages/core/src/tarefas/regras/execucao.ts`: `dispensarEmLote(execucoes, etapa, motivo, por,
     agora)` que, para cada execução, chama a `dispensar(ex, etapa, 'lote', motivo, por, agora)` que já existe no mesmo
     arquivo e devolve a lista de `{ execucao, evento, antes }`. Etapa já feita (`concluida(situacaoDa(ex, etapa))`)
     **não** é tocada. Execução que ainda não existe no banco (empresa não iniciada) parte de
     `execucaoNova(empresa, codigo, competencia, departamento)` (mesmo arquivo).
  2. Repositório: o `RepoTarefas` hoje só tem `gravar(execucao, evento, antes?)`, um lote por chamada. Para até 200
     linhas, chame `gravar` uma vez por execução (é o caminho já testado). Só se o dono reclamar da lentidão, criar
     `RepoTarefas.gravarVarias(...)` (memória e Firestore, `writeBatch` de no máximo 500 operações, limite do Firestore).
  3. Tela: em `PrazosDoMes.tsx`, caixas de seleção nas linhas `a-fazer`, `prazo-interno` e `atrasada`, só visíveis para
     quem `podeNosPrazos(u, 'prazos-dispensar-lote')` (E03). Botão "Dispensar selecionadas" abre janela com motivo obrigatório
     (até 200 caracteres) e a contagem. Botão "Desfazer" na linha dispensada (volta a etapa para pendente pelo mesmo
     caminho do Reabrir).
- **Dados e caminho no banco:** `rotinas/{id}.etapas.<etapa>` e `rotinas/{id}/eventos` (já existentes).
- **Regra do banco:** nenhuma nova se o lote usar os mesmos campos que o "Não se aplica" (conferir que `objecao: 'lote'`
  passa, porque a regra pode validar o id da objeção: **a confirmar**).
- **Robô:** nenhum.
- **Testes vitest:** etapa feita não é dispensada; motivo vazio recusado; 3 execuções viram 3 gravações e 3 eventos;
  desfazer volta a `pendente` com evento `reaberta`.
- **Como conferir na tela:** modo desenvolvedor, entrar como Diretor (no `npm run dev`, escolher o nome na tela "Quem está
  trabalhando?"), marcar 3 linhas, dispensar com motivo; abrir uma das empresas no Executor: a etapa está "não se aplica"
  com o motivo. Entrar como Júnior: as caixas não aparecem.
- **Critérios de aceite:** só quem pode vê; nada feito é tocado; desfazer funciona; verificar passa.
- **Riscos:** dispensar por engano muitas empresas (a janela mostra a lista antes de confirmar); escrita em lote conta
  no consumo do banco (até 400 por clique: limite a 200 linhas por vez).
- **Dependências:** E03, E04.
- **Tamanho:** médio.

### E07. Aviso ao responsável quando o prazo interno começa e quando atrasa

- **Id:** `E07-aviso-de-prazo-ao-responsavel`
- **O que o escritório ganha:** cada pessoa recebe no celular, uma vez por dia útil, "começou o prazo de X obrigações
  suas" e "Y estão atrasadas", com as empresas. O Diretor recebe o resumo do escritório.
- **Como é no Acessórias:** "Lembrar responsável quantos dias antes" (o prazo interno) e o planejamento semanal por
  e-mail. https://acessorias.movidesk.com/kb/pt-br/article/294577 ;
  https://acessorias.movidesk.com/kb/pt-br/article/589146
- **Como está hoje no NADS:** `robo/avisos-atrasados.js` avisa, uma vez por dia útil a partir das 8h, tarefas atrasadas
  e parcelas, por pessoa, com cobertura de férias (`ausencias/{uid}.cobreUid`), marcando o dia antes
  (`robo/estado.atrasadosEm`). Ele é iniciado em `robo/vigia-robo.js` (`iniciarAvisosAtrasados({ db, log, avisos })`).
  Não olha as rotinas.
- **Passo a passo:**
  1. O cálculo **tem de ser o mesmo da tela**. O robô é CommonJS e não importa o core direto; o repositório já tem o
     caminho para isso: `scripts/robo-danfse.mjs` e `scripts/robo-cartas.mjs` empacotam código do core em
     `robo/gerado/*.js` (com rolldown) e o `npm run verificar` confere com `--conferir`. Criar
     `scripts/robo-prazos.mjs` no mesmo molde, gerando `robo/gerado/prazos.js` com `PRAZOS`, `prazoDaEtapa`,
     `situacaoDoPrazo` e `diasUteis`. Acrescentar ao `package.json` da raiz o script `"robo:prazos": "node
     scripts/robo-prazos.mjs"` e, no `verificar`, `&& npm run robo:prazos -- --conferir` (mudar o `package.json` precisa
     do OK do dono: pergunte; sem OK, deixe o script fora do verificar e anote).
  2. Em `robo/avisos-atrasados.js`, uma parte nova `prazosDasRotinas(db, hoje)`: lê as execuções da competência de
     trabalho de cada setor (`rotinas` onde `competencia == X` e `departamento == Y`: 3 consultas por dia) e o espelho
     do cadastro: `robo/espelhos.js` mantém o cadastro inteiro em `cadastro/_espelhos/plano/cadastro`
     (`{ em, vivoEm, n, docs: { id: dados } }`; passando de ~800 KB vai em partes `cadastro-1`, `cadastro-2`…). Leia esse
     documento para não ler a coleção `cadastro` inteira. Para cada pessoa responsável (Fiscal e Contábil pelo
     `responsaveis` do cadastro; DP pelo responsável da E09 ou, antes dela, pelo da configuração do DP: a confirmar de
     onde `usePainelDoDp` tira `c.responsavel`), monta "começou o prazo de N" e "M atrasadas". Junta no mesmo aviso
     diário que já sai (não um segundo aviso).
  3. Freio: no máximo 1 aviso de prazo por pessoa por dia; se a lista passar de 5 empresas, manda "e mais N".
  4. Teste do robô: `robo/teste-avisos-prazos.js` no padrão de `robo/teste-painel.js` (funções puras + banco de
     mentira), rodado com `node robo/teste-avisos-prazos.js`.
- **Dados e caminho no banco:** lê `rotinas` (3 consultas/dia) e o espelho do cadastro; grava só o marcador do dia que já
  existe (`robo/estado.atrasadosEm`).
- **Regra do banco:** nenhuma (o robô usa o Admin SDK).
- **Robô e robo-versao:** muda `robo/avisos-atrasados.js`, que roda no vigia (máquina com a vez em `robo/lider`,
  normalmente a nuvem). Depois do push autorizado: trocar o metadado `robo-versao` da VM `robo-nilma` pelo gcloud, com o
  OK do dono (R7). Conferir também se o servidor (reserva do vigia) se atualizou.
- **Testes vitest:** os do core (E02, E04) cobrem o cálculo; `npm run robo:prazos -- --conferir` garante que o gerado
  está igual ao core.
- **Como conferir na tela:** não há tela. Conferir com `node robo/teste-avisos-prazos.js` e, depois de publicado, na
  Central dos robôs (registros do vigia) a linha do aviso do dia.
- **Critérios de aceite:** um aviso por pessoa por dia útil, com o mesmo número que a tela E04 mostra para aquela pessoa;
  sem leituras de coleção inteira; vigia religado não repete.
- **Riscos:** prazos "a confirmar" geram aviso falso (por isso, no primeiro mês, mande só ao Diretor: deixe uma chave em
  `config/avisosPrazos { ligado: false, soDiretor: true }`, lida pelo robô; o padrão é desligado); robô do PC
  desatualizado (R7).
- **Dependências:** E02, E04 (para a tela bater), E09 (DP).
- **Tamanho:** médio.

---

## 6. Fase 2: as obrigações de cada empresa

### E08. Ligar, desligar e ajustar obrigações por empresa

- **Id:** `E08-obrigacoes-por-empresa`
- **O que o escritório ganha:** sem mexer no código, o Fiscal e o Contábil dizem que uma empresa não tem tal etapa (ou
  passou a ter), e mudam o dia do prazo daquela empresa (ex.: o ISS do município dela vence no dia 15). Isso tira os
  falsos atrasos da lista E04 e do Executor.
- **Como é no Acessórias:** catálogo de obrigações montado à mão; regime = pacote que substitui; grupo = pacote que soma;
  vínculo e desvínculo por empresa, por departamento; obrigação avulsa.
  https://acessorias.movidesk.com/kb/pt-br/article/413347 ; https://app.acessorias.com/sysajuda.php?p=42&ctg=1 ;
  https://acessorias.movidesk.com/kb/pt-br/article/593267/acessorias-como-vincular-uma-obrigacao-ao-cadastro-da-empresa ;
  https://acessorias.movidesk.com/kb/pt-br/article/592714/acessorias-como-utilizar-os-grupos-de-obrigacoes
- **Como está hoje no NADS:** as rotinas são fixas em `packages/core/src/tarefas/rotinas/{fiscal,dp,contabil,lcdpr}.ts`;
  `fiscal.ts` diz "É o único lugar a mexer". As etapas entram por `Etapa.regimes`, `Etapa.meses`,
  `Etapa.soQuandoAdicionada`, `Etapa.obrigacaoDp`, pelo regime do Cadastro (`CadastroDaEmpresa.regime`) e pelo LCDPR
  (`rotinaDaEmpresa` em `rotinas/rotinaDo.ts`); quem decide se a etapa entra no mês é `etapaNoMes(ex, etapa)` em
  `regras/execucao.ts`. Já existe ajuste **por mês** (não por empresa): `adicionarEtapa`/`retirarEtapa` (mesmo arquivo)
  gravam `Execucao.adicionadas`/`Execucao.retiradas` daquela competência. O DP já liga e desliga por cliente (Configurações do DP,
  `ParametrosDoDp` no Cadastro e `packages/core/src/tarefas/regras/configuracoesDoDp.ts`). O Fiscal tem parâmetros de sim
  ou não (`ParametrosDoFiscal`: monofásico, ICMS-ST, antecipação, DIFAL, retenções etc.) que **ainda não** ligam etapas
  (a confirmar lendo `rotinas/fiscal.ts`).
- **Escolha de desenho (a mais barata, a da lacuna):** o catálogo continua em código; o que muda por empresa é uma
  camada pequena no Cadastro. **Não** criar catálogo no banco nesta ficha.
- **Passo a passo:**
  1. Tipos em `packages/core/src/empresas/cadastro/tipos.ts`:
     ```ts
     /** O ajuste de uma etapa numa empresa (plano do Acessórias, ficha E08). Sem = vale a rotina do código. */
     export interface AjusteDaEtapa {
       /** true = a empresa tem a etapa mesmo fora do regime; false = não tem */
       ligada?: boolean;
       /** outro dia do prazo legal só desta empresa (1 a 31) */
       dia?: number;
       /** a partir de qual competência vale ('aaaa-mm'); sem = sempre */
       desde?: string;
     }
     ```
     e em `CadastroDaEmpresa`: `etapas?: Partial<Record<'fiscal' | 'contabil', Record<string, AjusteDaEtapa>>>;`
     (o DP fica de fora: ele já tem as Configurações do DP; não duplicar).
  2. Regras em `packages/core/src/empresas/cadastro/regras.ts`: `ajustarEtapa(c, dep, etapa, ajuste | null, por,
     agora)` que valida (`dia` 1 a 31; `desde` no formato; etapa existe em `rotinaDo(dep)`) e usa `registrar(...)` com a
     ação `'Obrigação'` e o detalhe legível ("Fiscal › ISS: não tem, desde 11/2026"). Incluir `etapas` em
     `cadastroDoDocumento` e `documentoDoCadastro` (essas duas funções são a lista branca do documento: campo que não está
     nelas não é lido nem gravado).
  3. Aplicar na rotina: o filtro por empresa e mês é `etapaNoMes(ex, etapa)` (`packages/core/src/tarefas/regras/execucao.ts`),
     que já recebe o regime do Cadastro por injeção (`usarRegimesDoCadastro(f)`). Faça igual: `usarAjustesDoCadastro(f:
     (codigo: number) => Record<string, AjusteDaEtapa> | undefined)` no mesmo arquivo, e em `etapaNoMes`, antes das
     regras de regime/mês: ajuste com `ligada: false` e `desde <= ex.competencia` (ou sem `desde`) → `false`; com
     `ligada: true` (valendo) → `true` (entra mesmo fora de `regimes`/`meses`). Não mexer em `rotinaDaEmpresa`. Ligue a
     injeção onde `usarRegimesDoCadastro` já é chamado no app (`grep -rn "usarRegimesDoCadastro" apps`). As `retiradas`
     do mês continuam valendo por cima do ajuste.
  4. Prazo: `prazoDaEtapa` (E02) recebe o `dia` do ajuste quando houver.
  5. Tela: nova aba na janela da empresa do Cadastro. Em `casca/navegacao.ts`, `ABAS_DO_CADASTRO` ganha
     `{ id: 'obrigacoes', rotulo: 'Obrigações', icone: 'checklist', grupo: 'Empresa' }`. Componentes:
     `apps/web/src/aplicativos/tarefas/telas/cadastro/obrigacoes/ObrigacoesDaEmpresa.tsx` e
     `useObrigacoesDaEmpresa.ts` (usa `useCadastroAberto(rota)` de `telas/cadastro/useCadastroAberto.ts` e
     `useGravarCadastro()` de `dados/repo.tsx`; `historico/useHistoricoCadastro.ts` mostra o uso de `useCadastroAberto`
     e `responsaveis/useTransferenciasPendentes.ts` o de `useGravarCadastro`). Ligar a aba em
     `telas/cadastro/janela/JanelaDaEmpresa.tsx` (veja como as outras abas são escolhidas lá). A tela lista, por setor
     (Fiscal, Contábil), as etapas da rotina com: "Tem" (sim/não, com o padrão do regime entre parênteses), "Dia do prazo"
     (só nas que têm prazo em `PRAZOS`) e "Desde". Uma frase no alto: "O padrão vem do regime. Mude só o que esta empresa
     tem de diferente." Atrás da novidade `obrigacoes-por-empresa` (`aprovada: false`).
  6. Quem pode mudar: quem `podeNosPrazos(u, 'prazos-ajustar')` (E03) **ou** o responsável do setor daquela empresa (a confirmar
     com o dono; deixe a pergunta no comentário).
  7. Relatório "empresas por obrigação": na mesma aplicação Prazos (E04), não criar outra tela; um filtro "Obrigação"
     já dá a lista das empresas que têm aquela etapa no mês.
- **Dados e caminho no banco:** `cadastro/{id}.etapas.<dep>.<etapa> = { ligada?, dia?, desde? }` e uma linha em
  `cadastro/{id}.historico`.
- **Regra do banco proposta:** **a confirmar** se o `match /cadastro/{id}` do Entregas limita os campos. Se limitar,
  acrescentar `'etapas'` aos aceitos, com:
  ```
      // ajustes das etapas por empresa (plano do Acessórias, ficha E08)
      && (!('etapas' in request.resource.data) || (request.resource.data.etapas is map
          && request.resource.data.etapas.keys().hasOnly(['fiscal', 'contabil'])))
  ```
- **Robô:** nenhum. (O `robo/espelhos.js` copia cada documento do cadastro inteiro em `docs: { id: dados }`, sem lista
  branca: o campo novo passa sozinho. Quem lê o espelho na tela passa pelo `cadastroDoDocumento`, então o passo 2 basta.)
- **Testes vitest:** em `packages/core/src/empresas/cadastro/cadastro.test.ts`: `ajustarEtapa` grava e registra no
  histórico; etapa inexistente dá erro; `documentoDoCadastro(cadastroDoDocumento(...))` preserva `etapas`. Em
  `packages/core/src/tarefas/rotinas/fiscal.test.ts`: com `{ 'fiscal-iss': { ligada: false, desde: '2026-11' } }` a
  rotina de 2026-11 não tem a etapa e a de 2026-10 tem; com `ligada: true` uma etapa do Presumido entra numa empresa do
  Simples.
- **Como conferir na tela:** `npm run dev` + modo desenvolvedor › Configurações › Empresas › abrir uma empresa › aba
  Obrigações › desligar uma etapa "desde" o mês atual. Abrir a empresa no Executor no mês atual: a etapa sumiu; no mês
  anterior: continua. Histórico da empresa mostra a linha.
- **Critérios de aceite:** ajuste gravado com histórico; Executor, Minhas empresas e Prazos do mês respeitam; nenhuma
  execução já gravada perde dados (a etapa desligada some da tela, mas o estado gravado continua no documento).
- **Riscos:** execuções antigas com etapas que deixaram de existir (por isso o `desde`, e nunca apagar estado gravado);
  o Executor tem regras de ordem ("só o próximo liberado"): tirar uma etapa do meio não pode travar a rotina (testar);
  regra do banco.
- **Dependências:** E02, E03. Regra do Vitor (se o cadastro tiver lista branca).
- **Tamanho:** grande.

### E09. Responsável do DP no Cadastro e o mesmo filtro do Fiscal (melhoria)

- **Id:** `E09-responsavel-do-dp`
- **O que o escritório ganha:** cada empresa passa a ter, no Cadastro, quem cuida dela no DP, como já tem no Fiscal e
  no Contábil. Com isso a troca de carteira, os avisos (E07) e os indicadores (E11) funcionam também para o DP.
- **Como é no Acessórias:** um responsável por departamento em cada empresa, responsáveis padrão para empresas novas,
  troca em massa que leva os prazos pendentes, filtro forçado por departamento.
  https://app.acessorias.com/sysajuda.php?p=102&ctg=1 ;
  https://acessorias.movidesk.com/kb/pt-br/article/593145/acessorias-como-transferir-responsabilidade-em-massa-pelo-menu-e
- **Como está hoje no NADS:** `DepartamentoDoResponsavel = 'fiscal' | 'contabil'` e `DEPARTAMENTOS_DO_RESPONSAVEL` em
  `packages/core/src/empresas/cadastro/tipos.ts`; o DP tira o responsável da sua configuração (de onde exatamente,
  **a confirmar** lendo `telas/dp/usePainelDoDp.ts` e `useClientesDoDp.ts`, campo `c.responsavel`); `andamento.ts` diz
  "o DP ainda não tem o responsável por empresa, então vê todas".
- **Passo a passo:**
  1. `tipos.ts`: `DepartamentoDoResponsavel = 'fiscal' | 'contabil' | 'dp'` e a linha `{ id: 'dp', rotulo:
     'Departamento Pessoal' }`. Rodar `npm run tipos` e corrigir cada lugar que fazia `switch` só com dois casos.
  2. Valor inicial: na leitura (`cadastroDoDocumento`), sem `responsaveis.dp` gravado, **não** inventar; a tela do DP
     continua usando o da configuração dele como hoje. A função `responsavelDoDp(cadastro, configDoDp)` em
     `packages/core/src/empresas/cadastro/regras.ts` devolve o do Cadastro e, sem ele, o da configuração.
  3. Tela: `telas/cadastro/responsaveis/useEmpresasPorResponsavel.ts`, `JanelaDosResponsaveis.tsx` e
     `EmpresasDaPessoa.tsx` passam a mostrar a coluna DP. O passo 1 **não** basta: só parte do código itera
     `DEPARTAMENTOS_DO_RESPONSAVEL` (linhas 29, 74, 83 e 93 de `useEmpresasPorResponsavel.ts`); há trechos fixos em
     `'fiscal'`/`'contabil'` que precisam do DP: `useEmpresasPorResponsavel.ts` linhas 46 e 48 (`responsaveis` e
     `foraDaEquipe`), `JanelaDosResponsaveis.tsx` linha 17 (`semResponsavel('fiscal') + semResponsavel('contabil')`),
     `EmpresasDaPessoa.tsx` linhas 26 e 84 (o texto "no Fiscal, no Contábil"), e os tipos `'fiscal' | 'contabil'` de
     `telas/empresas/andamento.ts` (linhas 63, 68, 84). Use `grep -rn "'contabil'" apps/web/src/aplicativos/tarefas/telas/cadastro/responsaveis apps/web/src/aplicativos/tarefas/telas/empresas/andamento.ts` para achar todos.
  4. Filtro: **não** ligar o filtro do DP em `SETORES_COM_RESPONSAVEL` sem o OK do dono (ele liberou o Contábil para
     todos em 06/11/2026 e pode querer o mesmo no DP). Deixe pronto e comentado.
- **Dados e caminho no banco:** `cadastro/{id}.responsaveis.dp` (campo já existente, chave nova) e
  `cadastro/{id}.transferencias.dp`.
- **Regra do banco proposta:** **a confirmar** se a regra do cadastro limita as chaves de `responsaveis` a
  `['fiscal','contabil']`. Se limitar: trocar por `hasOnly(['fiscal', 'contabil', 'dp'])`.
- **Robô:** nenhum.
- **Testes vitest:** `cadastro.test.ts`: `definirResponsavel(c, 'dp', 'Fulana', ...)` grava e registra; pedir e
  aceitar transferência no DP; `responsavelDoDp` cai na configuração quando o Cadastro está vazio.
- **Como conferir na tela:** Configurações › Usuários › Empresas por responsável: aparece a coluna DP; trocar uma
  empresa do DP de uma pessoa para outra e aceitar em Minhas empresas (Trocas para você responder).
- **Critérios de aceite:** DP com responsável no Cadastro e troca funcionando; telas do DP sem mudança de comportamento.
- **Riscos:** dois lugares para o responsável do DP (Cadastro e configuração do DP) até a planilha antiga sair; deixe
  claro na tela qual vale.
- **Dependências:** nenhuma. É pré-requisito do DP em E07 e E11.
- **Tamanho:** médio.

### E10. Regime com data de início

- **Id:** `E10-regime-com-vigencia`
- **O que o escritório ganha:** quando a empresa muda de regime (ex.: sai do Simples em janeiro), as rotinas dos meses
  anteriores continuam com o regime antigo e as dos meses novos com o novo, sem refazer nada.
- **Como é no Acessórias:** trocar o regime substitui as obrigações e pergunta "Prazos a partir de"; não guarda o
  histórico do regime (ponto fraco). https://acessorias.movidesk.com/kb/pt-br/article/592714 ;
  https://acessorias.movidesk.com/kb/pt-br/article/594817
- **Como está hoje no NADS:** `CadastroDaEmpresa.regime?: string`, um valor só, que decide as etapas de qualquer mês.
- **Passo a passo:**
  0. Atenção: a rotina não lê `cadastro.regime` direto; `etapaNoMes` usa `regimeDaEmpresa(codigo)`
     (`regras/execucao.ts`), alimentada por `usarRegimesDoCadastro(f: (codigo) => string)`, **sem competência**. Esta
     ficha precisa mudar a injeção para `(codigo, competencia) => string` e, em `etapaNoMes`, passar `ex.competencia`.
  1. `tipos.ts`: `regimes?: { regime: string; desde: string }[]` (ordenado por `desde`), mantendo `regime` como o atual.
  2. `regras.ts`: `regimeNaCompetencia(c, competencia): string | undefined` (o último `desde <= competencia`; sem lista,
     `c.regime`) e `mudarRegime(c, regime, desde, por, agora)` (acrescenta na lista, atualiza `regime` se `desde` for o
     mês atual ou anterior, registra no histórico).
  3. Trocar as leituras de `cadastro.regime` usadas para montar a rotina de uma competência por
     `regimeNaCompetencia(cadastro, competencia)`. Procure com `grep -rn "\.regime\b" apps/web/src/aplicativos/tarefas
     packages/core/src/tarefas`; mude só onde há competência à mão.
  4. Tela: onde o regime é escolhido hoje (Dados da empresa, `telas/cadastro/empresa/useDadosDaEmpresa.ts`, a
     confirmar), acrescentar "a partir de" (competência, padrão o mês atual).
- **Dados e caminho no banco:** `cadastro/{id}.regimes`.
- **Regra do banco proposta:** se o cadastro tiver lista branca: acrescentar `'regimes'`, com
  `request.resource.data.regimes is list && request.resource.data.regimes.size() <= 24`.
- **Robô:** nenhum.
- **Testes vitest:** Simples até 2026-12 e Presumido desde 2027-01: a rotina do Fiscal de 2026-12 tem PGDAS e a de
  2027-01 tem PIS/COFINS; sem `regimes`, vale `regime`.
- **Como conferir na tela:** mudar o regime de uma empresa de exemplo a partir do mês seguinte; abrir o Executor no mês
  atual (regime antigo) e no seguinte (novo).
- **Critérios de aceite:** meses passados não mudam; histórico registra.
- **Riscos:** leituras do regime sem competência (telas de lista) continuam mostrando o atual, o que é o certo.
- **Dependências:** E08 (mesmo arquivo; fazer depois para não brigar com as mesmas linhas).
- **Tamanho:** pequeno.

---

## 7. Fase 3: os números da equipe

### E11. Pontualidade por pessoa e por setor

- **Id:** `E11-indicadores-de-pontualidade`
- **O que o escritório ganha:** o Diretor vê, por mês e por período, quantas obrigações cada pessoa e cada setor
  entregou antes do prazo, no prazo, com atraso (separando o atraso explicado pelo cliente do atraso do escritório) e
  quantas com risco de multa.
- **Como é no Acessórias:** Relatórios › Performance por analista e por departamento: antecipadas, no prazo interno,
  atraso legal, atraso justificado, atraso sem justificativa, dispensadas, com multa, % no prazo, % com multa; filtros e
  exportação. https://app.acessorias.com/sysajuda.php?p=585&ctg=1 ;
  https://acessorias.movidesk.com/kb/pt-br/article/593504/acessorias-como-utilizar-os-relatorios-performance-analista-e-pe
- **Como está hoje no NADS:** DP › Resumo do mês (gráficos por responsável; `telas/dp/PainelDoDp.tsx` com a aba
  `resumo`), a visão (`useVisaoContabil.ts`) e o ranking do office boy no Painel do Entregas. Os dados de entrega por
  etapa existem (item 2.1). A tela de produtividade "ainda não é" (`docs/aplicativos/tarefas/README.md`).
- **Passo a passo:**
  1. Regra pura `packages/core/src/tarefas/regras/pontualidade.ts`:
     `pontualidade(linhas: LinhaDoPrazo[], agrupar: 'pessoa' | 'setor')` devolve, por grupo: `antes`, `noPrazo`,
     `atrasoCliente`, `atrasoOutros`, `atrasoSemMotivo`, `dispensadas`, `comMulta` (entregue com atraso ou atrasada em
     etapa com `multa`), `total`, `pctNoPrazo`, `pctComMulta`. A pessoa é o **responsável pelo prazo** (o do Cadastro na
     competência), com uma segunda tabela "quem entregou" (`feitaPor`). Atraso explicado pelo cliente **não** conta
     contra a pessoa no `pctNoPrazo` (decisão a confirmar com o dono: deixe uma constante
     `ATRASO_DO_CLIENTE_CONTA_CONTRA = false` com a pergunta no comentário).
  2. VM `telas/prazos/usePontualidade.ts`: período (1, 3 ou 6 competências), lê as execuções com
     `useExecucoesDoPeriodo(competencias, dep)` (já existe em `dados/repo.tsx`) para os três setores; reaproveita
     `linhasDoMes` (E04).
  3. Tela `telas/prazos/Pontualidade.tsx`: uma tabela por pessoa (linhas) e uma por setor, com as colunas acima; nada de
     foto nem rosca (R10, R12). Exportar planilha.
  4. Navegação: nova página na aplicação Prazos (E04): `{ id: 'pontualidade', rotulo: 'Pontualidade', icone:
     'barChart', titulo: 'Pontualidade da equipe' }`, visível só para quem `podeNosPrazos(u, 'indicadores-equipe')` (E03). No
     filtro de `navegacao.ts`, tire a página para quem não pode (siga o modelo do `.map` que tira `usuarios` de quem não é
     Diretor).
- **Dados e caminho no banco:** só leitura de `rotinas` (até 6 competências × 3 setores = 18 consultas ao abrir; carregar
  só ao escolher o período, não ao vivo).
- **Regra do banco:** nenhuma.
- **Robô:** nenhum.
- **Testes vitest:** `pontualidade.test.ts`: 10 linhas montadas à mão dão as contagens e os percentuais esperados; atraso
  com motivo `cliente` não entra no `atrasoSemMotivo`; pessoa sem nenhuma linha não aparece; divisão por zero dá 0.
- **Como conferir na tela:** modo desenvolvedor, como Diretor: Prazos › Pontualidade, período 3 meses; os totais por
  setor somam o mesmo que a soma das pessoas daquele setor. Como Júnior: a página não aparece e o link direto cai em
  Prazos do mês.
- **Critérios de aceite:** números batem com Prazos do mês; só Diretor e Dono veem; exporta.
- **Riscos:** é informação sensível da equipe (só Diretor/Dono); prazos "a confirmar" distorcem (mostrar quantas linhas
  têm prazo a confirmar no rodapé); o histórico só existe desde que as rotinas passaram a ser marcadas no NADS.
- **Dependências:** E04, E05 (para separar o motivo), E09 (DP).
- **Tamanho:** médio.

### E12. Uma faixa de números do escritório no Início (só Diretor e Dono)

- **Id:** `E12-faixa-de-numeros-no-inicio`
- **O que o escritório ganha:** ao abrir o sistema, o Diretor vê cinco números: atrasadas, atrasadas com multa, no prazo
  interno, a vencer nos próximos 7 dias e entregues nos últimos 30 dias. Cada número leva à lista filtrada.
- **Como é no Acessórias:** o Painel de indicadores clássico com 12 blocos e os painéis montáveis em modo apresentação.
  https://acessorias.movidesk.com/kb/pt-br/article/589152/como-funciona-o-painel-de-indicador-classico ;
  https://app.acessorias.com/sysajuda.php?p=53&ctg=1 (aqui, de propósito, só cinco: R10).
- **Como está hoje no NADS:** o Início novo (`telas/inicio/InicioNovo.tsx`, `useInicioNovo.ts`, `partes/PainelDoInicio.tsx`)
  tem calendário, próximas tarefas, delegadas por mim e reuniões; nada de prazos de rotina.
- **Passo a passo:**
  1. Em `packages/core/src/tarefas/regras/situacaoDoPrazo.ts` (E04): `numerosDoEscritorio(linhas, hoje)` com os cinco.
  2. VM `telas/inicio/useNumerosDoEscritorio.ts`: só para quem `podeNosPrazos(u, 'indicadores-equipe')` (E03); lê a competência de
     trabalho dos três setores (3 consultas; **não** ouvir ao vivo: ler uma vez ao abrir o Início e ao voltar para a aba
     depois de 10 minutos, como o ponto de presença faz).
  3. `partes/PainelDoInicio.tsx`: uma faixa fina no alto com os cinco números (texto e número, sem gráfico). Cada um é
     link para `/tarefas/prazos/mes?situacao=...` (a VM da E04 lê o `?situacao=`).
  4. Novidade `numeros-no-inicio` (`aprovada: false`).
- **Dados e caminho no banco:** leitura de `rotinas` (3 consultas por abertura, só para o Diretor e o Dono).
- **Regra do banco:** nenhuma.
- **Robô:** nenhum.
- **Testes vitest:** `numerosDoEscritorio` com linhas fixas; "a vencer em 7 dias" conta só pendentes com legal entre hoje
  e hoje+7.
- **Como conferir na tela:** como Diretor no modo desenvolvedor: a faixa aparece; clicar em "Atrasadas" abre Prazos do
  mês filtrado. Como Júnior: não aparece.
- **Critérios de aceite:** os cinco números batem com Prazos do mês; nada para quem não é Diretor/Dono; nenhuma escuta ao
  vivo nova.
- **Riscos:** consumo do banco a cada abertura do Início (por isso a leitura única e o intervalo de 10 min).
- **Dependências:** E04.
- **Tamanho:** pequeno.

### E13. A semana de cada um: prazos das rotinas na agenda do Início

- **Id:** `E13-semana-de-cada-um`
- **O que o escritório ganha:** na lista "Hoje / Amanhã / Esta semana" do Início, além das tarefas delegadas, cada pessoa
  vê os prazos internos e legais das obrigações das empresas dela. Opcional: um e-mail na segunda de manhã com a semana.
- **Como é no Acessórias:** Planejamento semanal (prazos da semana) emitido em PDF no bloco "Semana" do painel clássico
  e mandado por e-mail aos colaboradores toda segunda de manhã (se o PDF é separado por colaborador: **a confirmar**).
  https://acessorias.movidesk.com/kb/pt-br/article/589146/como-emitir-o-planejamento-semanal-no-painel-de-indicadores-clas
- **Como está hoje no NADS:** `packages/core/src/tarefas/regras/agenda.ts` agrupa só tarefas delegadas
  (`GRUPOS_DA_AGENDA`: atrasadas, hoje, amanhã, semana, depois, sem prazo); `useInicioNovo.ts` monta a lista; o calendário
  do mês marca prazos de delegadas e reuniões. `robo/resumo-semanal.js` manda, na sexta às 17h, o resumo do escritório.
- **Passo a passo:**
  1. `agenda.ts`: aceitar itens de um segundo tipo, `{ tipo: 'prazo', empresa, etapa, nomeDaEtapa, legal, interno,
     situacao }`, agrupados pela data do **prazo interno** (o dia de começar), com selo diferente do da tarefa. Não
     misturar com as contagens de tarefas.
  2. `useInicioNovo.ts`: com a novidade `prazos-na-agenda`, buscar as linhas da E04 da competência de trabalho do setor
     da pessoa, filtradas pelas empresas de que ela é responsável (`useEmpresasPermitidas` não serve para o Contábil, que
     vê todas: filtre pelo `responsaveis[setor] === op.nome`). Uma consulta (o setor da pessoa), lida ao abrir.
  3. Clicar no item de prazo abre o Executor da empresa.
  4. E-mail de segunda: **fora desta ficha** (é robô, R7). Se o dono quiser, estender `robo/resumo-semanal.js` com uma
     segunda função "semana da pessoa" que manda a cada um, segunda às 7h, só se `config/avisosPrazos.semanaPorEmail ==
     true`. Usa o `robo/gerado/prazos.js` da E07.
- **Dados e caminho no banco:** leitura de `rotinas` (1 consulta).
- **Regra do banco:** nenhuma.
- **Robô:** só se o e-mail de segunda for aprovado (então R7).
- **Testes vitest:** `agenda.test.ts`: item de prazo com interno amanhã cai em "Amanhã"; atrasado cai em "Atrasadas";
  tarefas delegadas continuam iguais (os testes antigos não mudam).
- **Como conferir na tela:** modo desenvolvedor › Início › Minhas tarefas: aparecem os prazos com selo próprio; clicar
  abre o Executor.
- **Critérios de aceite:** só as empresas da pessoa; nada muda para quem está com a novidade desligada.
- **Riscos:** encher a lista (R10): mostrar no máximo 5 prazos por grupo com "ver todos" levando à E04.
- **Dependências:** E04, E09 (para o DP).
- **Tamanho:** médio.

### M01. Resumo de sexta com a pontualidade da semana (melhoria)

- **Id:** `M01-resumo-semanal-com-prazos`
- **O que o escritório ganha:** o e-mail de sexta que já existe passa a trazer três linhas: quantas obrigações venceram na
  semana, quantas saíram no prazo e quantas atrasaram (com o motivo mais comum).
- **Como é no Acessórias:** os números entram no painel e no relatório de performance; o resumo por e-mail é o
  planejamento semanal. https://acessorias.movidesk.com/kb/pt-br/article/589152 ;
  https://app.acessorias.com/sysajuda.php?p=585&ctg=1
- **Como está hoje no NADS:** `robo/resumo-semanal.js` (`montarTexto(d)` é função pura; sexta 17h; entregue/não entregue,
  quem abriu o link, documentos devidos, Receita, backup).
- **Passo a passo:** em `robo/resumo-semanal.js`, ler as execuções da competência de trabalho (3 consultas) e, com
  `robo/gerado/prazos.js` (E07), contar as linhas com prazo legal na semana; acrescentar o bloco em `montarTexto` (função
  pura: testar em `robo/teste-robo.js`, que já importa e testa `montarTexto`).
- **Dados e caminho no banco:** leitura de `rotinas` (3 consultas por semana).
- **Regra do banco:** nenhuma.
- **Robô e robo-versao:** vigia (nuvem): push autorizado + `robo-versao` da `robo-nilma` com OK do dono (R7).
- **Testes:** `node robo/teste-robo.js` com dados fixos.
- **Como conferir:** sem tela; rodar o teste e, publicado, ler o e-mail da sexta.
- **Critérios de aceite:** os números batem com Prazos do mês filtrado pela semana.
- **Riscos:** baixo.
- **Dependências:** E04, E07 (o gerado).
- **Tamanho:** pequeno.

---

## 8. Fase 4: envio ao cliente e o robô

### E14. Envios com problema, num lugar só (melhoria)

- **Id:** `E14-envios-com-problema`
- **O que o escritório ganha:** uma lista curta do que **não** chegou ao cliente: lote do DP ou do Fiscal com erro, cliente
  sem e-mail, guia sem pasta no Drive, ticket do Mandei com erro de e-mail. Hoje cada erro fica dentro do seu lote.
- **Como é no Acessórias:** ícones de envio abortado (relógio vermelho, envelope de borda grossa) e o filtro "entregas com
  anexo e sem envio de e-mail". https://acessorias.movidesk.com/kb/pt-br/article/600437 ;
  https://acessorias.movidesk.com/kb/pt-br/article/593048
- **Como está hoje no NADS:** `robo/lote-dp.js` e `robo/lote-fiscal.js` gravam `status: 'erro'`, `erro`, `erroEm` no
  lote e `resultados.<código>_<AAAA-MM>` com `status`/`erro` por cliente, e `salvos[].erro` por arquivo; o Mandei grava
  `erroDoEmail` no ticket (`docs/mandei/regras-do-banco.md`). As telas: `telas/dp/useLoteDoDp.ts`,
  `telas/fiscal/relatorio/useEnvioDeGuias.ts`, `telas/mandei` (Central de tickets).
- **Passo a passo:**
  1. Regra pura `packages/core/src/entregas/problemasDeEnvio.ts`: recebe os lotes do DP e do Fiscal da competência (o
     formato que `dados/loteDp.ts` e `dados/loteFiscal.ts` já expõem) e os tickets com `erroDoEmail`, e devolve
     `{ origem: 'dp' | 'fiscal' | 'mandei', cliente, competencia, oQue, erro, quando, abrir: string }[]`.
  2. VM `telas/prazos/useProblemasDeEnvio.ts`: usa `useLoteDp()`, `useLoteFiscal()` e o repositório do Mandei
     **apenas com as consultas que essas telas já fazem** (não criar consulta nova à coleção `tickets` inteira; se o
     repositório do Mandei não tiver uma consulta só dos tickets com erro, deixe o Mandei de fora e anote).
  3. Tela: uma terceira página da aplicação Prazos, "Envios com problema", visível para o Fiscal, o DP e o Diretor; cada
     linha tem "Abrir" que leva ao lote ou ao ticket.
- **Dados e caminho no banco:** só leitura de `lotesDp`, `lotesFiscal` e (se der) `tickets`.
- **Regra do banco:** nenhuma.
- **Robô:** nenhum.
- **Testes vitest:** `problemasDeEnvio.test.ts`: lote com dois clientes, um com erro, gera uma linha; lote inteiro com
  erro gera uma linha com "o lote todo"; sem erro, lista vazia.
- **Como conferir na tela:** `npm run dev`: os exemplos de `dados/loteFiscal.ts` já criam erro para códigos múltiplos de
  9 ("o cliente não tem e-mail no cadastro"); a página mostra essas linhas.
- **Critérios de aceite:** todo erro que aparece dentro dos lotes aparece na lista; "Abrir" leva ao lugar certo.
- **Riscos:** baixo.
- **Dependências:** E04 (a aplicação Prazos). Pode ser feita antes, numa página própria do Fiscal, se E04 atrasar.
- **Tamanho:** pequeno.

### E15. Lote a partir da pasta: as guias já arquivadas viram envio (sem subir de novo)

- **Id:** `E15-lote-a-partir-da-pasta`
- **O que o escritório ganha:** a guia salva na pasta de entrada (Claudio Secretário) é arquivada pelo robô e, sendo uma
  guia do Fiscal reconhecida com segurança, aparece sozinha em Fiscal › Enviar guias como "pronta para enviar", com o
  cliente, a competência e o valor já lidos. A pessoa só confere e dispara. Ninguém sobe o mesmo PDF duas vezes.
- **Como é no Acessórias:** o robô instalado no PC vigia pastas, identifica empresa e competência, dá baixa e envia, com
  configuração por tipo de documento (criar demanda, enviar imediato, agendado). https://acessorias.movidesk.com/kb/pt-br/article/594184 ;
  https://acessorias.movidesk.com/kb/pt-br/article/297299
- **Como está hoje no NADS:**
  - o arquivador por evento `robo/arquivador-continuo.js` vigia `G:\Meu Drive\Claudio Secretario`, identifica cliente e
    tipo com `robo/arquivador-regras.js`, com os modos `desligado | simulacao | producao` e `tiposProducao` no documento
    `robo/arquivadorNovo` (tela: Configurações › Admin › Arquivador, `apps/web/src/aplicativos/admin/dados/arquivadorNovo.ts`);
  - **no DP isto quase já existe**: `robo/envios-do-dp.js` monta `dpArquivos/{AAAA-MM}` a partir das pastas do DP no Drive
    (pelo `robo/drive-indice.js`) e o DP › Envios manda num clique o que já está arquivado;
  - no Fiscal, o lote (`robo/lote-fiscal.js`, coleção `lotesFiscal`) exige subir os PDFs pela tela em pedaços.
- **Desenho:** fazer no Fiscal o que o DP já tem: uma lista por mês das guias do Fiscal já arquivadas no Drive, e o lote
  aceitar arquivo "do Drive" (pelo id) além do subido. **Não** enviar sem revisão nesta ficha (o envio direto é risco de
  mandar a guia de uma empresa para outra).
- **Passo a passo:**
  1. Robô, lista: em `robo/envios-do-dp.js` há a função que, a cada releitura da pasta de um cliente, grava os arquivos
     do DP do mês em `dpArquivos/{AAAA-MM}`. Criar ao lado (arquivo novo `robo/guias-do-fiscal.js`) a mesma coisa para as
     guias do Fiscal: as pastas são as da árvore do Fiscal que `lote-fiscal.js` já usa para gravar (`FISCAL/<regime>/...`;
     leia o trecho de `lote-fiscal.js` que decide a pasta de destino e use as mesmas). Gravar em
     `fiscalArquivos/{AAAA-MM}` `{ clientes: { <código>: { arquivos: [{ i, n, c, s }], em } } }` (mesmo formato do
     `dpArquivos`). Chamar a partir do mesmo ponto do `drive-indice.js` que chama o do DP.
  2. Robô, leitura: para cada arquivo novo da lista, ler a guia com o mesmo leitor do lote (`montarEntrada`, exportada
     por `robo/arquivador-novo.js`; `decidir`, de `robo/arquivador-regras.js`; e `colunaDaGuia`, função interna de
     `robo/lote-fiscal.js`, que precisa ser exportada; confira em `lote-fiscal.js` a ordem exata em que o lote chama as
     três e repita), guardando junto `leitura: { tributo, valor, vencimento,
     apuracao, coluna }`. Limite: 50 leituras por rodada (o consumo do banco tem freio em `robo/consumo.js`).
  3. Robô, envio: em `robo/lote-fiscal.js`, aceitar no arquivo do lote o campo `driveId` (em vez de `partes`); ao
     disparar, baixar pelo Drive (como `envios-do-dp.js` baixa) **só se o `driveId` estiver em `fiscalArquivos` daquele
     cliente e mês** (a mesma trava do DP: "nunca um id qualquer do Drive"). Não gravar de novo no Drive (já está lá).
  4. App: `apps/web/src/aplicativos/tarefas/dados/loteFiscal.ts` e `.firestore.ts`: ler `fiscalArquivos/{AAAA-MM}` (um
     documento) e criar o lote com arquivos `{ driveId, nome, leitura }`. Em `telas/fiscal/relatorio/useEnvioDeGuias.ts`
     e `JanelaDasGuias.tsx`: uma aba "Já na pasta" com as guias do mês prontas, marcadas por padrão as que têm cliente e
     competência; o resto do fluxo (revisar, tirar do lote, disparar, Relatório preenchido) é o de hoje.
  5. Registrar a conexão nova em `scripts/conexoes.mjs`? **Não** precisa (é Firestore dentro de `dados/*.firestore.ts`),
     mas atualizar o comentário do topo de `loteFiscal.firestore.ts` com a coleção nova.
- **Dados e caminho no banco:** `fiscalArquivos/{AAAA-MM}` (o robô grava; a tela lê); `lotesFiscal/{lote}/arquivos/{k}.driveId`.
- **Regra do banco proposta (o Vitor publica):**
  ```
      // as guias do Fiscal já arquivadas no Drive, por mês (plano do Acessórias, ficha E15): só o robô grava
      match /fiscalArquivos/{mes} {
        allow read: if membroNoNads();
        allow write: if false;
      }
  ```
  e, no `match /lotesFiscal/{lote}/arquivos/{k}` que já existe, aceitar o campo `driveId` (string até 100) no `create`
  (texto exato depende da regra atual: **a confirmar** lendo o `firestore.rules` do Entregas; copie como o `dpArquivos`
  está protegido).
- **Robô e robo-versao:** `drive-indice.js`, `guias-do-fiscal.js` e `lote-fiscal.js` rodam na nuvem (`USAR_DRIVE_API=1`).
  Push autorizado + `robo-versao` da `robo-nilma` com o OK do dono (R7). O arquivador **não** muda nesta ficha.
- **Testes:** vitest para a parte do app (o `dados/loteFiscal.ts` de exemplo cria lote com `driveId`); robô:
  `robo/teste-guias-do-fiscal.js` (funções puras: qual pasta é guia do Fiscal, qual mês, o formato do documento), e
  acrescentar em `robo/teste-robo.js` (não há `teste-lote-fiscal.js`; o `teste-robo.js` é o que já cita o `lote-fiscal`) o caso "driveId fora da lista é recusado".
- **Como conferir na tela:** `npm run dev`: Fiscal › Relatório Simples › Enviar guias › aba "Já na pasta" com os exemplos;
  revisar e disparar (no exemplo, nada sai). No banco de verdade só depois da regra e do robô publicados, e com o OK.
- **Critérios de aceite:** nenhuma guia sai sem alguém disparar; id de fora da lista é recusado pelo robô; o Relatório é
  preenchido como hoje.
- **Riscos:** leitura errada de cliente (revisão obrigatória; marcar por padrão só o que tem CNPJ batendo com o
  Cadastro); consumo do banco nas leituras (limite por rodada); a regra do banco.
- **Dependências:** nenhuma das fichas anteriores. Regra do Vitor. R7.
- **Tamanho:** grande.

### E16. Um PDF com guias de vários clientes vira um arquivo por cliente

- **Id:** `E16-pdf-com-varios-clientes`
- **O que o escritório ganha:** quando o portal gera um PDF só com as guias de vários clientes (uma por página), a pessoa
  sobe esse PDF no lote do Fiscal ou do DP e a tela separa sozinha, uma guia por cliente, antes de enviar.
- **Como é no Acessórias:** o robô de lá lê um PDF de várias páginas e separa uma a uma para dar baixa em cada cliente;
  exige PDF de texto, no máximo uma página por cliente e o mesmo tipo e competência em todas; é liberado por cliente
  depois que um setor de homologação de guias analisa o documento. https://acessorias.movidesk.com/kb/pt-br/article/593373/acessorias-como-funciona-o-multipages
- **Como está hoje no NADS:** separar PDF existe só à mão em Ferramentas (`packages/core/src/ferramentas/pdf.ts`,
  `separarPdf(bytes, grupos)`, com pdf-lib, no navegador). A identificação do cliente pelo texto existe em
  `packages/core/src/entregas/guiasDoPdf.ts` (CNPJ ou nome, tipo, competência, vencimento, valor; o texto vem do pdf.js na
  tela).
- **Passo a passo (tudo no navegador; o robô não muda):**
  1. Regra pura `packages/core/src/entregas/paginasPorCliente.ts`: recebe o texto de cada página (`string[]`) e os
     clientes do Cadastro; devolve os grupos de páginas por cliente (`{ codigo, paginas: number[] }[]`) e as páginas sem
     cliente. Página sem CNPJ logo depois de uma com CNPJ fica com o cliente anterior (guia de duas páginas) **somente** se
     não tiver outro CNPJ; com dúvida, vai para "sem cliente".
  2. VM: em `telas/fiscal/relatorio/useEnvioDeGuias.ts` e `telas/dp/useLoteDoDp.ts`, antes de subir: para cada PDF com mais
     de uma página, extrair o texto por página (o mesmo pdf.js que a tela já usa para ler PDF: procure onde o texto é
     extraído no app, por exemplo o leitor de guias da Nova entrega em `telas/entregas/useNovaEntrega.ts`), chamar
     `paginasPorCliente`; se der 2 ou mais clientes, `separarPdf` e mostrar "Este PDF tinha N guias de N clientes: foram
     separadas" com a lista, e a pessoa confirma antes de subir.
  3. Tela: `JanelaDasGuias.tsx` e `JanelaDoLote.tsx` mostram o aviso e a lista (só desenho).
- **Dados e caminho no banco:** nenhum novo (os arquivos separados entram no lote como se a pessoa tivesse subido um a um).
- **Regra do banco:** nenhuma.
- **Robô:** nenhum.
- **Testes vitest:** `paginasPorCliente.test.ts`: 3 páginas com 3 CNPJs = 3 grupos; página 2 sem CNPJ = junto da 1; CNPJ
  que não está no Cadastro = "sem cliente"; CPF do contador (o erro catalogado do Acessórias) não vira cliente (use o CNPJ
  do escritório, a confirmar de onde vem, como lista de ignorar).
- **Como conferir na tela:** juntar 3 guias de exemplo com Ferramentas › Juntar, subir no Enviar guias do Fiscal: aparecem
  3 arquivos, cada um com seu cliente.
- **Critérios de aceite:** a pessoa vê e confirma a separação; nada sobe sem confirmar; PDF de 1 página não muda nada.
- **Riscos:** PDF escaneado (sem texto) não separa: avisar "não deu para ler: suba separado".
- **Dependências:** nenhuma.
- **Tamanho:** médio.

### E17. Envio agendado, dentro de cada setor

- **Id:** `E17-envio-agendado-por-setor`
- **O que o escritório ganha:** a pessoa prepara o lote do DP ou do Fiscal hoje e escolhe "enviar dia X às 8h" (por
  exemplo, para não chegar no fim de semana). Também dá para cancelar o agendado.
- **Como é no Acessórias:** envio imediato ou agendado, forçar ou cancelar o envio, agrupar documentos do departamento.
  https://app.acessorias.com/sysajuda.php?p=144&ctg=1 ;
  https://acessorias.movidesk.com/kb/pt-br/article/594290/acessorias-como-enviar-documentos-agendados-por-um-unico-departa
- **Como está hoje no NADS:** o lote dispara na hora do pedido (`lotesDp` e `lotesFiscal`, o campo do disparo é gravado
  pela tela; o robô atende). O modelo do e-mail já é editável (`config/envioDp`, `config/envioFiscal`). **Juntar setores
  num e-mail não**: decisão do dono de 11/11/2026 (item 2.4).
- **Passo a passo:**
  1. `dados/loteDp.ts` e `dados/loteFiscal.ts` (e os `.firestore.ts`): ao pedir o disparo, gravar opcionalmente
     `agendadoPara` (ISO, horário de Brasília, entre agora+10 min e 30 dias) junto com o pedido de disparo (procure no
     arquivo o campo que a tela grava para disparar, `disparadoPor`/`disparadoPorUid`, e grave ao lado).
  2. `robo/lote-dp.js` e `robo/lote-fiscal.js`: ao achar um lote pedido para disparar, se `agendadoPara` existir e for
     futuro, **pular** (sem mudar nada) até a hora. Grave `agendadoPara` como ISO com fuso (`2026-11-20T08:00:00-03:00`)
     e compare com `Date.parse(agendadoPara) > Date.now()`: assim não depende do fuso da máquina. (`robo/fuso.js` não tem
     função de hora: só exporta `{ FUSO: process.env.TZ }`.)
  3. Telas `useLoteDoDp.ts`/`useEnvioDeGuias.ts`: botão "Agendar" ao lado de "Enviar", com data e hora; o lote agendado
     mostra "agendado para ..." e "Cancelar agendamento" (apaga `agendadoPara` e o pedido de disparo).
- **Dados e caminho no banco:** `lotesDp/{lote}.agendadoPara`, `lotesFiscal/{lote}.agendadoPara`.
- **Regra do banco proposta:** **a confirmar** a regra atual dos dois lotes; acrescentar `'agendadoPara'` aos campos que a
  tela pode gravar no pedido de disparo, com `request.resource.data.agendadoPara is string &&
  request.resource.data.agendadoPara.size() <= 40`.
- **Robô e robo-versao:** nuvem; push autorizado + `robo-versao` com OK do dono (R7).
- **Testes:** vitest da validação da data (função pura em `packages/core/src/tarefas/regras/enviosDoDp.ts` ou novo
  `agendamento.ts`: passado recusado, mais de 30 dias recusado); robô: o teste do lote com um lote agendado no futuro não
  é atendido e no passado é.
- **Como conferir na tela:** `npm run dev`: agendar um lote de exemplo, ver o selo e cancelar.
- **Critérios de aceite:** lote agendado não sai antes da hora; cancelar funciona; os setores continuam separados.
- **Riscos:** o robô desligado na hora marcada manda depois (avisar na tela: "sai na primeira vez que o robô passar depois
  da hora"); guia que vence antes da data agendada (a tela avisa se `agendadoPara` for depois do menor vencimento lido).
- **Dependências:** nenhuma. R7 e regra.
- **Tamanho:** médio.

---

## 9. Fase 5: o que se repete e o que tem passos

### E18. Tarefas recorrentes por empresa (alvará, bombeiros, apólice)

- **Id:** `E18-tarefas-recorrentes`
- **O que o escritório ganha:** o escritório cadastra uma vez "renovar o alvará da empresa X todo ano em março, com 15 dias
  de antecedência, para Fulana" e a tarefa aparece sozinha no Delegador da pessoa na data certa, todo ano (ou todo mês).
- **Como é no Acessórias:** tarefas agendadas com dia, mês e ano; ano "0" repete todo ano; entram na lista do responsável.
  https://acessorias.movidesk.com/kb/pt-br/article/294617/como-cadastrar-tarefas-agendadas ;
  https://app.acessorias.com/sysajuda.php?p=174&ctg=1
- **Como está hoje no NADS:** o Delegador (`packages/core/src/tarefas/regras/delegadas.ts`, `dados/tarefasDelegadas.ts`,
  coleção `nadsTarefasDelegadas`) tem prazo, cliente, responsável, histórico, mas não repete. `robo/lembretes.js` faz
  lembrete por dia do mês e cargo, sem empresa. `robo/papeis-vencendo.js` avisa papéis do cliente (`clientes.papeis`, tipo
  `outro` serve para alvará) sem virar tarefa.
- **Passo a passo:**
  1. Regra pura `packages/core/src/tarefas/regras/recorrentes.ts`:
     ```ts
     export interface Recorrente {
       id: string; titulo: string; descricao: string;
       cliente: { codigo: number; nome: string } | null;
       responsavel: { uid: string; nome: string };
       repete: 'anual' | 'mensal';
       dia: number;               // 1 a 31 (cai no último dia do mês se passar)
       mes?: number;              // 1 a 12, só no anual
       antecedencia: number;      // dias antes do dia em que a tarefa nasce (0 a 60)
       ativa: boolean; criadaPor: string; criadaEm: string;
     }
     export function proximaData(r: Recorrente, hoje: string): string;           // a próxima data-alvo
     export function idDaOcorrencia(r: Recorrente, data: string): string;        // 'rec-' + r.id + '-' + data (determinístico)
     export function nasceHoje(r: Recorrente, hoje: string): string | null;     // a data-alvo se hoje é o dia de criar
     export function tarefaDaOcorrencia(r, data, agora): TarefaDelegada;        // no formato de delegadas.ts
     ```
     A tarefa nascida tem `prazo = data-alvo` e `criadaPor` = quem cadastrou.
  2. Repositório no app: `dados/recorrentes.ts` (interface + exemplo em memória) e `dados/recorrentes.firestore.ts`
     (coleção `nadsRecorrentes`); hook `useRecorrentes()` em `dados/repo.tsx`.
  3. Tela: no Início novo, aba Minhas tarefas, botão "Repetir" ao criar uma tarefa (ou uma janela "Tarefas que se
     repetem" acessível pelo mesmo menu): título, cliente, responsável, anual/mensal, dia/mês, antecedência. VM
     `telas/delegador/useRecorrentes.ts`, tela `telas/delegador/JanelaDasRecorrentes.tsx`. Atrás da novidade
     `tarefas-recorrentes`.
  4. Robô: `robo/recorrentes.js`, iniciado em `robo/vigia-robo.js` ao lado de `lembretes`, uma vez por dia a partir das 8h:
     lê `nadsRecorrentes` com `ativa == true` (uma consulta), e para cada `nasceHoje` cria
     `nadsTarefasDelegadas/{idDaOcorrencia}` com `create` (se já existir, não faz nada: é isso que impede duplicar quando o
     vigia reinicia). Marca o dia em `robo/estado.recorrentesEm` **antes**, como `lembretes.js`. Responsável que não está
     mais ativo em `usuarios`: cria para quem cadastrou e põe no título "(responsável saiu)".
  5. Código do core no robô: mesmo caminho da E07 (`scripts/robo-prazos.mjs` passa a empacotar também `recorrentes`, ou
     um `scripts/robo-recorrentes.mjs` igual).
- **Dados e caminho no banco:** `nadsRecorrentes/{id}`; as ocorrências em `nadsTarefasDelegadas/rec-{id}-{AAAA-MM-DD}`.
- **Regra do banco proposta (o Vitor publica):**
  ```
      // tarefas que se repetem (plano do Acessórias, ficha E18): a equipe cadastra; o robô cria as ocorrências
      match /nadsRecorrentes/{id} {
        allow read: if membroNoNads();
        allow create: if membroNoNads()
          && request.resource.data.keys().hasOnly(['titulo', 'descricao', 'cliente', 'responsavel', 'repete', 'dia', 'mes',
               'antecedencia', 'ativa', 'criadaPor', 'criadaPorUid', 'criadaEm'])
          && request.resource.data.criadaPorUid == request.auth.uid
          && request.resource.data.titulo is string && request.resource.data.titulo.size() > 0 && request.resource.data.titulo.size() <= 120
          && request.resource.data.repete in ['anual', 'mensal']
          && request.resource.data.dia is int && request.resource.data.dia >= 1 && request.resource.data.dia <= 31
          && request.resource.data.antecedencia is int && request.resource.data.antecedencia >= 0 && request.resource.data.antecedencia <= 60;
        allow update: if membroNoNads()
          && (resource.data.criadaPorUid == request.auth.uid || ehDiretorNads())
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['titulo', 'descricao', 'cliente', 'responsavel',
               'repete', 'dia', 'mes', 'antecedencia', 'ativa']);
        allow delete: if resource.data.criadaPorUid == request.auth.uid || ehDiretorNads();
      }
  ```
  A ocorrência é criada pelo robô (Admin SDK), então a regra de `nadsTarefasDelegadas` não muda; confirme só que o id
  `rec-...` não quebra nenhuma conferência de id da regra atual (a confirmar).
- **Robô e robo-versao:** vigia (nuvem): push autorizado + `robo-versao` com OK do dono (R7).
- **Testes vitest:** `recorrentes.test.ts`: anual em 31/03 com 15 dias nasce em 16/03; mensal no dia 31 em fevereiro cai em
  28/02 (29 no bissexto); `idDaOcorrencia` igual para a mesma data; inativa nunca nasce. Robô:
  `robo/teste-recorrentes.js` (criar duas vezes no mesmo dia cria uma só).
- **Como conferir na tela:** `npm run dev` + modo desenvolvedor: criar uma recorrente; a lista mostra "próxima: dd/mm".
  (A criação da tarefa é do robô: no exemplo, mostrar só a próxima data.)
- **Critérios de aceite:** nunca duplica; responsável que saiu não perde a tarefa; a tarefa nascida é uma delegada comum.
- **Riscos:** regra do banco; robô desatualizado (R7).
- **Dependências:** nenhuma ficha. M03 depende desta.
- **Tamanho:** médio.

### M03. Papel do cadastro com "renova todo ano" vira tarefa (melhoria)

- **Id:** `M03-papeis-viram-tarefa`
- **O que o escritório ganha:** a certidão, a procuração ou o alvará cadastrado em `clientes.papeis` deixa de ser só um
  aviso no celular do admin: 30 dias antes de vencer, vira tarefa no Delegador do responsável da empresa.
- **Como é no Acessórias:** tarefas agendadas por empresa (acima) e o AC Certifica com régua de lembretes.
  https://acessorias.movidesk.com/kb/pt-br/article/294617 ;
  https://acessorias.movidesk.com/kb/pt-br/article/585261/acessorias-como-gerenciar-certificados-digitais-com-o-ac-certifi
- **Como está hoje no NADS:** `robo/papeis-vencendo.js` (marcos 30, 15, 3 e 0 dias; avisa admin e contábil);
  `robo/certificados-do-cofre.js` (certificado do cofre); a tela dos papéis `telas/cadastro/escolher/JanelaDosPapeis.tsx`
  (`usePapeisDoCadastro.ts`).
- **Passo a passo:** em `robo/papeis-vencendo.js`, no marco de 30 dias, além do aviso, criar
  `nadsTarefasDelegadas/papel-{código}-{tipo}-{vence}` (id determinístico) para o responsável do Contábil da empresa
  (`cadastro.responsaveis.contabil`; sem ele, o admin). O `papeis-vencendo.js` lê os clientes do arquivo local
  `robo/clientes-cache.js`, que **não** traz `responsaveis`: leia o responsável do espelho
  `cadastro/_espelhos/plano/cadastro` (uma leitura por dia, só quando houver papel no marco de 30). Só se `config/avisosPrazos.papeisViramTarefa == true` (desligado
  por padrão). Reusar `tarefaDaOcorrencia` da E18 para o formato da tarefa.
- **Dados e caminho no banco:** `nadsTarefasDelegadas/papel-...` (o robô cria).
- **Regra do banco:** nenhuma (Admin SDK); `config/avisosPrazos` é lido pelo robô e gravado pela tela de Configurações
  (a confirmar se a regra de `config/*` aceita o documento novo; se não, propor `match /config/avisosPrazos { allow read:
  if membroNoNads(); allow write: if ehDiretorNads(); }`).
- **Robô e robo-versao:** vigia (nuvem), R7.
- **Testes:** não existe `robo/teste-papeis.js`; o `papeis-vencendo.js` é testado em `robo/teste-robo.js`: acrescente lá
  o caso com dois papéis, um a 30 dias (cria uma tarefa, e rodar de novo não cria outra).
- **Como conferir:** sem tela nova; publicado, a tarefa aparece no Início do responsável.
- **Critérios de aceite:** uma tarefa por papel e vencimento; nunca duplica; desligado por padrão.
- **Riscos:** baixo.
- **Dependências:** E18.
- **Tamanho:** pequeno.

### E19. Processos com passos (abertura, alteração, baixa, admissão, rescisão)

- **Id:** `E19-processos-com-passos`
- **O que o escritório ganha:** um modelo de processo (ex.: "Abertura de empresa") com passos em ordem, cada passo com
  responsável, prazo em dias e "depende do cliente". Ao iniciar um processo para uma empresa, os passos viram uma lista
  que anda; o passo que depende do cliente gera um ticket do Mandei. O Diretor vê todos os processos em andamento e onde
  cada um parou.
- **Como é no Acessórias:** matrizes com passos (bloqueante, exige anexo, aparece para o cliente, gatilho, departamento,
  dias, dicas), desdobramentos por pergunta, e-mails de cobrança ao cliente, "pede autorização", suspensão e desistência,
  processos recorrentes. https://acessorias.movidesk.com/kb/pt-br/article/294990/como-criar-uma-nova-matriz-na-gestao-de-processos ;
  https://acessorias.movidesk.com/kb/pt-br/article/592434 ; https://acessorias.movidesk.com/kb/pt-br/article/592308 ;
  https://acessorias.movidesk.com/kb/pt-br/article/609737
- **Como está hoje no NADS:** Administrativo › Entrada de clientes (`telas/administrativo/EntradaDeClientes.tsx`,
  `useEntradaDeClientes.ts`, regras em `packages/core/src/administrativo/entradaDeClientes.ts`): 4 passos (ficha
  pré-cadastral, orçamento em PDF, documentos, cadastro), **protótipo em memória** (`dados/administrativo.ts`), novidade
  `administrativo` não aprovada, só Diretor e Dono. O Mandei faz pedido ao cliente por link (trava de teste, R8). O
  cliente pode pedir "demissão" nas solicitações (`packages/core/src/areaCliente/chamados.ts`; tela
  `apps/web/src/aplicativos/cliente/telas/Chamados.tsx`). Para o ticket do Mandei, a função do app é
  `criarTicket(d)` em `apps/web/src/aplicativos/tarefas/dados/mandei.ts`.
- **Divisão em duas etapas (faça uma de cada vez, com OK do dono entre elas):**
  - **E19a. Entrada de clientes no banco** (o primeiro passo que a lacuna aponta). Criar `dados/administrativo.firestore.ts`
    com a coleção `nadsEntradas/{id}` (o documento é a `Entrada` do core como está), trocar a escolha do repositório
    (exemplo × banco) no mesmo padrão dos outros repos de `dados/repo.tsx`. Nada muda na tela. Só ligar depois de o Vitor
    aprovar a novidade e publicar a regra.
  - **E19b. Modelos de processo.** Só depois da E19a em uso.
- **Passo a passo da E19b:**
  1. Core `packages/core/src/administrativo/processos.ts`:
     ```ts
     export interface PassoDoModelo { id: string; nome: string; setor: 'fiscal' | 'dp' | 'contabil' | 'administrativo';
       dias: number; dependeDoCliente: boolean; dica: string }
     export interface ModeloDeProcesso { id: string; nome: string; passos: PassoDoModelo[]; ativo: boolean }
     export type SituacaoDoProcesso = 'andamento' | 'parado' | 'concluido' | 'desistencia';
     export interface PassoDoProcesso { id: string; situacao: 'pendente' | 'feito' | 'nao-se-aplica'; responsavel: string;
       prazo: string; feitoPor?: string; feitoEm?: string; ticket?: string; observacao?: string }
     export interface Processo { id: string; modelo: string; nomeDoModelo: string; empresa: { codigo: number | null; nome: string };
       situacao: SituacaoDoProcesso; passos: PassoDoProcesso[]; criadoPor: string; criadoEm: string;
       historico: { em: string; por: string; acao: string }[] }
     export function iniciar(modelo, empresa, responsaveis, hoje, por): Processo;   // prazos somando dias úteis (E01)
     export function marcar(p, passo, situacao, por, agora): Processo;            // só o próximo pendente (ordem fixa)
     export function situacaoDe(p, hoje): SituacaoDoProcesso;                     // parado = passo vencido
     ```
     Sem desdobramento por pergunta nesta versão (fica para depois, se o dono pedir). Modelos iniciais em código
     (`MODELOS_INICIAIS`): Abertura, Alteração, Baixa, Admissão, Rescisão, **com os passos a confirmar com cada setor**
     (escreva só os nomes dos modelos e um passo "Conferir os documentos" em cada; os passos reais o dono dita).
  2. Repositório: `dados/processos.ts` + `dados/processos.firestore.ts` (coleções `nadsProcessos` e
     `nadsModelosDeProcesso`), hook `useProcessos()`.
  3. Telas no Administrativo (nova página `processos` em `casca/navegacao.ts`, aplicação `administrativo`):
     `telas/administrativo/Processos.tsx` (lista: empresa, modelo, passo atual, prazo, situação) e
     `telas/administrativo/ProcessoAberto.tsx` (passos em lista, com **Voltar no canto superior esquerdo**, R9). VMs
     `useProcessos.ts` e `useProcessoAberto.ts`.
  4. Passo que depende do cliente: botão "Pedir ao cliente" cria um ticket do Mandei pela função que a Central de tickets
     já usa (`criarTicket(d: DadosDoTicket)` em `dados/mandei.ts`, que devolve o `Ticket`) e guarda o número no passo. Enquanto `LIBERADO_PARA_CLIENTES = false`
     (R8), o e-mail vai só ao escritório: a tela avisa.
  5. Inativar a empresa não existe como ação no NADS hoje (a confirmar); não criar "desistência automática".
  6. Para o cliente ver o processo na Área do Cliente: **fora deste plano** (lado do cliente; e sem chat, R4). É a ficha
     2A.14 `processos-visiveis` do `04-plano-lado-do-cliente.md`, que mostra só o passo atual de um chamado
     (`chamados/{id}.passos`). Se a E19b for feita, decidir com o dono se o cliente passa a ver o passo do
     `nadsProcessos` no lugar do `chamados.passos` (a confirmar); não manter os dois.
- **Dados e caminho no banco:** `nadsEntradas/{id}` (E19a); `nadsModelosDeProcesso/{id}`, `nadsProcessos/{id}` (E19b).
- **Regra do banco proposta (o Vitor publica):**
  ```
      // a entrada de clientes e os processos com passos (plano do Acessórias, ficha E19): Diretor e Dono
      match /nadsEntradas/{id} {
        allow read, create, update: if ehDiretorNads();
        allow delete: if ehDiretorNads();
      }
      match /nadsModelosDeProcesso/{id} {
        allow read: if membroNoNads();
        allow write: if ehDiretorNads();
      }
      match /nadsProcessos/{id} {
        allow read: if membroNoNads();
        allow create: if ehDiretorNads();
        // quem é responsável por um passo marca o passo; o resto, o Diretor
        allow update: if ehDiretorNads()
          || (membroNoNads() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['passos', 'historico', 'situacao']));
        allow delete: if ehDiretorNads();
      }
  ```
  (Os tamanhos e tipos de cada campo: completar com o Vitor; o texto acima é o mínimo.)
- **Robô:** nenhum na E19a e na E19b (o e-mail do ticket é o do Mandei, que já existe).
- **Testes vitest:** `entradaDeClientes.test.ts` continua passando (E19a); `processos.test.ts`: iniciar calcula prazos em
  dias úteis; não deixa marcar o 3º passo antes do 2º; passo vencido deixa o processo "parado"; "não se aplica" anda.
- **Como conferir na tela:** modo desenvolvedor, como Diretor: Administrativo › Processos › Novo › Abertura para uma
  empresa de exemplo; marcar passos; o Voltar no alto à esquerda volta à lista.
- **Critérios de aceite:** E19a sem mudança visível; E19b com ordem respeitada, prazos certos, ticket ligado ao passo.
- **Riscos:** passos nos órgãos mudam por município (não escrever passo a passo de Junta/Receita/Prefeitura sem o setor
  ditar); sobreposição com o Delegador (regra: processo = passos de um modelo; Delegador = tarefa avulsa); Mandei travado.
- **Dependências:** E01 (dias úteis); OK do dono para tirar o Administrativo do modo desenvolvedor; regra do Vitor.
- **Tamanho:** grande (E19a pequeno; E19b grande).

---

## 10. Fase 6: segurança e registro de alterações

### E20. Registro de alterações sensíveis

- **Id:** `E20-registro-de-alteracoes`
- **O que o escritório ganha:** o Diretor consulta quem mudou o quê e quando nas coisas que importam: cargo e papéis de
  usuário, ativar e desativar conta, excluir usuário, liberar e revogar acesso de computador, troca de responsável de
  empresa, dispensa em lote, ajuste de obrigação por empresa. Ninguém apaga nem edita o registro.
- **Como é no Acessórias:** log de alterações de usuários, de departamentos, linha do tempo da empresa (regime De/Para,
  tags, processos), linha do tempo por entrega. https://app.acessorias.com/sysajuda.php?p=586&ctg=1 ;
  https://acessorias.movidesk.com/kb/pt-br/category/02-usuarios-e-permissoes
- **Como está hoje no NADS:** histórico por empresa no Cadastro (`CadastroDaEmpresa.historico`, `registrar()` em
  `packages/core/src/empresas/cadastro/regras.ts`, aba Histórico); eventos das rotinas (`rotinas/{id}/eventos`); histórico
  das tarefas delegadas. **Nada** para usuários e acessos: `dados/acesso.firestore.ts` (`ativar`, `excluir`, mudança de
  cargo, liberar, revogar) grava sem registro.
- **Passo a passo:**
  1. Core `packages/core/src/usuarios/regras/registro.ts`:
     ```ts
     export type AcaoDoRegistro = 'usuario-cargo' | 'usuario-papeis' | 'usuario-ativo' | 'usuario-excluido'
       | 'acesso-liberado' | 'acesso-revogado' | 'responsavel-trocado' | 'prazos-dispensa-lote' | 'obrigacao-ajustada';
     export interface LinhaDoRegistro { acao: AcaoDoRegistro; uid: string; por: string; em: string; alvo: string; detalhe: string }
     export function linhaDoRegistro(acao, quem: { uid: string; nome: string }, alvo: string, detalhe: string, agora: Date): LinhaDoRegistro;
     ```
     `detalhe` até 300 caracteres, sem senha, sem código de liberação, sem CPF (cortar com uma função `semDadoSensivel`
     que tira sequências de 11 ou 14 dígitos).
  2. App: `dados/registro.firestore.ts` com `registrar(linha)` (só `addDoc` em `nadsRegistro`) e `ultimas(n, filtro)` para
     a tela (consulta com `orderBy('em','desc')`, `limit(200)`, carregada ao abrir, não ao vivo); `dados/registro.ts` com o
     exemplo em memória; hook em `dados/repo.tsx`.
  3. Chamar `registrar` **no mesmo lote de escrita** da ação (use `writeBatch` onde a ação já usa; onde é um `updateDoc`
     solto, trocar por um `writeBatch` com as duas escritas) em: `dados/acesso.firestore.ts` (`ativar`, `excluir`, a
     mudança de cargo, aprovar liberação, revogar), na troca de responsável (`useEmpresasPorResponsavel.ts` grava pelo
     `useGravarCadastro`: registrar ao lado, a confirmar o ponto exato), em E06 e em E08.
  4. Tela: Configurações › Admin, página nova "Registro de alterações". Em `apps/web/src/aplicativos/admin/casca/navegacao.ts`:
     acrescentar `'registro'` ao tipo `IdPaginaAdmin` e `{ id: 'registro', rotulo: 'Registro de alterações', titulo:
     'Registro de alterações', icone: 'clock' }` em `PAGINAS_DO_ADMIN` (não existe campo `soAdmin` ali: a Tarefas põe
     `soAdmin: true` sozinha em todas as `PAGINAS_DO_ADMIN` ao montar as Configurações, em `tarefas/casca/navegacao.ts`).
     Acrescentar o `case 'registro'` nos **dois** `switch`: `apps/web/src/aplicativos/admin/rotas.tsx` e
     `apps/web/src/aplicativos/tarefas/telas/configuracoes/TelaDoAdmin.tsx`. Componentes:
     `apps/web/src/aplicativos/admin/telas/registro/Registro.tsx` + `useRegistro.ts` (confira a pasta onde as outras
     páginas do admin ficam e siga o mesmo lugar): filtro por ação, pessoa e período; tabela Quando, Quem, O quê, Em
     quem/onde, Detalhe. Atenção: "admin" aqui é o papel `admin`; um Diretor sem esse papel não vê (é o que a ficha quer?
     **a confirmar** com o dono; a regra do banco proposta usa `ehDiretorNads()`).
- **Dados e caminho no banco:** `nadsRegistro/{auto}` `{ acao, uid, por, em, alvo, detalhe }`.
- **Regra do banco proposta (o Vitor publica):**
  ```
      // o registro de alterações (plano do Acessórias, ficha E20): só acrescenta; ninguém edita nem apaga
      match /nadsRegistro/{id} {
        allow read: if ehDiretorNads();
        allow create: if membroNoNads()
          && request.resource.data.keys().hasOnly(['acao', 'uid', 'por', 'em', 'alvo', 'detalhe'])
          && request.resource.data.uid == request.auth.uid
          && request.resource.data.acao is string && request.resource.data.acao.size() <= 40
          && request.resource.data.por is string && request.resource.data.por.size() <= 120
          && request.resource.data.em is string && request.resource.data.em.size() <= 40
          && request.resource.data.alvo is string && request.resource.data.alvo.size() <= 200
          && request.resource.data.detalhe is string && request.resource.data.detalhe.size() <= 300;
        allow update, delete: if false;
      }
  ```
  Até a regra sair, a ação principal **não pode falhar** por causa do registro: se o lote com o registro for negado,
  repetir a ação sem o registro e avisar no console (decisão a confirmar com o dono; o padrão seguro é não travar o
  trabalho).
- **Robô:** nenhum. (O `robo/backup-diario.js` já faz retrato do banco inteiro: o registro entra no backup sozinho.)
- **Testes vitest:** `registro.test.ts`: CPF e CNPJ no detalhe são cortados; detalhe com 400 caracteres vira 300;
  `linhaDoRegistro` monta a data ISO.
- **Como conferir na tela:** `npm run dev` como Diretor: desativar um usuário de exemplo; Configurações › Registro de
  alterações mostra a linha.
- **Critérios de aceite:** toda ação da lista gera uma linha; só Diretor/Dono leem; ninguém apaga.
- **Riscos:** custo (uma escrita a mais por ação rara: desprezível); a ordem do lote (registro e ação juntos).
- **Dependências:** nenhuma; E06 e E08 chamam depois.
- **Tamanho:** médio.

### E21. Aviso de acesso novo, com "Não fui eu"

- **Id:** `E21-aviso-de-acesso-novo`
- **O que o escritório ganha:** quando a conta de alguém é liberada num computador novo, a própria pessoa recebe no
  celular e no e-mail: "sua conta foi liberada no computador X, em tal cidade, às tantas horas". Se não foi ela, um toque
  em "Não fui eu" (dentro do NADS, na Minha página) encerra aquele acesso e avisa o Diretor.
- **Como é no Acessórias:** e-mail de acesso novo com data e hora, sistema, navegador, IP e localização aproximada,
  botões "Sim, fui eu" e "Não fui eu" (encerra a sessão suspeita e todas as outras, tira os dispositivos confiáveis e
  exige senha nova), cópia aos contadores sócios marcados como administrativos; tela de sessões e dispositivos com a
  localização aproximada.
  https://acessorias.movidesk.com/kb/pt-br/article/610530/acessorias-atualizacoes-de-seguranca-e-acesso-as-contas ;
  https://acessorias.movidesk.com/kb/pt-br/article/593554
- **Como está hoje no NADS:** liberação por computador (`liberacao.ts`; `nadsPedidos/{id}` com `computador`, `authTime`;
  `nadsSessoes/{uid}_{authTime}` com `computador`, `liberadoEm`); o admin revoga em Senhas › Liberação de acessos
  (`telas/acesso/`). O IP e a cidade só existem no cofre (`dados/rede.ts`). A pessoa não é avisada e não vê os próprios
  acessos.
- **Passo a passo:**
  1. Ao criar a sessão (o `setDoc` em `nadsSessoes` em `dados/acesso.firestore.ts`, linha com
     `u.idDaSessao(q.uid, t)`), gravar também `cidade` e `ip` vindos de `dados/rede.ts` (`OndeEstou`), se a consulta
     respondeu (até 5 s; sem resposta, vazio). **Isso muda a regra de `nadsSessoes`** (campos novos).
  2. Robô `robo/aviso-de-acesso.js` (iniciado no vigia): ouve `nadsSessoes` criadas nas últimas 24 h (consulta por
     `liberadoEm`), e para cada uma ainda não avisada manda push (os tokens FCM do usuário, como os outros avisos) e e-mail
     para `usuarios/{uid}.email` (só se `emailPrincipalEm` existir, isto é, e-mail confirmado; as contas `@nilma.local`
     não recebem e-mail). Marca `avisadoEm` na sessão (o robô grava com Admin SDK). Texto: computador, cidade, hora,
     "Se não foi você, abra o NADS › sua foto › Meus acessos › Não fui eu".
  3. Minha página: em `telas/pessoal/JanelaPessoal.tsx` um tópico "Meus acessos" (VM `telas/pessoal/useMeusAcessos.ts`)
     com as sessões da própria pessoa (consulta `nadsSessoes` por `uid == eu`) e o botão "Não fui eu" em cada uma: apaga a
     sessão (o mesmo caminho do revogar do admin, mas da própria pessoa) e grava `nadsAlertas/{auto}` `{ tipo:
     'nao-fui-eu', uid, nome, sessao, computador, em }` para o Diretor. O mural (`nadsAvisos`, `dados/avisos.firestore.ts`)
     **não** serve: lá só o admin e o diretor criam. O robô da E21 também ouve `nadsAlertas` novos e manda push ao
     Diretor (ou a tela de Liberação de acessos lista os alertas: escolher com o dono, **a confirmar**). Pede para trocar a senha (o link de nova senha já existe: `dados/convite.firestore.ts`;
     quem gera é o admin: avisar "peça ao Diretor um link de senha nova").
  4. Atrás da novidade `aviso-de-acesso`.
- **Dados e caminho no banco:** `nadsSessoes/{id}.ip`, `.cidade`, `.avisadoEm`; `nadsAlertas/{auto}` (se não reusar o
  mural).
- **Regra do banco proposta (o Vitor publica; a parte nova):**
  ```
      // no match /nadsSessoes/{id} (plano do Acessórias, ficha E21):
      //  - no create, aceitar também 'ip' (string <= 45) e 'cidade' (string <= 80)
      //  - a própria pessoa lê e apaga as sessões dela ("Não fui eu")
      allow read: if ehAdmin() || (membro() && resource.data.uid == request.auth.uid);
      allow delete: if ehAdmin() || (membro() && resource.data.uid == request.auth.uid);
      // o avisadoEm é gravado só pelo robô (Admin SDK): nenhuma regra para ele

      // o "Não fui eu" (plano do Acessórias, ficha E21): a pessoa só cria o alerta dela; só o Diretor lê
      match /nadsAlertas/{id} {
        allow read: if ehDiretorNads();
        allow create: if membro()
          && request.resource.data.keys().hasOnly(['tipo', 'uid', 'nome', 'sessao', 'computador', 'em'])
          && request.resource.data.uid == request.auth.uid
          && request.resource.data.tipo == 'nao-fui-eu';
        allow update, delete: if false;
      }
  ```
  (O documento de `nadsSessoes` já guarda `uid`, `nome`, `email`, `computador`, `pedidoId`, `codigo`, `liberadoEm`:
  o `resource.data.uid` das linhas acima existe.)
  **A confirmar** a regra atual de `nadsSessoes` antes (ela confere o código do pedido aprovado no create; não mexer
  nessa parte).
- **Robô e robo-versao:** vigia (nuvem), R7.
- **Testes vitest:** função pura `textoDoAvisoDeAcesso(sessao, nome)` em `packages/core/src/usuarios/regras/liberacao.ts`
  (sem IP completo no push: só a cidade; o IP vai no e-mail); `useMeusAcessos` lista só as do próprio uid (teste com o
  repo de exemplo). Robô: `robo/teste-aviso-de-acesso.js` (avisa uma vez; não avisa sessão de mais de 24 h).
- **Como conferir na tela:** `npm run dev` + modo desenvolvedor: Minha página › Meus acessos lista as sessões de exemplo;
  "Não fui eu" tira a sessão da lista.
- **Critérios de aceite:** um aviso por liberação; a pessoa encerra o próprio acesso; o Diretor é avisado.
- **Riscos:** IP e cidade são dado pessoal da equipe (só a pessoa e o Diretor veem); o ipwho.is pode errar a cidade
  (texto "cidade aproximada"); regra do banco.
- **Dependências:** nenhuma; combina com E22.
- **Tamanho:** médio.

### E22. A liberação por computador também para o Diretor e o Dono

- **Id:** `E22-liberacao-tambem-para-admin`
- **O que o escritório ganha:** hoje quem tem mais poder (admin) é quem entra sem a segunda conferência. Com esta ficha,
  um computador novo do Diretor ou do Dono também precisa de um código, que chega no e-mail principal dele.
- **Como é no Acessórias:** verificação em duas etapas obrigatória para todos (código por e-mail ou aplicativo
  autenticador), dispositivo confiável por 7 dias. https://acessorias.movidesk.com/kb/pt-br/article/502902/autenticacao-de-dois-fatores-2fa
- **Como está hoje no NADS:** `useLiberacao(admin, sempre)` em `telas/acesso/useLiberacao.ts`: `precisa` só quando
  `!admin` (menos no Financeiro, `sempre = true`). O código é sorteado quando um admin aprova (`nadsPedidos/{id}/codigo/atual`,
  só admin lê).
- **Desenho (a confirmar com o dono antes de qualquer código):** o pedido do admin é aprovado **pelo robô**, que manda o
  código para `usuarios/{uid}.email` (e-mail confirmado). Assim ninguém aprova a si mesmo pela tela. Alternativa: outro
  admin aprova (só funciona se houver dois). Firebase com segundo fator nativo (Identity Platform) é pago: **não** usar sem
  o dono decidir (a confirmar o custo).
- **Passo a passo (se aprovado o desenho do robô):**
  1. `useLiberacao.ts`: com `config/nads.protecaoAdmin == true`, `precisa` também para admin.
  2. Robô `robo/codigo-do-admin.js` (vigia): ouve `nadsPedidos` pendentes de quem é admin, sorteia o código, grava
     `codigo/atual`, marca o pedido `aprovado` com `aprovadoPor: 'robô (e-mail)'` e `validoAte` (30 min,
     `PRAZO_DO_CODIGO_MS`), e manda o e-mail. Usa `crypto.randomInt` (não `Math.random`).
  3. Tela de liberação do próprio admin (a mesma de hoje para quem não é admin): "O código foi para o seu e-mail".
  4. A chave "Proteger também o Diretor e o Dono" (`config/nads.protecaoAdmin`) fica ao lado da chave que já liga a
     proteção do login (`config/nads.protecaoLogin`), em `telas/cadastro/configuracoes/ConfiguracoesDoNads.tsx` +
     `useConfiguracoesDoNads.ts`; a gravação segue o `setDoc(doc(db, 'config', 'nads'), { protecaoLogin, ... }, { merge:
     true })` de `dados/acesso.firestore.ts`.
- **Dados e caminho no banco:** `config/nads.protecaoAdmin`; os mesmos `nadsPedidos` e `nadsSessoes`.
- **Regra do banco proposta:** a regra de `config/nads` já é "só o admin grava" (conferir); aceitar o campo
  `protecaoAdmin` (bool). O resto o robô grava com Admin SDK.
- **Robô e robo-versao:** vigia (nuvem), R7. **Risco de trancar o dono fora**: com o robô parado, o admin não entra.
  Obrigatório: a chave vem **desligada**; e uma saída de emergência documentada (o dono desliga `protecaoAdmin` direto no
  console do Firebase).
- **Testes vitest:** `liberacao.ts`: `precisaLiberar({ admin: true, protecaoAdmin: true, liberada: false })` = true; com
  `protecaoAdmin: false` = false (função pura nova, usada pelo hook).
- **Como conferir na tela:** só com o banco e o robô; no `npm run dev`, conferir que nada muda com a chave desligada.
- **Critérios de aceite:** desligada, nada muda; ligada, o admin recebe o código por e-mail e entra.
- **Riscos:** trancar o dono (por isso desligada e com saída de emergência); e-mail não confirmado.
- **Dependências:** E21 (o mesmo robô de e-mail pode ser reusado). Decisão do dono.
- **Tamanho:** médio.

---

## 11. Fase 7: decidir antes de fazer

### E23. Lucratividade por cliente (versão mínima)

- **Id:** `E23-lucratividade-minima`
- **O que o escritório ganha:** o Diretor vê, por cliente, o honorário do mês ao lado do tempo que a equipe registrou nas
  tarefas delegadas daquele cliente, e o custo desse tempo por um valor por minuto que ele informa. É um retrato parcial
  (o trabalho das rotinas não tem cronômetro) e a tela diz isso.
- **Como é no Acessórias:** método de custo por minuto, tempo previsto por obrigação, honorário, ocupação e lucro por
  cliente. https://app.acessorias.com/sysajuda.php?p=153&ctg=1 ; https://acessorias.com/site/funcionalidade/metodo-apla/
- **Como está hoje no NADS:** honorários em `dados/honorarios.ts` e `packages/core/src/tarefas/regras/honorarios.ts`
  (usados pelo Financeiro); cronômetro com expediente nas delegadas (`packages/core/src/tarefas/regras/delegadas.ts`, da
  linha ~460 em diante; `TarefaDelegada.cliente`/`clientes`). Rotinas sem tempo.
- **Passo a passo:**
  1. Core `packages/core/src/tarefas/regras/lucratividade.ts`: `tempoPorCliente(tarefas, periodo)` (soma o tempo
     trabalhado das delegadas concluídas no período; tarefa com vários clientes divide igual) e
     `lucratividade(tempos, honorarios, custoPorMinuto)`.
  2. VM `telas/prazos/useLucratividade.ts` (ou no Administrativo; **não** no Financeiro, R6): lê os honorários **uma vez**
     ao abrir, pelo repositório que já existe (`useHonorarios()`), sem criar escuta nova; as delegadas pelo repositório
     do Delegador.
  3. Tela só para Diretor e Dono, atrás da novidade `lucratividade`.
- **Dados e caminho no banco:** leitura; o custo por minuto em `config/lucratividade { custoPorMinuto }` (Diretor grava).
- **Regra do banco proposta:** `match /config/lucratividade { allow read, write: if ehDiretorNads(); }` (a confirmar se
  `config/*` já tem regra geral).
- **Robô:** nenhum.
- **Testes vitest:** soma do tempo, divisão entre clientes, cliente sem honorário aparece como "sem honorário".
- **Como conferir na tela:** com os exemplos das delegadas e dos honorários.
- **Critérios de aceite:** nada muda no Financeiro; a tela avisa que é parcial.
- **Riscos:** número enganoso (parcial); informação sensível. **Recomendação: só fazer se o dono pedir.** A versão
  completa (tempo por etapa da rotina) depende da tela de produtividade que o README da Tarefas lista como "ainda não é".
- **Dependências:** nenhuma.
- **Tamanho:** médio.

### E24. WhatsApp do escritório integrado (só a decisão)

- **Id:** `E24-whatsapp-do-escritorio`
- **O que o escritório ganharia:** um número atendido pela equipe dentro do sistema, com o pedido do cliente virando
  solicitação e o histórico no cadastro.
- **Como é no Acessórias:** Komunic (multiatendente, chatbot, respostas rápidas, botão para abrir solicitação de dentro da
  conversa, API oficial da Meta). https://acessorias.com/site/categoria-de-funcionalidade/komunic/
- **Como está hoje no NADS:** só envio, pelo Baileys no robô da nuvem (`robo/whatsapp.js`, `robo/whatsapp-regras.js`, no
  ramo `origin/desenvolvimento`; o cabeçalho diz que mensagem recebida não é lida). A conversa com o cliente é pelo WhatsApp
  comum (R4).
- **Recomendação:** **não fazer agora.** Ler e guardar mensagens de clientes num chip não oficial aumenta o risco de
  bloqueio e a exposição de dados (LGPD), e um só chip numa VM pequena não aguenta vários atendentes. Se o dono quiser
  mesmo assim, o desenho mínimo é: ouvir `messages.upsert` no robô da nuvem, gravar só **metadados** (cliente pelo número
  do cadastro, hora, "tem anexo") numa coleção do escritório, e um botão "virar solicitação" no Tarefas; nunca no espelho
  do cliente (R5); regra nova (R3); `robo-versao` (R7). Tamanho: grande.
- **Dependências:** decisão do dono; o WhatsApp por QR já em produção.

---

## 12. Melhorias do que o NADS já tem (além das marcadas acima)

As fichas E01, E09, E14 e M01 e M03 já são melhorias. Estas duas completam:

### M02. A troca de responsável leva as pendências e fica registrada

- **Id:** `M02-troca-leva-pendencias`
- **O que o escritório ganha:** quando uma empresa muda de responsável, a pessoa nova recebe junto a lista do que está
  atrasado ou no prazo interno daquela empresa (para não "sumir" na troca), e a troca entra no registro (E20).
- **Como é no Acessórias:** a troca em massa leva os prazos pendentes e justificados, com log.
  https://acessorias.movidesk.com/kb/pt-br/article/593145/acessorias-como-transferir-responsabilidade-em-massa-pelo-menu-e
- **Como está hoje no NADS:** a troca com aceite dos dois lados (`pedirTransferencia`, `responderTransferencia` em
  `packages/core/src/empresas/cadastro/regras.ts`; telas em `telas/cadastro/responsaveis/`). Como a lista E04 calcula o
  responsável pelo Cadastro na hora, as pendências já "vão" para a pessoa nova; o que falta é avisar e registrar.
- **Passo a passo:** na `JanelaDeTroca.tsx`/`useEmpresasPorResponsavel.ts`, antes de confirmar, mostrar "esta empresa tem
  N obrigações atrasadas e M no prazo interno" (linhas da E04 filtradas pela empresa; uma consulta a mais só ao abrir a
  janela); ao aceitar, `registrar` da E20 com `responsavel-trocado`.
- **Dados e caminho no banco:** nada novo além de `nadsRegistro`.
- **Regra do banco:** a da E20.
- **Robô:** nenhum.
- **Testes vitest:** função pura `pendenciasDaEmpresa(linhas, codigo)`.
- **Como conferir na tela:** Configurações › Usuários › Empresas por responsável › Trocar: a contagem aparece.
- **Critérios de aceite:** a contagem bate com Prazos do mês filtrado pela empresa.
- **Riscos:** baixo.
- **Dependências:** E04, E20.
- **Tamanho:** pequeno.

### M04. "Atrasada" em Minhas empresas pelo prazo de verdade

- **Id:** `M04-atrasada-pelo-prazo`
- **O que o escritório ganha:** em Minhas empresas, a empresa com alguma obrigação vencida ganha o selo "Atrasada",
  além de Parada / Em andamento / Não iniciada / Concluída. Hoje uma empresa "em andamento" pode estar com o DAS vencido
  sem nada na lista avisar.
- **Como é no Acessórias:** cores por prazo em toda a lista (antes do interno, entre interno e legal, depois do legal).
  https://acessorias.movidesk.com/kb/pt-br/article/294577
- **Como está hoje no NADS:** `telas/empresas/useMinhasEmpresas.ts` (`FILTROS_INICIAR`, linha 24: Não iniciada, Em
  andamento, Parada; os rótulos vêm de `ROTULO_SITUACAO_GERAL` em `packages/core/src/tarefas/regras/execucao.ts`) e
  `andamento.ts`; o DP já usa prazo no Painel (`usePainelDoDp.ts`: "Atrasado = tem uma parte pendente com o prazo
  vencido").
- **Passo a passo:** função pura `empresaAtrasada(linhas: LinhaDoPrazo[], codigo)` em
  `packages/core/src/tarefas/regras/situacaoDoPrazo.ts` (E04); em `useMinhasEmpresas.ts`, usá-la com as linhas da
  empresa na competência; se alguma for `atrasada` (e sem `aConfirmar`), acrescentar um selo "Atrasada" na linha (não
  trocar a Situação de hoje; é um selo a mais) e um filtro rápido "Atrasadas" ao lado de `FILTROS_INICIAR`. Atrás da novidade `atrasada-pelo-prazo`.
- **Dados e caminho no banco:** nenhum novo (as execuções já são lidas pela tela).
- **Regra do banco:** nenhuma.
- **Robô:** nenhum.
- **Testes vitest:** a função que decide o selo (empresa com uma etapa atrasada e o resto feito = selo).
- **Como conferir na tela:** Minhas empresas com os exemplos: o selo aparece nas empresas com etapa vencida.
- **Critérios de aceite:** mesmo resultado que Prazos do mês para a empresa.
- **Riscos:** prazo "a confirmar" gera selo falso (mostrar o selo só para prazos sem `conferir`, até o setor confirmar).
- **Dependências:** E02, E04.
- **Tamanho:** pequeno.

---

## 13. O que fica fora deste plano

- **Tudo do lado do cliente** (guias na Área, comprovante de leitura, lembrete de vencimento ao cliente, guias pelo
  WhatsApp, acervo, comunicados, aceite de privacidade, avaliação, contatos por setor, processos visíveis ao cliente): está
  no plano da Área do Cliente desta pasta (`04-plano-lado-do-cliente.md`). A régua de lembrete de guia não aberta tem a
  configuração no escritório, mas depende do registro de leitura do lado do cliente: entra lá.
- **Juntar num e-mail as guias de setores diferentes** e **remetente editável**: contrariam a decisão do dono de
  11/11/2026 (item 2.4) e a lacuna foi classificada como importância baixa. Só com o dono revogando a decisão.
- **Catálogo de obrigações inteiro no banco** (o "passo completo" da lacuna `cadastro-de-obrigacoes`): a E08 resolve a
  maior parte com risco menor. Reavaliar depois de 3 meses de uso da E08.
- **Painéis montáveis em modo apresentação, foto da pessoa em rosca, NPS da equipe**: contrariam R10 e R12.
- **OCR de guia escaneada no lote da nuvem**: a máquina da nuvem é pequena demais para o Tesseract (cabeçalho de
  `robo/lote-dp.js`); o escaneado fica "não identificado", como hoje.
- **Obrigação "exige robô"** (só o robô pode dar baixa): não faz sentido enquanto a baixa no NADS é feita pela pessoa no
  Executor.

---

## 14. Resumo das fichas

| Id | Nome | Fase | Tamanho | Regra nova (R3) | Robô (R7) | Depende de |
|---|---|---|---|---|---|---|
| E01-calendario-de-dias-uteis | Calendário único de dias úteis (melhoria) | 0 | pequeno | não | não | — |
| E02-tabela-de-prazos-das-etapas | Prazo legal, interno e multa por etapa | 0 | médio | não | não | E01 |
| E03-permissoes-de-prazos | Permissões novas na tabela de acesso | 0 | pequeno | não | não | — |
| E04-prazos-do-mes | Prazos do mês (lista única) | 1 | grande | não | não | E01, E02 |
| E05-motivo-do-atraso | Motivo do atraso preservado | 1 | médio | a confirmar (`rotinas`) | não | E04 |
| E06-dispensa-em-lote | Dispensa em lote com desfazer | 1 | médio | a confirmar | não | E03, E04 |
| E07-aviso-de-prazo-ao-responsavel | Aviso diário de prazo ao responsável | 1 | médio | não | sim (vigia) | E02, E04, E09 |
| E08-obrigacoes-por-empresa | Ligar/desligar/ajustar etapa por empresa | 2 | grande | a confirmar (`cadastro`) | não | E02, E03 |
| E09-responsavel-do-dp | Responsável do DP no Cadastro (melhoria) | 2 | médio | a confirmar | não | — |
| E10-regime-com-vigencia | Regime com data de início | 2 | pequeno | a confirmar | não | E08 |
| E11-indicadores-de-pontualidade | Pontualidade por pessoa e setor | 3 | médio | não | não | E04, E05, E09 |
| E12-faixa-de-numeros-no-inicio | Cinco números no Início (Diretor) | 3 | pequeno | não | não | E04 |
| E13-semana-de-cada-um | Prazos na agenda do Início | 3 | médio | não | opcional | E04, E09 |
| M01-resumo-semanal-com-prazos | Resumo de sexta com pontualidade | 3 | pequeno | não | sim (vigia) | E04, E07 |
| E14-envios-com-problema | Envios com problema (melhoria) | 4 | pequeno | não | não | E04 |
| E15-lote-a-partir-da-pasta | Guias arquivadas viram envio do Fiscal | 4 | grande | sim (`fiscalArquivos`) | sim (nuvem) | — |
| E16-pdf-com-varios-clientes | Separar PDF por cliente no lote | 4 | médio | não | não | — |
| E17-envio-agendado-por-setor | Envio agendado dentro do setor | 4 | médio | a confirmar | sim (nuvem) | — |
| E18-tarefas-recorrentes | Tarefas que se repetem por empresa | 5 | médio | sim (`nadsRecorrentes`) | sim (vigia) | — |
| M03-papeis-viram-tarefa | Papel vencendo vira tarefa (melhoria) | 5 | pequeno | talvez (`config`) | sim (vigia) | E18 |
| E19-processos-com-passos | Entrada de clientes no banco e processos | 5 | grande | sim (`nadsEntradas`, `nadsProcessos`, `nadsModelosDeProcesso`) | não | E01, OK do dono |
| E20-registro-de-alteracoes | Registro de alterações sensíveis | 6 | médio | sim (`nadsRegistro`) | não | — |
| E21-aviso-de-acesso-novo | Aviso de acesso novo e "Não fui eu" | 6 | médio | sim (`nadsSessoes`) | sim (vigia) | — |
| E22-liberacao-tambem-para-admin | Liberação também para Diretor e Dono | 6 | médio | sim (`config/nads`) | sim (vigia) | E21, decisão |
| E23-lucratividade-minima | Lucratividade por cliente (mínima) | 7 | médio | talvez (`config`) | não | pedido do dono |
| E24-whatsapp-do-escritorio | WhatsApp integrado (só decisão) | 7 | grande | sim | sim (nuvem) | decisão |
| M02-troca-leva-pendencias | Troca de responsável com pendências | — | pequeno | a da E20 | não | E04, E20 |
| M04-atrasada-pelo-prazo | Selo "Atrasada" em Minhas empresas | — | pequeno | não | não | E02, E04 |

### Para cada ficha, antes de dizer "pronto"

1. `npm run verificar` passou (num checkout sem `capturas/` e `perfil-*` soltos; R11).
2. A novidade está `aprovada: false` e a tela só aparece com o modo desenvolvedor.
3. Os comentários dos arquivos novos têm a data e a frase do dono (R1).
4. Se precisa de regra: o texto está num `.md` em `docs/` (ex.: `docs/aplicativos/tarefas/regra-<ficha>.md`, como
   `regra-feedbacks-conversa.md`) e a tela avisa enquanto a regra não sai (R3).
5. Se mexeu no robô: o teste `node robo/teste-<nome>.js` passou, e o relatório lembra que falta o push e o `robo-versao`
   com o OK do dono (R7); se o módulo roda na máquina do `robo/painelPC`, conferir a `versao` lá antes.
6. Nenhum commit, push, merge ou publicação sem o dono pedir (R11).
7. O relatório final lista o que ficou "a confirmar".

