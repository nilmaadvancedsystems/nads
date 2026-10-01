// ViewModel do Movimento › Relatório (abas Geral/Entradas/Saídas/Tomados/Prestados).
// Origem: conferencia.html confAba (~L3371), renderGeral (~L3593), renderCcChart (~L3419),
// renderCcRank (~L3447), renderCcBalancete (~L3508), autoMarcarConferidos (~L3563),
// renderNotas/renderDivergencias (~L2985, ~L3180) e os change de data-resolve (~L3232-3268),
// renderConfServ (~L4617) e os change de data-resolve-serv/servOrdem (~L4730-4752),
// data-serv-sug → servIrParaForm (~L4539, ~L4590), aplicarBloqueios (~L1843-1861).
import { conferencia as c, formatos } from '@nads/core';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSessao } from '../../casca/sessao';
import { travaDaAba, useMarcarSozinho, type ReqAba } from './movimento';
import { caminho } from '../../casca/caminho';
import { SO_ENTRADAS } from '../../soEntradas';

const { brl, rot, mesCurto, capital, lancN } = formatos;

export const ABAS: { valor: c.AbaRelatorio; rotulo: string }[] = [
  { valor: 'geral', rotulo: 'Geral' },
  { valor: 'entradas', rotulo: 'Entradas' },
  { valor: 'saidas', rotulo: 'Saídas' },
  { valor: 'tomados', rotulo: 'Tomados' },
  { valor: 'prestados', rotulo: 'Prestados' },
];

/** Altura máxima da barra do gráfico (px). */
const ALTURA_BARRA = 104;

export function useRelatorio() {
  const s = useSessao();
  const navegar = useNavigate();
  const e = s.empresa;
  const tem = c.disponivel(e);
  const semP = c.semPrest(e);

  // aba que ficou sem dados volta pra Geral
  // só conferir entradas: sempre a aba Entradas
  const aba: c.AbaRelatorio = SO_ENTRADAS ? 'entradas' : s.abaRelatorio !== 'geral' && !tem[s.abaRelatorio] ? 'geral' : s.abaRelatorio;
  const { abaRelatorio, setAbaRelatorio } = s;
  useEffect(() => { if (aba !== abaRelatorio) setAbaRelatorio(aba); }, [aba, abaRelatorio, setAbaRelatorio]);

  const abas = ABAS.filter(a => !SO_ENTRADAS || a.valor === 'entradas').map(a => ({
    ...a,
    oculta: a.valor === 'prestados' && semP,
    travada: a.valor === 'geral' ? (false as const) : travaDaAba(tem, a.valor as ReqAba),
  }));
  function escolherAba(v: c.AbaRelatorio) {
    const a = abas.find(x => x.valor === v);
    if (a?.travada) { s.avisoImportar(v as ReqAba); return; }
    s.setAbaRelatorio(v);
  }

  const ehServ = aba === 'tomados' || aba === 'prestados';
  const tipoF = c.tipoDaAba(aba);

  // ---------- Geral / Entradas / Saídas ----------
  const rel = ehServ ? null : c.montarRelatorio(e, s.filtro, tipoF);
  useMarcarSozinho(rel ? rel.marcarSozinho : null);

  const stats = rel ? montarStats(rel, tipoF) : [];
  const grafico = rel ? montarGrafico(rel.meses, s.filtro.meses) : null;
  const rank = rel ? montarRank(rel.rank) : null;

  function alternarMes(m: string) {
    s.setFiltro(f => ({ ...f, meses: f.meses.indexOf(m) > -1 ? f.meses.filter(x => x !== m) : f.meses.concat(m) }));
  }
  /** Clicar numa natureza do ranking: filtra o Checklist pelo primeiro CFOP dela. */
  function abrirNatureza(cfops: string) {
    const cfop = cfops.split(',')[0].trim();
    s.setFiltro(f => ({ ...f, busca: cfop }));
    if (cfop) s.irPara('movimento/checklist');
  }

  // ---------- lançamento fora do padrão do CFOP (Entradas/Saídas) ----------
  const tipoNf: c.TipoNotaFiscal | null = aba === 'entradas' || aba === 'saidas' ? aba : null;
  const fiscal = tipoNf ? montarForaDoPadrao(e, tipoNf, s.ordemDiv[tipoNf]) : null;

  function marcarNotaCorrigida(t: c.TipoNotaFiscal, d: c.Divergencia, marcado: boolean) {
    const key = c.chaveResolvido(t, d.chave);
    const n = d.nota;
    s.aplicar(x => c.marcarCorrigido(x, [key], marcado, 'div|' + key, 'Nota ' + n.numero + ' · ' + n.nome + ' · CFOP ' + n.cfop + ' · lanç. ' + n.lanc, new Date()));
  }
  function marcarGrupoCorrigido(t: c.TipoNotaFiscal, gr: c.GrupoForaDoPadrao, marcado: boolean) {
    const q = gr.itens.length;
    s.aplicar(x => c.marcarCorrigido(x, gr.chavesDaNatureza, marcado, 'divg|' + t + '|' + gr.key, gr.titulo + ' (' + q + ' nota' + (q > 1 ? 's' : '') + ')', new Date()));
  }

  // ---------- Tomados / Prestados ----------
  const tipoServ: c.TipoServico | null = aba === 'tomados' || aba === 'prestados' ? aba : null;
  const serv = tipoServ ? montarServicos(e, tipoServ, s.filtro, s.ordemServ[tipoServ]) : null;

  function marcarServCorrigido(t: c.TipoServico, it: c.NotaForaDoPadraoServ, marcado: boolean) {
    const n = it.nota;
    const l = lancN(n.lanc);
    const texto = c.SV[t].rotulo + ' · nota ' + n.numero + ' · ' + n.nome + ' · lanç. ' + (l || '—') + ' (esperado ' + it.esperado.lanc + ' — ' + it.esperado.nome + ')';
    s.aplicar(x => c.marcarCorrigido(x, ['serv:' + it.chave], marcado, 'servdiv|' + it.chave, texto, new Date()));
  }
  function marcarServGrupoCorrigido(t: c.TipoServico, gr: c.GrupoForaDoPadraoServ, marcado: boolean) {
    const q = gr.itens.length;
    const texto = c.SV[t].rotulo + ' · ' + gr.nome + ' (' + q + ' nota' + (q > 1 ? 's' : '') + ')';
    s.aplicar(x => c.marcarCorrigido(x, gr.itens.map(it => 'serv:' + it.chave), marcado, 'servdivg|' + t + '|' + gr.key, texto, new Date()));
  }
  /** "Colocar em X": abre o Cadastro já com o formulário da categoria e o participante. */
  function colocarNaCategoria(t: c.TipoServico, catId: string, nome: string) {
    s.setAbaCadastro(t);
    if (!c.importacoesOk(e)) { s.irPara('cadastro/configuracoes'); return; }
    navegar(caminho(s.rota + '/cadastro/configuracoes') + '?servAdd=' + encodeURIComponent(t + '|' + catId + '|' + nome));
  }

  return {
    abas, aba, escolherAba, ehServ,
    stats, saldo: rel ? rel.saldo : [], grafico, rank, alternarMes, abrirNatureza,
    revisar: s.revisarConta,
    tipoNf, fiscal, ordemDiv: tipoNf ? s.ordemDiv[tipoNf] : 'cfop',
    setOrdemDiv: (o: c.OrdemGrupos) => { if (tipoNf) s.setOrdemDiv(tipoNf, o); },
    marcarNotaCorrigida, marcarGrupoCorrigido,
    tipoServ, serv, ordemServ: tipoServ ? s.ordemServ[tipoServ] : 'nome',
    setOrdemServ: (o: c.OrdemServ) => { if (tipoServ) s.setOrdemServ(tipoServ, o); },
    marcarServCorrigido, marcarServGrupoCorrigido, colocarNaCategoria,
  };
}

export interface StatRelatorio { rotulo: string; valor: string; cor?: 'entrada' | 'saida' }

function montarStats(r: c.Relatorio, tipoF: '' | c.TipoCfop): StatRelatorio[] {
  if (!tipoF) {
    return [
      { rotulo: 'Entradas no período', valor: brl(r.totEnt), cor: 'entrada' },
      { rotulo: 'Saídas no período', valor: brl(r.totSai), cor: 'saida' },
      { rotulo: 'Total geral', valor: brl(r.totEnt + r.totSai) },
      { rotulo: 'Notas no período', valor: String(r.qtdNotas) },
    ];
  }
  const ent = tipoF === 'Entrada';
  return [
    { rotulo: (ent ? 'Entradas' : 'Saídas') + ' no período', valor: brl(ent ? r.totEnt : r.totSai), cor: ent ? 'entrada' : 'saida' },
    { rotulo: 'Notas no período', valor: String(r.qtdNotas) },
    { rotulo: 'Naturezas de CFOP', valor: String(r.qtdNaturezas) },
  ];
}

function montarGrafico(meses: c.MesDoGrafico[], marcados: string[]) {
  if (!meses.length) return null;
  let max = 0;
  for (const m of meses) max = Math.max(max, m.ent, m.sai);
  if (!max) max = 1;
  return meses.map(d => ({
    comp: d.comp,
    ligado: marcados.indexOf(d.comp) > -1,
    titulo: rot(d.comp) + ' — entradas ' + brl(d.ent) + ' · saídas ' + brl(d.sai) + ' · ' + d.qtd + ' nota(s)',
    alturaEnt: d.ent ? Math.max(3, Math.round(d.ent / max * ALTURA_BARRA)) : 0,
    alturaSai: d.sai ? Math.max(3, Math.round(d.sai / max * ALTURA_BARRA)) : 0,
    rotulo: mesCurto(d.comp),
  }));
}

function montarRank(rank: c.ItemRank[]) {
  if (!rank.length) return null;
  const max = rank[0].valor || 1;
  return rank.map(l => ({
    k: l.k, tipo: l.tipo, nome: l.nome, cfops: l.cfops, valor: l.valor,
    titulo: l.cfops + ' — ' + l.nome,
    largura: Math.max(2, Math.round(l.valor / max * 100)),
  }));
}

function montarForaDoPadrao(e: c.Empresa, t: c.TipoNotaFiscal, ordem: c.OrdemGrupos) {
  const r = c.foraDoPadraoFiscal(e, t, ordem);
  return { ...r, vazio: 'Nenhum lançamento fora do padrão do CFOP nas ' + (t === 'entradas' ? 'entradas' : 'saídas') + '.' };
}

function montarServicos(e: c.Empresa, t: c.TipoServico, f: c.FiltroMovimento, ordem: c.OrdemServ) {
  const cfg = c.SV[t];
  const r = c.conferirServicos(e, t, f, ordem);
  const stats: StatRelatorio[] = [{ rotulo: (t === 'prestados' ? 'Prestados' : 'Tomados') + ' no período', valor: brl(r.totais.valor), cor: t === 'prestados' ? 'saida' : 'entrada' }];
  if (r.temIss) stats.push({ rotulo: 'ISS do período', valor: brl(r.totais.iss) }, { rotulo: 'ISS retido', valor: brl(r.totais.issRet) });
  if (r.totais.irrf) stats.push({ rotulo: 'IRRF retido', valor: brl(r.totais.irrf) });
  if (r.totais.inss) stats.push({ rotulo: 'INSS retido', valor: brl(r.totais.inss) });
  stats.push({ rotulo: 'Notas', valor: String(r.qtdNotas) }, { rotulo: capital(cfg.parts), valor: String(r.qtdParticipantes) }, { rotulo: 'Fora do padrão', valor: String(r.qtdForaDoPadrao) });
  return {
    ...r,
    stats,
    /** title da coluna Notas: "3 fornecedores: A, B, C" */
    tituloNotas: (l: c.LinhaSaldoServ) => l.participantes.length + ' ' + (l.participantes.length > 1 ? cfg.parts : cfg.part) + ': ' + l.participantes.join(', '),
    ordens: [['nome', capital(cfg.part) + ' (A-Z)'], ['valor', 'Valor (maior primeiro)'], ['data', 'Data']] as [c.OrdemServ, string][],
    /** "527 é de Telefone —" (a dica antes dos botões "Colocar em …") */
    dicaSugestao: (gr: c.GrupoForaDoPadraoServ) =>
      gr.sugerirCategorias.map(x => x.lanc).filter((v, i, l) => l.indexOf(v) === i).join(', ') + ' é de ' + gr.sugerirCategorias.map(x => x.nome).join(' / ') + ' —',
  };
}
