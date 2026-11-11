# Mandei — a regra do banco do Entregas

**Publicada no Entregas (projeto `entregas-2e5e2`) em 07/10/2026**, com o ok do Vitor: só o bloco do Mandei, sobre o
que já estava no ar. O FGTS Digital, o `siegNotas` e o tipo `xmls` do `pedidosSieg` (o commit anterior do Entregas,
"ainda não publicadas") **continuam não publicados**. O texto publicado está no `firestore.rules` do Entregas (os
trechos marcados "Mandei"); a cópia local com o bloco ficou sem commit no Entregas (o commit e o push de lá são do
Vitor).

**Ligado ao banco em 11/11/2026** ("liga ao banco"): a Tarefa grava os tickets e os formulários, o robô manda o e-mail e o
formulário do cliente (cliente.nilmacontabilidade.com/mandei/<código>) responde e anexa direto no Entregas. No modo
desenvolvedor e no `npm run dev`, continuam os dados de exemplo (neste navegador).

## O desenho

| Coleção | Quem lê | Quem grava | O que tem |
|---|---|---|---|
| `tickets/{id}` | a equipe no nads | a equipe no nads | o ticket inteiro (controle interno: #número, quem mandou, links, respostas, arquivos, situação) |
| `ticketsLinks/{codigo}` | **quem tem o código do link** (só aquele documento; não dá para listar) | a equipe cria; o cliente só marca que abriu e manda as respostas e a lista dos arquivos, **enquanto vale** | só o que o cliente vê: a empresa, a mensagem, os itens, o prazo (`validoAte`, data do Firestore) e as respostas dele |
| `enviosSecretario/{id}` (já existia) | a equipe no nads vê os envios com `ticket` | a equipe (como antes) **e o cliente do link**, com o campo `ticket`, `criadoPorUid: 'mandei'`, enquanto o link vale | o arquivo em pedaços; o robô (`nads/robo/envios-do-nads.js`, sem mudança) grava em `Claudio Secretario/<mês>/<cliente do cadastro>` — o nome do arquivo leva "Mandei #N" |

## O link temporário (por que assim)

- O link é `…/<código>`: 24 letras e números de um gerador aleatório do navegador (`crypto.getRandomValues`), sem as
  letras parecidas (0/O, 1/l/I). São 57^24 ≈ 10^42 combinações: impossível de adivinhar.
- O código é o **nome do documento** em `ticketsLinks`. Quem tem o link lê aquele documento; listar a coleção é
  proibido, então não dá para "procurar" links.
- O prazo é conferido **pela regra, com a hora do servidor** (`request.time < validoAte`): vencido, o banco recusa
  qualquer gravação, mesmo que alguém mexa no navegador. O ticket resolvido fica `fechado` e também para de aceitar.
- O 2º link é **outro documento, com outro código** (5 dias corridos); o 1º continua vencido. Assim nunca se "estica"
  um link velho.
- Não precisa de servidor, de função paga (Blaze) nem de encurtador: é só Firestore + regra.

## Como ficou ligado (11/11/2026)

- **A Tarefa** (`apps/web/src/aplicativos/tarefas/dados/mandei.firestore.ts`): cria `tickets/{id}` (o número em
  `tickets/_numero`, numa transação), o `ticketsLinks/{código}` do link (o `DocDoLink` do core, com o `validoAte` como
  data do banco) e o pedido do e-mail. O 2º link e o link da volta ("Pedir de novo") são outro documento, e o de antes
  fica `fechado`; o Resolver fecha o atual. A Central lê o ticket já com o que o cliente fez no link
  (`mandei.ticketComOsLinks`: quando abriu, as respostas, quando mandou e os arquivos, com o andamento pelo
  `enviosSecretario`).
- **O e-mail** sai pelo vigia (`robo/mandei.js`): `solicitacoesEmail` com `tipo: 'mandei'` (`ticket`, `link`, `para`,
  `assunto`, `corpo`…). O robô confere contra o ticket (o link é o atual, o ticket não foi resolvido, o e-mail é o do
  ticket, o formulário existe), manda pela caixa do setor de quem pediu e marca no próprio ticket `enviadoEm` (ou
  `erroDoEmail`). Não registra cobrança (não é o Pedir extratos).
- **A trava**: `LIBERADO_PARA_CLIENTES = false` em `robo/mandei.js`: por enquanto o e-mail só sai para
  `nilmacontabilidade@gmail.com` (o ticket para um cliente dá erro "ainda não foi liberado", sem mandar nada). Depois do
  teste, liberar é pôr `true`, com o ok do escritório, e atualizar o robô (o da nuvem só pega com o `robo-versao` novo).
- **O formulário** (`apps/web/src/aplicativos/mandei/dados/formulario.firestore.ts`, sem login, no app do site do
  cliente): lê o documento do link, grava `abertoEm`, o rascunho e as `respostas` (passam pelo `aplicarRespostas` do
  core), o `respondidoEm` e a lista dos `arquivos`; o anexo vai em pedaços pelo `enviosSecretario` (até 25 MB), e o robô
  grava no Drive, em Claudio Secretario.
- **A Área do Cliente** ainda não mostra os tickets do banco (o robô não espelha os tickets no `areasCliente/{token}`):
  só no exemplo.
