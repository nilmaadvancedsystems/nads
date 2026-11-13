// A Carteira de cada pessoa (12/11/2026): as comissões que ela registra, o controle financeiro pessoal, os holerites e os
// comprovantes que o Financeiro sobe para ela e as contas a pagar que o Financeiro ligou a ela. E, para o Financeiro, as
// comissões do mês de todos (aprovar, recusar, marcar como pagas) e o envio dos documentos. Interface + a versão de
// exemplo (memória); a do banco é carteira.firestore.ts.
import { carteira, financeiro } from '@nads/core';
import type { ListaAoVivo } from './agentes';

export interface DocumentoParaEnviar { uid: string; nome: string; tipo: carteira.TipoDeDocumento; competencia: string; valor: number | null }
export interface ArquivoDaCarteira { nome: string; bytes: Uint8Array }
export type Decisao = 'aprovada' | 'paga' | 'recusada' | 'lancada';

export interface RepoCarteira {
  readonly exemplos: boolean;
  // ── as da pessoa ──
  minhasComissoes(): ListaAoVivo<carteira.Comissao>;
  meusLancamentos(): ListaAoVivo<carteira.Lancamento>;
  meusDocumentos(): ListaAoVivo<carteira.DocumentoDaCarteira>;
  /** as contas a pagar que o Financeiro ligou à pessoa */
  minhasContas(): ListaAoVivo<financeiro.ContaAPagar>;
  /** cria (sem id) ou altera a comissão (só enquanto lançada; o mês do pagamento não muda) */
  salvarComissao(c: carteira.ComissaoParaSalvar, id?: string): Promise<void>;
  /** os serviços comissionados e a % de cada um (o Financeiro define; sem nada gravado, os 9 do começo, sem a %) */
  servicos(): ListaAoVivo<carteira.ServicoComissionado>;
  /** a % própria por pessoa, para todos os serviços dela (no mesmo documento dos serviços; 12/11/2026) */
  porPessoa(): ListaAoVivo<carteira.PercentualDaPessoa>;
  /** quem está na Carteira (o uid, para a % própria) */
  meuUid(): string | null;
  apagarComissao(id: string): Promise<void>;
  salvarLancamento(l: carteira.LancamentoParaSalvar, id?: string): Promise<void>;
  apagarLancamento(id: string): Promise<void>;
  bytesDoDocumento(id: string): Promise<Uint8Array>;
  /** o comprovante de uma conta ligada à pessoa */
  bytesDoComprovante(contaId: string, anexoId: string): Promise<Uint8Array>;
  // ── o Financeiro ──
  comissoesDoMes(competencia: string): ListaAoVivo<carteira.Comissao>;
  documentosDoMes(competencia: string): ListaAoVivo<carteira.DocumentoDaCarteira>;
  decidirComissoes(ids: string[], situacao: Decisao, motivo?: string): Promise<void>;
  /** a comissão que o Financeiro registra para a pessoa (a retroativa, em qualquer mês): já entra aprovada */
  registrarComissaoDe(para: { uid: string; nome: string }, c: carteira.ComissaoParaSalvar): Promise<void>;
  /** porPessoa null: não mexe na % própria (quem não é Diretor nem a vê; Vitor, 13/11/2026) */
  salvarServicos(lista: readonly carteira.ServicoComissionado[], porPessoa: readonly carteira.PercentualDaPessoa[] | null): Promise<void>;
  enviarDocumento(d: DocumentoParaEnviar, arquivo: ArquivoDaCarteira): Promise<void>;
  apagarDocumento(id: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export type QuemNaCarteira = () => { uid: string; nome: string } | null;

const agora = () => new Date().toISOString();
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Nos exemplos: algumas comissões, lançamentos, um holerite e uma conta de salário paga, para quem está; com propria, a % própria de 50% para quem está e uma colega. */
export function criarCarteiraMemoria(quem: QuemNaCarteira, propria = false): RepoCarteira {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const hoje = new Date();
  const mes = carteira.competenciaDe(hoje);
  const antes = carteira.competenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
  const eu = () => quem() ?? { uid: 'uid-exemplo', nome: 'Você' };
  let seq = 0;
  const novoId = (p: string) => p + '-' + Date.now().toString(36) + '-' + ++seq;
  const c = (id: string, uid: string, nome: string, competencia: string, cliente: string, valor: number, situacao: carteira.SituacaoDaComissao): carteira.Comissao => ({
    id, uid, nome, competencia, data: competencia + '-08', cliente, descricao: 'Abertura de MEI', valor, situacao, criadoEm: competencia + '-08T10:00:00.000Z',
    clienteCodigo: null, porte: 'MEI', servico: 'Abertura de MEI', valorServico: valor * 10, percentual: 10,
  });
  let servicos = carteira.servicosPadrao().map((s, i) => ({ ...s, percentual: i < 3 ? 10 : 0 }));
  let porPessoa: carteira.PercentualDaPessoa[] = propria ? [{ uid: eu().uid, nome: eu().nome, percentual: 50 }, { uid: 'uid-clara', nome: 'Clara', percentual: 50 }] : [];
  const comissaoDe = (x: carteira.ComissaoParaSalvar) => ({ ...x, descricao: x.servico, valor: carteira.valorDaComissao(x.valorServico, x.percentual) });
  let comissoes: carteira.Comissao[] = [
    c('c1', eu().uid, eu().nome, mes, 'PADARIA EXEMPLO LTDA', 350, 'lancada'),
    c('c2', eu().uid, eu().nome, mes, 'MERCADO EXEMPLO', 520, 'aprovada'),
    c('c3', eu().uid, eu().nome, antes, 'TRANSPORTES EXEMPLO', 410, 'paga'),
    c('c4', 'uid-clara', 'Clara', mes, 'OFICINA EXEMPLO', 280, 'aprovada'),
    c('c5', 'uid-felipe', 'Felipe', mes, 'FARMÁCIA EXEMPLO', 190, 'lancada'),
  ];
  let lancamentos: carteira.Lancamento[] = [
    { id: 'l1', tipo: 'entrada', data: mes + '-05', descricao: 'Salário', categoria: 'Salário', valor: 3200 },
    { id: 'l2', tipo: 'saida', data: mes + '-06', descricao: 'Aluguel', categoria: 'Moradia', valor: 1100 },
    { id: 'l3', tipo: 'saida', data: mes + '-07', descricao: 'Mercado', categoria: 'Alimentação', valor: 640.35 },
    { id: 'l4', tipo: 'saida', data: mes + '-09', descricao: 'Combustível', categoria: 'Transporte', valor: 280 },
  ];
  const pdf = new TextEncoder().encode('%PDF-1.4 exemplo');
  let documentos: (carteira.DocumentoDaCarteira & { bytes: Uint8Array })[] = [
    { id: 'd1', uid: eu().uid, nome: eu().nome, tipo: 'holerite', competencia: antes, valor: 3200, arquivo: 'holerite-' + antes + '.pdf', tamanho: pdf.length, partes: 1, enviadoEm: antes + '-28T12:00:00.000Z', enviadoPor: 'Financeiro', bytes: pdf },
  ];
  const contas: financeiro.ContaAPagar[] = [{
    id: 'cp1', numero: 7, fornecedorId: 'f', documento: 'Folha ' + antes, emissao: antes + '-28', vencimento: antes + '-30', valor: 3200,
    funcionario: { uid: eu().uid, nome: eu().nome, tipo: 'salario' }, pagamento: { data: antes + '-30', valorPago: 3200, juros: 0, desconto: 0, por: 'Financeiro', em: '' },
    anexos: [{ id: 'a1', tipo: 'comprovante', nome: 'pix-salario.pdf', tamanho: pdf.length, partes: 1, enviadoEm: '', enviadoPor: 'Financeiro' }], lancadoEm: '', lancadoPor: 'Financeiro',
  }];
  const lista = <T,>(l: T[]): ListaAoVivo<T> => ({ carregada: true, lista: l, erro: '' });
  const trocar = (id: string, f: (x: carteira.Comissao) => carteira.Comissao) => { comissoes = comissoes.map(x => (x.id === id ? f(x) : x)); mudou(); };

  return {
    exemplos: true,
    minhasComissoes: () => lista(comissoes.filter(x => x.uid === eu().uid)),
    meusLancamentos: () => lista(lancamentos),
    meusDocumentos: () => lista(documentos.filter(x => x.uid === eu().uid)),
    minhasContas: () => lista(contas.filter(x => x.funcionario?.uid === eu().uid)),
    async salvarComissao(x, id) {
      if (id) trocar(id, o => ({ ...o, ...comissaoDe(x), competencia: o.competencia }));
      else { comissoes = [...comissoes, { ...comissaoDe(x), id: novoId('c'), uid: eu().uid, nome: eu().nome, situacao: 'lancada', criadoEm: agora() }]; mudou(); }
    },
    servicos: () => lista(servicos),
    porPessoa: () => lista(porPessoa),
    meuUid: () => eu().uid,
    async salvarServicos(l, p) { servicos = l.map(s => ({ ...s, percentual: r2(s.percentual) })); if (p) porPessoa = p.map(x => ({ ...x, percentual: r2(x.percentual) })); mudou(); },
    async registrarComissaoDe(para, x) {
      comissoes = [...comissoes, { ...comissaoDe(x), id: novoId('c'), uid: para.uid, nome: para.nome, situacao: 'aprovada', criadoEm: agora(), decididoPor: eu().nome, decididoEm: agora() }];
      mudou();
    },
    async apagarComissao(id) { comissoes = comissoes.filter(x => x.id !== id); mudou(); },
    async salvarLancamento(l, id) {
      lancamentos = id ? lancamentos.map(x => (x.id === id ? { ...l, id } : x)) : [...lancamentos, { ...l, id: novoId('l') }];
      mudou();
    },
    async apagarLancamento(id) { lancamentos = lancamentos.filter(x => x.id !== id); mudou(); },
    async bytesDoDocumento(id) { const d = documentos.find(x => x.id === id); if (!d) throw new Error('O documento não está mais lá.'); return d.bytes; },
    async bytesDoComprovante() { return pdf; },
    comissoesDoMes: competencia => lista(comissoes.filter(x => x.competencia === competencia)),
    documentosDoMes: competencia => lista(documentos.filter(x => x.competencia === competencia)),
    async decidirComissoes(ids, situacao, motivo) {
      for (const id of ids) trocar(id, o => ({ ...o, situacao, decididoPor: eu().nome, decididoEm: agora(), motivo: situacao === 'recusada' ? motivo : undefined, pagoEm: situacao === 'paga' ? agora() : undefined }));
    },
    async enviarDocumento(d, a) {
      documentos = [...documentos, { ...d, id: novoId('d'), arquivo: a.nome, tamanho: a.bytes.length, partes: 1, enviadoEm: agora(), enviadoPor: eu().nome, bytes: a.bytes }];
      mudou();
    },
    async apagarDocumento(id) { documentos = documentos.filter(x => x.id !== id); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
