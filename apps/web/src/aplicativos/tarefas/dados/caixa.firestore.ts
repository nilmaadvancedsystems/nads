// O caixa do escritório no banco do Entregas (19/10/2026), nas regras de lá (o admin e o diretor):
//   - financeiroCaixa/{id}: {data 'AAAA-MM-DD', descricao, valor, tipo 'E'|'S', observacoes?, conta?, origem 'toriba'|'nads',
//     toribaId?, criadoEm, criadoPor, atualizadoEm?, atualizadoPor?}; ao vivo (a coleção toda, uns 3.700 lançamentos);
//   - financeiroPlano/{id}: {codigo, descricao, tipo, nivel, pai, ativo, movimentavel}; ao vivo.
import { financeiro } from '@nads/core';
import { addDoc, collection, deleteDoc as deleteDocBruto, doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import type { RepoCaixa } from './caixa';
import { bancoDoEntregas } from './entregas.firestore';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const addDocGuardado = guardar(addDoc) as typeof addDoc;
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

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Só o admin e o diretor veem o financeiro.' : err.message);

export function criarCaixaFirestore(): RepoCaixa {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let lancamentos: ListaAoVivo<financeiro.LancamentoDeCaixa> | null = null;
  let plano: ListaAoVivo<financeiro.ContaDoPlano> | null = null;

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
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
