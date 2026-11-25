# As APIs da SCI no nads (24/11/2026)

O dono pediu: "monta o nads para suportar completamente a integracao do sci mesmo que nao vamos usar por agora".

O nads já tem as três integrações úteis prontas. **Todas ficam desligadas** até alguém ligar em **Configurações › Integração SCI**, que grava em `config/sci`.

A documentação da SCI está no portal-dev.sci.com.br. É pública, em arquivos OpenAPI.

## O que cada parte faz

| Chave | O que faz | Onde roda |
| :--- | :--- | :--- |
| Guias do SCI Report na Área do Cliente | O cliente vê, na aba Guias, as guias publicadas no SCI Report (busca na hora) | A função `guiasDoSciReport` (`funcoes/`) |
| Publicar no SCI Report pelo Enviar guias | A via "SCI Report" do Fiscal › Enviar guias publica cada guia (publicação manual, BETA na SCI) | O robô da nuvem (`robo/lote-fiscal.js` → `robo/sci.js`) |
| Ler de volta | De hora em hora, das 8h às 20h, lê se o cliente viu cada guia publicada e se informou o pagamento | O robô da nuvem (`robo/sci.js`) |
| Mandar os XMLs ao Integra NET | Depois de cada "Baixar XMLs" do SIEG, manda as notas do mês que ainda não foram | O robô do PC (`robo/sieg.js` → `robo/sci.js`) |
| Conferir as notas com o SCI | Compara o mês do SIEG com o do Integra NET; o Fiscal › SIEG mostra quantas notas faltam no SCI | O robô do PC |
| RH NET (folha) | O robô atende os pedidos do nads ao RH NET: buscar os cadastros da empresa (o Testar da tela), cadastrar admissões sem liberar, liberar, e lançamentos da planilha | O robô da nuvem (`robo/rhnet.js`, pela fila `solicitacoesEmail` tipo `rhnet`) |

A configuração também guarda:
- **As empresas com o SCI ligado:** os códigos do nads. Só essas empresas vão à SCI.
- **O código do relatório de cada guia no SCI Report:** é o modelo de imposto que o escritório cadastra lá.

A regra fica toda no core, com testes:
- `packages/core/src/sci/integracao`: a configuração, o Integra NET e a publicação.
- `packages/core/src/areaCliente/sciReport*.ts`: o SCI Report.

O robô e a função usam cópias geradas dessa regra:
- `robo/gerado/sci.js`, feito por `npm run robo:sci`;
- `funcoes/gerado/sciReport.js`, feito por `npm run funcoes:sci`.

O `npm run verificar` confere se essas cópias estão em dia.

## Para ligar

1. **Pedir à SCI o Token de Parceiro**, pelo cadastro de integrador (airton@sci.com.br).
   - Perguntar o preço da API.
   - Perguntar o preço da licença do Integra NET, que é por empresa: sem licença, a SCI responde 403.
2. **Gerar o Token de Cliente** no SCI WEB, entrando com um **usuário da contabilidade** (Módulo Administrador), no menu do nome › "Gerar token API".
   - Ele aparece uma vez só.
   - Use um usuário adicional "nads" com todas as categorias liberadas.
3. **Pôr os dois tokens fora do nads.** Nunca no git, no banco ou no chat.

   | Onde | Como |
   | :--- | :--- |
   | Robô da nuvem | Metadados `segredo-sci-parceiro` e `segredo-sci-cliente` da VM `robo-nilma` |
   | Robô do PC | O arquivo `robo/sci_credenciais.json`, com `{ "parceiro": "...", "cliente": "..." }` (fica fora do git) |
   | Função da Área do Cliente | Os segredos `SCI_TOKEN_PARCEIRO` e `SCI_TOKEN_CLIENTE` (veja `funcoes/LEIAME.md`) |

4. **No SCI Report, cadastrar os modelos de imposto** (DAS, DARF, DAE, DAM…). Depois, escrever o código de cada um na tela.
5. **Ligar uma parte por vez, com uma empresa de teste.** Escolha uma empresa cujos avisos do SCI Report cheguem só ao escritório.
6. **Publicar.** Cada passo só com a autorização do dono.
   - O nads: `npm run sites -- tarefas`.
   - O site do cliente: `npm run sites -- cliente`.
   - A função.
   - O robô da nuvem: troque o metadado `robo-versao`.

## RH NET (25/11/2026)

O RH NET **não aceita o token do escritório**. Ele só funciona com o Token de Cliente gerado por **um usuário da própria empresa** (Módulo Cliente do SCI WEB), e cada token só vale para aquela empresa. Por isso o robô guarda um token por empresa.

**Onde ficam os tokens**

| Onde | Como |
| :--- | :--- |
| Robô da nuvem | O metadado `segredo-sci-rhnet` da VM, com `{ "583": { "token": "..." } }` |
| Robô do PC (e o teste) | A chave `"rhnet"` no `robo/sci_credenciais.json`, no mesmo formato. Só para o teste, vale também `"empresa": "<token>"` |

O Token de Parceiro é o mesmo das outras APIs. O número da empresa no RH NET é o **código da empresa no SCI** (o mesmo do nads), e não o número do SCI WEB que vem dentro do token. O primeiro teste (25/11/2026, empresa 590) confirmou isso: com o número do token, o RH NET respondeu "Usuário não está vinculado a essa empresa"; com o código, respondeu os dados. Se o código no SCI for diferente do nads, acrescente `"empresaId"` ao lado do token. A contabilidade (`clienteId`, 17157) vem dentro do token, em `usuario.dados`.

**Na Área do Cliente:** quem fala com o RH NET é só o **robô da nuvem**, que tem os tokens nos metadados. De hora em hora, ele grava a lista pronta de cada empresa (nome, tipo, CPF mascarado, entrada e situação, sem salário) em `rhnetArea/{código}`. O robô do servidor só lê essa lista e copia para a aba RH, então o NILMA-SERVER não precisa dos tokens.

**O teste só de leitura**, quando os tokens chegarem:

```bash
node robo/rhnet.js testar 583
```

Ele entra no RH NET, mostra o número da empresa e quantos cadastros e admissões existem. Não grava nada e não mostra nome de funcionário nem CPF.

**Pela tela:** ligue "RH NET (folha)" em Integração SCI, ponha a empresa na lista e grave. Aparece o cartão RH NET, com o botão **Testar**.

**Cuidados do RH NET**
- Cadastrar uma admissão a deixa **não liberada**. Só a liberação manda para a folha do SCI, e ela exige o cadastro completo.
- Os dados pessoais do pedido (CPF, salário) ficam no banco só até o robô atender, dando certo ou não.
- A SCI marca o RH NET como **beta**: pode mudar sem aviso.
- O formulário de admissão do DP no nads ainda não existe. A regra e a fila estão prontas; falta decidir quais campos o DP preenche.

## Cuidados

- **Publicação manual:** a SCI diz que está "em desenvolvimento", então os campos podem mudar.
- **"Pagamento informado":** é o que o cliente registrou no SCI Report, não a confirmação do banco.
- **Guia repetida:** a mesma guia pode aparecer duas vezes na Área do Cliente, pelo nads e pelo SCI Report. Escolha um caminho por guia.
- **Link sem login:** a SCI tem um endereço de PDF sem login (`publicados/visualiza/{hash}`, com o hash = base64 de `usuarioId:publicadosId`). Esse endereço é fácil de adivinhar. O nads não usa; vale avisar a SCI.
- **APIs que ficaram de fora,** por valerem pouco para o escritório: SCI Report Atendimento, RH NET (só se contratarem), Smart Bank Statement (pago à parte; escolheram a planilha) e o Login externo no SCI WEB.
