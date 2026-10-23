// O caixa do escritório no banco do Entregas (19/10/2026), nas regras de lá (o admin e o diretor):
//   - financeiroCaixa/{id}: {data 'AAAA-MM-DD', descricao, valor, tipo 'E'|'S', observacoes?, conta?, origem 'toriba'|'nads',
//     toribaId?, criadoEm, criadoPor, atualizadoEm?, atualizadoPor?}; ao vivo (a coleção toda, uns 3.700 lançamentos);
//   - financeiroPlano/{id}: {codigo, descricao, tipo, nivel, pai, ativo, movimentavel}; ao vivo;
//   - financeiroBanco/{id}: o extrato do banco (23/10/2026, à parte do Caixa) {data, historico, valor, tipo, banco,
//     importacao}; o id é fixo (core financeiro.linhasDoExtrato), então o mesmo extrato não duplica; ao vivo;
//   - financeiroBancoImportacoes/{id}: {banco, arquivo, de, ate, quantos, entradas, saidas, saldoFinal?, importadoEm,
//     importadoPor}; ao vivo.
import { financeiro } from '@nads/core';
import { addDoc, collection, deleteDoc as deleteDocBruto, doc, onSnapshot, setDoc as setDocBruto, writeBatch as writeBatchBruto } from 'firebase/firestore';
import { guardar, guardarLote } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import type { RepoCaixa } from './caixa';
import { bancoDoEntregas } from './entregas.firestore';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const addDocGuardado = guardar(addDoc) as typeof addDoc;
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;
/** o lote do Firestore cabe 500 gravações; com folga */
const POR_LOTE = 400;
const texto = (v: unknown) => (v == null ? '' : String(v));
const TIPOS = financeiro.TIPOS_DE_CONTA.map(t => t.valor);

function lancamentoDoBanco(id: string, d: Record<string, unknown>): financeiro.LancamentoDeCaixa {
  return {
    id, data: texto(d.data), descricao: texto(d.descricao), valor: Number(d.valor) || 0, tipo: d.tipo === 'S' ? 'S' : 'E',
    observacoes: texto(d.observacoes) || undefined, conta: texto(d.conta) || undefined,
    origem: d.origem === 'toriba' ? 'toriba' : 'nads', toribaId: typeof d.toribaId === 'number' ? d.toribaId : undefined,
    criadoEm: texto(d.criadoEm), criadoPor: texto(d.criadoPor),
    atualizadoEm: texto(d.atualizadoEm) || undefined, atualizadoPor: texto(d.atualizadoPor) || undefined,
  };
}

function contaDoBanco(id: string, d: Record<string, unknown>): financeiro.ContaDoPlano {
  const codigo = texto(d.codigo);
  return {
    id, codigo, descricao: texto(d.descricao), tipo: (TIPOS.includes(d.tipo as financeiro.TipoDeConta) ? d.tipo : 'OUTROS') as financeiro.TipoDeConta,
    nivel: Number(d.nivel) || financeiro.nivelDoCodigo(codigo), pai: d.pai ? texto(d.pai) : null, ativo: d.ativo !== false, movimentavel: d.movimentavel !== false,
  };
}

function linhaDoBanco(id: string, d: Record<string, unknown>): financeiro.LancamentoDoBanco {
  return {
    id, data: texto(d.data), historico: texto(d.historico), valor: Number(d.valor) || 0, tipo: d.tipo === 'S' ? 'S' : 'E', banco: texto(d.banco) || 'Banco', importacao: texto(d.importacao),
    contaBancaria: texto(d.contaBancaria) || undefined, conta: texto(d.conta) || undefined,
  };
}

function importacaoDoBanco(id: string, d: Record<string, unknown>): financeiro.ImportacaoDeExtrato {
  return {
    id, banco: texto(d.banco) || 'Banco', marca: texto(d.marca) || undefined, contaBancaria: texto(d.contaBancaria) || undefined, conta: texto(d.conta) || undefined,
    rotuloDaConta: texto(d.rotuloDaConta) || undefined, arquivo: texto(d.arquivo), de: texto(d.de), ate: texto(d.ate), quantos: Number(d.quantos) || 0,
    entradas: Number(d.entradas) || 0, saidas: Number(d.saidas) || 0, saldoFinal: typeof d.saldoFinal === 'number' ? d.saldoFinal : undefined,
    importadoEm: texto(d.importadoEm), importadoPor: texto(d.importadoPor),
  };
}

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Só o admin e o diretor veem o financeiro.' : err.message);

export function criarCaixaFirestore(): RepoCaixa {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lancamentos: ListaAoVivo<financeiro.LancamentoDeCaixa> | null = null;
  let plano: ListaAoVivo<financeiro.ContaDoPlano> | null = null;
  let extrato: ListaAoVivo<financeiro.LancamentoDoBanco> | null = null;
  let importacoes: ListaAoVivo<financeiro.ImportacaoDeExtrato> | null = null;

  return {
    exemplos: false,
    lancamentos() {
      if (!lancamentos) {
        lancamentos = { carregada: false, lista: [], erro: '' };
        onSnapshot(collection(db, 'financeiroCaixa'), s => {
          lancamentos = { carregada: true, lista: s.docs.map(x => lancamentoDoBanco(x.id, x.data())).sort(financeiro.porDataEId), erro: '' };
          mudou();
        }, err => { lancamentos = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return lancamentos;
    },
    plano() {
      if (!plano) {
        plano = { carregada: false, lista: [], erro: '' };
        onSnapshot(collection(db, 'financeiroPlano'), s => {
          plano = { carregada: true, lista: s.docs.map(x => contaDoBanco(x.id, x.data())).sort((a, b) => financeiro.compararCodigos(a.codigo, b.codigo)), erro: '' };
          mudou();
        }, err => { plano = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return plano;
    },
    async salvarLancamento(r, quem) {
      const agora = new Date().toISOString();
      const anterior = r.id ? lancamentos?.lista.find(x => x.id === r.id) : undefined;
      // sem campos vazios no banco; na alteração guarda de onde veio e quem criou
      const base = {
        data: r.data, descricao: r.descricao.trim(), valor: Math.round(r.valor * 100) / 100, tipo: r.tipo,
        ...(r.observacoes?.trim() ? { observacoes: r.observacoes.trim() } : {}),
        ...(r.conta ? { conta: r.conta } : {}),
      };
      if (r.id && anterior) {
        await setDoc(doc(db, 'financeiroCaixa', r.id), {
          ...base, origem: anterior.origem, ...(anterior.toribaId != null ? { toribaId: anterior.toribaId } : {}),
          criadoEm: anterior.criadoEm, criadoPor: anterior.criadoPor, atualizadoEm: agora, atualizadoPor: quem,
        });
        return r.id;
      }
      const novo = { ...base, origem: 'nads', criadoEm: agora, criadoPor: quem };
      if (r.id) { await setDoc(doc(db, 'financeiroCaixa', r.id), novo); return r.id; }
      return (await addDocGuardado(collection(db, 'financeiroCaixa'), novo)).id;
    },
    async excluirLancamento(id) { await deleteDoc(doc(db, 'financeiroCaixa', id)); },
    async salvarConta(r) {
      const dados = { codigo: r.codigo.trim(), descricao: r.descricao.trim(), tipo: r.tipo, nivel: r.nivel, pai: r.pai, ativo: r.ativo, movimentavel: r.movimentavel };
      if (r.id) { await setDoc(doc(db, 'financeiroPlano', r.id), dados); return r.id; }
      return (await addDocGuardado(collection(db, 'financeiroPlano'), dados)).id;
    },
    extrato() {
      if (!extrato) {
        extrato = { carregada: false, lista: [], erro: '' };
        onSnapshot(collection(db, 'financeiroBanco'), s => {
          extrato = { carregada: true, lista: s.docs.map(x => linhaDoBanco(x.id, x.data())).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id)), erro: '' };
          mudou();
        }, err => { extrato = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return extrato;
    },
    importacoes() {
      if (!importacoes) {
        importacoes = { carregada: false, lista: [], erro: '' };
        onSnapshot(collection(db, 'financeiroBancoImportacoes'), s => {
          importacoes = { carregada: true, lista: s.docs.map(x => importacaoDoBanco(x.id, x.data())).sort((a, b) => b.importadoEm.localeCompare(a.importadoEm)), erro: '' };
          mudou();
        }, err => { importacoes = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return importacoes;
    },
    async importarExtrato(i, linhas, quem) {
      // só as linhas que ainda não estão no banco (a lista ao vivo já está carregada: a tela mostra as repetidas antes)
      const ja = new Set((extrato?.lista ?? []).map(x => x.id));
      const novas = linhas.filter(x => !ja.has(x.id));
      for (let k = 0; k < novas.length; k += POR_LOTE) {
        const b = writeBatch(db);
        for (const l of novas.slice(k, k + POR_LOTE)) {
          b.set(doc(db, 'financeiroBanco', l.id), {
            data: l.data, historico: l.historico, valor: l.valor, tipo: l.tipo, banco: l.banco, importacao: l.importacao,
            ...(l.contaBancaria ? { contaBancaria: l.contaBancaria } : {}), ...(l.conta ? { conta: l.conta } : {}),
          });
        }
        await b.commit();
      }
      await setDoc(doc(db, 'financeiroBancoImportacoes', i.id), {
        banco: i.banco, ...(i.marca ? { marca: i.marca } : {}), ...(i.contaBancaria ? { contaBancaria: i.contaBancaria } : {}), ...(i.conta ? { conta: i.conta } : {}),
        ...(i.rotuloDaConta ? { rotuloDaConta: i.rotuloDaConta } : {}), arquivo: i.arquivo, de: i.de, ate: i.ate, quantos: novas.length, entradas: i.entradas, saidas: i.saidas,
        ...(i.saldoFinal != null ? { saldoFinal: i.saldoFinal } : {}), importadoEm: new Date().toISOString(), importadoPor: quem,
      });
      return { novas: novas.length, repetidas: linhas.length - novas.length };
    },
    async desfazerImportacao(id) {
      const delas = (extrato?.lista ?? []).filter(x => x.importacao === id);
      for (let k = 0; k < delas.length; k += POR_LOTE) {
        const b = writeBatch(db);
        for (const l of delas.slice(k, k + POR_LOTE)) b.delete(doc(db, 'financeiroBanco', l.id));
        await b.commit();
      }
      await deleteDoc(doc(db, 'financeiroBancoImportacoes', id));
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
