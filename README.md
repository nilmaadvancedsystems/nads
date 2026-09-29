# nads — app único da Nilma

> **Banco:** o site publicado (**https://nads-nilma.web.app**) usa o **mesmo Firestore da
> conferencia-nilma.web.app** — mesma coleção `empresas`, mesmo formato, mesmo jeito de salvar. Os dois
> apps podem ser usados ao mesmo tempo sobre os mesmos dados. Rodando local (`npm run dev`), usa dados de
> exemplo e não toca no banco. A trava `npm run conexoes` garante que o Firebase só aparece em
> `apps/web/src/aplicativos/<app>/dados/*.firestore.ts` e que o `apps/web/firebase.json` (o único) só publica hospedagem.

O nads é **um app só**, com vários **aplicativos** dentro (hoje: Conferência Contábil, Cheque especial,
Conciliadorzinho e Extrator). Tudo em
**React + Vite + TypeScript**, organizado em **MVVM**:

| Camada | Onde | O que é |
|---|---|---|
| Model | `packages/core/src/<app>/` | regras, leitura de planilhas, repositório em memória. TypeScript puro, com testes |
| ViewModel | `apps/web/src/aplicativos/<app>/telas/<tela>/use<Tela>.ts` | um hook por tela: estado e ações |
| View | `<Tela>.tsx` + `partes/`, com `packages/ui` | só desenha, com o design do nads |

## Pastas

Na raiz fica só o que é do repositório inteiro: `package.json`, `tsconfig.json`, `eslint.config.mjs`,
os arquivos do git e este README.

```
apps/web/                  o site: firebase.json e .firebaserc (publicação) moram aqui
apps/web/src/
  main.tsx, rotas.tsx      o nads: visual, toast/modal e a soma das rotas dos aplicativos
  aplicativos/
    conferencia/           um aplicativo
      rotas.tsx            as rotas dele
      AppConferencia.tsx   liga os dados dele (banco ou exemplos)
      dados/               repositório: fonte.ts, repo.tsx e o único arquivo com Firebase
      casca/               barra lateral, abas, sessão e a rota da empresa aberta
      telas/<tela>/        use<Tela>.ts + <Tela>.tsx + partes/
packages/
  core/src/<app>/          Model de cada aplicativo;  core/src/formatos/  o que é de todos
  ui/                      componentes e estilo (src/estilo/nads.css), de todos os aplicativos
docs/aplicativos/<app>/    mapa da migração e inventário do código antigo
```

Aplicativo novo = uma pasta nova em `aplicativos/`, uma em `packages/core/src/` e uma em
`docs/aplicativos/`, mais uma linha em `apps/web/src/rotas.tsx` e outra em
`apps/web/src/inicio/aplicativos.ts`. Um aplicativo não importa nada de outro: o que for comum vai
para `packages/ui`, `packages/core/src/formatos`, `packages/core/src/empresas` ou `apps/web/src/comum`.

Aplicativos até agora (mapas em `docs/aplicativos/<app>/mapa.md`):
- **Conferência Contábil** (veio de `contabil-htmls/conferencia.html`, beta 0.1.63);
- **Cheque especial** (`contabil-htmls/cheque_especial.html`);
- **Conciliadorzinho** (`contabil-htmls/conciliadorZINHO.html`);
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

`/` escolher o aplicativo · `/<app>` escolher a empresa · `/<app>/<código da empresa>/<seção>/<página>` —
ex.: `/conferencia/292/movimento/relatorio`. Empresa sem código na lista usa o nome. Links antigos da
Conferência (`/292/…`, ou pelo nome) redirecionam.
