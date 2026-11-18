# A regra do banco da senha por pessoa (proposta, 18/11/2026)

Pedido do dono: "a area de cliente vai ter senha de acesso" e "Uma por pessoa". Desenho e o que já está feito:
`desenho-senha-por-pessoa.md`.

Diferença sobre as regras que estão no ar (ruleset `a028d8dc-0b6d-41be-a462-53aebf0c0e04`, de 18/11 19:23). O Firebase
conferiu que compila (`projects:test`, 0 problemas). **Não está publicada.**

O que muda:

1. Duas funções novas: `clienteDoLink(t)` (o login tem `cliente: true` e o link na lista `a`) e `linkPedeSenha(t)` (o
   documento do link tem `exigeSenha: true`).
2. `tokenDaArea` (as caixas de chamados e de envios) e `espelhoVale` (todo o espelho): com `exigeSenha`, só para quem
   entrou com um login que tem o link. Sem `exigeSenha`, igual a hoje.
3. O documento do link aceita a chave `exigeSenha` (booleana) na criação e na troca.
4. Coleção nova `areaClientePessoas/{id}`: o admin e os diretores leem, criam (codigo, nome, email, ativo, datas) e mudam só
   nome, ativo e as datas; ninguém apaga pelo app; o robô responde na ficha pelo Admin SDK.

```diff
     function tokenDaArea(t) {
       return t is string && t.matches('^[0-9a-f]{40}$')
-        && exists(/databases/$(database)/documents/areasCliente/$(t));
+        && exists(/databases/$(database)/documents/areasCliente/$(t))
+        && (!linkPedeSenha(t) || clienteDoLink(t));
     }
+    function clienteDoLink(t) {
+      return request.auth != null && request.auth.token.get('cliente', false) == true
+        && t in request.auth.token.get('a', []);
+    }
+    function linkPedeSenha(t) {
+      return get(/databases/$(database)/documents/areasCliente/$(t)).data.get('exigeSenha', false) == true;
+    }

       function espelhoVale() {
-        return exists(/databases/$(database)/documents/areasCliente/$(token));
+        return exists(/databases/$(database)/documents/areasCliente/$(token))
+          && (!linkPedeSenha(token) || clienteDoLink(token));
       }

-        && request.resource.data.keys().hasOnly(['codigos', 'nome', 'criadoEm', 'criadoPor', 'atualizadoEm'])
+        && request.resource.data.keys().hasOnly(['codigos', 'nome', 'criadoEm', 'criadoPor', 'atualizadoEm', 'exigeSenha'])
+        && request.resource.data.get('exigeSenha', false) is bool
   (na criação e na troca do link)

+    match /areaClientePessoas/{id} {
+      allow read: if ehDiretorNads();
+      allow create: if ehDiretorNads()
+        && request.resource.data.keys().hasOnly(['codigo', 'nome', 'email', 'ativo', 'criadoEm', 'criadoPor', 'atualizadoEm'])
+        && request.resource.data.codigo is int
+        && request.resource.data.nome is string && request.resource.data.nome.size() >= 2 && request.resource.data.nome.size() <= 80
+        && request.resource.data.email is string && request.resource.data.email.matches('^[^ @]{1,64}@[^ @]{1,190}[.][a-z]{2,24}$')
+        && request.resource.data.ativo == true;
+      allow update: if ehDiretorNads()
+        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nome', 'ativo', 'criadoEm', 'criadoPor', 'atualizadoEm'])
+        && request.resource.data.ativo is bool
+        && request.resource.data.nome is string && request.resource.data.nome.size() >= 2 && request.resource.data.nome.size() <= 80;
+      allow delete: if false;
+    }
```

Leituras: a conferência do `exigeSenha` lê o documento do link, que a regra já lia (`exists`) na mesma consulta; o
Firebase conta um documento só por pedido.
