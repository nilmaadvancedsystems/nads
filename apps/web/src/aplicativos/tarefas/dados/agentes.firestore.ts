// O painel dos agentes do Claude Code no banco do Entregas (13/10/2026): painelAgentes/{sessão}, só leitura (o robô do PC
// grava; a regra deixa só o admin ler). As 30 sessões mais recentes, ao vivo.
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { AcaoDoAgente, AgenteNoPainel, RepoAgentes, SessaoDeAgentes } from './agentes';
import { bancoDoEntregas } from './entregas.firestore';

const texto = (v: unknown) => (v == null ? '' : String(v));

function lerAgente(x: Record<string, unknown>): AgenteNoPainel {
  const ag = x.agora as Record<string, unknown> | null | undefined;
  return {
    chave: texto(x.chave), tipo: texto(x.tipo), modelo: texto(x.modelo), status: texto(x.status), msg: texto(x.msg),
    agora: ag ? { fer: texto(ag.fer), txt: texto(ag.txt), ts: texto(ag.ts) } : null,
    hist: (Array.isArray(x.hist) ? (x.hist as Record<string, unknown>[]) : []).map((h): AcaoDoAgente => ({
      ts: texto(h.ts), fer: texto(h.fer), txt: texto(h.txt), ms: Number(h.ms) || 0, falhou: h.falhou === true,
    })),
  };
}

function lerSessao(id: string, x: Record<string, unknown>): SessaoDeAgentes {
  return {
    sessao: texto(x.sessao) || id, projeto: texto(x.projeto), status: texto(x.status), nivel: texto(x.nivel), modelo: texto(x.modelo),
    pedido: texto(x.pedido), aviso: texto(x.aviso), ultimo: texto(x.ultimo), maquina: texto(x.maquina),
    agentes: (Array.isArray(x.agentes) ? (x.agentes as Record<string, unknown>[]) : []).map(lerAgente),
    maisAgentes: Number(x.maisAgentes) || 0,
  };
}

export function criarAgentesFirestore(): RepoAgentes {
  let estado: { carregada: boolean; lista: SessaoDeAgentes[]; erro: string } | null = null;
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  return {
    exemplos: false,
    sessoes() {
      if (!estado) {
        estado = { carregada: false, lista: [], erro: '' };
        onSnapshot(query(collection(bancoDoEntregas(), 'painelAgentes'), orderBy('ultimo', 'desc'), limit(30)), s => {
          estado = { carregada: true, lista: s.docs.map(d => lerSessao(d.id, d.data())), erro: '' };
          mudou();
        }, err => {
          estado = { carregada: true, lista: [], erro: /permission|insufficient/i.test(err.message) ? 'Só o admin vê o painel dos agentes.' : err.message };
          mudou();
        });
      }
      return estado;
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
