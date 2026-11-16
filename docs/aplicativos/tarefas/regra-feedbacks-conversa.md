# Regra do banco: a conversa dos Feedbacks (16/11/2026)

**PUBLICADA em 16/11/2026 às 16:41 (ruleset 1bed0f73-b40b-49cf-83c4-8b9d0ff21d7a no entregas-2e5e2), com o ok do
usuário, pelo Firebase CLI.** Foi feita sobre a regra que estava no ar (ruleset 1a14fe0b…, das 14:26, que já tinha o
`delegacao` dos feedbacks), mudando só o bloco dos feedbacks (o `allow update`, o `match /mensagens` e a função
`conversaDoFeedbackOk`); o resto ficou igual. O `firestore.rules` do repositório do Entregas ainda não tem essa mudança:
quem mexer lá precisa trazer este bloco, ou a próxima publicação desfaz.

Pedido do usuário: "preciso de um chat onde eu possa responder os feedbacks, para entender mais, fazendo perguntas".
No site, a conversa é a novidade `conversa-feedback` (só no modo desenvolvedor até o Vitor aprovar).

## O desenho no banco

- `feedbacks/{id}/mensagens/{auto}`: `{ de: 'admin' | 'autor', uid, nome, texto (até 2000), em (ISO) }`. Só cria; ninguém
  edita; o admin apaga.
- No feedback, o resumo `conversa: { qtd, ultimaDe, ultimaEm, ultimoTexto (até 280) }`, gravado no mesmo lote que a
  mensagem (`conversa.qtd` com `increment(1)`).
- Lê as mensagens: o admin, e quem mandou o feedback (o `uid` do feedback).
- Escreve: o admin, enquanto o feedback não está `feito`; quem mandou, só depois que já existe conversa (o admin começou)
  e enquanto não está `feito`.

## O bloco (troca o `allow update` do feedbacks e acrescenta o `match /mensagens`)

O texto exato publicado é o do ruleset acima: o ramo do admin também confere o `delegacao` com
`delegacaoDoFeedbackValida`, que já estava no ar e ficou como era.

```
    match /feedbacks/{id} {
      // ... (read, create e delete como estão)
      // o admin muda a situação, delega e pergunta; quem mandou responde o teste (só em Testando) e escreve na conversa
      // depois que o admin começou (16/11/2026), enquanto não foi resolvido
      allow update: if (ehAdmin()
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'resolvidoEm', 'delegacao', 'conversa'])
          && (!('conversa' in request.resource.data.diff(resource.data).affectedKeys()) || conversaDoFeedbackOk('admin')))
        || (membroNoNads() && resource.data.uid == request.auth.uid && resource.data.status == 'testando'
          && request.resource.data.status in ['feito', 'resolvendo']
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'resolvidoEm']))
        || (membroNoNads() && resource.data.uid == request.auth.uid && 'conversa' in resource.data
          && resource.data.status != 'feito'
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['conversa'])
          && conversaDoFeedbackOk('autor'));
      // a conversa (16/11/2026): cada mensagem só é criada (ninguém edita); lê o admin e quem mandou
      match /mensagens/{m} {
        allow read: if ehAdmin()
          || (membro() && get(/databases/$(database)/documents/feedbacks/$(id)).data.uid == request.auth.uid);
        allow create: if membroNoNads()
          && request.resource.data.keys().hasOnly(['de', 'uid', 'nome', 'texto', 'em'])
          && request.resource.data.uid == request.auth.uid
          && request.resource.data.texto is string && request.resource.data.texto.size() > 0 && request.resource.data.texto.size() <= 2000
          && request.resource.data.nome is string && request.resource.data.nome.size() <= 120
          && request.resource.data.em is string && request.resource.data.em.size() <= 40
          && ((request.resource.data.de == 'admin' && ehAdmin()
              && get(/databases/$(database)/documents/feedbacks/$(id)).data.status != 'feito')
            || (request.resource.data.de == 'autor'
              && get(/databases/$(database)/documents/feedbacks/$(id)).data.uid == request.auth.uid
              && 'conversa' in get(/databases/$(database)/documents/feedbacks/$(id)).data
              && get(/databases/$(database)/documents/feedbacks/$(id)).data.status != 'feito'));
        allow delete: if ehAdmin();
      }
      // ... (o match /partes como está)
    }
    // o resumo da conversa: a contagem sobe de um em um, a última é de quem está escrevendo
    function conversaDoFeedbackOk(lado) {
      let c = request.resource.data.conversa;
      return c is map
        && c.keys().hasOnly(['qtd', 'ultimaDe', 'ultimaEm', 'ultimoTexto'])
        && c.qtd == resource.data.get('conversa', {'qtd': 0}).qtd + 1
        && c.ultimaDe == lado
        && c.ultimaEm is string && c.ultimaEm.size() <= 40
        && c.ultimoTexto is string && c.ultimoTexto.size() <= 280;
    }
```

Observação: o admin também não pergunta em feedback `feito` pela tela (a conversa fica só para ler); a regra do
`allow update` do admin não trava isso, mas a da mensagem trava.
