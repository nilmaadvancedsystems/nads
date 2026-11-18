// O Lançatudo no banco: o que vem do documento é conferido campo a campo (um documento velho ou mexido à mão não quebra
// a tela), e o que vai é só JSON simples (sem undefined, que o Firestore recusa).
//   extrator/{slug}/lancatudo/config  → { regras, lembradas }
//   extrator/{slug}/lancatudo/{aaaa-mm} → { competencia, decisoes, exportacoes }
import type { ConfigDoLancatudo, ContaLembrada, DecisaoDaLinha, ExportacaoFeita, MesDoLancatudo, RegraDoLancatudo, SentidoDaRegra, TipoDaRegra } from '../tipos';
import { configVazia, mesVazio } from './mudancas';

const ehObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const txt = (x: unknown) => (typeof x === 'string' ? x : '');
const SENTIDOS: readonly SentidoDaRegra[] = ['entrada', 'saida', 'ambos'];
const TIPOS: readonly TipoDaRegra[] = ['historico', 'favorecido'];
const DESTINOS: readonly ExportacaoFeita['destino'][] = ['arquivo', 'alterdata', 'conferencia'];

function regraDoDocumento(x: unknown): RegraDoLancatudo | null {
  if (!ehObj(x) || !txt(x.id) || !txt(x.expressao) || !txt(x.conta)) return null;
  return {
    id: txt(x.id), tipo: TIPOS.includes(x.tipo as TipoDaRegra) ? (x.tipo as TipoDaRegra) : 'historico', expressao: txt(x.expressao),
    sentido: SENTIDOS.includes(x.sentido as SentidoDaRegra) ? (x.sentido as SentidoDaRegra) : 'ambos', conta: txt(x.conta),
    comHistoricoDoExtrato: x.comHistoricoDoExtrato === true, criadaEm: txt(x.criadaEm), por: txt(x.por),
    ...(txt(x.descricao) ? { descricao: txt(x.descricao) } : {}),
    ...(txt(x.banco) ? { banco: txt(x.banco) } : {}),
    ...(txt(x.historico) ? { historico: txt(x.historico) } : {}),
    ...(txt(x.codHistorico) ? { codHistorico: txt(x.codHistorico) } : {}),
  };
}

export function configDoDocumento(d: unknown): ConfigDoLancatudo {
  if (!ehObj(d)) return configVazia();
  const regras = Array.isArray(d.regras) ? d.regras.map(regraDoDocumento).filter((r): r is RegraDoLancatudo => !!r) : [];
  const lembradas: Record<string, ContaLembrada> = {};
  if (ehObj(d.lembradas)) {
    for (const [k, v] of Object.entries(d.lembradas)) {
      if (ehObj(v) && txt(v.conta)) lembradas[k] = { conta: txt(v.conta), exemplo: txt(v.exemplo), em: txt(v.em), por: txt(v.por) };
    }
  }
  return { regras, lembradas };
}

function decisaoDoDocumento(v: unknown): DecisaoDaLinha | null {
  if (!ehObj(v)) return null;
  const d: DecisaoDaLinha = { em: txt(v.em), por: txt(v.por) };
  if (typeof v.conta === 'string') d.conta = v.conta;
  if (txt(v.historico)) d.historico = txt(v.historico);
  if (typeof v.codHistorico === 'string') d.codHistorico = v.codHistorico;
  if (txt(v.documento)) d.documento = txt(v.documento);
  if (v.ignorar === true) d.ignorar = true;
  return d.conta !== undefined || d.historico || d.codHistorico !== undefined || d.documento || d.ignorar ? d : null;
}

export function mesDoDocumento(d: unknown, competencia: string): MesDoLancatudo {
  if (!ehObj(d)) return mesVazio(competencia);
  const decisoes: MesDoLancatudo['decisoes'] = {};
  if (ehObj(d.decisoes)) {
    for (const [banco, linhas] of Object.entries(d.decisoes)) {
      if (!ehObj(linhas)) continue;
      const doBanco: Record<string, DecisaoDaLinha> = {};
      for (const [chave, v] of Object.entries(linhas)) { const x = decisaoDoDocumento(v); if (x) doBanco[chave] = x; }
      decisoes[banco] = doBanco;
    }
  }
  const exportacoes = Array.isArray(d.exportacoes) ? d.exportacoes.filter(ehObj).map((e): ExportacaoFeita => ({
    em: txt(e.em), por: txt(e.por), banco: txt(e.banco), quantidade: typeof e.quantidade === 'number' ? e.quantidade : 0,
    destino: DESTINOS.includes(e.destino as ExportacaoFeita['destino']) ? (e.destino as ExportacaoFeita['destino']) : 'arquivo',
  })) : [];
  return { competencia, decisoes, exportacoes };
}

/** Só JSON (sem undefined). */
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export const documentoDaConfig = (c: ConfigDoLancatudo) => json({ regras: c.regras, lembradas: c.lembradas });
export const documentoDoMes = (m: MesDoLancatudo) => json({ competencia: m.competencia, decisoes: m.decisoes, exportacoes: m.exportacoes });

/**
 * O id da chave da linha no documento: o Firestore não aceita "." nem "/" no nome de um campo de mapa sem escapar, e a
 * chave tem o histórico; o resumo FNV-1a (dois de 32 bits) é curto e sem símbolo.
 */
export function idDaChave(chave: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < chave.length; i++) {
    const c = chave.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}
