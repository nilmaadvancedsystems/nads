# Extrator → nads

Pedido do Vitor (2026-09-29): uma ferramenta para **bater o extrato bancário com o sistema**. Na
Importação, sobe os PDFs do extrato (ou puxa do Drive da empresa) e, na mesma aba, o razão da conta
do banco exportado do sistema contábil. O Extrator **não guarda os arquivos**: lê data, histórico e
valor de cada lançamento e guarda só isso. Depois compara os dois lados e mostra o que está
**faltando**, o que está **diferente**, o que está **a mais** e o que está **duplicado**.

Não veio de um HTML antigo: nasceu como protótipo (página única no claude.ai) e foi reescrito aqui
em MVVM, com a casca e os componentes do nads. Não usa internet nem banco (ver decisões pendentes).

## Telas

| Seção › página | Rota (`/extrator/<código>/…`) | ViewModel | View |
|---|---|---|---|
| Entrada | `/extrator` | `telas/entrada/useEntrada.ts` | `Entrada.tsx` (`<EscolherEmpresa>`) |
| Importação › Arquivos | `importacao/arquivos` | `telas/importacao/useImportacao.ts` | `Importacao.tsx` + `partes/CaixaImportacao.tsx`, `partes/ArquivosImportados.tsx` |
| Importação › Lançamentos | `importacao/lancamentos` | `telas/lancamentos/useLancamentos.ts` | `Lancamentos.tsx` |
| Conferência › Extrato × sistema | `conferencia/resultado` | `telas/conferencia/useConferencia.ts` | `Conferencia.tsx` + `partes/TabelaConferencia.tsx` |
| Auditoria › Histórico | `auditoria/historico` | `telas/auditoria/useAuditoria.ts` | `Auditoria.tsx` |

- **Importação › Arquivos**: duas caixas lado a lado, *Extratos bancários* (PDF, OFX) e
  *Lançamentos contábeis* (Excel, CSV, PDF, OFX). Cada uma aceita vários arquivos de uma vez.
  Se já existe lançamento nas datas dos arquivos, pergunta como na Conferência: **Cancelar ·
  Sobrepor o movimento · Importar apenas novas**. O resultado aparece na mensagem flutuante
  (3,7 s, com ×). Embaixo, os arquivos importados com **Excluir** (com confirmação).
- **Conferência**: fica travada (cadeado na barra lateral, aviso com "Importar…") até ter extrato
  e sistema. Chips do mês (abre no último mês do extrato) e **Tudo**; "Aceitar data até N dias de
  diferença" (padrão 3). Os números por situação filtram a tabela; o seletor tem **Pendências**
  (padrão), Faltando, Diferentes, A mais, Duplicados, Conferidos e Tudo. **Baixar CSV** no topo.
- A empresa abre na Conferência quando já dá para conferir; senão, na Importação.

## Model (`packages/core/src/extrator`)

Datas em `aaaa-mm-dd` e valores em **centavos** (inteiros): positivo entrou no banco, negativo saiu.

| Arquivo | O que faz | Teste |
|---|---|---|
| `regras/texto.ts` | `centavos` (1.234,56 · D/C · parênteses), `lerData` (dd/mm, dd/mm/aa, "5 set", série do Excel), `parecido` (palavras em comum, sem os verbos do banco) | sim |
| `regras/extrato.ts` | PDF → lançamentos a partir do texto posicionado: junta linhas, acha as colunas Débito/Crédito/Saldo, ignora saldo/total, data que vale para as linhas seguintes, histórico em duas linhas, sinal pelo valor/coluna/histórico | sim |
| `regras/planilha.ts` | razão/extrato em planilha: cabeçalho por palavras (Data, Histórico, Valor, Débito/Crédito, D/C, Conta Débito/Crédito) ou adivinhado | sim |
| `regras/ofx.ts` | OFX (`<STMTTRN>`) | sim |
| `regras/conferencia.ts` | `conferir` (abaixo), `totais`, `csvConferencia` | sim |
| `regras/importacao.ts` | ações puras: `importar` (primeira / apenas novas / sobrepor), `excluirArquivo`, `jaTemNoPeriodo`, auditoria | sim |
| `arquivos/pdf.ts` | texto do PDF com pdf.js (build legacy; o worker vem do app) | sim, com PDF montado no teste |
| `arquivos/leitura.ts` | `lerArquivo(nome, bytes, lado)` escolhe PDF, OFX ou planilha | sim |
| `repo.ts`, `repo.memoria.ts`, `__exemplos__/` | repositório (neste navegador) e as empresas de exemplo 901–903 | sim |

### Como a conferência decide (`conferir`)
1. Se quase tudo do sistema bate só com o sinal trocado, o razão veio ao contrário: inverte (e avisa).
2. **Conferido**: mesma data e mesmo valor (entre vários, o histórico mais parecido).
3. **Duplicado**: sobra igual (data, valor, histórico parecido) a um já conferido do mesmo lado.
4. **Diferente**: mesmo valor com data até N dias; mesmo valor com sinal trocado; ou mesma data
   (±N) com histórico parecido e valor diferente.
5. Sobrou no extrato = **faltando no sistema**; sobrou no sistema = **a mais**.

## Decisões pendentes (do Vitor)
1. **Onde guardar os lançamentos.** Hoje ficam só no navegador de quem importou (localStorage),
   no site publicado e nos exemplos. Gravar no Firestore da Conferência (uma coleção nova, ex.
   `extrator/{empresa}`) é conexão nova com o banco: só ligo quando você liberar, e as regras do banco
   precisam permitir a coleção.
2. **Puxar do Drive da empresa.** Precisa de uma conexão com o Google Drive (login Google + API do
   Drive), que a trava `npm run conexoes` proíbe hoje. Se liberar, entra como `dados/drive.ts` e um
   botão "Puxar do Drive" na caixa dos extratos, com a pasta de cada empresa guardada.
3. **Tolerância padrão de 3 dias** na data e a regra de "histórico parecido" (metade das palavras;
   um terço no mesmo dia). Dá para ajustar quando aparecerem extratos reais.
