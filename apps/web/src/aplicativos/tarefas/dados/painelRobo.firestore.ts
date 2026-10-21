// O painel do robô no banco do Entregas (21/10/2026; só leitura; as regras deixam só o admin e o diretor):
//   robo/painelPC e robo/painelVM  o batimento de cada robô (robo/painel.js): ouvidos enquanto a tela está aberta (mudam
//                                  uma vez por minuto);
//   roboAtividade                  as 150 linhas mais novas, ouvidas (cada coisa que o robô faz é uma linha);
//   robo/arquivador e robo/estado  o sinal de vida de antes do painel, lido de minuto em minuto só enquanto o robô ainda
//                                  não publica o painel (o robo/estado muda a cada 2 s durante a leitura do Gmail: ouvir
//                                  ao vivo gastaria leitura à toa). Quem não pode ler fica sem o sinal, sem erro.
import { entregas as e } from '@nads/core';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { RepoPainelRobo } from './painelRobo';
import { bancoDoEntregas } from './entregas.firestore';

const QUANTAS_ATIVIDADES = 150;
const SINAL_A_CADA_MS = 60 * 1000;
type Obj = Record<string, unknown>;
const texto = (v: unknown) => (v == null ? '' : String(v));

export function criarPainelRoboFirestore(): RepoPainelRobo {
  const db = bancoDoEntregas();
  let docs: e.DocsDoPainelRobo = { carregado: false, semPermissao: false, pc: null, vm: null, sinais: { pc: null, vm: null }, atividades: [] };
  let ver = 0;
  let quantos = 0;
  let parar: (() => void) | null = null;
  const chegou = { pc: false, vm: false, atividade: false };
  const ouvintes = new Set<() => void>();
  const mudou = (parcial: Partial<e.DocsDoPainelRobo>) => {
    docs = { ...docs, ...parcial, carregado: chegou.pc && chegou.vm && chegou.atividade };
    ver++;
    for (const f of ouvintes) f();
  };
  const negado = (qual: 'pc' | 'vm' | 'atividade') => () => { chegou[qual] = true; mudou({ semPermissao: true }); };

  async function lerSinaisAntigos() {
    const ler = async (id: string) => { try { const s = await getDoc(doc(db, 'robo', id)); return s.exists() ? s.data() as Obj : null; } catch { return null; } };
    const sinais = { ...docs.sinais };
    if (!docs.pc) {
      const a = await ler('arquivador');
      sinais.pc = a ? { em: texto(a.em), maquina: texto(a.pc), desligadoEm: a.situacao === 'desligado' ? texto(a.desligadoEm) : '' } : null;
    }
    if (!docs.vm) {
      const v = (await ler('estado'))?.vigia as Obj | undefined;
      sinais.vm = v ? { em: texto(v.em), maquina: texto(v.pc), desligadoEm: texto(v.desligadoEm) } : null;
    }
    mudou({ sinais });
  }

  function ligar(): () => void {
    const pararPc = onSnapshot(doc(db, 'robo', 'painelPC'), s => { chegou.pc = true; mudou({ pc: e.lerBatimento('pc', s.exists() ? s.data() : null) }); }, negado('pc'));
    const pararVm = onSnapshot(doc(db, 'robo', 'painelVM'), s => { chegou.vm = true; mudou({ vm: e.lerBatimento('vm', s.exists() ? s.data() : null) }); }, negado('vm'));
    const pararAtividade = onSnapshot(query(collection(db, 'roboAtividade'), orderBy('em', 'desc'), limit(QUANTAS_ATIVIDADES)), s => {
      chegou.atividade = true;
      mudou({ atividades: s.docs.map(d => e.lerAtividade(d.id, d.data())) });
    }, negado('atividade'));
    // o sinal antigo, só enquanto falta o painel de algum robô
    const talvezSinais = () => { if (chegou.pc && chegou.vm && (!docs.pc || !docs.vm)) void lerSinaisAntigos(); };
    const primeira = setTimeout(talvezSinais, 3000);
    const relogio = setInterval(talvezSinais, SINAL_A_CADA_MS);
    return () => { pararPc(); pararVm(); pararAtividade(); clearTimeout(primeira); clearInterval(relogio); };
  }

  return {
    exemplos: false,
    docs: () => docs,
    acompanhar() {
      quantos++;
      if (!parar) parar = ligar();
      return () => {
        quantos--;
        if (!quantos && parar) { parar(); parar = null; }
      };
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
