// ViewModel da conferência do INSS na etapa da folha (Vitor, 05/10/2026): a pessoa importa o razão do INSS a recolher
// (XLS da conciliação do Alterdata) e o PDF dos comprovantes de arrecadação; a tela mostra, mês a mês, provisão × guia,
// as verbas que o sistema não provisionou, as guias pagas sem baixa e o lançamento sugerido de cada diferença.
// Fica só na tela (em memória): trocou de etapa, empresa ou período, some.
import { extrator, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useState } from 'react';

extrator.definirWorkerDoPdf(workerDoPdf);

const dataBR = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const brl = formatos.brl;

export function useInssDaEtapa(chave: string, meses: readonly string[]) {
  const { aviso } = useRetorno();
  const [razao, setRazao] = useState<{ chave: string; arquivo: string; razao: t.RazaoDaConta } | null>(null);
  const [guias, setGuias] = useState<{ chave: string; arquivos: string[]; guias: t.GuiaDoInss[] } | null>(null);
  const [lendo, setLendo] = useState(false);
  // o mês aberto (null = o período todo)
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  const r = razao && razao.chave === chave ? razao : null;
  const g = guias && guias.chave === chave ? guias : null;
  const c = r && g ? t.conferirInss(r.razao, g.guias, meses) : null;

  async function importarRazao(f: File | null) {
    if (!f) return;
    try {
      setRazao({ chave, arquivo: f.name, razao: t.lerRazaoDoArquivo(await f.arrayBuffer()) });
      setMesAberto(null);
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler o razão', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Um ou mais PDFs de comprovantes: as guias se somam às que já vieram (a mesma guia não repete). */
  async function importarGuias(fs: File[]) {
    if (!fs.length) return;
    setLendo(true);
    try {
      const novas: t.GuiaDoInss[] = [];
      for (const f of fs) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (!extrator.ehPdf(bytes)) throw new Error(f.name + ' não é PDF.');
        novas.push(...t.guiasDasLinhas(t.linhasDasPaginas(await extrator.itensDoPdf(bytes))));
      }
      if (!novas.length) throw new Error('Nenhuma guia do INSS nos arquivos (o PDF tem que ser o comprovante de arrecadação da Receita).');
      const antes = g?.guias || [];
      const juntas = [...antes, ...novas.filter(n => !antes.some(a => a.numero === n.numero))]
        .sort((a, b) => a.competencia.localeCompare(b.competencia) || a.vencimento.localeCompare(b.vencimento));
      setGuias({ chave, arquivos: [...(g?.arquivos || []), ...fs.map(f => f.name)], guias: juntas });
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler as guias', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setLendo(false);
    }
  }

  const ultimoDia = meses.length ? meses[meses.length - 1] + '-31' : '';
  const daVez = (mes: string) => !mesAberto || mes === mesAberto;
  const sugestoes = (c?.sugestoes || []).filter(s => daVez(s.mes));

  return {
    importarRazao, importarGuias, lendo,
    temRazao: !!r, temGuias: !!g, pronto: !!c,
    arquivoRazao: r?.arquivo || '',
    removerRazao: () => setRazao(null), removerGuias: () => setGuias(null),
    resumo: [r ? 'Razão: ' + r.razao.lancamentos.length.toLocaleString('pt-BR') + ' lançamentos' : '', g ? 'Guias: ' + g.guias.length : ''].filter(Boolean),
    /** a grade dos meses: provisão, guia, diferença e a baixa da guia do mês */
    meses: (c?.meses || []).map(m => {
      const baixa = m.guia ? c!.baixas.find(b => b.guia === m.guia) : undefined;
      return {
        mes: m.mes, rotulo: t.rotuloNumericoCompetencia(m.mes), foraDoRazao: m.foraDoRazao,
        provisao: m.foraDoRazao ? '' : brl(m.provisao), guia: m.guia ? brl(m.guia.principal) : '',
        diferenca: m.foraDoRazao || !m.guia ? '' : brl(m.diferenca), bate: Math.abs(m.diferenca) < 0.01,
        // a guia do mês: baixada, sem a baixa, paga depois do período, ou o PDF não trouxe
        baixa: !m.guia ? 'sem-guia' as const : baixa ? (baixa.lancamento ? 'ok' as const : 'falta' as const) : m.guia.pagaEm > ultimoDia || !m.guia.pagaEm ? 'depois' as const : 'fora' as const,
        pagaEm: m.guia ? dataBR(m.guia.pagaEm) : '',
      };
    }),
    mesAberto,
    abrirMes: (m: string) => setMesAberto(a => (a === m ? null : m)),
    mostrando: mesAberto ? t.rotuloCompetencia(mesAberto) : t.rotuloDoPeriodo([...meses]),
    /** os lançamentos sugeridos (o período todo ou o mês aberto) */
    sugestoes: sugestoes.map((s, i) => ({
      id: i, mes: t.rotuloNumericoCompetencia(s.mes), tipo: s.tipo === 'baixa' ? 'Baixa' : 'Provisão',
      debito: s.debito, credito: s.credito, valor: brl(s.valor), historico: s.historico, motivo: s.motivo,
    })),
    totalSugerido: brl(sugestoes.reduce((n, s) => n + s.valor, 0)),
    /** grupo a grupo, nos meses à vista (o que o sistema provisiona e o que não) */
    grupos: (c?.meses || []).filter(m => daVez(m.mes) && m.guia && !m.foraDoRazao).flatMap(m => [
      ...m.grupos.map(x => ({ id: m.mes + x.grupo, mes: t.rotuloNumericoCompetencia(m.mes), nome: x.nome, razao: brl(x.razao), guia: brl(x.guia), diferenca: brl(x.diferenca), bate: Math.abs(x.diferenca) < 0.01, codigos: '' })),
      ...m.naoProvisionadas.map(v => ({
        id: m.mes + v.grupo, mes: t.rotuloNumericoCompetencia(m.mes), nome: v.nome, razao: brl(0), guia: brl(v.valor), diferenca: brl(v.valor), bate: false,
        codigos: v.itens.map(i => i.codigo + (i.variacao ? '-' + i.variacao : '')).join(', '),
      })),
    ]),
    /** pagamentos do razão sem guia com o mesmo valor */
    pagamentosSemGuia: (c?.pagamentosSemGuia || []).map(l => dataBR(l.data) + ' · ' + brl(-l.valor) + ' · ' + l.historico),
    fechamento: c ? {
      fim: dataBR(meses[meses.length - 1] + '-' + String(new Date(+meses[meses.length - 1].slice(0, 4), +meses[meses.length - 1].slice(5, 7), 0).getDate())),
      razao: t.valorComLado(c.saldoDoRazao), ajustado: t.valorComLado(c.saldoAjustado), esperado: t.valorComLado(c.saldoEsperado),
      antes: Math.abs(c.antesDoPeriodo) >= 0.01 ? brl(Math.abs(c.antesDoPeriodo)) : '',
      inicio: t.rotuloNumericoCompetencia(meses.find(m => !c.meses.find(x => x.mes === m)?.foraDoRazao) || meses[0]),
    } : null,
  };
}

export type InssDaEtapa = ReturnType<typeof useInssDaEtapa>;
