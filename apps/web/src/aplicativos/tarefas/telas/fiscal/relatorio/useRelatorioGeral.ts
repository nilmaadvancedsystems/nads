// ViewModel do Relatório do Fiscal (28/10/2026: a planilha "RELATORIO EMPRESA 2026" no estilo das Obrigações do DP), uma
// página por regime no menu lateral ("lucro presumido e simples são diferentes, deixa cada um separado"): o Relatório
// Simples (só as empresas do Simples Nacional no Cadastro) e o Relatório Presumido (só as do Presumido). Tomou o lugar do
// Controle de tributos ("remove a tela de controle de tributos, e pegue os dados de lá"): os mesmos dados no banco
// (controleTributos e controleTributosFolha) — os valores em reais, a data, as conferências, a entrega, as sugestões do
// Entregas, as observações, a retificação e a impressão do protocolo — e, junto, a REINF com as ações da tela da REINF
// (transmitir, desfazer, retificar). Quem grava o controle: o Fiscal e o admin; o resto da equipe só vê.
import { tarefas as t } from '@nads/core';
import { logoNilmaParaImprimir, useRetorno } from '@nads/ui';
import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useOperador } from '../../../casca/operador';
import { FOLHA_VAZIA } from '../../../dados/controleTributos';
import { useControleTributos, useEntregasDeDocumentos, useGmailDoEntregas } from '../../../dados/repo';
import { useListaDoCadastro } from '../../cadastro/escolher/useListaDoCadastro';
import { imprimirHtml } from '../../dp/imprimirHtml';
import { mmaaaa, quandoDaReinf, useAcoesDaReinf } from '../reinf/useAcoesDaReinf';

/** O regime da página: o grupo do controle e o regime do Cadastro que entra nele. */
export type RegimeDoRelatorio = 'sn' | 'lp';
const REGIME_DO_CADASTRO: Record<RegimeDoRelatorio, string> = { sn: 'Simples', lp: 'Presumido' };

/** As partes da tabela (o título do grupo de colunas e o filtro Pendente em). */
export type ParteDoRelatorio = 'guias' | 'conferencias' | 'reinf' | 'entrega';
const PARTES: readonly { valor: ParteDoRelatorio; rotulo: string }[] = [
  { valor: 'guias', rotulo: 'Guias' }, { valor: 'conferencias', rotulo: 'Conferências' }, { valor: 'reinf', rotulo: 'REINF' }, { valor: 'entrega', rotulo: 'Entrega' },
];
// os nomes curtos no título da coluna (o nome inteiro fica na dica), como o DP
const CURTO: Record<string, string> = {
  das: 'DAS', 'icms-ant': 'Antec.', 'icms-arroz': 'Arroz', 'icms-dif': 'Dif. uso', 'icms-dif-ativo': 'Dif. ativo', 'st-ent': 'ST ent.', 'st-sai': 'ST saí.',
  pis: 'PIS', cofins: 'COFINS', irpj: 'IRPJ', csll: 'CSLL', icms: 'ICMS', iss: 'ISS', parc: 'Parc.',
};
const STATUS = [
  { valor: 'pendentes', rotulo: 'Pendentes' },
  ...(['nao-iniciada', 'em-andamento', 'concluida'] as const).map(v => ({ valor: v, rotulo: t.ROTULO_SITUACAO_GERAL[v] })),
];
const ENTREGAS = [{ valor: 'falta', rotulo: 'Falta' }, ...t.ENTREGAS_DO_CONTROLE.filter(e => e.valor).map(e => ({ valor: e.valor as string, rotulo: e.rotulo }))];
// quantas empresas por página (28/10/2026: "um filtro que o usuário escolhe quantas empresas tem por página"); 0 = todas.
// Fica guardado neste navegador.
const POR_PAGINA = [25, 50, 100, 0] as const;
const CHAVE_POR_PAGINA = 'nads-relatorio-por-pagina';
function porPaginaGuardado(): number {
  try { const s = localStorage.getItem(CHAVE_POR_PAGINA); const n = Number(s); return s !== null && (POR_PAGINA as readonly number[]).includes(n) ? n : 25; } catch { return 25; }
}
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** dd/mm/aaaa ↔ AAAA-MM-DD */
export const dataBr = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const dataIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
/** o mesmo conteúdo (sem quem e quando gravou) */
const mesmoConteudo = (a: t.LinhaDoControle, b: t.LinhaDoControle) => {
  const c = (l: t.LinhaDoControle) => JSON.stringify([l.grupo, l.data, l.entregue, Object.entries(l.valores).sort(), Object.entries(l.marcas).sort()]);
  return c(a) === c(b);
};

/** A REINF da linha: não tem, pendente ou transmitida, com a dica (até quando, a última, as retificadas). */
export interface ReinfDaLinha { tem: boolean; transmitida: boolean; retificada: boolean; dica: string; dicaRetificar: string }

export function useRelatorioGeral(regime: RegimeDoRelatorio) {
  const { toast } = useRetorno();
  const op = useOperador().operador;
  const podeGravar = !!op && (op.admin || op.departamento === 'fiscal');
  const [params, setParams] = useSearchParams();
  const competencias = competenciasDaTela(12);
  const competencia = competencias.includes(params.get('competencia') || '') ? (params.get('competencia') as string) : competencias[0];
  const repo = useControleTributos();
  const lista = useListaDoCadastro();
  const entregas = useEntregasDeDocumentos();
  const gmail = useGmailDoEntregas();
  const reinf = useAcoesDaReinf(competencia);
  const grupo = t.grupoDoControle(regime);
  const mes = repo.doMes(competencia);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [pendenteEm, setPendenteEm] = useState('');
  const [entrega, setEntrega] = useState('');
  const [porPagina, setPorPagina] = useState(porPaginaGuardado);
  const [pagina, setPagina] = useState(0);

  // as empresas do regime no Cadastro do nads (o do Entregas, quando o nads não tem)
  const empresas = useMemo(() => lista.linhas
    .filter(l => l.codigo != null && l.regime === REGIME_DO_CADASTRO[regime])
    .map(l => ({ codigo: l.codigo as number, nome: l.nome }))
    .sort((a, b) => a.codigo - b.codigo), [lista.linhas, regime]);

  // as guias que o Entregas entregou na competência, ligadas ao código pelo cliente do Entregas (a sugestão em cinza)
  const doMes = entregas.doMes(competencia);
  const codigoDoCliente = new Map(gmail.clientes().lista.map(c => [c.id, Number(c.codigo)]));
  const guiasEntregues: t.GuiaEntregue[] = doMes.lista.flatMap(e => {
    const codigo = e.clienteId ? codigoDoCliente.get(e.clienteId) : undefined;
    return codigo && e.status === 'confirmada' ? [{ codigo, itens: e.itens, em: e.confirmadoEm, porEmail: e.comprovantePorEmail || e.canal === 'email' }] : [];
  });
  const sugestoes = t.sugestoesDoEntregas(grupo, empresas, guiasEntregues);

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
    const est = reinf.estados[e.codigo];
    const transmitida = !!est && t.situacaoReinf(est, competencia) === 'transmitida';
    const retificada = !!est && est.retificadas.includes(competencia);
    const r: ReinfDaLinha = !est ? { tem: false, transmitida: false, retificada: false, dica: 'Não tem REINF no Fiscal', dicaRetificar: 'Não tem REINF no Fiscal' } : {
      tem: true, transmitida, retificada,
      dica: 'REINF ' + (transmitida ? 'transmitida (clique para desfazer)' : 'pendente (clique quando transmitir)') + ' · '
        + (est.transmitidoAte ? 'transmitido até ' + mmaaaa(est.transmitidoAte) : 'nunca transmitida') + (est.ultima ? ' · última: ' + quandoDaReinf(est.ultima.em) + ', ' + est.ultima.por : ''),
      dicaRetificar: retificada ? 'Retificada nesta competência (clique para tirar)' : 'Retificou esta competência? Clique para marcar' + (est.retificadas.length ? ' · retificadas: ' + est.retificadas.map(mmaaaa).join(', ') : ''),
    };
    // a situação: concluída quando entregou (ou não se aplica) e a REINF que tem está transmitida; começada se tem algo
    const doControle = t.situacaoDaLinha(l);
    const situacao: t.SituacaoGeral = !!l.entregue && (!r.tem || transmitida) ? 'concluida' : doControle !== 'branco' || transmitida || retificada ? 'em-andamento' : 'nao-iniciada';
    const pendencias = new Set<ParteDoRelatorio>();
    if (grupo.colunas.some(c => !(l.valores[c.id] || '').trim())) pendencias.add('guias');
    if (grupo.marcas.some(m => !l.marcas[m.id])) pendencias.add('conferencias');
    if (r.tem && !transmitida) pendencias.add('reinf');
    if (!l.entregue) pendencias.add('entrega');
    return { ...e, linha: l, sugestao: sugestoes.get(e.codigo), reinf: r, situacao, rotuloSituacao: t.ROTULO_SITUACAO_GERAL[situacao], pendencias };
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
  const totais = grupo.colunas.map(c => {
    const v = linhas.reduce((s, r) => s + t.numeroDoControle(r.linha.valores[c.id] || ''), 0);
    return { id: c.id, valor: v ? brl(v) : '—' };
  });
  const folha = mes.folhas.get(grupo.id) || FOLHA_VAZIA;
  // as linhas que ganham alguma coisa com a sugestão do Entregas
  const paraPreencher = todas.flatMap(r => {
    const nova = r.sugestao ? t.preencherComSugestao(r.linha, r.sugestao) : r.linha;
    return JSON.stringify(nova) !== JSON.stringify(r.linha) ? [nova] : [];
  });

  async function gravar(l: t.LinhaDoControle) {
    if (!podeGravar) return;
    const nova = { ...l, grupo: grupo.id, atualizadoEm: undefined, atualizadoPor: undefined };
    const id = t.idDaLinhaDoControle(l.competencia, l.codigo);
    gravadas.current.set(id, nova);
    try { await repo.salvarLinha(nova); } catch { gravadas.current.delete(id); toast('Não deu para guardar: confira a internet e tente de novo'); }
  }
  async function gravarFolha(f: t.FolhaDoControle) {
    if (!podeGravar) return;
    try { await repo.salvarFolha(competencia, grupo.id, f); } catch { toast('Não deu para guardar: confira a internet e tente de novo'); }
  }

  return {
    carregando: !mes.carregada || lista.carregando,
    exemplos: repo.exemplos,
    podeGravar,
    titulo: 'Relatório ' + (regime === 'sn' ? 'Simples' : 'Presumido'),
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia: (c: string) => { const n = new URLSearchParams(params); n.set('competencia', c); setParams(n); },
    filtros: {
      // trocar a busca ou um filtro volta para a primeira página
      busca, setBusca: (b: string) => { setBusca(b); setPagina(0); }, status, setStatus: (s: string) => { setStatus(s); setPagina(0); },
      pendenteEm, setPendenteEm: (p: string) => { setPendenteEm(p); setPagina(0); }, entrega, setEntrega: (e: string) => { setEntrega(e); setPagina(0); },
      porPagina, porPaginaOpcoes: POR_PAGINA.map(n => ({ valor: n, rotulo: n ? String(n) : 'Todas' })),
      setPorPagina: (n: number) => { setPorPagina(n); setPagina(0); try { localStorage.setItem(CHAVE_POR_PAGINA, String(n)); } catch { /* sem armazenamento: só agora */ } },
      statusOpcoes: STATUS, partes: PARTES, entregas: ENTREGAS,
      algum: !!(busca || status || pendenteEm || entrega),
      limpar: () => { setBusca(''); setStatus(''); setPendenteEm(''); setEntrega(''); setPagina(0); },
    },
    grupo,
    /** as colunas das guias com o nome curto (o parcelamento é a última) */
    guias: grupo.colunas.map(c => ({ id: c.id, rotulo: CURTO[c.id] || c.rotulo, nome: c.rotulo })),
    /** a página da lista: '1–25 de 166', a anterior e a próxima */
    pagina: { atual, paginas, de: daPagina.length ? atual * (porPagina || linhas.length) + 1 : 0, ate: atual * (porPagina || linhas.length) + daPagina.length,
      anterior: () => setPagina(Math.max(0, atual - 1)), proxima: () => setPagina(Math.min(paginas - 1, atual + 1)) },
    total: todas.length, linhas: daPagina, achadas: linhas.length, faltam: linhas.filter(r => r.situacao !== 'concluida').length, totais,
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
      // entregou sem data: a de hoje
      const data = e && e !== 'nao' && !l.data ? new Date().toISOString().slice(0, 10) : l.data;
      void gravar({ ...l, entregue: e, data });
    },
    // a REINF: as mesmas ações da tela da REINF
    alternarReinf: (codigo: number, transmitida: boolean) => (transmitida ? reinf.desfazer(codigo) : reinf.transmitir(codigo)),
    retificarReinf: reinf.retificar,
    comSugestaoParaUsar: paraPreencher.length,
    /** passa as sugestões do Entregas para os campos em branco (o que a pessoa escreveu fica) */
    async usarSugestoes() {
      const mudar = paraPreencher;
      for (const l of mudar) await gravar(l);
      toast(mudar.length === 1 ? '1 empresa preenchida com o Entregas' : mudar.length + ' empresas preenchidas com o Entregas');
    },
    folha,
    mudarObservacoes: (observacoes: string[]) => void gravarFolha({ ...folha, observacoes }),
    mudarRetificacoes: (retificacoes: t.RetificacaoDoControle[]) => void gravarFolha({ ...folha, retificacoes }),
    nomeDe: (codigo: number | null) => (codigo == null ? '' : empresas.find(e => e.codigo === codigo)?.nome || ''),
    imprimir() {
      imprimirHtml(t.htmlDoControle({ competencia, grupo, empresas, linhas: mes.linhas, folha, logo: logoNilmaParaImprimir('colorida') }));
      toast('Protocolo pronto: escolha a impressora');
    },
    exportar() {
      const marca = (m: string | undefined) => (m === 'ok' ? 'OK' : m === 'na' ? '—' : '');
      const cabecalho = ['Cód.', 'Cliente', ...grupo.colunas.map(c => c.rotulo), ...grupo.marcas.map(m => m.dica), 'REINF', 'Retificada', 'Data', 'Entregue', 'Situação'];
      const valores = linhas.map(r => [
        r.codigo, r.nome, ...grupo.colunas.map(c => r.linha.valores[c.id] || ''), ...grupo.marcas.map(m => marca(r.linha.marcas[m.id])),
        r.reinf.tem ? (r.reinf.transmitida ? 'Transmitida' : 'Pendente') : '—', r.reinf.retificada ? 'Sim' : '',
        dataBr(r.linha.data), t.ENTREGAS_DO_CONTROLE.find(e => e.valor === r.linha.entregue)?.rotulo || '', r.rotuloSituacao,
      ]);
      return { bytes: t.planilhaXlsx(grupo.rotulo + ' ' + competencia.slice(5, 7) + '-' + competencia.slice(0, 4), cabecalho, valores), nome: 'Fiscal relatório ' + (regime === 'sn' ? 'Simples' : 'Presumido') + ' ' + competencia + '.xlsx' };
    },
  };
}
export type VmRelatorio = ReturnType<typeof useRelatorioGeral>;
