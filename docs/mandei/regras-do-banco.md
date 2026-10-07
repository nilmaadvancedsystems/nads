# Mandei — a regra do banco do Entregas (para o Vitor publicar)

O Mandei (07/10/2026) está no ar com **dados de exemplo**: os tickets ficam no navegador e o e-mail não sai. Para ligar
de verdade, entram três coisas no `firestore.rules` do **Entregas** (projeto `entregas-2e5e2`). Eu (Claude) **não
publico regra**: o texto está aqui para você conferir e publicar.

## O desenho

| Coleção | Quem lê | Quem grava | O que tem |
|---|---|---|---|
| `tickets/{id}` | a equipe no nads | a equipe no nads | o ticket inteiro (controle interno: #número, quem mandou, links, respostas, arquivos, situação) |
| `ticketsLinks/{codigo}` | **quem tem o código do link** (só aquele documento; não dá para listar) | a equipe cria; o cliente só **responde** até vencer | só o que o cliente vê: a empresa, a mensagem, os itens, o prazo (`validoAte`) e as respostas dele |
| `enviosSecretario/{id}` (já existe) | (como hoje) | a equipe (como hoje) **e o cliente do link**, só com o campo `ticket` e enquanto o link vale | o arquivo em pedaços; o robô grava no Drive em `Claudio Secretario/<mês>/<cliente>/Mandei #N` |

- O código do link tem 24 letras e números aleatórios: é o que protege o formulário (como um link de convite).
- O prazo (`validoAte`) é guardado como data do Firestore, para a regra comparar com a hora do servidor
  (`request.time`): vencido, o cliente não grava mais nada.
- O e-mail com o link sai pelo robô de e-mail (`solicitacoesEmail`, tipo `um`), como o "Pedir extratos": a regra
  dessa coleção não muda. **Atenção:** o robô só manda para e-mail do cadastro do cliente; o Mandei vai mostrar os
  e-mails do cadastro para escolher.

## O texto da regra (dentro de `match /databases/{database}/documents { ... }`)

```
    // ── Mandei (nads, 07/10/2026): os tickets mandados aos clientes ──────────────
    match /tickets/{id} {
      allow read, create, update: if membroNoNads();
      allow delete: if ehAdmin();
    }

    // O formulário do cliente: um documento por link, pelo código (o segredo do link).
    match /ticketsLinks/{codigo} {
      function vale() {
        return request.time < resource.data.validoAte && resource.data.get('fechado', false) == false;
      }
      allow get: if true;
      allow list: if false;
      allow create, delete: if membroNoNads();
      // a equipe: tudo; o cliente: só marcar que abriu e mandar as respostas, enquanto o link vale
      allow update: if membroNoNads() || (vale()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['abertoEm', 'respostas', 'respondidoEm'])
        && request.resource.data.respostas is map && request.resource.data.respostas.size() <= 300);
    }
```

E, no `match /enviosSecretario/{id}` que já existe, **acrescentar** (sem mudar o que está lá):

```
      // o arquivo que o cliente anexa no formulário do Mandei (sem login): só com o ticket do link, enquanto ele vale
      function doTicket(codigo) {
        return exists(/databases/$(database)/documents/ticketsLinks/$(codigo))
          && request.time < get(/databases/$(database)/documents/ticketsLinks/$(codigo)).data.validoAte;
      }
      allow create: if request.resource.data.get('ticket', '') is string
        && doTicket(request.resource.data.ticket)
        && request.resource.data.status == 'enviando'
        && request.resource.data.criadoPorUid == 'mandei'
        && request.resource.data.keys().hasOnly(['status', 'nome', 'tamanho', 'partes', 'competencia', 'cliente', 'codigo', 'criadoEm', 'criadoPor', 'criadoPorUid', 'ticket'])
        && request.resource.data.nome is string && request.resource.data.nome.size() <= 200
        && request.resource.data.tamanho is int && request.resource.data.tamanho > 0 && request.resource.data.tamanho <= 26214400
        && request.resource.data.partes is int && request.resource.data.partes >= 1 && request.resource.data.partes <= 30;
      allow update: if resource.data.get('ticket', '') != '' && doTicket(resource.data.ticket)
        && resource.data.status == 'enviando' && request.resource.data.status == 'pendente'
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']);
```

e no `match /partes/{n}` de dentro dele:

```
        allow create: if get(/databases/$(database)/documents/enviosSecretario/$(id)).data.get('ticket', '') != ''
          && request.time < get(/databases/$(database)/documents/ticketsLinks/$(get(/databases/$(database)/documents/enviosSecretario/$(id)).data.ticket)).data.validoAte
          && request.resource.data.keys().hasOnly(['dados'])
          && request.resource.data.dados is bytes && request.resource.data.dados.size() <= 950000;
```

## Depois de publicar

1. Me avise: eu ligo o repositório do banco no Mandei (os tickets em `tickets`, o formulário em `ticketsLinks`, o
   e-mail pelo robô e os arquivos pelo `enviosSecretario`) e publico o site do formulário `mandei-nilma`.
2. Testamos com um ticket para um e-mail do escritório antes de mandar para um cliente.
