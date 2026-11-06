// ViewModel do Cartões › Cartão empresarial (Vitor, 07/10/2026): a pessoa importa a fatura do cartão em PDF (uma ou
// várias, no Em lote) e a ferramenta devolve o razão do cartão — uma linha por compra, D Cartão de Crédito / C Banco, no
// dia em que o banco pagou a fatura (o débito com o valor dela no extrato já importado no Extrator). A conta do cartão é
// perguntada uma vez (como no Creditor) e fica no Cadastro; a do banco é a conta contábil do banco no Cadastro.
// O período é o da Tarefa, à risca: fatura paga fora dele avisa e fica de fora. As faturas ficam só na tela.
import { cartoes, empresas, extrator as x, formatos, tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { repoDoCadastro } from '../../../../dados/cadastro';
import { useCadastroDaEmpresa, useEmpresa } from '../../../extrator/dados/repo';

x.definirWorkerDoPdf(workerDoPdf);

const dataBr = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
/** o mês de antes e o de depois ('aaaa-mm') */
const mesAoLado = (m: string, d: number) => { const t = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + d, 1); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0'); };
const quem = () => { try { return localStorage.getItem('nads-tarefas-operador') || ''; } catch { return ''; } };

interface FaturaLida { id: string; arquivo: string; fatura: cartoes.FaturaDoCartao }

/** O plano de contas da empresa no Cadastro (para escolher a conta do cartão). */
function usePlano(nome: string): empresas.cadastro.PlanoDeContas | null {
  const repo = repoDoCadastro();
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo.plano(nome);
}

export function useCompras(empresa: empresas.EmpresaDoEscritorio) {
  const { aviso } = useRetorno();
  const [params] = useSearchParams();
  // o período da Tarefa (os meses, ou a competência); fora da Tarefa, sem período (qualquer fatura vale)
  const daTarefa = (params.get('meses') || '').split(',').filter(m => /^\d{4}-\d{2}$/.test(m));
  const competencia = params.get('competencia') || '';
  const meses = daTarefa.length ? daTarefa : /^\d{4}-\d{2}$/.test(competencia) ? [competencia] : [];
  const naTarefa = meses.length > 0;

  const ext = useEmpresa(empresa.nome);
  const { cadastro, salvar } = useCadastroDaEmpresa(empresa.nome, empresa.codigo);
  const plano = usePlano(empresa.nome);
  const [lidas, setLidas] = useState<FaturaLida[]>([]);
  const [lendo, setLendo] = useState(false);
  // a conta do banco escolhida aqui quando o banco não tem conta contábil no Cadastro (só nesta tela)
  const [bancoEscolhido, setBancoEscolhido] = useState<Record<string, string>>({});

  async function importar(fs: File[]) {
    if (!fs.length) return;
    setLendo(true);
    const novas: FaturaLida[] = [];
    try {
      for (const f of fs) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (!x.ehPdf(bytes)) throw new Error(f.name + ' não é PDF.');
        const fatura = cartoes.lerFatura(await x.itensDoPdf(bytes));
        novas.push({ id: fatura.contaCartao + '|' + fatura.vencimento, arquivo: f.name, fatura });
      }
    } catch (e) {
      aviso({ tom: 'erro', titulo: 'Não consegui ler a fatura', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setLendo(false);
    }
    if (novas.length) setLidas(atual => [...atual.filter(a => !novas.some(n => n.id === a.id)), ...novas].sort((a, b) => a.fatura.vencimento.localeCompare(b.fatura.vencimento)));
  }

  // o extrato do banco já importado no Extrator, nos meses em volta de cada vencimento
  const extratoEm = (vencimento: string): cartoes.LinhaDoExtrato[] => {
    const mes = vencimento.slice(0, 7);
    // o débito pode cair no mês de antes ou no de depois do vencimento (fim de semana, débito antecipado)
    const vizinhos = [mesAoLado(mes, -1), mes, mesAoLado(mes, 1)];
    const linhas: cartoes.LinhaDoExtrato[] = [];
    for (const m of [...new Set(vizinhos)]) {
      const { bancos, primeiro } = x.bancosDaEmpresaNa(ext, cadastro, empresa.codigo, m);
      for (const b of bancos) {
        for (const l of x.movimentoDoExtrato(ext, b.id, primeiro, m).linhas) linhas.push({ data: l.data, valor: l.valor, historico: l.historico, banco: b.id });
      }
    }
    return linhas;
  };

  const contaCartao = cadastro?.contasPadrao?.contas.cartao || '';
  const nomeDaConta = (codigo: string) => (codigo && plano ? empresas.cadastro.contaNoPlano(plano, codigo)?.nome || '' : '');
  const contaDoBanco = (banco: string) => bancoEscolhido[banco] || cadastro?.bancos?.find(b => b.id === banco)?.contaContabil || '';
  const nomeDoBanco = (banco: string) => cadastro?.bancos?.find(b => b.id === banco)?.nome || banco;

  const faturas = lidas.map(l => {
    const c = cartoes.comprasDaFatura(l.fatura);
    const pg = cartoes.pagamentoNoExtrato(l.fatura, c.soma, extratoEm(l.fatura.vencimento));
    const dia = pg?.data || l.fatura.vencimento;
    // o período à risca: a fatura entra no mês em que foi paga
    const noPeriodo = !naTarefa || meses.includes(dia.slice(0, 7));
    const contaBanco = pg ? contaDoBanco(pg.banco) : '';
    return {
      id: l.id, arquivo: l.arquivo,
      rotulo: 'Fatura de ' + tarefas.rotuloNumericoCompetencia(l.fatura.vencimento.slice(0, 7)),
      vencimento: dataBr(l.fatura.vencimento),
      cartao: l.fatura.contaCartao,
      total: l.fatura.total != null ? formatos.brl(l.fatura.total) : '—',
      soma: formatos.brl(c.soma),
      bate: c.diferenca === 0,
      diferenca: c.diferenca != null && c.diferenca !== 0 ? formatos.brl(Math.abs(c.diferenca)) : '',
      qtd: c.compras.length,
      pagamento: pg ? { data: dataBr(pg.data), banco: pg.banco, nomeDoBanco: nomeDoBanco(pg.banco), historico: pg.historico, dias: pg.diasDoVencimento } : null,
      noPeriodo,
      mesDoPagamento: tarefas.rotuloNumericoCompetencia(dia.slice(0, 7)),
      contaBanco,
      bancoSemConta: !!pg && !contaBanco,
      linhas: cartoes.lancamentosDaFatura(c, dia, contaCartao || '?', contaBanco || '?').map((ln, i) => ({ id: i, ...ln, valor: formatos.brl(ln.valor), portador: c.compras[i]?.portador || '' })),
      deFora: c.deFora.map((d, i) => ({ id: i, data: dataBr(d.item.data), descricao: d.item.descricao, valor: formatos.brl(d.item.valor), motivo: d.motivo })),
      // para o arquivo
      bruto: { compras: c, dia, contaBanco },
    };
  });

  const validas = faturas.filter(f => f.noPeriodo);
  const faltaBanco = validas.some(f => !f.pagamento || !f.contaBanco);
  const pronto = validas.length > 0 && !!contaCartao && !faltaBanco && validas.every(f => f.bate);
  const opcoes = (plano?.contas || []).filter(c => !c.sintetica).map(c => ({ codigo: c.codigo, nome: c.nome }));

  return {
    naTarefa,
    periodo: meses.length ? tarefas.rotuloDoPeriodo(meses) : '',
    lendo, importar: (fs: File[]) => { void importar(fs); },
    remover: (id: string) => setLidas(l => l.filter(f => f.id !== id)),
    faturas,
    /** as faturas pagas fora do período da Tarefa (ficam de fora do arquivo) */
    foraDoPeriodo: faturas.filter(f => !f.noPeriodo).map(f => f.rotulo + ' (paga em ' + f.mesDoPagamento + ')'),
    /** a conta do cartão: a do Cadastro; sem ela, a pessoa escolhe (e fica no Cadastro) */
    contaCartao, nomeContaCartao: nomeDaConta(contaCartao), opcoes,
    cadastroCarregado: !!cadastro,
    escolherContaCartao(codigo: string) {
      if (!cadastro) return;
      const novo = empresas.cadastro.definirContaPadrao(cadastro, 'cartao', codigo, plano, quem() || 'Cartões', new Date());
      if (novo !== cadastro) salvar(novo);
    },
    escolherContaBanco: (banco: string, codigo: string) => setBancoEscolhido(b => ({ ...b, [banco]: codigo })),
    pronto,
    /** o que falta para baixar */
    falta: [
      !validas.length ? 'Importe a fatura do cartão (PDF)' : '',
      validas.length && !contaCartao ? 'Escolha a conta do cartão de crédito' : '',
      validas.some(f => !f.pagamento) ? 'O pagamento de alguma fatura não está no extrato importado' : '',
      validas.some(f => f.pagamento && !f.contaBanco) ? 'Escolha a conta do banco que pagou a fatura' : '',
      validas.some(f => !f.bate) ? 'A soma das compras não bate com o total de alguma fatura' : '',
    ].filter(Boolean),
    qtdLancamentos: validas.reduce((n, f) => n + f.qtd, 0),
    arquivo: () => ({
      bytes: cartoes.planilhaDeImportacao(validas.flatMap(f => cartoes.lancamentosDaFatura(f.bruto.compras, f.bruto.dia, contaCartao, f.bruto.contaBanco))),
      nome: cartoes.nomeDoArquivoDoCartao(empresa.codigo != null ? String(empresa.codigo) : null, validas[0]?.bruto.dia || ''),
      tipo: cartoes.TIPO_XLS,
    }),
  };
}

export type VmCompras = ReturnType<typeof useCompras>;
