# Padrão de tela: o molde que TODA aplicação copiada segue

A Conferência foi a primeira cópia (setembro/2026). O formato dela é o molde: as próximas
(Entregas, Pendências, Tarefas, LCDPR, Conciliadorzinho, Cheque especial, Sintegra…) repetem
exatamente os mesmos arquivos, os mesmos nomes e as mesmas peças do `packages/ui`. Se uma
aplicação precisar de algo que o molde não tem, acrescente ao molde (e a esta página) em vez
de fazer diferente naquela aplicação.

Exemplo vivo para abrir e copiar: `apps/web/src/modulos/conferencia/importacao/`.

## Índice
1. Arquivos de um módulo
2. Arquivos de uma tela
3. Catálogo do packages/ui (use estes, não crie outros)
4. Sessão do módulo
5. Ações do topo da página
6. Mensagens, perguntas e avisos
7. Checklist do molde

---

## 1. Arquivos de um módulo

```
apps/web/src/modulos/<modulo>/
├─ navegacao.ts            SECOES (barra lateral) → páginas (abas do cabeçalho), com rótulo, ícone e título
├─ sessao.tsx              estado da sessão do módulo (o que o original guardava em globais) + irPara()
├─ topo.tsx                <AcoesDoTopo> / <LugarDasAcoes> (reaproveite o da Conferência)
├─ useCasca<Modulo>.ts     ViewModel da casca: seções, páginas, travas, sair, título
├─ Casca<Modulo>.tsx       View da casca: usa <Casca> do @nads/ui
├─ <Rota>.tsx              rota do módulo (ex.: EmpresaAberta.tsx): resolve a URL, monta sessão + casca, escolhe a tela
└─ <tela>/                 uma pasta por tela (ver 2)
packages/core/src/<dominio>/
├─ tipos.ts · acoes.ts · repo.ts · repo.memoria.ts · index.ts
├─ regras/*.ts (+ .test.ts)  · arquivos/index.ts · tabelas/*.ts · __exemplos__/*.ts · __legado__/ (paridade)
```

Rotas: hash (`#/…`), `/<objeto>/<secao>/<pagina>` (na Conferência, objeto = slug da empresa).
Registre no `apps/web/src/rotas.tsx`.

## 2. Arquivos de uma tela

```
<tela>/
├─ use<Tela>.ts        ViewModel: lê a sessão, chama regras do core, devolve dados prontos e ações
├─ <Tela>.tsx          View: <section> com <AcoesDoTopo>, caixas e tabelas; só desenha
└─ partes/*.tsx        pedaços da View desta tela (tabela X, painel Y)
```

Regras do molde (as mesmas da Importação):
- O hook devolve **dados já calculados** (ex.: `plano`, `notas`, `mensagem`) e **ações com nome de
  negócio** (`importar`, `excluir`, `alternarReimportar`). A View não faz conta.
- Texto que depende de regra (título de alerta, frase do modal) é montado no hook ou no core, com as
  palavras exatas do original.
- Mudança de dado = `s.aplicar(x => c.acaoDoCore(x, …))`. Nunca mexer na empresa direto.
- Estado só da tela (arquivo escolhido, carregando, filtro de grupo) = `useState` no hook. Estado que
  sobrevive à troca de aba (filtros, aba interna, "onde parou") = sessão.
- Cabeçalho de cada arquivo: uma linha dizendo o que é + `Origem: <arquivo antigo> ~L…`.

## 3. Catálogo do packages/ui (use estes, não crie outros)

| Peça | Para quê | Classe/marcação do original |
|---|---|---|
| `Casca` | cabeçalho, trilha, abas, barra lateral, gaveta ☰, área da página | `.gh-header`, `.menu`, `.subnav`, `.drawer`, `.topbar` |
| `RetornoProvider` / `useRetorno()` | `toast(texto)` e `modal({ … })` que devolve a escolha | `.toast`, `.modal-overlay` (`tom:'ok'`, `obrigatoria`, `fecharEm`) |
| `Alerta` | aviso numa caixa (tom ok = verde), com × opcional | `.alert` |
| `MensagemFlutuante` | resultado de importação: some em 3,7 s, tem × | ids `#planoMsg`/`#msgEnt`… |
| `CampoArquivo` | "Escolher arquivo" com × e abrir por programa (Reimportar) | `.file-picker` |
| `Segmentado` | seletor interno (abas dentro da página), com opção travada/oculta | `.steps` / `.step-pill` |
| `Stat` | um número da faixa (cor entrada/saída) | `.stat-grid` / `.stat` |
| `Interruptor` | chave On/Off | `.toggle-switch` |
| `BotaoAcao` | botão principal com spinner + gerúndio | `.btn` + `.btn-spinner` |
| `BotaoIcone` | ícone clicável (sempre com título) | `.icon-btn` |
| `CampoData` | dd/mm/aaaa com máscara | `.data-mask` |
| `Icone` / `MarcaN` / `DefsMarca` | ícones de traço 1,75 e o "N" da Nilma | mapa `ICONS` |
| `SeletorTema` / `useTema` | claro / escuro / sistema | `.theme-toggle` |
| `baixarArquivo(texto, nome)` | CSV e afins | — |

O CSS é `@nads/ui/estilo.css` = cópia fiel do `<style>` da Conferência. Tabelas, cards, badges e
listas usam direto as classes desse CSS (`.card`, `.table-wrap`, `.badge badge-ok`, `.empty`…).
Precisou de peça nova usada por duas telas? Crie no `packages/ui` e acrescente nesta tabela.

## 4. Sessão do módulo

`sessao.tsx` junta num contexto o que o original espalhava em variáveis globais (na Conferência:
`ccState`, `filtro`, `confAbaAtual`, `cadTipo`, `vc`…). Zera ao trocar o objeto aberto (a rota monta
o provider com `key={objeto}`). Ela oferece:
- o objeto aberto (sempre a versão mais nova do repositório) e `aplicar(acao)`;
- `irPara(pagina)` com as regras de navegação do original (travas, descartar dado temporário);
- atalhos entre telas (ex.: `revisarConta`), `avisoImportar(req)` e os estados compartilhados.

## 5. Ações do topo da página

Botões do canto superior direito (Reimportar, Baixar CSV, chave "Apagar ao sair") ficam na tela, dentro
de `<AcoesDoTopo>…</AcoesDoTopo>`, que leva o conteúdo para o cabeçalho da casca. Vermelhos
(`btn btn-primary`), sem ícone, como no design-n1.

## 6. Mensagens, perguntas e avisos

| Situação | Como |
|---|---|
| Salvou/alterou | `toast('…')` |
| Pergunta com escolha (sobrepor/apenas novas, apagar) | `await modal({ icone, titulo, html, botoes })` no hook |
| Resultado de importação | `mensagem` do hook → `<MensagemFlutuante>` + `<Alerta>` |
| Página que depende de arquivo | opção travada + `s.avisoImportar(req)` |
| Sucesso limpo que volta sozinho | `modal({ tom: 'ok', fecharEm: { ms: 2000, valor } })` |

`html` só com texto montado pelo próprio sistema; dado de fora passa por escape.

## 7. Checklist do molde

- [ ] Pastas e nomes iguais aos da seção 1 e 2.
- [ ] Nenhuma peça visual nova se o catálogo já tem.
- [ ] Mesmos textos, mesmas classes e ids do original.
- [ ] Hook sem JSX e sem `document`; View sem regra e sem repositório (o lint barra).
- [ ] Regras com teste e, quando der, teste de paridade em `__legado__/` (função antiga × nova).
- [ ] `npm run verificar` passa (tipos, lint, testes, sem-rede).
