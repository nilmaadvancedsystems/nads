// ViewModel do Relatório do Fiscal (28/10/2026: a planilha "RELATORIO EMPRESA 2026" no estilo das Obrigações do DP), uma
// página por regime no menu lateral ("lucro presumido e simples são diferentes, deixa cada um separado"): o Relatório
// Simples (só as empresas do Simples Nacional no Cadastro) e o Relatório Presumido (só as do Presumido). Tomou o lugar do
// Controle de tributos ("remove a tela de controle de tributos, e pegue os dados de lá"): os mesmos dados no banco
// (controleTributos e controleTributosFolha) — os valores em reais, a data, as conferências, a entrega
// e a impressão do protocolo (as observações e a retificação saíram por enquanto). A coluna da REINF saiu
// (29/10/2026: "a parte do R das conferencias ja e a reinf"). Quem grava o controle: o Fiscal e o admin; o resto da equipe só vê.
import { formatos, tarefas as t } from '@nads/core';
import { logoNilmaParaImprimir, useRetorno } from '@nads/ui';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { FOLHA_VAZIA } from '../../../dados/controleTributos';
import { useControleTributos } from '../../../dados/repo';
import { useListaDoCadastro } from '../../cadastro/escolher/useListaDoCadastro';
import { imprimirHtml } from '../../dp/imprimirHtml';
import { usePorPagina } from './usePorPagina';

/** O regime da página: o grupo do controle e o regime do Cadastro que entra nele. */
export type RegimeDoRelatorio = 'sn' | 'lp';
const REGIME_DO_CADASTRO: Record<RegimeDoRelatorio, string> = { sn: 'Simples', lp: 'Presumido' };

/** As partes da tabela (o título do grupo de colunas e o filtro Pendente em). */
export type ParteDoRelatorio = 'guias' | 'conferencias' | 'entrega';
const PARTES: readonly { valor: ParteDoRelatorio; rotulo: string }[] = [
  { valor: 'guias', rotulo: 'Guias' }, { valor: 'conferencias', rotulo: 'Conferências' }, { valor: 'entrega', rotulo: 'Entrega' },
];
// os nomes curtos no título da coluna (o nome inteiro fica na dica), como o DP
export const CURTO: Record<string, string> = {
  das: 'DAS', 'icms-ant': 'Antec.', 'icms-arroz': 'Arroz', 'icms-dif': 'Dif. uso', 'icms-dif-ativo': 'Dif. ativo', 'st-ent': 'ST ent.', 'st-sai': 'ST saí.',
  pis: 'PIS', cofins: 'COFINS', irpj: 'IRPJ', csll: 'CSLL', icms: 'ICMS', iss: 'ISS', ibs: 'IBS', cbs: 'CBS', parc: 'Parc.',
};
const STATUS = [
  { valor: 'pendentes', rotulo: 'Pendentes' },
  ...(['nao-iniciada', 'em-andamento', 'concluida'] as const).map(v => ({ valor: v, rotulo: t.ROTULO_SITUACAO_GERAL[v] })),
];
const ENTREGAS = [{ valor: 'falta', rotulo: 'Falta' }, ...t.ENTREGAS_DO_CONTROLE.filter(e => e.valor).map(e => ({ valor: e.valor as string, rotulo: e.rotulo }))];
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** dd/mm/aaaa ↔ AAAA-MM-DD */
export const dataBr = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const dataIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
/** o mesmo conteúdo (sem quem e quando gravou) */
const mesmoConteudo = (a: t.LinhaDoControle, b: t.LinhaDoControle) => {
  const c = (l: t.LinhaDoControle) => JSON.stringify([l.grupo, l.data, l.entregue, Object.entries(l.valores).sort(), Object.entries(l.marcas).sort()]);
  return c(a) === c(b);
};

export function useRelatorioGeral(regime: RegimeDoRelatorio) {
  const { toast } = useRetorno();
  const op = useOperador().operador;
  const podeGravar = !!op && (op.admin || op.departamento === 'fiscal');
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const repo = useControleTributos();
  const lista = useListaDoCadastro();
  const grupo = t.grupoDoControle(regime);
  const mes = repo.doMes(competencia);
  /** as colunas de guia: todas do grupo (o arroz e o parcelamento voltaram para a tabela, 28/10/2026) */
  const colunas = grupo.colunas;
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [pendenteEm, setPendenteEm] = useState('');
  const [entrega, setEntrega] = useState('');
  const { porPagina, porPaginaOpcoes, escolher: escolherPorPagina } = usePorPagina();
  const [pagina, setPagina] = useState(0);

  // as empresas do regime no Cadastro do nads (o do Entregas, quando o nads não tem)
  const empresas = useMemo(() => lista.linhas
    .filter(l => l.codigo != null && l.regime === REGIME_DO_CADASTRO[regime])
    .map(l => ({ codigo: l.codigo as number, nome: l.nome }))
    .sort((a, b) => a.codigo - b.codigo), [lista.linhas, regime]);

  // sem preenchimento vindo do Entregas (Vitor, 09/11/2026: "não haja preenchimento automático das entregas para o fiscal"): nem a sugestão apagada nos campos, nem o Preencher com o Entregas
  // o que acabou de ser gravado vale até o banco devolver (dois cliques seguidos não perdem o primeiro)
  const gravadas = useRef(new Map<string, t.LinhaDoControle>());
  const linhaDe = (codigo: number) => {
    const id = t.idDaLinhaDoControle(competencia, codigo);
    const minha = gravadas.current.get(id);
    const doBanco = mes.linhas.get(codigo);
    if (minha && doBanco && mesmoConteudo(minha, doBanco)) gravadas.current.delete(id);
    return gravadas.current.get(id) || doBanco || t.linhaEmBranco(competencia, codigo, grupo.id);
  };

  const todas = empresas.map(e => {
    const l = linhaDe(e.codigo);
    // a situação: concluída quando entregou (ou não se aplica); começada se tem algo (a REINF é o R das conferências)
    const doControle = t.situacaoDaLinha(l);
    const situacao: t.SituacaoGeral = l.entregue ? 'concluida' : doControle !== 'branco' ? 'em-andamento' : 'nao-iniciada';
    const pendencias = new Set<ParteDoRelatorio>();
    if (colunas.some(c => !(l.valores[c.id] || '').trim())) pendencias.add('guias');
    if (grupo.marcas.some(m => !l.marcas[m.id])) pendencias.add('conferencias');
    if (!l.entregue) pendencias.add('entrega');
    return { ...e, linha: l, situacao, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[situacao], pendencias };
  });

  const q = semAcento(busca.trim());
  const linhas = todas.filter(r => (!q || semAcento(r.nome).includes(q) || String(r.codigo).startsWith(q))
    && (!status || (status === 'pendentes' ? r.situacao !== 'concluida' : r.situacao === status))
    && (!entrega || (entrega === 'falta' ? !r.linha.entregue : r.linha.entregue === entrega))
    && (!pendenteEm || r.pendencias.has(pendenteEm as ParteDoRelatorio)));
  // a página: a busca e os filtros correm todas as empresas, e só depois a lista se divide em páginas
  const paginas = porPagina ? Math.max(1, Math.ceil(linhas.length / porPagina)) : 1;
  const atual = Math.min(pagina, paginas - 1);
  const daPagina = porPagina ? linhas.slice(atual * porPagina, (atual + 1) * porPagina) : linhas;
  async function gravar(l: t.LinhaDoControle) {
    if (!podeGravar) return;
    const nova = { ...l, grupo: grupo.id, atualizadoEm: undefined, atualizadoPor: undefined };
    const id = t.idDaLinhaDoControle(l.competencia, l.codigo);
    gravadas.current.set(id, nova);
    try { await repo.salvarLinha(nova); } catch { gravadas.current.delete(id); toast('Não deu para guardar: confira a internet e tente de novo'); }
  }

  return {
    carregando: !mes.carregada || lista.carregando,
    exemplos: repo.exemplos,
    podeGravar,
    titulo: 'Relatório ' + (regime === 'sn' ? 'Simples' : 'Lucro Presumido'),
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => { const n = new URLSearchParams(params); n.set('competencia', c); setParams(n); },
    filtros: {
      // trocar a busca ou um filtro volta para a primeira página
      busca, setBusca: (b: string) => { setBusca(b); setPagina(0); }, status, setStatus: (s: string) => { setStatus(s); setPagina(0); },
      pendenteEm, setPendenteEm: (p: string) => { setPendenteEm(p); setPagina(0); }, entrega, setEntrega: (e: string) => { setEntrega(e); setPagina(0); },
      porPagina, porPaginaOpcoes,
      setPorPagina: (n: number) => { escolherPorPagina(n); setPagina(0); },
      statusOpcoes: STATUS, partes: PARTES, entregas: ENTREGAS,
      algum: !!(busca || status || pendenteEm || entrega),
      limpar: () => { setBusca(''); setStatus(''); setPendenteEm(''); setEntrega(''); setPagina(0); },
    },
    grupo,
    /** as colunas das guias da página, com o nome curto */
    guias: colunas.map(c => ({ id: c.id, rotulo: CURTO[c.id] || c.rotulo, nome: c.rotulo })),
    /** a página da lista: a anterior e a próxima */
    pagina: { atual, paginas,
      anterior: () => setPagina(Math.max(0, atual - 1)), proxima: () => setPagina(Math.min(paginas - 1, atual + 1)) },
    total: todas.length, linhas: daPagina, achadas: linhas.length, faltam: linhas.filter(r => r.situacao !== 'concluida').length,
    /** um campo de valor: guarda como fica na tela (1.234,50, — ou 0) */
    mudarValor(codigo: number, coluna: string, texto: string) {
      const l = linhaDe(codigo);
      const v = t.valorDoControle(texto);
      if ((l.valores[coluna] || '') === v) return;
      const valores = { ...l.valores };
      if (v) valores[coluna] = v; else delete valores[coluna];
      void gravar({ ...l, valores });
    },
    mudarData(codigo: number, br: string) {
      const l = linhaDe(codigo);
      const iso = br.trim() ? dataIso(br) : '';
      if (br.trim() && !iso) { toast('A data fica dd/mm/aaaa'); return; }
      if (iso !== l.data) void gravar({ ...l, data: iso });
    },
    /** a conferência anda em volta: em branco → OK → não se aplica → em branco */
    virarMarca(codigo: number, marca: string) {
      const l = linhaDe(codigo);
      const proxima = t.PROXIMA_MARCA[l.marcas[marca] || ''];
      const marcas = { ...l.marcas };
      if (proxima) marcas[marca] = proxima; else delete marcas[marca];
      void gravar({ ...l, marcas });
    },
    mudarEntrega(codigo: number, e: t.EntregaDoControle) {
      const l = linhaDe(codigo);
      // entregou sem data: a de hoje, em Brasília (o ISO é UTC: depois das 21h dava o dia seguinte)
      const data = e && e !== 'nao' && !l.data ? formatos.diaEmBrasilia() : l.data;
      void gravar({ ...l, entregue: e, data });
    },
    imprimir() {
      imprimirHtml(t.htmlDoControle({ competencia, grupo, empresas, linhas: mes.linhas, folha: FOLHA_VAZIA, logo: logoNilmaParaImprimir('colorida') }));
      toast('Protocolo pronto: escolha a impressora');
    },
    exportar() {
      const marca = (m: string | undefined) => (m === 'ok' ? 'OK' : m === 'na' ? '—' : '');
      const cabecalho = ['Cód.', 'Cliente', ...colunas.map(c => c.rotulo), ...grupo.marcas.map(m => m.dica), 'Data', 'Entregue', 'Situação'];
      const valores = linhas.map(r => [
        r.codigo, r.nome, ...colunas.map(c => r.linha.valores[c.id] || ''), ...grupo.marcas.map(m => marca(r.linha.marcas[m.id])),
        dataBr(r.linha.data), t.ENTREGAS_DO_CONTROLE.find(e => e.valor === r.linha.entregue)?.rotulo || '', r.rotuloSituacao,
      ]);
      return { bytes: t.planilhaXlsx(grupo.rotulo + ' ' + competencia.slice(5, 7) + '-' + competencia.slice(0, 4), cabecalho, valores), nome: 'Fiscal relatório ' + (regime === 'sn' ? 'Simples' : 'Presumido') + ' ' + competencia + '.xlsx' };
    },
  };
}
export type VmRelatorio = ReturnType<typeof useRelatorioGeral>;
