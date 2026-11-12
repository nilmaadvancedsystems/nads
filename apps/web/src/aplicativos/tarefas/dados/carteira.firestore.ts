// A Carteira no banco do Entregas (12/11/2026), nas regras de lá:
//   - carteiraComissoes/{id}: {uid, nome, competencia, data, cliente, descricao, valor, situacao, criadoEm, decididoPor?,
//     decididoEm?, motivo?, pagoEm?, clienteCodigo, porte, servico, valorServico, percentual} — a pessoa lê as dela, cria
//     lançada (no mês seguinte) e mexe enquanto está lançada; o Financeiro lê todas, decide (aprova, recusa, paga) e
//     registra a de qualquer pessoa, em qualquer mês, já aprovada (a retroativa; 12/11/2026);
//   - carteiraConfig/servicos: {lista: [{id, nome, percentual}], atualizadoEm, atualizadoPor} — os serviços comissionados e a %
//     de cada um; todos leem, o Financeiro grava (12/11/2026); porPessoa: [{uid, nome, percentual}] — a % própria da pessoa,
//     para todos os serviços dela (12/11/2026; só vai quando há alguém, para a regra de antes continuar aceitando);
//   - usuarios/{uid}/carteiraLancamentos/{id}: {tipo, data, descricao, categoria, valor} — as finanças pessoais: só a dona
//     (nem o admin, como as Anotações);
//   - carteiraDocumentos/{id}: {uid, nome, tipo 'holerite'|'comprovante', competencia, valor, arquivo, tamanho, partes,
//     enviadoEm, enviadoPor} e .../partes/{n}: {dados: Bytes, uid} — o Financeiro sobe; a pessoa só lê os dela;
//   - financeiroContasPagar com funcionario.uid = a pessoa: as contas que o Financeiro ligou a ela (ela lê a conta e os
//     anexos; ver contasPagar.firestore.ts).
import { carteira, entregas as e, financeiro } from '@nads/core';
import {
  addDoc as addDocBruto, Bytes, collection, deleteDoc as deleteDocBruto, doc, getDocs, onSnapshot, query, setDoc as setDocBruto,
  updateDoc as updateDocBruto, where, writeBatch as writeBatchBruto, type Unsubscribe,
} from 'firebase/firestore';
import { guardar, guardarLote } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import type { QuemNaCarteira, RepoCarteira } from './carteira';
import { contaDoBanco } from './contasPagar.firestore';
import { bancoDoEntregas } from './entregas.firestore';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardar(addDocBruto) as typeof addDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;

const texto = (v: unknown) => (v == null ? '' : String(v));
const numero = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);
const centavos = (n: number) => Math.round(n * 100) / 100;
const SITUACOES: readonly carteira.SituacaoDaComissao[] = ['lancada', 'aprovada', 'paga', 'recusada'];
const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Sem permissão no banco (as regras da Carteira já foram publicadas?).' : err.message);

function comissaoDoBanco(id: string, d: Record<string, unknown>): carteira.Comissao {
  return {
    id, uid: texto(d.uid), nome: texto(d.nome), competencia: texto(d.competencia), data: texto(d.data), cliente: texto(d.cliente), descricao: texto(d.descricao),
    valor: numero(d.valor), situacao: SITUACOES.includes(d.situacao as carteira.SituacaoDaComissao) ? (d.situacao as carteira.SituacaoDaComissao) : 'lancada',
    criadoEm: texto(d.criadoEm), decididoPor: texto(d.decididoPor) || undefined, decididoEm: texto(d.decididoEm) || undefined,
    motivo: texto(d.motivo) || undefined, pagoEm: texto(d.pagoEm) || undefined,
    clienteCodigo: typeof d.clienteCodigo === 'number' ? d.clienteCodigo : null, porte: carteira.PORTES.includes(d.porte as carteira.Porte) ? (d.porte as carteira.Porte) : null,
    servico: texto(d.servico) || undefined, valorServico: typeof d.valorServico === 'number' ? d.valorServico : undefined, percentual: typeof d.percentual === 'number' ? d.percentual : undefined,
  };
}
function servicosDoBanco(d: Record<string, unknown> | undefined): carteira.ServicoComissionado[] {
  const l = Array.isArray(d?.lista) ? (d!.lista as Record<string, unknown>[]) : null;
  if (!l) return carteira.servicosPadrao();
  return l.map(x => ({ id: texto(x.id), nome: texto(x.nome), percentual: numero(x.percentual) })).filter(x => x.id && x.nome);
}
function porPessoaDoBanco(d: Record<string, unknown> | undefined): carteira.PercentualDaPessoa[] {
  const l = Array.isArray(d?.porPessoa) ? (d!.porPessoa as Record<string, unknown>[]) : [];
  return l.map(x => ({ uid: texto(x.uid), nome: texto(x.nome), percentual: numero(x.percentual) })).filter(x => x.uid && x.percentual > 0);
}
/** os campos da comissão no banco (a descrição é o nome do serviço; o valor sai do valor do serviço × a %) */
const camposDaComissao = (c: carteira.ComissaoParaSalvar) => ({
  data: c.data, cliente: c.cliente.trim(), clienteCodigo: c.clienteCodigo, porte: c.clienteCodigo == null ? c.porte : null,
  servico: c.servico, descricao: c.servico, valorServico: centavos(c.valorServico), percentual: c.percentual, valor: carteira.valorDaComissao(c.valorServico, c.percentual),
});
function lancamentoDoBanco(id: string, d: Record<string, unknown>): carteira.Lancamento {
  return { id, tipo: d.tipo === 'entrada' ? 'entrada' : 'saida', data: texto(d.data), descricao: texto(d.descricao), categoria: texto(d.categoria) || 'Outros', valor: numero(d.valor) };
}
function documentoDoBanco(id: string, d: Record<string, unknown>): carteira.DocumentoDaCarteira {
  return {
    id, uid: texto(d.uid), nome: texto(d.nome), tipo: d.tipo === 'comprovante' ? 'comprovante' : 'holerite', competencia: texto(d.competencia),
    valor: typeof d.valor === 'number' ? d.valor : null, arquivo: texto(d.arquivo) || 'arquivo', tamanho: numero(d.tamanho), partes: numero(d.partes),
    enviadoEm: texto(d.enviadoEm), enviadoPor: texto(d.enviadoPor),
  };
}
const porData = (a: { data: string }, b: { data: string }) => b.data.localeCompare(a.data);

async function juntarPedacos(caminho: ReturnType<typeof collection>): Promise<Uint8Array> {
  const s = await getDocs(caminho);
  const pedacos = s.docs.sort((a, b) => Number(a.id) - Number(b.id)).map(x => (x.data().dados as Bytes).toUint8Array());
  if (!pedacos.length) throw new Error('O arquivo não está mais no banco.');
  const todo = new Uint8Array(pedacos.reduce((t, p) => t + p.length, 0));
  let k = 0;
  for (const p of pedacos) { todo.set(p, k); k += p.length; }
  return todo;
}

export function criarCarteiraFirestore(quem: QuemNaCarteira): RepoCarteira {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const vazia = <T,>(): ListaAoVivo<T> => ({ carregada: false, lista: [], erro: '' });

  // as da pessoa: ouvidas uma vez por login (trocou de conta, recomeça)
  let de = '';
  let paradas: Unsubscribe[] = [];
  let comissoes = vazia<carteira.Comissao>();
  let lancamentos = vazia<carteira.Lancamento>();
  let documentos = vazia<carteira.DocumentoDaCarteira>();
  let contas = vazia<financeiro.ContaAPagar>();
  function ouvirAsMinhas() {
    const q = quem();
    const uid = q?.uid || '';
    if (uid === de) return;
    de = uid;
    paradas.forEach(f => f());
    paradas = [];
    comissoes = vazia(); lancamentos = vazia(); documentos = vazia(); contas = vazia();
    if (!uid) return;
    const falha = (onde: (e: string) => void) => (err: Error) => { onde(erroDe(err)); mudou(); };
    paradas.push(onSnapshot(query(collection(db, 'carteiraComissoes'), where('uid', '==', uid)), s => {
      comissoes = { carregada: true, lista: s.docs.map(x => comissaoDoBanco(x.id, x.data())).sort(porData), erro: '' }; mudou();
    }, falha(m => { comissoes = { carregada: true, lista: [], erro: m }; })));
    paradas.push(onSnapshot(collection(db, 'usuarios', uid, 'carteiraLancamentos'), s => {
      lancamentos = { carregada: true, lista: s.docs.map(x => lancamentoDoBanco(x.id, x.data())).sort(porData), erro: '' }; mudou();
    }, falha(m => { lancamentos = { carregada: true, lista: [], erro: m }; })));
    paradas.push(onSnapshot(query(collection(db, 'carteiraDocumentos'), where('uid', '==', uid)), s => {
      documentos = { carregada: true, lista: s.docs.map(x => documentoDoBanco(x.id, x.data())).sort((a, b) => b.competencia.localeCompare(a.competencia) || b.enviadoEm.localeCompare(a.enviadoEm)), erro: '' }; mudou();
    }, falha(m => { documentos = { carregada: true, lista: [], erro: m }; })));
    paradas.push(onSnapshot(query(collection(db, 'financeiroContasPagar'), where('funcionario.uid', '==', uid)), s => {
      contas = { carregada: true, lista: s.docs.map(x => contaDoBanco(x.id, x.data())), erro: '' }; mudou();
    }, falha(m => { contas = { carregada: true, lista: [], erro: m }; })));
  }

  // o Financeiro: as do mês, ouvidas quando a tela pede (uma escuta por mês)
  const doMes = new Map<string, ListaAoVivo<carteira.Comissao>>();
  const docsDoMes = new Map<string, ListaAoVivo<carteira.DocumentoDaCarteira>>();
  function comissoesDoMes(c: string) {
    if (!doMes.has(c)) {
      doMes.set(c, vazia());
      onSnapshot(query(collection(db, 'carteiraComissoes'), where('competencia', '==', c)), s => {
        doMes.set(c, { carregada: true, lista: s.docs.map(x => comissaoDoBanco(x.id, x.data())).sort(porData), erro: '' }); mudou();
      }, err => { doMes.set(c, { carregada: true, lista: [], erro: erroDe(err) }); mudou(); });
    }
    return doMes.get(c)!;
  }
  function documentosDoMes(c: string) {
    if (!docsDoMes.has(c)) {
      docsDoMes.set(c, vazia());
      onSnapshot(query(collection(db, 'carteiraDocumentos'), where('competencia', '==', c)), s => {
        docsDoMes.set(c, { carregada: true, lista: s.docs.map(x => documentoDoBanco(x.id, x.data())).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), erro: '' }); mudou();
      }, err => { docsDoMes.set(c, { carregada: true, lista: [], erro: erroDe(err) }); mudou(); });
    }
    return docsDoMes.get(c)!;
  }

  // os serviços comissionados: um documento só, ouvido quando a tela pede
  let servicos = vazia<carteira.ServicoComissionado>();
  let porPessoa = vazia<carteira.PercentualDaPessoa>();
  let ouvindoServicos = false;
  function ouvirServicos() {
    if (ouvindoServicos) return;
    ouvindoServicos = true;
    onSnapshot(doc(db, 'carteiraConfig', 'servicos'), s => {
      servicos = { carregada: true, lista: servicosDoBanco(s.data()), erro: '' };
      porPessoa = { carregada: true, lista: porPessoaDoBanco(s.data()), erro: '' };
      mudou();
    }, err => {
      servicos = { carregada: true, lista: carteira.servicosPadrao(), erro: erroDe(err) };
      porPessoa = { carregada: true, lista: [], erro: erroDe(err) };
      mudou();
    });
  }

  const precisa = () => { const q = quem(); if (!q) throw new Error('Entre com a conta do Entregas.'); return q; };

  return {
    exemplos: false,
    minhasComissoes: () => { ouvirAsMinhas(); return comissoes; },
    meusLancamentos: () => { ouvirAsMinhas(); return lancamentos; },
    meusDocumentos: () => { ouvirAsMinhas(); return documentos; },
    minhasContas: () => { ouvirAsMinhas(); return contas; },
    async salvarComissao(c, id) {
      const q = precisa();
      // o mês do pagamento fica o de quando foi registrada (a pessoa não troca)
      if (id) await updateDoc(doc(db, 'carteiraComissoes', id), camposDaComissao(c));
      else await addDoc(collection(db, 'carteiraComissoes'), { ...camposDaComissao(c), competencia: c.competencia, uid: q.uid, nome: q.nome, situacao: 'lancada', criadoEm: new Date().toISOString() });
    },
    servicos: () => { ouvirServicos(); return servicos; },
    porPessoa: () => { ouvirServicos(); return porPessoa; },
    meuUid: () => quem()?.uid ?? null,
    async salvarServicos(lista, pessoas) {
      const q = precisa();
      await setDoc(doc(db, 'carteiraConfig', 'servicos'), {
        lista: lista.map(s => ({ id: s.id, nome: s.nome.trim(), percentual: centavos(s.percentual) })), atualizadoEm: new Date().toISOString(), atualizadoPor: q.nome,
        ...(pessoas.length ? { porPessoa: pessoas.map(p => ({ uid: p.uid, nome: p.nome, percentual: centavos(p.percentual) })) } : {}),
      });
    },
    async registrarComissaoDe(para, c) {
      const q = precisa();
      const em = new Date().toISOString();
      await addDoc(collection(db, 'carteiraComissoes'), {
        ...camposDaComissao(c), competencia: c.competencia, uid: para.uid, nome: para.nome, situacao: 'aprovada', criadoEm: em, decididoPor: q.nome, decididoEm: em,
      });
    },
    async apagarComissao(id) { await deleteDoc(doc(db, 'carteiraComissoes', id)); },
    async salvarLancamento(l, id) {
      const q = precisa();
      const campos = { tipo: l.tipo, data: l.data, descricao: l.descricao.trim(), categoria: l.categoria || 'Outros', valor: centavos(l.valor) };
      if (id) await setDoc(doc(db, 'usuarios', q.uid, 'carteiraLancamentos', id), campos);
      else await addDoc(collection(db, 'usuarios', q.uid, 'carteiraLancamentos'), campos);
    },
    async apagarLancamento(id) { await deleteDoc(doc(db, 'usuarios', precisa().uid, 'carteiraLancamentos', id)); },
    bytesDoDocumento: id => juntarPedacos(collection(db, 'carteiraDocumentos', id, 'partes')),
    bytesDoComprovante: (contaId, anexoId) => juntarPedacos(collection(db, 'financeiroContasPagar', contaId, 'anexos', anexoId, 'partes')),
    comissoesDoMes,
    documentosDoMes,
    async decidirComissoes(ids, situacao, motivo) {
      const q = precisa();
      const b = writeBatch(db);
      const em = new Date().toISOString();
      for (const id of ids) {
        b.update(doc(db, 'carteiraComissoes', id), situacao === 'lancada'
          ? { situacao, decididoPor: q.nome, decididoEm: em, motivo: '', pagoEm: '' }
          : { situacao, decididoPor: q.nome, decididoEm: em, motivo: situacao === 'recusada' ? (motivo || '').trim().slice(0, 300) : '', pagoEm: situacao === 'paga' ? em : '' });
      }
      await b.commit();
    },
    async enviarDocumento(d, a) {
      const q = precisa();
      if (a.bytes.length > carteira.LIMITE_DO_DOCUMENTO) throw new Error('O arquivo passa de 10 MB.');
      const ref = doc(collection(db, 'carteiraDocumentos'));
      const partes = e.partesDoArquivo(a.bytes);
      try {
        // os pedaços primeiro; o documento só depois que tudo subiu (antes disso a pessoa não vê nada)
        for (let i = 0; i < partes.length; i++) await setDoc(doc(ref, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]), uid: d.uid });
        await setDoc(ref, {
          uid: d.uid, nome: d.nome, tipo: d.tipo, competencia: d.competencia, valor: d.valor == null ? null : centavos(d.valor),
          arquivo: e.nomeParaEnviar(a.nome), tamanho: a.bytes.length, partes: partes.length, enviadoEm: new Date().toISOString(), enviadoPor: q.nome,
        });
      } catch (err) {
        await this.apagarDocumento(ref.id).catch(() => undefined);
        throw err;
      }
    },
    async apagarDocumento(id) {
      const partes = await getDocs(collection(db, 'carteiraDocumentos', id, 'partes'));
      const b = writeBatch(db);
      for (const x of partes.docs) b.delete(x.ref);
      b.delete(doc(db, 'carteiraDocumentos', id));
      await b.commit();
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
