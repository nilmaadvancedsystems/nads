# As 14 brechas comuns de site, no nads (auditoria de 24/11/2026)

O nads grava direto no banco pelo navegador. Por isso quem protege de verdade é a **regra do banco** (Firestore do
`entregas-2e5e2`). Esconder a tela não é proteção. Esta auditoria leu o código, a regra que estava no ar (ruleset
`4dfc3931`, de 24/11 11:25 UTC) e o histórico do git. Ninguém tentou invadir o site no ar.

Legenda: ✅ protegido · 🔧 corrigido nesta auditoria · ⏳ correção pronta, falta publicar · ⚠️ aberto (precisa de decisão)

| # | Brecha | Estado | Resumo |
|---|---|---|---|
| 1 | Digitar /admin | ✅ | A tela do admin só esconde; a regra barra os dados |
| 2 | Trocar o ID na URL | 🔧 | A Área do Cliente está protegida; o envio do Mandei aceitava outra empresa |
| 3 | Chave de API no navegador | ✅ | No navegador só vai a configuração do Firebase, que é pública |
| 4 | Mudar o preço | 🔧 | A comissão aceitava qualquer valor e qualquer % |
| 5 | Comprar -1 item | ✅ | Valor e quantidade negativos são recusados onde a equipe e o cliente gravam |
| 6 | Fingir o Pix pago | 🔧 | O cliente não marca pago; o Financeiro conseguia trocar o PDF do boleto |
| 7 | Cupom 100 vezes | ✅ | Não existe cupom nem desconto |
| 8 | Premium sem pagar | ✅ | Não existe plano pago |
| 9 | Admin no cadastro | ✅ | Ninguém se promove; o convite só dá os papéis dele |
| 10 | Adivinhar o código | 🔧 | Códigos longos e aleatórios; a conta do cliente podia ser tomada |
| 11 | Mandar a IA ignorar | 🔧 | A IA lia o banco inteiro, e dois robôs davam ao Claude mais poder do que precisava |
| 12 | Script no usuário (XSS) | ✅ | Todo texto de fora é escapado; há melhorias de manutenção |
| 13 | Senhas no GitHub | ✅ | Nenhum segredo real no histórico |
| 14 | Abrir teu banco de dados | ⚠️ | O banco do Entregas está fechado; o `conferencia-nilma` está aberto |

---

## 1. Digitar /admin ✅

- **Tela:** `AppAdmin.tsx` mostra "Só para administradores" a quem não é admin. Isso é só a tela.
- **Dados:** quem barra é a regra. Exemplos:
  - mudar papel, nível, departamento e ativo: só o Diretor (`usuarios`, `naoMexeuEm` + `ehDiretorAdmin`);
  - convites: só o Diretor cria e lista;
  - `auditoria`, `robosPermissoes`, `nadsPedidos` (aprovar o computador): só o admin;
  - `segredos`: ninguém lê pelo app.
- **Modo desenvolvedor:** liga pelo `localStorage` e abre algumas telas. Ele só **tira** gravações, não dá poder nenhum no
  banco (`comum/modoDesenvolvedor.ts`).
- **Comandos dos robôs pela Central (`robosComandos`):** a lista de ações é fechada, e quem pode cada ação está na regra
  e é conferido de novo pelo robô. Nenhuma ação vira comando de shell.

## 2. Trocar o ID na URL 🔧

- **Área do Cliente (`/cliente/:token`):** tudo fica dentro de `areasCliente/{token}`. Com senha, a regra exige que o
  login tenha aquele link. O robô confere o dono antes de agir: na DANFE, no "Recebi" e na avaliação do chamado.
- **Equipe:** qualquer pessoa da equipe vê todas as empresas. É o desenho atual: não há responsável por empresa.
- **Brecha (Mandei):** o envio de arquivo pelo link do ticket aceitava `codigo`, `cliente` e `competencia` livres. Quem
  tinha um link conseguia pôr um "extrato" na pasta de outra empresa.
  - **Corrigido no robô:** `robo/mandei-conferir.js`. O robô usa a empresa, o cliente e o mês do link, nunca os do
    navegador.
  - **Na regra (R4, publicada em 24/11):** os três campos têm de ser iguais aos do `ticketsLinks/{ticket}.envio`.
- **Leve:** quem tem só o link de uma Área com senha lê o nome e os códigos da empresa no documento raiz. A tela precisa
  disso antes do login. Aceito por enquanto.

## 3. Chave de API no navegador ✅

- No navegador só vão `VITE_APLICATIVO`, `VITE_FONTE` e `VITE_SO_ENTRADAS`, que não são segredo, e a configuração web do
  Firebase de dois projetos. Essa configuração é pública por natureza: quem protege é a regra do banco.
- Nenhuma chave de Claude, Efí, Sicoob, SMTP, Google ou WhatsApp aparece em `apps/web`, `packages` nem no bundle.
- **Onde ficam os segredos dos robôs:**
  - metadado da VM: SMTP, token do Gmail, bancos e certificados;
  - arquivos ignorados pelo git no PC: Gmail, SIEG, certificado do FGTS, sessão do WhatsApp;
  - `segredos/nfse`, que ninguém lê pelo app.
- **A conferir no console:** se as duas chaves do Firebase têm restrição de domínio ou de API. A API Keys não está ligada
  nos projetos, por isso não deu para ler daqui.

## 4. Mudar o preço 🔧

- **Protegido:**
  - NFS-e: a faixa de valor é conferida na regra e de novo no robô;
  - boleto do lote: o valor não muda depois de criado;
  - honorário: o cliente não grava nada.
- **Brecha (Carteira):** a regra da comissão só conferia a faixa de cada campo. Pelo console, uma pessoa da equipe
  mandava 100% ou um valor qualquer. Desde 19/11 não há aprovação, então a registrada já fica "a pagar".
  - **Corrigido na tela:** a lista do Financeiro avisa quando a comissão não bate. Os casos são valor diferente de
    serviço × %, % fora da tabela, valor do serviço diferente do definido e serviço que não está na tabela. A conta é
    `carteira.avisosDaComissao`, testada.
  - **Na regra (R2, publicada em 24/11):** o valor da comissão registrada pela pessoa tem de ser serviço × %.
- **Menor:**
  - o preço do insumo vem da tela, mas só pesa nos relatórios;
  - o robô do Efí emite com o valor do pedido sem comparar com o contrato. Só quem tem o Financeiro grava esse pedido.

## 5. Comprar -1 item ✅

A regra recusa valor zero ou negativo e quantidade fora da faixa em comissões, insumos, lançamentos da Carteira, boletos e
NFS-e. As coleções do Financeiro (`financeiroHonorarios`, `financeiroRecebimentos` e outras) aceitam qualquer gravação de
quem tem o Financeiro. É erro ou má-fé interna, não de fora.

## 6. Fingir o Pix pago 🔧

- **O cliente não marca pago:** o espelho da Área do Cliente só o robô grava. A baixa do Efí é o robô que consulta.
- **O recebimento à mão** (botão Receber) é do desenho: quem tem o Financeiro registra.
- **Brecha (troca do PDF do boleto):** o pedaço do PDF (`financeiroBoletos/{id}/partes`) podia ser apagado e criado de
  novo depois do boleto revisado, inclusive nos boletos do Efí. O "Enviar de novo" mandava ao cliente o PDF trocado, com
  os dados de outra conta.
  - **Na regra (R1, publicada em 24/11):** o pedaço só entra no boleto de quem o criou, antes do disparo e dentro do número
    de partes. O boleto do robô (`efi_*`) não recebe pedaço pelo navegador.

## 7. Cupom 100 vezes ✅

- Não há cupom nem desconto.
- Os parecidos estão limitados:
  - chamados e arquivos da Área do Cliente têm teto por dia;
  - o pedido de senha tem 3 por e-mail por dia;
  - o boleto do Efí sai uma vez por mês, conferido pela tela e travado numa transação do robô.

## 8. Premium sem pagar ✅

Não há plano pago. Quem entra no Financeiro é decidido pelo nível e pelo papel, que só o Diretor muda, e pelo login
liberado.

## 9. Admin no cadastro ✅

- A própria pessoa não mexe em `roles`, `nivel`, `departamento`, `ativo` nem `email`. O admin comum não mexe em papel
  nem nível. Só o Diretor, e o nível Dono ninguém põe pelo app.
- Quem entra pelo convite fica exatamente com os papéis, o departamento e o nível do convite. Convite só o Diretor cria.
- **Menor:** o convite é queimado depois do cadastro, numa gravação à parte. Quem tem o convite pode criar mais de uma
  conta em 24 h. Para fechar: gravar os dois juntos (`writeBatch`) e exigir na regra que o convite saia usado.

## 10. Adivinhar o código 🔧

- **Os links e convites são aleatórios e longos:**
  - convite: 122 bits;
  - Área do Cliente e portal: 160 bits;
  - assinatura: 128 bits;
  - ticket do Mandei: cerca de 139 bits;
  - protocolo: 60 bits.
  Nenhum dá para listar. Adivinhar é inviável.
- **Corrigido:**
  - **Tomada da conta do cliente.** O cadastro por e-mail do Firebase é aberto. Um estranho podia criar antes a conta
    com o e-mail do cliente, e o robô só punha os links nela. Agora, conta que já existia sem a marca de cliente tem a
    senha trocada por uma aleatória e as sessões derrubadas antes de receber os links. A pessoa cria a dela pelo "Pedir
    senha". Ver `contaPrecisaZerar` (core) e `robo/acesso-cliente.js`.
  - **Pedido de senha travado para todos.** O total do dia contava também os e-mails inventados, então quem tinha um
    link gastava os 100 do dia. Agora só conta o pedido de quem tem acesso (`robo/senha-cliente.js`).
  - **Código de 6 dígitos da liberação do computador.** Usava `Math.random`; agora usa o gerador criptográfico
    (`usuarios/regras/liberacao.ts`).
  - **Login pelo nome.** O índice público (`loginPorNome`) entregava o e-mail e o uid de quem é da equipe. Agora guarda
    só o e-mail (`robo/login-por-nome.js`). Chutar o nome ainda dá o e-mail; para fechar de vez, desligar a entrada pelo
    nome.

## 11. Mandar a IA ignorar 🔧

- **Nenhum texto de fora chega direto a uma IA.** E-mail, WhatsApp, chamados e tickets não passam por modelo. O texto de
  fora chega quando a IA lê o banco ou um arquivo.
- **Corrigido:**
  - **A IA lia o banco inteiro.** O Claude da Consulta rápida lia qualquer coleção pelo Admin SDK, que ignora a regra.
    Qualquer pessoa da equipe podia pedir, por exemplo, os convites de troca de senha. Agora a IA só lê uma lista de
    coleções de trabalho, só no primeiro nível e sem campos de senha ou token (`robo/ia-banco.js`, testado em
    `robo/teste-ia-banco.js`). As instruções dizem que o que vem do banco é dado, não ordem. As ações continuam
    precisando da confirmação da pessoa.
  - **O suporte devolvia o que o Claude leu.** O relatório do bug volta a quem mandou. Agora o Claude do suporte não lê
    os arquivos de credencial, e o relatório passa pelo limpador de segredos (`robo/limpar-segredos.js`).
  - **O FGTS rodava com `bypassPermissions`.** Agora roda só com as ferramentas do Chrome. O nome da empresa entra
    limpo e curto no texto (`robo/fgts-claude.js`); na regra, R3 (publicada em 24/11).
- **Aberto:**
  - O **arquivador antigo** (`arquivador.js`, `/organizar`) ainda tem `bypassPermissions` sobre documentos que chegam por
    e-mail. Conferir no PC que a rotina e a tarefa das 9h estão desligadas, e apagar esse caminho.
  - **Atualização dos robôs:** um push na `desenvolvimento` roda no servidor como SYSTEM em cerca de 10 minutos, sem
    conferir nada. Para fechar:
    - proteção de branch no GitHub (hoje não há) e 2FA;
    - commits assinados conferidos antes de atualizar;
    - `npm ci --ignore-scripts`;
    - a tarefa com um usuário sem administrador.

## 12. Script no usuário (XSS) ✅

- O React bloqueia `javascript:` nos links.
- Os links da Área do Cliente têm prefixo fixo.
- Os e-mails dos robôs escapam tudo (`robo/email-html.js`).
- Todo HTML montado no core (etiquetas, demonstrativos, protocolos) escapa o texto.
- Nenhum caminho de texto de cliente ou de estranho vira script.
- **Melhorias, sem urgência:**
  - há cerca de 18 cópias de escapador; juntar numa só;
  - pôr `sandbox` no quadro da impressão (`imprimirHtml`);
  - um cabeçalho CSP em modo de teste.

## 13. Senhas no GitHub ✅

- **Varredura do histórico inteiro** (4.095 commits, padrões do gitleaks):
  - só apareceram as configurações web do Firebase, que são públicas;
  - o client do firebase-tools, que também é público;
  - senhas de mentira dos testes.
- **No GitHub:** a varredura de segredos e o bloqueio de push com segredo estão ligados. Os dois alertas abertos são as
  chaves web do Firebase.
- Os arquivos de credencial estão no `.gitignore` e nunca entraram no histórico.

## 14. Abrir teu banco de dados ⚠️

- **Entregas (`entregas-2e5e2`):**
  - toda coleção tem regra;
  - a que não tem nasce trancada (`match /{document=**} { allow read, write: if false; }`);
  - `logado()` sozinho não abre nada: precisa ser da equipe.
- **`conferencia-nilma`: ABERTO.** A regra é `allow read, write: if true`. Qualquer pessoa da internet que saiba o nome do
  projeto lê, troca e apaga os dados do Extrator, da Conferência, do Creditor e do Lançatudo. O nome do projeto está no
  site. Esse projeto não tem login, por isso não basta trocar a regra.
  - **Proposta:** o nads pede ao robô da nuvem um login do `conferencia-nilma` para quem é da equipe (custom token), e a
    regra de lá passa a exigir esse login.
  - É trabalho próprio: login no projeto, permissão da conta do robô, as telas e o site antigo `conferencia-nilma.web.app`.
  - Até lá, os dados de clientes desse banco estão expostos.
- **Storage:** nenhum dos três projetos publica regra de Storage; os arquivos ficam no Firestore em pedaços.
  `lcdpr-b7f69` não tem banco publicado.

---

## O que falta (precisa do OK)

1. ~~Regra do Entregas, R1 a R4~~: **publicada em 24/11/2026, 21:10 UTC** (ruleset `c40a6df2`), montada sobre a que estava no ar.
2. **Robôs:** as mudanças em `robo/` só valem depois do push na `desenvolvimento` e da troca do `robo-versao`.
   - Antes, testar no PC o FGTS sem `bypassPermissions` e o suporte com as proibições de leitura.
   3. **Site:** o aviso das comissões entra na próxima publicação do nads.
4. **`conferencia-nilma`:** decidir e fazer o login por custom token (item 14).
5. **GitHub:** proteção de branch e 2FA (item 11).
