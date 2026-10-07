# Mandei — a regra do banco do Entregas

**Publicada no Entregas (projeto `entregas-2e5e2`) em 07/10/2026**, com o ok do Vitor: só o bloco do Mandei, sobre o
que já estava no ar. O FGTS Digital, o `siegNotas` e o tipo `xmls` do `pedidosSieg` (o commit anterior do Entregas,
"ainda não publicadas") **continuam não publicados**. O texto publicado está no `firestore.rules` do Entregas (os
trechos marcados "Mandei"); a cópia local com o bloco ficou sem commit no Entregas (o commit e o push de lá são do
Vitor).

O Mandei ainda roda com **dados de exemplo** (os tickets no navegador, o e-mail simulado) até o repositório do banco
ser ligado.

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

## Falta para ligar de verdade

1. O repositório do banco no Mandei (tickets em `tickets`, o formulário em `ticketsLinks`, o upload pelo
   `enviosSecretario`), o e-mail pelo robô (`solicitacoesEmail`, tipo `um`, só para e-mail do cadastro: o Mandei
   vai mostrar os e-mails do cadastro para escolher) e o site do formulário `mandei-nilma`.
2. Testar com um ticket para um e-mail do escritório antes de mandar para um cliente.
