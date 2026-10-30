// ViewModel da janela da conta a pagar (28/10/2026: "o Contas a Pagar do Toriba, no nads"), no formulário do Toriba: a
// conta (fornecedor, conta contábil, documento, emissão, vencimento, valor, a linha digitável e o boleto; na nova, a
// "Despesa recorrente" com a quantidade), o pagamento, as observações, os anexos e o Auditor. O fornecedor traz a conta
// contábil dele; o fornecedor novo se cadastra ali mesmo. O boleto em PDF é lido no navegador (financeiro.lerBoleto): o
// valor, o vencimento e a linha digitável vêm sozinhos. A recorrência cria as N contas na hora, uma por mês, no mesmo dia.
// Pagar conta só grava o pagamento: o Contas a pagar é controle e não lança no Caixa (30/10/2026: "Nao joga no caixa, serve
// apenas pra controle"); a conta contábil fica para o relatório. A paga antes disso tem a saída no Caixa: Desfazer o
// pagamento e Excluir ainda tiram essa saída. Paga, a conta
// só muda as observações e os anexos. Excluir uma parcela pergunta "só esta" ou "esta e as próximas" (as em aberto).
import { extrator, financeiro, formatos } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useState } from 'react';
import { useOperador } from '../../casca/operador';
import type { ArquivoParaAnexar } from '../../dados/contasPagar';
import { useCaixa, useContasPagar } from '../../dados/repo';
import { dataBr, dataHoraBr, hoje, isoDaData, valorDigitado, valorNoCampo } from './formatosDaNota';

extrator.definirWorkerDoPdf(workerDoPdf);

export type TopicoDaContaAPagar = 'conta' | 'pagamento' | 'observacoes' | 'anexos' | 'auditor';

/** o arquivo escolhido, antes de subir (o da conta nova sobe depois de gravar) */
interface Escolhido { nome: string; bytes: Uint8Array }

/** o PDF, as imagens: o que o anexo aceita */
export const ACEITA_NO_ANEXO = '.pdf,.png,.jpg,.jpeg';

const tipoDoArquivo = (nome: string) => (/\.pdf$/i.test(nome) ? 'application/pdf' : /\.png$/i.test(nome) ? 'image/png' : /\.jpe?g$/i.test(nome) ? 'image/jpeg' : 'application/octet-stream');
const tamanhoBr = (n: number) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const mensagem = (e: unknown, o: string) => (e instanceof Error && e.message ? e.message : o);

/** os bytes do arquivo, ou o motivo de não poder anexar */
async function lerArquivo(f: File): Promise<Escolhido | string> {
  if (!f.size) return 'O arquivo está vazio.';
  if (f.size > financeiro.LIMITE_DO_ANEXO) return 'O arquivo passa de 10 MB.';
  return { nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) };
}

/** o texto do PDF (as palavras de cada página), '' quando não é PDF ou não tem texto */
async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  try {
    if (!extrator.ehPdf(bytes)) return '';
    return (await extrator.itensDoPdf(bytes)).map(p => p.map(i => i.texto).join(' ')).join('\n');
  } catch { return ''; }
}

export function useJanelaDaContaAPagar(id: string | undefined, topicoInicial: TopicoDaContaAPagar | undefined, fechar: () => void) {
  const repo = useContasPagar();
  const caixa = useCaixa();
  const { toast, modal } = useRetorno();
  const quem = useOperador().operador?.nome || '';
  const dia = hoje();
  const existente = id ? repo.contas().lista.find(c => c.id === id) : undefined;
  const fornecedores = repo.fornecedores().lista;
  const plano = caixa.plano().lista;
  const [topico, setTopico] = useState<TopicoDaContaAPagar>(topicoInicial ?? 'conta');

  // a conta
  const [fornecedorId, setFornecedorId] = useState(existente?.fornecedorId ?? '');
  const [conta, setConta] = useState(existente?.conta ?? '');
  const [documento, setDocumento] = useState(existente?.documento ?? '');
  const [emissao, setEmissao] = useState(dataBr(existente ? existente.emissao : dia));
  const [vencimento, setVencimento] = useState(dataBr(existente?.vencimento ?? ''));
  const [valor, setValor] = useState(valorNoCampo(existente?.valor ?? 0));
  const [linha, setLinha] = useState(existente?.linhaDigitavel ? financeiro.linhaFormatada(existente.linhaDigitavel) : '');
  const [observacoes, setObservacoes] = useState(existente?.observacoes ?? '');
  const [recorrente, setRecorrente] = useState(false);
  const [quantidade, setQuantidade] = useState('12');
  const [boleto, setBoleto] = useState<Escolhido | null>(null);
  const [lendo, setLendo] = useState(false);
  /** o que foi lido do boleto ("valor R$ 150,75 · vence 14/10/2025"), ou por que não leu */
  const [leitura, setLeitura] = useState('');
  // o fornecedor novo, cadastrado ali mesmo
  const [cadastrando, setCadastrando] = useState(false);
  const [novoRazao, setNovoRazao] = useState('');
  const [novoFantasia, setNovoFantasia] = useState('');
  const [novoDocumento, setNovoDocumento] = useState('');
  // o pagamento
  const [dataPg, setDataPg] = useState(dataBr(dia));
  const [juros, setJuros] = useState('');
  const [desconto, setDesconto] = useState('');
  const [valorPago, setValorPago] = useState(valorNoCampo(existente?.valor ?? 0));
  const [comprovante, setComprovante] = useState<Escolhido | null>(null);

  const [erros, setErros] = useState<string[]>([]);
  const [fazendo, setFazendo] = useState('');

  const paga = !!existente?.pagamento;
  // só as contas que recebem lançamento e estão ativas (e a que a conta já tem, mesmo se saiu de uso)
  const contas = plano.filter(c => (c.movimentavel && c.ativo) || c.id === existente?.conta);
  const fornecedor = fornecedores.find(f => f.id === fornecedorId);
  const situacao = existente ? financeiro.situacaoDaConta(existente, dia) : null;

  /** o fornecedor escolhido traz a conta contábil dele (se a conta ainda está vazia, ou com a do fornecedor de antes) */
  function escolherFornecedor(novo: string) {
    const antes = financeiro.contaPadraoDoFornecedor(fornecedor, plano);
    const padrao = financeiro.contaPadraoDoFornecedor(fornecedores.find(f => f.id === novo), plano);
    if (padrao && (!conta || conta === antes)) setConta(padrao);
    setFornecedorId(novo);
  }

  /** o boleto lido: preenche o valor, o vencimento e a linha digitável (o que não achou fica como está) */
  function usarLeitura(l: financeiro.LeituraDoBoleto | null, origem: string) {
    if (!l) { setLeitura('Não achei a linha digitável ' + origem + '. Preencha o valor e o vencimento.'); return; }
    setLinha(financeiro.linhaFormatada(l.linha));
    if (l.valor) { setValor(valorNoCampo(l.valor)); if (!paga) setValorPago(valorNoCampo(l.valor)); }
    if (l.vencimento) setVencimento(dataBr(l.vencimento));
    setLeitura('Li ' + origem + ': ' + [l.valor ? 'valor ' + formatos.reais(l.valor) : 'sem valor', l.vencimento ? 'vence ' + dataBr(l.vencimento) : 'sem vencimento'].join(' · ') + '. Confira.');
  }

  const anexarAgora = async (contaId: string, a: ArquivoParaAnexar) => {
    try { await repo.anexar(contaId, a, quem); return true; } catch (e) { toast('O ' + (a.tipo === 'boleto' ? 'boleto' : 'comprovante') + ' não subiu: ' + mensagem(e, 'tente de novo.')); return false; }
  };

  return {
    novo: !id, existente, paga, situacao, fornecedores, contas, fornecedor,
    topico, setTopico,
    fornecedorId, escolherFornecedor, conta, setConta, documento, setDocumento, emissao, setEmissao, vencimento, setVencimento,
    valor, setValor, linha, setLinha, observacoes, setObservacoes, recorrente, setRecorrente, quantidade, setQuantidade,
    boleto, lendo, leitura,
    erros, fazendo,
    /** o rótulo da parcela ("parcela 2 de 12") */
    parcela: financeiro.rotuloDaParcela(existente?.recorrencia),
    /** a prévia da recorrência: as datas das parcelas ("10/11/2026, 10/12/2026 … 10/10/2027") */
    previaDaRecorrencia() {
      const n = Number(quantidade);
      const datas = financeiro.vencimentosDaRecorrencia(isoDaData(vencimento), Number.isInteger(n) && n >= 2 && n <= financeiro.MAX_PARCELAS ? n : 0);
      if (!datas.length) return '';
      return n + ' contas, uma por mês: ' + (datas.length > 3 ? [datas[0], datas[1]].map(dataBr).join(', ') + ' … ' + dataBr(datas.at(-1)!) : datas.map(dataBr).join(', ')) + '.';
    },
    /** a linha digitada ou colada, ao sair do campo: confere e preenche o valor e o vencimento */
    lerLinhaDigitada() {
      if (!linha.trim()) return;
      const l = financeiro.lerLinhaDigitavel(linha, dia);
      if (l) usarLeitura(l, 'a linha digitável');
      else setLeitura('A linha digitável não confere (os dígitos verificadores). Confira os números.');
    },

    // o fornecedor novo
    cadastrando, setCadastrando, novoRazao, setNovoRazao, novoFantasia, setNovoFantasia, novoDocumento, setNovoDocumento,
    async cadastrarFornecedor() {
      const f = { razaoSocial: novoRazao, nomeFantasia: novoFantasia, documento: novoDocumento, contaPadrao: conta || undefined, ativo: true };
      const problemas = financeiro.conferirFornecedor(f);
      setErros(problemas);
      if (problemas.length) return;
      setFazendo('fornecedor');
      try {
        const novoId = await repo.salvarFornecedor(f, quem);
        setFornecedorId(novoId);
        setCadastrando(false); setNovoRazao(''); setNovoFantasia(''); setNovoDocumento('');
        toast('Fornecedor cadastrado.');
      } catch (e) { setErros([mensagem(e, 'Não consegui cadastrar o fornecedor.')]); } finally { setFazendo(''); }
    },

    /** o boleto escolhido: lê o PDF; na conta que já existe, sobe na hora */
    async escolherBoleto(f: File | null) {
      if (!f) { setBoleto(null); setLeitura(''); return; }
      const lido = await lerArquivo(f);
      if (typeof lido === 'string') { setErros([lido]); return; }
      setErros([]);
      setLendo(true);
      try {
        const texto = await textoDoPdf(lido.bytes);
        if (texto) usarLeitura(financeiro.lerBoleto(texto, dia), 'no boleto');
        else setLeitura('O arquivo não tem texto para ler (é uma foto ou um PDF escaneado). Preencha o valor e o vencimento.');
        if (id) { if (await anexarAgora(id, { ...lido, tipo: 'boleto' })) toast('Boleto anexado.'); } else setBoleto(lido);
      } finally { setLendo(false); }
    },

    /** Gravar: a conta nova (com a recorrência, as N contas) ou a alteração */
    async salvar() {
      const r = {
        fornecedorId, conta: conta || undefined, documento, emissao: emissao.trim() ? isoDaData(emissao) || emissao.trim() : '', vencimento: isoDaData(vencimento),
        valor: valorDigitado(valor), linhaDigitavel: linha.replace(/\D/g, '') || undefined, observacoes,
      };
      const n = Number(quantidade);
      const problemas = financeiro.conferirContaAPagar(r, !id && recorrente ? n : undefined);
      if (r.linhaDigitavel && !financeiro.lerLinhaDigitavel(r.linhaDigitavel, dia)) problemas.push('A linha digitável não confere: corrija ou apague.');
      setErros(problemas);
      if (problemas.length) { setTopico('conta'); return; }
      setFazendo('salvar');
      try {
        if (id) {
          await repo.alterarConta({ ...r, id, recorrencia: existente?.recorrencia }, quem);
          toast('Conta alterada.');
          fechar();
          return;
        }
        const datas = recorrente ? financeiro.vencimentosDaRecorrencia(r.vencimento, n) : [r.vencimento];
        const grupo = 'rec-' + Date.now().toString(36);
        // a linha digitável e o boleto são da primeira parcela; as outras chegam com o próprio boleto
        const ids = await repo.criarContas(datas.map((v, k) => ({
          ...r, vencimento: v, ...(recorrente ? { recorrencia: { grupo, parcela: k + 1, de: n } } : {}), ...(k ? { linhaDigitavel: undefined } : {}),
        })), quem);
        if (boleto) await anexarAgora(ids[0], { ...boleto, tipo: 'boleto' });
        toast(ids.length > 1 ? ids.length + ' contas incluídas, uma por mês.' : 'Conta incluída.');
        fechar();
      } catch (e) {
        setErros([mensagem(e, 'Não consegui gravar.')]);
      } finally { setFazendo(''); }
    },

    // o pagamento
    dataPg, setDataPg, juros, desconto, valorPago, setValorPago, comprovante,
    /** os juros e o desconto refazem o valor pago (o valor da conta + juros − desconto) */
    setJuros(v: string) { setJuros(v); setValorPago(valorNoCampo(financeiro.valorComJuros(existente?.valor ?? valorDigitado(valor), valorDigitado(v), valorDigitado(desconto)))); },
    setDesconto(v: string) { setDesconto(v); setValorPago(valorNoCampo(financeiro.valorComJuros(existente?.valor ?? valorDigitado(valor), valorDigitado(juros), valorDigitado(v)))); },
    async escolherComprovante(f: File | null) {
      if (!f) { setComprovante(null); return; }
      const lido = await lerArquivo(f);
      if (typeof lido === 'string') { setErros([lido]); return; }
      setErros([]);
      // paga: sobe na hora; ainda não paga, sobe junto com o Pagar conta
      if (id && paga) { if (await anexarAgora(id, { ...lido, tipo: 'comprovante' })) toast('Comprovante anexado.'); } else setComprovante(lido);
    },
    /** Pagar conta: grava o pagamento na conta (não lança no Caixa) */
    async pagar() {
      if (!existente) return;
      const p = { data: isoDaData(dataPg), valorPago: valorDigitado(valorPago), juros: valorDigitado(juros), desconto: valorDigitado(desconto) };
      const problemas = financeiro.conferirPagamento(p);
      setErros(problemas);
      if (problemas.length) return;
      setFazendo('pagar');
      try {
        await repo.definirPagamento(existente.id, { ...p, por: quem, em: new Date().toISOString() });
      } catch (e) {
        setErros([mensagem(e, 'Não consegui gravar o pagamento.')]);
        setFazendo('');
        return;
      }
      if (comprovante) { await anexarAgora(existente.id, { ...comprovante, tipo: 'comprovante' }); setComprovante(null); }
      setFazendo('');
      toast('Conta paga.');
    },
    /** Desfazer o pagamento: a conta volta a ficar em aberto; a paga antes de 30/10/2026 tem a saída no Caixa, que sai junto */
    async desfazerPagamento() {
      const antigo = existente?.pagamento;
      if (!existente || !antigo) return;
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Desfazer o pagamento?',
        texto: 'A conta volta a ficar em aberto.' + (antigo.lancamentoId ? ` A saída de ${formatos.reais(antigo.valorPago)} que ela tinha no Caixa sai junto.` : '') + (existente.anexos.some(a => a.tipo === 'comprovante') ? ' O comprovante continua anexado.' : ''),
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desfazer', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      setFazendo('desfazer');
      try {
        await repo.definirPagamento(existente.id, null);
        // não confere na lista do Caixa: ela pode ainda não ter sido lida nesta página (aí a saída ficava no Caixa)
        if (antigo.lancamentoId) {
          try { await caixa.excluirLancamento(antigo.lancamentoId); } catch (e) { await repo.definirPagamento(existente.id, antigo).catch(() => undefined); throw e; }
        }
        setValorPago(valorNoCampo(existente.valor)); setJuros(''); setDesconto('');
        toast('Pagamento desfeito.');
      } catch (e) {
        setErros([mensagem(e, 'Não consegui desfazer o pagamento.')]);
      } finally { setFazendo(''); }
    },

    /** Excluir: pergunta (a parcela: só esta ou esta e as próximas em aberto); a paga leva junto a saída do Caixa */
    async excluir() {
      if (!existente) return;
      const r = existente.recorrencia;
      const resumo = `ID ${existente.numero} · ${financeiro.nomeDoFornecedor(fornecedores.find(f => f.id === existente.fornecedorId)) || 'sem fornecedor'} · ${formatos.reais(existente.valor)}.`;
      const doCaixa = paga && existente.pagamento?.lancamentoId ? ' Ela tem a saída no Caixa: a saída também sai.' : '';
      const qual = await modal<'esta' | 'proximas' | null>(r ? {
        icone: 'alert', titulo: 'Excluir a ' + financeiro.rotuloDaParcela(r) + '?',
        texto: resumo + ' Esta e as próximas: as parcelas seguintes que ainda não foram pagas.' + doCaixa,
        botoes: [{ rotulo: 'Cancelar', valor: null, variante: 'btn-outline' }, { rotulo: 'Só esta', valor: 'esta', variante: 'btn-danger' }, { rotulo: 'Esta e as próximas', valor: 'proximas', variante: 'btn-danger' }],
      } : {
        icone: 'alert', titulo: 'Excluir esta conta?', texto: resumo + ' Os anexos saem junto.' + doCaixa,
        botoes: [{ rotulo: 'Cancelar', valor: null, variante: 'btn-outline' }, { rotulo: 'Excluir', valor: 'esta', variante: 'btn-danger' }],
      });
      if (!qual) return;
      const sairao = qual === 'esta' || !r ? [existente]
        : [existente, ...repo.contas().lista.filter(c => c.id !== existente.id && c.recorrencia?.grupo === r.grupo && c.recorrencia.parcela > r.parcela && !c.pagamento)];
      setFazendo('excluir');
      try {
        await repo.excluirContas(sairao.map(c => c.id));
        const lancamentos = sairao.map(c => c.pagamento?.lancamentoId).filter((x): x is string => !!x);
        for (const l of lancamentos) await caixa.excluirLancamento(l).catch(() => toast('A saída do Caixa não saiu: apague no Caixa.'));
        toast(sairao.length > 1 ? sairao.length + ' contas excluídas.' : 'Conta excluída.');
        fechar();
      } catch (e) {
        setErros([mensagem(e, 'Não consegui excluir.')]);
        setFazendo('');
      }
    },

    // os anexos
    anexos: existente?.anexos ?? [],
    tamanhoBr,
    quando: dataHoraBr,
    /** abre numa aba nova (a aba abre no clique; o arquivo chega depois, como no Drive) */
    async abrirAnexo(a: financeiro.AnexoDaConta) {
      if (!id) return;
      const janela = window.open('', '_blank');
      try {
        const url = URL.createObjectURL(new Blob([(await repo.bytesDoAnexo(id, a.id)) as BlobPart], { type: tipoDoArquivo(a.nome) }));
        if (janela && !janela.closed) janela.location.href = url; else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (e) { janela?.close(); toast(mensagem(e, 'Não consegui abrir o anexo.')); }
    },
    async baixarAnexo(a: financeiro.AnexoDaConta) {
      if (!id) return;
      try { baixarBytes(await repo.bytesDoAnexo(id, a.id), a.nome, tipoDoArquivo(a.nome)); } catch (e) { toast(mensagem(e, 'Não consegui baixar o anexo.')); }
    },
    async tirarAnexo(a: financeiro.AnexoDaConta) {
      if (!id) return;
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Tirar este anexo?', texto: a.nome + ' sai da conta e do banco.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-danger' }],
      });
      if (!ok) return;
      try { await repo.tirarAnexo(id, a.id); toast('Anexo tirado.'); } catch (e) { toast(mensagem(e, 'Não consegui tirar o anexo.')); }
    },
    async anexarOutro(f: File, tipo: financeiro.TipoDeAnexo) {
      if (!id) return;
      const lido = await lerArquivo(f);
      if (typeof lido === 'string') { setErros([lido]); return; }
      setFazendo('anexo');
      try { if (await anexarAgora(id, { ...lido, tipo })) toast('Anexado.'); } finally { setFazendo(''); }
    },
  };
}

export type VmJanelaDaContaAPagar = ReturnType<typeof useJanelaDaContaAPagar>;
