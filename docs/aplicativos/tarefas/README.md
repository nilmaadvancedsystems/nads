# Tarefas — protótipo (2026-09-29)

Pedido do Vitor: a pessoa entra e tem acesso às ferramentas "por demanda da tarefa". As tarefas são
**etapas guiadas**: numa tela cheia, uma etapa por vez, com a ferramenta dela no meio, as objeções comuns ao
lado e, embaixo, **Interromper** e **Próximo**.

Link: https://tarefas-nilma.web.app (ligado ao banco). Código: `apps/web/src/aplicativos/tarefas` e
`packages/core/src/tarefas`.

## O que tem

| Aplicação (gaveta ☰) | Estado |
|---|---|
| **Minhas empresas** | pronta: escolher a competência, ver o andamento de cada empresa, Iniciar/Continuar/Retomar |
| **Contábil** (só para o Contábil e admin) | pronta, só leitura: etapas em todas as empresas, o que mais trava, etapas paradas |
| **Cadastro** | pronta: contas bancárias, plano de contas, contas padrão e histórico de cada empresa (ver abaixo) |
| **Fiscal** (só para o Fiscal e admin) | em desenvolvimento |
| **Drive** | em desenvolvimento |
| **Contato** | em desenvolvimento |

**Executor** (`/tarefas/executar/<empresa>/<competência>`):
- **Próximo** faz o check automático da etapa. Se passar, marca como feita e segue para a próxima. Se não
  passar, mostra o motivo (por exemplo, "Ainda não há extrato de agosto/2026 importado") e destaca as
  objeções.
- **Interromper** abre uma janelinha com as objeções da etapa, mais "Outro motivo" e uma observação. A
  etapa fica **parada** até alguém retomar.
- **Objeções** no meio da tela, cada uma com o que oferecer: pedir ao cliente (Contato, em
  desenvolvimento), buscar no Drive (em desenvolvimento), uma orientação, ou **Não se aplica** (a etapa
  conta como concluída, com o motivo).
- A ferramenta da etapa abre **embutida** (um iframe do site dela; a Casca, dentro de um iframe, mostra só
  a página). A Conferência abre em outra aba (a de verdade, no nads-nilma).

## Rotina do Contábil (RASCUNHO para o Vitor corrigir)

Arquivo único: `packages/core/src/tarefas/rotinas/contabil.ts`.

| # | Etapa | Ferramenta | Check automático |
|---|---|---|---|
| 1 | Importar os extratos | Extrator (importação) | há extrato do banco com lançamentos na competência |
| 2 | Conferir extrato × sistema | Extrator (conferência) | há extrato **e** razão do sistema na competência |
| 3 | Ajustar o cheque especial | Cheque especial | manual |
| 4 | Conciliar os cartões | Conciliadorzinho | manual |
| 5 | Liquidações de títulos | Creditor | manual |
| 6 | Conferir o balancete | Conferência (outra aba) | manual |
| 7 | Fechar a competência | — (no Alterdata) | manual |

## Banco e login

Desde 30/09/2026, o Firestore do **Entregas** (projeto entregas-2e5e2), com o login de lá (as mesmas
contas, nome e senha do Entregas; `dados/entregas.firestore.ts`):
- `rotinas/{empresa}_{competência}_{departamento}`: o estado de cada etapa (o nome não é `tarefas`
  porque essa coleção, no Entregas, é do tarefas.html antigo);
- `.../eventos`: só acrescentados (início, feita, não se aplica, interrompida, check que falhou), com pessoa
  e hora. É a base da produtividade.
- As regras ficam no `firestore.rules` do Entregas (bloco "nads"): lê e grava quem é da equipe; evento
  não se edita nem se apaga.

Quem trabalha é a conta que entrou: o nome vai nos eventos, e o departamento (o do cargo, ou o dos papéis
nas contas antigas) escolhe a rotina. Conta sem departamento vê "Falta o seu departamento".
Nos exemplos (`npm run dev`), não há login: a pessoa escolhe o nome na lista da equipe.

Carrega só a competência pedida e nunca grava antes de ela chegar. O check automático lê, sem gravar, o
que o Extrator guardou (`extrator/{empresa}/arquivos`, ainda no banco da Conferência até o Extratudo mudar).
Os eventos que existiam em `tarefas` na Conferência foram copiados para `rotinas` (o original ficou lá).

## Ainda não é

- **Carteira de cada operador:** "Minhas empresas" mostra todas as empresas do escritório.
- **Produtividade** (tempo por etapa): os eventos já são gravados; falta a tela.

## Cadastro (2026-09-30)

Pedido do Vitor: um lugar só para configurar os dados de cada cliente que as ferramentas usam. A página é a lista
de empresas (`/tarefas/cadastro/empresas`); clicar numa empresa abre uma **janela flutuante** por cima da lista, com
as abas dela na lateral e "‹ Empresas" / ✕ / Esc para voltar (`/tarefas/cadastro/empresas/<empresa>/<aba>`). A
barra lateral de fora fica só com "Empresas" (o Vitor vai decidir o que mais vai nela). Na barra de cima da lista,
o interruptor **Robô lê agência e conta** (config/indiceDrive.contas do Entregas; só o admin muda). Código: `apps/web/src/aplicativos/tarefas/telas/cadastro` e o Model em
`packages/core/src/empresas/cadastro` (de todos os aplicativos, com testes).

| Página | O que faz |
|---|---|
| **Lista** | todas as empresas: bancos (do cadastro ou, sem cadastro, os que o robô já sabe), plano de contas; busca e situação |
| **Contas bancárias** | incluir, editar, encerrar (última competência), reabrir e excluir. Cada conta: banco (logo), agência, conta, tipo, apelido, conta contábil (conferida contra o plano) e a primeira competência |
| **Plano de contas** | importar do Alterdata (planilha do plano ou o balancete, xls/xlsx/csv/txt) ou montar pelo balancete que o Entregas (Clientes › Balancetes) ou a Conferência guardou (só as contas com saldo). Antes de trocar, mostra o que muda e avisa as contas usadas no cadastro que somem |
| **Contas padrão** | as do layout do Creditor: conta do banco da liquidação, juros, descontos e os três históricos. Vazio = o Creditor decide |
| **Histórico** | o que mudou, quem e quando (os 200 mais novos) |

O que o robô já sabe (do Entregas, `clientes/{id}.bancos` e `contasBancarias`, só leitura): o robô aprende os bancos
pelo Drive e pelos extratos e, desde 30/09/2026, a agência e a conta do cabeçalho de cada extrato (Gmail e pastas do
Drive; `scripts/contas-bancarias.js` no Entregas). Empresa sem cadastro: entra no ponto de partida. Com cadastro: o que
falta aparece em "O robô já sabe", com Incluir, Completar (banco sem número) e Incluir todas.

Quem lê: o **Extrator** (as linhas de banco de cada competência e o "Adicionar banco", que grava aqui), o
**Creditor** (o plano de contas no lugar do balancete, as contas padrão; o que ele confirma grava aqui; sem conta
do banco escolhida, vale a conta contábil do Sicoob cadastrado) e o **check automático** da Tarefas.

Nada foi apagado de onde estava: enquanto a empresa não tem os bancos cadastrados, vale o de antes (a lista
provisória de `empresas/bancos.ts` e os bancos adicionados no Extrator), e a tela mostra essa lista com
"Confirmar esta lista". Enquanto não tem as contas padrão, o Creditor usa as que ele já salvou. Ao editar uma
conta, o id não muda (os arquivos importados no Extrator ficam presos a ele). Arquivo da linha genérica
"Banco" vai para o primeiro banco do cadastro.

Banco: o Firestore do **Entregas** (entregas-2e5e2), com o login de lá (o mesmo da Tarefas), coleção `cadastro`
com regra própria no `firestore.rules` do Entregas (quem é da equipe lê e grava; só admin apaga). No Extratudo, o
Cadastro usa o login do Entregas do Drive; sem ele (ou dentro da página do Entregas, que fala pela ponte) a leitura
é negada e as ferramentas seguem como antes, sem gravar nada no cadastro:
- `cadastro/{slug}`: `{ nome, codigo, bancos?, contasPadrao?, historico, atualizadoEm }` (campo ausente = nunca cadastrado);
- `cadastro/{slug}/plano/atual`: `{ contas: [{ codigo, nome, classificacao?, grupo?, sintetica?, ordem }], origem, arquivo?, importadoEm, por? }`.
