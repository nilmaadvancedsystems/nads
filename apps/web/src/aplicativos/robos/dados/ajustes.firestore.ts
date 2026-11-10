// As configurações da Central no banco do Entregas. Regras:
//   config/fgts, cobranca, caixasGmail, roboIgnorados, indiceDrive, integracoes, avisoCertificados  os MESMOS documentos que o
//     robô e os outros sites usam: lê só os campos da lista fechada (robos/ajustes.ts) e grava com merge só o que mudou, para
//     o resto do documento (modelos de e-mail, endereço do serviço de contas, ...) não ser nem visto pela tela nem tocado
//   config/robosHorarios, config/robosAlertas   da central; o robô lê
//   robosPermissoes/{uid}                       quem pode o quê; só o admin grava, e o robô confere de novo antes de executar
// A tela nunca grava nada do robô além disso; as gravações passam pela trava do modo desenvolvedor e pelo disjuntor.
import { robos as r } from '@nads/core';
import { arrayRemove, arrayUnion, collection, deleteDoc as deleteDocBruto, doc, getDoc, getDocs, setDoc as setDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas, contaDoEntregas } from '../../tarefas/dados/entregas.firestore';
import type { PessoaDaEquipe, RepoAjustes, ValoresDoGrupo } from './ajustes';

const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

const carimbo = (por: string) => ({ atualizadoEm: new Date().toISOString(), atualizadoPor: por });

export function criarAjustesFirestore(): RepoAjustes {
  const db = bancoDoEntregas();
  const config = (id: string) => doc(db, 'config', id);

  return {
    exemplos: false,
    async minhaPermissao(eu) {
      if (eu.admin) return r.TODA_PERMISSAO;
      const conta = contaDoEntregas();
      if (!conta) return r.SEM_PERMISSAO;
      const s = await getDoc(doc(db, 'robosPermissoes', conta.uid));
      return s.exists() ? r.lerPermissao(s.data()) : r.SEM_PERMISSAO;
    },
    async lerAjustes() {
      const pares = await Promise.all(r.AJUSTES.map(async g => [g.doc, r.lerValores(g, (await getDoc(config(g.doc))).data())] as const));
      return Object.fromEntries(pares);
    },
    async gravarAjuste(g, antes: ValoresDoGrupo, agora: ValoresDoGrupo, por) {
      const mudancas = r.mudancasDoGrupo(g, antes, agora);
      // as listas de e-mail entram e saem item a item: outro site pode ter acrescentado um endereço enquanto a tela estava aberta
      const listas = g.campos.filter(c => c.tipo === 'lista-emails' && c.campo in mudancas);
      const simples = Object.fromEntries(Object.entries(mudancas).filter(([k]) => !listas.some(c => c.campo === k)));
      const ref = config(g.doc);
      if (Object.keys(simples).length) await setDoc(ref, { ...r.gravacaoDoAjuste(g, simples), ...carimbo(por) }, { merge: true });
      for (const c of listas) {
        const erro = r.validarAjuste(c, agora[c.campo]);
        if (erro) throw new Error(c.nome + ': ' + erro);
        const antigos = antes[c.campo] as string[];
        const novos = agora[c.campo] as string[];
        const entram = novos.filter(x => !antigos.includes(x));
        const saem = antigos.filter(x => !novos.includes(x));
        if (entram.length) await setDoc(ref, { [c.campo]: arrayUnion(...entram), ...carimbo(por) }, { merge: true });
        if (saem.length) await setDoc(ref, { [c.campo]: arrayRemove(...saem), ...carimbo(por) }, { merge: true });
      }
    },
    lerHorarios: async () => r.lerHorarios((await getDoc(config('robosHorarios'))).data()),
    async gravarHorario(robo, h, por) {
      const qual = r.ROBOS_COM_HORARIO.find(x => x.id === robo);
      const erro = qual ? r.validarHorario(qual, h) : 'Este robô não aceita horário.';
      if (erro) throw new Error(erro);
      // troca o robô inteiro (o merge comum deixaria um intervalo antigo para trás); os outros robôs não são tocados
      await setDoc(config('robosHorarios'), { robos: { [robo]: h }, ...carimbo(por) }, { mergeFields: ['robos.' + robo, 'atualizadoEm', 'atualizadoPor'] });
    },
    lerAlertas: async () => r.lerAlertas((await getDoc(config('robosAlertas'))).data()),
    async gravarAlertas(a, por) {
      const erro = r.validarAlertas(a);
      if (erro) throw new Error(erro);
      await setDoc(config('robosAlertas'), { ...a, ...carimbo(por) });
    },
    async pessoas() {
      const s = await getDocs(collection(db, 'usuarios'));
      const saida: PessoaDaEquipe[] = [];
      for (const d of s.docs) {
        const u = d.data();
        if (u.ativo === false) continue;
        // só isto sai daqui (o cadastro também guarda os aparelhos para o aviso no celular)
        saida.push({ uid: d.id, nome: String(u.nome || u.email || d.id), email: String(u.email || ''), admin: Array.isArray(u.roles) && u.roles.includes('admin') });
      }
      return saida.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    async lerPermissoes() {
      const s = await getDocs(collection(db, 'robosPermissoes'));
      return Object.fromEntries(s.docs.map(d => [d.id, r.lerPermissao(d.data())]));
    },
    async gravarPermissao(uid, p, por) {
      const erro = r.validarPermissao(p);
      if (erro) throw new Error(erro);
      const ref = doc(db, 'robosPermissoes', uid);
      if (!p.papel) { await deleteDoc(ref); return; }
      await setDoc(ref, { papel: p.papel, robos: p.papel === 'comandar' ? p.robos : [], ...carimbo(por) });
    },
  };
}
