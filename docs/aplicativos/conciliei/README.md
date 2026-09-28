# Conciliei: as ferramentas de conciliação num aplicativo só

Pedido do Vitor (2026-09-28): um aplicativo chamado **Conciliei** que junta as ferramentas de
conciliação do escritório. **Não guarda nada**: cada ferramenta recebe arquivos e devolve no máximo um
resultado (um arquivo para baixar). O Conciliei começa unificando as duas que já estavam no nads, o
**Conciliadorzinho** e o **Cheque especial**. Depois entram outras, como a "CRED. LIQUI".

## A tela

No lugar da barra lateral, o Conciliei usa uma **caixa** à esquerda, no estilo da página "Insights" do
GitHub (print do Vitor): uma lista com borda, e o item aberto ganha uma faixa vermelha à esquerda.

| Onde | O que mostra |
|---|---|
| Cabeçalho, trilha | `Conciliei / <código> <nome da empresa>` |
| Cabeçalho, abas | as páginas da ferramenta aberta: no Conciliadorzinho, as etapas (travadas até serem alcançadas); no Cheque especial, "Saldo negativo" |
| Caixa à esquerda | as ferramentas: Conciliadorzinho, Cheque especial |
| Direita | título da página com as ações no canto (Cancelar, Baixar…), e a página |

No celular, a caixa vira uma linha que rola para o lado, acima da página.

A caixa é do `packages/ui`: `<Casca lateral="caixa">`. Qualquer aplicativo pode usar esse formato.

## Rotas

| Tela | Rota |
|---|---|
| Empresa | `/conciliei` |
| Ferramenta aberta | `/conciliei/<código>/<ferramenta>/<seção>/<página>` |
| Conciliadorzinho | `/conciliei/292/conciliadorzinho/conciliacao/bandeiras` |
| Cheque especial | `/conciliei/292/cheque-especial/ajuste/saldo-negativo` |

Ao entrar numa empresa, abre a primeira ferramenta da caixa. Os links de quando eram aplicativos separados
continuam funcionando: `/conciliadorzinho/292/…` e `/cheque-especial/292/…` redirecionam para a mesma
página dentro do Conciliei.

Trocar de empresa ou de ferramenta começa do zero, porque nada é guardado. Se o Conciliadorzinho estiver no
meio de uma conciliação, clicar em "Cheque especial" descarta os arquivos dele.

## Onde fica no código

```
apps/web/src/aplicativos/conciliei/
  rotas.tsx                    /conciliei/… e os redirecionamentos dos links antigos
  casca/
    ferramentas.ts             a lista da caixa (ferramenta nova = uma linha aqui)
    caminho.ts                 caminho() e caminhoDaFerramenta()
    EmpresaAberta.tsx          resolve a empresa e abre a ferramenta
    useCascaConciliei.ts       ViewModel: caixa, empresa, sair, gaveta ☰
    CascaConciliei.tsx         View: <Casca lateral="caixa">
  telas/entrada/               escolher a empresa
  ferramentas/
    conciliadorzinho/          casca/ (sessão, etapas, abas) e telas/, como antes
    cheque-especial/           casca/ (páginas, abas) e telas/, como antes
packages/core/src/conciliadorzinho, packages/core/src/cheque-especial   as regras, sem mudança
docs/aplicativos/conciliei/ferramentas/<ferramenta>/   inventário e mapa de cada uma
```

## Ferramenta nova

1. Regras em `packages/core/src/<ferramenta>/`, com teste.
2. Pasta `ferramentas/<ferramenta>/` com `casca/` (a `Ferramenta.tsx`, as páginas e uma
   `Casca.tsx` que usa `<CascaConciliei>`) e `telas/`.
3. Uma linha em `casca/ferramentas.ts` e a entrada em `casca/EmpresaAberta.tsx`.

## Perguntas ao Vitor

1. **Guardar o que está em andamento ao trocar de ferramenta?** Hoje, trocar de ferramenta descarta tudo,
   como fechar a página no original. Dá para manter cada ferramenta viva enquanto a empresa estiver aberta,
   sem gravar nada.
2. **CRED. LIQUI**: preciso do arquivo ou HTML de hoje, ou do passo a passo, para saber o que entra e o que
   sai.
