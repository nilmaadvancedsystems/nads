# Os aplicativos do nads

> **Mudança em andamento (30/09/2026):** o nads inteiro passa a gravar no banco do **Entregas** (`entregas-2e5e2`),
> com as contas de lá. Coleções novas: `rotinas` (Tarefas, feito), `extrator` (Extratudo) e `conferencia`
> (Concilia aí e a Conferência antiga). Ordem: Tarefas → Extratudo → Concilia aí.

Decisão do Vitor (2026-09-29): cada aplicativo é **isolado**, desenvolvido e testado separado, com o seu
link. Depois, no mesmo dia, as três ferramentas do banco viraram um aplicativo só: o **Extratudo**.

| Aplicativo | Link | Rota | O que faz | Banco |
|---|---|---|---|---|
| **Concilia aí** (a Conferência) | concilia-ai-nilma.web.app | `/`, `/292/movimento/relatorio` | balancete × notas: importação, cadastro, relatório, checklist, auditoria | Firestore da Conferência (no nads-nilma) |
| **Conciliadorzinho** | conciliadorzinho-nilma.web.app | `/conciliadorzinho/292/conciliacao/<etapa>` | cartão × notas fiscais, arquivos por bandeira | nenhum |
| **Extratudo** | extratudo-nilma.web.app | `/extratudo/292/<ferramenta>/…` | tudo do banco da empresa (abaixo) | Firestore da Conferência, coleção `extrator` (o Extrator guarda os lançamentos lidos; o Creditor guarda as contas em `extrator/{slug}/creditor/contas` e só **lê** o balancete em `empresas/{slug}`; os clientes aprendidos em `extrator/{slug}/creditor/clientes`). O Creditor também lê o Drive pelo **Entregas** (`driveIndice`, `aberturasDrive`), com login |
| **Extratudo (Entregas)** | extratudo-entregas.web.app | igual ao Extratudo | o mesmo Extratudo, hospedado no projeto do Entregas (`entregas-2e5e2`) a pedido do Vitor (2026-09-29): `npm run sites -- extratudo-entregas` cria o site na 1ª vez | o mesmo do Extratudo (Firestore da Conferência) |
| **Tarefas** | tarefas-nilma.web.app | `/tarefas/<aplicação>/<página>`, `/tarefas/executar/292/2026-08`, `/tarefas/cadastro/292/bancos` | etapas guiadas por empresa e competência (protótipo) e o **Cadastro** da empresa (contas bancárias, plano de contas, contas padrão; ver `tarefas/README.md`) | **Firestore do Entregas** (`entregas-2e5e2`), coleções `rotinas` e `cadastro`, com o **login do Entregas** (30/09/2026). O Extrator e o Creditor leem o `cadastro` (com o login do Entregas; sem ele, seguem como antes). Ainda lê o Extrator no banco da Conferência até o Extratudo mudar |

## Extratudo

Uma empresa, três ferramentas na barra lateral; as páginas da ferramenta ficam nas abas de cima.

| Ferramenta | Rota | O que faz |
|---|---|---|
| **Extrator** | `/extratudo/292/extrator/<seção>/<página>` | extrato bancário × lançamentos contábeis (falta, diferente, a mais, duplicado) |
| **Cheque especial** | `/extratudo/292/cheque-especial/ajuste/saldo-negativo` | ajuste do saldo negativo a partir do saldo diário |
| **Creditor** | `/extratudo/292/creditor/<etapa>` | relatório de liquidação do banco × sistema → importação de 8 colunas |

Código: `apps/web/src/aplicativos/extratudo/` (casca comum, entrada e `ferramentas/<id>/`) e
`packages/core/src/extratudo/<id>/`. Docs de cada ferramenta em `docs/aplicativos/extratudo/<id>/`. Os links
antigos (`/extrator`, `/cheque-especial`, `/creditor` e os sites extrator-, cheque-especial-, creditor-nilma)
levam para o Extratudo.

## Regras

Todos começam escolhendo a empresa. Um aplicativo não importa nada de outro: o que é comum fica em
`apps/web/src/comum`, `packages/ui` e `packages/core/src/{formatos,empresas,usuarios}`.

## Links (um site por aplicativo)

`VITE_APLICATIVO=<id>` gera um site com **um aplicativo só**. Para gerar e publicar:

```bash
npm run sites -- extratudo            # ou vários, ou "todos"
```

Os sites usam `--mode exemplos` (dados de exemplo, sem banco), menos o Extratudo, que é ligado ao banco
(`--mode banco`). Só a hospedagem deles é publicada.

Histórico: em 2026-09-28 as ferramentas chegaram a ficar dentro da Conferência (primeiro "Conciliei",
com uma caixa estilo GitHub Insights, depois "Concilia aí" com tudo na barra lateral). A caixa
(`<Casca lateral="caixa">`) continua guardada no `packages/ui`.
