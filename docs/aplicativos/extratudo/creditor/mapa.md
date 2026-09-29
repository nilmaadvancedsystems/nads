# Creditor: relatório de liquidação do banco × sistema → arquivo de importação

Pedido do Vitor (2026-09-28): transformar o prompt "Conciliação Bancária (Relatório de Liquidação x
Sistema Contábil)" num aplicativo com telas para testar. Desde 2026-09-29 é um aplicativo isolado (`/creditor`). Não existe HTML antigo. A
fonte das regras é o próprio prompt, e cada seção dele virou uma regra com teste em
`packages/core/src/creditor/`.

## Etapas (barra lateral, /creditor/<empresa>/<etapa>)

| Etapa | O que faz | Libera a próxima quando |
|---|---|---|
| 1. Relatório do banco (`banco`) | Lê o PDF do banco (pdf.js no navegador) ou .xls/.xlsx/.csv. "Testar com o exemplo" carrega o exemplo | há pelo menos 1 título |
| 2. Conferência (`conferencia`) | Cada grupo contra o "Total de Valores do grupo" impresso, coluna a coluna, e o total geral. Linha em vermelho: cobrado ≠ valor + mora − desconto. Tudo é editável (títulos, totais impressos, grupos) | todos os grupos batem centavo a centavo, e o total geral também (quando vier) |
| | **Só aparece quando o relatório traz algum total impresso** (de grupo ou geral, valor ou quantidade: `temTotalImpresso`). Sem nenhum, a etapa sai das abas, o Relatório do banco vai direto para o Fiscal e o topo mostra "Etapa n de 5" (pedido do Vitor, 2026-09-29) | |
| 3. Fiscal (`fiscal`) | Passo a passo, marcado pela pessoa: (1) no Fiscal, baixar os clientes no Gerenciador de Duplicatas; (2) exportar para o Contábil; (3) no Contábil, exportar a planilha dos recebimentos. Mostra os títulos a baixar (NF, sacado, liquidação, valor, mora, desconto, cobrado). Pedido do Vitor, 2026-09-29 | os três passos marcados |
| 4. Sistema (`sistema`) | Lê o arquivo do sistema: Contrapartida, Valor e NF (ou "NF 1234" no histórico) | arquivo lido |
| 5. Cruzamento (`cruzamento`) | Procura cada NF no sistema e mostra a situação: Ok, Duplicatas juntas, Valor diverge, Cliente diverge ou NF não encontrada | nenhuma divergência sem decisão |
| 6. Lançamentos (`lancamentos`) | Contas/históricos (padrões do prompt, editáveis), a conta banco por dia e a prévia do arquivo. Baixa o .xls | todo dia bate, ou a diferença do dia é exatamente o que foi excluído |

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

## Relatório real: Sicoob "Relatório - Títulos por Período" (2026-09-29)

Lido a partir do `SICOOB 08-2026.pdf` da empresa 292 (o arquivo não entra no repositório):

- **A página é girada, e cada coluna é um bloco de texto.** Não dá para ler linha a linha: a leitura é
  por posição (`relatorioDosItens` em `arquivos/banco.ts`). O cabeçalho diz onde fica cada coluna, e
  cada "Seu Número" é uma linha. O nome do sacado em duas linhas é juntado.
- **Colunas:** Sacado, Nosso Número (`10542-4`), Seu Número (`9848/2/3` = NF 9848, parcela 2 de 3),
  Dt. Previsão Crédito, Vencimento, Dt. Limite Pgto, Valor (R$), Vlr. Mora, Vlr. Desc., Vlr. Outros
  Acresc., Dt. Liquid., Vlr. Cobrado. O prompt chamava de "Vlr. Desc. Acresc." o que são duas colunas.
- **Grupos por tipo de liquidação:** 58-VIA COMPENSAÇÃO, 68-DÉBITO EM CONTA, 82-BAIXA PEDIDO CEDENTE
  (fica de fora) e 215-INTERCREDIS. Cada grupo imprime **um total (do Vlr. Cobrado) e a quantidade de
  registros**; o fim traz os Totais de Valores e de Registros Liquidados.
- **Resultado:** 193 títulos em 3 grupos. Os totais e as quantidades batem centavo a centavo com o PDF
  (414.348,84 = 193 registros), e as 2 baixas ficam de fora.
- **Vlr. Outros Acresc.:** entra no lançamento B, junto com a mora. No PDF de agosto é sempre 0,00.
- Os grupos não são por dia. Por isso, no fechamento por dia, vale a soma conferida dos títulos.

## Contas pelo balancete (2026-09-29)

Pedido do Vitor: cada empresa já vem com as contas configuradas pelo balancete do banco, e quando o
balancete é atualizado as contas acompanham. Escolhas dele: **sugere e guarda** e **históricos salvos
por empresa**.

- **De onde vem o balancete:** o documento da Conferência `empresas/{slug}`, **só leitura**, ouvido ao
  vivo (`onSnapshot`). Usa `contas`; se o balancete foi apagado ao sair da Conferência ("Apagar ao
  sair"), usa o plano que fica guardado (`balanceteAssinatura`: código → nome). Sem nenhum dos dois,
  valem os padrões do prompt (`CONTAS_PADRAO`). `regras/balancete.ts`: `balanceteDoDocumento`.
- **Sugestão pelo nome** (`sugerirConta`), sem conta sintética:
  banco = "SICOOB" no Ativo (fora aplicação, capital, empréstimo…); juros = "JUROS RECEBIDOS/ATIVOS…"
  na Receita (fora juros pagos/passivos); descontos = "DESCONTOS CONCEDIDOS" na Despesa (fora descontos
  obtidos). Sem o grupo (só o plano), vale só o nome.
- **O que fica salvo:** `extrator/{slug}/creditor/contas` = `{ contas, nomes, atualizadoEm }`. Trocar um
  campo na etapa Lançamentos grava (ao sair do campo); **baixar o .xls confirma** as sugeridas e o nome
  atual de cada conta. "Voltar às sugestões" apaga o que foi salvo.
- **Balancete atualizado** (`resolverContas`): a conta salva continua valendo e o nome acompanha. Se ela
  **mudou de nome**, aparece um aviso (some quando o arquivo é baixado); se **sumiu do balancete**, o
  .xls fica travado até escolher outra. Conta sem sugestão também trava ("Falta escolher").
- Código: `packages/core/src/extratudo/creditor/{regras/balancete.ts,repo.ts,repo.memoria.ts}`,
  `apps/web/src/aplicativos/extratudo/dados/creditor.firestore.ts` e `ferramentas/creditor/dados/`.
  No modo exemplos: 901 com balancete completo, 902 só com o plano (sem conta de descontos), 903 sem nada.
