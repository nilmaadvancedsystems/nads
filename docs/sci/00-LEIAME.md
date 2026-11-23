# SCI x nads: leia isto primeiro

Escrito em 23/11/2026. Esta pasta (`docs/sci/`) analisa o **SCI**, o sistema contábil novo do escritório (linha **Novo
Visual / Único**), e propõe como o nads pode mandar tudo pronto para ele. O objetivo é que o Contábil **não precise
"usar" o SCI**:

> **nads → balancete no SCI.** No SCI, a pessoa só exclui o que for preciso e confere.

Nada do plano foi implementado ainda. O que não está nas fontes está marcado como **"a confirmar"**.

## De onde veio

- **FAQ do SCI**: Área do Cliente SCI → *faq sci* → *NOVO VISUAL*, lido com o login do escritório em 23/11/2026. O SCI
  avisa que o Novo Visual e o Único funcionam igual, então onde o FAQ diz "Único" vale para o Novo Visual. Foram
  levantados **5.493 artigos** (Contábil 981, Fiscal 2.176, Folha 2.408, Geral 525, Financeiro 282 e os módulos
  menores) e lidos por inteiro os ~70 que tratam de importação, integração e fechamento. Cada artigo é citado pelo
  número, como **FAQ 6621**. Para abrir: Área do Cliente → faq sci → digite o número no campo *Código*.
- **Manuais de layout** (PDFs públicos que o FAQ indica, em `www.s1991.com.br/arquivo/manuais/...`): o leiaute TXT de
  lançamentos do Único Contábil, a importação de bens do patrimônio, os anexos 31 (duplicatas), 32/34/35 (os
  antigos, da Linha Visual), 04/09 (saídas e entradas) e 67 (centro de custo), e o manual de integração com ERP.
- **Portal do Desenvolvedor da SCI** (`portal-dev.sci.com.br`, público): a documentação OpenAPI das 7 APIs.
- **Código do nads** na `origin/desenvolvimento` de 23/11/2026 (commit `5322eeee`).

Nada foi criado, alterado ou excluído no SCI. Não há dados de clientes nesta pasta: todos os exemplos são fictícios.

## Os arquivos

| Ordem | Arquivo | O que tem |
|---|---|---|
| 1 | `00-LEIAME.md` (este) | Resumo e os achados principais |
| 2 | `01-fluxo-do-sci.md` | Como o SCI funciona, passo a passo: implantação e mês a mês |
| 3 | `02-importacoes-e-layouts.md` | Cada importação, com o layout exato e um exemplo fictício |
| 4 | `03-funcoes-do-sci.md` | O FAQ inteiro de cabo a rabo: cada função do SCI, útil ou inútil para o nads |
| 5 | `04-nads-x-sci.md` | O que o nads já tem e o que falta para gerar cada arquivo |
| 6 | `05-plano-em-fases.md` | A proposta em fases e as perguntas que só o dono responde |

## As regras do dono (23/11/2026)

- No SCI **só entram importações**: nada é lançado e nenhuma tarefa é feita lá.
- O tratamento lá é **só pelo balancete**: abrir a conta, excluir ou alterar o que o nads importou errado.
- **Planilha** para importar e exportar, e o SBS é pago à parte (não há).
- **Exportar todos os planos do SCI** para ensinar a lógica do sistema.
- O intermediário nads ↔ SCI **não usa banco**: arquivo entra, arquivo sai.

Detalhes e o que mudou no plano: `05-plano-em-fases.md`, primeira seção.

## Os 8 achados que mudam o plano

1. **Existe API para mandar lançamentos ao SCI.** É a API do **SBS (Smart Bank Statement)**:
   `POST https://api-sbs.sci.com.br/api/v1/lancamentos-contabeis`. Ela recebe o **mesmo TXT** do leiaute de importação
   do Único Contábil, por empresa e período. No SCI, o arquivo aparece em *Integrações › Importações › Lançamentos
   contábeis via SBS* (FAQ 5045). Essa tela pode ser importada sozinha pelo agendador do SCI, o **SChIp** (FAQ 3475).
   Com isso o fluxo pode ser **nads → API → SCI**, sem ninguém salvar ou abrir arquivo. Para usar, o nads precisa de
   dois tokens: o de *parceiro integrador*, que a SCI emite, e o *de cliente*, que o escritório gera no SCI WEB.
   **Mas o SBS é pago à parte** (o dono confirmou em 23/11/2026; o escritório não tem). Sem ele, o caminho de graça usa o
   **mesmo conteúdo em planilha** (item 2), importado em *Lançamentos contábeis via planilha* (FAQ 3203): um
   arquivo por empresa e mês, poucos cliques. Para ninguém clicar, há duas saídas:
   - um **robô do nads** que opera o SCI no servidor do escritório, como o `alterdata_importar.py` já faz no Alterdata;
   - contratar o SBS depois.
   As linhas são as mesmas nos dois casos (só muda o formato), então nada do que for feito se perde.
2. **Uma planilha só serve para quase tudo** (decisão do dono, 23/11/2026: **planilha, não TXT**, porque é melhor para
   analisar). O SCI importa lançamentos de planilha .xlsx em *Integrações › Importações › Lançamentos contábeis via
   planilha*. Antes disso, alguém cadastra **uma vez** um *gerador* que diz qual coluna é qual (FAQ 3202, 3203). A
   planilha aceita tudo o que o TXT aceita:
   - conta, valor, histórico e complemento;
   - documento, lote e o CNPJ da empresa ou filial (FAQ 6766);
   - participante, centro de custo e os dados do LCDPR (FAQ 4893);
   - juros, multa e desconto (FAQ 7878).
   O que falhar volta numa planilha `naoimportados_` (FAQ 5460). Hoje o nads já junta Creditor, Lançatudo, Cartões,
   Honorários, INSS, FGTS, pró-labore, adiantamento e Conciliadorzinho num formato comum (`LinhaDeImportacao`). **Uma
   "planilha SCI" cobre todos de uma vez.** O TXT (doc 02, A) fica de reserva para a API do SBS.
3. **As contas do SCI são outras.** O SCI tem código curto, apelido e classificação, e um *plano de contas* que é
   compartilhado pelas empresas do mesmo *plano de contabilização*. Os códigos do Alterdata não valem lá. Há dois
   caminhos: o nads guarda o de/para (código Alterdata → código SCI), ou o SCI traduz na importação com o **plano de
   troca** (FAQ 6725).
4. **Saldo inicial sem digitar.** O SCI importa os saldos (registro I155) e até os lançamentos (I200) de um **arquivo da
   ECD** (FAQ 42865, 42866 e 42837). A ECD que o Alterdata gera serve como ponte de migração.
5. **Notas fiscais não precisam de TXT.** O Fiscal do SCI importa os XML de NF-e, NFC-e, CT-e e NFS-e (FAQ 3567). Também
   importa por uma pasta monitorada (*automação por pasta*, FAQ 6826) e pela API do **Integra NET**, que aceita o
   envio de XML. Depois o próprio SCI contabiliza as notas no Contábil pelo plano de contabilização. O nads só precisa
   entregar os XML que já baixa do SIEG.
6. **A participação do contador no SCI vira conferência.** O SCI já tem as peças certas para isso: o **Auditor
   contábil** (FAQ 6815), a **Central de conciliação** (FAQ 4907), o **bloqueio de lançamentos** (FAQ 6908) e a
   **exclusão de todos os lançamentos filtrados**, empresa por empresa (FAQ 6297).
7. **O nads pode ler o balancete de volta.** Há três jeitos: exportar o balancete em CSV no SCI (FAQ 5378), usar o
   **BI Connection**, com SQL de balancete pronto (FAQ 6657, módulo vendido à parte), ou usar a API do **SCI Report
   24h**, se o balancete for publicado. Assim a Conferência do nads continua valendo com o SCI.
8. **O MCP da SCI** (`mcp.sci.com.br/mcp`) só fala com o SCI Report e o Atendimento. Ele **não lança nada** e não
   serve para este fluxo.

## Regras para quem for implementar

- Regras de negócio em `packages/core`, com testes (vitest). Telas no MVVM; Firebase só em `dados/*.firestore.ts`.
- Os tokens da SCI são segredos: nunca no repositório nem no banco aberto. Use o mesmo cofre dos outros robôs (metadado
  da VM) e chame a API **pelo robô**, nunca pelo navegador.
- Cada fase só está pronta quando: a regra está no core com testes, o arquivo gerado foi validado contra o layout (e
  importado de verdade numa empresa de teste no SCI, pelo usuário) e `npm run verificar` passa.
- Commit, push e publicação só com autorização.
