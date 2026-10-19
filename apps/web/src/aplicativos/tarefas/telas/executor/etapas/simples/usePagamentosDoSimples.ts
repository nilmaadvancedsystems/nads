// ViewModel do pagamento do Simples pelo banco (Vitor, 16/10/2026: "no Simples Nacional, coloque e indique o pagamento do
// imposto se tiver no banco"): cada DAS (o saldo anterior e a provisão de cada mês) × o pagamento — no razão do Simples, ou
// no extrato dos bancos (Extrator), com o nome do banco — e a diferença do que foi pago a mais. As pendências (pago no banco
// sem a baixa, vencido sem pagamento) a pessoa responde com "Não foi pago" ou "Ok" para seguir (19/10/2026); sem o .xls.
import { extrator, formatos, tarefas as t } from '@nads/core';
import { useMemo } from 'react';
import { useCadastro } from '../../../../dados/repo';
import { useExtratorDaEmpresa } from '../../../../dados/extrator';
import { useContabilDaEmpresa } from '../../../../../../comum/contabilDaEmpresa';
import { useGuardado } from '../../../../../../comum/guardado';
import type { EtapaAberta } from '../contexto';

const dataBR = (d: string) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const reais = formatos.reais;

/** A resposta da pessoa a uma pendência: ok (está certo / vai baixar) ou não foi pago. */
export type RespostaDoDas = 'ok' | 'nao-pago';

export function usePagamentosDoSimples(s: EtapaAberta, razao: t.RazaoDaConta | null) {
  const chave = 'simples-pagamentos|' + (s.codigo ?? s.nome) + '|' + s.meses.join(',');
  // as respostas às pendências (pela competência), guardadas: voltou, está onde parou
  const [respostas, setRespostas] = useGuardado<Record<string, RespostaDoDas>>(chave + '|respostas', {});
  // o razão do Caixa (o da Importação), os extratos dos bancos e o nome de cada banco
  const contabil = useContabilDaEmpresa(s.nome, s.codigo);
  const caixa = contabil.razaoDoTipo('caixa');
  const ext = useExtratorDaEmpresa(s.nome);
  const vivo = useCadastro(s.nome, s.codigo);
  const cadastro = vivo.carregada ? vivo.cadastro : null;
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
  const nomeDoBanco = (id?: string) => doBanco.bancos.find(b => b.id === id)?.nome || id || 'banco';
  const chaveDe = (o: t.ObrigacaoDoSimples) => o.competencia + (o.anterior ? '|anterior' : '');
  // as pendências: o pago no banco sem a baixa e o vencido sem pagamento (o que vence depois do período não é pendência)
  const ehPendencia = (o: t.ObrigacaoDoSimples) => o.situacao === 'banco' || o.situacao === 'aberto';
  const pendentes = (c?.obrigacoes || []).filter(o => ehPendencia(o) && !respostas[chaveDe(o)]);

  return {
    pronto: !!c,
    temExtrato: doBanco.lancamentos.length > 0,
    /** cada DAS: a competência, o valor, o pagamento, a diferença e a situação (com o nome do banco quando pago por ele) */
    obrigacoes: (c?.obrigacoes || []).map(o => ({
      chave: chaveDe(o),
      rotulo: (o.anterior ? 'Saldo anterior · ' : '') + t.rotuloNumericoCompetencia(o.competencia),
      valor: reais(o.valor), vencimento: dataBR(o.vencimento), situacao: o.situacao,
      pagamento: o.pagamento ? dataBR(o.pagamento.data) + ' · ' + reais(o.pagamento.valor) : '',
      diferenca: o.juros > 0 ? reais(o.juros) : '',
      /** o texto da situação: "Pago no Sicoob · falta baixar" (o nome do banco do extrato) */
      textoDaSituacao: o.situacao === 'ok' ? 'Pago' : o.situacao === 'banco' ? 'Pago no ' + nomeDoBanco(o.pagamento?.banco) + ' · falta baixar'
        : o.situacao === 'aberto' ? 'Vencido sem pagamento' : 'Vence depois do período',
      pendencia: ehPendencia(o),
      resposta: respostas[chaveDe(o)] || null,
    })),
    responder: (k: string, r: RespostaDoDas) => setRespostas(x => ({ ...x, [k]: r })),
    desfazer: (k: string) => setRespostas(x => { const n = { ...x }; delete n[k]; return n; }),
    /** as pendências ainda sem resposta (travam o Próximo) */
    pendentes: pendentes.map(o => (o.anterior ? 'saldo anterior ' : '') + t.rotuloNumericoCompetencia(o.competencia)),
  };
}

export type PagamentosDoSimples = ReturnType<typeof usePagamentosDoSimples>;
