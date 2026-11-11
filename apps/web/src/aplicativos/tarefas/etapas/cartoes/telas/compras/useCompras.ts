// ViewModel do Cartões › Cartão empresarial (Vitor, 07/10/2026): a pessoa importa a fatura do cartão em PDF (uma ou
// várias, no Em lote) e a ferramenta devolve o razão do cartão — uma linha por compra, D Cartão de Crédito / C Banco, no
// dia em que o banco pagou a fatura (o débito com o valor dela no extrato já importado no Extrator). A conta do cartão é
// perguntada uma vez (como no Creditor) e fica no Cadastro; a do banco é a conta contábil do banco no Cadastro.
// O período é o da Tarefa, à risca: fatura paga fora dele avisa e fica de fora. As faturas ficam só na tela.
// O razão do cartão inteiro sai daqui (Vitor, 11/11/2026: "o cartão está em PDF, o razão do cartão é o que eu vou gerar"):
// cada compra procura a nota de entrada da Conferência fiscal; com nota, D Fornecedor / C Cartão e o pagamento com o texto
// do título; sem nota, D Caixa / C Cartão; e toda compra D Cartão / C Banco no dia em que o banco pagou.
import { cartoes, empresas, extrator as x, formatos, tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { useGuardado } from '../../../../../../comum/guardado';
import { useNotasDaConferencia } from '../../../conferencia/importadosNaEtapa';
import { useParametrosDaEtapa } from '../../../../telas/executor/etapas/ponte';
import { nomeDoLote } from '../../../../../../comum/importarNoAlterdata';
import { repoDoCadastro } from '../../../dados/cadastro';
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
  const params = useParametrosDaEtapa();
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
  // as notas de entrada da Conferência fiscal (a mesma nota em várias linhas de CFOP: somadas)
  const fonte = useNotasDaConferencia(empresa.nome);
  const entradas = fonte?.entradas;
  const notas = useMemo(() => {
    const m = new Map<string, cartoes.NotaDeEntrada>();
    for (const n of entradas || []) {
      const doc = (n.doc || '').replace(/\D/g, '');
      const k = n.numero + '|' + doc;
      const iso = n.data.slice(6, 10) + '-' + n.data.slice(3, 5) + '-' + n.data.slice(0, 2);
      const a = m.get(k);
      if (a) m.set(k, { ...a, valor: Math.round((a.valor + n.valor) * 100) / 100, conta: a.conta || n.conta || '' });
      else m.set(k, { numero: n.numero, doc, nome: n.nome, data: iso, valor: n.valor, conta: n.conta || '' });
    }
    return [...m.values()];
  }, [entradas]);
  // a conta do caixa (a compra sem nota) e a do fornecedor cuja nota não trouxe a conta: as escolhidas aqui; sem, as do plano
  const [caixaEscolhido, setCaixa] = useGuardado<string>('cartoes-caixa|' + empresa.nome, '');
  const [fornecedorEscolhido, setFornecedor] = useGuardado<string>('cartoes-fornecedor|' + empresa.nome, '');
  // a conta do banco escolhida aqui quando o banco não tem conta contábil no Cadastro (só nesta tela)
  // (guardada por empresa: Vitor, 11/11/2026, "queria exportar em forma de lançamento contábil" — o arquivo travava aqui)
  const [bancoEscolhido, setBancoEscolhido] = useGuardado<Record<string, string>>('cartoes-banco|' + empresa.nome, {});

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
  const nomeDoBanco = (banco: string) => cadastro?.bancos?.find(b => b.id === banco)?.nome || banco;
  const sem = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  /** a conta do banco no plano pelo nome dele ("Sicoob" → "Banco Sicoob Credinor"), quando o Cadastro não tem */
  const doPlanoPeloNome = (banco: string) => {
    const palavras = sem(nomeDoBanco(banco) + ' ' + banco).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !['banco', 'bco', 'conta', 'corrente', 'ltda'].includes(w));
    const achadas = (plano?.contas || []).filter(c => !c.sintetica && palavras.some(w => sem(c.nome).split(/[^a-z0-9]+/).includes(w)));
    return achadas.length === 1 ? achadas[0].codigo : '';
  };
  /** a conta do banco: a escolhida aqui, a do Cadastro ou a do plano pelo nome (e de onde veio) */
  const contaDoBanco = (banco: string) => {
    if (bancoEscolhido[banco]) return { codigo: bancoEscolhido[banco], origem: 'escolhida' as const };
    const cad = cadastro?.bancos?.find(b => b.id === banco)?.contaContabil || '';
    if (cad) return { codigo: cad, origem: 'cadastro' as const };
    const pl = doPlanoPeloNome(banco);
    return { codigo: pl, origem: pl ? 'plano' as const : '' as const };
  };

  const faturas = lidas.map(l => {
    const c = cartoes.comprasDaFatura(l.fatura);
    const pg = cartoes.pagamentoNoExtrato(l.fatura, c.soma, extratoEm(l.fatura.vencimento));
    const dia = pg?.data || l.fatura.vencimento;
    // o período à risca: a fatura entra no mês em que foi paga
    const noPeriodo = !naTarefa || meses.includes(dia.slice(0, 7));
    const doBanco = pg ? contaDoBanco(pg.banco) : null;
    const contaBanco = doBanco?.codigo || '';
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
      /** a conta do banco não está no Cadastro: a escolhida ou a do plano (dá para trocar) */
      bancoForaDoCadastro: !!pg && doBanco?.origem !== 'cadastro',
      nomeContaBanco: nomeDaConta(contaBanco),
      linhas: cartoes.lancamentosDaFatura(c, dia, contaCartao || '?', contaBanco || '?').map((ln, i) => ({ id: i, ...ln, valor: formatos.brl(ln.valor), portador: c.compras[i]?.portador || '' })),
      deFora: c.deFora.map((d, i) => ({ id: i, data: dataBr(d.item.data), descricao: d.item.descricao, valor: formatos.brl(d.item.valor), motivo: d.motivo })),
      // para o arquivo
      bruto: { compras: c, dia, contaBanco },
    };
  });

  const validas = faturas.filter(f => f.noPeriodo);
  const doPlano = (re: RegExp) => (plano?.contas || []).find(c => !c.sintetica && re.test(c.nome.trim()))?.codigo || '';
  const contaCaixa = caixaEscolhido || doPlano(/^caixa\b/i);
  const contaFornecedor = fornecedorEscolhido || doPlano(/adiantamentos? a fornecedor/i);
  const conferidas = cartoes.conferirComAsNotas(validas.map(f => ({ id: f.id, dia: f.bruto.dia, compras: f.bruto.compras.compras })), notas,
    (meses[0] || validas[0]?.bruto.dia.slice(0, 7) || '') + '-01');
  const diaDa = (id: string) => validas.find(f => f.id === id)?.bruto.dia || '';
  const contas = { cartao: contaCartao || '?', caixa: contaCaixa || '?', fornecedorSemConta: contaFornecedor || '?', banco: (id: string) => validas.find(f => f.id === id)?.bruto.contaBanco || '?' };
  const inicioDoPeriodo = (meses[0] || validas[0]?.bruto.dia.slice(0, 7) || '') + '-01';
  const razao = cartoes.razaoDoCartao(conferidas, diaDa, contas, inicioDoPeriodo);
  const semNota = conferidas.filter(c => c.situacao === 'sem-nota').length;
  const notaSemConta = conferidas.some(c => c.creditaANota && c.nota && !c.nota.conta);
  // cada fatura: as compras (com a nota achada ou não) e os lançamentos dela no razão gerado
  const comRazao = faturas.map(f => {
    if (!f.noPeriodo) return { ...f, compras: [] as { id: number; data: string; descricao: string; valor: string; situacao: string; dica: string }[] };
    const daFatura = conferidas.filter(c => c.fatura === f.id);
    const ls = razao.filter(x => x.fatura === f.id);
    return {
      ...f,
      qtd: ls.length,
      linhas: ls.map((x, i) => ({ id: i, ...x.linha, valor: formatos.brl(x.linha.valor), portador: '' })),
      compras: daFatura.map((c, i) => ({
        id: i, data: dataBr(c.item.data), descricao: c.item.descricao, valor: formatos.brl(c.item.valor),
        situacao: c.situacao === 'com-nota' ? 'Nota ' + c.nota!.numero.replace(/^0+(?=\d)/, '') : c.situacao === 'sem-nota' ? 'Sem nota · Caixa' : 'Parcela de antes',
        dica: c.nota ? c.nota.nome + ' · ' + dataBr(c.nota.data) + ' · ' + formatos.brl(c.nota.valor) + (c.creditaANota ? '' : ' (o crédito saiu na primeira parcela)')
          : c.situacao === 'parcela-anterior' ? 'Compra de antes do período: a nota entrou lá atrás, inteira' : 'Sem nota de entrada do mesmo valor: D Caixa / C Cartão',
      })),
    };
  });
  const faltaBanco = validas.some(f => !f.pagamento || !f.contaBanco);
  const pronto = validas.length > 0 && !!contaCartao && !faltaBanco && validas.every(f => f.bate) && (!naTarefa || !!fonte) && (!semNota || !!contaCaixa) && (!notaSemConta || !!contaFornecedor);
  const linhasDoArquivo = () => razao.map(x => x.linha);
  const opcoes = (plano?.contas || []).filter(c => !c.sintetica).map(c => ({ codigo: c.codigo, nome: c.nome }));

  return {
    naTarefa,
    periodo: meses.length ? tarefas.rotuloDoPeriodo(meses) : '',
    lendo, importar: (fs: File[]) => { void importar(fs); },
    remover: (id: string) => setLidas(l => l.filter(f => f.id !== id)),
    faturas: comRazao,
    /** o razão gerado: as notas de entrada que vieram, quantas compras com e sem nota e o movimento de cada mês */
    razao: {
      temNotas: !!fonte, qtdNotas: notas.length,
      comNota: conferidas.filter(c => c.situacao === 'com-nota').length, semNota,
      movimento: validas.length ? cartoes.movimentoDoCartao(razao, meses.length ? meses : [...new Set(razao.map(x => x.iso.slice(0, 7)))].sort()).map(s => ({
        mes: s.mes, rotulo: tarefas.rotuloNumericoCompetencia(s.mes),
        creditos: formatos.brl(s.creditos), debitos: formatos.brl(s.debitos), acumulado: tarefas.valorComLado(s.acumulado),
      })) : [],
    },
    contaCaixa, nomeContaCaixa: nomeDaConta(contaCaixa), escolherContaCaixa: setCaixa,
    /** a conta do fornecedor quando a nota não trouxe a conta (só aparece se precisar) */
    notaSemConta, contaFornecedor, nomeContaFornecedor: nomeDaConta(contaFornecedor), escolherContaFornecedor: setFornecedor,
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
      validas.length && naTarefa && !fonte ? 'Importe as notas de entrada na Conferência fiscal' : '',
      semNota && !contaCaixa ? 'Escolha a conta do caixa (as compras sem nota)' : '',
      notaSemConta && !contaFornecedor ? 'Escolha a conta do fornecedor (a nota de entrada veio sem a conta)' : '',
      validas.some(f => !f.pagamento) ? 'O pagamento de alguma fatura não está no extrato importado' : '',
      validas.some(f => f.pagamento && !f.contaBanco) ? 'Escolha a conta do banco que pagou a fatura' : '',
      validas.some(f => !f.bate) ? 'A soma das compras não bate com o total de alguma fatura' : '',
    ].filter(Boolean),
    qtdLancamentos: razao.length,
    /** o que o "Importar no Alterdata" manda: a mesma planilha do Baixar (as mesmas linhas) */
    importacao: {
      codigo: empresa.codigo ?? null, empresa: empresa.nome, origem: 'cartoes',
      lote: nomeDoLote('Cartões', linhasDoArquivo().map(l => l.data)),
      planilha: () => { const linhas = linhasDoArquivo(); return linhas.length ? { bytes: cartoes.planilhaDeImportacao(linhas), linhas: linhas.length } : null; },
    },
    arquivo: () => ({
      bytes: cartoes.planilhaDeImportacao(linhasDoArquivo()),
      nome: cartoes.nomeDoArquivoDoCartao(empresa.codigo != null ? String(empresa.codigo) : null, validas[0]?.bruto.dia || ''),
      tipo: cartoes.TIPO_XLS,
    }),
  };
}

export type VmCompras = ReturnType<typeof useCompras>;
