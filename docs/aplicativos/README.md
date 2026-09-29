# Os aplicativos do nads

Decisão do Vitor (2026-09-29): cada ferramenta é **um aplicativo isolado**, desenvolvido e testado
separado, cada um com a sua prévia.

| Aplicativo | Rota | O que faz | Banco |
|---|---|---|---|
| **Concilia aí** (a Conferência) | `/`, `/292/movimento/relatorio` | balancete × notas: importação, cadastro, relatório, checklist, auditoria | Firestore da Conferência (no site publicado) |
| **Conciliadorzinho** | `/conciliadorzinho/292/conciliacao/<etapa>` | cartão × notas fiscais, arquivos por bandeira | nenhum |
| **Cheque especial** | `/cheque-especial/292/ajuste/saldo-negativo` | ajuste do saldo negativo a partir do saldo diário | nenhum |
| **Creditor** | `/creditor/292/<etapa>` | relatório de liquidação do banco × sistema → importação de 8 colunas | nenhum |

Todos começam escolhendo a empresa. As ferramentas usam a lista de empresas do escritório e não guardam
nada. Um aplicativo não importa nada de outro: o que é comum fica em `apps/web/src/comum`,
`packages/ui` e `packages/core/src/{formatos,empresas}`.

## Prévias (uma por aplicativo)

`VITE_APLICATIVO=<id>` gera um site com **um aplicativo só**: as rotas dos outros não entram, e a raiz
leva direto a ele. Cada um vai num canal próprio do Firebase Hosting (site `nads-nilma`), que expira em 7 dias:

```bash
# na pasta apps/web, para cada <id> em concilia-ai, conciliadorzinho, cheque-especial, creditor
VITE_APLICATIVO=<id> npx vite build --mode exemplos
npx firebase hosting:channel:deploy <id> --expires 7d --project conferencia-nilma
```

Sem `VITE_APLICATIVO`, o site tem os quatro. As prévias usam `--mode exemplos`: dados de exemplo, sem banco.

Histórico: em 2026-09-28 as ferramentas chegaram a ficar dentro da Conferência (primeiro "Conciliei",
com uma caixa estilo GitHub Insights, depois "Concilia aí" com tudo na barra lateral). A caixa
(`<Casca lateral="caixa">`) continua guardada no `packages/ui`.
