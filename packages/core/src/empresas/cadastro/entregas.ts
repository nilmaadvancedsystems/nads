// Os bancos do cliente que o Entregas já sabe (Pendências): o robô aprende pelo Drive e pelos extratos que
// chegam por e-mail. No Entregas: clientes/{id}.bancos (ids como 'sicoob', 'bb') e, desde 30/09/2026,
// clientes/{id}.contasBancarias ([{ banco, agencia, conta }], lidas do cabeçalho dos extratos). O cliente é
// achado pelo código do ERP (codigoOrigem). Aqui: traduzir para as contas do Cadastro e comparar.
import { idDaConta } from '../bancos';
import { nomeDoBanco } from './regras';
import type { CadastroDaEmpresa, ContaBancaria } from './tipos';

/** Os ids de banco do Entregas (bancos-nilma.js) que são diferentes no nads. */
const MARCA_DO_ENTREGAS: Record<string, string> = { bb: 'banco-do-brasil', mercadopago: 'mercado-pago' };

export const marcaDoEntregas = (id: string) => MARCA_DO_ENTREGAS[id] || id;

/** O que o Entregas sabe dos bancos de um cliente. */
export interface BancosDoEntregas {
  /** os bancos (marcas do nads) */
  bancos: string[];
  /** as contas com agência e conta (marca do nads) */
  contas: { marca: string; agencia: string; conta: string }[];
}

const texto = (v: unknown) => (v == null ? '' : String(v).trim());

/** O documento clientes/{id} do Entregas, só o que interessa (null = sem banco nenhum). */
export function bancosDoEntregasDoDocumento(doc: Record<string, unknown> | null | undefined): BancosDoEntregas | null {
  if (!doc) return null;
  const bancos = Array.isArray(doc.bancos) ? [...new Set(doc.bancos.map(texto).filter(Boolean).map(marcaDoEntregas))] : [];
  const contas = Array.isArray(doc.contasBancarias)
    ? (doc.contasBancarias as Record<string, unknown>[])
      .map(c => ({ marca: marcaDoEntregas(texto(c?.banco)), agencia: texto(c?.agencia), conta: texto(c?.conta) }))
      .filter(c => c.marca && c.agencia && c.conta)
    : [];
  if (!bancos.length && !contas.length) return null;
  return { bancos, contas };
}

/** Os clientes do Entregas por código do ERP (só os ativos e com código). */
export function bancosDoEntregasPorCodigo(docs: readonly Record<string, unknown>[]): Map<number, BancosDoEntregas> {
  const m = new Map<number, BancosDoEntregas>();
  for (const d of docs) {
    const codigo = Number(texto(d.codigoOrigem));
    if (!Number.isInteger(codigo) || codigo <= 0 || d.ativo === false) continue;
    const b = bancosDoEntregasDoDocumento(d);
    if (b) m.set(codigo, b);
  }
  return m;
}

/** As contas do Entregas como contas do Cadastro: as com número, e os bancos sem conta conhecida (só o banco). */
export function contasDoEntregas(e: BancosDoEntregas | null | undefined): ContaBancaria[] {
  if (!e) return [];
  const lista: ContaBancaria[] = [];
  for (const c of e.contas) {
    const id = idDaConta(c.marca, c.agencia, c.conta);
    if (!lista.some(x => x.id === id)) lista.push({ id, marca: c.marca, nome: nomeDoBanco(c.marca), agencia: c.agencia, conta: c.conta });
  }
  for (const marca of e.bancos) {
    if (!lista.some(x => x.marca === marca)) lista.push({ id: marca, marca, nome: nomeDoBanco(marca) });
  }
  return lista;
}

const numeros = (s?: string) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
/** A mesma conta (banco, agência e conta, sem pontuação nem zeros à esquerda)? */
export const mesmaConta = (a: Pick<ContaBancaria, 'marca' | 'agencia' | 'conta'>, b: Pick<ContaBancaria, 'marca' | 'agencia' | 'conta'>) =>
  a.marca === b.marca && !!numeros(a.conta) && numeros(a.agencia) === numeros(b.agencia) && numeros(a.conta) === numeros(b.conta);

/** Uma sugestão do Entregas para uma empresa que já tem os bancos cadastrados. */
export interface SugestaoDoEntregas {
  /** 'nova' = conta que o cadastro não tem; 'completar' = o banco está no cadastro sem agência e conta */
  tipo: 'nova' | 'completar';
  conta: ContaBancaria;
  /** a conta do cadastro que ganha a agência e a conta (tipo 'completar') */
  id?: string;
}

/**
 * O que o Entregas sabe e o cadastro não tem. Conta com número que já está no cadastro não aparece; banco sem
 * número que o cadastro já tem (com ou sem número) também não.
 */
export function sugestoesDoEntregas(c: CadastroDaEmpresa, e: BancosDoEntregas | null | undefined): SugestaoDoEntregas[] {
  const bancos = c.bancos || [];
  const sugestoes: SugestaoDoEntregas[] = [];
  for (const conta of contasDoEntregas(e)) {
    if (conta.conta) {
      if (bancos.some(b => mesmaConta(b, conta))) continue;
      const semNumero = bancos.find(b => b.marca === conta.marca && !b.conta && !sugestoes.some(s => s.id === b.id));
      sugestoes.push(semNumero ? { tipo: 'completar', conta, id: semNumero.id } : { tipo: 'nova', conta });
    } else if (!bancos.some(b => b.marca === conta.marca)) {
      sugestoes.push({ tipo: 'nova', conta });
    }
  }
  return sugestoes;
}

/**
 * Junta o que o Entregas sabe ao ponto de partida (empresa sem bancos cadastrados): o banco que já está (da
 * lista provisória ou do Extrator) ganha a agência e a conta, se não tinha; o que falta entra no fim.
 */
export function juntarComEntregas(partida: readonly ContaBancaria[], e: BancosDoEntregas | null | undefined): ContaBancaria[] {
  const lista = partida.map(b => ({ ...b }));
  for (const conta of contasDoEntregas(e)) {
    if (conta.conta) {
      if (lista.some(b => mesmaConta(b, conta))) continue;
      const semNumero = lista.find(b => b.marca === conta.marca && !b.conta);
      if (semNumero) { semNumero.agencia = conta.agencia; semNumero.conta = conta.conta; continue; }
      lista.push(conta);
    } else if (!lista.some(b => b.marca === conta.marca)) {
      lista.push(conta);
    }
  }
  return lista;
}

// ─── o contato (e-mail e telefone) que o Entregas já tem do cliente ─────────

/** O e-mail e o WhatsApp do cliente no Entregas (os mesmos do "Pedir extratos"). */
export interface ContatoDoEntregas { email: string; whatsapp: string }

/**
 * O contato de cada cliente do Entregas por código do ERP (Vitor, 08/10/2026: "já tenho no mínimo 1 canal de comunicação no
 * cadastro"): o primeiro e-mail (email ou a lista emails) e o telefone só com os números (10 a 13 dígitos; senão, nenhum).
 * Só os ativos e com código; sem e-mail e sem telefone, fica de fora.
 */
export function contatosDoEntregasPorCodigo(docs: readonly Record<string, unknown>[]): Map<number, ContatoDoEntregas> {
  const m = new Map<number, ContatoDoEntregas>();
  for (const d of docs) {
    const codigo = Number(texto(d.codigoOrigem));
    if (!Number.isInteger(codigo) || codigo <= 0 || d.ativo === false) continue;
    const emails = [d.email, ...(Array.isArray(d.emails) ? d.emails : [])].map(e => texto(e).toLowerCase()).filter(e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    const fone = texto(d.telefone).replace(/\D/g, '');
    const whatsapp = fone.length >= 10 && fone.length <= 13 ? fone : '';
    if (emails[0] || whatsapp) m.set(codigo, { email: emails[0] || '', whatsapp });
  }
  return m;
}
