# O FAQ do SCI de cabo a rabo: cada função, útil ou inútil para o nads

Levantamento de **23/11/2026**: 5.493 artigos distintos do FAQ da linha NOVO VISUAL. Cada título foi classificado por
assunto, por palavras-chave. A contagem é aproximada: um artigo pode tocar em dois assuntos e conta só no primeiro.
Depois foram lidos por inteiro os ~70 que tratam de importação, integração, conferência e fechamento.

**Os três veredictos**
- **Útil para o nads**: o nads deve gerar, mandar ou ler isso. É onde o SCI vira "só conferência".
- **Útil só no SCI**: o SCI faz bem e o nads não deve refazer. A pessoa usa no SCI, de vez em quando.
- **Inútil para o nads**: o nads já faz melhor, ou o assunto não é do Contábil deste fluxo. Ignorar.

## 1. Mapa por assunto

| Assunto | Artigos (aprox.) | Onde | Veredicto | Por quê |
|---|---|---|---|---|
| Importação de lançamentos (TXT, planilha, SBS, Omie, ECD, migração) | 136 | Contábil, Fiscal | **Útil para o nads** | É a porta de entrada do nads (doc 02, A–C, E) |
| APIs, MCP e BI Connection | 98 | Geral | **Útil para o nads** | SBS (manda lançamentos), Integra NET (manda XML), BI e Report (leem balancete) |
| Extrato bancário e conciliação | 50 | Contábil | Parte útil | O nads já contabiliza o extrato. Do SCI, servem a *Central de conciliação* e a marca CONC no TXT |
| Plano de contas, históricos, centro de custo, plano de troca | 246 | Contábil, Fiscal, Folha | **Útil para o nads** (implantação) | O de/para das contas e os históricos padrão são a base de tudo |
| Contabilização (fiscal/folha → contábil) | 134 | Fiscal, Folha | **Útil só no SCI** | Se o Fiscal e o DP forem para o SCI, eles contabilizam sozinhos. Se não, o nads manda pelo TXT |
| Notas fiscais (XML, NFS-e, CT-e, Integra NET, Push) | 363 | Fiscal | Útil para o nads, **se o Fiscal for para o SCI** | O nads entrega os XML do SIEG (pasta ou API). O Push SCI repete o SIEG e é inútil |
| Balancete, razão, DRE e relatórios | 431 | Folha, Contábil, Fiscal | Útil (o balancete) | O nads lê o balancete de volta para a Conferência. Os outros relatórios são só no SCI |
| Zeramento, bloqueio, fechamento | 42 | Contábil | **Útil só no SCI** | Um clique por mês ou ano. O SChIp faz em lote |
| Patrimônio (bens, depreciação, CIAP) | 56 | Contábil, Fiscal | Útil só no SCI | O nads não controla bens. Pode só importar um cadastro inicial (doc 02, L) |
| SPED ECD/ECF, LALUR, DeRE | 257 | Contábil | **Útil só no SCI** | Saem do SCI depois que os lançamentos estão lá. A ECD de entrada serve para os saldos |
| SPED Fiscal, Contribuições, Reinf, DCTFWeb | 610 | Fiscal | Fora do escopo do Contábil | É do Fiscal. Decide-se quando o Fiscal migrar |
| Simples Nacional, Defis, obrigações estaduais | 514 | Fiscal | Fora do escopo do Contábil | O mesmo. O nads já tem calculadoras e conferências próprias |
| Reforma tributária (IBS/CBS) | 37 | Fiscal | Fora do escopo do Contábil | O nads tem as calculadoras RTC (sessão própria) |
| eSocial, FGTS Digital, DIRF | 505 | Folha | Fora do escopo do Contábil | É do DP |
| Cálculos da folha (férias, 13º, rescisão, verbas, consignado) | 499 | Folha | Fora do escopo do Contábil | É do DP. Do Contábil, importa só o resultado: a contabilização |
| RH NET Social | 29 | Folha | Inútil para o nads hoje | É o portal do DP para o cliente. A Área do Cliente do nads cumpre esse papel |
| SChIp, Push e automação | 186 | Fiscal, Geral, Folha | **Útil só no SCI** | O SChIp importa o SBS sozinho e roda zeramento, SPED e LALUR em lote. O Push repete o SIEG |
| Financeiro (cobrança, boletos, NFS-e do escritório) | 23 (+282 no módulo) | Financeiro | **Inútil para o nads** | O nads já tem o Financeiro do escritório, com Sicoob e Efí |
| Tarefas, Protocolos, Notificações, Temporizador, Orçamentos | ~230 | módulos próprios | **Inútil para o nads** | O nads é o sistema de tarefas, protocolos e avisos do escritório |
| SCI Report 24h e Atendimento | (em Geral) | Geral | Já usado / inútil | O Report já é uma "via de entrega" no nads. O Atendimento repete a Área do Cliente e o WhatsApp |
| Help de tela (F1) | 469 | todos | Consulta | Explicam cada tela; servem para tirar dúvida pontual |
| Cadastros, usuários, certificados, banco de dados | 271 | Geral | Só no SCI | Administração do SCI |
| Novidades da versão | 14 | todos | Acompanhar | Mudanças nas importações aparecem aqui e no histórico de mudanças das APIs |

## 2. Módulo a módulo

### Contábil (981 artigos): o que interessa

**Útil para o nads, porque o nads alimenta:**
- *Lançamentos contábeis via arquivo TXT*. O leiaute padrão e a grade de correção (FAQ 6621, 6685, 6154, 5934, 6775,
  4256, 4555, 7414, 4897).
- *Lançamentos contábeis via SBS*, por API, com o SChIp importando sozinho (FAQ 5045, 3475).
- *Lançamentos via planilha* com gerador, o plano B (FAQ 3202, 3203, 32459, 5460, 5028, 7878).
- *Importação de contas contábeis* com gerador (FAQ 3280).
- *Sped ECD › Saldos* e *Sped ECD › Lançamentos*, para a implantação (FAQ 42866, 42865, 42837).
- *Migrações* de outros sistemas: plano de contas, centro de custo e lançamentos por .xlsx (FAQ 5377).
- *Plano de troca*: de/para na importação (FAQ 6725).

**Útil só no SCI, porque a pessoa usa para conferir e fechar:**
- *Auditor contábil*: conta sem participante, saldo invertido, imposto sem baixa, folha sem pagamento, conta
  obrigatória sem movimento (FAQ 6815, 5694).
- *Central de conciliação* (FAQ 4907), *Bloqueio de lançamentos* (FAQ 6908) e *Excluir todos os registros filtrados*
  (FAQ 6297).
- *Encerramento do exercício (zeramento)*, por empresa ou pelo SChIp (FAQ 8057, 3340). *Arquivamento* de anos antigos
  (FAQ 5853).
- *Relatórios*: balancete (CSV, FAQ 5378), razão (CSV, FAQ 5743), DRE, balanço, comparativos e consolidação
  matriz/filiais (FAQ 6364).
- *ECD/ECF/LALUR/DeRE*: 257 artigos, todos depois dos lançamentos.

**Útil, mas com cuidado** (o nads já faz e o SCI repete):
- *Extrato bancário com preparações* (FAQ 4929): o Lançatudo faz isso, com o aprendizado CNPJ → conta e as regras do
  Mister.
- *Leitura de comprovantes em PDF* (FAQ 4919): o Lançatudo tem comprovantes.
- *Lançamentos automáticos* (seguro, financiamento, FAQ 3400): pode ser útil no SCI para lançamentos fixos, ou o nads
  gera.

**Inútil para o nads:** incorporadoras (INCORP, POC, distrato), Cosif (bancos), variação cambial, JCP, distribuição de
lucros por ATA e plano de contas secundário. Não se aplicam às empresas do escritório, ou são raros e ficam no SCI.

### Fiscal (2.176 artigos)
- Se o Fiscal **for** para o SCI:
  - **útil para o nads**: importar NF-e, NFC-e, CT-e e NFS-e por XML, pasta ou API (FAQ 3567, 6826, 9577) e as
    duplicatas e baixas (Anexo 31);
  - **útil só no SCI**: apuração, SPED, Reinf, DCTFWeb e Simples. A contabilização das notas vai sozinha para o
    Contábil.
- Se o Fiscal **ficar** no Alterdata: quase tudo é inútil para este fluxo. As notas viram lançamentos do nads no TXT,
  como a Conferência já faz com as notas "faltando".
- **Inútil**: o Push SCI e o Integra NET como buscadores (o SIEG já busca), e os relatórios fiscais que o nads já
  confere.

### Folha (2.408 artigos)
- Se o DP **for** para o SCI: a contabilização on-line da folha (FAQ 5051, 4318) faz o Contábil receber a folha sem
  arquivo. O nads só confere (INSS, FGTS, líquido).
- Se o DP **ficar** no Alterdata: a folha vira TXT do nads, a partir dos holerites lidos ou do relatório de
  contabilização do Alterdata DP.
- **Inútil para o nads**: eSocial, cálculos, consignado, RH NET e as guias, que ficam no sistema de DP.

### Geral (525 artigos)
- **Útil para o nads**: as APIs e os tokens (FAQ 42310, 9577, 8924, 8873), o BI Connection (FAQ 6657, 6662, 4025,
  4026), o SChIp (FAQ 4941, 5209) e a implantação de empresas (FAQ 3553, 3556).
- **Inútil**: chat, teclas de atalho, banco de dados e suporte.

### Financeiro, Tarefas, Protocolos, Notificações, Temporizador, Orçamentos, Impostos, Auditor Folha
- **Inúteis para o nads**: o nads já é o sistema do escritório para cobrança, tarefas, protocolos, avisos e tempo.
- Exceção: o módulo *Impostos* integra pagamentos com o SCI Report (FAQ 3991). Só interessa se o escritório mudar a
  entrega de guias para o Report.

## 3. Os produtos web da SCI (SCI WEB), um por um

| Produto | O que faz | Para o nads |
|---|---|---|
| **SBS – Smart Bank Statement** | Busca extrato no Open Finance e **recebe lançamentos contábeis por API** | Útil, mas **pago à parte** e o escritório não tem. Sem ele, vale o TXT (importação manual ou robô) |
| **Integra NET / ISS Legal** | Busca e guarda XML. A API recebe e devolve XML | Útil se o Fiscal for para o SCI, para mandar os XML do SIEG. Como buscador, repete o SIEG |
| **SCI Report 24h** | Publica relatórios e impostos para o cliente. A API lista, baixa e publica | Já usado como via de entrega. A API pode trazer de volta o balancete publicado |
| **SCI Report Atendimento** | Chamados do cliente | Inútil: o nads tem a Área do Cliente e o WhatsApp |
| **RH NET Social** | O cliente lança dados do DP | Inútil para o Contábil |
| **MCP SCI** | Liga o Claude/ChatGPT ao Report e ao Atendimento | Inútil para lançar. Serve só para perguntas sobre o que foi publicado |
| **BI Connection** (pago à parte) | SQL direto no banco do SCI | Útil para ler o balancete e o plano de contas sem exportar à mão |
