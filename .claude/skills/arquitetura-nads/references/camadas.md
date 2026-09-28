# As três camadas: contrato e modelos

O exemplo que atravessa este arquivo é real: a tabela "confere com o saldo" do Relatório da
Conferência (`renderCcBalancete`, conferencia.html ~L3508). Hoje uma função só calcula a situação de
cada conta, monta o HTML e esconde/mostra o painel. Veja como ela fica separada.

## Índice
1. Model — regra, tipo, repositório, arquivo
2. ViewModel — o hook da tela
3. View — o componente
4. Testes por camada
5. Checklist da fatia

---

## 1. Model (`packages/core`)

**Contrato:** recebe tudo por parâmetro e devolve dados. Não lê estado global, não sabe que existe
tela, não formata para exibir (a não ser pelos utilitários de `formatos/`). Mesma entrada, mesma saída.

### Tipos — `conferencia/tipos.ts`

Descreva o dado como ele é **hoje** no banco (o `norm()` da Conferência e a documentação do
Firestore são a fonte). Mudar o formato gravado é decisão do usuário.

```ts
export type TipoNota = 'entradas' | 'saidas';

export interface Nota {
  cfop: string;
  lanc: string;          // lançamento, com os zeros da nota ("00182")
  valor: number;
  numero: string;
  nome: string;          // participante
  data: string;          // dd/mm/aaaa
  exportado?: 'Sim' | 'Não';
}

export interface ContaBalancete {
  codigo: string; nome: string; dc: 'D' | 'C'; grupo: string; sintetica: boolean; valor: number;
}

export type Situacao =
  | { tipo: 'ok' }
  | { tipo: 'ok-pela-revisao'; diferencaOriginal: number }
  | { tipo: 'conferido'; diferenca: number }
  | { tipo: 'diferenca'; diferenca: number }
  | { tipo: 'soma-zero' }
  | { tipo: 'fora-do-balancete' }
  | { tipo: 'conferida-em-servicos'; onde: 'tomados' | 'prestados' };
```

O resultado é um **dado** (`Situacao`), não um pedaço de HTML. É a View que escolhe o badge.

### Regras — `conferencia/regras/situacaoDaConta.ts`

```ts
import type { Situacao } from '../tipos';

export interface EntradaSituacao {
  somaNotas: number;
  saldo: number | null;            // null = conta fora do balancete lido
  revisao?: 'ok' | 'conferido';    // resultado de "Verificar conta"
  conferidoManual: boolean;        // todas as naturezas marcadas à mão no Checklist
  podeConferir: boolean;           // só Água, Internet, Energia, Locação de Sistemas
  emServicos?: 'tomados' | 'prestados';
}

export function situacaoDaConta(e: EntradaSituacao): Situacao {
  if (e.emServicos) return { tipo: 'conferida-em-servicos', onde: e.emServicos };
  if (Math.abs(e.somaNotas) < 0.005) return { tipo: 'soma-zero' };
  if (e.saldo == null) return { tipo: 'fora-do-balancete' };
  const diferenca = e.somaNotas - e.saldo;
  if (Math.abs(diferenca) < 0.01) return { tipo: 'ok' };
  if (e.revisao === 'ok') return { tipo: 'ok-pela-revisao', diferencaOriginal: diferenca };
  if ((e.conferidoManual || e.revisao === 'conferido') && e.podeConferir) return { tipo: 'conferido', diferenca };
  return { tipo: 'diferenca', diferenca };
}
```

Regra que hoje lê `emp()` passa a receber a empresa. Este é o `padraoPorCfop` (L2817), que lia
`emp()[tipo]` e `ctxVista()`:

```ts
export function padraoPorCfop(notas: Nota[], ehVendaVista: (n: Nota) => boolean) {
  const cont: Record<string, Record<string, number>> = {};
  for (const n of notas) {
    if (!n.cfop || !n.lanc || ehVendaVista(n)) continue;
    (cont[n.cfop] ??= {})[n.lanc] = (cont[n.cfop][n.lanc] ?? 0) + 1;
  }
  // …mesmo cálculo de antes: o lançamento mais usado por CFOP, com qtd e total
}
```

Números mágicos do código antigo (0,005; 0,01; 60%; 3 notas) viram **constantes com nome** no topo
do arquivo da regra, com o motivo num comentário.

### Repositório — `conferencia/repo.ts` + `repo.memoria.ts`

A interface diz **o que a tela pode pedir**. Na cópia existe **uma** implementação, em memória: o nads
não fala com banco nenhum (`banco-intocavel.md`).

```ts
// repo.ts
export interface RepoConferencia {
  ouvirEmpresa(id: string, aoMudar: (e: EmpresaConferencia) => void): () => void; // devolve "parar de ouvir"
  gravarNotas(id: string, tipo: TipoNota, notas: Nota[], modo: 'sobrepor' | 'apenas-novas'): Promise<ResultadoImportacao>;
  marcarConferido(id: string, chave: string, marcado: boolean): Promise<void>;
}
```

```ts
// repo.memoria.ts
// Original: conferencia.html grava tudo em empresas/{slug(nome)} com save() (L1494, set do documento
// inteiro) e lê com onSnapshot na coleção (L4757). norm() (L1513) migra campos antigos na leitura.
// Aqui: só memória + localStorage. Nada de Firebase.
export function criarRepoConferenciaMemoria(inicial: EmpresaConferencia[]): RepoConferencia { … }
```

- O repositório em memória reproduz o **comportamento** do original que a tela percebe: a migração de
  campos antigos (`norm()`), o histórico gravado junto com a ação, a mescla "sobrepor / apenas novas",
  as projeções que o original mantinha (portal, rotaLinks). Tudo sem sair do navegador.
- Os dados de partida vêm de `__exemplos__/` (anonimizados). O que a pessoa faz na cópia pode ir para o
  `localStorage`, para sobreviver ao recarregar, com um botão "Restaurar exemplos".
- Ação que grava e registra histórico faz as duas coisas **dentro do repositório**, e não em dois
  lugares da tela.
- O comentário no topo, dizendo de onde o original lia e como gravava, é obrigatório: é o que liga a
  cópia ao sistema real sem executar nada contra ele.

### Arquivos — `conferencia/arquivos/lerBalancete.ts`

Recebe `ArrayBuffer`/linhas e devolve dados tipados + avisos. Não recebe `File` do `<input>` (isso
é da View) e não mostra erro (devolve `{ ok: false, motivo }`).

```ts
export type Leitura<T> = { ok: true; dados: T; avisos: string[] } | { ok: false; motivo: string };
export function lerBalancete(linhas: unknown[][]): Leitura<ContaBalancete[]> { … }
```

Planilha grande: a leitura roda num Web Worker (`apps/web`), chamando a mesma função do core.

## 2. ViewModel (`apps/web/src/modulos/<m>/<tela>/use<Tela>.ts`)

**Contrato:** um hook por tela. Junta o que a tela precisa (Query + regras), guarda o estado da tela
(aba, filtro, formulário, "reimportando") e expõe **ações com nome de negócio**. Sem JSX, sem
`document`, sem classe CSS.

```ts
export function useRelatorio(empresaId: string) {
  const repo = useRepo();                                     // contexto: o repositório em memória
  const { data: empresa, isLoading } = useEmpresa(empresaId); // Query em cima do repo.ouvirEmpresa
  const [aba, setAba] = useAbaNaUrl<'geral' | TipoNota | 'tomados' | 'prestados'>('geral');
  const { confirmar, toast } = useRetorno();

  const linhas = useMemo(() => empresa
    ? linhasDoSaldo(empresa, aba).map(l => ({ ...l, situacao: situacaoDaConta(l.entrada) }))
    : [], [empresa, aba]);

  const totais = useMemo(() => somarTotais(linhas), [linhas]);

  async function marcarConferido(chave: string, marcado: boolean) {
    await repo.marcarConferido(empresaId, chave, marcado);
    toast(marcado ? 'Marcado como conferido' : 'Desfeito');
  }

  return { carregando: isLoading, aba, setAba, linhas, totais, marcarConferido };
}
```

- **Decidir com o usuário** (o `modal()` que devolvia Promise, ex.: "Sobrepor ou Importar apenas
  novas") é do ViewModel: `const modo = await confirmar({...})`, depois `repo.gravarNotas(..., modo)`.
  A escolha é da pessoa, a mescla é do Model (`mesclarNotas(existentes, novas, modo)`).
- **Efeitos que eram escondidos no desenho** (ex.: `renderGeral` chamava `autoMarcarConferidos`, que
  gravava) viram ação explícita do hook. Pode ser um `useEffect` que dispara quando os dados mudam,
  mas visível, com nome e só uma vez por mudança.
- **Travas por falta de dado** (`aplicarBloqueios`): o hook devolve `travas: { tomados: 'sem-importacao' }`
  e a View apaga a aba. A regra de o que trava fica no Model (`travasDaEmpresa(empresa)`).
- **Estado global antigo** vai para um lugar só: dado da empresa → repositório + Query; o que a tela está mostrando →
  `useState`/URL; preferência pessoal → `localStorage` por um hook do ui (`usePreferencia`).

## 3. View (`<Tela>.tsx`)

**Contrato:** desenha o que o hook devolve, com os componentes do `@nads/ui`, e liga cliques às ações.
Pode ter estado de interface pura (menu aberto, foco, animação). Não calcula nada contábil.

```tsx
export function Relatorio({ empresaId }: { empresaId: string }) {
  const vm = useRelatorio(empresaId);
  if (vm.carregando) return <Carregando />;
  return (
    <Pagina titulo="Relatório">
      <Segmentado valor={vm.aba} onChange={vm.setAba} opcoes={ABAS_RELATORIO} />
      <FaixaNumeros itens={[{ rotulo: 'Entradas no período', valor: vm.totais.entradas, tom: 'entrada' }, …]} />
      <Tabela compacta linhas={vm.linhas} colunas={[…, { titulo: 'Situação', celula: l => <BadgeSituacao s={l.situacao} /> }]} />
    </Pagina>
  );
}

function BadgeSituacao({ s }: { s: Situacao }) {
  switch (s.tipo) {
    case 'ok': return <Badge tom="ok">Ok</Badge>;
    case 'diferenca': return <Badge tom="atencao" num>{brl(s.diferenca)}</Badge>;
    // …um case por estado; o switch exaustivo faz o TypeScript avisar se entrar estado novo
  }
}
```

- Texto, ícone, cor e tamanho saem do design-n1. Cor por significado (`tom="entrada"` → laranja), não
  por hex.
- `<input type="file">` é da View: ela lê o `File`, entrega o `ArrayBuffer` para a ação do hook.
- `partes/` para pedaços grandes da tela. Um componente que só esta tela usa não vai para o
  `packages/ui`; vai para lá quando uma segunda tela precisar.

## 4. Testes por camada

| Camada | O que testar | Como |
|---|---|---|
| Regras | toda regra, com os casos de borda do código antigo (zero, negativo, sem saldo, 60%/3 notas) | Vitest, função pura; exemplos reais anonimizados em `__exemplos__/` |
| Arquivos | um arquivo real de cada formato que o escritório importa | Vitest com o arquivo de exemplo |
| Repositório | o repositório em memória reproduz o comportamento do original (mescla, histórico, `norm()`) | Vitest direto no `repo.memoria` |
| Paridade | regra importante dá o mesmo resultado que a função antiga | a função legada copiada para `__legado__/`, sem as partes de banco e tela, com a mesma entrada |
| ViewModel | fluxos com decisão (importar com dado existente, reconferir, travas) | `renderHook` + `repo.memoria` |
| View | só o que tem lógica de exibição (o switch dos badges) | Testing Library, pouco |

Teste de regra é o que mais vale: é onde mora o dinheiro do cliente.

## 5. Checklist da fatia

- [ ] Nenhuma regra ficou no `.tsx` (procure `if`, `<`, `>`, `Math.`, `reduce` com sentido contábil).
- [ ] Nenhuma regra lê estado global; tudo por parâmetro.
- [ ] O hook não tem JSX nem `document`; a View não importa `repo` nem `regras/`.
- [ ] Nada de Firebase nem requisição para fora (`npm run sem-rede`).
- [ ] Todo efeito que grava tem nome e mora no hook ou no repositório.
- [ ] Regras e leitura de arquivo com teste; `npm run verificar` passa.
- [ ] Mesmos números e estados da tela antiga, no mesmo dado (conferido pelo código e pelos testes de
      paridade; o app antigo com banco não é aberto).
- [ ] `mapa.md` atualizado.
