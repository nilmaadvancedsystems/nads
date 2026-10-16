// ViewModel de LCDPR › Lançamentos (o "Importar e conferir" do lcdpr.html): ler os relatórios do SIEG (vários de uma
// vez; o mesmo arquivo de novo pergunta antes; cada arquivo lido fica na lista com o Desfazer), o quanto já está
// classificado, a busca e o "só REVISAR" (com os grupos de mesmo NCM e fornecedor para decidir de uma vez), a categoria de
// cada linha e da seleção (com o Desfazer), a regra de NCM sugerida depois de classificar à mão e baixar a planilha .xls.
import { formatos, lcdpr } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useRegrasDoLcdpr } from './useRegrasDoLcdpr';
import { lerSessao, mudarSessao, novoIdDeLancamento, useSessaoDoLcdpr, type ImportacaoDoLcdpr } from './useSessaoDoLcdpr';

/** O que dá para desfazer agora (o aviso no topo com o Desfazer). */
export interface Desfazivel { titulo: string; voltar: () => void }

const ROTULO_DA_REGRA: Record<lcdpr.OrigemDaRegra, { rotulo: string; classe: string } | null> = {
  'NCM': { rotulo: 'NCM', classe: 'badge badge-ok' },
  'Padrão CT-e': { rotulo: 'padrão CT-e', classe: 'badge badge-neutral' },
  'Manual': { rotulo: 'manual', classe: 'badge badge-neutral' },
  'Nenhuma': null,
};

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const espera = () => new Promise(r => setTimeout(r, 0));

export function useLancamentosLcdpr() {
  const r = useRegrasDoLcdpr();
  const s = useSessaoDoLcdpr();
  const { modal, toast, aviso } = useRetorno();
  const [lendo, setLendo] = useState('');
  const [aberto, setAberto] = useState<number | null>(null);
  const [desfazer, setDesfazer] = useState<Desfazivel | null>(null);

  const lancs = s.lancamentos;
  const total = lancs.length;
  const revisar = lancs.filter(l => l.revisar).length;
  const valor = lancs.reduce((t, l) => t + (Number(l.valor) || 0), 0);
  const visiveis = lcdpr.lancamentosVisiveis(lancs, { busca: s.busca, soRevisar: s.soRevisar });

  /** troca estes lançamentos (pelo id) */
  const trocar = (novos: readonly lcdpr.Lancamento[]) => {
    const porId = new Map(novos.map(l => [l.id, l]));
    mudarSessao(x => ({ ...x, lancamentos: x.lancamentos.map(l => porId.get(l.id) ?? l) }));
  };

  /** a categoria em vários de uma vez, com o Desfazer (aplicar em lote reescrevia 200 linhas sem volta) */
  const classificar = (ids: readonly number[], categoria: string) => {
    const antes = lerSessao().lancamentos.filter(l => ids.includes(l.id));
    if (!antes.length || !categoria) return [];
    const depois = antes.map(l => lcdpr.aplicarCategoria(l, categoria, r.config.categorias));
    trocar(depois);
    setDesfazer({ titulo: antes.length + ' lançamento(s) classificado(s)', voltar: () => trocar(antes) });
    return depois;
  };

  /** depois de classificar à mão: oferece a regra do NCM (que vale já para o que está em REVISAR e para as próximas) */
  const talvezVirarRegra = async (l: lcdpr.Lancamento) => {
    const sug = lcdpr.regraSugerida(l, lerSessao().lancamentos, r.atual());
    if (!sug) return;
    const ok = await modal({
      icone: 'hash', titulo: 'Classificar sempre o NCM ' + sug.regra.prefixo + '… na conta ' + sug.regra.conta + '?',
      texto: 'Vale para ' + sug.quantas + ' lançamento(s) desta importação e para as próximas, sem passar por REVISAR. Dá para mudar depois em LCDPR › Regras de NCM.',
      botoes: [{ rotulo: 'Agora não', valor: false, variante: 'btn-outline' }, { rotulo: 'Criar regra', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    const atual = r.atual();
    const nova = { ...atual, ncmRules: [...atual.ncmRules, sug.regra] };
    if (!(await r.gravar(nova))) return;
    mudarSessao(x => ({ ...x, lancamentos: lcdpr.aplicarRegraNosPendentes(x.lancamentos, sug.regra, nova.categorias) }));
    toast('Regra criada para o NCM ' + sug.regra.prefixo + '.');
  };

  const registrar = (f: File, quantos: number, erro: string, ids: number[] = []) => {
    const imp: ImportacaoDoLcdpr = { id: Date.now() + '-' + Math.random().toString(36).slice(2), arquivo: f.name, bytes: f.size, em: new Date().toISOString(), quantos, erro, ids, desfeita: '' };
    mudarSessao(x => ({ ...x, importacoes: [imp, ...x.importacoes].slice(0, 40) }));
  };

  return {
    carregada: r.carregada, erro: r.erro, exemplos: r.exemplos,
    total, revisar, classificados: total - revisar,
    valor: formatos.reais(valor),
    pronto: total > 0 && revisar === 0,
    pct: total ? Math.round(((total - revisar) / total) * 100) : 0,
    lendo,
    busca: s.busca, soRevisar: s.soRevisar,
    setBusca: (v: string) => mudarSessao(x => ({ ...x, busca: v })),
    alternarRevisar: () => mudarSessao(x => ({ ...x, soRevisar: !x.soRevisar })),
    categorias: r.config.categorias.map(c => c.nome),

    linhas: visiveis.map(l => ({
      id: l.id, origem: l.origem === 'NF' ? 'NF' : 'CT-e', revisar: l.revisar, regra: ROTULO_DA_REGRA[l.origemRegra],
      categoria: l.categoria, data: lcdpr.dataBr(l.data), fornecedor: l.fornecedor, documento: l.documento, valor: formatos.brl(Number(l.valor) || 0),
      selecionado: s.selecionados.has(l.id),
    })),
    /** os grupos do que falta revisar (só com o "só REVISAR" ligado) */
    grupos: s.soRevisar ? lcdpr.gruposParaRevisar(lancs).map(g => ({
      chave: g.chave, fornecedor: g.fornecedor, detalhe: (g.ncm ? 'NCM ' + g.ncm + '… · ' : '') + g.ids.length + ' nota(s) · ' + formatos.reais(g.valor),
    })) : [],
    importacoes: s.importacoes.map(i => ({
      id: i.id, arquivo: i.arquivo, em: dataHora(i.em), erro: i.erro, resultado: i.erro || i.quantos + ' lançamento(s)',
      podeDesfazer: i.ids.length > 0, desfeita: !!i.desfeita,
    })),

    /** lê os relatórios escolhidos (um de cada vez, dizendo em qual está) */
    async importar(arquivos: File[]) {
      if (!r.carregada || lendo) return;
      let somados = 0, pulados = 0;
      for (let k = 0; k < arquivos.length; k++) {
        const f = arquivos[k];
        setLendo('Lendo ' + (k + 1) + ' de ' + arquivos.length + ': ' + f.name + '…');
        await espera();
        // o mesmo arquivo de novo empilhava tudo em dobro, sem aviso nenhum
        const ja = lerSessao().importacoes.find(i => i.arquivo === f.name && i.bytes === f.size && !i.desfeita);
        if (ja && !(await modal({
          icone: 'alert', titulo: 'Importar este arquivo de novo?', texto: '"' + f.name + '" já foi importado em ' + dataHora(ja.em) + '. Importar de novo duplica os lançamentos.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Importar de novo', valor: true, variante: 'btn-danger' }],
        }))) { pulados++; continue; }
        try {
          const lido = lcdpr.lerRelatorio(lcdpr.linhasDoArquivo(await f.arrayBuffer()), r.atual(), novoIdDeLancamento);
          if (lido.erro) {
            registrar(f, 0, lido.erro);
            pulados++;
            if (lido.tipo === 'desconhecido') aviso({ tom: 'erro', titulo: 'Arquivo "' + f.name + '" não reconhecido', texto: lido.erro === 'planilha vazia' ? 'A planilha está vazia.' : 'Não é o Relatório de Detalhamento de Produtos nem o de CT-e do SIEG.' });
            continue;
          }
          mudarSessao(x => ({ ...x, lancamentos: [...x.lancamentos, ...lido.lancamentos] }));
          registrar(f, lido.lancamentos.length, '', lido.lancamentos.map(l => l.id));
          somados += lido.lancamentos.length;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          registrar(f, 0, msg);
          aviso({ tom: 'erro', titulo: 'Erro ao ler "' + f.name + '"', texto: msg });
        }
      }
      setLendo('');
      if (somados) toast(somados + ' lançamento(s) importado(s).');
      else if (pulados) toast('Nenhum lançamento novo importado.');
    },

    /** tira os lançamentos que vieram de um arquivo */
    async desfazerImportacao(id: string) {
      const imp = lerSessao().importacoes.find(i => i.id === id);
      if (!imp || !imp.ids.length) return;
      const ok = await modal({
        icone: 'alert', titulo: 'Desfazer esta importação?', texto: 'Saem os ' + imp.ids.length + ' lançamento(s) que vieram de "' + imp.arquivo + '".',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desfazer', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      const fora = new Set(imp.ids);
      mudarSessao(x => ({
        ...x, lancamentos: x.lancamentos.filter(l => !fora.has(l.id)), selecionados: new Set([...x.selecionados].filter(i => !fora.has(i))),
        importacoes: x.importacoes.map(i => (i.id === id ? { ...i, ids: [], desfeita: new Date().toISOString() } : i)),
      }));
      toast('Importação desfeita.');
    },

    /** a planilha .xls; com lançamento sem classificar, pergunta antes (ele iria sem conta e com o aviso no histórico) */
    async baixar() {
      const todos = lerSessao().lancamentos;
      if (!todos.length) return;
      const pendentes = todos.filter(l => l.revisar);
      if (pendentes.length) {
        const soma = pendentes.reduce((t, l) => t + (Number(l.valor) || 0), 0);
        const ok = await modal({
          icone: 'alert', titulo: 'Baixar com lançamentos sem classificar?',
          texto: pendentes.length + ' lançamento(s), somando ' + formatos.reais(soma) + ', ainda não foram classificados. Eles vão para a planilha sem conta e com o aviso de classificar manualmente no histórico.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Baixar assim mesmo', valor: true, variante: 'btn-primary' }],
        });
        if (!ok) return;
      }
      baixarBytes(lcdpr.planilhaDoLcdpr(todos), lcdpr.NOME_DA_PLANILHA, 'application/vnd.ms-excel');
    },

    /** a categoria de uma linha (e a regra sugerida) */
    escolherCategoria(id: number, categoria: string) {
      const l = lerSessao().lancamentos.find(x => x.id === id);
      if (!l) return;
      const novo = lcdpr.aplicarCategoria(l, categoria, r.config.categorias);
      trocar([novo]);
      if (categoria) void talvezVirarRegra(novo);
    },
    /** a mesma categoria para um grupo inteiro do que falta revisar */
    classificarGrupo(chave: string, categoria: string) {
      const g = lcdpr.gruposParaRevisar(lerSessao().lancamentos).find(x => x.chave === chave);
      if (!g) return;
      const feitos = classificar(g.ids, categoria);
      if (feitos[0]) void talvezVirarRegra(feitos[0]);
    },

    // a seleção
    selecionados: s.selecionados.size,
    todosVisiveisMarcados: visiveis.length > 0 && visiveis.every(l => s.selecionados.has(l.id)),
    alternar: (id: number) => mudarSessao(x => { const n = new Set(x.selecionados); if (n.has(id)) n.delete(id); else n.add(id); return { ...x, selecionados: n }; }),
    marcarVisiveis: (marcar: boolean) => mudarSessao(x => {
      const n = new Set(x.selecionados);
      for (const l of lcdpr.lancamentosVisiveis(x.lancamentos, { busca: x.busca, soRevisar: x.soRevisar })) { if (marcar) n.add(l.id); else n.delete(l.id); }
      return { ...x, selecionados: n };
    }),
    marcarRevisar: () => mudarSessao(x => ({ ...x, selecionados: new Set([...x.selecionados, ...lcdpr.lancamentosVisiveis(x.lancamentos, { busca: x.busca, soRevisar: x.soRevisar }).filter(l => l.revisar).map(l => l.id)]) })),
    limparSelecao: () => mudarSessao(x => ({ ...x, selecionados: new Set() })),
    classificarSelecao: (categoria: string) => { classificar([...lerSessao().selecionados], categoria); },

    // o Desfazer
    desfazer,
    voltarDesfeito: () => { desfazer?.voltar(); setDesfazer(null); },
    esquecerDesfazer: () => setDesfazer(null),

    // a janela de um lançamento
    aberto,
    abrir: (id: number) => setAberto(id),
    fechar: () => setAberto(null),
  };
}
