# Regra do banco: envio agendado dos lotes (ficha E17)

Escrito em 17/11/2026 para o Vitor publicar. O arquivo de regras não está no repositório, então isto é a **proposta**: confira
contra a regra atual de `lotesDp` e `lotesFiscal` antes de publicar.

## O que muda

A tela passa a gravar dois campos novos nos lotes:

1. **Agendar:** no mesmo pedido de disparo de hoje (`status: 'disparar'`, `disparadoPor`, `disparadoPorUid`, `pedidoEm`),
   vai também `agendadoPara`, o dia e a hora de Brasília com o fuso, por exemplo `'2026-11-20T08:00:00-03:00'`.
2. **Cancelar o agendamento:** o lote volta de `status: 'disparar'` para `status: 'lido'` e o `agendadoPara` sai
   (`deleteField()`).

Sem a regra, o Enviar de sempre continua funcionando. Só o Agendar e o Cancelar agendamento dão "o banco recusou".

## Texto proposto

Na regra de `update` de `lotesDp/{lote}` e de `lotesFiscal/{lote}`, onde hoje se confere a lista de campos que a tela pode
mudar no pedido de disparo, acrescente `agendadoPara`:

```
// o pedido de disparo, agora com o agendamento opcional
(request.resource.data.diff(resource.data).affectedKeys()
   .hasOnly(['status', 'disparadoPor', 'disparadoPorUid', 'pedidoEm', 'agendadoPara'])
 && request.resource.data.status == 'disparar'
 && (!('agendadoPara' in request.resource.data)
     || (request.resource.data.agendadoPara is string && request.resource.data.agendadoPara.size() <= 40)))
```

E um caso novo para o cancelar:

```
// cancelar o agendamento: só volta de 'disparar' para 'lido' e tira o agendadoPara
(resource.data.status == 'disparar'
 && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'agendadoPara'])
 && request.resource.data.status == 'lido'
 && !('agendadoPara' in request.resource.data))
```

Quem pode fazer isso é o mesmo que hoje pode disparar: o DP (e o admin) em `lotesDp`; o Fiscal (e o admin) em `lotesFiscal`.

## O robô

Já está pronto no código (sem publicar): `robo/lote-dp.js` e `robo/lote-fiscal.js` pulam o lote com `agendadoPara` no
futuro, olham a fila de 5 em 5 minutos e não apagam o lote agendado na limpeza dos 3 dias. Precisa do push e da troca do
`robo-versao` da VM, com o OK do dono.
