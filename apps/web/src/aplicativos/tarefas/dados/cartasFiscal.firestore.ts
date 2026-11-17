// Fiscal › Cartas no banco do Entregas (12/11/2026), sem coleção nova:
//   - solicitacoesEmail { tipo: 'cartaBalanco', status: 'pendente', departamento: 'fiscal', codigo, empresa, ano, prazo, teste,
//     criadoEm, criadoPor, criadoPorEmail, criadoPorUid, origem: 'nads' }: a tela cria (como o pedido do Mandei e do DP ›
//     Envios); o vigia (robo/cartas-fiscal.js) manda e grava status 'enviado' (para, assunto, enviadoEm) ou 'erro';
//   - solicitacoesEmail { tipo: 'checklistMensal' }: o robô grava; a tela só lê os do mês aberto;
//   - config/checklistMensal { ligado, fora: [códigos], atualizadoEm, atualizadoPor }: a tela grava (como o config/envioFiscal).
// Só igualdade nas consultas (tipo e ano, tipo e competência): sem índice novo. Só ouve o que a tela pede.
import { addDoc as addDocBruto, collection, doc, onSnapshot, query, setDoc as setDocBruto, where } from 'firebase/firestore';
import { cartasFiscal as cf, entregas as e } from '@nads/core';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';
import { bancoDoEntregas } from './entregas.firestore';
import { registroDoBanco, type Lista, type RepoCartasFiscal } from './cartasFiscal';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;

export function criarCartasFiscalFirestore(quem: () => e.Quem | null): RepoCartasFiscal {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const cartas = new Map<number, Lista<cf.RegistroDoEnvio>>();
  const checklist = new Map<string, Lista<cf.RegistroDoEnvio>>();
  let config: { carregado: boolean } & cf.ConfigDoChecklist = { carregado: false, ligado: true, fora: [] };
  let ouvindoConfig = false;

  function ouvir<K>(mapa: Map<K, Lista<cf.RegistroDoEnvio>>, chave: K, campo: 'ano' | 'competencia', tipo: string) {
    if (!mapa.has(chave)) {
      mapa.set(chave, { carregados: false, lista: [] });
      onSnapshot(query(collection(db, 'solicitacoesEmail'), where('tipo', '==', tipo), where(campo, '==', chave)), s => {
        mapa.set(chave, { carregados: true, lista: s.docs.map(x => registroDoBanco(x.id, x.data())) });
        mudou();
      }, () => { mapa.set(chave, { carregados: true, lista: [] }); mudou(); });
    }
    return mapa.get(chave)!;
  }

  return {
    exemplos: false,
    cartas: ano => ouvir(cartas, ano, 'ano', 'cartaBalanco'),
    async pedirCartas(p) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      const agora = new Date();
      const lista = p.teste ? p.clientes.slice(0, 1) : p.clientes;
      for (const c of lista) {
        await addDoc(collection(db, 'solicitacoesEmail'), cf.pedidoDaCarta({ codigo: c.codigo, empresa: c.empresa, ano: p.ano, prazo: p.prazo, teste: p.teste, quem: q, agora }));
      }
      return lista.length;
    },
    checklist: competencia => ouvir(checklist, competencia, 'competencia', 'checklistMensal'),
    config() {
      if (!ouvindoConfig) {
        ouvindoConfig = true;
        onSnapshot(doc(db, 'config', 'checklistMensal'), s => { config = { carregado: true, ...cf.configDoChecklist(s.data()) }; mudou(); },
          () => { config = { carregado: true, ligado: true, fora: [] }; mudou(); });
      }
      return config;
    },
    async gravarConfig(c) {
      const q = quem();
      if (!q) throw new Error('Sem login.');
      const limpo = cf.configDoChecklist(c);
      await setDoc(doc(db, 'config', 'checklistMensal'), { ligado: limpo.ligado, fora: limpo.fora, atualizadoEm: new Date().toISOString(), atualizadoPor: q.nome });
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
