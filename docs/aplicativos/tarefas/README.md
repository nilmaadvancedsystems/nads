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
