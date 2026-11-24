// O de/para automático das contas (23/11/2026, docs/sci item 2): o plano da empresa no nads (o do Alterdata, do Cadastro ou
// da planilha) casado com o plano padrão do SCI (90113 ou 90011). O teste no SCI mostrou que ele aceita a classificação e
// troca pelo código reduzido; aqui o nads já manda o código certo e diz o que não casou.
// Ordem: 1) a mesma classificação (sem os zeros da esquerda: "3.2.1.01.004" = "03.2.1.01.004") com o nome parecido;
// 2) o mesmo nome numa conta analítica só. A classificação igual com o nome diferente fica "a conferir": vai como sugestão,
// nunca no de/para, para não lançar na conta errada sem ninguém ver.
import * as XLSX from 'xlsx';
import type { ContaDoPlano } from '../../empresas/cadastro/tipos';
import type { ContaNoSci } from '../tipos';
import { semAcento, type ContaDoPlanoSci, type PlanoSci } from './plano';

export type ComoCasou = 'classificacao' | 'nome' | 'conferir' | 'semPar';

export interface ParDeConta {
  codigo: string;
  nome: string;
  classificacao: string;
  /** a conta do SCI (só quando casou) */
  sci: ContaDoPlanoSci | null;
  /** a sugestão de quando a classificação bate e o nome não */
  sugestao: ContaDoPlanoSci | null;
  como: ComoCasou;
}

/** "03.2.1.01.004" e "3.2.1.1.4" → "3.2.1.1.4". '' sem número. */
export function classificacaoNormal(c: string): string {
  const partes = c.split(/[.\-\s]+/).map(p => p.replace(/\D/g, '')).filter(Boolean);
  return partes.map(p => String(Number(p))).join('.');
}

const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 's', 'cfe', 'ref']);

/** O nome para comparar: sem acento, minúsculo, só letras e números. */
export const nomeNormal = (n: string) => semAcento(n).replace(/[^a-z0-9]+/g, ' ').trim();

function palavras(n: string): Set<string> {
  return new Set(nomeNormal(n).split(' ').filter(p => p.length > 1 && !PALAVRAS_VAZIAS.has(p)));
}

/** Os nomes falam da mesma conta? (iguais, ou metade das palavras do menor em comum) */
export function nomesParecidos(a: string, b: string): boolean {
  if (nomeNormal(a) === nomeNormal(b)) return true;
  const pa = palavras(a);
  const pb = palavras(b);
  if (!pa.size || !pb.size) return false;
  let comum = 0;
  for (const p of pa) if (pb.has(p)) comum++;
  return comum / Math.min(pa.size, pb.size) >= 0.5;
}

/** Casa cada conta analítica do nads com o plano do SCI. As sintéticas do nads ficam de fora (não recebem lançamento). */
export function deParaPeloPlano(planoNads: readonly ContaDoPlano[], plano: PlanoSci): ParDeConta[] {
  const analiticas = plano.contas.filter(c => c.analitica);
  const porClassificacao = new Map(plano.contas.map(c => [classificacaoNormal(c.classificacao), c]));
  const porNome = new Map<string, ContaDoPlanoSci[]>();
  for (const c of analiticas) {
    const k = nomeNormal(c.nome);
    porNome.set(k, [...(porNome.get(k) || []), c]);
  }
  return planoNads.filter(c => !c.sintetica && c.codigo).map(c => {
    const base = { codigo: c.codigo, nome: c.nome, classificacao: c.classificacao || '' };
    const daClassificacao = c.classificacao ? porClassificacao.get(classificacaoNormal(c.classificacao)) : undefined;
    if (daClassificacao?.analitica && nomesParecidos(c.nome, daClassificacao.nome)) return { ...base, sci: daClassificacao, sugestao: null, como: 'classificacao' as const };
    const doNome = porNome.get(nomeNormal(c.nome));
    if (doNome?.length === 1) return { ...base, sci: doNome[0], sugestao: null, como: 'nome' as const };
    if (daClassificacao?.analitica) return { ...base, sci: null, sugestao: daClassificacao, como: 'conferir' as const };
    return { ...base, sci: null, sugestao: null, como: 'semPar' as const };
  });
}

/** O de/para que a planilha do SCI usa: só as contas que casaram. */
export function mapaDoDePara(pares: readonly ParDeConta[]): Map<string, ContaNoSci> {
  return new Map(pares.filter(p => p.sci).map(p => [p.codigo, { codigo: p.sci!.codigo, nome: p.sci!.nome }]));
}

/** O de/para automático com o do escritório por cima (o da planilha manda: é o que alguém conferiu). */
export function juntarDePara(automatico: ReadonlyMap<string, ContaNoSci>, doEscritorio: ReadonlyMap<string, ContaNoSci> | null): Map<string, ContaNoSci> {
  return new Map([...automatico, ...(doEscritorio || [])]);
}

export function resumoDoDePara(pares: readonly ParDeConta[]): Record<ComoCasou, number> {
  const r: Record<ComoCasou, number> = { classificacao: 0, nome: 0, conferir: 0, semPar: 0 };
  for (const p of pares) r[p.como]++;
  return r;
}

const COMO: Record<ComoCasou, string> = {
  classificacao: 'pela classificação', nome: 'pelo nome', conferir: 'a conferir (a classificação bate, o nome não)', semPar: 'sem par',
};

/**
 * A planilha de de/para para o escritório conferir e guardar no Drive. As 3 primeiras colunas são as que a ferramenta lê de
 * volta (lerDePara): Conta no nads, Conta no SCI, Nome no SCI. A "a conferir" vem com a Conta no SCI vazia e a sugestão ao
 * lado: quem conferir copia o código, e só aí ela passa a valer.
 */
export function planilhaDoDePara(pares: readonly ParDeConta[]): Uint8Array {
  const aoa: (string | number)[][] = [['Conta no nads', 'Conta no SCI', 'Nome no SCI', 'Como casou', 'Sugestão', 'Nome no nads', 'Classificação no nads', 'Classificação no SCI']];
  const ordem: Record<ComoCasou, number> = { conferir: 0, semPar: 1, nome: 2, classificacao: 3 };
  for (const p of [...pares].sort((a, b) => ordem[a.como] - ordem[b.como] || a.classificacao.localeCompare(b.classificacao))) {
    const s = p.sci || p.sugestao;
    aoa.push([p.codigo, p.sci?.codigo || '', p.sci?.nome || '', COMO[p.como], p.sugestao ? p.sugestao.codigo + ' ' + p.sugestao.nome : '', p.nome, p.classificacao, s?.classificacao || '']);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [12, 12, 34, 30, 40, 34, 18, 18].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'De-para');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}
