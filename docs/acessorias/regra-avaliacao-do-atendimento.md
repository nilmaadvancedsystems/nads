# Avaliação do atendimento: o que o Vitor confere na regra (18/11/2026)

Ficha `avaliacao-do-atendimento` (plano do Acessórias). **Não precisa de regra nova**: o cliente manda a nota pela caixa
que já usa (`areaClienteChamados`, título `AVALIACAO`, texto `chamado:<id> nota:<n>` e o comentário na linha de baixo),
e quem grava é o robô do PC (Admin SDK), no chamado interno:

- `chamados/{id}.avaliacao`: `{ nota: 1..5, comentario: string (≤500), em: ISO }`.

## Uma coisa para conferir

A equipe responde e muda a situação dos chamados pelo navegador. Se a regra de `chamados/{id}` conferir **todas as chaves
do documento** na gravação (algo como `request.resource.data.keys().hasOnly([...])`), então, depois de o robô gravar
`avaliacao`, a equipe não consegue mais responder nem reabrir aquele chamado.

- Se a regra usa `hasOnly` no documento inteiro: acrescentar `'avaliacao'` à lista.
- Se usa `diff(resource.data).affectedKeys().hasOnly([...])` (só as chaves que mudaram) ou não confere chaves: nada a fazer.

## Ordem de publicação

O robô do PC primeiro, o site depois: um robô antigo transformaria a avaliação num chamado "AVALIACAO" para a equipe.
