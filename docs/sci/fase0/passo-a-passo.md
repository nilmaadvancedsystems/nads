# Fase 0: o teste no SCI, passo a passo

Arquivo: `sci_teste_fase0.xlsx` (nesta pasta). Os dados são fictícios. Faça tudo **na empresa de teste** do SCI.

## Como o arquivo chega no PC do SCI

O SCI roda em outro PC, então:
- **Agora, no teste**: pelo Google Drive. A planilha vai para uma pasta do Drive, e no PC do SCI você abre pelo Drive
  (navegador ou Google Drive para computador) e salva no PC.
- **Depois, no dia a dia**: abra o **nads no navegador do PC do SCI**. A Ferramenta "nads → SCI" baixa a planilha ali
  mesmo e recebe ali mesmo as planilhas que o SCI exportar. Nada passa de um PC para o outro.

## 1. Preparar a planilha (2 minutos)

Na aba **Importar**, troque tudo o que começa com `TROCAR_` pelos dados da empresa de teste. A aba **Leia-me** explica
cada um:
- o CNPJ da empresa de teste;
- o **código curto** de uma despesa, do banco e de fornecedores (a conta de participante);
- a **classificação** do banco e de uma receita financeira (para testar se o SCI aceita a classificação no lugar do
  código);
- um código de histórico que exista;
- o CNPJ de um fornecedor já cadastrado como participante.

Não mexa na linha 1 (títulos) nem na última (Total).

## 2. Cadastrar o gerador (uma vez só)

*Integrações › Gerador de importações › Lançamentos contábeis a partir de planilha eletrônica* (FAQ 3202):
1. Código: em branco. Modelo: `nads`.
2. Linha inicial: `2`. Total de linhas a descartar no final do arquivo: `1`.
3. Arquivo: a planilha de teste. Aparecem as 10 primeiras linhas.
4. Clique em cada coluna e escolha o campo (o nome no SCI pode ser um pouco diferente):

| Coluna | Campo no gerador |
|---|---|
| A Data | Data |
| B Débito | Conta débito |
| C Crédito | Conta crédito |
| D Valor | Valor |
| E Histórico | Histórico |
| F Complemento | Complemento |
| G Documento | Documento |
| H Lote | Lote |
| I CNPJ empresa | CNPJ da filial |
| J Participante D | Participante débito |
| K Participante C | Participante crédito |
| L a O | **nenhum** (deixe sem campo) |

5. Salve.

## 3. Importar

*Integrações › Importações › Lançamentos contábeis via planilha* (FAQ 3203):
1. Datas: 01/11/2026 a 30/11/2026. Gerador: `nads`. Plano de troca: em branco.
2. Marque **"Gerar nova planilha com os lançamentos não importados"** (FAQ 5460).
3. Arquivo: a planilha de teste. Confirme.
4. Na grade, veja as 3 linhas e as mensagens. Depois **F12** (Importar dados).

## 4. Anotar e me mandar

- [ ] Ficou alguma linha fora? Qual mensagem? (um print da tela de inconsistências ajuda)
- [ ] A linha 3 (contas pela **classificação**) entrou?
- [ ] O SCI reclamou das colunas L a O sem campo, ou da linha Total?
- [ ] O acento do complemento da linha 1 (`ÇÃÉ`) apareceu certo?
- [ ] A linha 2 entrou com o participante?
- [ ] Se gerou a `naoimportados_...xlsx`, mande ela também.

## 5. Desfazer

Na consulta de lançamentos da empresa de teste: filtre pelo lote `NADS2611` e use **"Excluir todos os registros
filtrados"** (FAQ 6297). Isso também testa o jeito de refazer um mês.

## 6. Exportar (para a lógica do SCI)

Do SCI, em planilha (Excel ou CSV), da empresa de teste ou de uma empresa que já esteja no SCI:
- plano de contas, plano de históricos, plano de centro de custo e plano de troca;
- a configuração de contabilização (*Configura contas*);
- participantes;
- balancete (com a opção "Exportar CSV com cabeçalho", FAQ 5378) e razão (CSV sem quebra de página, FAQ 5743).

Esses arquivos têm dados de clientes: ficam no Drive, **nunca no repositório**.
