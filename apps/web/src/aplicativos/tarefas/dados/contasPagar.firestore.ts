// As contas a pagar no banco do Entregas (28/10/2026: "o Contas a Pagar do Toriba, no nads"), nas regras de lá (o admin e
// o diretor):
//   - financeiroFornecedores/{id}: {razaoSocial, nomeFantasia, documento (só os dígitos), contaPadrao?, ativo, criadoEm?,
//     criadoPor?, atualizadoEm?, atualizadoPor?}; os que vieram do Toriba têm o id toriba-<n>; ao vivo;
//   - financeiroContasPagar/{id}: {numero, fornecedorId, conta?, documento, emissao, vencimento, valor, linhaDigitavel?,
//     observacoes?, recorrencia?: {grupo, parcela, de}, pagamento?: {data, valorPago, juros, desconto, lancamentoId?, por,
//     em}, anexos: [{id, tipo 'boleto'|'comprovante', nome, tamanho, partes, enviadoEm, enviadoPor}], lancadoEm, lancadoPor,
//     atualizadoEm?, atualizadoPor?}; ao vivo;
//   - financeiroContasPagar/{id}/anexos/{anexo}: {tipo, nome, tamanho, partes, enviadoEm, enviadoPor} e
//     .../anexos/{anexo}/partes/{n}: {dados: Bytes} (os pedaços do arquivo, como o envio do Drive; lidos só ao abrir).
import { entregas as e, financeiro } from '@nads/core';
import {
  Bytes, collection, deleteDoc as deleteDocBruto, deleteField, doc, getDocs, onSnapshot, setDoc as setDocBruto, updateDoc as updateDocBruto,
  writeBatch as writeBatchBruto,
} from 'firebase/firestore';
import { guardar, guardarLote } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import type { RepoContasPagar } from './contasPagar';
import { bancoDoEntregas } from './entregas.firestore';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;
const texto = (v: unknown) => (v == null ? '' : String(v));
const numero = (v: unknown) => Number(v) || 0;
const centavos = (v: number) => Math.round(v * 100) / 100;
const objeto = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);

function fornecedorDoBanco(id: string, d: Record<string, unknown>): financeiro.Fornecedor {
  return {
    id, razaoSocial: texto(d.razaoSocial), nomeFantasia: texto(d.nomeFantasia), documento: texto(d.documento).replace(/\D/g, ''),
    contaPadrao: texto(d.contaPadrao) || undefined, ativo: d.ativo !== false,
    criadoEm: texto(d.criadoEm) || undefined, criadoPor: texto(d.criadoPor) || undefined, atualizadoEm: texto(d.atualizadoEm) || undefined, atualizadoPor: texto(d.atualizadoPor) || undefined,
  };
}

function anexoDoBanco(v: unknown): financeiro.AnexoDaConta | null {
  const a = objeto(v);
  if (!a || !a.id) return null;
  return {
    id: texto(a.id), tipo: a.tipo === 'comprovante' ? 'comprovante' : 'boleto', nome: texto(a.nome) || 'arquivo', tamanho: numero(a.tamanho), partes: numero(a.partes),
    enviadoEm: texto(a.enviadoEm), enviadoPor: texto(a.enviadoPor),
  };
}

function contaDoBanco(id: string, d: Record<string, unknown>): financeiro.ContaAPagar {
  const r = objeto(d.recorrencia), p = objeto(d.pagamento);
  return {
    id, numero: numero(d.numero), fornecedorId: texto(d.fornecedorId), conta: texto(d.conta) || undefined, documento: texto(d.documento),
    emissao: texto(d.emissao), vencimento: texto(d.vencimento), valor: numero(d.valor), linhaDigitavel: texto(d.linhaDigitavel) || undefined,
    observacoes: texto(d.observacoes) || undefined,
    recorrencia: r ? { grupo: texto(r.grupo), parcela: numero(r.parcela), de: numero(r.de) } : undefined,
    pagamento: p ? {
      data: texto(p.data), valorPago: numero(p.valorPago), juros: numero(p.juros), desconto: numero(p.desconto), lancamentoId: texto(p.lancamentoId) || undefined,
      por: texto(p.por), em: texto(p.em),
    } : undefined,
    anexos: Array.isArray(d.anexos) ? d.anexos.map(anexoDoBanco).filter((a): a is financeiro.AnexoDaConta => !!a) : [],
    lancadoEm: texto(d.lancadoEm), lancadoPor: texto(d.lancadoPor), atualizadoEm: texto(d.atualizadoEm) || undefined, atualizadoPor: texto(d.atualizadoPor) || undefined,
  };
}

/** o anexo como vai para o banco (sem campo vazio) */
const anexoParaOBanco = (a: financeiro.AnexoDaConta) => ({ id: a.id, tipo: a.tipo, nome: a.nome, tamanho: a.tamanho, partes: a.partes, enviadoEm: a.enviadoEm, enviadoPor: a.enviadoPor });

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Só o admin e o diretor veem o financeiro.' : err.message);

export function criarContasPagarFirestore(): RepoContasPagar {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let fornecedores: ListaAoVivo<financeiro.Fornecedor> | null = null;
  let contas: ListaAoVivo<financeiro.ContaAPagar> | null = null;
  const lista = () => contas?.lista ?? [];
  const partesDe = (id: string, anexoId: string) => collection(db, 'financeiroContasPagar', id, 'anexos', anexoId, 'partes');

  /** apaga os pedaços e o documento do anexo */
  async function apagarAnexo(id: string, anexoId: string) {
    const partes = await getDocs(partesDe(id, anexoId));
    const b = writeBatch(db);
    for (const x of partes.docs) b.delete(x.ref);
    b.delete(doc(db, 'financeiroContasPagar', id, 'anexos', anexoId));
    await b.commit();
  }

  return {
    exemplos: false,
    fornecedores() {
      if (!fornecedores) {
        fornecedores = { carregada: false, lista: [], erro: '' };
        onSnapshot(collection(db, 'financeiroFornecedores'), s => {
          const nome = (f: financeiro.Fornecedor) => financeiro.nomeDoFornecedor(f);
          fornecedores = { carregada: true, lista: s.docs.map(x => fornecedorDoBanco(x.id, x.data())).sort((a, b) => nome(a).localeCompare(nome(b), 'pt-BR')), erro: '' };
          mudou();
        }, err => { fornecedores = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return fornecedores;
    },
    contas() {
      if (!contas) {
        contas = { carregada: false, lista: [], erro: '' };
        onSnapshot(collection(db, 'financeiroContasPagar'), s => {
          contas = { carregada: true, lista: s.docs.map(x => contaDoBanco(x.id, x.data())).sort(financeiro.porVencimento), erro: '' };
          mudou();
        }, err => { contas = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return contas;
    },
    async salvarFornecedor(r, quem) {
      const agora = new Date().toISOString();
      const base = {
        razaoSocial: r.razaoSocial.trim(), nomeFantasia: r.nomeFantasia.trim(), documento: r.documento.replace(/\D/g, ''), ativo: r.ativo,
        ...(r.contaPadrao ? { contaPadrao: r.contaPadrao } : {}),
      };
      if (r.id) {
        // a alteração não apaga o que veio do Toriba (criadoEm, se houver): só muda os campos da tela
        await updateDoc(doc(db, 'financeiroFornecedores', r.id), { ...base, ...(r.contaPadrao ? {} : { contaPadrao: deleteField() }), atualizadoEm: agora, atualizadoPor: quem });
        return r.id;
      }
      const ref = doc(collection(db, 'financeiroFornecedores'));
      await setDoc(ref, { ...base, criadoEm: agora, criadoPor: quem });
      return ref.id;
    },
    async criarContas(rs, quem) {
      const agora = new Date().toISOString();
      let n = financeiro.proximoNumero(lista()) - 1;
      const b = writeBatch(db);
      const ids: string[] = [];
      for (const r of rs) {
        const ref = doc(collection(db, 'financeiroContasPagar'));
        ids.push(ref.id);
        b.set(ref, {
          numero: ++n, fornecedorId: r.fornecedorId, documento: r.documento.trim(), emissao: r.emissao, vencimento: r.vencimento, valor: centavos(r.valor),
          ...(r.conta ? { conta: r.conta } : {}), ...(r.linhaDigitavel ? { linhaDigitavel: r.linhaDigitavel } : {}),
          ...(r.observacoes?.trim() ? { observacoes: r.observacoes.trim() } : {}), ...(r.recorrencia ? { recorrencia: { ...r.recorrencia } } : {}),
          anexos: [], lancadoEm: agora, lancadoPor: quem,
        });
      }
      await b.commit();
      return ids;
    },
    async alterarConta(r, quem) {
      await updateDoc(doc(db, 'financeiroContasPagar', r.id), {
        fornecedorId: r.fornecedorId, documento: r.documento.trim(), emissao: r.emissao, vencimento: r.vencimento, valor: centavos(r.valor),
        conta: r.conta || deleteField(), linhaDigitavel: r.linhaDigitavel || deleteField(), observacoes: r.observacoes?.trim() || deleteField(),
        atualizadoEm: new Date().toISOString(), atualizadoPor: quem,
      });
    },
    async definirPagamento(id, p) {
      await updateDoc(doc(db, 'financeiroContasPagar', id), {
        pagamento: p ? {
          data: p.data, valorPago: centavos(p.valorPago), juros: centavos(p.juros), desconto: centavos(p.desconto),
          ...(p.lancamentoId ? { lancamentoId: p.lancamentoId } : {}), por: p.por, em: p.em,
        } : deleteField(),
      });
    },
    async excluirContas(ids) {
      for (const id of ids) {
        for (const a of lista().find(x => x.id === id)?.anexos ?? []) await apagarAnexo(id, a.id);
        await deleteDoc(doc(db, 'financeiroContasPagar', id));
      }
    },
    async anexar(id, a, quem) {
      const conta = lista().find(x => x.id === id);
      if (!conta) throw new Error('A conta não está mais aqui.');
      const ref = doc(collection(db, 'financeiroContasPagar', id, 'anexos'));
      const partes = e.partesDoArquivo(a.bytes);
      const anexo: financeiro.AnexoDaConta = {
        id: ref.id, tipo: a.tipo, nome: e.nomeParaEnviar(a.nome), tamanho: a.bytes.length, partes: partes.length, enviadoEm: new Date().toISOString(), enviadoPor: quem,
      };
      try {
        // os pedaços primeiro; o documento do anexo e a lista da conta só depois que tudo subiu
        for (let i = 0; i < partes.length; i++) await setDoc(doc(ref, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
        await setDoc(ref, { tipo: anexo.tipo, nome: anexo.nome, tamanho: anexo.tamanho, partes: anexo.partes, enviadoEm: anexo.enviadoEm, enviadoPor: anexo.enviadoPor });
        await updateDoc(doc(db, 'financeiroContasPagar', id), { anexos: [...conta.anexos, anexo].map(anexoParaOBanco) });
      } catch (err) {
        await apagarAnexo(id, ref.id).catch(() => undefined);
        throw err;
      }
      return anexo;
    },
    async tirarAnexo(id, anexoId) {
      const conta = lista().find(x => x.id === id);
      if (conta) await updateDoc(doc(db, 'financeiroContasPagar', id), { anexos: conta.anexos.filter(a => a.id !== anexoId).map(anexoParaOBanco) });
      await apagarAnexo(id, anexoId);
    },
    async bytesDoAnexo(id, anexoId) {
      const s = await getDocs(partesDe(id, anexoId));
      const pedacos = s.docs.sort((a, b) => Number(a.id) - Number(b.id)).map(x => (x.data().dados as Bytes).toUint8Array());
      if (!pedacos.length) throw new Error('O anexo não está mais no banco.');
      const tudo = new Uint8Array(pedacos.reduce((t, p) => t + p.length, 0));
      let k = 0;
      for (const p of pedacos) { tudo.set(p, k); k += p.length; }
      return tudo;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
