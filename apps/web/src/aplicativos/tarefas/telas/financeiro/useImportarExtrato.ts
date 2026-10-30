// ViewModel de Financeiro › Importar extrato (23/10/2026: "a parte de conciliação não vai existir, ela vai se tornar um
// importador de extrato que vai trazer os dados e informações para o dashboard inicial"): o extrato escolhido (PDF, OFX,
// planilha ou foto), lido pelo Extrator (extrator.lerArquivo). De quem é o extrato vem do texto dele (23/10/2026: "quero
// que ele identifique o banco que foi importado pelo pdf/conta, caso não seja da nilma contabilidade (pj) ou nilma dias
// (pf) não importe, se possível um cadastro de conta bancária no cadastro de empresas para evitar coisas erradas e
// coloque no plano de contas automaticamente"): o banco, o titular e a conta, conferida com as contas bancárias da
// Nilma Contabilidade no Cadastro (financeiro.identificarExtrato). De outro titular, ou numa conta fora do Cadastro, não
// importa; sem texto (planilha, foto) escolhe-se a conta do Cadastro. Importar grava à parte do Caixa (financeiroBanco),
// com a conta do plano do financeiro da conta bancária (criada na primeira vez). Embaixo, as importações feitas, cada uma
// abrindo o extrato numa janela. O arquivo não é guardado.
import { extrator, financeiro, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ocrDoArquivo } from '../../../../comum/ocr';
import { caminhoDaPagina, caminhoDoCadastro } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useCadastro, useCaixa } from '../../dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);
// o extrato escaneado (o PDF sem texto ou a foto) passa pelo OCR do navegador, como no Extratudo (23/10/2026: "ele diz
// que não achou valor no pdf")
extrator.definirOcr(ocrDoArquivo);

const ESCRITORIO = financeiro.EMPRESA_DO_ESCRITORIO;

interface Lido {
  nome: string; id: string; lancamentos: extrator.Lancamento[]; saldoAnterior?: number; saldosDoDia?: { data: string; saldo: number }[];
  ocr: boolean; erro: string | null;
  /** o texto do arquivo (o do PDF ou do OFX), para saber de quem é; vazio na planilha e na foto */
  texto: string;
}

/** o texto do arquivo: as palavras do PDF (sem o OCR) ou o OFX inteiro; nos outros, vazio */
async function textoDoArquivo(nome: string, bytes: Uint8Array): Promise<string> {
  try {
    if (/\.pdf$/i.test(nome)) return (await extrator.itensDoPdf(bytes)).map(p => p.map(i => i.texto).join(' ')).join('\n');
    if (/\.ofx$/i.test(nome)) return new TextDecoder('latin1').decode(bytes);
  } catch { /* sem texto: a tela pede a conta */ }
  return '';
}

export function useImportarExtrato() {
  const repo = useCaixa();
  const extrato = repo.extrato();
  const importacoes = repo.importacoes();
  const plano = repo.plano();
  const cadastro = useCadastro(ESCRITORIO.nome, ESCRITORIO.codigo);
  const { toast } = useRetorno();
  const navegar = useNavigate();
  const operador = useOperador().operador?.nome || '';
  // as contas bancárias da Nilma no Cadastro (as abertas)
  const contas = useMemo(() => (cadastro.cadastro.bancos ?? []).filter(b => !b.ate), [cadastro.cadastro.bancos]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [lido, setLido] = useState<Lido | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  async function escolher(f: File | null) {
    setArquivo(f);
    setLido(null);
    setEscolhida(null);
    if (!f) return;
    setLendo(true);
    const id = 'i_' + Date.now().toString(36);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const [r, texto] = await Promise.all([extrator.lerArquivo(f.name, bytes, 'banco'), textoDoArquivo(f.name, bytes)]);
      setLido({ nome: f.name, id, lancamentos: r.lancamentos, saldoAnterior: r.saldoAnterior, saldosDoDia: r.saldosDoDia, ocr: !!r.ocr, erro: r.erro, texto });
    } catch (e) {
      setLido({ nome: f.name, id, lancamentos: [], ocr: false, texto: '', erro: 'Não consegui ler o arquivo: ' + (e instanceof Error ? e.message : String(e)) });
    } finally { setLendo(false); }
  }

  // de quem é o extrato: pelo texto; sem texto, a conta escolhida na tela
  const ident = useMemo(() => (lido ? financeiro.identificarExtrato(lido.texto, contas) : null), [lido, contas]);
  const semTexto = !!ident && ident.daNilma === null;
  const conta = ident?.conta ? contas.find(c => c.id === ident.conta!.id) ?? null : semTexto ? contas.find(c => c.id === escolhida) ?? null : null;
  const nomeDoBanco = conta?.nome || 'Banco';
  /** o que impede a importação (null = pode importar) */
  const bloqueio: string | null = !lido || !ident ? null
    : ident.daNilma === false ? 'Este extrato não é da Nilma Contabilidade nem da Nilma Dias: não importei.'
    : !contas.length ? 'Nenhuma conta bancária da Nilma no Cadastro. Cadastre as contas (a PJ e a PF) em Cadastro › 284 Nilma Contabilidade › Contas bancárias.'
    : !semTexto && !ident.conta ? 'A conta deste extrato' + (ident.marca ? ' (' + (ident.marca === 'efi' ? 'Efí' : ident.marca === 'sicoob' ? 'Sicoob' : ident.marca) + ')' : '') + ' não está nas contas bancárias da Nilma no Cadastro. Cadastre-a para importar.'
    : semTexto && !conta ? 'O arquivo não diz de qual conta é: escolha a conta da Nilma.'
    : null;

  // o id de cada linha vai pela conta bancária (30/10/2026: pelo nome do banco, a PJ e a PF no mesmo banco colidiam)
  const linhas = useMemo(() => (lido && conta ? financeiro.linhasDoExtrato(lido.lancamentos, nomeDoBanco, lido.id, conta.id) : []), [lido, conta, nomeDoBanco]);
  // as que já estão no banco: pelo id, ou pelo id antigo (o do nome do banco) gravado nesta mesma conta
  const repetidasDoArquivo = useMemo(() => financeiro.separarJaImportadas(linhas, extrato.lista).repetidas, [linhas, extrato.lista]);
  const ja = useMemo(() => new Set([...extrato.lista.map(x => x.id), ...repetidasDoArquivo.map(x => x.id)]), [extrato.lista, repetidasDoArquivo]);
  const porImportacao = useMemo(() => {
    const m = new Map<string, financeiro.LancamentoDoBanco[]>();
    for (const l of extrato.lista) m.set(l.importacao, [...(m.get(l.importacao) ?? []), l]);
    return m;
  }, [extrato.lista]);
  const repetidas = repetidasDoArquivo.length;
  const resumo = financeiro.resumoDoExtrato(linhas);
  const saldoFinal = lido ? financeiro.saldoFinalDoExtrato(lido.lancamentos, lido.saldoAnterior, lido.saldosDoDia) : undefined;
  const linhaDaTela = (l: financeiro.LancamentoDoBanco) => ({ id: l.id, data: extrator.dataBR(l.data), historico: l.historico, valor: formatos.reais(l.valor), entrada: l.tipo === 'E', ja: ja.has(l.id) });
  const rotuloDe = (c: { agencia?: string; conta?: string; apelido?: string }) => [c.apelido, c.agencia ? 'Ag. ' + c.agencia : '', c.conta ? 'C/C ' + c.conta : ''].filter(Boolean).join(' · ');

  const daImportacao = (i: financeiro.ImportacaoDeExtrato) => ({
    id: i.id, banco: i.banco, marca: i.marca || (i.banco === 'Efí' ? 'efi' : i.banco === 'Sicoob' ? 'sicoob' : ''), conta: i.rotuloDaConta || '', arquivo: i.arquivo,
    periodo: i.de ? extrator.dataBR(i.de) + ' a ' + extrator.dataBR(i.ate) : '—',
    quantos: i.quantos, entradas: formatos.reais(i.entradas), saidas: formatos.reais(i.saidas),
    saldoFinal: i.saldoFinal == null ? null : formatos.reais(i.saldoFinal),
    quando: i.importadoEm ? new Date(i.importadoEm).toLocaleDateString('pt-BR') : '', quem: i.importadoPor,
  });

  return {
    carregando: !extrato.carregada || !importacoes.carregada,
    exemplos: repo.exemplos,
    erroDoBanco: extrato.erro || importacoes.erro,
    arquivo, escolher, lendo,
    erro: lido?.erro || '',
    ocr: !!lido?.ocr,
    /** as contas da Nilma no Cadastro (a escolha quando o arquivo não diz de qual conta é) */
    contas: contas.map(c => ({ id: c.id, marca: c.marca, nome: c.nome, rotulo: rotuloDe(c) })),
    semTexto, escolhida, escolherConta: setEscolhida,
    /** a conta do extrato (identificada pelo texto ou escolhida) */
    conta: conta ? { marca: conta.marca, nome: conta.nome, rotulo: rotuloDe(conta), identificada: !!ident?.conta } : null,
    bloqueio,
    abrirContas: () => navegar(caminhoDoCadastro(String(ESCRITORIO.codigo), 'bancos')),
    /** a prévia do extrato lido (null antes de escolher, sem linhas ou bloqueado) */
    previa: lido && linhas.length && !bloqueio ? {
      arquivo: lido.nome,
      periodo: extrator.dataBR(resumo.de) + ' a ' + extrator.dataBR(resumo.ate),
      quantas: linhas.length, novas: linhas.length - repetidas, repetidas,
      entradas: formatos.reais(resumo.entradas), saidas: formatos.reais(resumo.saidas),
      saldoFinal: saldoFinal == null ? null : formatos.reais(saldoFinal),
      linhas: linhas.slice(0, 300).map(linhaDaTela),
      mais: Math.max(0, linhas.length - 300),
    } : null,
    gravando,
    async importar() {
      if (!lido || !linhas.length || !conta || bloqueio) return;
      setGravando(true);
      try {
        // a conta do plano do financeiro desta conta bancária (criada na primeira vez, no Ativo Circulante)
        const descricao = financeiro.descricaoDaContaBancaria(conta);
        const p = financeiro.contaDoPlanoParaOBanco(plano.lista, descricao);
        const idDoPlano = p.existe ? p.id
          : await repo.salvarConta({ codigo: p.codigo, descricao: p.descricao, tipo: 'ATIVO', nivel: p.nivel, pai: p.pai, ativo: true, movimentavel: true });
        const comConta = linhas.map(l => ({ ...l, contaBancaria: conta.id, conta: idDoPlano }));
        const r = await repo.importarExtrato({
          id: lido.id, banco: nomeDoBanco, marca: conta.marca, contaBancaria: conta.id, conta: idDoPlano, rotuloDaConta: rotuloDe(conta),
          arquivo: lido.nome, ...resumo, saldoFinal,
        }, comConta, operador);
        toast((r.novas ? r.novas + (r.novas === 1 ? ' lançamento importado' : ' lançamentos importados') + (r.repetidas ? ' (' + r.repetidas + ' já estavam)' : '') : 'Nada novo: todas as linhas já estavam importadas')
          + (p.existe ? '.' : '. Criei a conta ' + p.codigo + ' ' + p.descricao + ' no plano de contas.'));
        setArquivo(null);
        setLido(null);
      } catch (e) { toast('Não importei: ' + (e instanceof Error ? e.message : String(e))); }
      finally { setGravando(false); }
    },
    cancelar() { setArquivo(null); setLido(null); setEscolhida(null); },
    /** as importações feitas, da mais nova para a mais velha */
    importacoes: importacoes.lista.map(daImportacao),
    /** o extrato aberto na janela (23/10/2026: "quando eu clicar no extrato do mês ele abra em uma janela flutuante") */
    aberta: (() => {
      const i = importacoes.lista.find(x => x.id === aberta);
      return i ? { ...daImportacao(i), linhas: (porImportacao.get(i.id) ?? []).map(linhaDaTela) } : null;
    })(),
    abrir: setAberta,
    fecharJanela: () => setAberta(null),
    /** o primeiro clique pede a confirmação; o segundo desfaz */
    desfazendo,
    async desfazer(id: string) {
      if (desfazendo !== id) { setDesfazendo(id); return; }
      try { await repo.desfazerImportacao(id); toast('Importação desfeita.'); setAberta(null); }
      catch (e) { toast('Não desfiz: ' + (e instanceof Error ? e.message : String(e))); }
      finally { setDesfazendo(null); }
    },
    verNoPainel: () => navegar(caminhoDaPagina('financeiro', 'painel')),
  };
}
