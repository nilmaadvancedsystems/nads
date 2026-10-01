// O acesso ao nads no banco do Entregas (com o login de lá):
//   config/nads                     { protecaoLogin }  — a proteção do login (só o admin grava)
//   nadsPedidos/{id}                o pedido de liberação de um login (a pessoa cria; o admin aprova ou recusa)
//   nadsPedidos/{id}/codigo/atual   { codigo }         — o código de 6 dígitos (só o admin lê e grava)
//   nadsSessoes/{uid}_{authTime}    o login liberado (a pessoa cria com o código; as regras conferem; o admin revoga:
//                                   a sessão some, o pedido vira 'revogado' e o código é apagado)
//   usuarios/{uid}                  a equipe: departamento, nível, papéis (roles) e ativo (só o admin grava)
// As regras do Entregas (firestore.rules) só deixam ler e gravar os dados do nads (rotinas, cadastro) com o login
// liberado, quando a proteção está ligada; o admin não precisa de liberação.
import { usuarios as u } from '@nads/core';
import { addDoc, collection, doc, onSnapshot, orderBy, query, setDoc, Timestamp, updateDoc, where, writeBatch, limit } from 'firebase/firestore';
import type { RepoAcesso } from './acesso';
import { bancoDoEntregas, horaDoLogin } from './entregas.firestore';

type Quem = { uid: string; nome: string; email: string; admin: boolean } | null;

export function criarAcessoFirestore(quem: () => Quem): RepoAcesso {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  let config = { carregada: false, protecao: false };
  let sessao = { carregada: false, liberada: false };
  let pedido: u.PedidoDeLiberacao | null = null;
  let pendentes: u.PedidoDeLiberacao[] = [];
  let sessoes: u.SessaoLiberada[] = [];
  let equipe: { carregada: boolean; lista: u.Usuario[]; docs: Record<string, u.DocUsuario> } = { carregada: false, lista: [], docs: {} };
  let authTime = '';
  let ouvindoDe = '';
  const paradas: (() => void)[] = [];

  /** Começa a ouvir o que é da pessoa logada (e, se for admin, o que é do admin); troca quando a pessoa troca. */
  function ouvir() {
    const q = quem();
    const chave = q ? q.uid + (q.admin ? ':admin' : '') : '';
    if (chave === ouvindoDe) return;
    ouvindoDe = chave;
    paradas.splice(0).forEach(f => f());
    sessao = { carregada: false, liberada: false };
    pedido = null;
    if (!q) return;
    paradas.push(onSnapshot(doc(db, 'config', 'nads'), s => { config = { carregada: true, protecao: (s.data() || {}).protecaoLogin === true }; mudou(); },
      () => { config = { carregada: true, protecao: false }; mudou(); }));
    horaDoLogin().then(t => {
      authTime = t;
      if (!t) { sessao = { carregada: true, liberada: false }; mudou(); return; }
      paradas.push(onSnapshot(doc(db, 'nadsSessoes', u.idDaSessao(q.uid, t)), s => { sessao = { carregada: true, liberada: s.exists() }; mudou(); },
        () => { sessao = { carregada: true, liberada: false }; mudou(); }));
      paradas.push(onSnapshot(query(collection(db, 'nadsPedidos'), where('uid', '==', q.uid), where('authTime', '==', t)), s => {
        const lista = s.docs.map(d => u.pedidoDoDocumento(d.id, d.data())).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
        pedido = lista[0] || null;
        mudou();
      }, () => {}));
    });
    if (q.admin) {
      paradas.push(onSnapshot(query(collection(db, 'nadsPedidos'), where('status', '==', 'pendente')), s => {
        pendentes = s.docs.map(d => u.pedidoDoDocumento(d.id, d.data())).filter(p => !u.pedidoVencido(p)).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
        mudou();
      }, () => {}));
      paradas.push(onSnapshot(query(collection(db, 'nadsSessoes'), orderBy('liberadoEm', 'desc'), limit(300)), s => {
        sessoes = s.docs.map(d => u.sessaoDoDocumento(d.id, d.data()));
        mudou();
      }, () => {}));
    }
    paradas.push(onSnapshot(collection(db, 'usuarios'), s => {
      const docs: Record<string, u.DocUsuario> = {};
      s.docs.forEach(d => { docs[d.id] = d.data() as u.DocUsuario; });
      equipe = { carregada: true, lista: Object.entries(docs).map(([id, d]) => u.lerUsuario(id, d)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), docs };
      mudou();
    }, () => { equipe = { carregada: true, lista: [], docs: {} }; mudou(); }));
  }

  const eu = () => { const q = quem(); if (!q) throw new Error('entre com a conta do Entregas'); return q; };

  return {
    exemplos: false,
    config: () => { ouvir(); return config; },
    async gravarProtecao(ligada) {
      const q = eu();
      await setDoc(doc(db, 'config', 'nads'), { protecaoLogin: ligada, atualizadoEm: new Date().toISOString(), atualizadoPor: q.nome }, { merge: true });
    },
    minhaSessao: () => { ouvir(); return sessao; },
    meuPedido: () => { ouvir(); return pedido; },
    async pedir(computador) {
      const q = eu();
      const t = authTime || await horaDoLogin();
      await addDoc(collection(db, 'nadsPedidos'), { uid: q.uid, nome: q.nome, email: q.email, computador, authTime: t, status: 'pendente', criadoEm: new Date().toISOString() });
    },
    async confirmar(codigo) {
      const q = eu();
      const t = authTime || await horaDoLogin();
      if (!pedido || pedido.status !== 'aprovado') throw new Error('o pedido ainda não foi aprovado');
      if (u.codigoVencido(pedido)) throw new Error('o código venceu');
      await setDoc(doc(db, 'nadsSessoes', u.idDaSessao(q.uid, t)), {
        uid: q.uid, nome: q.nome, email: q.email, computador: pedido.computador, pedidoId: pedido.id, codigo: u.codigoDigitado(codigo), liberadoEm: new Date().toISOString(),
      });
    },
    pendentes: () => { ouvir(); return pendentes; },
    async aprovar(p) {
      const q = eu();
      const codigo = u.codigoNovo();
      const b = writeBatch(db);
      b.set(doc(db, 'nadsPedidos', p.id, 'codigo', 'atual'), { codigo });
      b.update(doc(db, 'nadsPedidos', p.id), {
        status: 'aprovado', aprovadoPor: q.nome, aprovadoEm: new Date().toISOString(),
        // o código só vale por um tempo (as regras conferem com a hora do servidor)
        validoAte: Timestamp.fromMillis(Date.now() + u.PRAZO_DO_CODIGO_MS),
      });
      await b.commit();
      return codigo;
    },
    async recusar(p) {
      const q = eu();
      await updateDoc(doc(db, 'nadsPedidos', p.id), { status: 'recusado', aprovadoPor: q.nome, aprovadoEm: new Date().toISOString() });
    },
    sessoes: () => { ouvir(); return sessoes; },
    async revogar(s) {
      const q = eu();
      const b = writeBatch(db);
      b.delete(doc(db, 'nadsSessoes', s.id));
      // o código daquele pedido deixa de valer: para entrar de novo, outro pedido e outro código
      if (s.pedidoId) {
        b.update(doc(db, 'nadsPedidos', s.pedidoId), { status: 'revogado', revogadoPor: q.nome, revogadoEm: new Date().toISOString() });
        b.delete(doc(db, 'nadsPedidos', s.pedidoId, 'codigo', 'atual'));
      }
      await b.commit();
    },
    equipe: () => { ouvir(); return equipe; },
    async salvarCargo(uid, departamento, nivel) {
      const atual = equipe.docs[uid];
      if (!atual) throw new Error('pessoa não encontrada');
      await updateDoc(doc(db, 'usuarios', uid), u.mudancaDeCargo(atual, departamento, nivel));
    },
    async salvarPapeis(uid, papeis) { await updateDoc(doc(db, 'usuarios', uid), { roles: papeis }); },
    async ativar(uid, ativo) { await updateDoc(doc(db, 'usuarios', uid), { ativo }); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
