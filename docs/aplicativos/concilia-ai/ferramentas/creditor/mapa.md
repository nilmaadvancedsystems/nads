# Creditor: relatório de liquidação do banco × sistema → arquivo de importação

Pedido do Vitor (2026-09-28): transformar o prompt "Conciliação Bancária (Relatório de Liquidação x
Sistema Contábil)" numa ferramenta do Concilia aí, com telas para testar. Não existe HTML antigo. A
fonte das regras é o próprio prompt, e cada seção dele virou uma regra com teste em
`packages/core/src/creditor/`.

## Etapas (abas do cabeçalho, /<empresa>/creditor/<etapa>)

| Etapa | O que faz | Libera a próxima quando |
|---|---|---|
| 1. Relatório do banco (`banco`) | Lê um PDF com texto (pdf.js no navegador), .xls/.xlsx/.csv ou texto colado. "Digitar os títulos" é para quando só tem foto. "Testar com o exemplo" carrega o exemplo | há pelo menos 1 título |
| 2. Conferência (`conferencia`) | Cada grupo contra o "Total de Valores do grupo" impresso, coluna a coluna, e o total geral. Linha em vermelho: cobrado ≠ valor + mora − desconto. Tudo é editável (títulos, totais impressos, grupos) | todos os grupos batem centavo a centavo, e o total geral também (quando vier) |
| 3. Sistema (`sistema`) | Lê o arquivo do sistema: Contrapartida, Valor e NF (ou "NF 1234" no histórico) | arquivo lido |
| 4. Cruzamento (`cruzamento`) | Procura cada NF no sistema e mostra a situação: Ok, Duplicatas juntas, Valor diverge, Cliente diverge ou NF não encontrada | nenhuma divergência sem decisão |
| 5. Lançamentos (`lancamentos`) | Contas/históricos (padrões do prompt, editáveis), a conta banco por dia e a prévia do arquivo. Baixa o .xls | todo dia bate, ou a diferença do dia é exatamente o que foi excluído |

## Regras (seção do prompt → código)

| Prompt | Onde |
|---|---|
| §1 chave NF + cliente | `regras/cruzamento.ts`: `chaveNf` (1º bloco de dígitos, sem zeros à esquerda) e `mesmoCliente` (nome cortado pelo banco vale) |
| §1 data = liquidação do banco | `gerarLancamentos` usa `titulo.liquidacao` |
| §1 parcelas com centavo diferente / duplicatas juntas | `cruzar` marca "dividido" quando o valor do sistema é a soma das parcelas do banco ou k × a parcela. Cada parcela sai com o próprio valor e a própria data |
| §2 A/B/C, 8 colunas | `regras/lancamentos.ts`: `gerarLancamentos`, `historicoSemPrefixo`, `historicoNfCliente`. O principal é sempre cheio |
| §3.2 conferir grupo × total impresso | `regras/conferencia.ts`: `conferirGrupo`, `conferirTotalGeral`, `relatorioConferido` |
| §3.3 divergência → perguntar | `precisaDecisao` e `Decisao` (confirmar, manual ou excluir). Só a das duplicatas juntas é automática, porque o próprio prompt manda |
| §3.4 ignorar "Baixa - Pedido Cedente" | `arquivos/banco.ts`: a seção inteira fica de fora e é contada |
| §3.6 conta banco por dia | `fecharPorDia`: o esperado é o total cobrado impresso quando o grupo é só daquele dia; senão, a soma conferida |
| §4 .xls BIFF, VALOR/DOCUMENTO numéricos | `arquivos/gerar.ts` (a data vai como data do Excel, DD/MM/AAAA) |

## O que foi suposto (confirmar com o Vitor)

- **Layout do relatório do banco:** não vi um real. O leitor de texto/PDF acha a linha de cabeçalho
  (Sacado, Nosso Número, Seu Número, Vencimento, Valor (R$), Vlr. Mora, Vlr. Desc., Dt. Liquidação,
  Vlr. Cobrado) e usa a ordem dela. Sem cabeçalho, adivinha e avisa.
- **Layout do arquivo do sistema:** colunas achadas pelo nome (Documento/NF, Cliente, Contrapartida,
  Histórico, Valor).
- **Arquivo final:** leva uma linha de cabeçalho com os nomes das 8 colunas. Se a importação do Alterdata
  não quiser cabeçalho (ou quiser linhas em branco, como o do Cheque especial), é uma linha em `gerar.ts`.
- **Foto:** não é lida (precisaria de OCR). O caminho é digitar na conferência, onde o total impresso
  segura o erro.

## Exemplo embutido (`exemplos.ts`)

Relatório de 3 dias com um dígito lido errado (CANTINA 980,00 × 930,00 → o grupo de 02/09 não bate por
50,00), NF 4548 em duas parcelas lançadas juntas no sistema, NF 4555 com valor diferente, NF 4560 fora
do sistema e uma seção de baixa. Passo a passo esperado: corrigir 980 → 930, "Usar valor do banco" na
4555, informar a contrapartida da 4560 (ou excluir), e os três dias fecham.
