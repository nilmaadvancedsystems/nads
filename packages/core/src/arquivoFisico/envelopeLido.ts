// O QR do envelope (19/11/2026: "o qr code tem que servir como registro também: ao ler o qr code de um envelope não
// cadastrado ele deve ser cadastrado no arquivo"; "ao eu escanear o qr code do envelope cai literalmente na mesma coisa de
// escanear a caixa"). O QR leva QUAL envelope é — a empresa, o departamento e o mês —, não onde ele está: assim a etiqueta
// do mês pode ser impressa antes de o envelope ir para o arquivo (Cadastro › Etiquetas do mês) e, ao ler, o nads diz onde
// ele está ou, se ainda não está em caixa nenhuma, oferece guardar na caixa daquela empresa, ano e departamento.
import { letraDoDepartamento, ordenarEnvelopes, saiuDoEscritorio, type Caixa, type Departamento, type Envelope } from './caixas';

/** Qual envelope: a empresa, o departamento e a competência ('AAAA-MM' ou 'AAAA'). */
export interface RefDoEnvelope { codigo: number; departamento: Departamento; competencia: string }

const LETRAS: Record<string, Departamento> = { F: 'Fiscal', C: 'Contábil', P: 'Pessoal' };

/** O código que vai no QR: '37-F-2026-05' (ou '37-F-2026', o do ano todo). */
export const codigoDoEnvelope = (r: RefDoEnvelope) => r.codigo + '-' + letraDoDepartamento(r.departamento) + '-' + r.competencia;

/** O código lido de volta (null quando não é de envelope). */
export function lerCodigoDoEnvelope(s: string): RefDoEnvelope | null {
  const m = /^(\d{1,6})-([FCP])-(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(String(s || '').trim().toUpperCase());
  if (!m) return null;
  return { codigo: Number(m[1]), departamento: LETRAS[m[2]], competencia: m[4] ? m[3] + '-' + m[4] : m[3] };
}

/** O endereço que o QR do envelope abre. */
export function linkDoEnvelope(origem: string, r: RefDoEnvelope): string {
  return origem.replace(/\/+$/, '') + '/tarefas/arquivo-fisico/caixas?envelope-lido=' + encodeURIComponent(codigoDoEnvelope(r));
}

/** O ano do envelope ('2026-05' → 2026). */
export const anoDoEnvelope = (r: Pick<RefDoEnvelope, 'competencia'>) => Number(r.competencia.slice(0, 4));

export type EnvelopeLido =
  /** já está numa caixa (o sem observação, se houver mais de um do mesmo mês) */
  | { situacao: 'guardado'; caixa: Caixa; envelope: Envelope }
  /** não está em caixa nenhuma: as caixas onde pode entrar (a empresa, o ano e o departamento dele; a mais nova primeiro) */
  | { situacao: 'solto'; caixas: Caixa[] };

/** Onde está o envelope lido (as caixas descartadas não contam). */
export function procurarEnvelope(caixas: readonly Caixa[], r: RefDoEnvelope): EnvelopeLido {
  const vivas = caixas.filter(c => !saiuDoEscritorio(c) && c.codigo === r.codigo);
  const achados = vivas.flatMap(c => ordenarEnvelopes(c.envelopes).filter(e => e.competencia === r.competencia && e.departamento === r.departamento).map(e => ({ caixa: c, envelope: e })));
  const melhor = achados.find(a => !a.envelope.observacao) || achados[0];
  if (melhor) return { situacao: 'guardado', caixa: melhor.caixa, envelope: melhor.envelope };
  const ano = anoDoEnvelope(r);
  return { situacao: 'solto', caixas: vivas.filter(c => c.ano === ano && c.departamento === r.departamento).sort((a, b) => b.numero - a.numero) };
}

// ---------------------------------------------------------------------------------------------------------------------
// impresso → arquivado (19/11/2026: "vai ter a impressão do envelope e após isso vem a confirmação de arquivamento: o
// responsável imprime, coloca o envelope, e outra pessoa arquiva"). Imprimir a etiqueta registra o envelope como
// aguardando (arquivoFisicoImpressos/{código do envelope}: imprimir de novo não duplica); ler o QR e guardar na caixa é a
// confirmação, com quem arquivou e quando.
// ---------------------------------------------------------------------------------------------------------------------

export interface EnvelopeImpresso {
  /** o código do envelope ('37-F-2026-05'), que é o id no banco */
  id: string;
  codigo: number;
  nome: string;
  departamento: Departamento;
  competencia: string;
  impressoEm: string;
  impressoPor: string;
  /** vazio enquanto aguarda; preenchido quando alguém guarda o envelope numa caixa */
  arquivadoEm: string;
  arquivadoPor: string;
  /** a caixa em que foi guardado */
  caixa: string;
}

/** As etiquetas impressas que viram "aguardando arquivamento": as que ainda não estão em caixa nenhuma (reimprimir a de um
 *  envelope já guardado não volta ele para a fila). */
export function novosImpressos(etiquetas: readonly { ref: RefDoEnvelope; nome: string }[], caixas: readonly Caixa[], quem: string, agora: string): EnvelopeImpresso[] {
  const vistos = new Set<string>();
  const novos: EnvelopeImpresso[] = [];
  for (const { ref, nome } of etiquetas) {
    const id = codigoDoEnvelope(ref);
    if (vistos.has(id) || procurarEnvelope(caixas, ref).situacao === 'guardado') continue;
    vistos.add(id);
    novos.push({ id, codigo: ref.codigo, nome, departamento: ref.departamento, competencia: ref.competencia, impressoEm: agora, impressoPor: quem, arquivadoEm: '', arquivadoPor: '', caixa: '' });
  }
  return novos;
}

/** O impresso confirmado: quem guardou, quando e em que caixa. */
export const arquivarImpresso = (x: EnvelopeImpresso, caixa: string, quem: string, agora: string): EnvelopeImpresso => ({ ...x, arquivadoEm: agora, arquivadoPor: quem, caixa });

/** Os que aguardam arquivamento: impressos, sem confirmação e que ninguém guardou por outro caminho; o mais antigo primeiro. */
export function aguardandoArquivamento(impressos: readonly EnvelopeImpresso[], caixas: readonly Caixa[]): EnvelopeImpresso[] {
  return impressos
    .filter(x => !x.arquivadoEm && procurarEnvelope(caixas, { codigo: x.codigo, departamento: x.departamento, competencia: x.competencia }).situacao !== 'guardado')
    .sort((a, b) => a.impressoEm.localeCompare(b.impressoEm) || a.codigo - b.codigo);
}

type Obj = Record<string, unknown>;
const txt = (v: unknown) => (typeof v === 'string' ? v : '');

/** O impresso como veio do banco (null quando o id não é de envelope). */
export function lerImpresso(id: string, d: unknown): EnvelopeImpresso | null {
  const ref = lerCodigoDoEnvelope(id);
  if (!ref) return null;
  const x = (d && typeof d === 'object' ? d : {}) as Obj;
  return { id: codigoDoEnvelope(ref), ...ref, nome: txt(x.nome), impressoEm: txt(x.impressoEm), impressoPor: txt(x.impressoPor), arquivadoEm: txt(x.arquivadoEm), arquivadoPor: txt(x.arquivadoPor), caixa: txt(x.caixa) };
}

/** O documento do banco (sem o id, que é o nome do documento). */
export function impressoParaOBanco(x: EnvelopeImpresso): Obj {
  const resto: Obj = { ...x };
  delete resto.id;
  return resto;
}
