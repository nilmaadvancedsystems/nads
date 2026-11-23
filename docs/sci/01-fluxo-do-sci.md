# Como o SCI funciona: o fluxo passo a passo

Visão do **Único / Novo Visual**, a partir do FAQ (números entre parênteses) e dos manuais. A ideia aqui é entender o
SCI o suficiente para o nads fazer o trabalho e o SCI só guardar, conferir e entregar.

## 1. As peças e os nomes que o SCI usa

| Peça do SCI | O que é | Equivalente no nads / Alterdata |
|---|---|---|
| **Módulos** | Geral, Contábil, Fiscal, Folha, Financeiro, Tarefas, Protocolos, Notificações, Impostos, Temporizador, Orçamentos, Auditor Folha e BI Connection. Todos no mesmo banco de dados (Firebird, FAQ 7710) | Alterdata Contábil, Fiscal e DP. O nads faz Tarefas, Protocolos e Notificações |
| **Empresa** | Cadastro único usado por todos os módulos. Matriz e filiais são empresas ligadas (FAQ 6364) | `CadastroDaEmpresa` (nome = chave, `codigo` do Alterdata) |
| **Plano de contabilização** | A "configuração central" que liga cada empresa a um plano de contas, um plano de históricos e às contas usadas pelo Fiscal, pela Folha e pelo Patrimônio (FAQ 5051, 2279). Várias empresas podem usar o mesmo | Não existe; no Alterdata cada empresa tem o seu plano |
| **Plano de contas** | Cada conta tem **código curto**, **apelido**, **classificação** (ex.: 1.1.001), nome, tipo **A** (analítica) ou **T** (sintética), relatório (balanço ou DRE), grupo SPED e conta referencial (manual Anexo 32; FAQ 7536) | `ContaDoPlano` {codigo reduzido, nome, classificacao, sintetica, grupo} |
| **Plano de históricos** | Históricos padrão com código e texto. Aceitam **variáveis**, como `*M` = mês/ano do lançamento (FAQ 6466, 7537) | Não há cadastro geral (só códigos soltos por regra) |
| **Participante** | Cliente ou fornecedor (CNPJ/CPF). Conta marcada "de participante" exige participante no lançamento (FAQ 6815). Nasce quase sempre pela importação de notas no Fiscal | Nome e CNPJ no razão/notas; memória CNPJ → conta no Lançatudo |
| **Centro de custo** | Plano à parte; o lançamento é rateado por CC (FAQ 42648, 6301) | Não existe |
| **Preparações** | "Regras" do SCI: de/para do extrato (histórico do banco → conta), da planilha, do patrimônio → contábil, da transferência de saldos (I157) | As regras do Lançatudo e do Mister |
| **Plano de troca** | De/para aplicado **na importação**: troca conta, participante etc. do arquivo pelo que o SCI usa (FAQ 6725) | De/para que o nads teria de guardar |
| **Transação SPED** | Agrupa partidas de um lançamento para a ECD. Importações podem gerar a transação sozinhas (FAQ 5045) | Não existe |
| **SChIp** | Agendador e robô interno do SCI: roda importações (SBS, Omie, Push), zeramento, LALUR, SPED e relatórios por agendamento (FAQ 3475, 3340, 4941) | Os robôs do nads |
| **SCI WEB** | Portal web do escritório e dos clientes. Abriga o **SBS**, o **Integra NET**, o **SCI Report 24h**, o **Atendimento** e o **RH NET Social** | Área do Cliente e Mandei do nads |

## 2. Implantação de uma empresa (uma vez)

1. **Cadastrar a empresa** (Geral). Pode buscar os dados pelo CNPJ (FAQ 3553, 3556).
2. **Escolher o plano de contabilização**, ou seja, qual plano de contas e de históricos ela usa (FAQ 5835).
3. **Plano de contas**. Três jeitos de trazer:
   - *Integrações › Gerador de importações › Contas contábeis* + *Importação de contas contábeis*, a partir de um TXT
     ou CSV cujos campos a pessoa diz onde estão. Exemplo do FAQ: `0;0;1.1.4.1.0090;ADIANTAMENTO 13 SALARIO`
     (FAQ 3280).
   - *Integrações › Migrações*, com o gerador de plano de contas a partir de outro sistema (FAQ 5377).
   - Criar à mão ou copiar de outro plano (FAQ 42640, 7291).
4. **Plano de históricos**: cadastrar ou copiar de outro plano (FAQ 7537). O FAQ não mostra importador de históricos no
   Único (o Anexo 34 é da linha antiga) → **a confirmar** com a SCI.
5. **Conta referencial da ECD/ECF**: dá para importar a preparação por planilha (FAQ 7867).
6. **Saldos iniciais**. Três jeitos:
   - **pela ECD** do contador anterior: *Integrações › Importações › Sped ECD › Saldos*, com ou sem zeramento. Lê o
     I155 e usa uma preparação de de/para (I157) (FAQ 42866, 42865);
   - **pelo balancete**: lançamentos de implantação no último dia do mês anterior, um por conta, pela natureza
     (FAQ 4873);
   - **por migração** de outro sistema (FAQ 5377).
7. **Lançamentos de períodos anteriores** (se quiser o histórico): *Sped ECD › Lançamentos* (I200, FAQ 42837) ou
   migração por planilha .xlsx (FAQ 5377).
8. **Bancos**: cadastrar banco, agência e conta corrente com a **conta contábil**. Assim o SCI confere se o extrato é da
   conta certa (FAQ 4891).
9. **Configurar a contabilização** do Fiscal, da Folha e do Patrimônio em *Configurações › Contabilização › Configura
   contas* (FAQ 2279, 5051, 4318).

## 3. O mês a mês "do jeito SCI" (quem usa o SCI de verdade)

1. **Fiscal**: as notas entram pelo Push SCI ou Integra NET (buscadores da SCI), por XML (FAQ 3567), por pasta
   monitorada (FAQ 6826) ou pelos layouts TXT (Anexos 04/09). O Fiscal apura os impostos e **contabiliza sozinho** no
   Contábil, nota a nota ou por CFOP, pelo plano de contabilização (FAQ 4389, 4651, 4659).
2. **Folha**: o cálculo da folha contabiliza **on-line** no Contábil, verba a verba, pelo plano de contabilização
   (FAQ 5051, 4318).
3. **Bancos**: o extrato entra em *Integrações › Importações › Extratos bancários* (OFX/OFC de preferência; TXT com
   gerador). As **preparações** dizem a conta de cada histórico do banco, e o que já existe vira só conciliação
   (FAQ 4929, 7405). Também pode chegar pelo **SBS**, que busca o extrato no Open Finance (FAQ 9577).
4. **Comprovantes de pagamento**: o SCI lê o PDF do comprovante, com leitura cadastrável por banco, e baixa as
   duplicatas das notas junto com o extrato (FAQ 4919, 4923).
5. **Outros lançamentos**: TXT no leiaute padrão (FAQ 6621), planilha com gerador (FAQ 3202, 3203), SBS (FAQ 5045),
   lançamentos automáticos e recorrentes, como seguro e empréstimo (FAQ 3400), ou digitação.
6. **Patrimônio**: os bens são cadastrados ou importados, e a depreciação é integrada ao Contábil (FAQ 3376, 4686,
   3345).
7. **Conciliação**: *Processos › Central de conciliação* (FAQ 4907). Pode ser automática, inclusive pelo número do
   documento no complemento (FAQ 7314).
8. **Conferência**: o *Auditor contábil* acha conta sem participante, saldo invertido, imposto sem baixa, folha sem
   pagamento, conta obrigatória sem movimento e depreciação faltando (FAQ 6815, 5694).
9. **Fechamento**: o *bloqueio de lançamentos* por período e grupo de usuários (FAQ 6908, 3350). No fim do ano, o
   *encerramento do exercício (zeramento)*, que pode rodar pelo SChIp em várias empresas (FAQ 8057, 3340).
10. **Relatórios e entrega**: o balancete (CSV com cabeçalho, FAQ 5378), o razão em CSV sem quebra (FAQ 5743), a DRE e o
    balanço. A publicação ao cliente é pelo **SCI Report 24h**, e a ECD/ECF são geradas com validação pelo SChIp
    (FAQ 4690, 4757).

## 4. O mês a mês que queremos (nads → SCI)

```
                nads                                         SCI (Único)
┌──────────────────────────────────┐        ┌───────────────────────────────────────────┐
│ Extrato (PDF/OFX) → Lançatudo    │ .xlsx  │ "Lançamentos contábeis via planilha"      │
│ Creditor, Cartões, Honorários,   │ ─────► │   (pessoa ou robô do nads; ou SBS, pago)  │
│ INSS, FGTS, pró-labore, folha    │  API   │            │                              │
│ Conferência pelo saldo           │        │            ▼                              │
└──────────────────────────────────┘        │ Lançamentos contábeis ─► Balancete        │
┌──────────────────────────────────┐  XML   │            ▲                              │
│ SIEG (XML de NF-e, CT-e, NFS-e)  │ ─────► │ Fiscal importa e contabiliza (se o Fiscal │
└──────────────────────────────────┘ pasta/ │   for para o SCI)                         │
                                      API   │ Conferir: Auditor, consulta, excluir      │
┌──────────────────────────────────┐ ◄───── │   filtrados, bloquear o mês               │
│ Conferência do nads (balancete)  │  CSV / └───────────────────────────────────────────┘
└──────────────────────────────────┘ BI/API
```

Quem trabalha no SCI só:
1. **Importa** a planilha que o nads gerou (a mesma que já conferiu no Excel) em *Integrações › Importações ›
   Lançamentos contábeis via planilha*: datas, gerador, arquivo, F12 (FAQ 3203). Ou deixa o robô do nads fazer isso.
   Se um dia o SBS (pago à parte) for contratado, o nads manda o TXT pela API e o SChIp importa sozinho.
2. **Confere** o balancete e o Auditor contábil.
3. **Exclui o que for preciso**: na *consulta de lançamentos* da empresa, filtra (por lote, data ou histórico) e usa
   "Excluir todos os registros filtrados". Na matriz isso não alcança as filiais; é uma por uma (FAQ 6297).
4. **Bloqueia o mês** (FAQ 6908).

## 5. Pegadinhas que o FAQ mostra

- **Conta de participante sem participante** → o lançamento não entra (FAQ 5460, 3203). No TXT, o CNPJ vai nos campos
  118/119, e o participante precisa existir no SCI. Ele nasce na importação das notas ou na migração.
- **Débito ≠ crédito** na migração → não migra, a menos que se marque a opção (FAQ 5377).
- **Importar duas vezes**: a migração tem "comparar com já importados". No SBS, o mesmo período já importado devolve
  422 e o reenvio enquanto o status é "novo" substitui o arquivo (API).
- **CNPJ errado no arquivo**: o TXT leva `EMPRESA<CNPJ>` em cada linha, e o SCI recusa se não for a matriz ou uma
  filial (FAQ 6775).
- **Saldo de abertura**: a implantação vai no **último dia do mês anterior** ao início (FAQ 4873). A importação de
  lançamentos da ECD exige os saldos do ano anterior (FAQ 42837).
- **Preparação de extrato duplicada** é recusada (FAQ 42637).
- **Zeramento**: se a migração ignorar os lançamentos de zeramento, é preciso zerar de novo no SCI (FAQ 5377, 29582).
- **Plano de contas**: trocar no meio do ano exige cuidado (FAQ 7943). O plano de contabilização pode ser trocado por
  utilitário (FAQ 5834).
