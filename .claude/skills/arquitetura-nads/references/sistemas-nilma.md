# Os sistemas da Nilma hoje

Retrato de setembro de 2026. Confira a versão atual (`git pull`) antes de confiar em número de linha.

**Isto descreve o original, para entender o código.** Projetos, coleções e serviços citados aqui são
do sistema real: o nads não se conecta a nenhum deles (`banco-intocavel.md`). Não abra os apps com banco
no navegador para "ver como é": leia o código.

## Índice
1. Repositórios e arquivos
2. Firebase: dois projetos
3. Login e papéis
4. Dados (coleções)
5. Estilo do código e onde cada coisa mora
6. Robôs (Node)
7. Versão, publicação e modo demonstração

---

## 1. Repositórios e arquivos

| Repositório | Pasta local | Publicado em | O que tem |
|---|---|---|---|
| `nilmaadvancedsystems/contabil-htmls` | `CLAUDE_DRIVE\contabil-htmls` | Conferência: Firebase Hosting `conferencia-nilma.web.app` | `conferencia.html`, `conciliadorZINHO.html`, `cheque_especial.html`, `leitorSINTEGRA.html` |
| `nilmaadvancedsystems/Entregas` | `CLAUDE_DRIVE\Entregas` | GitHub Pages (`…github.io/Entregas/entregas.html`); push na `main` já publica | Entregas, Pendências, Tarefas, LCDPR, portal do cliente, Contábil embutido, robôs |
| `nilmaadvancedsystems/nads` | `CLAUDE_DRIVE\nads` | ainda não | o app novo |

**Conferência**: o arquivo que se edita é `C:\Users\Vitor\Downloads\conferencia.html`. Cada mudança é
copiada para `contabil-htmls\conferencia.html`, para `AppData\Local\Temp\conciliador-rules\public\index.html`
(de onde sai o deploy) e regenera a skill design-n1. As três cópias são iguais byte a byte.

| Arquivo | Linhas | Sistema |
|---|---:|---|
| `conferencia.html` | ~4.800 | Conferência Contábil (notas × balancete por empresa) |
| `conciliadorZINHO.html` | ~2.300 | Conciliação de cartões (Cielo, Rede, Getnet, Stone, PagBank) × vendas |
| `cheque_especial.html` | ~800 | Lançamentos de ajuste de saldo bancário negativo |
| `leitorSINTEGRA.html` | ~1.500 | Leitor e validador de arquivo Sintegra (registros de 126 colunas) |
| `Entregas/entregas.html` | ~15.300 | Entregas + Clientes e ajustes + telas públicas (`?assinar=`, `?rota=`, `?convite=`) |
| `Entregas/Pendencias-e-envio-automatico-via-Gmail.html` | ~9.300 | Pendências (documentos do mês, robô do Gmail, cobrança, arquivo) |
| `Entregas/tarefas.html` | ~2.900 | Tarefas e requisições por empresa |
| `Entregas/lcdpr.html` | ~1.800 | Importador LCDPR (Fiscal) |
| `Entregas/cliente.html` | ~1.300 | Portal do cliente (público, por token `?portal=`) |
| `Entregas/conciliador.html`, `cheque-especial.html` | | Cópias das ferramentas contábeis, abertas em `<iframe>` dentro do Entregas |

Arquivos compartilhados do Entregas, todos globais em `window`:

| Arquivo | Expõe | Vira no nads |
|---|---|---|
| `nilma-shell.js` | `NilmaShell` (cabeçalho, barra lateral, gaveta ☰, menu da conta) | `packages/ui` → `<Casca>` |
| `nilma-config.js` | `NilmaConfig` (janela de Configurações do usuário) | tela `conta/configuracoes` |
| `nilma-dialogo.js` | `NilmaDialogo.confirmar/perguntar` | `packages/ui` → `useRetorno()` |
| `nilma-extras.js` | `NilmaExtras` ("Perguntar à IA", conta) | módulo `ia` |
| `nilma-solicitacoes.js` | `NilmaSolicitacoes` | módulo `entregas/solicitacoes` |
| `nilma-ui.js` | tema antes do primeiro desenho | `packages/ui` → tema |
| `bancos-nilma.js` | `BancosNilma` (UMD; os robôs usam também) | `packages/core/bancos` |
| `nilma-ui.css` | gerado a partir do entregas.html | substituído pelo design-n1 |

## 2. Firebase: dois projetos

| | Conferência | Entregas (e o resto) |
|---|---|---|
| Projeto | `conferencia-nilma` | `entregas-2e5e2` |
| SDK | compat 10.12 (CDN) | compat 10.14 (CDN); `cliente.html` usa firestore-lite modular |
| Login | **nenhum** (a "entrada" só escolhe a empresa) | e-mail/senha, com e-mail montado do nome |
| Regras | **abertas** (`allow read, write: if true`) | por papel, nega tudo por padrão |
| Plano | | gratuito (Spark), segundo `backup-firestore.js`; sem Cloud Functions |

O `firebaseConfig` está colado em cada página do Entregas (entregas, Pendências, tarefas, lcdpr,
conciliador, cheque-especial, cliente). **Ele não vai para o nads.**

Apps que abrem conexão com o banco ao carregar: `conferencia.html` (ouve `empresas` inteira),
`entregas.html`, Pendências, `tarefas.html`, `lcdpr.html`, `cliente.html`, e as cópias
`Entregas/conciliador.html` e `cheque-especial.html` (carregam o Firebase para a sessão).
**Sem banco:** `contabil-htmls/conciliadorZINHO.html`, `cheque_especial.html` e `leitorSINTEGRA.html`.
Confira com `grep -i firebase` antes de abrir qualquer um.

## 3. Login e papéis (Entregas)

- **Entrar:** "Nome" + "Senha". `emailFromNome()` transforma "Maria Souza" em `maria.souza@nilma.local`;
  com "@" no campo, usa o e-mail como veio (conta antiga). Depois é `signInWithEmailAndPassword`.
- **Criar conta:** o admin cria com `criarContaEquipe()`, usando uma segunda instância do Firebase para
  não perder a própria sessão. Existe também convite por link (`?convite=`). Trocar senha e apagar conta
  passam por um Google Apps Script (o navegador não tem poder de admin).
- **Papéis:** `usuarios/{uid}.roles[]`: `admin`, `office_boy`, `contabil`, `fiscal`, `equipe_geral`,
  `dp` (Tarefas) e `staff` como piso. Na tela: `temPapel(r)`. No banco: `meusPapeis()` nas regras.
- Tarefas, LCDPR e as ferramentas contábeis não têm tela de login: usam a sessão do Entregas.

## 4. Dados (coleções)

**Conferência** (`conferencia-nilma`): uma coleção, `empresas/{slug(nome)}`, com **um documento gordo por
empresa**: balancete (`contas`), notas (`entradas`, `saidas`, `servTomados`, `servPrestados`), vínculos
(`naturezaConta`, `dp`, `servCat`, `vendaVista`), marcas de conferência (`confMarcados`,
`verifConta`…), histórico (`confHistorico`, `importHistorico`) e opções (`prestaServico`,
`autoLimparBalancete`…). A função `norm()` migra campos antigos na leitura. A empresa grande corre o
risco de estourar o limite de 1 MiB por documento.

**Entregas** (`entregas-2e5e2`), as principais:
- Clientes e entregas: `clientes`, `entregas` (com subdoc `anexos/comprovante`), `competenciasFechadas`.
- Rota e portal: `rotaLinks`, `assinaturas`, `portais/{token}` (projeção pública), `pedidosDoPortal`, `enviosDoPortal`.
- Pedidos: `solicitacoes`, `solicitacoesEmail` (fila do robô do Gmail).
- Pessoas e trabalho: `usuarios`, `tarefas`, `conciliacoes`.
- Configuração e apoio: `config/*` (`config/cobranca`, `lcdpr/config`…), `robo`, `driveIndice`, `conversasIA`.

Projeções (`portais`, `rotaLinks`, `clientes.entrega`) são mantidas **pelo navegador**, a partir de
várias telas e do robô. Na cópia, isso vira função do repositório em memória, chamada num lugar só.

## 5. Estilo do código e onde cada coisa mora

Todos seguem o mesmo molde: CSS e HTML no arquivo, e **um `<script>` com uma IIFE gigante**
(`(function(){ "use strict"; … })()`), com `var` de cima como estado global e seções separadas por
comentário (`/* ===== x ===== */` ou `// ---------- x ----------`). Não há framework nem módulos.

| O que | Conferência | Entregas |
|---|---|---|
| Estado global | `dados`, `atual`, `emp()` (= `dados[atual]`), `view`, `ccState`, `vc`, `filtro`, `reimp`… (~54) | `clientesCache`, `pendentesCache`, `selectedClienteId`, `currentUserRoles`… (~195) |
| Constantes/tabelas | `CLIENTES` (~230 empresas), `CFOP_DESC`, `SERV_CAT`, `SECOES`/`VIEWS` | `DOC_TIPOS`, `CARGOS`, `VENCIMENTO_AUTOMATICO_`, `MODULOS_PADRAO` |
| Ler arquivo | SheetJS: `sheet()`, `lerNotas`, `lerBalancete`, `lerServicos`, `vcLerRazao` | PDF: `extrairCompetencia_`, `extrairVencimento_`, `extrairCodigoPagamento_` |
| Banco | só `save(nome)` (grava o documento inteiro, ~40 chamadas) e um `onSnapshot` na coleção toda | `subscribeXxx()` por aba, `saveEntregaComAnexos`, `escritaQueNaoTrava_` |
| Desenhar | ~40 `render*` com `innerHTML` + `esc()` | `innerHTML` (222×) e `render*`; Tarefas usa um construtor `el()` |
| Eventos | delegação por `data-*` (`data-ir`, `data-sec`…), 64 `addEventListener` | 379 `addEventListener`, `NilmaShell.ao(...)` |
| Navegação | `SECOES` → `go(v)`, `aplicarBloqueios()` | abas `#tabsNav`, `#abasSecao`, `abrirModuloInicial_()` |
| Utilitários | `brl`, `esc`, `num`, `slug`, `nomeNorm`, `toast`, `modal` (Promise), `dl()` (CSV) | `fmtMoney`, `escapeHtml_`, `semAcento_`, `showToast`, `aoParar` |

Os pontos difíceis, com o corte de cada um, estão em `receitas-de-divisao.md`.

Ferramentas sem banco (conciliador, cheque especial, Sintegra) são quase todas regra pura mais
leitura/geração de arquivo: são as mais fáceis e as melhores para começar.

## 6. Robôs (Node, `Entregas/scripts/`)

- Node CommonJS com `firebase-admin`, `googleapis`, `@google/genai`, `pdf-parse` e `xlsx`.
- Rodam numa VM do Google (e2-micro, `robo.service` → `vigia-robo.js`) e no PC do escritório
  (`arquivador.js`). `lideranca.js` decide quem manda.
- Candidatos a Cloud Function (gatilho ou agenda): portal, avisos push, lembretes, vencimentos, CNPJ,
  resumo semanal, backups e o serviço de contas (hoje no Apps Script).
- Continuam como processo: o robô do Gmail (token OAuth de usuário, longo), o arquivador (drive G: local
  + rotina do Claude), o índice do Drive e a IA atendente.

**Os robôs não entram no nads e não são executados.** Na cópia, o que eles fariam aparece como aviso
ou dado de exemplo (`servicos.memoria.ts`).

## 7. Versão, publicação e modo demonstração

- Versão à mão: `VERSAO_APP_ = '2.xxx · dd/mm/aaaa'` (Entregas), `APP_VERSION = 'beta 0.1.xx'`
  (Conferência). Chave de cache `?v=` à mão em cada `<link>`/`<script>`. Nota no README a cada versão.
- `?demo=1` (só entregas.html): troca as gravações por nada (`travarEscritasDaDemonstracao_`) e semeia
  dados falsos. Mesmo assim ele **conecta** ao Firebase para o login: não use para comparar. A ideia de
  semear dados falsos é o que o nads faz sempre (`repo.memoria`).
- Contador de leituras: `envolverLeituras_()` remenda o `get`/`onSnapshot` do Firestore. Na cópia não
  existe (receita 10).
