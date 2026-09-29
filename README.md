# nads — os aplicativos da Nilma

> **Banco:** o site publicado (**https://nads-nilma.web.app**) usa o **mesmo Firestore da
> conferencia-nilma.web.app** — mesma coleção `empresas`, mesmo formato, mesmo jeito de salvar. Os dois
> apps podem ser usados ao mesmo tempo sobre os mesmos dados. Rodando local (`npm run dev`), usa dados de
> exemplo e não toca no banco. A trava `npm run conexoes` garante que o Firebase só aparece em
> `apps/web/src/aplicativos/<app>/dados/*.firestore.ts` e que o `apps/web/firebase.json` (o único) só publica hospedagem.

O nads tem **cinco aplicativos isolados**, cada um com o seu link (ver `docs/aplicativos/README.md`):
**Concilia aí** (a Conferência, em `/`), **Conciliadorzinho** (`/conciliadorzinho`), **Cheque especial**
(`/cheque-especial`), **Creditor** (`/creditor`) e **Extrator** (`/extrator`). Tudo em **React + Vite + TypeScript**, organizado em **MVVM**:

| Camada | Onde | O que é |
|---|---|---|
| Model | `packages/core/src/<módulo>/` | regras, leitura de planilhas, repositório em memória. TypeScript puro, com testes |
| ViewModel | `apps/web/src/aplicativos/<app>/telas/<tela>/use<Tela>.ts` | um hook por tela: estado e ações |
| View | `<Tela>.tsx` + `partes/`, com `packages/ui` | só desenha, com o design do nads |

## Pastas

Na raiz fica só o que é do repositório inteiro: `package.json`, `tsconfig.json`, `eslint.config.mjs`,
os arquivos do git e este README.

```
apps/web/                  o site: firebase.json e .firebaserc (publicação) moram aqui
apps/web/src/
  main.tsx, rotas.tsx      o nads: visual, toast/modal e as rotas (VITE_APLICATIVO = site com um app só)
  aplicativos/<app>/       concilia-ai, conciliadorzinho, cheque-especial, creditor
    rotas.tsx              as rotas dele
    casca/                 barra lateral, abas, sessão e a rota da empresa aberta
    telas/<tela>/          use<Tela>.ts + <Tela>.tsx + partes/
    dados/                 (só o Concilia aí) repositório: fonte.ts, repo.tsx e o único arquivo com Firebase
packages/
  core/src/<módulo>/       Model (conferencia, conciliadorzinho, cheque-especial, creditor);  core/src/formatos/  o que é de todos
  ui/                      componentes e estilo (src/estilo/nads.css)
docs/aplicativos/<app>/    mapas e inventários (a Conferência em concilia-ai/conferencia/)
```

Aplicativo novo = uma pasta em `aplicativos/`, uma em `packages/core/src/` e uma em `docs/aplicativos/`,
mais uma linha em `apps/web/src/rotas.tsx`. Um aplicativo não importa nada de outro: o que for comum vai
para `packages/ui`, `packages/core/src/formatos`, `packages/core/src/empresas` ou `apps/web/src/comum`.

De onde veio cada um:
- **Concilia aí / Conferência Contábil** (`contabil-htmls/conferencia.html`, beta 0.1.63);
- **Conciliadorzinho** (`contabil-htmls/conciliadorZINHO.html`);
- **Cheque especial** (`contabil-htmls/cheque_especial.html`);
- **Creditor** (novo: relatório de liquidação do banco × sistema → importação de 8 colunas).
- **Extrator** (novo: extrato bancário × lançamentos contábeis).

## Rodar

```bash
npm install
npm run dev          # http://localhost:5178 — dados de exemplo
npm run dev:banco    # mesmo endereço, com o banco real da Conferência (cuidado: grava de verdade)
npm run verificar    # tipos + lint das camadas + testes + conexões
npm run versao       # soma 1 na versão do sistema (0.0.1 → 0.0.2) — uma vez por branch publicada
npm run publicar     # build ligado ao banco + publica só a hospedagem em https://nads-nilma.web.app
npm run previa       # build com dados de exemplo + link temporário de prévia (7 dias)
```

Empresas de exemplo: **901** (comércio), **902** (serviços médicos), **903** (nova, vazia). Na entrada,
"restaurar exemplos" volta tudo ao início. Os arquivos reais do escritório (balancete, entradas,
saídas, ISS, relatório da conta) podem ser importados: a leitura acontece no navegador.

## Rotas

- Concilia aí: `/` escolher a empresa · `/<código>/<seção>/<página>` (ex.: `/292/movimento/relatorio`).
  Links antigos `/conferencia/…` redirecionam.
- Conciliadorzinho: `/conciliadorzinho/<código>/conciliacao/<etapa>`.
- Cheque especial: `/cheque-especial/<código>/ajuste/saldo-negativo`.
- Creditor (dentro do Extratudo): `/extratudo/<código>/creditor/<etapa>` (banco, conferencia, fiscal, sistema, cruzamento, lancamentos).

Empresa sem código na lista usa o nome.
