// Fiscal › Cartas (12/11/2026: a Carta de balanço no fim do ano e o Checklist mensal): o que a tela lê e pede. As regras
// (as datas, os textos, o pedido e a situação de cada cliente) são do core (cartasFiscal); o robô manda (robo/cartas-fiscal.js).
//   - a carta: um pedido por cliente na fila de e-mails do robô (solicitacoesEmail, tipo 'cartaBalanco'); o teste vai só
//     para o escritório;
//   - o checklist: o robô grava um registro por cliente e mês (solicitacoesEmail, tipo 'checklistMensal', id
//     checklist_<AAAA-MM>_<código>); a tela só lê, e grava a pausa e os clientes de fora em config/checklistMensal.
// Interface + a versão de exemplo (o modo desenvolvedor e o npm run dev); a do banco é cartasFiscal.firestore.ts.
import { cartasFiscal as cf } from '@nads/core';

export interface Lista<T> { carregados: boolean; lista: T[] }

export interface PedidoDeCartas {
  ano: number;
  prazo: string;
  clientes: { codigo: number; empresa: string }[];
  /** só para o escritório, com a carta do 1º cliente */
  teste?: boolean;
}

export interface RepoCartasFiscal {
  /** os dados são de exemplo (nada vai ao robô) */
  exemplos: boolean;
  /** os pedidos de carta de balanço do ano (pedir já começa a ouvir) */
  cartas(ano: number): Lista<cf.RegistroDoEnvio>;
  /** põe as cartas na fila do robô; devolve quantas */
  pedirCartas(p: PedidoDeCartas): Promise<number>;
  /** os registros do checklist do mês (pedir já começa a ouvir) */
  checklist(competencia: string): Lista<cf.RegistroDoEnvio>;
  config(): { carregado: boolean } & cf.ConfigDoChecklist;
  gravarConfig(c: cf.ConfigDoChecklist): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** O registro como a tela usa, a partir do documento de solicitacoesEmail. */
export function registroDoBanco(id: string, d: Record<string, unknown>): cf.RegistroDoEnvio {
  const texto = (v: unknown) => (v == null ? '' : String(v));
  return {
    id, tipo: texto(d.tipo), status: texto(d.status), codigo: texto(d.codigo), empresa: texto(d.empresa),
    ano: typeof d.ano === 'number' ? d.ano : Number(d.ano) || undefined, competencia: texto(d.competencia) || undefined,
    teste: d.teste === true, para: Array.isArray(d.para) ? d.para.map(texto) : [],
    criadoEm: texto(d.criadoEm), enviadoEm: texto(d.enviadoEm), erro: texto(d.erro),
  };
}

/** A versão de exemplo: o pedido "vai" e fica enviado depois de um instante. */
export function criarCartasFiscalMemoria(): RepoCartasFiscal {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const registros: cf.RegistroDoEnvio[] = [];
  let config: cf.ConfigDoChecklist = { ligado: true, fora: [] };
  let seq = 0;
  return {
    exemplos: true,
    cartas: ano => ({ carregados: true, lista: registros.filter(r => r.tipo === 'cartaBalanco' && r.ano === ano) }),
    async pedirCartas(p) {
      const agora = new Date();
      const quem = { nome: 'Você', email: 'voce@exemplo.com.br', uid: 'exemplo' };
      const lista = p.teste ? p.clientes.slice(0, 1) : p.clientes;
      for (const c of lista) {
        const pedido = cf.pedidoDaCarta({ codigo: c.codigo, empresa: c.empresa, ano: p.ano, prazo: p.prazo, teste: p.teste, quem, agora });
        const r: cf.RegistroDoEnvio = { id: 'ex' + ++seq, tipo: pedido.tipo, status: 'pendente', codigo: pedido.codigo, empresa: pedido.empresa, ano: pedido.ano, teste: pedido.teste, criadoEm: pedido.criadoEm };
        registros.push(r);
        setTimeout(() => { r.status = 'enviado'; r.enviadoEm = new Date().toISOString(); r.para = ['financeiro@exemplo.com.br']; mudou(); }, 1500);
      }
      mudou();
      return lista.length;
    },
    checklist: competencia => ({ carregados: true, lista: registros.filter(r => r.tipo === 'checklistMensal' && r.competencia === competencia) }),
    config: () => ({ carregado: true, ...config }),
    async gravarConfig(c) { config = cf.configDoChecklist(c); mudou(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
