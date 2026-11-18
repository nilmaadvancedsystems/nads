# Prazos a conferir pelo Fiscal e pelo DP

Escrito em 17/11/2026 (ficha E02 do plano do Acessórias). A tabela abaixo é a de `packages/core/src/tarefas/regras/prazos.ts`,
a tabela única de prazos das etapas. Enquanto uma linha não for conferida, a lista de prazos do mês (E04) mostra "prazo
a confirmar" nela.

Como ler:
- **Dia:** do mês seguinte à competência.
- **Ajuste:** o que fazer quando o dia cai em fim de semana ou feriado. "Antecipa" anda para trás; "posterga", para frente.
- **Feriados:** quais contam. "Nacionais" para tributo federal; "+ MG" para o ICMS (a lista de MG está vazia, a
  confirmar); "+ Taiobeiras" para o ISS.
- **Interno:** em todas as linhas, 3 dias úteis antes do prazo legal. É quando o escritório começa a cobrar o
  responsável. Cada setor diz se quer outro número.
- **Multa:** se o atraso gera multa ao cliente. Nenhuma fonte disse: **toda linha está "a confirmar"**.

## DP

| Etapa | Dia | Ajuste | Feriados | Multa | O que falta conferir |
|---|---|---|---|---|---|
| Recibos de pagamento | 5º dia útil (sábado conta) | antecipa | nacionais | não | a multa |
| Folha de pagamento | 5º dia útil (sábado conta) | antecipa | nacionais | não | a multa |
| S-1200 | 15 | antecipa | nacionais | sim | a multa |
| S-1210 | 15 | antecipa | nacionais | sim | a multa |
| S-1299 | 15 | antecipa | nacionais | sim | a multa |
| EFD-REINF | 15 | antecipa | nacionais | sim | a multa |
| DCTFWeb | 20 | antecipa | nacionais | sim | a multa; **o dia**: o DP usa o 20 (o do DARF dela), mas a transmissão tem prazo próprio na IN RFB 2.005/2021. A agenda do cliente continua mostrando o 15 (decisão do dono, 17/11/2026) |
| DARF (INSS e IRRF) | 20 | antecipa | nacionais | sim | a multa |
| FGTS Digital | 20 | antecipa | nacionais | sim | a multa |
| eConsignado | 20 | antecipa | nacionais | não | a multa |

A entrega ao cliente não tem linha: o prazo dela é o da guia mais cedo do cliente, como já era.

## Fiscal

| Etapa | Dia | Ajuste | Feriados | Multa | O que falta conferir |
|---|---|---|---|---|---|
| Simples Nacional (DAS) | 20 | posterga (decisão do dono, 17/11/2026) | nacionais | sim | a multa |
| DAS-MEI | 20 | posterga | nacionais | sim | a multa; o DAS-MEI não estava na lista do Vitor |
| ICMS | 9 | posterga | nacionais + MG | não | a multa; **o dia e o ajuste** dependem da atividade e do regime em MG |
| ISS | 10 | posterga | nacionais + Taiobeiras | não | a multa; **o dia e o ajuste** variam por município |
| PIS/COFINS cumulativo | 25 | antecipa | nacionais | não | a multa |
| PIS/COFINS não cumulativo | 25 | antecipa | nacionais | não | a multa |
| IRPJ/CSLL trimestral | último dia útil | antecipa | nacionais | não | a multa |
| IRPJ/CSLL por estimativa | último dia útil | antecipa | nacionais | não | a multa |

Etapas do Fiscal **sem prazo** na tabela, porque nenhuma fonte deu o dia: EFD ICMS/IPI, EFD-Contribuições, EFD-REINF e
DCTFWeb do Fiscal, Declaração municipal, ICMS das entradas, Certidões e as anuais (DEFIS, DASN-SIMEI, ECD, ECF). Se o
Fiscal quiser essas no controle de prazos, diga o dia de cada uma.

## Contábil

Sem nenhuma linha: as fontes não dão prazo legal mensal ao Contábil. Há algum prazo interno (por exemplo, fechar até o
dia X para o Fiscal)?
