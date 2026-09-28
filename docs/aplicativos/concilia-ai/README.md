# Concilia aí: a Conferência e as ferramentas de conciliação num app só

Pedido do Vitor (2026-09-28): juntar a Conferência Contábil e o Conciliei (Conciliadorzinho + Cheque
especial) num **aplicativo só**, chamado **Concilia aí**. A pessoa só escolhe a empresa, e tudo fica
dentro dela.

## A tela

| Onde | O que mostra |
|---|---|
| Entrada (`/`) | "Entrar no Concilia aí": a busca por nome ou código do ERP. Não tem mais a tela de escolher aplicativo |
| Cabeçalho, trilha | `Concilia aí / <código> <nome da empresa>` |
| Barra lateral | Importação, Cadastro │ Movimento │ Auditoria │ **Conciliadorzinho, Cheque especial** |
| Cabeçalho, abas | as páginas da seção aberta. No Conciliadorzinho são as etapas, travadas até serem alcançadas |
| Gaveta ☰ | Início (volta à escolha de empresa), tema e versão |

As ferramentas nunca travam: não dependem das importações da Conferência.

A caixa estilo "Insights" do GitHub (`<Casca lateral="caixa">`) continua no `packages/ui`, **guardada
para outro uso**. O Concilia aí usa a barra lateral normal.

## Rotas

| Tela | Rota |
|---|---|
| Empresa | `/` |
| Conferência | `/292/movimento/relatorio`, `/292/importacao/balancete`, … |
| Conciliadorzinho | `/292/conciliadorzinho/<etapa>` (bandeiras, extrato-cielo, notas, contas, totais, arquivos) |
| Cheque especial | `/292/cheque-especial/saldo-negativo` |

Links antigos que redirecionam:

| Antes | Agora |
|---|---|
| `/conferencia/292/movimento/relatorio` | `/292/movimento/relatorio` |
| `/conciliei/292/conciliadorzinho/conciliacao/notas` | `/292/conciliadorzinho/notas` |
| `/conciliadorzinho/292/conciliacao/notas` | `/292/conciliadorzinho/notas` |
| `/cheque-especial/292/ajuste/saldo-negativo` | `/292/cheque-especial/saldo-negativo` |

## Dados

- **Conferência:** continua ligada ao mesmo Firestore da conferencia-nilma.web.app, sem mudança.
  Entrar na empresa grava a primeira abertura, como antes, qualquer que seja a seção que a pessoa vai usar.
- **Ferramentas:** não guardam nada. Recebem arquivos e devolvem no máximo um arquivo. Sair da
  seção da ferramenta ou trocar de empresa começa do zero.
- A lista de empresas é a da Conferência: as do escritório mais as que existem no banco.

## Onde fica no código

```
apps/web/src/aplicativos/concilia-ai/
  rotas.tsx, AppConciliaAi.tsx
  dados/                         repositório da Conferência (banco ou exemplos)
  casca/
    navegacao.ts                 SECOES (Conferência) + FERRAMENTAS
    EmpresaAberta.tsx            resolve a empresa e escolhe: tela da Conferência ou ferramenta
    useCascaConciliaAi.ts        ViewModel da casca (barra lateral, travas, sair)
    CascaConciliaAi.tsx          View; a ferramenta passa abas/título/ações pela prop `ferramenta`
  telas/<tela>/                  telas da Conferência
  ferramentas/
    conciliadorzinho/            casca/ (sessão, etapas) e telas/
    cheque-especial/             casca/ (páginas) e telas/
```

Mapas e inventários: `conferencia/`, `ferramentas/conciliadorzinho/`, `ferramentas/cheque-especial/`.

## Ferramenta nova

1. Regras em `packages/core/src/<ferramenta>/`, com teste.
2. Pasta `ferramentas/<ferramenta>/` com `casca/` (a `Ferramenta.tsx`, as páginas e uma `Casca.tsx`
   que usa `<CascaConciliaAi ferramenta={…}>`) e `telas/`.
3. Uma linha em `FERRAMENTAS` (`casca/navegacao.ts`) e a entrada em `casca/EmpresaAberta.tsx`.
