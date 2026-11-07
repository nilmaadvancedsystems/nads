// A Central dos robôs no banco do Entregas (as regras deixam só o admin ler e pedir; firestore.rules do Entregas):
//   robo/painelPC, robo/painelVM   o batimento do painel do robô (servidor e nuvem; mudam uma vez por minuto)
//   robosMaquinas/{maquina}        o estado de cada máquina pela central do robô (robo/central.js): sinais (CPU,
//                                  memória, disco), os robôs pausados; uma vez por minuto
//   roboAtividade                  as 150 linhas mais novas
//   robosComandos                  os 40 comandos mais novos (o histórico: quem pediu o quê e o que o robô respondeu)
//   robosRegistros/{robo}          o espelho do log do robô, só enquanto a aba Registros está aberta; ao abrir, a tela
//                                  pede o "ao vivo" (um comando 'assistir'), e o robô passa a mandar a cada 10 s
// A tela nunca escreve nada além do comando (status 'pendente'); quem responde é o robô.
import { entregas as e, robos as r } from '@nads/core';
import { addDoc as addDocBruto, collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { bancoDoEntregas, contaDoEntregas } from '../../tarefas/dados/entregas.firestore';
import type { DocsDaCentral, PedidoDaTela, RepoCentral } from './central';
import { travarPedido } from '../../../comum/disjuntorDeGravacao';

// o disjuntor de gravação (comum/disjuntorDeGravacao.ts): o mesmo alvo gravado sem parar para por uns minutos
const addDoc = travarPedido(addDocBruto) as typeof addDocBruto;

const QUANTAS_ATIVIDADES = 150;
const QUANTOS_COMANDOS = 40;
/** o "ao vivo" vale 5 min no robô; a tela pede de novo a cada 4 min enquanto a aba está aberta */
const ASSISTIR_A_CADA_MS = 4 * 60 * 1000;

export function criarCentralFirestore(): RepoCentral {
  const db = bancoDoEntregas();
  let docs: DocsDaCentral = {
    carregado: false, semPermissao: false, batimentos: { servidor: null, nuvem: null },
    maquinas: { servidor: null, nuvem: null, escritorio: null }, atividades: [], comandos: [],
  };
  let ver = 0;
  let quantos = 0;
  let parar: (() => void) | null = null;
  const chegou = { pc: false, vm: false, maquinas: false, atividade: false, comandos: false };
  const ouvintes = new Set<() => void>();
  const regs = new Map<string, r.RegistrosDoRobo>();
  const mudou = (parcial: Partial<DocsDaCentral>) => {
    docs = { ...docs, ...parcial, carregado: Object.values(chegou).every(Boolean) };
    ver++;
    for (const f of ouvintes) f();
  };
  const negado = (qual: keyof typeof chegou) => () => { chegou[qual] = true; mudou({ semPermissao: true }); };

  function ligar(): () => void {
    const paradas = [
      onSnapshot(doc(db, 'robo', 'painelPC'), s => { chegou.pc = true; mudou({ batimentos: { ...docs.batimentos, servidor: e.lerBatimento('pc', s.exists() ? s.data() : null) } }); }, negado('pc')),
      onSnapshot(doc(db, 'robo', 'painelVM'), s => { chegou.vm = true; mudou({ batimentos: { ...docs.batimentos, nuvem: e.lerBatimento('vm', s.exists() ? s.data() : null) } }); }, negado('vm')),
      onSnapshot(collection(db, 'robosMaquinas'), s => {
        chegou.maquinas = true;
        const maquinas: DocsDaCentral['maquinas'] = { servidor: null, nuvem: null, escritorio: null };
        for (const d of s.docs) if (d.id in maquinas) maquinas[d.id as r.IdMaquina] = r.lerEstadoDaMaquina(d.id as r.IdMaquina, d.data());
        mudou({ maquinas });
      }, negado('maquinas')),
      onSnapshot(query(collection(db, 'roboAtividade'), orderBy('em', 'desc'), limit(QUANTAS_ATIVIDADES)), s => {
        chegou.atividade = true;
        mudou({ atividades: s.docs.map(d => e.lerAtividade(d.id, d.data())) });
      }, negado('atividade')),
      onSnapshot(query(collection(db, 'robosComandos'), orderBy('em', 'desc'), limit(QUANTOS_COMANDOS)), s => {
        chegou.comandos = true;
        mudou({ comandos: s.docs.map(d => r.lerComando(d.id, d.data())).filter(c => c.acao !== 'assistir') });
      }, negado('comandos')),
    ];
    return () => { for (const p of paradas) p(); };
  }

  async function pedir(p: PedidoDaTela): Promise<string> {
    const conta = contaDoEntregas();
    const quem = { uid: conta?.uid || '', nome: p.porNome || conta?.email.split('@')[0] || '' };
    const d = r.montarComando(p, quem);
    const ref = await addDoc(collection(db, 'robosComandos'), d);
    return ref.id;
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
    registros: robo => regs.get(robo) || r.lerRegistros(robo, null),
    acompanharRegistros(robo) {
      const pararDoc = onSnapshot(doc(db, 'robosRegistros', robo), s => {
        regs.set(robo, r.lerRegistros(robo, s.exists() ? s.data() : null));
        ver++;
        for (const f of ouvintes) f();
      }, () => { /* sem permissão: a tela mostra vazio */ });
      const assistir = () => { void pedir({ robo, acao: 'assistir' }).catch(() => { /* sem permissão ou sem login: fica o espelho de 2 min */ }); };
      assistir();
      const relogio = setInterval(assistir, ASSISTIR_A_CADA_MS);
      return () => { pararDoc(); clearInterval(relogio); };
    },
    pedir,
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
