// ViewModel do pagamento do Simples pelo banco (Vitor, 16/10/2026: "no Simples Nacional, coloque e indique o pagamento do
// imposto se tiver no banco"): cada DAS (o saldo anterior e a provisão de cada mês) × o pagamento — no razão do Simples, ou
// no extrato dos bancos (Extrator) —, a baixa sugerida do que o banco pagou (contra o Caixa Geral, quando o pagamento passou
// por ele no razão do Caixa da Importação; senão, contra o banco), os juros do atraso e o .xls do Alterdata.
import { creditor, extrator, formatos, tarefas as t } from '@nads/core';
import { baixarBytes } from '@nads/ui';
import { useMemo } from 'react';
import { useContasDoBalancete } from '../../../../../concilia-ai/importadosNaEtapa';
import { useCadastro } from '../../../../dados/repo';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';
import { useGuardado } from '../../../../../../comum/guardado';
import type { EtapaAberta } from '../contexto';

const dataBR = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const reais = formatos.reais;
const chaveDe = (x: t.SugestaoDoSimples) => x.competencia + '|' + x.tipo + '|' + x.valor;

export function usePagamentosDoSimples(s: EtapaAberta, razao: t.RazaoDaConta | null) {
  const chave = 'simples-pagamentos|' + (s.codigo ?? s.nome) + '|' + s.meses.join(',');
  const [escolhidas, setEscolhidas] = useGuardado<Record<string, string>>(chave + '|contas', {});
  const [contaJurosEscolhida, setContaJuros] = useGuardado(chave + '|juros', '');
  const [baixado, setBaixado] = useGuardado(chave + '|baixado', false);
  // o razão do Caixa (o da Importação), os extratos dos bancos e o balancete (as contas, com o nome)
  const contabil = useContabilDaEmpresa(s.nome, s.codigo);
  const caixa = contabil.razaoDoTipo('caixa');
  const ext = useExtratorDaEmpresa(s.nome);
  const vivo = useCadastro(s.nome, s.codigo);
  const cadastro = vivo.carregada ? vivo.cadastro : null;
  const balancete = useContasDoBalancete(s.nome);
  const plano = useMemo(() => (balancete || []).filter(x => !x.sintetica).map(x => ({ codigo: x.codigo, nome: x.nome })), [balancete]);
  const doBanco = useMemo(() => {
    const { bancos, primeiro } = extrator.bancosDaEmpresaNa(ext, cadastro, s.codigo, s.meses[s.meses.length - 1] || s.competencia);
    return {
      bancos,
      lancamentos: ext.arquivos.filter(a => a.lado === 'banco').flatMap(a => {
        const b = extrator.bancoDoArquivo(a, primeiro);
        return a.lancamentos.map(l => ({ data: l.data, valor: l.valor, historico: l.historico, banco: b }));
      }),
    };
  }, [ext, cadastro, s.codigo, s.meses, s.competencia]);
  const c = razao && s.meses.length ? t.conferirSimples(razao, s.meses, doBanco.lancamentos, caixa?.razao ?? null) : null;

  // as contas: o Simples a recolher (a do razão ou a do balancete); a contrapartida de cada baixa (o caixa da Importação ou a
  // conta contábil do banco no Cadastro); os juros (a pessoa escolhe; sugere a de juros do balancete)
  const peloNome = (re: RegExp) => plano.find(x => re.test(formatos.normalizarTexto(x.nome)))?.codigo || '';
  const contaSimples = razao?.conta || peloNome(/simples nacional a recolher/);
  const contaCaixa = caixa?.conta || peloNome(/^caixa geral/);
  const contaDoBanco = (banco?: string) => (cadastro?.bancos || []).find(b => b.id === banco)?.contaContabil || '';
  const contaJuros = contaJurosEscolhida || peloNome(/juros.*(pass|pag|mora|multa)|multa.*(fisc|trib)/);
  const sugerida = (x: t.SugestaoDoSimples) => (x.contra === 'caixa' ? contaCaixa : contaDoBanco(x.banco));
  const contraDe = (x: t.SugestaoDoSimples) => escolhidas[chaveDe(x)] ?? sugerida(x);
  const todas = c?.sugestoes || [];
  const faltaConta = todas.filter(x => !/^\d+$/.test(contraDe(x).trim())).length;
  const temJuros = todas.some(x => x.tipo === 'juros');
  const nomeDe = (codigo: string) => plano.find(x => x.codigo === codigo)?.nome || '';
  const nomeDoBanco = (id?: string) => doBanco.bancos.find(b => b.id === id)?.nome || id || '';

  return {
    pronto: !!c,
    temExtrato: doBanco.lancamentos.length > 0,
    temCaixa: !!caixa,
    /** cada DAS: a competência, o valor e o pagamento (no razão, no banco, em aberto ou depois do período) */
    obrigacoes: (c?.obrigacoes || []).map(o => ({
      chave: o.competencia + (o.anterior ? '|a' : ''),
      rotulo: (o.anterior ? 'Saldo anterior · ' : '') + t.rotuloNumericoCompetencia(o.competencia),
      valor: reais(o.valor), vencimento: dataBR(o.vencimento), situacao: o.situacao,
      pagamento: o.pagamento ? dataBR(o.pagamento.data) + ' · ' + reais(o.pagamento.valor) : '',
      onde: o.pagamento?.onde === 'extrato' ? (o.pagamento.noCaixa ? 'No Caixa Geral (pago pelo ' + nomeDoBanco(o.pagamento.banco) + ')' : 'No extrato do ' + nomeDoBanco(o.pagamento.banco)) : o.pagamento ? 'No razão' : '',
      juros: o.juros > 0 ? reais(o.juros) : '',
    })),
    /** as baixas sugeridas: o pagamento (D Simples a recolher) e os juros (D a conta de juros), contra o caixa ou o banco */
    sugestoes: todas.map((x, i) => ({
      id: i, chave: chaveDe(x), data: dataBR(x.data), tipo: x.tipo, valor: reais(x.valor), historico: x.historico, motivo: x.motivo,
      debito: x.tipo === 'juros' ? contaJuros : contaSimples, contra: contraDe(x), nomeDaContra: nomeDe(contraDe(x).trim()),
      contraSugerida: x.contra === 'caixa' ? 'o Caixa Geral' : 'o banco',
    })),
    total: reais(todas.reduce((n, x) => n + x.valor, 0)),
    contas: plano, contaSimples, nomeDaContaSimples: nomeDe(contaSimples),
    temJuros, contaJuros, setContaJuros, nomeDaContaJuros: nomeDe(contaJuros),
    escolherContra: (k: string, codigo: string) => setEscolhidas(x => ({ ...x, [k]: codigo })),
    faltaConta,
    podeBaixar: todas.length > 0 && !faltaConta && /^\d+$/.test(contaSimples) && (!temJuros || /^\d+$/.test(contaJuros)),
    baixado,
    baixar: () => {
      const linhas = todas.map(x => ({
        data: dataBR(x.data), debito: x.tipo === 'juros' ? contaJuros : contaSimples, credito: contraDe(x).trim(), historico: x.historico, valor: x.valor,
        automatico: '', codHistorico: '', documento: '', tipo: 'principal' as const, tituloId: 0,
      }));
      baixarBytes(creditor.planilhaDeImportacao(linhas), 'simples-pagamentos' + (s.codigo != null ? '_' + s.codigo : '') + '_' + s.meses[0] + (s.meses.length > 1 ? '-a-' + s.meses[s.meses.length - 1] : '') + '.xls', creditor.TIPO_XLS);
      setBaixado(true);
    },
    fechamento: c ? {
      razao: t.valorComLado(c.saldoDoRazao), ajustado: t.valorComLado(c.saldoAjustado), esperado: t.valorComLado(c.saldoEsperado),
      diferenca: Math.abs(c.diferenca) >= 0.01 ? reais(Math.abs(c.diferenca)) : '',
    } : null,
    dasSemObrigacao: (c?.dasSemObrigacao || []).map(d => dataBR(d.data) + ' · ' + reais(d.valor) + ' · ' + d.historico),
  };
}

export type PagamentosDoSimples = ReturnType<typeof usePagamentosDoSimples>;
