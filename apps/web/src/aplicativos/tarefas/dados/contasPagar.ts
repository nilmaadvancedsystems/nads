// As contas a pagar do escritório (28/10/2026: "o Contas a Pagar do Toriba, no nads"): os fornecedores
// (financeiroFornecedores) e as contas (financeiroContasPagar, com os anexos em pedaços), no banco do Entregas. Só o
// admin e o diretor. O pagamento cria a saída no Caixa (pela tela, como o Receber dos Honorários). Interface + a versão
// de exemplo; a do banco é contasPagar.firestore.ts.
import { financeiro } from '@nads/core';
import type { ListaAoVivo } from './agentes';

/** o que a tela manda gravar de um fornecedor: sem id é novo */
export type RascunhoDeFornecedor = Pick<financeiro.Fornecedor, 'razaoSocial' | 'nomeFantasia' | 'documento' | 'contaPadrao' | 'ativo'> & { id?: string };

/** o que a tela manda gravar de uma conta: sem id é nova; o ID da tela, o Auditor e os anexos o repositório guarda */
export interface RascunhoDaConta {
  id?: string;
  fornecedorId: string;
  conta?: string;
  documento: string;
  emissao: string;
  vencimento: string;
  valor: number;
  linhaDigitavel?: string;
  observacoes?: string;
  recorrencia?: financeiro.RecorrenciaDaConta;
}

/** o arquivo que a tela anexa (o PDF do boleto ou o comprovante) */
export interface ArquivoParaAnexar { nome: string; bytes: Uint8Array; tipo: financeiro.TipoDeAnexo }

export interface RepoContasPagar {
  readonly exemplos: boolean;
  /** os fornecedores (ao vivo), por nome */
  fornecedores(): ListaAoVivo<financeiro.Fornecedor>;
  /** as contas (ao vivo), por vencimento */
  contas(): ListaAoVivo<financeiro.ContaAPagar>;
  /** cria (sem id) ou altera; devolve o id */
  salvarFornecedor(f: RascunhoDeFornecedor, quem: string): Promise<string>;
  /** cria as contas novas de uma vez (as parcelas da recorrência), com o ID da tela em seguida; devolve os ids, na ordem */
  criarContas(rs: RascunhoDaConta[], quem: string): Promise<string[]>;
  /** altera a conta (os campos da tela; o pagamento e os anexos ficam) */
  alterarConta(r: RascunhoDaConta & { id: string }, quem: string): Promise<void>;
  /** grava o pagamento (null tira: desfazer); quem chama cria ou apaga a saída do Caixa */
  definirPagamento(id: string, p: financeiro.PagamentoDaConta | null): Promise<void>;
  /** apaga as contas e os anexos delas */
  excluirContas(ids: string[]): Promise<void>;
  /** sobe o arquivo em pedaços e o põe na conta; devolve o anexo */
  anexar(id: string, a: ArquivoParaAnexar, quem: string): Promise<financeiro.AnexoDaConta>;
  /** tira o anexo da conta e apaga os pedaços */
  tirarAnexo(id: string, anexoId: string): Promise<void>;
  /** os bytes do anexo, para abrir ou baixar */
  bytesDoAnexo(id: string, anexoId: string): Promise<Uint8Array>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

const AGORA = () => new Date().toISOString();
const DIA = (dias: number) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
const porNome = (a: financeiro.Fornecedor, b: financeiro.Fornecedor) => (a.nomeFantasia || a.razaoSocial).localeCompare(b.nomeFantasia || b.razaoSocial, 'pt-BR');

/** Nos exemplos: três fornecedores e algumas contas (uma vencida, uma que vence hoje, uma paga e três parcelas). */
export function criarContasPagarMemoria(): RepoContasPagar {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const f = (id: string, razaoSocial: string, nomeFantasia: string, documento: string, contaPadrao?: string): financeiro.Fornecedor =>
    ({ id, razaoSocial, nomeFantasia, documento, contaPadrao, ativo: true, criadoEm: AGORA(), criadoPor: 'Exemplo' });
  // a conta 5.1.01 do plano de exemplo do Caixa (dados/caixa.ts) é p5101
  let fornecedores: financeiro.Fornecedor[] = [
    f('toriba-1', 'PAPELARIA EXEMPLO LTDA', 'Papelaria Exemplo', '11222333000181', 'p5101'),
    f('toriba-2', 'COMPANHIA DE ENERGIA EXEMPLO SA', 'Energia Exemplo', '33444555000102'),
    f('toriba-3', 'IMOBILIARIA EXEMPLO LTDA', 'Aluguel Exemplo', '66777888000103'),
  ];
  const c = (id: string, numero: number, fornecedorId: string, dias: number, valor: number, extra: Partial<financeiro.ContaAPagar> = {}): financeiro.ContaAPagar =>
    ({ id, numero, fornecedorId, documento: String(1000 + numero), emissao: DIA(-20), vencimento: DIA(dias), valor, anexos: [], lancadoEm: AGORA(), lancadoPor: 'Exemplo', ...extra });
  let contas: financeiro.ContaAPagar[] = [
    c('exp-1', 1, 'toriba-2', -3, 310.45, { observacoes: 'Conta de luz (EXEMPLO)' }),
    c('exp-2', 2, 'toriba-1', 0, 212.9, { conta: 'p5101' }),
    c('exp-3', 3, 'toriba-1', -10, 80, { conta: 'p5101', pagamento: { data: DIA(-11), valorPago: 80, juros: 0, desconto: 0, por: 'Exemplo', em: AGORA() } }),
    ...[0, 1, 2].map(k => c('exp-' + (4 + k), 4 + k, 'toriba-3', 5 + k * 30, 1800, { recorrencia: { grupo: 'exg-1', parcela: k + 1, de: 3 } })),
  ];
  const bytes = new Map<string, Uint8Array>();
  const trocar = (id: string, mudar: (x: financeiro.ContaAPagar) => financeiro.ContaAPagar) => { contas = contas.map(x => (x.id === id ? mudar(x) : x)); mudou(); };
  let seq = 0;
  return {
    exemplos: true,
    fornecedores: () => ({ carregada: true, lista: [...fornecedores].sort(porNome), erro: '' }),
    contas: () => ({ carregada: true, lista: [...contas].sort(financeiro.porVencimento), erro: '' }),
    async salvarFornecedor(r, quem) {
      const id = r.id || 'ex-f' + Date.now();
      const antes = fornecedores.find(x => x.id === id);
      const novo: financeiro.Fornecedor = {
        id, razaoSocial: r.razaoSocial.trim(), nomeFantasia: r.nomeFantasia.trim(), documento: r.documento.replace(/\D/g, ''), contaPadrao: r.contaPadrao || undefined, ativo: r.ativo,
        criadoEm: antes?.criadoEm ?? AGORA(), criadoPor: antes?.criadoPor ?? quem, ...(antes ? { atualizadoEm: AGORA(), atualizadoPor: quem } : {}),
      };
      fornecedores = antes ? fornecedores.map(x => (x.id === id ? novo : x)) : [...fornecedores, novo];
      mudou();
      return id;
    },
    async criarContas(rs, quem) {
      let numero = financeiro.proximoNumero(contas) - 1;
      const novas = rs.map((r): financeiro.ContaAPagar => ({
        id: 'ex-c' + Date.now() + '-' + ++seq, numero: ++numero, fornecedorId: r.fornecedorId, conta: r.conta || undefined, documento: r.documento.trim(), emissao: r.emissao,
        vencimento: r.vencimento, valor: r.valor, linhaDigitavel: r.linhaDigitavel || undefined, observacoes: r.observacoes?.trim() || undefined, recorrencia: r.recorrencia,
        anexos: [], lancadoEm: AGORA(), lancadoPor: quem,
      }));
      contas = [...contas, ...novas];
      mudou();
      return novas.map(x => x.id);
    },
    async alterarConta(r, quem) {
      trocar(r.id, x => ({
        ...x, fornecedorId: r.fornecedorId, conta: r.conta || undefined, documento: r.documento.trim(), emissao: r.emissao, vencimento: r.vencimento, valor: r.valor,
        linhaDigitavel: r.linhaDigitavel || undefined, observacoes: r.observacoes?.trim() || undefined, atualizadoEm: AGORA(), atualizadoPor: quem,
      }));
    },
    async definirPagamento(id, p) { trocar(id, x => ({ ...x, pagamento: p ?? undefined })); },
    async excluirContas(ids) {
      for (const x of contas.filter(y => ids.includes(y.id))) for (const a of x.anexos) bytes.delete(x.id + '/' + a.id);
      contas = contas.filter(x => !ids.includes(x.id));
      mudou();
    },
    async anexar(id, a, quem) {
      const anexo: financeiro.AnexoDaConta = { id: 'ex-a' + Date.now() + '-' + ++seq, tipo: a.tipo, nome: a.nome, tamanho: a.bytes.length, partes: 1, enviadoEm: AGORA(), enviadoPor: quem };
      bytes.set(id + '/' + anexo.id, a.bytes);
      trocar(id, x => ({ ...x, anexos: [...x.anexos, anexo] }));
      return anexo;
    },
    async tirarAnexo(id, anexoId) { bytes.delete(id + '/' + anexoId); trocar(id, x => ({ ...x, anexos: x.anexos.filter(a => a.id !== anexoId) })); },
    async bytesDoAnexo(id, anexoId) {
      const b = bytes.get(id + '/' + anexoId);
      if (!b) throw new Error('O anexo não está mais aqui.');
      return b;
    },
    assinar(fn) { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; },
    versao: () => ver,
  };
}
