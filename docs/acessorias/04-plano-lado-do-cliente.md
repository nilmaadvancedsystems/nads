# Plano de execução: o lado do cliente (Área do Cliente, Mandei, avisos por e-mail e WhatsApp)

Escrito em 17/11/2026. Este é o plano para **quem vai escrever o código**. Ele junta, num lugar só, o que falta ao
cliente do escritório Nilma Contabilidade quando a Área do Cliente e o Mandei do NADS são comparados com o Acessórias e
com outros portais de contabilidade. Junta duas listas: as lacunas do lado do cliente (Acessórias x NADS, já
conferidas no código) e as funções candidatas vindas de outros portais. As duplicadas viraram um item só. O que fere as
regras do projeto foi descartado, com o motivo no fim do arquivo. Cada item é uma **ficha** com o passo a passo
arquivo por arquivo, o caminho no banco, a regra do banco (quando precisa), o robô, os testes, como conferir na tela,
os critérios de aceite, os riscos e o tamanho. As fases vão do que é só site (fase 1) ao que depende do robô (fase 2),
do Vitor (fase 3) e de decisões do dono (fase 4).

O que não está nas fontes nem no código aparece como **"a confirmar"**. Não invente o que estiver marcado assim:
pergunte.

---

## 0. Antes de começar (vale para todas as fichas)

### 0.1 As 12 regras do projeto (cada ficha cita as que toca)

| nº | Regra | Como aparece nas fichas |
|---|---|---|
| R1 | Telas só desenham. A lógica fica nas VMs (`use*.ts`) e as regras puras ficam em `dados/*.ts` ou em `packages/core`, com testes vitest. Comentários em português, com a data e a frase do dono que motivou a mudança. | Cada passo diz em que camada vai. |
| R2 | Firebase só em `dados/*.firestore.ts` (o `npm run conexoes` confere). | Leituras e gravações novas só em `apps/web/src/aplicativos/cliente/dados/areaCliente.firestore.ts` (cliente) ou `apps/web/src/aplicativos/tarefas/dados/*.firestore.ts` (equipe). |
| R3 | As regras do banco (`firestore.rules` do Entregas, projeto `entregas-2e5e2`) quem publica é o **Vitor**. O modelo só escreve o texto proposto. | Fichas com "Regra do banco proposta". Marcar a dependência. |
| R4 | Área do Cliente **sem chat**: a conversa é pelo WhatsApp e os pedidos são solicitações com situação. | Avisos e comunicados só de ida, e avaliação sem resposta. |
| R5 | Privacidade: nunca o CPF/CNPJ de compradores no espelho do cliente, e nunca o CPF completo de funcionário nem o motivo de afastamento no espelho. | XMLs descartados; TRCT fora; certificados sem titular cifrado. |
| R6 | Financeiro: não cortar leituras do banco no Financeiro. | Honorários: só ler, sem mexer nas leituras do Financeiro. |
| R7 | Robô da nuvem: o push não basta. É preciso trocar o metadado `robo-versao` da VM `robo-nilma` pelo gcloud, **com o OK do dono**. O robô do PC parou de se atualizar em 12/11/2026: conferir `robo/painelPC` (campo `versao`) no banco. | Seção "Robô e robo-versao" de cada ficha. |
| R8 | Mandei: trava de teste no banco desde 11/11/2026, e o e-mail só vai para o escritório até liberar em `robo/mandei.js` (`LIBERADO_PARA_CLIENTES = false`, linha 12). WhatsApp pelo QR code (Baileys, chip novo) só no robô da nuvem. | Pedidos do Mandei; WhatsApp. |
| R9 | "Voltar" sempre no canto superior esquerdo, na aplicação toda (regra do Vitor). | Toda tela ou janela nova. |
| R10 | Um cliente disse ao dono que a Área "tinha muita informação" (o enxugamento é de 16/11/2026). Cada função nova resolve uma tarefa concreta, sem encher a tela. | O item só aparece quando há o que fazer; nada de cartão fixo novo. |
| R11 | Antes de qualquer commit: `npm run verificar` (tipos, lint, testes, conexoes, `robo:danfse --conferir`, `robo:cartas --conferir`). Pastas soltas como `capturas/` e `perfil-*` quebram o lint. Commit, push, merge e publicação (`npm run sites`) só com autorização explícita do dono. | Critério de aceite de toda ficha. |
| R12 | Não copiar textos, marca nem telas do Acessórias. Usar as ideias de funcionamento com nomes e textos próprios do NADS. | Os rótulos propostos aqui são do NADS; não use "AC Notifica", "Protocolo Digital", "Área VIP", "AC Docs" etc. na tela. |

### 0.2 Como a Área do Cliente funciona hoje (o mínimo para entender as fichas)

- O cliente abre `cliente.nilmacontabilidade.com/cliente/<token>` (token = 40 hexadecimais), **sem login**. O contrato
  dos dados está em `docs/area-do-cliente/contrato.md`.
- O cliente só **lê** o espelho `areasCliente/{token}/...`, que só o robô grava (Admin SDK, lista branca de campos), e
  só **cria** em duas caixas: `areaClienteChamados` (`{ token, chamadoId?, tipo, titulo?, texto, criadoEm }`, tipos
  `admissao|ferias|demissao|duvida|documento|outro`) e `areaClienteEnvios` (`{ token, nome ≤200, tipo
  extrato|nota|comprovante|outro, mime, tamanho, base64 ≤700 KB, criadoEm }`). A regra confere as **chaves exatas**.
- O que o cliente já lê (pelas leituras de `apps/web/src/aplicativos/cliente/dados/areaCliente.firestore.ts`, linhas
  144-163): `resumo/atual`, `resumo/pessoal`, `resumo/faturamento`, `resumo/marca`, `resumo/notas-*`, `resumo/extrato-*`,
  `guias/*` (+ `guias/{id}/pdf/{n}`), `agenda/*`, `envios/*`, `chamados/*` e `documentos/*` (tipos `dp` e `danfe`).
  Portanto **um documento novo em `resumo/<nome>` ou em `documentos/<id>` não precisa de regra nova**. Uma
  subcoleção nova com outro nome precisa ser conferida com o Vitor (a confirmar se a regra é curinga).
- **O robô da Área do Cliente** é `robo/area-cliente.js` (908 linhas) com as regras em `robo/area-cliente-regras.js`.
  Ele roda **no PC do escritório**, dentro do arquivador (`robo/arquivador.js:808`). O robô do PC parou de se atualizar
  em 12/11/2026 (R7).
- **O vigia** (`robo/vigia-robo.js`) roda **na nuvem** (VM `robo-nilma`, `robo/LEIAME.md`). Ele carrega
  `lote-fiscal.js` (linha 1118), `lote-dp.js` (1111), `envios-do-nads.js` (1082), `avisos-vencimento.js` (1043),
  `entrega-pelo-link.js` (1053), `certificados-do-cofre.js` (1060), `regua-cobranca.js` (1214) e `mandei.js` (389).
  Mudou algum desses, então é preciso trocar o `robo-versao` (R7).
- **O core no robô**: o robô não importa TypeScript. As funções do core que ele usa saem do pacote gerado
  `robo/gerado/danfse.js`, montado por `scripts/robo-danfse.mjs` (lista de `export { … } from …`, linhas 27-42). Função
  nova do core usada pelo robô: acrescentar o export nessa lista e rodar `npm run robo:danfse`. O `npm run verificar`
  roda `robo:danfse -- --conferir` e falha se o gerado estiver velho.
- **As travas**: `robo/mandei.js:12`, `robo/cartas-fiscal.js:22` e `robo/boletos-financeiro.js:25` usam
  `LIBERADO_PARA_CLIENTES` + `INTERNOS`. Tudo o que for **mandar e-mail ou WhatsApp a cliente** nasce com a mesma trava
  em `false` e um teste `node robo/teste-<nome>.js` que confere que começa travado (modelo: `robo/teste-mandei.js:32`).
- **A empresa de teste** PERSONALY COMPANY (código 9999, `@nads/core/demo`) mostra sempre os dados de exemplo e não
  grava nada no banco (`areaCliente.firestore.ts:59-68`). **O modo desenvolvedor** recusa gravações
  (`recusarNoModoDev`, linha 27). Toda gravação nova do cliente tem de passar pelo mesmo `addDoc` travado.

### 0.3 Receitas comuns (as fichas apontam para elas)

**Receita A: um dado novo no espelho em `resumo/<nome>` (sem regra nova).**
1. Core: o tipo e a função pura que monta o documento (lista branca) em `packages/core/src/areaCliente/<arquivo>.ts`,
   exportada no `packages/core/src/areaCliente/index.ts`, com teste vitest ao lado (`<arquivo>.test.ts`).
2. Se o robô usa a função: acrescentar em `scripts/robo-danfse.mjs` e rodar `npm run robo:danfse`.
3. Robô (`robo/area-cliente.js`, dentro de `espelhar(token)`, linha 409): montar o documento e gravar com
   `gravar(token, 'resumo/<nome>', doc, '<tipoDaListaBranca>')` (função `gravar`, linha 177, grava só o que mudou pelo
   hash). Sem dado: apagar, como faz com `resumo/marca` (linhas 468-473). Envolver em `try/catch` próprio ("um erro aqui
   não para o resto do espelho", como nas linhas 437 e 465).
4. Robô (`robo/area-cliente-regras.js`): a chave nova em `CAMPOS_DO_ESPELHO` (linha 644), que `conferirListaBranca`
   (linha 699) usa.
5. Site (`apps/web/src/aplicativos/cliente/dados/espelho.ts`): `lerX(x: unknown)` que confere campo a campo e devolve
   `null` quando torto (modelo: `lerFaturamento`, linha 119). Acrescentar o campo em `PartesDoEspelho` (linha 303) e
   preencher em `estadoDoEspelho` (linha 322).
6. Site (`areaCliente.firestore.ts`): um `onSnapshot(doc(espelho, 'resumo', '<nome>'), …)` que **não segura a tela**:
   não entra na condição do `desenhar()` (linha 108). Siga o modelo das DANFEs (linhas 160-163): no erro, põe o valor
   vazio e redesenha.
7. Testes: `espelho.test.ts` (o leitor e o `estadoDoEspelho`) e o teste do core.

**Receita B: um pedido marcado na caixa `areaClienteChamados` (sem regra nova).** É o precedente da DANFE
(`packages/core/src/areaCliente/pedidoDeDanfe.ts`).
1. Core: `TITULO_DO_PEDIDO_DE_<X>`, `pedidoDe<X>(…)` → `{ tipo: 'documento'|'outro', titulo, texto: '<prefixo>:<dado>' }`,
   e `<dado>DoPedidoDe<X>(p)` que reconhece. O título ≤120, o texto ≤4000 e o tipo tem de ser um dos seis. Teste vitest
   como `pedidoDeDanfe.test.ts`.
2. Exportar no `index.ts` do core e em `scripts/robo-danfse.mjs`; rodar `npm run robo:danfse`.
3. Robô: em `tratarChamado` (`robo/area-cliente.js:728`), logo depois da DANFE (linhas 737-738), reconhecer a marca e
   desviar para `tratar<X>(doc, dados, valor)`, que confere o link, aplica **um limite próprio por link por dia** (como
   `LIMITE_DANFES_POR_DIA = 200`, linha 787; senão conta no limite de 20 chamados) e **apaga o pedido**.
4. Site: o método novo no `RepoAreaCliente` (`dados/areaCliente.ts`, linha 136), implementado em
   `areaCliente.firestore.ts` com o `addDoc` travado, em `areaCliente.memoria.ts` (exemplo) e no repasse da empresa de
   teste (linhas 302-314).
5. **Ordem de publicação obrigatória**: primeiro o robô do PC atualizado e conferido, **depois** o site. Um robô
   antigo transforma o pedido num chamado de verdade para a equipe ("Um robô antigo, que não conhece a marca,
   transforma o pedido num chamado").

**Receita C: atualizar os robôs (R7).**
- PC (`area-cliente.js` e o que roda no arquivador): conferir no banco `robo/painelPC`, campo `versao`, antes e
  depois. Em 12/11/2026 o servidor parou de se atualizar. Se continuar parado, **a ficha não pode ir ao ar** (avise o
  dono). O caminho de atualização está em `robo/LEIAME.md` (`schtasks /run /s NILMA-SERVER /tn nads-atualizar-robo`):
  quem roda é o dono.
- Nuvem (o vigia): depois do push no ramo que a VM puxa (`desenvolvimento`, segundo o LEIAME), trocar o metadado
  `robo-versao` da VM `robo-nilma` pelo gcloud, **com o OK do dono**. O modelo não faz push nem gcloud sem
  autorização.

**Receita D: conferir na tela.**
- `npm run dev` sobe o Vite na porta do `apps/web/vite.config.ts` (`server: { port: 5178 }`; se estiver ocupada, use a
  que o Vite mostrar). Dados de exemplo: `http://localhost:5178/cliente/exemplo/<aba>`. As abas (`AreaDoCliente.tsx`,
  linhas 267-274) são `inicio`, `guias`, `documentos`, `dp`, `chamados`, `faturamento`, `empresa` e `contato`.
- O exemplo vem de `apps/web/src/aplicativos/cliente/dados/areaCliente.memoria.ts`, que já preenche certificado,
  ficha, atendimento, avisos e tickets. **Toda ficha nova tem de ter o seu dado de exemplo** nesse arquivo.
- `npm run dev:banco` usa o banco de verdade (com um token real; a empresa 9999 mostra o exemplo).
- Teste em largura de celular (375 px) e confira o "Voltar" no canto superior esquerdo (R9).

**Receita E: antes do commit (R11).** `npm run verificar` limpo. Se `capturas/` ou `.claude/worktrees` existirem no
checkout principal, o lint quebra: não apague nada sem perguntar, avise. Nenhum commit, push, merge ou `npm run sites`
sem o OK explícito do dono.

### 0.4 Mapa: o que virou o quê

| Fonte | id na fonte | Virou a ficha |
|---|---|---|
| lacuna | `guias-completas-na-area` | **todas-as-guias** (a parte "marcar como paga" foi para guia-paga-confirmada e comprovante-da-guia) |
| candidata | `todas-as-guias` | **todas-as-guias** |
| candidata | `guia-paga-confirmada` | **guia-paga-confirmada** |
| candidata | `comprovante-da-guia` | **comprovante-da-guia** |
| lacuna | `comprovante-de-leitura` | **comprovante-de-leitura** |
| lacuna | `lembrete-de-vencimento` | **lembrete-de-vencimento** |
| candidata | `aviso-antes-de-vencer` | **lembrete-de-vencimento** |
| lacuna | `guias-pelo-whatsapp` | **guias-pelo-whatsapp** |
| lacuna | `documentos-do-escritorio-no-acervo` | **documentos-do-escritorio** (o corte de 3 meses do DP foi para informe-e-folha-antiga) |
| candidata | `documentos-do-escritorio` | **documentos-do-escritorio** |
| lacuna | `pedidos-do-escritorio-na-area` | **pedidos-do-mandei** (tickets) + **o-que-falta-mandar** (documentosMensal) |
| candidata | `pedidos-do-mandei` | **pedidos-do-mandei** |
| candidata | `o-que-falta-mandar` | **o-que-falta-mandar** |
| lacuna | `aviso-de-resposta` | **aviso-de-resposta** (parte A só site, fase 1; parte B e-mail, fase 2) |
| lacuna | `comunicados` | **comunicados** |
| lacuna | `certificado-do-cliente` | **certificado-digital** |
| candidata | `certificado-digital` | **certificado-digital** |
| lacuna | `ficha-e-contatos-por-setor` | **dados-cadastrais** |
| candidata | `dados-cadastrais` | **dados-cadastrais** |
| candidata | `certidoes` | **certidoes** |
| candidata | `confirmar-entrega` | **confirmar-entrega** |
| lacuna | `avaliacao-do-atendimento` | **avaliacao-do-atendimento** |
| lacuna | `processos-visiveis` | **processos-visiveis** |
| candidata | `parcelamentos` | **parcelamentos** |
| candidata | `informe-e-folha-antiga` | **informe-e-folha-antiga** |
| candidata | `relatorio-de-impostos` | **relatorio-de-impostos** |
| candidata | `honorarios` | **honorarios** |
| lacuna | `aceite-lgpd` | **aceite-lgpd** |
| lacuna | `contatos-e-permissoes` | **contatos-e-permissoes** |
| candidata | `xmls-do-mes` | **descartado** (R5) |
| lacuna | `tipos-de-pedido-configuraveis` | **descartado** (R5, R10 e regra do banco, ganho baixo) |
| candidata | `previa-do-das` | **fora do plano** (não fere regra; custo-benefício ruim) |

As 9 lacunas do lado do escritório do `03-comparacao.md` (`lista-de-entregas-com-prazos`, `cadastro-de-obrigacoes`,
`tarefas-recorrentes-anuais`, `gestao-de-processos`, `baixa-automatica-pela-pasta`, `indicadores-de-pontualidade`,
`emails-agrupados-e-modelos`, `lucratividade-por-cliente`, `whatsapp-integrado`) não entram aqui: estão no
`05-plano-lado-do-escritorio.md` (tabela "Lacuna do 03 → ficha do 05", seção 3).

### 0.5 As fases num quadro

| Fase | O que é | Fichas (na ordem de fazer) |
|---|---|---|
| **1** | Só o site. Sem regra nova, sem robô, valor alto. Pode ir ao ar sozinha. | 1.1 aviso-de-resposta (parte A) · 1.2 comprovante-da-guia (parte A) |
| **2A** | Robô do PC (`robo/area-cliente.js`), sem regra nova. **Depende de o robô do PC voltar a se atualizar.** | 2A.1 certificado-digital · 2A.2 o-que-falta-mandar · 2A.3 pedidos-do-mandei · 2A.4 documentos-do-escritorio · 2A.5 dados-cadastrais · 2A.6 comprovante-de-leitura · 2A.7 certidoes · 2A.8 confirmar-entrega · 2A.9 comprovante-da-guia (parte B) · 2A.10 avaliacao-do-atendimento · 2A.11 guia-paga-confirmada · 2A.12 parcelamentos · 2A.13 informe-e-folha-antiga · 2A.14 processos-visiveis · 2A.15 relatorio-de-impostos |
| **2B** | Robô da nuvem (o vigia), sem regra nova. Precisa do `robo-versao` e do OK do dono. | 2B.1 todas-as-guias · 2B.2 aviso-de-resposta (parte B) · 2B.3 lembrete-de-vencimento |
| **3** | Precisa de regra nova do banco (o Vitor publica). | 3.1 comunicados · 3.2 aceite-lgpd · 3.3 contatos-e-permissoes |
| **4** | Depende de decisão do dono ou de infraestrutura que não está no ramo principal. | 4.1 guias-pelo-whatsapp · 4.2 honorarios |
| — | Descartados / fora do plano | xmls-do-mes · tipos-de-pedido-configuraveis · previa-do-das |

**Dependências que cruzam fases** (detalhes em cada ficha):
- `lembrete-de-vencimento` depende de `todas-as-guias` (senão só avisa FGTS, DAS e DAE) e de `comprovante-de-leitura`
  (para "só quem não abriu").
- `guia-paga-confirmada` aproveita `comprovante-da-guia` (parte B) e, se feita, alimenta `honorarios` e
  `relatorio-de-impostos`.
- `relatorio-de-impostos` tem um caminho barato se `todas-as-guias` vier antes.
- `parcelamentos` com o PDF depende de `todas-as-guias` (a guia de parcela no lote do Fiscal).
- `o-que-falta-mandar` e `pedidos-do-mandei` dividem o mesmo lugar ("Precisa de você"): decidir com o dono qual fonte
  vale para "o que o escritório pede" antes de fazer as duas.
- `guias-pelo-whatsapp`, a parte WhatsApp de `lembrete-de-vencimento` e a de `aviso-de-resposta` dependem do Baileys
  (`robo/whatsapp.js` e `robo/whatsapp-regras.js`, commits 39c34195 e 3905c19d). Conferido em 17/11/2026: esses commits
  **já estão no `origin/desenvolvimento`** (o ramo que a VM puxa), mas **não** estão no `main` nem neste ramo
  (`mandei-area-cliente`). Se a VM já roda essa versão depende do `robo-versao` (a confirmar).

---

## Fase 1: só o site (sem regra nova, sem robô)

### 1.1 aviso-de-resposta (parte A: o "lido" que não volta a cada visita)

- **id**: `aviso-de-resposta` (parte A; a parte B, o e-mail, está em 2B.2)
- **Tamanho**: pequeno
- **Regras tocadas**: R1, R2 (nenhum Firebase novo), R4, R10

**O que o cliente ganha.** O sino e o menu "Solicitações" mostram "O escritório respondeu" só enquanto ele não viu a
resposta. Abriu, sumiu, e não volta na próxima visita.

**Como é no Acessórias.** Há um contador de interações não vistas nos botões de Solicitações e Comunicados, a
solicitação fica marcada na lista e o robô manda e-mails periódicos com o que o cliente ainda não viu. Fonte:
app.acessorias.com/sysajuda.php?p=81.

**Como está hoje no NADS.**
- `apps/web/src/aplicativos/cliente/dados/regras.ts`, função `notificacoes` (perto da linha 68): gera
  `{ id: 'c-' + c.id + '-' + c.mensagens.length, titulo: 'O escritório respondeu', … }` para cada chamado com
  `situacao === 'respondido'`. É calculado na hora.
- `apps/web/src/aplicativos/cliente/telas/useAreaCliente.ts`, linhas 157-177: `const [lidas, setLidas] =
  useState<Set<string>>(…)`. O "Marcar como lidas" vale **só nesta página**. Recarregou, voltou tudo.
- O id da notificação já muda quando chega mensagem nova (leva `mensagens.length`), então guardar os ids lidos basta.

**Passo a passo.**
1. **Dados (regra pura + localStorage)**: criar `apps/web/src/aplicativos/cliente/dados/sinoLido.ts`, no modelo de
   `dados/tutorialVisto.ts` (chave `'nads-area-cliente|sino'`, `try/catch` em toda leitura e gravação, porque a janela
   anônima ou o bloqueio derrubam o `localStorage`):
   - `lidasDoSino(token: string): Set<string>`;
   - `guardarLidas(token: string, ids: string[]): void`, que guarda no máximo as 200 últimas por token e as 30 últimas
     empresas, como o tutorial;
   - pura e testável: `soAsQueAindaExistem(lidas: Set<string>, avisos: { id: string }[]): string[]` (limpa ids que não
     aparecem mais).
   - Comentário no topo: `// 17/11/2026 (aviso-de-resposta): "Marcar como lidas" valia só na página; ...`. **A frase do
     dono que motivou: a confirmar** (a fonte não traz a frase; pergunte ao dono ou cite o plano).
2. **VM** `telas/useAreaCliente.ts`: o `useState` das `lidas` começa com `lidasDoSino(token)`. O `marcarLidas` grava
   com `guardarLidas`. Um `marcarLida(id)` novo é chamado quando o cliente **abre** o chamado.
3. **VM** `telas/useChamados.ts`: ao abrir um chamado respondido, chamar o `marcarLida('c-' + id + '-' +
   mensagens.length)` que vem pela casca. Hoje `DaCasca` (`telas/useAreaCliente.ts:209`) é
   `Pick<AreaCliente, 'token' | 'area' | 'hoje' | 'irPara' | 'copiar'>` e **não** tem `marcarLida`: acrescente
   `'marcarLida'` nesse `Pick`, devolva `marcarLida` no objeto de `useAreaCliente` e confira onde o `daCasca` é montado em
   `telas/AreaDoCliente.tsx`. Não mexa na tela se der para passar pela casca.
4. **Tela** `telas/Chamados.tsx`: **nada novo**, ou no máximo o ponto que já existir de "novo" na linha (R10). Não pôr
   contador novo no menu se o sino já mostra (a decisão de pôr o número no item "Solicitações" do menu é **a
   confirmar** com o dono, pela queixa de "muita informação").

**Dado e caminho no banco.** Nenhum. Só `localStorage` do aparelho.

**Regra do banco.** Não precisa.

**Robô.** Não precisa.

**Testes vitest.**
- `apps/web/src/aplicativos/cliente/dados/sinoLido.test.ts`: guardar e ler por token; teto de 200 ids e de 30
  empresas; `localStorage` que joga erro (mock) devolve conjunto vazio sem quebrar; `soAsQueAindaExistem`.
- `dados/regras.test.ts`: o id da notificação de chamado muda quando muda o número de mensagens (já é o
  comportamento: um teste que trave isso).

**Como conferir na tela.** `npm run dev` → `http://localhost:5178/cliente/exemplo/inicio`. Abra o sino, "Marcar como
lidas", recarregue: o sino continua sem o ponto. Vá em `http://localhost:5178/cliente/exemplo/chamados`, abra um
chamado respondido, recarregue: ele não aparece mais no sino.

**Critérios de aceite.**
- Recarregar a página não faz voltar o que foi lido.
- Uma resposta nova do escritório no mesmo chamado aparece de novo no sino.
- Em janela anônima a tela funciona (só não lembra).
- `npm run verificar` limpo.

**Riscos e armadilhas (das fontes).** "O lido em localStorage não passa de um aparelho para outro, o que aceita a
ressalva." "Não pode virar chat: o aviso só aponta para a solicitação."

**Dependências.** Nenhuma. A parte B (e-mail) está em 2B.2.

---

### 1.2 comprovante-da-guia (parte A: "Já paguei" na guia, só no site)

- **id**: `comprovante-da-guia` (parte A; a parte B, o robô ligar o arquivo à guia, está em 2A.9)
- **Tamanho**: pequeno (parte A)
- **Regras tocadas**: R1, R2, R10, R12

**O que o cliente ganha.** No "⋯" da guia aparece "Já paguei: mandar o comprovante". Abre a janela de envio com o
tipo **Comprovante** e o nome da guia já preenchidos. Ele só anexa o PDF ou a foto. Depois a linha da guia mostra
"Comprovante enviado em dd/mm".

**Como é no Acessórias.** O cliente anexa o comprovante arrastando o arquivo para o calendário (fonte:
acessorias.movidesk.com/kb/pt-br/article/592543). Outros portais também têm: o Nibo (área Pagamentos), o G-Click e o
Alterdata.

**Como está hoje no NADS.**
- `apps/web/src/aplicativos/cliente/partes/LinhaGuiaDoMes.tsx`, linha 20: `const mais: ItemMenu[] = [ … ]` com "Ver a
  guia", "Baixar a vencida" e "Copiar o código de barras".
- `telas/JanelaDeEnvio.tsx`, linha 8: `useJanelaDeEnvio(props: DaCasca): () => void` abre a janela "Enviar documento".
- `telas/useEnviar.ts`, linha 14: `const [tipo, setTipo] = useState<ac.TipoDeEnvio>('extrato')`, sempre "extrato".
- A caixa `areaClienteEnvios` aceita `nome` de até 200 caracteres e o tipo `comprovante` (`packages/core/src/areaCliente/envios.ts`,
  `TIPOS_DE_ENVIO`, linha 26).
- O recibo do envio volta pelo espelho (`area.envios`, `ReciboDeEnvio` com `nome`, `tipo` e `recebidoEm`).

**Passo a passo.**
1. **Core** (`packages/core/src/areaCliente/envios.ts`, ou um arquivo novo `comprovanteDaGuia.ts` exportado no
   `index.ts`):
   - `prefixoDoComprovante(g: Pick<GuiaDoCliente, 'tipo' | 'competencia'>): string` devolve, por exemplo,
     `'Comprovante FGTS 10-2026 - '` (use o `g.tipo` cru: FGTS, DAS, DAE; "Guia" para `outra`, como o lambda de
     `useAreaCliente.ts:160`. **Não** use `ROTULO_DA_GUIA`, que é longo: `'DAS (Simples Nacional)'`);
   - `comprovanteDaGuia(g, envios: ReciboDeEnvio[]): ReciboDeEnvio | null` acha o recibo mais novo com `tipo ===
     'comprovante'` cujo `nome` começa com o prefixo;
   - `nomeComPrefixo(prefixo, nomeDoArquivo)`: corta para caber em 200 caracteres, preservando a extensão.
2. **VM** `telas/useEnviar.ts`: `useEnviar(props, inicial?: { tipo?: ac.TipoDeEnvio; prefixo?: string })`. O
   `useState` do tipo começa com `inicial?.tipo ?? 'extrato'`. No `enviar`, quando há prefixo, cada arquivo vai como
   `new File([a], nomeComPrefixo(prefixo, a.name), …)` (passe pelo `comMime` que já existe).
3. **VM** `telas/JanelaDeEnvio.tsx`: `useJanelaDeEnvio(props)` devolve `(inicial?) => void` e repassa o `inicial` ao
   `<Enviar>` (hoje `<Enviar {...props} />`, linha 12: acrescente a prop `inicial?` em `telas/Enviar.tsx` e passe-a ao
   `useEnviar(props, inicial)`). O título da janela pode virar "Mandar o comprovante" quando há prefixo. O botão "Voltar" fica como está
   (R9: é janela; confira que o "Voltar" no topo esquerdo continua sendo a regra das telas).
4. **VM** `telas/useGuias.ts`: `pagarComComprovante(g)` chama a janela com `{ tipo: 'comprovante', prefixo:
   prefixoDoComprovante(g) }`. `comprovanteDe(g)` usa `comprovanteDaGuia(g, area.envios)`.
5. **Tela** `partes/LinhaGuiaDoMes.tsx`: um item a mais no array `mais` (não um botão novo na linha, R10): `{ rotulo:
   'Já paguei: mandar o comprovante', icone: 'upload', onClick: () => onComprovante(guia) }`. O componente ganha as
   props novas `onComprovante: (g: ac.GuiaDoCliente) => void` e `comprovanteEm?: string` (hoje a assinatura, linha 12,
   não as tem), passadas por `telas/Guias.tsx` a partir da VM. Quando já há comprovante, a linha de baixo (`cli-gu-sub`,
   linha 33, que **já mostra** a frase de vencimento `quando.texto`) ganha, ao lado dessa frase, " · Comprovante enviado
   em dd/mm" (sem selo novo).
   O texto é do NADS (R12).
6. **CSS**: nenhum, se usar as classes que já existem (`cli-gu-sub`). Se precisar, em `telas/guias.css`.

**Dado e caminho no banco.** Nenhum dado novo. Usa `areaClienteEnvios` (o cliente cria) e `areasCliente/{token}/envios/{id}`
(o recibo, que o robô grava).

**Regra do banco.** Não precisa (o nome livre até 200 cabe). Prender o arquivo à guia por um campo `guiaId` de verdade
exigiria regra nova (ver 3.x, "melhorias com regra", no fim da fase 3).

**Robô.** Não precisa na parte A. Sem a parte B, **o arquivo cai na pasta `ÁREA DO CLIENTE/<MM>` do Drive** e só
aparece como atividade genérica no painel do robô (`painel.atividade('area-cliente', 'Arquivou o que o cliente
mandou — …')`, `robo/area-cliente.js:878`) e na lista de Recebidos do Tarefas, sem ligação com a guia (ver riscos).

**Testes vitest.**
- `packages/core/src/areaCliente/areaCliente.test.ts` (ou o teste do arquivo novo): o prefixo de cada tipo; o corte em
  200 caracteres mantendo a extensão; `comprovanteDaGuia` acha o recibo certo e ignora o de outro mês ou de outro tipo.
- `apps/web/src/aplicativos/cliente/dados/areaCliente.memoria.test.ts`: enviar com prefixo no exemplo gera o recibo com o
  nome prefixado.

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/guias` → "⋯" de uma guia a pagar → "Já paguei:
mandar o comprovante" → a janela abre com "Comprovante" marcado → anexar um PDF pequeno → a linha passa a dizer
"Comprovante enviado em dd/mm". Repita em 375 px.

**Critérios de aceite.**
- O tipo vem marcado e o nome do arquivo sai com o prefixo (≤200 caracteres).
- Envio pelo topo ("Enviar documento") continua começando em "extrato".
- Nenhum botão novo na linha da guia; só um item no "⋯".
- `npm run verificar` limpo.

**Riscos e armadilhas (das fontes).** A ficha da candidata afirmava que "o robô liga o arquivo à guia pelo nome", e
isso é **falso**: o `tratarEnvio` (`robo/area-cliente.js`, linhas 844-882) só salva em `<ano>/<cód>/ÁREA DO
CLIENTE/<MM>`, registra em `areaClienteRecebidos` e devolve o recibo. Ele não chama o `parcela-paga.js` (que é usado
por `envios-do-portal.js`, `download-attachments.js` e `avisos-atrasados.js`, não pela Área do Cliente) nem casa nada com a guia. "Sem a parte do robô, o 'alimenta a confirmação' não acontece: o
arquivo cai numa pasta que ninguém olha. Depois de enviar, a guia continua 'a pagar' ou 'vencida' na tela, e só um selo
calculado do lado do cliente resolve isso." **Não mude a situação da guia para "paga"** só porque o cliente mandou o
comprovante: o texto é "Comprovante enviado", não "Paga".

**Dependências.** Nenhuma para a parte A. A parte B (2A.9) depende do robô do PC.

---

## Fase 2A: robô do PC (`robo/area-cliente.js`), sem regra nova

**Porta de entrada da fase 2A (bloqueante).** Todas as fichas desta fase mudam `robo/area-cliente.js` e/ou
`robo/area-cliente-regras.js`, que rodam no arquivador do PC. Antes de começar a primeira, confira no banco o documento
`robo/painelPC` (campo `versao`) e compare com o último commit do ramo que o PC puxa. Em 12/11/2026 o servidor parou de se
atualizar. **Se continuar parado, nenhuma ficha da fase 2A vai ao ar**: escreva o código e os testes, mas não publique
o site antes de o robô do PC estar com a versão nova (Receita C). Avise o dono.

Teste do robô (fora do vitest): `node robo/teste-area-cliente.js`. Acrescente casos lá para cada mudança nas regras
do robô (`area-cliente-regras.js`).

### 2A.1 certificado-digital

- **id**: `certificado-digital` (junta a lacuna `certificado-do-cliente`)
- **Tamanho**: pequeno
- **Regras tocadas**: R1, R2, R5 (nada cifrado nem CPF), R7 (robô do PC), R10

**O que o cliente ganha.** Fica sabendo que o certificado A1 da empresa vai vencer e pede a renovação com um toque: a
solicitação "Renovação do certificado digital" já abre pronta. Certificado vencido trava a emissão de nota e as
entregas.

**Como é no Acessórias.** Há uma régua de e-mails N dias antes do vencimento, com link de renovação da certificadora
parceira. Fonte: acessorias.movidesk.com/kb/pt-br/article/585261.

**Como está hoje no NADS.** A tela está toda pronta e o banco nunca a preenche:
- tipo `CertificadoDigital { tipo: 'A1'|'A3'; titular; validoAte 'aaaa-mm-dd' }` em
  `apps/web/src/aplicativos/cliente/dados/areaCliente.ts:36`;
- `situacaoDoCertificado` e o sino em `dados/regras.ts` (função `notificacoes`);
- o item "Certificado digital vence em…" com "Pedir renovação" em `dados/visaoGeral.ts:102-106`;
- a ação em `telas/useInicio.ts:45`: `irPara('chamados', { novoChamado: { tipo: 'documento', titulo: 'Renovação do
  certificado digital' } })`;
- mas `estadoDoEspelho` (`dados/espelho.ts:322`) nunca preenche `certificado`: fica o `null` de `AREA_VAZIA`.
- Hoje só a equipe é avisada: `robo/certificados-do-cofre.js` (admin, celular e e-mail, marcos 30/15/7/3/0 dias, lendo
  `cofre/{empresa}` com `temCertificado` e `validade` às claras, linha 31) e `robo/papeis-vencendo.js`
  (`clientes.papeis`).

**Passo a passo** (Receita A).
1. **Core**: em `packages/core/src/areaCliente/` (arquivo novo `certificado.ts`, exportado no `index.ts`):
   `certificadoDoLink(docsDoCofre: { codigo: number|null; empresa: string; validade: string; temCertificado: boolean;
   tipo?: string }[], empresas: { codigo: number; nome: string }[]): { tipo: 'A1'; titular: string; validoAte: string }
   | null`. Casa pelo `codigo` (que pode ser `null`; aí casa pela razão social normalizada). Ignora `tipo === 'gov'`.
   Num link de várias empresas, escolhe **o que vence primeiro** (decisão das fontes; a outra opção, "o da empresa
   ativa", é **a confirmar**). O `titular` é a **razão social do cadastro**, nunca o titular do cofre (cifrado, com
   CPF/CNPJ). Exportar em `scripts/robo-danfse.mjs` e rodar `npm run robo:danfse`.
2. **Robô** `robo/area-cliente.js`: ler `cofre` com `where('temCertificado', '==', true)` uma vez e guardar por algumas
   horas (como `CLIENTES_VALEM_MS`, linha 43). Em `espelhar(token)` (linha 409), depois da logo (linha 473):
   `gravar(token, 'resumo/certificado', { ...cert, atualizadoEm: agora }, 'certificado')`; sem certificado, apagar
   como a marca.
3. **Robô** `robo/area-cliente-regras.js`: `certificado: ['tipo', 'titular', 'validoAte', 'atualizadoEm']` em
   `CAMPOS_DO_ESPELHO` (linha 644).
4. **Site** `dados/espelho.ts`: `lerCertificado(x): CertificadoDigital | null` (data `aaaa-mm-dd` válida, tipo
   `A1`/`A3`, titular texto). Campo `certificado?: CertificadoDigital | null` em `PartesDoEspelho`; em
   `estadoDoEspelho`, `certificado: p.certificado ?? null`.
5. **Site** `dados/areaCliente.firestore.ts`: `onSnapshot(doc(espelho, 'resumo', 'certificado'), …)` fora da condição
   do `desenhar()`.
6. **Tela**: nada. Só conferir: o sino manda para a aba `'guias'` (`regras.ts`), "o que é estranho". Trocar o `ir`
   da notificação do certificado para `'chamados'` é **a confirmar** com o dono (mudança pequena em `regras.ts`, com
   teste).

**Dado e caminho no banco.** Lê `cofre/{empresa}` (interno, Admin SDK). Grava `areasCliente/{token}/resumo/certificado
{ tipo: 'A1', titular: <razão social>, validoAte: 'aaaa-mm-dd', atualizadoEm }`.

**Regra do banco.** Não precisa (`resumo/*` já é lido pelo cliente). Se o Vitor disser que a regra não é curinga em
`resumo`, vira pedido a ele.

**Robô e robo-versao.** Só o robô do PC (`area-cliente.js`). Não mexe no vigia, então não precisa de `robo-versao`. O
e-mail ao cliente (um marco a mais no `certificados-do-cofre.js`, que é da nuvem) **fica fora** desta ficha. Se o dono
quiser, vira uma ficha nova com trava de teste e `robo-versao`.

**Testes.**
- vitest `packages/core/src/areaCliente/certificado.test.ts`: casa por código; casa pela razão social quando o código é
  `null`; ignora `gov`; com duas empresas, pega a que vence primeiro; nunca devolve o titular do cofre.
- vitest `apps/web/src/aplicativos/cliente/dados/espelho.test.ts`: `lerCertificado` recusa data torta e tipo estranho;
  `estadoDoEspelho` com e sem certificado.
- `node robo/teste-area-cliente.js`: a lista branca `certificado` corta campo a mais.

**Como conferir na tela.** No exemplo, o certificado vence em 25 dias (`areaCliente.memoria.ts:106`):
`http://localhost:5178/cliente/exemplo/inicio` mostra o item no "Precisa de você", e "Pedir renovação" abre a
solicitação pronta. No banco (`npm run dev:banco`), com um link de empresa que tem A1 no cofre, depois de o robô
gravar.

**Critérios de aceite.** O cartão e o sino aparecem para quem tem A1 no cofre; quem não tem não vê nada (e a tela não
dá a entender "tudo em ordem"); nenhum dado do `.pfx`, senha ou titular cifrado no espelho.

**Riscos e armadilhas (das fontes).** "Nunca levar o .pfx nem a senha, só a validade." "O cofre guarda o .pfx, então
só aparece o A1 que alguém subiu no cofre. Cliente com A3, ou com certificado fora do cofre, fica sem aviso, e a tela
não deve dar a entender 'tudo em ordem'." "O EstadoDaArea.certificado é um só por link: num link de grupo é preciso
escolher." "O titular do cofre está cifrado e traz CPF/CNPJ, então não usar." "O sino manda para a aba 'guias', o que é
estranho." "Depende de atualizar o robô do PC." A candidata `certidoes` lembra que `clientes.papeis` também guarda o
certificado: é uma segunda fonte possível (a confirmar qual vale quando as duas existem; sugestão: o cofre).

**Dependências.** Porta de entrada da fase 2A.

---

### 2A.2 o-que-falta-mandar (com a correção do envio que não baixa a pendência)

- **id**: `o-que-falta-mandar` (junta a metade "documentosMensal" da lacuna `pedidos-do-escritorio-na-area`)
- **Tamanho**: grande no todo; o passo 1 (correção) é pequeno e deve ir primeiro
- **Regras tocadas**: R1, R2, R3 (só nas melhorias opcionais), R7, R10

**O que o cliente ganha.** Uma lista curta, no "Precisa de você", do que o escritório espera neste mês (por exemplo,
"extrato do Sicoob de outubro"), cada item com "Enviar", que já abre o envio certo. Mandou, o item some, e a cobrança
por e-mail para de chegar.

**Como é no Acessórias.** Uma matriz mensal de documentos (extratos, notas) com dia-limite, régua de e-mails antes e
depois do prazo, envio pelo app e situação Pendente/Parcial/Vencido/Recebido/Validado. Fontes:
acessorias.movidesk.com/kb/pt-br/article/586805 ; .../599111. Também no G-Click (Assistente de documentos), no Onvio,
no Nibo, no Karbon, no SmartVault e no Content Snare (recusa com motivo).

**Como está hoje no NADS.**
- A matriz mensal existe do lado do escritório: a tela Pendências, coleção `documentosMensal/{clienteId}_{AAAA-MM}`, e a
  régua `robo/regua-cobranca.js` (1ª/2ª/3ª cobrança, `MAX_POR_DIA = 40`, **vem desligada**; liga em Robôs › Ajustes,
  grupo `cobranca` de `packages/core/src/robos/ajustes.ts:29`). `faltandoDo(cliente, doc)` (linha 70) já é exportado e
  respeita `documentosNaoAplicaveis`, `semMovimento` e `extratoIncompleto`.
- A Área já tem o caminho na tela: o aviso com `ir: 'documentos'` vira a ação `{ tipo: 'enviar' }`
  (`dados/visaoGeral.ts:110`), e `EstadoDaArea.avisos` existe (`areaCliente.ts:123`), mas o banco não preenche.
- **Defeito de hoje**: o envio pela Área do Cliente **não** marca `documentosMensal`. O `tratarEnvio`
  (`robo/area-cliente.js:844-882`) só salva no Drive e registra em `areaClienteRecebidos`. O portal antigo marcava
  (`robo/envios-do-portal.js`, linhas 98-102, origem `'link'` na linha 101).

**Passo a passo.**
1. **Correção primeiro (pequena).** Core: `packages/core/src/areaCliente/envios.ts`, função pura
   `competenciaDoEnvio(tipo, recebidoEm: Date, nome: string): string | null`. Para `extrato`: o mês **anterior** ao
   recebimento, a não ser que o nome traga `MM-AAAA` ou `MM/AAAA` (aí vale o nome). Para os outros tipos, `null` (não
   marca). Exportar em `scripts/robo-danfse.mjs`. Robô: no `tratarEnvio`, depois de gravar o recibo, se
   `competenciaDoEnvio` devolver um mês e a empresa tiver `clienteId` (o `clientesDoEntregas`, linha 133, pelo
   `codigoOrigem`), fazer `set` com `merge` em `documentosMensal/{clienteId}_{competencia}` marcando o item do tipo como
   recebido, **com `origem: 'areaCliente'`**, no mesmo formato que o `envios-do-portal.js` usa (linhas 98-102):
   `{ clienteId, clienteNome, competencia, atualizadoEm, [tipo]: true, detalhes: { [tipo]: { origem, em, arquivos: [arquivo] } } }`
   com `{ merge: true }` (o arquivo tem bytes que o grep trata como binário, use `grep -a`). Erro aqui não pode
   impedir o recibo.
2. **Core**: `packages/core/src/areaCliente/pendencias.ts` (novo): `pendenciasDoMes(faltando: string[], competencia:
   string): { id: string; titulo: string; tipo: 'extrato'|'nota'|'comprovante'|'outro'; competencia: string }[]`. Os
   títulos são do NADS (ex.: "Extrato do Sicoob de outubro"). Sem quem cobrou nem quando.
3. **Robô** `area-cliente.js`, em `espelhar`: para cada empresa do link com `clienteId`, ler
   `documentosMensal/{clienteId}_{competênciaAnterior}`, aplicar o `faltandoDo` de `regua-cobranca.js` e o
   `pendenciasDoMes`, e gravar `resumo/pendencias { itens: [...], competencia, atualizadoEm }`. Sem nada faltando,
   apagar. Lista branca nova `pendencias` e `itemPendencia` em `CAMPOS_DO_ESPELHO`.
4. **Site** `dados/espelho.ts`: `lerPendencias(x)` devolve `AvisoDoEscritorio[]` (`{ id, titulo, texto, ir:
   'documentos' }`; o texto diz o mês). Preencher `avisos` em `estadoDoEspelho` (hoje fica `[]`).
5. **Site** `dados/areaCliente.firestore.ts`: `onSnapshot` de `resumo/pendencias` que não segura a tela.
6. **VM/Tela**: nada novo: `pendenciasDoCliente` (`visaoGeral.ts:68`) já põe os avisos no "Precisa de você" com
   "Enviar agora". Melhoria opcional: a ação `enviar` passar `{ tipo }` à janela (o `inicial` da ficha 1.2), para o
   extrato já vir marcado.

**Dado e caminho no banco.** Lê `documentosMensal/{clienteId}_{AAAA-MM}` (interno). Grava `documentosMensal` (só os
itens e a origem, com `merge`) e `areasCliente/{token}/resumo/pendencias`.

**Regra do banco.** Não precisa para o básico. **Melhorias que precisariam (fase 3, opcional):** um campo
`competencia` (e/ou `pendenciaId`) na caixa `areaClienteEnvios`, para prender o envio ao item sem chute. Texto
proposto (acrescentar às chaves aceitas da regra que já existe; a regra atual não está neste repositório, **o Vitor
adapta**):

    // areaClienteEnvios: aceitar também, opcional, a competência que o cliente escolheu (17/11/2026, o-que-falta-mandar)
    && (!('competencia' in request.resource.data)
        || (request.resource.data.competencia is string
            && request.resource.data.competencia.matches('^20[0-9]{2}-(0[1-9]|1[0-2])$')))

e acrescentar `'competencia'` na lista do `keys().hasOnly([...])` dessa caixa.

**Robô e robo-versao.** Só o robô do PC. Ligar a régua de cobrança (`regua-cobranca.js`, na nuvem) **não** faz parte
desta ficha: é decisão do escritório pela tela Robôs › Ajustes.

**Testes.**
- vitest core: `competenciaDoEnvio` (extrato sem mês no nome → mês anterior; com `10-2026` no nome → outubro; nota →
  `null`); `pendenciasDoMes` (títulos, ids estáveis).
- vitest `espelho.test.ts`: `lerPendencias` e os avisos no `estadoDoEspelho`.
- vitest `visaoGeral.test.ts`: o aviso vira "Enviar agora".
- `node robo/teste-area-cliente.js`: a lista branca.

**Como conferir na tela.** O exemplo já tem avisos (`areaCliente.memoria.ts:122`):
`http://localhost:5178/cliente/exemplo/inicio`. No banco: um cliente com extrato faltando em Pendências → o item
aparece na Área → mandar o extrato pela Área → o item some e Pendências (no Tarefas) mostra recebido com origem Área
do Cliente.

**Critérios de aceite.** O extrato mandado pela Área baixa a pendência; a régua não cobra mais quem já mandou; o item
só aparece quando há o que mandar (R10).

**Riscos e armadilhas (das fontes).** "Uma lacuna que já existe hoje: o envio pela Área do Cliente NÃO marca
documentosMensal. O cliente que manda o extrato por ali continua 'pendente' na tela de Pendências e continua sendo
cobrado pela régua. Vale corrigir antes de tudo." "A caixa areaClienteEnvios não tem campo de competência, então
'casar pelo mês' é chute (o extrato mandado em novembro costuma ser de outubro). Um campo de verdade exige regra nova
(Vitor)." "A regra só aceita os tipos extrato, nota, comprovante e outro. 'Aplicação', que está no documentosMensal,
não tem tipo: iria como 'outro', ou precisaria de regra nova." "A 'recusa com motivo' não tem onde nascer: falta campo e
tela no lado do escritório … Só isso já é médio." (fica fora desta ficha). "A ideia se sobrepõe aos tickets do Mandei
… É preciso decidir qual dos dois fica." "Ligar a régua manda e-mail de verdade para todos os clientes com e-mail no
cadastro. Duas fontes de 'pendência' (Pendências antiga e Mandei) podem cobrar em duplicidade; decidir qual vale."
"Depende de atualizar o robô do PC." Extrato de conta com vários bancos: marcar só o banco certo é **a confirmar**
(veja como o `envios-do-portal.js` faz).

**Dependências.** Porta da fase 2A. Decisão com o dono sobre Pendências x Mandei (ver 2A.3).

---

### 2A.3 pedidos-do-mandei

- **id**: `pedidos-do-mandei` (junta a metade "tickets" da lacuna `pedidos-do-escritorio-na-area`)
- **Tamanho**: pequeno
- **Regras tocadas**: R1, R2, R5, R7, R8, R10

**O que o cliente ganha.** Os pedidos que o escritório abriu pelo Mandei aparecem no "Precisa de você" com o assunto e
o prazo, e um botão "Responder" (ou "Continuar") que abre o formulário do pedido.

**Como é no Acessórias.** As solicitações do escritório ao cliente aparecem na área do cliente (lacuna). Também no
Onvio (Comunicações).

**Como está hoje no NADS.**
- Tudo pronto na tela, só no exemplo: `EstadoDaArea.tickets: mandei.TicketNaArea[]` (`areaCliente.ts:128`),
  `pendenciasDoCliente` põe os tickets com "Responder"/"Continuar" (`visaoGeral.ts:71-80`), `useInicio.ts:49` faz
  `navegar('/mandei/' + encodeURIComponent(a.codigo))`. O core tem `ticketsDaArea(tickets, codigos, agora)` e
  `TicketNaArea` (`packages/core/src/mandei/index.ts:394-417`). O exemplo usa isso (`areaCliente.memoria.ts:400`).
- O robô não espelha `tickets/`. A trava do Mandei está fechada (`robo/mandei.js:12`, R8): nenhum ticket real vai a
  cliente, então a lista fica vazia no banco até liberar.
- **Rota**: a fonte apontava que, no site do cliente, `/mandei` caía no redirecionamento. **Neste checkout (ramo
  `mandei-area-cliente`)** `apps/web/src/rotasDoCliente.tsx` já inclui `...rotasMandei` ("o Responder da Visão geral
  abre o ticket aqui mesmo"). Confira no ramo onde for implementar; se faltar, é o primeiro passo.

**Passo a passo** (Receita A).
1. **Core**: nada novo (`ticketsDaArea` existe). Exportar `ticketsDaArea` em `scripts/robo-danfse.mjs` e rodar
   `npm run robo:danfse`. Se o robô precisar de outra função do Mandei (`situacaoDoTicket`, `linkAtual`), vão junto
   pelo mesmo import.
2. **Robô** `area-cliente.js`: ouvir `tickets` (Admin SDK) só dos tickets não resolvidos (filtro **a confirmar** pelos
   campos reais do `Ticket`), guardar em memória e, em `espelhar(token)`, gravar `resumo/tickets { tickets:
   ticketsDaArea(...), atualizadoEm }`. Recalcula na volta de 30 min, porque a situação muda com o prazo do link.
   Lista branca: `tickets: ['tickets', 'atualizadoEm']` e `ticketNaArea: ['codigo', 'numero', 'assunto', 'validoAte',
   'total', 'faltam', 'refazer']`.
3. **Filtro de privacidade (R5, das fontes)**: não espelhar tickets do DP com assunto sensível, ou só os "da empresa".
   A regra exata é **a confirmar** com o dono. Sugestão: só os tickets cujo `para` é o e-mail do cadastro da empresa.
4. **Site** `dados/espelho.ts`: `lerTickets(x): mandei.TicketNaArea[]`; `PartesDoEspelho.tickets?`;
   `estadoDoEspelho` preenche `tickets`.
5. **Site** `areaCliente.firestore.ts`: `onSnapshot` de `resumo/tickets` que não segura a tela.
6. **Rota**: confirmar `rotasDoCliente.tsx` com `rotasMandei`; o "Voltar" do formulário do Mandei leva de volta à Área
   (canto superior esquerdo, R9; **a confirmar** se o formulário já tem).

**Dado e caminho no banco.** Lê `tickets/{id}` (interno). Grava `areasCliente/{token}/resumo/tickets`.

**Regra do banco.** Não precisa.

**Robô e robo-versao.** Robô do PC. A trava do Mandei (`robo/mandei.js`, nuvem) **continua fechada**. Liberar
(`LIBERADO_PARA_CLIENTES = true`) é decisão do escritório e exige `robo-versao` (R7, R8).

**Testes.**
- vitest `espelho.test.ts`: `lerTickets` recusa ticket torto; o estado preenche `tickets`.
- vitest `visaoGeral.test.ts`: já cobre o ticket no "Precisa de você" (conferir que continua passando).
- `node robo/teste-area-cliente.js`: a lista branca do ticket.

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/inicio`: os tickets do exemplo no "Precisa de
você" → "Responder" abre `http://localhost:5178/mandei/<código>` no mesmo site. No banco, com a trava fechada, só um
ticket de teste para o próprio escritório aparece.

**Critérios de aceite.** O ticket aberto aparece; respondido, resolvido ou vencido some (o 2º link aparece); "Responder"
abre o formulário sem cair na raiz.

**Riscos e armadilhas (das fontes).** "Com a trava (LIBERADO_PARA_CLIENTES = false em robo/mandei.js) nenhum ticket
real vai a cliente, então a função fica vazia até liberar." "O código do ticket dá acesso ao formulário inteiro
(respostas e arquivos), e o link da Área pode ser aberto por outras pessoas da empresa além do destinatário 'para' do
ticket. Vale filtrar assuntos sensíveis do DP ou mostrar só os tickets 'da empresa'." O defeito da rota ("no build do
site do cliente … a rota /mandei não existe") já está corrigido neste ramo; confira.

**Dependências.** Porta da fase 2A. Decidir com o dono a convivência com 2A.2 (as duas aparecem no mesmo cartão; a
sugestão é manter as duas, porque uma é o mês e a outra é o pedido avulso, mas **a confirmar**).

---

### 2A.4 documentos-do-escritorio

- **id**: `documentos-do-escritorio` (junta a lacuna `documentos-do-escritorio-no-acervo`)
- **Tamanho**: grande (médio se começar só com o que o escritório marca à mão)
- **Regras tocadas**: R1, R2, R5, R7, R10

**O que o cliente ganha.** A pasta "Do escritório" da Central de documentos passa a existir no banco: contrato social,
alteração, alvará, balancete e carta de balanço, com o selo "Novo" até baixar. O cliente pega sozinho quando o banco ou
um fornecedor pede.

**Como é no Acessórias.** Um GED do cliente com cópia de tudo o que foi entregue e o acervo permanente da empresa
(contrato social), com busca por nome. Fontes: app.acessorias.com/sysajuda.php?p=229 ;
acessorias.com/site/funcionalidade/gestao-eletronica-de-documentos/.

**Como está hoje no NADS.**
- A Central sabe desenhar "Do escritório" (`DocumentoDoCliente` em `areaCliente.ts:17`, `dados/biblioteca.ts`,
  `telas/useDocumentos.ts`), com pastas, busca e `.zip`.
- `SECOES_DO_BANCO = { documentos: false, dp: true, pagas: false }` (`areaCliente.ts:88`) é uma constante no código.
- `baixarDocumento` devolve `null` no banco (`areaCliente.firestore.ts:223`).
- O caminho dos bytes já existe: o robô espelha os documentos do DP em `documentos/{id}` (tipo `dp`) com os pedaços em
  `documentos/{id}~{n}` (campo `de`), e as DANFEs usam o mesmo esquema. `baixarDocumentoDp` (`areaCliente.firestore.ts:282`)
  é o modelo do download.

**Passo a passo.**
1. **Decisão antes de codar (das fontes)**: "O mais seguro é o escritório marcar à mão 'Mandar para a Área do Cliente'."
   Proposta: no Tarefas, um botão "Mandar para a Área do Cliente" na lista de arquivos do cliente (onde fica é **a
   confirmar** com o dono), que grava um pedido interno, e o robô do PC copia o arquivo. A outra via (o robô escolher
   sozinho pelas pastas `SOCIETÁRIO\DOCUMENTOS CONSTITUTIVOS`, `SOCIETÁRIO\ALVARÁS`, `CONTÁBIL\REGISTRO DE LIVROS`)
   fica para depois.
2. **Core** `packages/core/src/areaCliente/documentos.ts` (novo): `documentoDoEscritorio(...)` com a lista branca
   `{ tipo: 'escritorio', id, nome, area: 'fiscal'|'dp'|'contabil'|'societario', descricao, competencia, enviadoEm,
   tamanho, partes }` e `idDoDocumento(...)`. Exportar no core e em `scripts/robo-danfse.mjs`.
3. **Equipe (Tarefas)**: a coleção interna dos pedidos de publicação. **Isto precisa de regra nova** se for uma
   coleção nova gravada pela equipe (ver texto abaixo). Sem regra nova, a alternativa é o robô ler uma pasta fixa do
   Drive do cliente, por exemplo `<ano>\<cód> - nome\ÁREA DO CLIENTE\DO ESCRITÓRIO\` (o nome da pasta é **a
   confirmar**), onde a equipe solta o arquivo à mão. **Recomendado para a fase 2A: a pasta fixa** (sem regra).
4. **Robô** `area-cliente.js`: em `espelhar`, listar a pasta fixa de cada empresa do link (o robô do PC já lê o `G:`;
   `pastaDoCliente`, linha 58), e para cada arquivo novo ou mudado gravar os pedaços `documentos/{id}~{n}` (`pedacoDp`)
   e depois o `documentos/{id}` (lista branca nova `documentoEscritorio`). Arquivo que sumiu da pasta: apagar do espelho
   (com os pedaços). Teto de tamanho por arquivo, como `MAIOR_ARQUIVO_DP = 5 MB` (linha 48).
5. **Site** `dados/espelho.ts`: `lerDocumentoDoEscritorio(id, x): DocumentoDoCliente | null`.
6. **Site** `areaCliente.firestore.ts`: `onSnapshot(query(collection(espelho, 'documentos'), where('tipo', '==',
   'escritorio')), …)`; `baixarDocumento(token, id)` igual ao `baixarDocumentoDp`.
7. **Site** `areaCliente.ts`: `SECOES_DO_BANCO.documentos` deixa de ser `false` fixo. Proposta: o `estadoDoEspelho`
   calcula `secoes.documentos = documentos.length > 0` (assim a Central não aparece vazia; R10).
8. **"Novo" até baixar**: guardar no `localStorage` (como a ficha 1.1), porque o cliente não grava "baixado" no banco.
   O id do documento vai num conjunto `'nads-area-cliente|baixados'` por token.

**Dado e caminho no banco.** Grava `areasCliente/{token}/documentos/{id}` (tipo `escritorio`) e
`documentos/{id}~{n}`. O cliente já lê `documentos/*`.

**Regra do banco.** Não precisa com a pasta fixa. Se o dono preferir o botão no Tarefas com coleção interna nova,
texto proposto (o Vitor publica):

    // 17/11/2026 (documentos-do-escritorio): a equipe pede para publicar um arquivo do Drive na Área do Cliente
    match /areaClientePublicar/{id} {
      allow read: if membroNoNads();
      allow create: if membroNoNads()
        && request.resource.data.keys().hasOnly(['codigo', 'arquivoDrive', 'nome', 'area', 'descricao', 'competencia', 'por', 'criadoEm'])
        && request.resource.data.codigo is int
        && request.resource.data.arquivoDrive is string && request.resource.data.arquivoDrive.size() <= 200
        && request.resource.data.nome is string && request.resource.data.nome.size() <= 200
        && request.resource.data.area in ['fiscal', 'dp', 'contabil', 'societario']
        && request.resource.data.por is string && request.resource.data.por.size() <= 120;
      allow delete: if membroNoNads();
    }

**Robô e robo-versao.** Robô do PC. A carta de balanço é feita no robô da **nuvem** (`cartas-fiscal.js`, trava
`LIBERADO_PARA_CLIENTES = false`, linha 22): fica fora desta ficha. O balancete em PDF pede roteiro novo no robô do
Alterdata (`alterdata_balancete.py` sai em `.xlsx`): fora.

**Testes.**
- vitest core: a lista branca do documento; o id estável pelo nome e pela empresa.
- vitest `espelho.test.ts`: `lerDocumentoDoEscritorio`; `secoes.documentos` liga só com documento.
- vitest `biblioteca.test.ts`: a pasta "Do escritório" com documentos do banco.
- `node robo/teste-area-cliente.js`: a lista branca e o teto de tamanho.

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/documentos` (o exemplo tem `TODAS_AS_SECOES`). No
banco, soltar um PDF na pasta fixa de uma empresa de teste e esperar a volta do robô (ou mudar o link para forçar).

**Critérios de aceite.** Só aparece o que a equipe pôs na pasta; o download abre o PDF inteiro; a Central não aparece
quando não há documento; nada de holerite ou documento com CPF completo de funcionário nessa pasta.

**Riscos e armadilhas (das fontes).** "Publicar automático o que o arquivador classificou é perigoso: um documento mal
identificado (cliente ou tipo errado) vai parar no portal de outra empresa." "O tamanho do espelho: os bytes ficam em
base64 no Firestore, e o acervo permanente aumenta as gravações e o armazenamento. A saída é trazer sob pedido (como a
DANFE) em vez de espelhar tudo." "Escolher as pastas com cuidado, porque a pasta do cliente no Drive tem coisa interna e
documentos de funcionários. Holerites e documentos com CPF completo de funcionário não podem ir para a pasta do
escritório." "O contrato social traz CPF e endereço dos sócios: não é restrição do dono, mas convém confirmar." "A carta
de balanço está atrás de trava." "Muitos PDFs grandes em pedaços enchem o banco." O selo "Novo" pede guardar o
"baixado": "ou fica só no navegador (localStorage), ou vira pedido marcado na caixa, ou pede regra nova".

**Dependências.** Porta da fase 2A. Decisão "pasta fixa x botão no Tarefas".

---

### 2A.5 dados-cadastrais

- **id**: `dados-cadastrais` (junta a lacuna `ficha-e-contatos-por-setor`)
- **Tamanho**: médio (pequeno sem o aviso da Receita)
- **Regras tocadas**: R1, R2, R5 (sem CPF de sócio), R7, R10

**O que o cliente ganha.** A aba "Dados da empresa" (rota `empresa`) com CNPJ, razão social, CNAE, endereço e sócios, e
o "Copiar todos os dados" para preencher cadastro em banco ou fornecedor. A aba "Contato" passa a mostrar o contato de
cada setor do escritório.

**Como é no Acessórias.** A home do cliente tem links personalizados (WhatsApp, redes sociais), por empresa ou para
todas. Fontes: app.acessorias.com/sysajuda.php?p=63 ; .../p=283. (A ficha cadastral para o cliente copiar vem dos
outros portais.)

**Como está hoje no NADS.**
- Telas prontas: `telas/Administrativo.tsx` (`Empresa`, linha 132; `Contato`, linha 193) e
  `telas/useAdministrativo.ts` (`useEmpresa`, linha 19, lê `area.ficha`; `useContato`, linha 48, lê `setores`).
- Tipos: `FichaDaEmpresa` (`areaCliente.ts:39`, `socios: { nome; participacao }[]`) e `Atendimento`
  (`areaCliente.ts:54`).
- O espelho não preenche `ficha` nem `atendimento.setores` (null/vazio). O robô só manda `escritorio { whatsapp, email }`
  pela constante `ESCRITORIO` (`robo/area-cliente.js:36`).
- A fonte: `robo/vigia-cnpj.js` grava `clientes.receita` toda semana (já descarta o CPF mascarado). O regime e a
  inscrição estadual vêm do cadastro do nads (`packages/core/src/empresas/cadastro/entregas.ts`). A inscrição
  municipal **não existe** no cadastro.

**Passo a passo** (Receita A).
1. **Core** `packages/core/src/areaCliente/ficha.ts` (novo): `fichaDoCliente(receita, cadastro): FichaDoEspelho | null`
   com **lista branca rígida**: razão social, nome fantasia, CNPJ **da própria empresa**, regime, IE, CNAE com
   descrição, abertura, endereço (sem CEP, se a fonte não trouxer) e sócios **só com o nome**. Nunca CPF de sócio.
   Mover o tipo `FichaDaEmpresa` para o core (hoje está em `areaCliente.ts` da tela) e deixar `participacao` e
   `inscricaoMunicipal` **opcionais**. Exportar em `scripts/robo-danfse.mjs`.
2. **Core**: `setoresDoEscritorio(config)` lê o config dos setores.
3. **Equipe**: os setores (nome, e-mail, WhatsApp) e o horário ficam num config editável. Proposta sem regra nova: as
   constantes no robô (como `ESCRITORIO`), com os números que o dono passar (**a confirmar**: os números dos setores;
   13/11/2026, "colocar número dos setores do WhatsApp", comentário em `areaCliente.ts:57`). Um `config/areaCliente`
   editável pelo Tarefas é melhor, mas **a confirmar** se a regra do `config/*` já deixa a equipe gravar (se não,
   regra nova).
4. **Robô** `area-cliente.js`: ler `clientes.receita` pela empresa do link (o `clientesDoEntregas` já traz o cliente
   do Entregas) e gravar `resumo/ficha`. Os setores vão em `resumo/atual.escritorio` (ampliar a lista branca
   `escritorio`, linha 647, com `setores` e `horario`) ou em `resumo/atendimento` (**escolha**: `resumo/atendimento`,
   para não mexer no resumo que segura a tela).
5. **Site** `dados/espelho.ts`: `lerFicha(x)` e `lerAtendimento(x)`; preencher `ficha` e `atendimento` em
   `estadoDoEspelho`.
6. **Site** `areaCliente.firestore.ts`: dois `onSnapshot` que não seguram o `desenhar()` (hoje ele espera todas as
   partes: os novos ficam fora da condição da linha 108).
7. **VM** `useAdministrativo.ts`: `useEmpresa` aceita sócio sem `participacao` (hoje usa para a largura da barra:
   sem participação, sem barra).
8. **Aviso de mudança na Receita** (saída do Simples, inapta): **fora desta ficha** até o dono decidir (ver riscos).

**Dado e caminho no banco.** Lê `clientes/{id}.receita` (interno) e o cadastro. Grava
`areasCliente/{token}/resumo/ficha` e `resumo/atendimento`.

**Regra do banco.** Não precisa (`resumo/*`). Só se for usar `config/areaCliente` editável e a regra não deixar.

**Robô e robo-versao.** Robô do PC.

**Testes.**
- vitest core `ficha.test.ts`: nunca devolve CPF (mesmo que a fonte traga); sócio sem participação; IE do cadastro;
  sem receita, `null`.
- vitest `espelho.test.ts`: `lerFicha`, `lerAtendimento`.
- vitest `useAdministrativo` (ou a função pura que ele usa): sócio sem participação.

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/empresa` e `http://localhost:5178/cliente/exemplo/contato`
(o exemplo tem ficha e atendimento, `areaCliente.memoria.ts:112-121`). "Copiar todos os dados" copia sem CPF.

**Critérios de aceite.** A aba aparece no banco só com a ficha gravada; nenhum CPF; o cadastro incompleto mostra só o
que tem, sem "undefined".

**Riscos e armadilhas (das fontes).** "Lista branca rígida: nunca levar CPF de sócio nem dados de terceiros."
"Cadastro incompleto aparece incompleto para o cliente. Telefone de setor errado." "A inscrição municipal não existe no
cadastro. A participação dos sócios não vem da Receita, e hoje o VM a usa para a largura da barra. Os dados abertos
(BrasilAPI) atrasam semanas, como o próprio vigia-cnpj.js avisa, e o endereço sai sem CEP." "Mostrar 'saiu do Simples'
ou 'inapta' direto ao cliente antes de o escritório conferir é delicado … O receita.mudancas é interno (tem o 'visto' da
equipe) e não pode ir inteiro para o espelho."

**Dependências.** Porta da fase 2A. Os números dos setores (dono).

---

### 2A.6 comprovante-de-leitura

- **id**: `comprovante-de-leitura`
- **Tamanho**: médio
- **Regras tocadas**: R1, R2, R7, R10, R12

**O que o cliente ganha.** Indireto: o escritório sabe se ele abriu a guia, e ele deixa de receber lembrete da guia
que já abriu (ficha 2B.3). Para a equipe, a lista de guias enviadas mostra "aberta em dd/mm hh:mm" ou "não aberta".

**Como é no Acessórias.** Cada abertura fica registrada com data, hora e IP, e há assinatura digital no app ou na área
do cliente (protocolo-digital). Na lista de entregas do escritório, o envelope fica azul (visto) ou vermelho (não
visto) (600317). Fontes: acessorias.com/site/funcionalidade/protocolo-digital/ ;
acessorias.movidesk.com/kb/pt-br/article/600317. **A confirmar** (não está nessas duas páginas, conferido em
17/11/2026): que o link vá pelo WhatsApp e que o manual avise do falso positivo por pré-visualização e antivírus (o
risco em si é real e vale para o NADS do mesmo jeito).
(Não use os nomes nem as cores do Acessórias, R12.)

**Como está hoje no NADS.** `baixarGuia` (`areaCliente.firestore.ts:209`) só lê os pedaços e não grava nada. O portal
antigo do Entregas grava `portais/{token}.visto`, lido por `vistoNoLink` em
`apps/web/src/aplicativos/tarefas/dados/entregasDeDocumentos.firestore.ts:486`, mas uma vez por link e sem separar a
guia. O "Recebido" do mural (`tarefas/dados/avisos.ts`, `marcarRecebido`) é só da equipe.

**Passo a passo** (Receita B).
1. **Core** `packages/core/src/areaCliente/leitura.ts` (novo): `TITULO_DO_PEDIDO_DE_LEITURA = 'LEITURA'`,
   `pedidoDeLeitura(guiaId) → { tipo: 'documento', titulo: 'LEITURA', texto: 'guia:<id>' }` (id no formato
   `^[A-Za-z0-9_-]{1,128}$`), `guiaDoPedidoDeLeitura(p): string`. Exportar no core e em `scripts/robo-danfse.mjs`.
2. **Site** `dados/areaCliente.firestore.ts`: no `baixarGuia`, depois do download que deu certo, mandar o pedido **uma
   vez por guia por aparelho por dia** (guardar no `localStorage` `'nads-area-cliente|lidas'` com a data). O
   `addDoc` é o travado (modo desenvolvedor recusa); a empresa de teste já desvia para o exemplo. O erro do pedido
   **não** pode impedir o download (try/catch silencioso).
3. **Robô** `area-cliente.js`, `tratarChamado`: reconhecer a marca antes do `validarPedidoDeChamado` → `tratarLeitura`:
   confere o link e que `guias/{id}` existe no espelho daquele token; grava num registro **interno** (coleção nova do
   robô, por exemplo `areaClienteLeituras/{token}_{guiaId}` com `{ token, guiaId, codigos, primeiraEm, ultimaEm, vezes }`
   pela hora do servidor). Limite próprio por link por dia (ex.: 200). Apaga o pedido.
4. **Equipe (Tarefas)**: na lista de guias enviadas (a aba "Enviados" do Fiscal,
   `apps/web/src/aplicativos/tarefas/telas/fiscal/relatorio/`, e/ou a tela da Área do Cliente no Tarefas,
   `tarefas/telas/area-cliente/`; **a confirmar** onde o dono quer ver), mostrar "aberta em dd/mm hh:mm" / "não
   aberta". Leitura em `tarefas/dados/areaCliente.firestore.ts`, VM nova `useLeiturasDasGuias.ts`.

**Dado e caminho no banco.** O cliente cria em `areaClienteChamados` (já aceito). O robô grava a coleção interna nova
`areaClienteLeituras`. A equipe lê.

**Regra do banco.** Para a equipe **ler** `areaClienteLeituras` no Tarefas, é preciso regra (o robô grava com Admin
SDK, que passa por cima das regras; a leitura do navegador não). Texto proposto (o Vitor publica):

    // 17/11/2026 (comprovante-de-leitura): quando o cliente abriu cada guia na Área do Cliente (só o robô grava)
    match /areaClienteLeituras/{id} {
      allow read: if membroNoNads();
      allow write: if false;
    }

Sem essa regra, a parte do cliente e do robô funciona, mas a marca na tela da equipe espera. **Por isso a parte
"Tarefas" desta ficha depende do Vitor**; a lembrança (2B.3) não depende, porque quem lê é o robô.

**Robô e robo-versao.** Robô do PC. **Publicar o robô antes do site** (Receita B, passo 5).

**Testes.**
- vitest core `leitura.test.ts`: cria e reconhece a marca; recusa id torto; não confunde com DANFE.
- vitest `areaCliente.firestore.test.ts`: o `baixarGuia` manda o pedido uma vez por dia por guia; o erro do pedido não
  quebra o download.
- `node robo/teste-area-cliente.js`: a marca não vira chamado.

**Como conferir na tela.** No exemplo não há banco: conferir pelos testes. No banco (`npm run dev:banco`), com um link
de teste que **não** seja a empresa 9999: baixar uma guia → no Tarefas, a guia aparece "aberta".

**Critérios de aceite.** Baixar a guia não cria chamado; o registro guarda a primeira abertura; baixar dez vezes no dia
grava uma vez.

**Riscos e armadilhas (das fontes).** "Sem função no servidor não dá para registrar o IP. Os horários são só os do banco,
então o registro vale menos como prova do que o do Acessórias." "Um robô antigo, que não conhece a marca, transformaria
cada download num chamado: atualizar o robô … antes de publicar o site." (Atenção: o `area-cliente.js` é do PC; o
`robo-versao` da nuvem não basta.) "Cada download conta uma gravação; limitar a uma por guia, por aparelho e por dia."
"Os e-mails de guias seguem sem confirmação de leitura (precisaria de um link rastreado por um serviço, algo à parte)."
"Na empresa de teste e no modo desenvolvedor, a trava tem de recusar a gravação." "Uma regra nova só seria preciso se
quiserem uma caixa própria (areaClienteLeituras)" (para o cliente gravar; aqui quem grava é o robô, e a regra é só para a
equipe ler). Os pedidos contam no limite de 20 chamados por link por dia, se não ganharem limite próprio.

**Dependências.** Porta da fase 2A. A tela da equipe depende da regra do Vitor.

---

### 2A.7 certidoes

- **id**: `certidoes`
- **Tamanho**: médio
- **Regras tocadas**: R1, R2, R7, R10

**O que o cliente ganha.** As certidões da empresa (federal, estadual, municipal, FGTS, trabalhista) com "válida até
dd/mm" e o PDF da última de cada órgão para baixar. A que estiver perto de vencer entra no "Precisa de você" com "Pedir
nova".

**Como é no Acessórias.** O GED mostra o que o escritório pôs na ficha. A emissão automática de certidão aparece no
Onvio (CND automática), no Alterdata, no SCI e no G-Click, não no Acessórias (a confirmar).

**Como está hoje no NADS.** As validades estão em `clientes.papeis` (tipo e vence). Os PDFs estão em
`SOCIETÁRIO\CERTIDÕES\<ÓRGÃO>` do Drive, com nomes `dd-mm-aaaa.pdf` ou `VENC dd-mm-aaaa.pdf` (pelo
`robo/arquivador-regras.js`). O `drive-indice.js` roda na nuvem e não tem nada de certidão: a fonte do PDF é o disco do
PC. A Área não tem pasta de certidões.

**Passo a passo.**
1. **Core** `packages/core/src/areaCliente/certidoes.ts` (novo): `certidaoDoArquivo(orgao, nomeDoArquivo): { orgao;
   validoAte: string | null }` (lê o `VENC dd-mm-aaaa`), `ultimaPorOrgao(arquivos)`, e a lista branca `{ tipo:
   'certidao', id, nome, orgao, validoAte, tamanho, partes }`. Exportar em `scripts/robo-danfse.mjs`.
2. **Robô** `area-cliente.js`: em `espelhar`, para cada empresa, listar `<ano>\<cód> - nome\SOCIETÁRIO\CERTIDÕES\<ÓRGÃO>`
   do disco do PC, pegar a última de cada órgão e gravar como os documentos do DP (`documentos/{id}~{n}` e depois
   `documentos/{id}`, tipo `certidao`). Validade: a do nome `VENC`; sem ela, a de `clientes.papeis` (sem a observação,
   que é interna).
3. **Site** `dados/espelho.ts`: `lerCertidao(id, x)`. `areaCliente.firestore.ts`: `onSnapshot` com `where('tipo', '==',
   'certidao')` que não segura a tela; download igual ao `baixarDocumentoDp`.
4. **Site** `dados/biblioteca.ts`: uma pasta nova em `PASTAS_DA_BIBLIOTECA` ("Certidões"). Ela só aparece com
   certidão (R10).
5. **Site** `dados/visaoGeral.ts`: em `pendenciasDoCliente`, um item para a certidão que vence em até 15 dias (o prazo
   é **a confirmar**), no molde do certificado (linha 106), com a ação `{ tipo: 'pedir-guia', titulo: 'Certidão
   <órgão>' }` ou uma ação nova `pedir-certidao` que abre a solicitação tipo `documento`. Acrescentar `'certidao'` em
   `origem` (linha 46).

**Dado e caminho no banco.** Grava `areasCliente/{token}/documentos/{id}` (tipo `certidao`) e os pedaços.

**Regra do banco.** Não precisa.

**Robô e robo-versao.** Robô do PC. Emitir certidão sozinho fica fora (robô novo, portais com captcha).

**Testes.** vitest core (o nome `VENC`, a última por órgão); `espelho.test.ts`; `biblioteca.test.ts` (a pasta só com
certidão); `visaoGeral.test.ts` (o item aparece só perto de vencer); `node robo/teste-area-cliente.js`.

**Como conferir na tela.** Pôr uma certidão no exemplo (`areaCliente.memoria.ts`) e abrir
`http://localhost:5178/cliente/exemplo/documentos` e `.../inicio`.

**Critérios de aceite.** Uma certidão por órgão (a última); a validade do nome ganha da digitada; o item no "Precisa de
você" só perto de vencer.

**Riscos e armadilhas (das fontes).** "A validade de clientes.papeis é digitada à mão e pode não bater com o PDF achado:
data nova com PDF velho, ou o contrário. Melhor ligar a validade ao PDF pelo nome 'VENC'." "Uma certidão positiva
também aparece, mas é da própria empresa." "Emitir sozinho fica fora: seria robô novo, e há portais com captcha." "A
pendência no 'Precisa de você' acrescenta itens numa Visão geral que foi enxugada em 16/11." "clientes.papeis também
guarda o certificado digital, e com ele dá para ligar de graça o cartão do certificado" (ver 2A.1).

**Dependências.** Porta da fase 2A. Aproveita o download da 2A.4 (mesmo esquema).

---

### 2A.8 confirmar-entrega

- **id**: `confirmar-entrega`
- **Tamanho**: médio
- **Regras tocadas**: R1, R2, R7, R10

**O que o cliente ganha.** Vê o que o office boy vai levar ou já levou e toca "Confirmar que recebi", o que gera o
recibo da entrega.

**Como é no Acessórias.** O protocolo de entrega (digital e em papel para entrega em mãos), com o cliente confirmando o
recebimento. Também no G-Click.

**Como está hoje no NADS.** Existe no portal antigo do Entregas: `portais/{token}.recebido[entregaId]`, confirmado pelo
`robo/entrega-pelo-link.js` (nuvem, `vigia-robo.js:1053`) só quando a entrega está na lista que a equipe gravou no link,
o link é o atual e a entrega continua com status `'link'`. O core tem `packages/core/src/entregas/confirmacaoDaEntrega.ts` (conferido). A Área nova não mostra entregas.

**Passo a passo.**
1. **Core**: `pedidoDeRecebido(entregaId) → { tipo: 'documento', titulo: 'Recebi', texto: 'recebi:<id>' }` e
   `entregaDoPedidoDeRecebido(p)` (Receita B). Exportar em `scripts/robo-danfse.mjs`.
2. **Robô** `area-cliente.js`: em `espelhar`, ler as entregas do cliente do link (coleção `entregas`, pelo `clienteId`)
   e gravar `resumo/entregas { itens: [{ id, titulo, modo, situacao, entregueEm?, recebidoPor? }] }`. Só as de modo
   `'link'` têm o botão; as de rota (assinadas na rua) são só informação.
3. **Robô**: em `tratarChamado`, a marca `recebi:` → `tratarRecebido`: reaproveitar as conferências do
   `entrega-pelo-link.js` (a entrega é do cliente do link, status `'link'`, não mudou) e confirmar com
   `recebidoPeloLink: true` e `tocouEm` (conferido: `robo/entrega-pelo-link.js:82`; abra o bloco para copiar os outros
   campos gravados junto). Tirar o item do portal antigo
   (`portais/{token}.recebido`) para não confirmar duas vezes.
4. **Site** `dados/espelho.ts`: `lerEntregas(x)`; `areaCliente.firestore.ts`: `onSnapshot` de `resumo/entregas` que
   não segura a tela e o método `confirmarRecebido(token, entregaId)` (o `addDoc` travado).
5. **Site** `dados/visaoGeral.ts`: `AcaoDaPendencia` ganha `{ tipo: 'confirmar-entrega'; entrega: string }`;
   `origem` ganha `'entrega'`; o item aparece **só quando há o que confirmar**.
6. **VM** `telas/useInicio.ts`: trata `confirmar-entrega` chamando o repositório e mostrando o toast "Obrigado, anotamos
   que chegou."

**Dado e caminho no banco.** Grava `areasCliente/{token}/resumo/entregas`. O cliente cria o pedido marcado em
`areaClienteChamados`. O robô atualiza `entregas/{id}`.

**Regra do banco.** Não precisa.

**Robô e robo-versao.** Robô do PC (o `tratarChamado`). Se reaproveitar código do `entrega-pelo-link.js` (nuvem), mexer
nele pede `robo-versao` (R7). Prefira copiar a regra pura para o core e usar dos dois lados.

**Testes.** vitest core (a marca); `visaoGeral.test.ts` (o item só com entrega a confirmar; rota sem botão);
`espelho.test.ts`; `node robo/teste-area-cliente.js`.

**Como conferir na tela.** Pôr uma entrega `modo: 'link'` no exemplo e abrir `http://localhost:5178/cliente/exemplo/inicio`.

**Critérios de aceite.** Uma entrega confirmada uma vez só (nem pela Área e pelo portal antigo); entrega de rota não tem
botão.

**Riscos e armadilhas (das fontes).** "Hoje isso existe no portal antigo do Entregas (portais/{token}.recebido, outro
token). As duas páginas confirmariam a mesma entrega: o robô precisa tirar o item da lista do portal antigo e evitar
confirmação dupla." "As entregas de rota são assinadas na rua pelo office boy, então ali o botão não cabe (só
informação)." "Um robô antigo que não conhece a marca transforma o pedido num chamado 'Recebi' para a equipe." "Os
pedidos contam no limite de 20 chamados por link por dia, a não ser que ganhem limite próprio como as DANFEs (200)." "A
Visão geral foi enxugada em 16/11, então o item só deve aparecer quando houver o que confirmar."

**Dependências.** Porta da fase 2A.

---

### 2A.9 comprovante-da-guia (parte B: o robô liga o arquivo à guia e avisa a equipe)

- **id**: `comprovante-da-guia` (parte B)
- **Tamanho**: médio
- **Regras tocadas**: R1, R7

**O que o cliente ganha.** O comprovante que ele mandou pela guia chega à equipe ligado à guia certa (e, com 2A.11, a
guia pode sair de "a pagar").

**Como está hoje.** Ver 1.2. O `tratarEnvio` não lê o nome; o único aviso é a atividade genérica no painel do robô
("Arquivou o que o cliente mandou", `robo/area-cliente.js:878`), sem dizer de que guia é.

**Passo a passo.**
1. **Core**: `guiaDoComprovante(nome): { tipo; competencia } | null`, o inverso do `prefixoDoComprovante` da 1.2.
   Exportar em `scripts/robo-danfse.mjs`.
2. **Robô** `area-cliente.js`, `tratarEnvio` (linha 844): quando `tipo === 'comprovante'` e o nome tem o prefixo,
   gravar no `areaClienteRecebidos/{id}` os campos `guiaTipo` e `guiaCompetencia` e um aviso no painel
   (`painel.atividade('area-cliente', 'Comprovante de guia recebido — …')`). Para FGTS, marcar em `pedidosFgts` (campo
   **a confirmar**); para DAS/DAE, em `enviosSecretario` (campo **a confirmar**). A sugestão das fontes é a marca na
   guia ou um aviso no painel; comece pelo painel e pelo `areaClienteRecebidos`.
3. **Equipe**: em `tarefas/telas/area-cliente/RecebidosDoCliente.tsx` (VM `useRecebidosDoCliente.ts`), mostrar a guia
   ligada ("Comprovante do FGTS 10/2026").

**Dado e caminho no banco.** `areaClienteRecebidos/{id}` ganha `guiaTipo` e `guiaCompetencia` (o robô grava com Admin
SDK; a equipe já lê a coleção).

**Regra do banco.** Não precisa (a equipe já lê; o robô grava com Admin SDK).

**Robô e robo-versao.** Robô do PC.

**Testes.** vitest core (o inverso do prefixo, com nomes cortados); `node robo/teste-area-cliente.js`.

**Como conferir.** No banco, mandar um comprovante pela guia (1.2) → o Tarefas › Área do Cliente › Recebidos mostra a
guia.

**Critérios de aceite.** O comprovante com prefixo aparece ligado à guia; sem prefixo, como hoje.

**Riscos.** Os de 1.2. "Quando a parte do robô entrar, depende de atualizar o robô do PC (o arquivador)."

**Dependências.** 1.2 no ar. Porta da fase 2A.

---

### 2A.10 avaliacao-do-atendimento

- **id**: `avaliacao-do-atendimento`
- **Tamanho**: pequeno
- **Regras tocadas**: R1, R2, R4 (não vira conversa), R7, R10, R12

**O que o cliente ganha.** Na solicitação concluída, dá uma nota de 1 a 5 e um comentário opcional. O escritório
acompanha a satisfação.

**Como é no Acessórias.** Ao fim de cada atendimento há uma pesquisa automática (NPS) em que o cliente avalia o
serviço e o responsável, e o escritório acompanha a satisfação (fonte:
acessorias.com/site/categoria-de-funcionalidade/aplicativo-personalizado-e-area-vip/). A página
app.acessorias.com/sysajuda.php?p=101 trata de reabrir solicitação finalizada ainda não avaliada. Os detalhes "diz se
foi resolvido", "1 a 5 estrelas", "justificativa até 3 estrelas" e "NPS por empresa" **não aparecem nessas duas
páginas** (conferido em 17/11/2026): **a confirmar**.

**Como está hoje.** Não existe nota, NPS nem avaliação no core nem nos apps.

**Passo a passo** (Receita B).
1. **Core** `packages/core/src/areaCliente/avaliacao.ts`: `pedidoDeAvaliacao(chamadoId, nota 1..5, comentario ≤500) →
   { tipo: 'outro', titulo: 'AVALIACAO', texto: 'chamado:<id> nota:<n>\n<comentário>' }` e o leitor. Exportar em
   `scripts/robo-danfse.mjs`.
2. **Site** `areaCliente.firestore.ts`: `avaliarChamado(token, id, nota, comentario)` com o `addDoc` travado.
3. **VM** `telas/useChamados.ts`: `avaliar(nota, comentario)`; guarda no `localStorage` que já avaliou (para esconder o
   pedido de nota), "a última vale".
4. **Tela** `telas/Chamados.tsx`: só no chamado **concluído** e ainda não avaliado, uma linha "Como foi o atendimento?"
   com 5 estrelas e um campo opcional. Nada na lista (R10). Textos do NADS (R12).
5. **Robô** `area-cliente.js`, `tratarChamado`: a marca `AVALIACAO` → grava `avaliacao: { nota, comentario, em }` no
   `chamados/{id}` interno (Admin SDK) e **não** abre chamado; apaga o pedido.
6. **Equipe**: em `tarefas/telas/area-cliente/ChamadosDoCliente.tsx` (VM `useChamadosDoCliente.ts`), a nota no
   chamado e a média por mês.

**Dado e caminho no banco.** `chamados/{id}.avaliacao` (interno).

**Regra do banco.** Não precisa: quem grava é o robô (Admin SDK) e a equipe já lê `chamados`. (A fonte temia a
validação de chaves da regra de chamados; ela só vale para gravação pelo navegador.)

**Robô e robo-versao.** Robô do PC; publicar antes do site.

**Testes.** vitest core (a marca, nota fora de 1..5 recusada, comentário cortado); `useChamados` (a regra pura de
"mostrar a avaliação": concluído e não avaliado); `node robo/teste-area-cliente.js`.

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/chamados` → um chamado concluído → as estrelas.

**Critérios de aceite.** A avaliação não cria chamado nem mensagem na conversa; avaliar de novo substitui.

**Riscos e armadilhas (das fontes).** "Um robô antigo transformaria a avaliação num chamado: publicar o robô primeiro."
"Evitar avaliar duas vezes (a última vale)." "Avaliar não pode virar conversa: o comentário só vai para a equipe."

**Dependências.** Porta da fase 2A.

---

### 2A.11 guia-paga-confirmada

- **id**: `guia-paga-confirmada` (com a parte "aba Pagas" da lacuna `guias-completas-na-area`)
- **Tamanho**: grande
- **Regras tocadas**: R1, R2, R6 (não mexer nas leituras do Financeiro), R7, R10

**O que o cliente ganha.** Quando o escritório reconhece o pagamento pelo extrato, a guia sai de "a pagar" e mostra
"Paga em dd/mm". A aba "Pagas", já desenhada, passa a existir no banco.

**Como é no Acessórias.** O cliente anexa o comprovante no calendário (lacuna). A confirmação pelo extrato aparece no
G-Click, no Alterdata e no Onvio.

**Como está hoje no NADS.** `GuiaPaga` existe (`areaCliente.ts:68`), `SECOES_DO_BANCO.pagas = false`, e
`baixarComprovante` devolve `null` (`areaCliente.firestore.ts:224`). A aba "Pagas" (`telas/useGuias.ts:21,38-39` e
`Guias.tsx`) está pronta. O robô já tem os lançamentos em `lancamentosEmCache` (`area-cliente.js:554`, últimos 6
meses com extrato). `robo/parcela-paga.js` lê comprovantes só de parcela.

**Passo a passo.**
1. **Core** `packages/core/src/areaCliente/guiaPaga.ts` (novo, com muitos testes): `pagamentoDaGuia(guia, lancamentos):
   { pagoEm: 'dd/mm/aaaa' } | null`. Saída do **mesmo valor** numa janela perto do vencimento (ex.: de 5 dias antes a 10
   depois; **a confirmar**), histórico com FGTS/DAS/DARF/DAE/SIMPLES. **Na dúvida, não marca** (duas saídas candidatas
   → `null`). Exportar em `scripts/robo-danfse.mjs`.
2. **Robô** `area-cliente.js`: para as guias do FGTS (que este robô grava), acrescentar `pagoEm` no doc da guia
   quando houver casamento. Para DAS/DAE (gravadas pelo `envios-do-nads.js`, que este robô "nunca apaga nem regrava"):
   gravar `pagoEm` com `update` só do campo (merge), sem tocar no resto. Ampliar a lista branca `guia` (linha 648) com
   `pagoEm`.
3. **Site** `dados/espelho.ts`: `lerGuia` (linha 203) lê `pagoEm` (data `dd/mm/aaaa`). `estadoDoEspelho` monta
   `area.pagas` a partir das guias com `pagoEm` e as **tira** de `guias` (a pagar). `secoes.pagas` = há alguma paga.
4. **Site** `dados/visaoGeral.ts`: `guiasDoMomento` e `proximasGuias` ignoram as pagas.
5. **Comprovante para baixar**: continua sem fonte (`baixarComprovante` `null`), então `temComprovante: false`. Ligar ao
   comprovante da 2A.9 é melhoria futura.

**Dado e caminho no banco.** `areasCliente/{token}/guias/{id}.pagoEm`.

**Regra do banco.** Não precisa ("um campo pagoEm dentro de guias/* não precisa de regra nova"). Uma subcoleção nova
`pagas` precisaria ser conferida com o Vitor: **não** use.

**Robô e robo-versao.** Robô do PC. Se o `envios-do-nads.js` (nuvem) precisar preservar o `pagoEm` ao regravar a guia,
ele também muda (e aí `robo-versao`): no `guiaNaAreaDoCliente` (linha 126) o `ref.set(doc)` apaga o `pagoEm`; trocar
por `set(doc, { merge: true })` **só se** a guia nova for da mesma competência e valor (a guia retificada tem de
perder o `pagoEm`).

**Testes.** vitest core: valor igual na janela marca; duas saídas iguais não marca; juros (valor maior) não marca;
fora da janela não marca. `espelho.test.ts`: a paga sai de "a pagar" e vai para `pagas`. `visaoGeral.test.ts`.

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/guias` → aba "Pagas" (o exemplo tem). No banco,
uma empresa com extrato lido.

**Critérios de aceite.** Só marca com certeza; a guia retificada não herda o "paga"; a aba "Pagas" some quando não há
paga.

**Riscos e armadilhas (das fontes).** "As guias de DAS/DAE do espelho são do robo/envios-do-nads.js, e o area-cliente.js
diz que 'nunca as apaga nem regrava' (só mexe nas de FGTS). Marcar pagoEm nelas exige um merge cuidadoso nos dois
robôs, ou um sobrescreve o outro." "O extrato só existe para quem tem extrato lido no Extrator (projeto
conferencia-nilma; sem permissão o robô segue sem banco) e chega quando o cliente manda, em geral no mês seguinte. O
'Paga em' sairia com semanas de atraso, e só para parte dos clientes." "A lista do mês é cortada em
MAIOR_LISTA_DE_LANCAMENTOS (campo cortados), então pode faltar o pagamento." "Casar só pelo valor pode errar: duas guias
do mesmo valor, ou um pagamento com juros que não bate. Vale a mesma regra do parcela-paga.js: na dúvida, não marca."
"O parcela-paga.js só trata parcela. Ler o comprovante de guia comum pelo e-mail é trabalho novo no
download-attachments.js." "O comprovante para baixar (baixarComprovante) não tem fonte: hoje devolve null." "A queixa de
'FGTS vencido' já é em parte resolvida pelo guiasDoMomento (visaoGeral.ts), que esconde os meses passados." "O robô do
PC precisa ser atualizado."

**Dependências.** Porta da fase 2A. Melhor depois de 2B.1 (mais guias para casar). Usa 2A.9 se existir.

---

### 2A.12 parcelamentos

- **id**: `parcelamentos`
- **Tamanho**: médio (só o selo e o resumo); grande com o PDF da parcela
- **Regras tocadas**: R1, R2, R7, R10

**O que o cliente ganha.** Cada parcelamento (PGFN, Simples, Estado, Prefeitura) como "parcela 12 de 60", o valor e o
próximo vencimento. Atrasar parcela pode derrubar o parcelamento.

**Como é no Acessórias.** Parcelamento é cadastrado como obrigação mensal (o exemplo oficial é a taxa de alvará em
parcelas). A visão de parcelamentos para o cliente vem de outros portais (a Contabilizei deixa pagar e parcelar).

**Como está hoje no NADS.** A coleção `parcelamentos` tem órgão, parcelas, valor, dia e `pagas`, marcadas pelo
`robo/parcela-paga.js`. O cálculo de "parcela N de M" e do próximo vencimento existe no core
(`packages/core/src/entregas/parcelamentos.ts`) e no `situacao()` do `parcela-paga.js`. O `lote-fiscal.js` reconhece a
guia de parcelamento, mas a deixa "sem coluna" e não grava espelho. `TipoDeGuia` não tem parcela.

**Passo a passo (versão média, sem PDF).**
1. **Core**: `parcelamentosDoCliente(docs, hoje)` com a lista branca `{ orgao, modalidade, numero, parcelas,
   primeira, valorParcela, dia, pagas, parcelaAtual, proximoVencimento }`, **sem `obs` e sem `atualizadoPor`**, usando
   o que já existe em `entregas/parcelamentos.ts`. Exportar em `scripts/robo-danfse.mjs`.
2. **Robô** `area-cliente.js`: ler `parcelamentos` do `clienteId` do link (status ativo) e gravar `resumo/parcelamentos`.
3. **Site**: `lerParcelamentos` em `espelho.ts`, `onSnapshot` em `areaCliente.firestore.ts`, um campo novo no
   `EstadoDaArea`, e na tela `Guias.tsx` uma linha discreta por parcelamento ("Parcelamento PGFN: parcela 12 de 60,
   vence 20/11"), **só se houver parcelamento** (R10). A VM `useGuias.ts` monta o texto.

**Dado e caminho no banco.** `areasCliente/{token}/resumo/parcelamentos`.

**Regra do banco.** Não precisa.

**Robô e robo-versao.** Robô do PC. A versão com o PDF da parcela mexe no `lote-fiscal.js` (nuvem, `robo-versao`) e
depende de 2B.1.

**Testes.** vitest core (sem `obs`; "parcela N de M"; formato de `pagas`); `espelho.test.ts`; `useGuias` (só com
parcelamento).

**Como conferir na tela.** Pôr um parcelamento no exemplo e abrir `http://localhost:5178/cliente/exemplo/guias`.

**Critérios de aceite.** Sem parcelamento, nada muda na tela; nenhum campo interno no espelho.

**Riscos e armadilhas (das fontes).** "O cadastro dos parcelamentos é manual (Tarefas › empresa › Parcelamentos), e as
pagas só são marcadas pelo comprovante de e-mail ou à mão. Um parcelamento desatualizado mostraria ao cliente 'parcela
atrasada' falsa e o assustaria." (Por isso: **não** mostrar "atrasada"; mostrar só o próximo vencimento, a confirmar com
o dono.) "O dado 'pagas' na tela é um array, mas o robô grava um mapa pagas.{AAAA-MM}: é preciso conferir o formato real
antes." "Mais uma coisa na tela de Guias, que o dono enxugou em 16/11 ('muita informação')." "Sem o PDF, a ideia cai
para médio: só o selo e o resumo."

**Dependências.** Porta da fase 2A. O PDF depende de 2B.1.

---

### 2A.13 informe-e-folha-antiga

- **id**: `informe-e-folha-antiga` (com o corte de 3 meses da lacuna `documentos-do-escritorio-no-acervo`)
- **Tamanho**: grande
- **Regras tocadas**: R1, R2, **R5**, R7, R10

**O que o cliente ganha.** No Registro (aba `dp`), os holerites e recibos de férias de meses mais antigos, e o informe
de rendimentos do ano, para entregar ao funcionário.

**Como é no Acessórias.** O GED guarda o que foi entregue. O portal do empregado é de outros (Onvio/Domínio, SCI,
Alterdata Folhanet).

**Como está hoje no NADS.** `MESES_DO_DP = 3` (`robo/area-cliente.js:46`), usado no `espelharPessoal` (linha 330). O
seletor de mês da tela monta pelos meses que chegam (`ac.mesesDosDocumentosDp` em `telas/useDp.ts`). O informe **não**
está no `dpArquivos`.

**Passo a passo.**
1. **Decisão do dono antes de codar (R5)**: os PDFs do informe e do TRCT mostram o CPF completo (como os holerites que já
   vão hoje). O TRCT traz também a causa do afastamento, que a R5 proíbe no espelho. **Proposta: o TRCT não entra**, e o
   informe e os holerites antigos só com o OK do dono. Sem OK, esta ficha não sai.
2. **Folhas antigas (sob pedido)**: no robô, separar a janela da **lista** (ex.: 12 meses, só metadados) da janela dos
   **bytes** (os 3 de hoje). Os documentos antigos entram em `documentos/{id}` com `partes: 0`. O download de um
   antigo vira pedido marcado (Receita B, como a DANFE): `pedidoDeDocumentoDp(id)`, e o robô grava os pedaços sob
   pedido. O site (`baixarDocumentoDp`) espera os pedaços como o `pedirDanfe` (linha 228).
3. **Informe de rendimentos**: categoria nova em `packages/core/src/areaCliente/pessoal.ts` (`CategoriaDoDp` e
   `ORDEM_DAS_CATEGORIAS_DP`), com competência anual aceita pelo `lerDocumentoDp` (`espelho.ts:189`). A fonte é nova:
   a pasta `CONTÁBIL/INFORME DE RENDIMENTOS/<ano>`, separando os informes **que a empresa emite** dos que ela
   **recebe** dos bancos (a regra de separação é **a confirmar**).
4. **Tela**: nada novo além do seletor ir mais longe e da categoria "Anuais".

**Dado e caminho no banco.** `areasCliente/{token}/documentos/{id}` (tipo `dp`) e os pedaços sob pedido.

**Regra do banco.** Não precisa (o pedido vai pela caixa de chamados).

**Robô e robo-versao.** Robô do PC; publicar antes do site.

**Testes.** vitest core (categoria anual; o TRCT barrado); `espelho.test.ts` (`partes: 0` aceito); o pedido marcado;
`node robo/teste-area-cliente.js`.

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/dp` → a aba Folha, mês antigo.

**Critérios de aceite.** TRCT nunca no espelho; meses antigos baixam sob pedido; o espelho estruturado continua com CPF
mascarado.

**Riscos e armadilhas (das fontes).** "O informe NÃO está no dpArquivos. O envios-do-dp.js só lista as pastas de mês …
e deixa a pasta FUNCIONÁRIOS de fora. Além disso, o arquivador (arquivador-regras.js, linha 1225) põe 'COMPROVANTE DE
RENDIMENTOS' / 'FONTE PAGADORA… BENEFICIÁRIO' em CONTÁBIL/INFORME DE RENDIMENTOS/<ano>, misturado com os informes que a
empresa recebe dos bancos. É preciso separar os dois." "'Qualquer mês' não existe: o drive-indice.js grava o
dpArquivos só do ano em PASTA_ANO (2026), e os anos anteriores são 'só o mapa… nada de DP'." "Cada documento vai em
base64 para o espelho de cada link, e o cliente ouve todos os documentos tipo 'dp' a cada vez que abre a área. Abrir
para 12 meses ou mais multiplica as gravações, o armazenamento e as leituras, por isso o caminho sob demanda."
"Privacidade: o espelho estruturado continua com o CPF mascarado e sem o motivo do afastamento, mas o PDF do informe e o
do TRCT mostram o CPF completo … Convém o dono confirmar." "Depende de atualizar o robô do PC."

**Dependências.** OK do dono (R5). Porta da fase 2A.

---

### 2A.14 processos-visiveis

- **id**: `processos-visiveis`
- **Tamanho**: médio
- **Regras tocadas**: R1, R2, R3 (talvez), R4, R5, R7, **R10**

**O que o cliente ganha.** Vê em que etapa está a admissão ou a rescisão que ele pediu.

**Como é no Acessórias.** Processos em checklist no app e na área do cliente, com passos marcados como "aparece no app"
e e-mails de acompanhamento. Fonte: acessorias.com/site/funcionalidade/gestao-de-processos/.

**Como está hoje no NADS.** Os chamados só têm as situações aberto, em andamento, respondido e concluído
(`packages/core/src/areaCliente/chamados.ts`, `SituacaoDoChamado`). **Atenção**: em 16/11/2026 os passos "Recebida ›
Em andamento › Respondida" **saíram** do painel por "muita informação" (`telas/Chamados.tsx:146`,
`telas/useChamados.ts:130`). O processo de várias etapas que existe é interno (`core/administrativo/entradaDeClientes.ts`).

**Passo a passo.** **Só com o OK do dono**, porque contraria o enxugamento de 16/11. Se aprovado:
1. **Core** `chamados.ts`: `PASSOS_POR_TIPO: Record<TipoDeChamado, string[]>` (admissão: recebida › documentos
   conferidos › eSocial enviado › contrato pronto; demissão: recebida › cálculo › guias › TRCT; os nomes são **a
   confirmar** com o DP). `passosDoChamado(c)`.
2. **Equipe**: em `tarefas/telas/area-cliente/ChamadosDoCliente.tsx` (VM `useChamadosDoCliente.ts`), marcar o passo
   (grava `chamados/{id}.passos: { [passo]: iso }` por `tarefas/dados/areaCliente.firestore.ts`).
3. **Robô** `area-cliente-regras.js`: a projeção do chamado (lista branca `chamado`, linha 652) ganha `passos` (sem
   notas internas).
4. **Site**: `lerChamado` lê `passos`; `Chamados.tsx` mostra **só o passo atual** dentro do chamado aberto (não na lista).

**Regra do banco.** Se a regra de `chamados` (gravada pela equipe no navegador) validar as chaves, o campo `passos`
exige mudar a regra (**a confirmar** no `firestore.rules` do Entregas). Texto a acrescentar, se for o caso:

    // 17/11/2026 (processos-visiveis): a equipe marca os passos do pedido
    && (!('passos' in request.resource.data) || request.resource.data.passos is map)

**Robô e robo-versao.** Robô do PC.

**Testes.** vitest core (passos por tipo); `espelho.test.ts`; `useChamadosDoCliente`.

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/chamados`.

**Critérios de aceite.** Só um passo visível de cada vez; nada de nota interna; nada do motivo da demissão (R5).

**Riscos e armadilhas (das fontes).** "A coleção interna chamados é gravada pela equipe; se a regra validar as chaves, o
campo novo 'passos' exige mexer na regra." "Na rescisão, o motivo da demissão e os dados do funcionário não podem ir
para o espelho além do que já vai." "Abertura e alteração de empresa não são chamados hoje e precisariam de um tipo novo
ou de ligar a entrada de clientes."

**Dependências.** OK do dono (R10). Talvez Vitor. Vizinha da ficha E19 (`E19-processos-com-passos`, coleção
`nadsProcessos`) do `05-plano-lado-do-escritorio.md`: esta ficha **não** espera a E19 (usa só os passos do chamado).
Se a E19b for feita, decidir com o dono qual das duas o cliente vê (a confirmar); não manter as duas.

---

### 2A.15 relatorio-de-impostos

- **id**: `relatorio-de-impostos`
- **Tamanho**: médio (pequeno pelo caminho barato)
- **Regras tocadas**: R1, R2, R7, R10

**O que o cliente ganha.** Um botão "Baixar impostos do ano" no Faturamento gera uma planilha com o valor das guias de
cada imposto, mês a mês. É uma planilha, não mais números na tela.

**Como é no Acessórias.** Não há equivalente descrito (a confirmar). Aparece na Agilize, na Contabilizei e no SCI.

**Como está hoje no NADS.** `controleTributos/{AAAA-MM}_{código}` tem o valor de cada tributo, preenchido pelo
`lote-fiscal.js`. A tela de Faturamento (`telas/useAdministrativo.ts`, `useFaturamento`, linha 133) já gera planilha
(`planilhaDoFaturamento` no core).

**Passo a passo.**
1. **Caminho barato (recomendado, depois de 2B.1)**: sem espelho novo. Core: `planilhaDosImpostos(guias, ano)` monta as
   linhas a partir das guias do espelho (tipo, competência, valor). VM `useFaturamento`: `baixarImpostosDoAno()`. Tela
   `Administrativo.tsx` (`Faturamento`, linha 244): o botão ao lado de "Baixar planilha".
2. **Caminho completo**: o robô lê `controleTributos` e grava `resumo/impostos` só com coluna e valor numérico
   (`numeroDoControle`), sem marcas, observações, retificação, entregue e `atualizadoPor`.

**Regra do banco.** Não precisa.

**Robô e robo-versao.** Caminho barato: nenhum. Completo: robô do PC.

**Testes.** vitest core (`planilhaDosImpostos`: só guias do ano; ordem dos meses; rótulo "impostos das guias").

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/faturamento` → "Baixar impostos do ano".

**Critérios de aceite.** O arquivo diz "impostos das guias emitidas", nunca "quanto paguei".

**Riscos e armadilhas (das fontes).** "O controle de tributos começou em 27/10/2026, então o 'ano' de 2026 tem um ou dois
meses: só serve de verdade a partir de 2027." "O valor é o da guia emitida, não do pago: o rótulo tem de ser 'impostos
das guias', nunca 'quanto paguei'." "Não tem FGTS nem INSS, que são do DP e ficam fora do controle." "As células aceitam
anotação ('—', '0', texto curto), e o numeroDoControle as zera." "A retificação mora nas marcas e pode mudar o número."
"O leitor de IBS/CBS no sieg-xmls.js é escopo extra e dispensável."

**Dependências.** 2B.1 (caminho barato). Baixa prioridade até 2027.

---

## Fase 2B: robô da nuvem (o vigia), sem regra nova

**Porta de entrada da fase 2B.** Estas fichas mudam módulos que o `robo/vigia-robo.js` carrega na VM `robo-nilma`.
Depois do código pronto e do `npm run verificar` limpo: commit e push **só com o OK do dono**, e depois a troca do
metadado `robo-versao` da VM pelo gcloud, **também com o OK do dono** (Receita C). Sem a troca, a nuvem continua com o
código velho. Tudo o que manda e-mail ou WhatsApp a cliente nasce **travado** (`LIBERADO_PARA_CLIENTES = false`, só para
`INTERNOS`), com teste `node robo/teste-<nome>.js` que confere que começa travado.

### 2B.1 todas-as-guias

- **id**: `todas-as-guias` (junta a lacuna `guias-completas-na-area`)
- **Tamanho**: médio
- **Regras tocadas**: R1, R2, R5, R7, R10

**O que o cliente ganha.** Além do FGTS, do DAS e do DAE, a tela Guias passa a trazer a DARF (INSS/DCTFWeb, PIS,
COFINS, IRPJ, CSLL) e o DAM do ISS, com o PDF para baixar, assim que o lote do escritório é enviado, seja qual for a
via (e-mail, impresso, eContador ou WhatsApp). O cliente para de pedir a guia pelo WhatsApp. É a função que mais se
repete nos portais (8: Onvio, G-Click/Omie, Nibo, Alterdata, SCI, Agilize, Contabilizei, Acessórias).

**Como é no Acessórias.** Calendário e GED com tudo o que o escritório entregou (DARF, DAS, FGTS, DARE, ISS, recibos,
declarações). Fontes: acessorias.movidesk.com/kb/pt-br/article/592543 ;
acessorias.com/site/funcionalidade/automacao-de-entregas/.

**Como está hoje no NADS.**
- Só o FGTS (`robo/area-cliente.js`, pelos `pedidosFgts`, `espelharGuia`, linha 196) e o DAS/DAE do envio ao Claudio
  Secretário (`robo/envios-do-nads.js`: `guiaDoEnvio`, linha 80, só aceita `DAS` ou `DAE`; `idDaGuiaDoCliente`, linha
  94, `"dae-2026-09-58"`; `docDaGuiaDoCliente`, 105; `pedacosDoPdfCliente`, 111; `tokensDaEmpresa`, 119;
  `guiaNaAreaDoCliente`, 126; todos exportados).
- `robo/lote-fiscal.js` (`dispararLote`, linha 454) e `robo/lote-dp.js` não escrevem em `areasCliente`. O PDF de cada
  guia do lote só existe até `L.apagarPartes(i.ref)` (linhas 492 e 522), logo depois do envio.
- Core: `TipoDeGuia = 'FGTS' | 'DAS' | 'DAE' | 'outra'` e `ROTULO_DA_GUIA` (`packages/core/src/areaCliente/guias.ts:6,10`).
- Site: `TIPOS_DE_GUIA` e `lerGuia` (`dados/espelho.ts:199,203`); o quadradinho já conhece DARF, INSS e DCTFWeb
  (`TipoDoQuadradinho`, `areaCliente.ts:65`).

**Passo a passo.**
1. **Core** `packages/core/src/areaCliente/guias.ts`: `TipoDeGuia` ganha `'DARF' | 'DAM'`. A guia ganha `tributo?:
   string` opcional (`'INSS'`, `'PIS'`, `'COFINS'`, `'IRPJ'`, `'CSLL'`, `'IRRF'`, `'ISS'`…). `ROTULO_DA_GUIA` ganha
   `DARF: 'DARF'` e `DAM: 'DAM (ISS)'`. Função nova `rotuloDaGuia(g)` que devolve `'DARF ' + tributo` quando há
   tributo; troque os usos de `ac.ROTULO_DA_GUIA[g.tipo]` em telas e VMs por `ac.rotuloDaGuia(g)` (procure com
   `Grep "ROTULO_DA_GUIA\["`: hoje em `biblioteca.ts`, `CartaoDeGuia.tsx`, `LinhaDeGuia.tsx`, `LinhaGuiaDoMes.tsx`,
   `SiglaDaGuia.tsx`, `useAreaCliente.ts` e `useGuias.ts`). Troque também o lambda do sino em
   `telas/useAreaCliente.ts:160` (`g => g.tipo === 'outra' ? 'Guia' : g.tipo`), que não usa a constante. Função `idDaGuiaNoEspelho({ tipo, tributo, competencia, codigo })` →
   `darf-inss-2026-10-58`, igual ao `idDaGuiaDoCliente` do `envios-do-nads.js` quando não há tributo (assim o DAS do
   lote e o do envio caem **no mesmo id**). Exportar em `scripts/robo-danfse.mjs` e rodar `npm run robo:danfse`.
2. **Robô (nuvem)** `robo/envios-do-nads.js`: extrair a gravação de `guiaNaAreaDoCliente` para uma função
   `gravarGuiaNaArea(db, g, buffer, log)` que recebe `{ tipo, tributo?, vencimento 'dd/mm/aaaa', valor número,
   competencia, codigo }`, e exportar. O `guiaNaAreaDoCliente` passa a chamá-la (sem mudar o comportamento de hoje).
3. **Robô (nuvem)** `robo/lote-fiscal.js`: em `dispararLote`, **em todas as vias** e **antes** de `L.apagarPartes`,
   para cada item com tipo DAS, DARF, DAE ou DAM: montar a guia pelo `i.vai` (tipo, tributo, valor, competência,
   código) e pela leitura (`(i.leitura || {}).vencimento`) e chamar `gravarGuiaNaArea`. Na via e-mail o buffer já está
   em `anexos[k].buffer`; nas outras vias, ler com `L.bufferDoArquivo(i.ref, i)`. Sem vencimento lido: **não grava** e
   anota no `resultado` (`semAreaDoCliente: [...]`) para a equipe ver. Erro aqui não pode derrubar o envio (try/catch e
   anotar).
4. **Robô (nuvem)** `robo/lote-dp.js`: o mesmo, **só para a DARF** (tributo pelo `tributoDoNome`, linha 52). **O FGTS
   do lote-dp não entra** (já vem do `pedidosFgts`; duplicaria).
5. **Site** `dados/espelho.ts`: `TIPOS_DE_GUIA` com `DARF` e `DAM`; `lerGuia` lê `tributo` (texto curto, só
   letras). `nomeDoPdfDaGuia` (linha 385) usa o tributo no nome.
6. **Site** partes e telas: `partes/SiglaDaGuia.tsx` e `partes/guia.ts` reconhecem `DARF`/`DAM` (o quadradinho já sabe
   DARF). Nada de tela nova.
7. **Limpeza (decisão das fontes: hoje nada apaga)**: em `robo/area-cliente.js`, uma limpeza diária das guias **não
   FGTS** com vencimento há mais de `MESES_DE_GUIAS` (12, linha 44), com os pedaços. Isso muda a frase "nunca as apaga"
   do cabeçalho (linha 25): atualize o comentário com a data. Esta parte é do robô do **PC**.

**Dado e caminho no banco.** `areasCliente/{token}/guias/{tipo}[-{tributo}]-{AAAA-MM}-{codigo}` + `guias/{id}/pdf/{n}`.

**Regra do banco.** Não precisa ("O caminho guias/* já é lido pelo cliente"). A parte "o cliente marca como paga" da
lacuna, que precisaria de regra, foi para 2A.11 e 1.2/2A.9, que não precisam.

**Robô e robo-versao.** `envios-do-nads.js`, `lote-fiscal.js` e `lote-dp.js` são da **nuvem**: push + `robo-versao`
com o OK do dono. A limpeza (passo 7) é do PC.

**Testes.**
- vitest `packages/core/src/areaCliente/areaCliente.test.ts` (ou `guias.test.ts` novo): `idDaGuiaNoEspelho` (com e sem
  tributo; DAS igual ao do envio); `rotuloDaGuia`.
- vitest `espelho.test.ts`: `lerGuia` com DARF e tributo; sem vencimento → `null`.
- Não existe `robo/teste-lote*.js` (conferido em 17/11/2026). Crie `robo/teste-lote-fiscal.js` sem rede, no molde de
  `robo/teste-mandei.js`, ou acrescente casos em `robo/teste-robo.js` (qual dos dois: a confirmar): o lote grava a guia
  antes de apagar as partes; o FGTS do lote-dp não grava.

**Como conferir na tela.** Pôr uma DARF no exemplo (`areaCliente.memoria.ts`) e abrir
`http://localhost:5178/cliente/exemplo/guias`. No banco, um lote de teste para a empresa de teste do escritório (não a
9999, que mostra o exemplo) e conferir `areasCliente/{token}/guias`.

**Critérios de aceite.** Toda via grava; DAS não duplica; FGTS do DP não duplica; guia retificada (mesmo id) substitui a
antiga e os pedaços velhos saem (como já faz o `guiaNaAreaDoCliente`).

**Riscos e armadilhas (das fontes).** "'DARF do INSS' e 'DCTFWeb' são a mesma guia (a DARF numerada da DCTFWeb), e o
FGTS do lote-dp NÃO pode entrar, porque duplicaria o que vem do pedidosFgts." "Uma DARF por tributo no mesmo mês exige o
tributo no id, senão uma sobrescreve a outra." "A guia com 'partes' (vários códigos numa DARF) e a de parcelamento pedem
uma decisão de como aparecem" (**a confirmar** com o dono; sugestão: uma linha por PDF, rótulo "DARF (vários
tributos)"). "O DAS pode chegar pelos dois caminhos (envios-do-nads e lote-fiscal). Se a competência dos dois divergir
(a do lote é a da apuração), sai em dobro." (Confira com um caso real qual competência cada caminho grava, antes de
publicar.) "Nada apaga essas guias depois: o area-cliente.js só limpa as do tipo FGTS, então elas se acumulam no
espelho para sempre." "O vencimento vem da leitura do PDF: se a leitura vier vazia, a guia não passa no lerGuia (exige
data) e some sem aviso." "A guia trocada (retificada) precisa substituir a antiga. O lote-dp manda holerites e outros
papéis junto: só a guia pode ir para Guias." "Precisa atualizar o robô da nuvem (metadado robo-versao), não basta o
push."

**Dependências.** Nenhuma ficha antes. Destrava 2B.3, 2A.15 (caminho barato) e o PDF de 2A.12.

---

### 2B.2 aviso-de-resposta (parte B: e-mail quando o escritório responde)

- **id**: `aviso-de-resposta` (parte B)
- **Tamanho**: médio
- **Regras tocadas**: R1, R4, R7, R8 (a mesma trava), R12

**O que o cliente ganha.** Quando o escritório responde ou conclui um pedido, chega um e-mail curto ("Respondemos o seu
pedido <título>") com o link da Área. Não vem a resposta no e-mail: o e-mail só aponta para a solicitação (R4).

**Como é no Acessórias.** E-mails enviados periodicamente ao longo do dia sobre as interações que o cliente ainda não
viu. Fonte: app.acessorias.com/sysajuda.php?p=81. ("Alerta depois de 3 horas" e "resumo diário" **não estão** nessa
página, conferido em 17/11/2026: a confirmar.)

**Como está hoje.** `robo/area-cliente.js` (PC) copia a resposta para o espelho, mas não manda e-mail, push nem
WhatsApp.

**Passo a passo.**
1. **Core** `packages/core/src/areaCliente/avisoDeResposta.ts`: `precisaAvisar(chamado, avisadoEm?, agora):
   boolean` (a última mensagem é do escritório, depois do último aviso, e passaram pelo menos 15 min, para juntar
   respostas seguidas; **o tempo é a confirmar**) e `emailDoAviso(titulo, link) → { assunto, corpo }` com texto do NADS.
   Exportar em `scripts/robo-danfse.mjs`.
2. **Robô (nuvem)** novo módulo `robo/aviso-de-resposta.js`, ligado no `vigia-robo.js` (perto das linhas 1043-1060,
   dentro de `try { … }`), **só na nuvem** (`process.env.ROBO_NA_NUVEM`, como na linha 1170): ouvir
   `chamados` com `situacao in ['respondido', 'concluido']`, aplicar `precisaAvisar`, mandar pelo mesmo envio de e-mail
   do vigia (o `enviar`/`correio` que os outros módulos recebem; `robo/email-html.js` para o HTML) ao **e-mail do
   cadastro** da empresa (como `regua-cobranca.js`: só e-mail que está no cadastro), e gravar `avisoEnviadoEm` no
   chamado interno (Admin SDK). Com `LIBERADO_PARA_CLIENTES = false` e `INTERNOS = ['nilmacontabilidade@gmail.com']`,
   como `robo/mandei.js`. Teto diário (ex.: 40, como a régua).
3. **Robô (PC)** `robo/area-cliente-regras.js`: conferir que `avisoEnviadoEm` **não** vai para o espelho (a projeção
   `chamado` já é lista branca, linha 652).
4. **Teste sem rede** `robo/teste-aviso-de-resposta.js` (no molde de `robo/teste-mandei.js`): começa travado; não
   avisa duas vezes; junta respostas seguidas.

**Dado e caminho no banco.** `chamados/{id}.avisoEnviadoEm` (interno).

**Regra do banco.** Não precisa.

**Robô e robo-versao.** Nuvem: push + `robo-versao`, com OK do dono. Liberar a trava é decisão do escritório.

**Testes.** vitest core (`precisaAvisar`, `emailDoAviso`); `node robo/teste-aviso-de-resposta.js`.

**Como conferir.** Com a trava fechada, responder um chamado de teste no Tarefas → o e-mail chega só em
`nilmacontabilidade@gmail.com`.

**Critérios de aceite.** Um e-mail por resposta (ou por bloco de respostas), nunca por mensagem; nada sai para cliente
com a trava fechada; o e-mail não traz o texto da resposta.

**Riscos e armadilhas (das fontes).** "E-mails ao cliente precisam de trava de teste (como o Mandei) e de limite para
não mandar um e-mail por mensagem. Não pode virar chat: o aviso só aponta para a solicitação." "Depois do merge do
Baileys, também pelo WhatsApp" (fase 4).

**Dependências.** 1.1 recomendada antes.

---

### 2B.3 lembrete-de-vencimento

- **id**: `lembrete-de-vencimento` (junta a candidata `aviso-antes-de-vencer`)
- **Tamanho**: médio
- **Regras tocadas**: R1, R4, R7, R8, R10, R12

**O que o cliente ganha.** Alguns dias antes do vencimento, quando ele ainda não abriu a guia, chega um e-mail com o
link da Área. Sem precisar abrir a Área.

**Como é no Acessórias.** E-mail de lembrete da guia não lida, com vários prazos ("Qtde de dias, antes do vcto"), prefixo
no assunto personalizável e mensagem opcional no topo (p=43). Por padrão o lembrete vai só para o envelope vermelho
(não visto); um "F" no dia manda para todos (600317). Fontes: app.acessorias.com/sysajuda.php?p=43 ;
acessorias.movidesk.com/kb/pt-br/article/600317. O lembrete pelo WhatsApp **não está** nessas páginas: a confirmar. (Não copie o prefixo do Acessórias, R12.)

**Como está hoje no NADS.** Na Área nova o aviso é só visual (sino e "Precisa de você"). O único aviso automático é o
push do **portal antigo** (`robo/avisos-vencimento.js`, ligado no vigia, linha 1043): lê `portais/{token}.avisar` e as
guias de lá, avisa um dia antes e no dia, com link para `nilmaadvancedsystems.github.io/Entregas/cliente.html`, e
guarda "já avisado hoje" em `robo/avisosVencimento`. Não há e-mail nem WhatsApp de vencimento.

**Passo a passo.**
1. **Core** `packages/core/src/areaCliente/lembretes.ts` (novo; o `vencimentos.ts` que já existe é a tabela de
   vencimentos das rotinas, não misture): `guiasParaLembrar(guias: GuiaDoCliente[], hoje: Date, dias: number[],
   abertas: Set<string>): GuiaDoCliente[]` (dias padrão `[2, 1, 0]`, **a confirmar**; respeitar fim de semana como o
   `avisos-vencimento.js`: na sexta, também o que vence no sábado, domingo e segunda) e `emailDoLembrete(empresa,
   guias, link)`. Exportar em `scripts/robo-danfse.mjs`.
2. **Core** `packages/core/src/robos/ajustes.ts`: grupo novo `{ doc: 'lembreteGuia', titulo: 'Lembrete de vencimento ao
   cliente', robo: 'vigia', campos: [ligado (padrão false), dias, maxPorDia] }`, no molde do grupo `cobranca` (linha 29).
3. **Robô (nuvem)** novo `robo/lembrete-guia.js`, ligado no `vigia-robo.js` **só na nuvem**: uma vez por dia, a partir
   das 8h, para cada link (`areasCliente`), ler `guias` do espelho, ler `areaClienteLeituras` (da 2A.6) para as
   abertas, aplicar `guiasParaLembrar`, montar o e-mail (`robo/email-html.js`) e mandar ao e-mail do cadastro. "Já
   avisado hoje" em `robo/lembreteGuia` no banco (como `robo/avisosVencimento`). Trava `LIBERADO_PARA_CLIENTES = false`
   + `INTERNOS`, freio diário.
4. **Canal push (Firebase Messaging)**: **fora desta ficha** (ver riscos: iPhone só como app instalado, token que
   expira). WhatsApp: fase 4.
5. **Tela**: nada. (Uma opção "não quero lembrete" por empresa seria pedido marcado ou regra nova: **a confirmar** se o
   dono quer.)

**Dado e caminho no banco.** Lê `areasCliente/{token}/guias/*` e `areaClienteLeituras/*`. Grava `robo/lembreteGuia`.

**Regra do banco.** Não precisa (o "visto" vem do pedido marcado da 2A.6, que cabe na caixa de chamados; quem lê
`areaClienteLeituras` é o robô, com Admin SDK). A lacuna previa uma caixa `areaClienteVistos` com regra nova: **não é
preciso** com a 2A.6.

**Robô e robo-versao.** Nuvem: push + `robo-versao` com OK do dono. **Rodar só num lugar (nuvem)**.

**Testes.** vitest core (`guiasParaLembrar`: dias, abertas fora, sexta pega o fim de semana, guia vencida não lembra);
`node robo/teste-lembrete-guia.js` (começa travado; não manda duas vezes no dia).

**Como conferir.** Com a trava fechada e `ligado` no Ajustes, uma guia de teste vencendo em 2 dias → e-mail só para o
escritório.

**Critérios de aceite.** Só quem não abriu; um e-mail por empresa por dia com as guias juntas; nada sai com `ligado`
desligado.

**Riscos e armadilhas (das fontes).** "Sem o visto, sai para todos (vira spam)." "E-mail do cliente vem do cadastro e
pode estar errado; precisa trava de teste e freio diário como mandei.js. Rodar só num lugar (nuvem) para não duplicar
com o PC." "Push no iPhone só funciona com o site instalado como app (PWA), e o token do FCM expira e precisa de
renovação." "Um chip que manda aviso recebe respostas, e alguém tem de dizer 'não respondemos por aqui' para não virar
chat." "Sem a função 'Todas as guias', o aviso só cobre FGTS, DAS e DAE." "É preciso controle de 'já avisado hoje' (o
robo/avisosVencimento antigo serve de modelo) para não repetir." Lembrete: o registro de abertura por link pode dar
falso positivo (pré-visualização e antivírus abrem o link); que o manual do Acessórias avise disso é a confirmar.

**Dependências.** 2B.1 (cobertura das guias) e 2A.6 (o "só quem não abriu"). Se a ficha E01
(`E01-calendario-de-dias-uteis`, `packages/core/src/tarefas/regras/diasUteis.ts`, do `05-plano-lado-do-escritorio.md`)
já estiver feita, `guiasParaLembrar` usa `diasUteis.ehDiaUtil(iso, 'federal')` para fim de semana e feriado, em vez de
um cálculo próprio; se não estiver, siga como no passo 1 e anote no relatório para trocar depois.

---

## Fase 3: precisa de regra nova do banco (o Vitor publica)

**Como pedir a regra ao Vitor.** Cada ficha traz o texto proposto. As funções `membroNoNads()` e `ehDiretorNads()` são
as que aparecem no `docs/area-do-cliente/contrato.md` (regra da logo). As outras auxiliares do `firestore.rules` do
Entregas são **a confirmar** (o arquivo não está neste repositório). Lembrete para o Vitor (memória do projeto, 16/11):
**baixar a regra que está no ar antes de colar a nova**, porque publicar de uma cópia velha apaga o que outra sessão
publicou. Até a regra sair, a tela tem de dizer que ainda não está disponível (como o "Enviar logo" faz).

### 3.1 comunicados

- **id**: `comunicados`
- **Tamanho**: médio
- **Regras tocadas**: R1, R2, R3, **R4**, R7, R10, R12

**O que o cliente ganha.** O escritório publica avisos (recesso, mudança de lei, prazos) para todos ou para um grupo de
clientes, e o cliente lê na Área, no sino e no "Precisa de você" enquanto o aviso valer.

**Como é no Acessórias.** Mural de comunicados com envio segmentado por empresa, regime, grupo ou tag (p=93),
agendamento pela data de publicação e push na data (p=219). Fontes: app.acessorias.com/sysajuda.php?p=93 ; .../p=219.
O "relatório de leitura em Excel" **não está** nessas páginas (conferido em 17/11/2026): a confirmar.

**Como está hoje no NADS.** `EstadoDaArea.avisos` (`AvisoDoEscritorio`, `areaCliente.ts:62`) e o sino existem, mas o
banco não preenche. O mural da equipe é `nadsAvisos` (`apps/web/src/aplicativos/tarefas/dados/avisos.ts` e
`avisos.firestore.ts`), com fixar, PDF e "Recebido": **não misturar**.

**Passo a passo.**
1. **Core** `packages/core/src/areaCliente/comunicados.ts`: tipo `Comunicado { id, titulo ≤80, texto ≤600, alvo:
   { todos: true } | { regimes: string[] } | { codigos: number[] }, publicarEm 'aaaa-mm-dd', ate 'aaaa-mm-dd' }`,
   `erroDoComunicado(c)`, `comunicadosDoLink(lista, empresas, hoje)` e a projeção para o espelho (`{ id, titulo, texto
   }`). Exportar em `scripts/robo-danfse.mjs`.
2. **Equipe (Tarefas)**: tela "Comunicados aos clientes" dentro da Área do Cliente do Tarefas
   (`apps/web/src/aplicativos/tarefas/telas/area-cliente/Comunicados.tsx`, VM `useComunicados.ts`, dados em
   `tarefas/dados/areaCliente.ts` + `areaCliente.firestore.ts`). "Voltar" no canto superior esquerdo (R9). Só admin e
   diretor publicam.
3. **Robô (PC)** `area-cliente.js`: ouvir `areaClienteComunicados` e, em `espelhar`, gravar `resumo/comunicados {
   itens, atualizadoEm }` com `comunicadosDoLink`. Lista branca nova.
4. **Site**: `lerComunicados` em `espelho.ts` → `avisos` (sem `ir`, ou `ir: 'chamados'` só se o aviso pedir ação);
   `onSnapshot` de `resumo/comunicados` que não segura a tela.
5. "Li" do cliente e relatório de leitura: **fora da primeira versão** (seria o pedido marcado, como a 2A.6).

**Dado e caminho no banco.** `areaClienteComunicados/{id}` (interno, novo) e `areasCliente/{token}/resumo/comunicados`.

**Regra do banco proposta (o Vitor publica).**

    // 17/11/2026 (comunicados): os avisos do escritório para os clientes da Área do Cliente (o robô espelha por link)
    match /areaClienteComunicados/{id} {
      allow read: if membroNoNads();
      allow create, update: if ehDiretorNads()
        && request.resource.data.keys().hasOnly(['titulo', 'texto', 'alvo', 'publicarEm', 'ate', 'por', 'atualizadoEm'])
        && request.resource.data.titulo is string && request.resource.data.titulo.size() <= 80
        && request.resource.data.texto is string && request.resource.data.texto.size() <= 600
        && request.resource.data.alvo is map
        && request.resource.data.publicarEm is string && request.resource.data.publicarEm.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        && request.resource.data.ate is string && request.resource.data.ate.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
        && request.resource.data.por is string && request.resource.data.por.size() <= 120
        && request.resource.data.atualizadoEm is string;
      allow delete: if ehDiretorNads();
    }

**Robô e robo-versao.** Robô do PC (porta da fase 2A).

**Testes.** vitest core (alvo por regime e por código; fora do período não aparece; texto grande recusado);
`espelho.test.ts`; a VM `useComunicados`.

**Como conferir na tela.** Exemplo: `http://localhost:5178/cliente/exemplo/inicio` (o exemplo tem avisos). Equipe:
`npm run dev` → Tarefas › Área do Cliente › Comunicados (rota **a confirmar** quando a tela existir).

**Critérios de aceite.** O comunicado vai num sentido só; some depois do "até"; só aparece para o alvo.

**Riscos e armadilhas (das fontes).** "A coleção interna nova precisa de regra no firestore.rules, e quem publica é o
Vitor. Reaproveitar nadsAvisos com um campo 'para clientes' também depende de mexer na regra e mistura o mural da
equipe com o dos clientes. Não pode virar chat: o comunicado vai num sentido só, e a resposta continua pelo WhatsApp ou
numa solicitação. Para um 'push na data', a Área não tem app; o equivalente seria o WhatsApp do robô (Baileys), com
cuidado com o volume para o número não ser bloqueado."

**Dependências.** Regra do Vitor. Porta da fase 2A.

---

### 3.2 aceite-lgpd

- **id**: `aceite-lgpd`
- **Tamanho**: pequeno
- **Regras tocadas**: R1, R2, R3, R9, R12

**O que o cliente ganha.** No primeiro acesso, concorda com a política de privacidade do escritório, e o aceite fica
registrado por versão.

**Como é no Acessórias.** Aceite obrigatório da política do escritório no app e na área do cliente, com novo aceite a
cada versão e registro de consentimento. Fonte: app.acessorias.com/sysajuda.php?p=98. (A política do app deles põe o
escritório como controlador; não copie o texto, R12.)

**Como está hoje.** Não existe nada de privacidade ou aceite em `apps/web/src/aplicativos/cliente`, `mandei` nem em
`packages/core/src/areaCliente`.

**Passo a passo.**
1. **Bloqueante**: o texto da política é jurídico. **O escritório escreve e aprova** (a confirmar). Sem o texto, não
   comece.
2. **Core** `packages/core/src/areaCliente/privacidade.ts`: `VERSAO_DA_POLITICA`, `TEXTO_DA_POLITICA` (o do
   escritório) e `precisaAceitar(aceiteGravado, versao)`.
3. **Dois caminhos** (escolha com o Vitor):
   - **Sem regra nova** (precedente da DANFE): o aceite vai como pedido marcado em `areaClienteChamados` (`{ tipo:
     'outro', titulo: 'ACEITE', texto: 'politica:<versao>' }`); o robô do PC grava `resumo/aceite { versao, em }` no
     espelho e um registro interno. O site lê `resumo/aceite`. Funciona, mas depende do robô do PC e "registra o link,
     não a pessoa".
   - **Com regra nova** (a da lacuna): caixa `areaClienteAceites`, texto abaixo. O site ainda precisa saber se já
     aceitou: guardar no `localStorage` e, no banco, só o registro.
4. **Site**: `dados/areaCliente.firestore.ts` (`aceitarPolitica(token, versao)`), VM `useAreaCliente.ts` (decide se
   mostra a janela antes de tudo), tela: uma janela com o texto e "Concordo". O Mandei faz igual no formulário do link
   (`apps/web/src/aplicativos/mandei/`).

**Regra do banco proposta (caminho com regra; o Vitor publica).**

    // 17/11/2026 (aceite-lgpd): o aceite da política de privacidade pelo link da Área do Cliente (o cliente só cria)
    match /areaClienteAceites/{id} {
      allow create: if request.resource.data.keys().hasOnly(['token', 'versao', 'criadoEm'])
        && request.resource.data.token is string && request.resource.data.token.matches('^[0-9a-f]{40}$')
        && exists(/databases/$(database)/documents/areasCliente/$(request.resource.data.token))
        && request.resource.data.versao is string && request.resource.data.versao.size() <= 20
        && request.resource.data.criadoEm == request.time;
      allow read: if membroNoNads();
      allow update, delete: if false;
    }

**Robô e robo-versao.** Caminho sem regra: robô do PC. Caminho com regra: nenhum.

**Testes.** vitest core (`precisaAceitar` com versão nova); a VM (a janela aparece antes de tudo e some depois do aceite).

**Como conferir na tela.** `http://localhost:5178/cliente/exemplo/inicio` em janela anônima → a janela aparece →
"Concordo" → some.

**Critérios de aceite.** Versão nova pede aceite de novo; o modo desenvolvedor e a empresa de teste não gravam.

**Riscos e armadilhas (das fontes).** "Coleção nova gravável pelo cliente pede regra do banco (Vitor). O texto da
política é jurídico: o escritório precisa escrever/aprovar. Como o acesso é por link (sem login), o aceite registra o
link, não a pessoa." Mais uma janela na entrada vai contra R10: só aparece uma vez por versão.

**Dependências.** Texto do escritório; regra do Vitor ou robô do PC.

---

### 3.3 contatos-e-permissoes

- **id**: `contatos-e-permissoes`
- **Tamanho**: grande
- **Regras tocadas**: R1, R2, **R3**, R5, R7

**O que o cliente ganha.** Cada pessoa da empresa cliente (sócio, financeiro, RH) tem o próprio acesso e vê ou recebe
só o que é do setor dela.

**Como é no Acessórias.** Login por e-mail e senha por contato, com permissões por departamento e por obrigação, contato
que só consulta sem receber e-mail, e "Meus dados". Fontes: app.acessorias.com/sysajuda.php?p=230 ; .../p=63.

**Como está hoje.** A Área é um link secreto por empresa (`cliente/dados/perfis.ts` guarda os links no navegador; o banco
recusa token inválido); quem tem o link vê tudo. Os e-mails vão para o e-mail do Cadastro.

**Passo a passo.** **Não implementar sem um desenho aprovado pelo dono e pelo Vitor.** Esboço das fontes: pessoas por
empresa no Tarefas (nome, e-mail, setores, recebe e-mail); login por e-mail (link mágico do Firebase Auth) que resolve
para os tokens permitidos; o filtro por setor **no banco** (espelho separado por setor ou regras), não só na tela; os
robôs de envio usam os e-mails das pessoas do setor. Isso muda o `areaCliente.firestore.ts` ("o Auth nunca é
carregado", linha 3) e o contrato inteiro.

**Regra do banco.** Muda o modelo de segurança inteiro (do segredo do link para autenticação). O texto depende do
desenho: **a confirmar** com o Vitor.

**Riscos e armadilhas (das fontes).** "Muda o modelo de segurança inteiro (do segredo do link para autenticação), e as
regras ficam com o Vitor. Convivência com os links atuais. Recuperação de acesso. O filtro por setor precisa ser no
banco, não só na tela, senão quem tem o link vê tudo do mesmo jeito."

**Dependências.** Decisão do dono e do Vitor. Por último.

---

### 3.x Melhorias com regra nova, opcionais (das outras fichas)

| Ficha | Campo novo | Onde | Texto |
|---|---|---|---|
| 2A.2 o-que-falta-mandar | `competencia` opcional | `areaClienteEnvios` | na ficha 2A.2 |
| 1.2 / 2A.9 comprovante-da-guia | `guiaId` opcional (`^[A-Za-z0-9_-]{1,128}$`) | `areaClienteEnvios` | `&& (!('guiaId' in request.resource.data) \|\| (request.resource.data.guiaId is string && request.resource.data.guiaId.matches('^[A-Za-z0-9_-]{1,128}$')))` e `'guiaId'` no `hasOnly` |
| 2A.2 tipo "aplicação" | `tipo` aceita `'aplicacao'` | `areaClienteEnvios` | acrescentar `'aplicacao'` na lista de tipos da regra |
| 2A.6 comprovante-de-leitura | leitura pela equipe | `areaClienteLeituras` | na ficha 2A.6 |
| 2A.14 processos-visiveis | `passos` | `chamados` | na ficha 2A.14 |

---

## Fase 4: depende de decisão do dono ou de infraestrutura fora do ramo principal

### 4.1 guias-pelo-whatsapp

- **id**: `guias-pelo-whatsapp`
- **Tamanho**: médio
- **Regras tocadas**: R4, R7, **R8**, R11

**O que o cliente ganha.** A guia chega no WhatsApp com o link para baixar, sem a equipe mandar à mão.

**Como é no Acessórias.** Envio automático das guias pelo WhatsApp, com link e registro de leitura, também nos disparos
agendados. Fonte: acessorias.com/site/funcionalidade/ac-notifica/. (Não use o nome do produto deles, R12.)

**Como está hoje no NADS.** O robô Baileys (`robo/whatsapp.js` + `robo/whatsapp-regras.js`, commits 39c34195 e
3905c19d) **já está no `origin/desenvolvimento`** (conferido em 17/11/2026 com `git merge-base --is-ancestor`), com a
trava `LIBERADO_PARA_CLIENTES = false` em `robo/whatsapp-regras.js:8`, e o vigia de lá atende os pedidos `tipo ===
'whatsapp'` da fila `solicitacoesEmail` (`robo/vigia-robo.js` do `desenvolvimento`, linha 977). Ele **não** está no
`main` nem neste ramo (`mandei-area-cliente`, onde `robo/whatsapp.js` não existe). Se a VM já roda essa versão depende
do `robo-versao` (a confirmar). Hoje a via `'zap'` do lote só marca o Relatório (`robo/lote-fiscal.js`, função
`econtador` com `via = 'zap'`, linha 425; `entregue: 'zap'`, linha 448) e a mensagem é mandada à mão pelo `wa.me`
(`apps/web/src/aplicativos/tarefas/telas/fiscal/relatorio/useEnvioDeGuias.ts`).

**Passo a passo.**
1. **Decisão do dono**: implementar a partir do `desenvolvimento` (onde o Baileys já está; trazer o ramo de trabalho
   para cima dele é merge e precisa de autorização, R11) e o teste interno com o chip novo.
2. Com o Baileys no ramo de trabalho: em `lote-fiscal.js` e `lote-dp.js`, a via `'zap'` cria um pedido para o módulo do WhatsApp (fila
   `solicitacoesEmail` tipo `'whatsapp'`, como está no ramo) com o texto do modelo que já existe e o **link da Área do
   Cliente** (depende de 2B.1: a guia já está no espelho), em vez de só marcar o Relatório. O número vem do cadastro
   (`whatsapp`).
3. Ritmo lento e cota diária no módulo do WhatsApp.
4. Liberar a trava só depois do teste interno, com o OK do dono, e `robo-versao` (R7, R8).

**Regra do banco.** Não precisa.

**Robô e robo-versao.** Nuvem (o WhatsApp só no robô da nuvem, R8): push + `robo-versao`.

**Testes.** Os do Baileys (no `desenvolvimento` não há `robo/teste-whatsapp*.js`; os testes de site estão em
`apps/web/src/aplicativos/robos/dados/whatsapp.test.ts`; o teste do robô é **a confirmar**) + um teste de que a via
`'zap'` cria o pedido com a trava fechada.

**Critérios de aceite.** Com a trava fechada, só o número do escritório recebe; a mensagem traz o link, não o PDF
anexo; respostas do cliente não viram chat (mensagem fixa "não respondemos por aqui, fale no WhatsApp do escritório";
texto **a confirmar** com o dono).

**Riscos e armadilhas (das fontes).** "Chip novo pode ser banido por disparo em massa: precisa de ritmo lento e cota
diária. A sessão do Baileys cai e precisa de novo QR. O protocolo de leitura (ticks) é pouco confiável. Número errado no
cadastro manda guia para terceiro. Hoje o caminho é a trava ficar fechada." Nota: uma das fontes diz que o Baileys "não
existe em nenhum lugar do código"; ele existe no `origin/desenvolvimento` e nos ramos `claude/whatsapp-qr` e
`claude/whatsapp-qr-retomada`, não no `main` nem neste ramo.

**Dependências.** Baileys no ramo de trabalho (vem do `desenvolvimento`; merge com OK do dono). 2B.1.

---

### 4.2 honorarios

- **id**: `honorarios`
- **Tamanho**: grande (médio só com o boleto)
- **Regras tocadas**: R1, R2, **R6**, R7, R10

**O que o cliente ganha.** O boleto da mensalidade do escritório aparece como mais uma guia (PDF, linha digitável,
situação), e a NFS-e dos honorários fica na Central. Tira a 2ª via sem pedir ao Financeiro.

**Como é no Acessórias.** Não há módulo de cobrança do escritório aos clientes nas fontes públicas (o campo "honorário"
só alimenta a análise de lucratividade). A ideia vem do SCI, do Canopy, do TaxDome e do Ignition.

**Como está hoje no NADS.** Os dados existem no Financeiro: `financeiroBoletos` (PDF, linha, vencimento),
`financeiroRecebimentos` (pago ou em aberto) e `nfseEmissoes`. O tipo `'HON'` existe só em `TipoDoQuadradinho`
(`areaCliente.ts:65`). `EstadoDaArea.codigos` (linha digitável) existe, mas o espelho nunca preenche. O
`robo/boletos-financeiro.js` já manda os boletos por e-mail (trava liberada, linha 25).

**Passo a passo.**
1. **Decisão com o Vitor ou o Diretor** (dado do Financeiro). Sem ela, não comece.
2. **R6**: não mudar nenhuma leitura do Financeiro no site da equipe. O robô lê com Admin SDK.
3. **Core**: `TipoDeGuia` ganha `'HON'`; a guia ganha `codigoDeBarras?` (a linha digitável), que `lerGuia` lê e
   `estadoDoEspelho` põe em `area.codigos`.
4. **Robô (PC)** `area-cliente.js`: pega `financeiroBoletos` do contrato da empresa (`contratoId` →
   `financeiroHonorarios.codigo`, que é texto, comparado com os códigos do link), junta o PDF de `partes/{n}` e grava
   `guias/hon-{AAAA-MM}-{cód}` com o PDF em pedaços.
5. A situação "pago" depende do `pagoEm` da 2A.11 (vindo de `financeiroRecebimentos`).
6. NFS-e: `documentos/{id}` tipo `nfse`, desenhada do XML de `nfseEmissoes` com `robo/gerado/danfse.js`
   (`desenharDanfse`); pasta nova na biblioteca. **Só depois do boleto.**

**Regra do banco.** Não precisa (`guias/*` e `documentos/*`).

**Robô e robo-versao.** Robô do PC.

**Testes.** vitest core (o tipo HON, o código de barras); `espelho.test.ts`; `node robo/teste-area-cliente.js`.

**Como conferir na tela.** Pôr um boleto HON no exemplo e abrir `http://localhost:5178/cliente/exemplo/guias`.

**Critérios de aceite.** Só os boletos da própria empresa; nenhuma leitura nova no Financeiro da equipe.

**Riscos e armadilhas (das fontes).** "É dado do Financeiro: decidir com o Vitor ou o Diretor antes. A situação
'pago/em aberto' não cabe na GuiaDoCliente (só a vencer, vence hoje ou vencida) e depende da mesma mudança de pagoEm da
guia paga. O recebimento é marcado à mão no Financeiro: atraso na marcação faz o cliente ver 'em aberto' depois de
pagar, o que gera atrito de cobrança. O próprio core diz que o honorário 'não tem vencimento: não existe atrasado', mas o
boleto tem, então é preciso escolher qual verdade mostrar. Só o boleto seria médio; a NFS-e torna grande."

**Dependências.** Decisão do Vitor/Diretor. 2A.11 para a situação.

---

## Descartados e fora do plano

### xmls-do-mes (descartado: fere R5)

**O que era.** Um botão "Baixar XMLs de <mês>" que pedia ao robô o `.zip` com os XMLs das notas, como a DANFE.

**Por que sai.** "Os XMLs trazem o CPF ou CNPJ do destinatário de cada nota, inclusive o CPF do consumidor nas NFC-e, e
iriam para o espelho em lote. A regra do dono ('nunca CPF/CNPJ de compradores no espelho') bate de frente. A DANFE de uma
nota só é um precedente, mas o .zip do mês inteiro é bem mais exposição." Também: "Um mês de varejo com milhares de
NFC-e dá vários MB, ou seja, muitos pedaços de 700 KB no Firestore." Só volta com o OK explícito do dono, e por outro
caminho que não passe pelo espelho (a confirmar).

### tipos-de-pedido-configuraveis (descartado: R5, R10 e regra do banco, ganho baixo)

**O que era.** O escritório criaria pela tela novos tipos de solicitação, com campos próprios e anexo obrigatório
(hoje fixos em `TIPOS_DE_CHAMADO`, `packages/core/src/areaCliente/chamados.ts`, e `MODELOS_DE_TICKET` em
`packages/core/src/mandei/modelos.ts`).

**Por que sai.** "A regra do banco hoje confere as chaves exatas do areaClienteChamados: campos livres exigem mudar a
regra." "Campo CPF/CNPJ livre pode trazer CPF de comprador/funcionário, contra a restrição do dono." (R5) "Ganho baixo
para o escritório do tamanho atual." Formulário dinâmico também vai contra R10.

### previa-do-das (fora do plano: não fere regra, mas o custo-benefício é o pior)

**O que era.** Antes de a guia chegar, mostrar "previsto: R$ X (estimativa)" do DAS, calculado pelo faturamento
(`previaDoDas` em `packages/core/src/tarefas/sieg/simples.ts`).

**Por que fica fora.** "O resumo/faturamento soma só NF-e e NFC-e: a NFS-e não entra. Então para empresa de serviço
(Anexos III, IV e V) a prévia sairia errada ou zerada. O RBT12 não é automático: depende de o Fiscal digitar na tarefa
… Fator R, sublimite, ISS fixo e monofásico mal classificado erram o número. Um valor errado mostrado ao cliente gera
cobrança no WhatsApp e desgaste, mesmo com o rótulo 'estimativa'. A janela é curta: o DAS costuma chegar pelo lote logo
depois do PGDAS. Dos seis, é o de pior custo-benefício." Pode voltar se o dono pedir.

---

## Ordem sugerida e checklist de cada entrega

**Ordem sugerida** (cada linha é uma entrega separada, com o seu `npm run verificar` e o OK do dono para commit):

1. 1.1 aviso-de-resposta (A) e 1.2 comprovante-da-guia (A): só site.
2. Conferir o robô do PC (`robo/painelPC`, `versao`). Parado: avisar o dono e seguir só com o código e os testes da
   fase 2A, sem publicar.
3. 2B.1 todas-as-guias (nuvem; o maior ganho do cliente).
4. 2A.1 certificado-digital, 2A.2 o-que-falta-mandar (a correção primeiro), 2A.3 pedidos-do-mandei.
5. 2A.6 comprovante-de-leitura → 2B.3 lembrete-de-vencimento → 2B.2 aviso-de-resposta (B).
6. 2A.4 documentos-do-escritorio, 2A.5 dados-cadastrais, 2A.7 certidoes, 2A.8 confirmar-entrega.
7. 2A.9, 2A.10, 2A.11, 2A.12, 2A.13 (com OK de privacidade), 2A.14 (com OK do dono), 2A.15 (2027).
8. Fase 3 conforme o Vitor publicar as regras; fase 4 conforme o dono decidir.

**Checklist de cada entrega (copie no PR ou na mensagem ao dono).**
- [ ] Regra pura no core ou em `dados/*.ts`, com teste vitest (R1).
- [ ] Firebase só em `*.firestore.ts`; `npm run conexoes` limpo (R2).
- [ ] Comentários em português com a data e a frase do dono (R1).
- [ ] Dado de exemplo em `areaCliente.memoria.ts` para a tela nova.
- [ ] Função do core usada pelo robô exportada em `scripts/robo-danfse.mjs` e `npm run robo:danfse` rodado.
- [ ] Teste do robô (`node robo/teste-*.js`) quando mexer no robô.
- [ ] Nada de CPF/CNPJ de comprador, CPF completo de funcionário ou motivo de afastamento no espelho (R5).
- [ ] Nada que vire chat (R4); e-mail e WhatsApp ao cliente com trava `LIBERADO_PARA_CLIENTES = false` (R8).
- [ ] Item novo só aparece quando há o que fazer (R10); "Voltar" no canto superior esquerdo (R9).
- [ ] Textos próprios do NADS, sem nomes nem telas do Acessórias (R12).
- [ ] Regra nova? O texto foi para o Vitor e a ficha está marcada como dependente (R3).
- [ ] Robô do PC: `robo/painelPC.versao` conferido. Robô da nuvem: `robo-versao` trocado com o OK do dono (R7).
- [ ] `npm run verificar` limpo; nenhum commit, push, merge ou `npm run sites` sem o OK explícito do dono (R11).

**Ids das fichas deste plano:** `aviso-de-resposta`, `comprovante-da-guia`, `certificado-digital`,
`o-que-falta-mandar`, `pedidos-do-mandei`, `documentos-do-escritorio`, `dados-cadastrais`, `comprovante-de-leitura`,
`certidoes`, `confirmar-entrega`, `avaliacao-do-atendimento`, `guia-paga-confirmada`, `parcelamentos`,
`informe-e-folha-antiga`, `processos-visiveis`, `relatorio-de-impostos`, `todas-as-guias`, `lembrete-de-vencimento`,
`comunicados`, `aceite-lgpd`, `contatos-e-permissoes`, `guias-pelo-whatsapp`, `honorarios`. Descartados:
`xmls-do-mes`, `tipos-de-pedido-configuraveis`; fora do plano: `previa-do-das`.


