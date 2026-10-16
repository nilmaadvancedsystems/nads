// ViewModel da conferência do FGTS na etapa da folha (Vitor, 16/10/2026: "quero desenvolver algo para corrigir o FGTS… aprenda
// a ler o PDF e o razão"): o razão do FGTS a recolher (o da linha do FGTS) × as guias do FGTS Digital (o PDF "Detalhe da Guia
// Emitida"). Mês a mês: provisão × guia, cada trabalhador, o pagamento (no razão ou, sem ele, no extrato do banco) e os
// lançamentos sugeridos, com a contrapartida de cada um e o .xls do Alterdata. As guias ficam guardadas (comum/guardado.ts).
import { creditor, extrator, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useState } from 'react';
import { useGuardado } from '../../../../comum/guardado';
import type { ContaDoPlano } from './useInssDaEtapa';

extrator.definirWorkerDoPdf(workerDoPdf);

const dataBR = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const reais = formatos.reais;

/**
 * chave: empresa, etapa e período. razao: o razão do FGTS a recolher (importado na linha do FGTS). extrato: os lançamentos
 * dos bancos da empresa (para achar o pagamento que não foi lançado no razão).
 */
export function useFgtsDaEtapa(chave: string, meses: readonly string[], razao: t.RazaoDaConta | null, extrato: readonly t.LancamentoDoBanco[], balancete: readonly ContaDoPlano[] = []) {
  const { aviso } = useRetorno();
  const [guias, setGuias] = useGuardado<{ chave: string; arquivos: string[]; guias: t.GuiaDoFgts[] } | null>('fgts-guias|' + chave, null);
  const [contrapartidas, setContrapartidas] = useGuardado<Record<string, string>>('fgts-contrapartidas|' + chave, {});
  const [contaDigitada, setContaFgts] = useGuardado('fgts-conta|' + chave, '');
  const [lendo, setLendo] = useState(false);
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  // a conta do FGTS a recolher no balancete, pelo nome (travada); sem ela, a digitada
  const doBalancete = balancete.find(x => /fgts\s+a\s+recolher/i.test(x.nome)) || null;
  const contaFgts = doBalancete?.codigo || contaDigitada;
  const g = guias && guias.chave === chave ? guias : null;
  const c = razao && g && meses.length ? t.conferirFgts(razao, g.guias, meses, extrato) : null;

  /** Um ou mais PDFs do FGTS Digital: as guias se somam às que já vieram (a mesma guia não repete). */
  async function importarGuias(fs: File[]) {
    if (!fs.length) return;
    setLendo(true);
    try {
      const novas: t.GuiaDoFgts[] = [];
      for (const f of fs) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (!extrator.ehPdf(bytes)) throw new Error(f.name + ' não é PDF.');
        novas.push(...t.guiasDoFgtsDasLinhas(t.linhasDaGuiaDoFgts(await extrator.itensDoPdf(bytes))));
      }
      if (!novas.length) throw new Error('Nenhuma guia do FGTS nos arquivos (o PDF tem que ser o "Detalhe da Guia Emitida" do FGTS Digital).');
      const antes = g?.guias || [];
      const juntas = [...antes, ...novas.filter((n, i) => !antes.some(a => a.numero === n.numero) && novas.findIndex(x => x.numero === n.numero) === i)]
        .sort((a, b) => a.competencia.localeCompare(b.competencia));
      setGuias({ chave, arquivos: [...(g?.arquivos || []), ...fs.map(f => f.name)], guias: juntas });
      aviso({ tom: 'ok', titulo: 'Guias do FGTS importadas', texto: juntas.map(x => t.rotuloNumericoCompetencia(x.competencia)).join(', ') });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler as guias do FGTS', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setLendo(false);
    }
  }

  const daVez = (mes: string) => !mesAberto || mes === mesAberto;
  const todas = c?.sugestoes || [];
  const sugestoes = todas.filter(s => daVez(s.mes));
  const contraDe = (x: t.SugestaoDoFgts) => contrapartidas[t.chaveDaSugestaoDoFgts(x)] || (/^([0-9]{3,})(?![0-9])/.exec(t.contrapartidaDoFgts(x).sugerida.trim())?.[1] || '');
  const faltaContra = todas.filter(x => !contraDe(x)).length;
  // as contas para a contrapartida: as que o razão já usa primeiro e depois as do balancete
  const contas = [...new Map([
    ...(razao ? razao.lancamentos.filter(l => l.contrapartida).map(l => [l.contrapartida, { codigo: l.contrapartida, nome: l.nomeContrapartida }] as const) : []),
    ...balancete.map(x => [x.codigo, x] as const),
  ]).values()];
  const aberto = mesAberto ? c?.meses.find(m => m.mes === mesAberto) : null;

  return {
    importarGuias, lendo,
    temGuias: !!g, temRazao: !!razao, pronto: !!c,
    arquivosGuias: g?.arquivos || [],
    removerGuias: () => { setGuias(null); setMesAberto(null); },
    resumo: g ? ['Guias: ' + g.guias.map(x => t.rotuloNumericoCompetencia(x.competencia)).join(', ')] : [],
    /** a grade dos meses: provisão, guia, diferença e o pagamento */
    meses: (c?.meses || []).map(m => ({
      mes: m.mes, rotulo: t.rotuloNumericoCompetencia(m.mes), foraDoRazao: m.foraDoRazao,
      provisao: m.foraDoRazao ? '' : reais(m.provisao), guia: m.guia ? reais(m.guia.total) : '',
      diferenca: m.foraDoRazao || !m.guia ? '' : reais(m.diferenca), bate: Math.abs(m.diferenca) < 0.01,
      situacao: m.situacao,
      pagamento: m.pagamento ? dataBR(m.pagamento.data) + (m.pagamento.banco ? ' · ' + m.pagamento.banco : '') : '',
      vencimento: m.guia ? dataBR(m.guia.vencimento) : '',
      trocada: m.competenciaTrocada.length,
    })),
    mesAberto,
    abrirMes: (m: string) => setMesAberto(a => (a === m ? null : m)),
    mostrando: mesAberto ? t.rotuloCompetencia(mesAberto) : t.rotuloDoPeriodo([...meses]),
    /** o mês aberto: cada trabalhador (razão × guia) e os históricos com a competência trocada */
    trabalhadores: (aberto?.trabalhadores || []).map(x => ({ nome: x.nome, razao: reais(x.razao), guia: reais(x.guia), diferenca: reais(x.diferenca), bate: Math.abs(x.diferenca) < 0.01 })),
    competenciaTrocada: (c?.meses || []).filter(m => daVez(m.mes)).flatMap(m => m.competenciaTrocada.map(x => dataBR(x.data) + ' · ' + reais(x.valor) + ' · ' + x.historico + ' (é de ' + t.rotuloNumericoCompetencia(m.mes) + ')')),
    /** os lançamentos sugeridos (o período todo ou o mês aberto) */
    sugestoes: sugestoes.map((s, i) => {
      const k = t.chaveDaSugestaoDoFgts(s);
      const cp = t.contrapartidaDoFgts(s);
      return {
        id: i, chave: k, mes: t.rotuloNumericoCompetencia(s.mes), data: dataBR(s.data), tipo: s.tipo === 'pagamento' ? 'Pagamento' : 'Provisão',
        valor: reais(s.valor), historico: s.historico, motivo: s.motivo, lado: cp.lado, contrapartida: contraDe(s),
        nomeDaContrapartida: contas.find(x => x.codigo === contraDe(s))?.nome || cp.sugerida.replace(/^[0-9]+ */, ''),
      };
    }),
    totalSugerido: reais(sugestoes.reduce((n, s) => n + s.valor, 0)),
    contas, contaFgts, setContaFgts,
    contaTravada: !!doBalancete,
    nomeDaContaFgts: (balancete.find(x => x.codigo === contaFgts.trim()) || null)?.nome || '',
    escolherContrapartida: (k: string, codigo: string) => setContrapartidas(x => ({ ...x, [k]: codigo })),
    faltaContrapartida: faltaContra,
    podeExportar: todas.length > 0 && !faltaContra && /^[0-9]+$/.test(contaFgts.trim()),
    /** o .xls de importação do Alterdata (o padrão de 10 colunas), com todas as sugestões do período */
    baixarXls: () => {
      const linhas = t.linhasDoAlterdataDoFgts(todas, contaFgts.trim(), contrapartidas);
      const bytes = creditor.planilhaDeImportacao(linhas.map(l => ({ automatico: '', codHistorico: '', documento: '', tipo: 'principal' as const, tituloId: 0, ...l })));
      baixarBytes(bytes, 'lancamentos-fgts-' + meses[0] + (meses.length > 1 ? '-a-' + meses[meses.length - 1] : '') + '.xls', creditor.TIPO_XLS);
    },
    pagamentosSemGuia: (c?.pagamentosSemGuia || []).map(l => dataBR(l.data) + ' · ' + reais(-l.valor) + ' · ' + l.historico),
    fechamento: c ? {
      fim: dataBR(meses[meses.length - 1] + '-' + String(new Date(+meses[meses.length - 1].slice(0, 4), +meses[meses.length - 1].slice(5, 7), 0).getDate())),
      razao: t.valorComLado(c.saldoDoRazao), ajustado: t.valorComLado(c.saldoAjustado), esperado: t.valorComLado(c.saldoEsperado),
      antes: Math.abs(c.antesDoPeriodo) >= 0.01 ? reais(Math.abs(c.antesDoPeriodo)) : '',
      semGuia: (c.meses.filter(m => m.situacao === 'sem-guia' && !m.foraDoRazao).map(m => t.rotuloNumericoCompetencia(m.mes))).join(', '),
    } : null,
  };
}

export type FgtsDaEtapa = ReturnType<typeof useFgtsDaEtapa>;
