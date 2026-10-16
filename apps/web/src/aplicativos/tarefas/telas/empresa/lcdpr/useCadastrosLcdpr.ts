// ViewModel das listas do LCDPR (Categorias, Regras de NCM, Plano de contas e as Tabelas de apoio do lcdpr.html): cada
// lista com a busca e o "+ Novo"; clicar na linha abre a janela do item (no jeito das janelas de criar do nads, em vez do
// campo dentro da tabela de lá); remover tem o Desfazer, e remoções seguidas somam no mesmo aviso (o item volta para o
// mesmo lugar: nas regras de NCM a ordem decide qual vale). Grava o documento inteiro a cada mudança, como lá.
import { lcdpr } from '@nads/core';
import { useState } from 'react';
import type { NomeIcone } from '@nads/ui';
import { useRegrasDoLcdpr } from './useRegrasDoLcdpr';

type Tipo = 'texto' | 'numero' | 'tipoConta' | 'imovel';
interface Campo { id: string; rotulo: string; icone: NomeIcone; tipo: Tipo; longo?: boolean }
interface DefinicaoDaLista { titulo: string; contagem: string; novo: string; vazio: string; busca: string; campos: Campo[]; variaveis?: boolean }

const VARS = 'Variáveis do histórico: {{doc}}, {{fornecedor}} e {{cnpj}}.';
export const VARIAVEIS_DO_HISTORICO = VARS;

const LISTAS: Record<lcdpr.ListaDoLcdpr, DefinicaoDaLista> = {
  categorias: {
    titulo: 'Categorias', contagem: 'categorias', novo: 'Nova categoria', vazio: 'Nenhuma categoria.', busca: 'Buscar categoria', variaveis: true,
    campos: [{ id: 'nome', rotulo: 'Nome', icone: 'fileText', tipo: 'texto', longo: true }, { id: 'conta', rotulo: 'Conta', icone: 'hash', tipo: 'numero' }, { id: 'codHist', rotulo: 'Cód. hist.', icone: 'hash', tipo: 'numero' }, { id: 'historico', rotulo: 'Histórico', icone: 'fileText', tipo: 'texto', longo: true }],
  },
  ncmRules: {
    titulo: 'Regras por NCM', contagem: 'regras', novo: 'Nova regra', vazio: 'Nenhuma regra.', busca: 'Filtrar NCM ou conta', variaveis: true,
    campos: [{ id: 'prefixo', rotulo: 'NCM', icone: 'hash', tipo: 'numero' }, { id: 'conta', rotulo: 'Conta', icone: 'hash', tipo: 'numero' }, { id: 'codHist', rotulo: 'Cód. hist.', icone: 'hash', tipo: 'numero' }, { id: 'historico', rotulo: 'Histórico', icone: 'fileText', tipo: 'texto', longo: true }],
  },
  planoContas: {
    titulo: 'Plano de contas', contagem: 'contas', novo: 'Nova conta', vazio: 'Nenhuma conta.', busca: 'Buscar conta',
    campos: [{ id: 'codigo', rotulo: 'Código', icone: 'hash', tipo: 'numero' }, { id: 'nome', rotulo: 'Nome da conta', icone: 'fileText', tipo: 'texto', longo: true }, { id: 'classificacao', rotulo: 'Classificação', icone: 'grade', tipo: 'texto' }, { id: 'tipo', rotulo: 'Tipo', icone: 'list', tipo: 'tipoConta' }],
  },
  imoveis: {
    titulo: 'Imóveis rurais', contagem: 'imóveis', novo: 'Novo imóvel', vazio: 'Nada cadastrado.', busca: 'Buscar imóvel',
    campos: [{ id: 'codigo', rotulo: 'Código', icone: 'hash', tipo: 'numero' }, { id: 'descricao', rotulo: 'Descrição', icone: 'landmark', tipo: 'texto', longo: true }],
  },
  ieDest: {
    titulo: 'IE → imóvel', contagem: 'vínculos', novo: 'Novo vínculo', vazio: 'Nada cadastrado.', busca: 'Buscar IE',
    campos: [{ id: 'ie', rotulo: 'IE do destinatário', icone: 'hash', tipo: 'numero' }, { id: 'imovel', rotulo: 'Imóvel', icone: 'landmark', tipo: 'imovel' }],
  },
  tipoDoc: {
    titulo: 'Tipos de documento', contagem: 'tipos', novo: 'Novo tipo', vazio: 'Nada cadastrado.', busca: 'Buscar tipo',
    campos: [{ id: 'codigo', rotulo: 'Código', icone: 'hash', tipo: 'numero' }, { id: 'descricao', rotulo: 'Descrição', icone: 'fileText', tipo: 'texto', longo: true }],
  },
  tipoLanc: {
    titulo: 'Tipos de lançamento', contagem: 'tipos', novo: 'Novo tipo', vazio: 'Nada cadastrado.', busca: 'Buscar tipo',
    campos: [{ id: 'codigo', rotulo: 'Código', icone: 'hash', tipo: 'numero' }, { id: 'descricao', rotulo: 'Descrição', icone: 'fileText', tipo: 'texto', longo: true }],
  },
};

export const TIPOS_DE_CONTA = [{ valor: 'A', rotulo: 'Analítica' }, { valor: 'S', rotulo: 'Sintética' }] as const;

type Item = Record<string, string>;
const itens = (c: lcdpr.ConfigLcdpr, l: lcdpr.ListaDoLcdpr) => c[l] as unknown as Item[];
/** um item removido: onde estava e o vizinho de baixo (se a lista mudar por fora enquanto o aviso está aberto, ele ancora a volta) */
interface Removido { lista: lcdpr.ListaDoLcdpr; i: number; item: Item; depois: Item | undefined }

export function useCadastrosLcdpr(listas: readonly lcdpr.ListaDoLcdpr[]) {
  const r = useRegrasDoLcdpr();
  const [buscas, setBuscas] = useState<Partial<Record<lcdpr.ListaDoLcdpr, string>>>({});
  const [janela, setJanela] = useState<{ lista: lcdpr.ListaDoLcdpr; indice: number | null; rascunho: Item } | null>(null);
  const [removidos, setRemovidos] = useState<Removido[]>([]);

  const gravarLista = (lista: lcdpr.ListaDoLcdpr, nova: Item[]) => r.gravar({ ...r.atual(), [lista]: nova } as lcdpr.ConfigLcdpr);
  const rotuloDoImovel = (codigo: string) => { const m = r.config.imoveis.find(x => x.codigo === codigo); return m ? m.codigo + ' — ' + m.descricao : codigo || '—'; };
  const mostrar = (campo: Campo, v: string) => (campo.tipo === 'tipoConta' ? TIPOS_DE_CONTA.find(t => t.valor === v)?.rotulo || v : campo.tipo === 'imovel' ? rotuloDoImovel(v) : v);

  return {
    carregada: r.carregada, erro: r.erro, exemplos: r.exemplos,
    variaveis: VARS,
    listas: listas.map(lista => {
      const d = LISTAS[lista];
      const todos = itens(r.config, lista);
      const q = (buscas[lista] || '').trim();
      const achados = todos.map((item, indice) => ({ item, indice })).filter(({ item }) => !q || (lista === 'ncmRules'
        ? lcdpr.regraNoFiltro(item as unknown as lcdpr.RegraNcm, q)
        : Object.values(item).some(v => v.toUpperCase().includes(q.toUpperCase())) || (lista === 'ieDest' && rotuloDoImovel(item.imovel).toUpperCase().includes(q.toUpperCase()))));
      return {
        id: lista, titulo: d.titulo, novo: d.novo, vazio: q ? 'Nada com isso.' : d.vazio, placeholderBusca: d.busca, variaveis: !!d.variaveis,
        contagem: (q ? achados.length + ' de ' + todos.length : String(todos.length)), rotuloContagem: d.contagem,
        busca: buscas[lista] || '',
        setBusca: (v: string) => setBuscas(b => ({ ...b, [lista]: v })),
        colunas: d.campos.map(c => ({ id: c.id, rotulo: c.rotulo, numerico: c.tipo === 'numero', longo: !!c.longo })),
        linhas: achados.map(({ item, indice }) => ({ indice, celulas: d.campos.map(c => mostrar(c, item[c.id] || '')) })),
        abrir: (indice: number) => setJanela({ lista, indice, rascunho: { ...itens(r.atual(), lista)[indice] } }),
        criar: () => setJanela({ lista, indice: null, rascunho: lcdpr.itemEmBranco(lista) }),
      };
    }),

    /** a janela de um item (ou do novo) */
    janela: janela && {
      titulo: janela.indice === null ? LISTAS[janela.lista].novo : LISTAS[janela.lista].titulo,
      lista: janela.lista, novo: janela.indice === null, variaveis: !!LISTAS[janela.lista].variaveis,
      campos: LISTAS[janela.lista].campos.map(c => ({ ...c, valor: janela.rascunho[c.id] || '' })),
      imoveis: (() => {
        const atual = janela.rascunho.imovel || '';
        const conhecido = r.config.imoveis.some(m => m.codigo === atual);
        // o código gravado que não existe mais continua como opção: a tela não pode fingir outro imóvel
        return [...(conhecido || !atual ? [] : [{ valor: atual, rotulo: atual }]), ...r.config.imoveis.map(m => ({ valor: m.codigo, rotulo: m.codigo + ' — ' + m.descricao }))];
      })(),
      tiposDeConta: TIPOS_DE_CONTA,
      mudar: (campo: string, v: string) => setJanela(j => (j ? { ...j, rascunho: { ...j.rascunho, [campo]: lcdpr.umaLinha(v) } } : j)),
    },
    fecharJanela: () => setJanela(null),
    async salvarJanela() {
      if (!janela) return;
      const lista = itens(r.atual(), janela.lista);
      const limpo = Object.fromEntries(Object.entries(janela.rascunho).map(([k, v]) => [k, String(v).trim()]));
      const nova = janela.indice === null ? [...lista, limpo] : lista.map((x, i) => (i === janela.indice ? limpo : x));
      if (await gravarLista(janela.lista, nova)) setJanela(null);
    },
    async removerJanela() {
      if (!janela || janela.indice === null) return;
      const lista = itens(r.atual(), janela.lista);
      const i = janela.indice;
      const item = lista[i];
      if (!item) return;
      const nova = lista.filter((_, k) => k !== i);
      if (!(await gravarLista(janela.lista, nova))) return;
      setRemovidos(x => [...x, { lista: janela.lista, i, item, depois: nova[i] }]);
      setJanela(null);
    },

    /** o aviso do Desfazer das remoções (somam enquanto ele está aberto) */
    removidos: removidos.length ? (removidos.length === 1 ? 'Removido.' : removidos.length + ' itens removidos.') : '',
    async desfazerRemocoes() {
      let c = r.atual();
      // da mais nova para a mais antiga: cada posição foi medida depois das anteriores
      for (const { lista, i, item, depois } of [...removidos].reverse()) {
        const atual = [...itens(c, lista)];
        let pos = -1;
        if (depois !== undefined) { const alvo = JSON.stringify(depois); pos = atual.findIndex(x => JSON.stringify(x) === alvo); }
        if (pos === -1) pos = depois === undefined ? atual.length : Math.min(i, atual.length);
        atual.splice(pos, 0, item);
        c = { ...c, [lista]: atual } as lcdpr.ConfigLcdpr;
      }
      setRemovidos([]);
      await r.gravar(c);
    },
    esquecerRemocoes: () => setRemovidos([]),
  };
}
