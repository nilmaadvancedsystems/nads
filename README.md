# nads — Concilia aí, o app único da Nilma

> **Banco:** o site publicado (**https://nads-nilma.web.app**) usa o **mesmo Firestore da
> conferencia-nilma.web.app** — mesma coleção `empresas`, mesmo formato, mesmo jeito de salvar. Os dois
> apps podem ser usados ao mesmo tempo sobre os mesmos dados. Rodando local (`npm run dev`), usa dados de
> exemplo e não toca no banco. A trava `npm run conexoes` garante que o Firebase só aparece em
> `apps/web/src/aplicativos/<app>/dados/*.firestore.ts` e que o `apps/web/firebase.json` (o único) só publica hospedagem.

O nads hoje é **um aplicativo só: o Concilia aí**. A pessoa escolhe a empresa e, dentro dela, tem na
barra lateral as seções da Conferência (Importação, Cadastro, Movimento, Auditoria) e as ferramentas de
conciliação (Conciliadorzinho, Cheque especial). Tudo em **React + Vite + TypeScript**, organizado em **MVVM**:

| Camada | Onde | O que é |
|---|---|---|
| Model | `packages/core/src/<módulo>/` | regras, leitura de planilhas, repositório em memória. TypeScript puro, com testes |
| ViewModel | `apps/web/src/aplicativos/concilia-ai/…/telas/<tela>/use<Tela>.ts` | um hook por tela: estado e ações |
| View | `<Tela>.tsx` + `partes/`, com `packages/ui` | só desenha, com o design do nads |

## Pastas

Na raiz fica só o que é do repositório inteiro: `package.json`, `tsconfig.json`, `eslint.config.mjs`,
os arquivos do git e este README.

```
apps/web/                  o site: firebase.json e .firebaserc (publicação) moram aqui
apps/web/src/
  main.tsx, rotas.tsx      o nads: visual, toast/modal e as rotas
  aplicativos/
    concilia-ai/           o aplicativo
      rotas.tsx            / (empresa), /<código>/<seção>/<página> e os links antigos
      AppConciliaAi.tsx    liga os dados (banco ou exemplos)
      dados/               repositório: fonte.ts, repo.tsx e o único arquivo com Firebase
      casca/               barra lateral (seções + ferramentas), abas, sessão e a rota da empresa aberta
      telas/<tela>/        as telas da Conferência: use<Tela>.ts + <Tela>.tsx + partes/
      ferramentas/<id>/    cada ferramenta de conciliação: casca/ (páginas, sessão) e telas/
packages/
  core/src/<módulo>/       Model (conferencia, conciliadorzinho, cheque-especial);  core/src/formatos/  o que é de todos
  ui/                      componentes e estilo (src/estilo/nads.css)
docs/aplicativos/concilia-ai/   README (como juntou), mapas e inventários do código antigo
```

Ferramenta nova = uma pasta em `aplicativos/concilia-ai/ferramentas/`, uma em `packages/core/src/`,
uma linha em `FERRAMENTAS` (`casca/navegacao.ts`) e a entrada em `casca/EmpresaAberta.tsx`. O que for
comum vai para `packages/ui`, `packages/core/src/formatos`, `packages/core/src/empresas` ou `apps/web/src/comum`.

O que está dentro (mapas em `docs/aplicativos/concilia-ai/`):
- **Conferência Contábil** (veio de `contabil-htmls/conferencia.html`, beta 0.1.63);
- **Conciliadorzinho** (`contabil-htmls/conciliadorZINHO.html`);
- **Cheque especial** (`contabil-htmls/cheque_especial.html`).

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

`/` escolher a empresa · `/<código da empresa>/<seção>/<página>` — ex.: `/292/movimento/relatorio`,
`/292/conciliadorzinho/bandeiras`, `/292/cheque-especial/saldo-negativo`. Empresa sem código na lista
usa o nome. Os links antigos redirecionam: `/conferencia/…`, `/conciliei/…`, `/conciliadorzinho/…` e
`/cheque-especial/…`.
