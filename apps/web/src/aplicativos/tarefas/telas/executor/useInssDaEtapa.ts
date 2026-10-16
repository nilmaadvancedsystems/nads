// ViewModel da conferência do INSS na etapa da folha (Vitor, 05/10/2026): a pessoa importa o razão do INSS a recolher
// (XLS da conciliação do Alterdata) e o PDF dos comprovantes de arrecadação; a tela mostra, mês a mês, provisão × guia,
// as verbas que o sistema não provisionou, as guias pagas sem baixa e o lançamento sugerido de cada diferença.
// Fica só na tela (em memória): trocou de etapa, empresa ou período, some.
import { conversor, creditor, extrator, formatos, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useState } from 'react';
import { useGuardado } from '../../../../comum/guardado';
import { useContabilDaEmpresa } from '../../../../comum/contabilDaEmpresa';

extrator.definirWorkerDoPdf(workerDoPdf);

const dataBR = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const reais = formatos.reais;

/** Uma conta do balancete da empresa (o código e o nome). */
export interface ContaDoPlano { codigo: string; nome: string }

/**
 * balancete: as contas analíticas do balancete importado na Conferência (Vitor, 07/10/2026: "essa conta do INSS a recolher,
 * você puxa diretamente do balancete, tem o nome certinho lá"); sem ele, a pessoa digita.
 */
/** O banco do comprovante ("756 - BANCO COOPERATIVO SICOOB S/A") → o nome curto (Sicoob) e a marca do logo. */
function bancoDaGuia(texto: string): { nome: string; curto: string; marca: string } {
  const curto = conversor.bancoDoTexto(texto);
  return { nome: texto, curto: curto || texto.replace(/^\d+\s*-\s*/, ''), marca: curto ? conversor.marcaDoBanco(curto) : '' };
}

/** empresa: o nome (o razão do INSS importado na Importação, quando a etapa não tem o próprio; 16/10/2026) */
export function useInssDaEtapa(chave: string, meses: readonly string[], balancete: readonly ContaDoPlano[] = [], empresa = '') {
  const { aviso } = useRetorno();
  // o razão, as guias e as contrapartidas ficam guardados (Vitor, 15/10/2026: voltou, está onde parou)
  const [razao, setRazao] = useGuardado<{ chave: string; arquivo: string; razao: t.RazaoDaConta } | null>('inss-razao|' + chave, null);
  const [guias, setGuias] = useGuardado<{ chave: string; arquivos: string[]; guias: t.GuiaDoInss[] } | null>('inss-guias|' + chave, null);
  const [lendo, setLendo] = useState(false);
  // o mês aberto (null = o período todo)
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  // a exportação para o Alterdata (Vitor, 07/10/2026): o código da conta do INSS a recolher e a contrapartida de cada sugestão
  const [contaDigitada, setContaInss] = useState('');
  // a conta do INSS a recolher no balancete, pelo nome
  const doBalancete = balancete.find(x => /inss\s+a\s+recolher/i.test(x.nome)) || null;
  // a do balancete manda (travada); sem ela no balancete, a digitada
  const contaInss = doBalancete?.codigo || contaDigitada;
  const [contrapartidas, setContrapartidas] = useGuardado<Record<string, string>>('inss-contrapartidas|' + chave, {});
  const contabil = useContabilDaEmpresa(empresa);
  const daImportacao = empresa ? contabil.razaoDoTipo('inss') : null;
  const proprio = razao && razao.chave === chave ? razao : null;
  const r = proprio || (daImportacao ? { chave, arquivo: daImportacao.arquivo + ' (da Importação)', razao: daImportacao.razao } : null);
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
  const todas = c?.sugestoes || [];
  const contraDe = (x: t.SugestaoDoInss) => contrapartidas[t.chaveDaSugestao(x)] || t.codigoDaConta(t.contrapartidaDaSugestao(x).sugerida);
  const faltaContra = todas.filter(x => !contraDe(x)).length;
  // as contas que o razão já usa, para escolher a contrapartida (o código e o nome)
  // as contas para a contrapartida: as que o razão já usa primeiro e depois as do balancete
  const contas = [...new Map([
    ...(r ? r.razao.lancamentos.filter(l => l.contrapartida).map(l => [l.contrapartida, { codigo: l.contrapartida, nome: l.nomeContrapartida }] as const) : []),
    ...balancete.map(x => [x.codigo, x] as const),
  ]).values()];

  return {
    importarRazao, importarGuias, lendo,
    temRazao: !!r, temGuias: !!g, pronto: !!c,
    arquivoRazao: r?.arquivo || '',
    removerRazao: () => { setRazao(null); if (!proprio && daImportacao) contabil.tirarRazao(daImportacao.conta); }, removerGuias: () => setGuias(null),
    /** o ⚡ do modo desenvolvedor: o razão e as guias de teste do período */
    implantarTeste: () => {
      const d = t.inssDeTeste(meses);
      setRazao({ chave, arquivo: 'TESTE razão do INSS.xls', razao: d.razao });
      setGuias({ chave, arquivos: ['TESTE guias do INSS.pdf'], guias: d.guias });
      setMesAberto(null);
    },
    /** o ⚡ de cada linha (Vitor, 07/10/2026: "quero testar as guias também"): só o razão, ou só as guias */
    implantarRazaoDeTeste: () => { setRazao({ chave, arquivo: 'TESTE razão do INSS.xls', razao: t.inssDeTeste(meses).razao }); setMesAberto(null); },
    implantarGuiasDeTeste: () => { setGuias({ chave, arquivos: ['TESTE guias do INSS.pdf'], guias: t.inssDeTeste(meses).guias }); setMesAberto(null); },
    /** os meses da etapa (o período), para as linhas de Salários e FGTS */
    periodo: meses,
    chave,
    resumo: [r ? 'Razão: ' + r.razao.lancamentos.length.toLocaleString('pt-BR') + ' lançamentos' : '', g ? 'Guias: ' + g.guias.length : ''].filter(Boolean),
    /** a grade dos meses: provisão, guia, diferença e a baixa da guia do mês */
    meses: (c?.meses || []).map(m => {
      const baixa = m.guia ? c!.baixas.find(b => b.guia === m.guia) : undefined;
      return {
        mes: m.mes, rotulo: t.rotuloNumericoCompetencia(m.mes), foraDoRazao: m.foraDoRazao,
        provisao: m.foraDoRazao ? '' : reais(m.provisao), guia: m.guia ? reais(m.guia.principal) : '',
        // o total do DARF inteiro (com o IRRF e a retenção que vêm junto, e a multa e os juros); a guia lida antes de 15/10/2026
        // não tem: fica vazio (importar o PDF de novo), para não mostrar só o INSS como se fosse o total
        totalDaGuia: m.guia?.documento != null ? reais(m.guia.documento) : '',
        diferenca: m.foraDoRazao || !m.guia ? '' : reais(m.diferenca), bate: Math.abs(m.diferenca) < 0.01,
        // a guia do mês: baixada, sem a baixa, paga depois do período, ou o PDF não trouxe
        baixa: !m.guia ? 'sem-guia' as const : baixa ? (baixa.lancamento ? 'ok' as const : 'falta' as const) : m.guia.pagaEm > ultimoDia || !m.guia.pagaEm ? 'depois' as const : 'fora' as const,
        pagaEm: m.guia ? dataBR(m.guia.pagaEm) : '',
        // o banco em que a guia foi paga, pelo comprovante (Vitor, 15/10/2026): o nome curto e o logo
        banco: m.guia?.banco ? bancoDaGuia(m.guia.banco) : null,
      };
    }),
    mesAberto,
    abrirMes: (m: string) => setMesAberto(a => (a === m ? null : m)),
    mostrando: mesAberto ? t.rotuloCompetencia(mesAberto) : t.rotuloDoPeriodo([...meses]),
    /** os lançamentos sugeridos (o período todo ou o mês aberto) */
    sugestoes: sugestoes.map((s, i) => {
      const k = t.chaveDaSugestao(s);
      const cp = t.contrapartidaDaSugestao(s);
      return {
        id: i, chave: k, mes: t.rotuloNumericoCompetencia(s.mes), tipo: s.tipo === 'baixa' ? 'Baixa' : 'Provisão',
        debito: s.debito, credito: s.credito, valor: reais(s.valor), historico: s.historico, motivo: s.motivo,
        /** de que lado fica a contrapartida, o que a conferência sugeriu e o código escolhido ('' = falta escolher) */
        lado: cp.lado, sugerida: cp.sugerida, contrapartida: contraDe(s),
        /** o nome da conta escolhida (do balancete ou do razão); sem ela na lista, o texto sugerido sem o código */
        nomeDaContrapartida: contas.find(x => x.codigo === contraDe(s))?.nome || cp.sugerida.replace(/^[0-9]+ */, ''),
      };
    }),
    contas, contaInss, setContaInss,
    /** o nome da conta do INSS a recolher (do balancete), para mostrar ao lado do código */
    /** a conta veio do balancete: fica travada (Vitor, 08/10/2026: "deixe a conta bloqueada") */
    contaTravada: !!doBalancete,
    nomeDaContaInss: (balancete.find(x => x.codigo === contaInss.trim()) || null)?.nome || '',
    escolherContrapartida: (chave: string, codigo: string) => setContrapartidas(x => ({ ...x, [chave]: codigo })),
    /** quantas sugestões (do período todo) ainda sem a contrapartida */
    faltaContrapartida: faltaContra,
    podeExportar: todas.length > 0 && !faltaContra && /^[0-9]+$/.test(contaInss.trim()),
    /** o .xls de importação do Alterdata (o padrão de 10 colunas do Alterdata), com todas as sugestões do período */
    baixarXls: () => {
      const linhas = t.linhasDoAlterdata(todas, contaInss.trim(), contrapartidas);
      const bytes = creditor.planilhaDeImportacao(linhas.map(l => ({ automatico: '', codHistorico: '', documento: '', tipo: 'principal' as const, tituloId: 0, ...l })));
      baixarBytes(bytes, 'lancamentos-inss-' + meses[0] + (meses.length > 1 ? '-a-' + meses[meses.length - 1] : '') + '.xls', creditor.TIPO_XLS);
    },
    totalSugerido: reais(sugestoes.reduce((n, s) => n + s.valor, 0)),
    /** grupo a grupo, nos meses à vista (o que o sistema provisiona e o que não) */
    grupos: (c?.meses || []).filter(m => daVez(m.mes) && m.guia && !m.foraDoRazao).flatMap(m => [
      ...m.grupos.map(x => ({ id: m.mes + x.grupo, mes: t.rotuloNumericoCompetencia(m.mes), nome: x.nome, razao: reais(x.razao), guia: reais(x.guia), diferenca: reais(x.diferenca), bate: Math.abs(x.diferenca) < 0.01, codigos: '' })),
      ...m.naoProvisionadas.map(v => ({
        id: m.mes + v.grupo, mes: t.rotuloNumericoCompetencia(m.mes), nome: v.nome, razao: reais(0), guia: reais(v.valor), diferenca: reais(v.valor), bate: false,
        codigos: v.itens.map(i => i.codigo + (i.variacao ? '-' + i.variacao : '')).join(', '),
      })),
    ]),
    /** pagamentos do razão sem guia com o mesmo valor */
    pagamentosSemGuia: (c?.pagamentosSemGuia || []).map(l => dataBR(l.data) + ' · ' + reais(-l.valor) + ' · ' + l.historico),
    fechamento: c ? {
      fim: dataBR(meses[meses.length - 1] + '-' + String(new Date(+meses[meses.length - 1].slice(0, 4), +meses[meses.length - 1].slice(5, 7), 0).getDate())),
      razao: t.valorComLado(c.saldoDoRazao), ajustado: t.valorComLado(c.saldoAjustado), esperado: t.valorComLado(c.saldoEsperado),
      antes: Math.abs(c.antesDoPeriodo) >= 0.01 ? reais(Math.abs(c.antesDoPeriodo)) : '',
      inicio: t.rotuloNumericoCompetencia(meses.find(m => !c.meses.find(x => x.mes === m)?.foraDoRazao) || meses[0]),
    } : null,
  };
}

export type InssDaEtapa = ReturnType<typeof useInssDaEtapa>;
