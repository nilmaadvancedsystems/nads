# As etapas da Tarefa como telas próprias do nads

Pedido do Vitor (06/10/2026): "Todas essas aplicações integradas no Tarefas, quero que sejam independentes e
exclusivas do nads; redesenhe com a lógica do nads, da arquitetura e estrutura."

Decisões (Vitor, 06/10/2026):
- **Sites separados saem do ar** no fim (Extratudo, Concilia aí, Conciliadorzinho): os links levam para a Tarefa.
  O Conversor e o Componentes continuam (não são etapas).
- **Dados nos mesmos lugares do banco**: a tela nova lê e grava os mesmos documentos de hoje; nada migra.
- **Visual igual ao de hoje**: muda a estrutura por baixo; a pessoa vê as mesmas telas e botões.
- **Ordem: as menores primeiro**, uma etapa por vez, publicando cada uma.

## Como fica

Hoje cada etapa com ferramenta abre outro aplicativo num iframe e conversa com a Tarefa por mensagens
(`comum/ponte.ts`: requisitos, ⚡, sem movimento, troca de competência, destacar). Depois:

```
packages/core/src/tarefas/tipos.ts     Etapa.tela = { id: TelaDaEtapa; periodo? }  (no lugar de ferramenta)
apps/web/src/aplicativos/tarefas/
  dados/                               os repositórios que as etapas usam (vindos do Extratudo/Concilia aí)
  telas/executor/etapas/
    contexto.tsx                       a etapa aberta (empresa, meses, modo desenvolvedor) + requisitos e ⚡ para o Executor
    TelaDaEtapa.tsx                    id da tela → componente
    <etapa>/use<Etapa>.ts + <Etapa>.tsx   ViewModel + View (MVVM), as regras no packages/core
```

- A etapa recebe empresa e meses pelo contexto (não pela URL), diz o que falta com `useRequisitosDaEtapa` e
  oferece os dados de teste com `useDadosDeTesteDaEtapa` — chamadas de função, sem iframe e sem postMessage.
- As regras continuam no `packages/core` (extrator, creditor, clientes, conferencia, conciliadorzinho).
- Quando a última etapa sair do iframe: some o `ponte.ts`, o `useFerramentaNaEtapa` (altura do iframe), as rotas
  `/extratudo` e da Conferência dentro da Tarefa, e os aplicativos `extratudo`, `concilia-ai` e `conciliadorzinho`.

## Etapas

| # | Etapa (rotina Contábil) | Hoje (iframe) | Tela nova | Situação |
|---|---|---|---|---|
| 1 | Bancos (Relatório Bancário) | extratudo › extrator/tarefa/bancos | etapas/bancos | feita (06/10) |
| 1 | Clientes | extratudo › extrator/tarefa/clientes | etapas/clientes | feita (06/10) |
| 2 | Creditor (Arquivo, Relatório de Recebimento, Lançamentos, Exclusão) | extratudo › creditor | etapas/creditor | feita (06/11) |
| 3 | Importação (Contábil e Fiscal) | extratudo › extrator/tarefa/extratos | etapas/importacao | feita (06/11) |
| 4 | Conferência fiscal | concilia-ai › movimento/relatorio | etapas/conferencia | feita (06/11) |
| 5 | Cartões (cartão empresarial) | extratudo › cartoes | etapas/cartoes | feita (06/11) |
| 6 | Vendas no cartão | conciliadorzinho › conciliacao/bandeiras | etapas/vendas | feita (06/11) |
| 7 | Tirar os sites do ar e apagar os aplicativos antigos | | | feita (06/11) |

## Como ficou (06/11/2026)

Vitor: "Não quero essas ferramentas na mesma tela, quero elas separadas, uma em cada caixinha" e "não quero essas aplicações
rodando externas, deixa apenas nas etapas". Não há mais iframe nem aplicativo à parte:

- O código das ferramentas mora em `apps/web/src/aplicativos/tarefas/etapas/` (extrator, creditor, cartoes, conferencia,
  conciliadorzinho) e abre pela tela da etapa (`telas/executor/etapas/<etapa>`), com os repositórios em `etapas/Provedores.tsx`.
- A ponte (`telas/executor/etapas/ponte.tsx`) tem os mesmos nomes de antes, mas pelo contexto da etapa: os bancos sem
  movimento, o período, o Resolver, o que falta e o ⚡. O período que ia na URL do iframe vem de `useParametrosDaEtapa`.
- Ordem do Contábil: Importação → Cheque especial → Conferência fiscal → Creditor (CRÉD.LIQ) → Cartões (cartão empresarial)
  → Vendas no cartão → o resto. As três só entram na empresa que tem (Cadastro › Contábil › Parâmetros).
- Os sites concilia-ai-, conciliadorzinho-, extratudo-, extrator-, creditor-, cheque-especial-nilma e extratudo-entregas
  só levam para a Tarefa (scripts/sites.mjs, tipo mudou). O Conversor e o Componentes continuam como estão.

## Dados (mesmos documentos)

| O quê | Onde | Módulo |
|---|---|---|
| Extratos e razões (Extrator) | Conferência: `extrator/{empresa}` | `tarefas/dados/extrator*.ts` |
| Marcas dos clientes | Conferência: `extrator/{empresa}/creditor/clientes-AAAA-MM` | `tarefas/dados/clientes*.ts` |
| Cadastro (bancos, sócios, plano) | Entregas: `cadastro/{empresa}` | `tarefas/dados/fonte.ts` (já era da Tarefa) |
| Creditor (contas, históricos) | Conferência: `extrator/{empresa}/creditor/…` | etapa 2 |
| Conferência (notas, balancete) | Conferência: `empresas/{empresa}` | etapa 4 |
