# Estrutura do nads

## Índice
1. Pastas
2. Pacotes e quem pode importar quem
3. Domínios do `packages/core`
4. Módulos e rotas do `apps/web`
5. Ferramentas
6. Nomes e idioma
7. Montar do zero

---

## 1. Pastas

```
nads/
├─ apps/
│  └─ web/                        o app único (Vite + React + TS)
│     └─ src/
│        ├─ main.tsx              entra: providers (Query, tema, retorno) + roteador
│        ├─ rotas.tsx             todas as rotas, na ordem da navegação
│        ├─ dados/repo.tsx        liga o React ao repositório (useSyncExternalStore)
│        └─ modulos/
│           └─ <modulo>/          o molde completo está em padrao-de-tela.md
│              ├─ navegacao.ts    seções/páginas do módulo (o antigo SECOES / MODULOS_PADRAO)
│              ├─ sessao.tsx      estado da sessão (as antigas globais) + irPara()
│              ├─ topo.tsx        <AcoesDoTopo>
│              ├─ useCasca<M>.ts · Casca<M>.tsx · <Rota>.tsx
│              └─ <tela>/
│                 ├─ use<Tela>.ts      ViewModel
│                 ├─ <Tela>.tsx        View
│                 └─ partes/           pedaços de View só desta tela
├─ packages/
│  ├─ core/                       Model — TypeScript puro, roda no navegador e no teste; SEM Firebase
│  │  └─ src/
│  │     ├─ <dominio>/
│  │     │  ├─ tipos.ts           entidades e valores do domínio
│  │     │  ├─ regras/            funções puras (+ .test.ts ao lado)
│  │     │  ├─ arquivos/          ler/gerar planilha, PDF, TXT (SheetJS etc.)
│  │     │  ├─ repo.ts            interface do repositório (o que a tela pode pedir/gravar)
│  │     │  ├─ repo.memoria.ts    a ÚNICA implementação: dados em memória (+ localStorage)
│  │     │  ├─ servicos.memoria.ts respostas fixas no lugar de CNPJ, mapa, IA, e-mail…
│  │     │  └─ __exemplos__/      dados de exemplo anonimizados (escritos à mão ou de arquivo do usuário)
│  │     ├─ formatos/             brl, datas, competência, normalizar texto, CSV
│  │     └─ index.ts              exporta só o que é público
│  └─ ui/                         View compartilhada — design-n1 em React
│     └─ src/
│        ├─ tokens.css            as variáveis de cor/tamanho do design-n1 (claro/escuro)
│        ├─ componentes/          Botao, Caixa, Tabela, Badge, Segmentado, CampoArquivo, Casca…
│        ├─ retorno/              useRetorno(): toast, confirmar, alerta (o modal() antigo)
│        ├─ icones/               o mapa ICONS (traço 1,75)
│        └─ index.ts
├─ docs/
│  └─ migracao/<repo>/            inventários e mapa de cada sistema copiado
├─ scripts/sem-rede.mjs           checagem: nada de Firebase nem rede para fora (roda no verificar)
├─ package.json                   workspaces + scripts da raiz
└─ tsconfig.base.json
```

## 2. Pacotes e quem pode importar quem

| Pacote | Pode importar | Não pode |
|---|---|---|
| `@nads/core` | `xlsx` e bibliotecas puras | `react`, `@nads/ui`, `document`/`window` (só `localStorage` no repo em memória), **`firebase`** |
| `@nads/ui` | `react` | `@nads/core` de domínio, `firebase` |
| `apps/web` — hooks `use*.ts` | `@nads/core`, a sessão do módulo, `@nads/ui` (só hooks: `useRetorno`, `useTema`) | JSX, `document` |
| `apps/web` — `*.tsx` | o próprio hook da tela, `@nads/ui`, tipos e formatos do `@nads/core` | `repo*` e `regras/` do core |
| **todos** | | `firebase`, `firebase-admin`, `@firebase/*`, `googleapis`, SDK de IA, `fetch`/`XMLHttpRequest` para fora do próprio site |

O lint (`no-restricted-imports` por pasta, na raiz) garante a tabela. Se precisar furar, a estrutura
está errada: mova o código, não o lint.

Por que a View pode importar **tipos e formatos** do core: `brl(valor)` e `Conta` não são regra de
negócio, e duplicá-los no ui seria pior.

## 3. Domínios do `packages/core`

Um domínio = um assunto do escritório, não uma tela. Várias telas usam o mesmo domínio (a ficha do
cliente aparece em Entregas e em Pendências).

| Domínio | De onde vem | Exemplos |
|---|---|---|
| `empresas` | Conferência (`CLIENTES`, `empresas/`), Entregas (`clientes`) | cadastro, código ERP, busca por código/nome |
| `conferencia` | conferencia.html | balancete, notas, naturezas de CFOP, situação da conta, verificar conta, auditoria |
| `servicos-notas` | conferencia.html (Tomados/Prestados) | categorias fixas (`SERV_CAT`), ISS |
| `conciliacao-cartoes` | conciliadorZINHO | extratos por bandeira, cruzamento FIFO, saídas |
| `cheque-especial` | cheque_especial | saldos diários, lançamentos de ajuste/estorno, dia útil |
| `sintegra` | leitorSINTEGRA | layout de 126 colunas, validações, resumos por CFOP/UF |
| `lcdpr` | lcdpr.html | importação SIEG, classificação, arquivo LCDPR |
| `entregas` | entregas.html | entrega, itens, competência, estados, vencimento automático, protocolo |
| `rota` | entregas.html | fila, melhor ordem, links públicos |
| `honorarios` | entregas.html | cobrança por visita, Pix (BR Code) |
| `pendencias` | Pendências | documentos do mês, situação banco × tipo, cobrança |
| `tarefas` | tarefas.html | tarefas, requisições, parcelamentos |
| `portal` | cliente.html | o que o cliente vê e faz (na cópia, com token de exemplo) |
| `pessoas` | login, `usuarios` | usuário, papéis (`podeVer`), login de mentira por papel |
| `bancos` | bancos-nilma.js | tabela de bancos, reconhecer banco no extrato |

Criou um domínio novo? Acrescente nesta tabela.

## 4. Módulos e rotas do `apps/web`

A navegação copia a da Conferência (design-n1): **seções** na barra lateral, **páginas** nas abas do
cabeçalho e **abas internas** no seletor abaixo do título. A URL segue a mesma hierarquia:

```
/<modulo>/<secao>/<pagina>?aba=<aba>
/contabil/movimento/relatorio?aba=entradas
/entregas/rota/paradas
/publico/assinar/:token        telas sem login ficam fora da casca
```

- Empresa aberta (Conferência) vai na URL: `/contabil/:empresa/movimento/relatorio`. Assim dá para
  ter um link direto e usar o voltar do navegador.
- Preferência de quem usa (tema, barra lateral oculta, Resumido/Detalhado): `localStorage`.
  Dado da empresa: repositório (em memória, na cópia).
- Cada `navegacao.ts` declara as seções/páginas e o papel exigido, e a casca filtra pelo usuário
  (o antigo `podeVer(id, papel)`).

## 5. Ferramentas

| Para | Usar | Por quê |
|---|---|---|
| Pacotes | **npm workspaces** | já vem com o Node; nada a instalar no PC do escritório |
| App | **Vite + React + TypeScript** (`strict: true`) | site estático; publica em qualquer hospedagem estática (no link que o usuário indicar) |
| Rotas | **React Router** (modo biblioteca) | rotas aninhadas = seção/página/aba |
| Dados | **`useSyncExternalStore`** sobre o repositório em memória (`apps/web/src/dados/repo.tsx`) | síncrono e simples; se um dia houver fonte assíncrona, entra o TanStack Query sem mudar as telas |
| Planilhas | **SheetJS (`xlsx`)** | o mesmo que os HTML usam; leitura pesada num Web Worker |
| Testes | **Vitest** (+ Testing Library para hooks) | mesmo motor do Vite |
| Lint | **ESLint** com `no-restricted-imports` por pasta | segura as camadas |

Scripts da raiz: `dev` (apps/web), `build`, `teste`, `lint`, `tipos`, `sem-rede` e **`verificar`**
(tipos + lint + teste + sem-rede, o que se roda antes de todo commit e de toda publicação).

**`sem-rede`** (`scripts/sem-rede.mjs`): falha se achar em qualquer `package.json` do nads uma
dependência `firebase`/`firebase-admin`/`@firebase/*`/`googleapis`/SDK de IA, ou no código-fonte
e no `dist/` os textos `firebaseio.com`, `googleapis.com`, `firestore`, `initializeApp`,
`fetch("http`/`fetch('http`, `XMLHttpRequest`. Uma linha por achado, com arquivo e linha. Quem precisar
de exceção pergunta ao usuário; não se edita a lista para passar.

Versões: use a estável do momento (`npm create vite@latest`, `npm i react-router@latest`…). Não copie
números de versão desta página.

## 6. Nomes e idioma

- Código em **português**, como nos sistemas atuais: `situacaoDaConta`, `lerBalancete`,
  `useRelatorio`, `<TabelaSaldo>`. Termos técnicos ficam em inglês quando são nomes de biblioteca
  (`useQuery`, `props`).
- Arquivos: `camelCase.ts` para regras e hooks, `PascalCase.tsx` para componentes.
- Mantenha o nome antigo quando ele já é bom e conhecido (`padraoPorCfop`, `competencia`): ajuda a
  achar a origem. Anote no `mapa.md` quando mudar.
- Textos da tela: os mesmos do app antigo (design-n1: curtos, sem explicar o óbvio).

## 7. Montar do zero

Só quando o `nads` ainda não tiver `package.json` na raiz. Monte o mínimo que roda de ponta a ponta:

1. `package.json` da raiz com `"workspaces": ["apps/*", "packages/*"]` e os scripts da seção 5.
2. `apps/web` com `npm create vite@latest web -- --template react-ts`, mais React Router e TanStack Query.
3. `packages/core` (TS puro, `vitest`) com `formatos/` e `pessoas/` (login de mentira por papel,
   ver `banco-intocavel.md`). **Sem Firebase.**
4. `packages/ui` com `tokens.css` e os componentes da casca portados do design-n1
   (`css/nilma.css` → tokens + CSS dos componentes; `js/nilma.js` → ícones, `useRetorno`, tema).
   Leia a skill design-n1 inteira antes.
5. ESLint com as restrições da seção 2, `tsconfig.base.json` com `strict`, `scripts/sem-rede.mjs`, e
   `npm run verificar` passando.
6. Uma tela de exemplo atravessando as três camadas (ex.: Cheque especial, que não usa banco) para
   provar o caminho.

Registre o que foi montado no README do `nads`, com o aviso "cópia sem banco: não conecta a nenhum
Firebase" logo no começo, e o link de publicação que o usuário indicar.
