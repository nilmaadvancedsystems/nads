# Receitas de divisão: como cortar o que está misturado

Cada receita é um padrão que o inventário marca como **MISTA** nos nossos sistemas. O caso real vem
com arquivo e linha aproximada (setembro/2026). Regra geral: primeiro descubra **a pergunta de negócio**
que a função responde; ela vira a regra do Model. O resto é quem pergunta (ViewModel) e quem mostra
(View).

## Índice
1. Render que calcula
2. Render que grava
3. Algoritmo dentro de um clique
4. Importar que faz tudo
5. Regra que lê o estado global
6. Mutação no lugar + salvar tudo
7. Ouvinte que grava projeção
8. Modal decidindo regra
9. Trava que mexe na tela e no estado
10. Remendo no Firestore (contador, demonstração) — some na cópia
11. Ferramenta dentro de iframe
12. Constantes e tabelas embutidas
13. Mesma função em vários arquivos

---

### 1. Render que calcula
**Caso:** `renderCcBalancete` (conferencia ~L3508): soma notas, busca saldo, decide Ok/diferença/
Conferido e monta a `<tr>`. Também `renderRota` (entregas ~L7423): ordena, agrupa e soma enquanto desenha.
**Corte:**
- Model: `linhasDoSaldo(empresa, aba)` + `situacaoDaConta(...)` devolvem dados (ver `camadas.md`).
- ViewModel: junta com `useMemo`.
- View: `<Tabela>` + `<BadgeSituacao>`.
**Sinal de que ficou certo:** dá para testar "conta com diferença de 0,009 é Ok" sem React.

### 2. Render que grava
**Caso:** `renderGeral` (conferencia ~L3593) → `autoMarcarConferidos` → `save()`;
`renderChecklistNatureza` idem. Abrir a tela grava no banco.
**Corte:**
- Model: `quaisMarcarSozinho(empresa, periodo): string[]` (pura).
- ViewModel: ação `sincronizarMarcasAutomaticas()` num `useEffect` que dispara quando a lista muda e
  só grava a diferença (`repo.marcarAutomaticos(id, chaves)`).
- View: só desenha.
Anote no `mapa.md`: é o tipo de efeito que ninguém lembra que existe.

### 3. Algoritmo dentro de um clique
**Caso:** "Verificar conta" (conferencia ~L3980): o cruzamento notas × razão (faltando, duplicadas,
a mais, ICMS) está inteiro dentro de `$('#vcBtConferir').onclick`, com `setTimeout` e leitura do DOM.
Também o `submit` do `form-nova` (entregas ~L4663): valida, aplica competência fechada, monta a
entrega, grava, atualiza zona/geo do cliente, avisa e limpa.
**Corte:**
- Model: `conferirConta({ notas, razao, contas }) → { faltando, duplicadas, aMais, icms, diferenca, semExplicacao }`
  com os testes das regras escritas na design-n1 (§6: duplicada decidida pelo valor, nota com dois CFOP,
  ICMS…). Para a entrega: `montarEntrega(form, cliente, competenciasFechadas) → Entrega | Erro`.
- ViewModel: `conferir()` lê o arquivo (via core), chama a regra, guarda o resultado e decide Ok/Conferido.
- View: formulário, resumo, seções.

### 4. Importar que faz tudo
**Caso:** `importar()` / `importarServ()` (conferencia ~L2856/L4311): lê a planilha, valida o tipo,
compara a assinatura da empresa, pergunta o modo, mescla, deduplica, registra o histórico, grava e
monta a mensagem.
**Corte (esta ordem vale para toda importação):**
1. Model `arquivos/`: `lerNotas(linhas) → Leitura<Nota[]>`.
2. Model `regras/`: `validarImportacao(leitura, empresa) → ok | 'outro-tipo' | 'outra-empresa'`.
3. ViewModel: pergunta (`confirmar`) se já existe dado → `modo`.
4. Model `regras/`: `mesclarNotas(existentes, novas, modo) → { notas, gravadas, jaExistiam, foraDoPeriodo }`.
5. Model `repo`: `gravarNotas(...)` grava e registra o histórico numa operação.
6. ViewModel: `toast` com os números; View mostra o `.imp-dados`.

### 5. Regra que lê o estado global
**Caso:** `padraoPorCfop`, `acharDivergencias`, `nomeConta`, `saldoAtualizado`, `ctxVista` chamam `emp()`
(= `dados[atual]`); `noPeriodoCc` lê `ccState`. No Entregas, `clientesCache`, `competenciasFechadas`.
**Corte:** tudo que a regra lê vira parâmetro. Se ficar com muitos parâmetros, passe a entidade
(`empresa: EmpresaConferencia`) ou um contexto pequeno (`{ periodo, vendaVista }`). O inventário mostra
o que cada função lê na coluna "Estado global".

### 6. Mutação no lugar + salvar tudo
**Caso:** a Conferência muda `emp().x` em ~40 lugares e chama `save()`, que regrava **o documento
inteiro** da empresa. Dois usuários ao mesmo tempo = o último apaga o outro.
**Corte:** cada ação do usuário vira um método do repositório (em memória) com o que mudou
(`marcarConferido(id, chave, true)`). Regras nunca mutam: devolvem o valor novo. No comentário do
repositório, registre que o original regravava o documento inteiro. Isso é conhecimento, não tarefa:
não existe banco na cópia.

### 7. Ouvinte que grava projeção
**Caso:** `aoChegarClientes_` chama `sincronizarRotaLinks_`; `saveEntregaComAnexos` atualiza o portal
(`portalMudou_`, `guardarComprovanteNoPortal_`); `processarFilaPortal_` usa uma fila em `localStorage`.
**Corte:** a projeção é responsabilidade do **repositório** que grava a origem
(`repoEntregas.salvar()` também atualiza a projeção do portal, em memória). A regra de *o que* projetar
é pura (`projecaoDoPortal(entrega, cliente)`). Assim o portal de exemplo na cópia mostra o que a entrega
de exemplo gerou, como no original.

### 8. Modal decidindo regra
**Caso:** `modal()` com Promise em conferencia (~L2916: "Sobrepor o movimento · Importar apenas
novas"), `NilmaDialogo.confirmar` no Entregas, a pergunta obrigatória "Esta empresa presta serviço?".
**Corte:** a pergunta é do ViewModel (`useRetorno().confirmar`), a resposta vira parâmetro da regra.
A resposta que precisa ser lembrada (presta serviço) vai para o repositório.

### 9. Trava que mexe na tela e no estado
**Caso:** `aplicarBloqueios` (conferencia ~L1838) apaga abas, corrige `confAbaAtual`/`consultaTipo` e
um listener em captura barra o clique. No Entregas, `startApp` esconde cartões por papel (`$('iaCard').hidden = !temPapel('admin')`).
**Corte:**
- Model: `travasDaEmpresa(empresa)` e `podeVer(papeis, recurso)`.
- ViewModel: devolve `travas`/`permissoes` e corrige a aba aberta se ficou travada.
- View: aba apagada com o aviso da design-n1 ("… ainda não importadas" + botão).
- Rota protegida por papel na `navegacao.ts`.

### 10. Remendo no Firestore (contador, demonstração) — some na cópia
**Caso:** `envolverLeituras_()` remenda `get`/`onSnapshot`; `travarEscritasDaDemonstracao_()` troca as
gravações por nada; `enablePersistence`; a "Saúde do sistema" mostra leituras do dia.
**Corte:** nada disso existe na cópia: o `repo.memoria` semeado **é** o modo demonstração, o tempo
todo. Telas que mostram números do banco (Saúde do sistema, contador de leituras, aviso do robô) ficam
com valores de exemplo e o selo "cópia". Anote no mapa, em "O que na cópia fica simulado".

### 11. Ferramenta dentro de iframe
**Caso:** Conciliadorzinho e Cheque especial abertos em `<iframe>` no Entregas (`?embutido=1`).
**Corte:** viram módulo normal (`/contabil/conciliacao-cartoes`, `/contabil/cheque-especial`), com
domínio próprio no core. O iframe some. As cópias duplicadas (`contabil-htmls` × `Entregas`) viram uma
só: confira qual é a mais nova (`git log`) e anote a escolha no mapa.

### 12. Constantes e tabelas embutidas
**Caso:** `CLIENTES` (~230 empresas no código), `SEED`, `CFOP_DESC`, `SERV_CAT` (lançamentos fixos 527,
160, 42…), `DOC_TIPOS`, `VENCIMENTO_AUTOMATICO_`, `CARGOS`.
**Corte:**
- Tabela fixa de domínio (CFOP, categorias, tipos de documento) → `packages/core/<dominio>/tabelas.ts`,
  tipada.
- Dado que muda com o tempo (lista de clientes) → `__exemplos__/` do repositório em memória, com
  nomes e CNPJs de exemplo. A lista real de ~230 empresas **não** vai para o repositório nads: é dado de
  cliente.
- Navegação (`SECOES`, `VIEWS`, `MODULOS_PADRAO`) → `navegacao.ts` do módulo.

### 13. Mesma função em vários arquivos
**Caso:** `esc`/`escapeHtml_`, `brl`/`fmtMoney`, `toast`/`showToast`, `excelSerialToDate`, CSV com BOM,
tema e ícones, repetidos em cada HTML; `firebaseConfig` e `emailFromNome` copiados em várias páginas.
**Corte:** uma vez só, em `packages/core/formatos` (texto e número) ou `packages/ui` (toast, tema,
ícones). Antes de criar, procure se já existe. Versões diferentes da "mesma" função (ex.: arredondamento)
são um aviso: teste as duas com os mesmos casos e anote a diferença no mapa.
O `firebaseConfig` (chave, projeto, appId) **não é copiado para lugar nenhum** do nads, nem em
comentário: a cópia não conecta a banco.
