# Área do Cliente com senha, uma por pessoa (desenho para o dono e o Vitor)

18/11/2026. Decisões do dono: "a área de cliente vai ter senha de acesso" e "Uma por pessoa". É a ficha
`contatos-e-permissoes` (3.3, ordem 53 do LEIAME). **Nada disso está no código ainda**: o plano manda não implementar
sem este desenho aprovado pelo dono e pelo Vitor (as regras do banco são dele).

## 1. Como é hoje

- A Área é um **link secreto por empresa** (`areasCliente/{token}`, o token tem 40 letras e números). Quem tem o link vê
  tudo da empresa. O site do cliente nem carrega o login do Firebase (`cliente/dados/areaCliente.firestore.ts`).
- O espelho fica no banco do Entregas (`entregas-2e5e2`), **o mesmo projeto do login da equipe**.
- As caixas de entrada (`areaClienteChamados`, `areaClienteEnvios`) aceitam qualquer pedido com um token que existe.

## 2. Como fica para o cliente

1. A equipe cadastra as pessoas da empresa no Tarefas (empresa › Área do Cliente › **Pessoas**): o nome, o e-mail e o
   que cada uma vê. Uma pessoa pode ter várias empresas (o sócio de um grupo, o contador interno).
2. O robô cria o acesso e manda à pessoa um e-mail **"Crie sua senha"**, com o link do próprio Firebase (vale por pouco
   tempo e só uma vez). **Sem senha padrão** e sem senha passada pelo WhatsApp.
3. A pessoa entra no site com **e-mail e senha** e escolhe a empresa (no lugar dos links guardados no navegador).
4. **Esqueci a senha**: o mesmo e-mail "Crie sua senha".
5. Quem sai da empresa: a equipe tira a pessoa da lista e o acesso cai na hora (o robô revoga as sessões).

## 3. O que cada pessoa vê (no banco, não só na tela)

Proposta de setores, marcados por pessoa (o padrão é **Tudo**):

| Setor | O que abre |
|---|---|
| Tudo (sócio) | tudo da empresa |
| Impostos | guias do Fiscal (DAS, DAE, DAM, DARF de impostos), parcelamentos, faturamento, notas, DANFE |
| Pessoal | guias do DP (FGTS, DARF do INSS e do IRRF da folha), Registro (funcionários, holerites), solicitações de admissão, férias e demissão |
| Contábil | extratos, documentos do escritório, certidões |

Todas as pessoas veem o básico: o nome e a ficha da empresa, o certificado, a agenda e as próprias solicitações.

O filtro precisa estar **no banco**: senão quem abre o console do navegador vê o resto. Para isso o robô grava em cada
documento do espelho o campo `setor` (`geral`, `impostos`, `pessoal`, `contabil`), e a regra confere.

## 4. Convivência com os links de hoje

Uma chave por empresa, **Exigir senha**, ligada pela equipe depois de cadastrar as pessoas:

- desligada: o link continua como hoje;
- ligada: o link abre a tela de entrar ("Entre com seu e-mail e senha"), e o banco recusa a leitura só pelo token.

Assim dá para passar empresa por empresa, começando por uma de teste, sem tirar ninguém do ar de uma vez.

## 5. Por dentro

- **Quem pode o quê** vai nas *custom claims* do login do cliente, gravadas pelo robô (Admin SDK):
  `{ cliente: true, a: { "<token>": "ipc" } }` (as letras dos setores; `t` = tudo). Sem leitura a mais no banco a cada
  tela aberta (a regra lê o próprio login, não um documento). Cabem cerca de 15 empresas por pessoa (o limite das claims
  é 1000 bytes); acima disso, a regra lê `areaClientePessoas/{uid}` (uma leitura a mais por consulta).
- **Cadastro**: `areaClientePessoas/{uid}` `{ nome, email, acessos: { <token>: { setores, desde } }, criadoPor, criadoEm }`.
  A equipe grava pelo Tarefas; o robô do PC cria o login, grava as claims e manda o e-mail.
- **Caixas de entrada**: com "Exigir senha" ligada, o pedido leva o `uid` e a regra confere `request.auth.uid`.

## 6. O ponto mais delicado (para o Vitor)

O login dos clientes fica no **mesmo projeto** do login da equipe. Se alguma regra de hoje aceitar só
`request.auth != null` (qualquer pessoa logada), um cliente logado leria coleções internas. Antes de ligar qualquer
coisa, o Vitor confere que **toda** regra interna exige ser da equipe (por exemplo `!request.auth.token.cliente` mais o
`usuarios/{uid}` que já existe). Hoje isso já importa: a chave pública do Firebase deixa qualquer um criar uma conta
(o convite da equipe usa isso), então uma regra "qualquer logado" já seria uma porta aberta.

## 7. Texto proposto das regras (o Vitor ajusta e publica)

```
function ehCliente() { return request.auth != null && request.auth.token.cliente == true; }
function setoresDoCliente(token) {
  return ehCliente() && request.auth.token.a != null && token in request.auth.token.a ? request.auth.token.a[token] : '';
}
function podeVer(token, setor) {
  let s = setoresDoCliente(token);
  return s.matches('.*t.*') || setor == 'geral'
    || (setor == 'impostos' && s.matches('.*i.*'))
    || (setor == 'pessoal' && s.matches('.*p.*'))
    || (setor == 'contabil' && s.matches('.*c.*'));
}
function exigeSenha(token) { return get(/databases/$(database)/documents/areasCliente/$(token)).data.get('exigeSenha', false) == true; }

match /areasCliente/{token} {
  allow get: if !exigeSenha(token) || setoresDoCliente(token) != '';   // o que já existe hoje + o caso com senha
  match /{colecao}/{id=**} {
    allow read: if !exigeSenha(token) || podeVer(token, resource.data.get('setor', 'geral'));
  }
}
match /areaClientePessoas/{uid} {
  allow read: if request.auth != null && (request.auth.uid == uid || ehDaEquipe());
  allow write: if ehDaEquipe();   // a equipe cadastra; o robô (Admin SDK) não passa por aqui
}
```

Observações: `exigeSenha` custa uma leitura do documento do link por consulta (o Firebase guarda por pedido); dá para
trocar por uma claim quando todas as empresas estiverem com senha. `ehDaEquipe()` é a função que o Vitor já usa.

## 8. Em que ordem fazer

1. Vitor: a conferência do item 6 (nenhuma regra "qualquer logado").
2. Código (sem ligar nada): o cadastro de Pessoas no Tarefas, o robô criando o login e as claims, o `setor` em cada
   documento do espelho, a tela de entrar no site.
3. Vitor publica as regras do item 7.
4. Uma empresa de teste com "Exigir senha"; depois as outras, uma a uma.

## 9. Decisões que faltam do dono

- Os setores do item 3 servem (Tudo, Impostos, Pessoal, Contábil)?
- Cada pessoa vê **todas** as solicitações da empresa ou só as que ela abriu (mais as do setor dela)? Proposta: as dela e
  as do setor dela; o sócio (Tudo) vê todas.
- Os e-mails do escritório (guias, avisos) passam a ir para as pessoas do setor, ou continuam no e-mail do cadastro?
  Proposta: continuam no cadastro nesta etapa; mudar depois.
