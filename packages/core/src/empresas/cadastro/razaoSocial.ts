// A troca da razão social pelo nads (13/11/2026: "poder trocar a razão social pelo próprio sistema, sem pedir a ninguém
// para mexer no código"). A razão social nova é só para mostrar e buscar: a chave da empresa continua o nome de sempre
// (o slug dele é o id do cadastro, dos extratos, da Conferência, das rotinas, do cofre e do "onde parou"), então trocar
// não tira nada da empresa. Só o nível Diretor (e o Dono) troca; o admin sem esse nível, não (a tela confere: podeTrocarRazaoSocial).
import { slug } from '../../formatos';
import type { CadastroDaEmpresa, RazaoSocialAnterior, RazaoSocialDoCadastro } from './tipos';

/** Tamanho máximo da razão social. */
export const MAX_RAZAO_SOCIAL = 150;
/** Quantas razões sociais anteriores ficam guardadas. */
export const MAX_RAZOES_ANTERIORES = 20;

const texto = (v: unknown) => (v == null ? '' : String(v).trim());

/** A razão social como fica guardada: sem espaços sobrando, em maiúsculas (como a lista do escritório). */
export function razaoSocialLimpa(s: string): string {
  return texto(s).replace(/\s+/g, ' ').toUpperCase();
}

/** A razão social que vale para mostrar: a trocada no nads; sem ela, o nome. */
export function razaoSocialDoCadastro(c: Pick<CadastroDaEmpresa, 'nome' | 'razaoSocial'> | null | undefined, nome = ''): string {
  return c?.razaoSocial?.atual || c?.nome || nome;
}

/** Uma outra empresa da lista, para não deixar duas com o mesmo nome. */
export interface OutraEmpresa { codigo: number | null; nome: string; razaoSocial?: string }

/**
 * Troca a razão social: o nome novo vale para mostrar e buscar; o `nome` (a chave) não muda. A anterior fica guardada,
 * com quem trocou e quando, e a troca vai para o histórico. Sem mudança, devolve o mesmo cadastro (não grava à toa).
 * `outras` = a lista do escritório (a empresa de mesma chave é ela mesma e não conta).
 */
export function trocarRazaoSocial(c: CadastroDaEmpresa, nova: string, outras: readonly OutraEmpresa[], por: string, agora: Date): CadastroDaEmpresa | { erro: string } {
  const n = razaoSocialLimpa(nova);
  if (!n) return { erro: 'Digite a razão social.' };
  if (n.length > MAX_RAZAO_SOCIAL) return { erro: 'A razão social passa de ' + MAX_RAZAO_SOCIAL + ' letras.' };
  const antes = razaoSocialDoCadastro(c);
  if (n === antes) return c;
  const chave = slug(c.nome);
  const igual = outras.find(o => slug(o.nome) !== chave && (slug(o.nome) === slug(n) || (!!o.razaoSocial && slug(o.razaoSocial) === slug(n))));
  if (igual) return { erro: 'Já tem outra empresa com esse nome: ' + (igual.codigo != null ? igual.codigo + ' · ' : '') + (igual.razaoSocial || igual.nome) + '.' };
  const ts = agora.toISOString();
  const anteriores: RazaoSocialAnterior[] = [{ nome: antes, ate: ts }, ...(c.razaoSocial?.anteriores || [])].slice(0, MAX_RAZOES_ANTERIORES);
  const razaoSocial: RazaoSocialDoCadastro = { atual: n, em: ts, por: por || '—', anteriores };
  return {
    ...c, razaoSocial,
    historico: [{ ts, por: por || '—', acao: 'Razão social', detalhe: antes + ' → ' + n }, ...c.historico],
    atualizadoEm: ts,
  };
}

/** A razão social do documento do banco, conferida (sem atual = não foi trocada). */
export function razaoSocialDoDocumento(v: unknown): Pick<CadastroDaEmpresa, 'razaoSocial'> {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const atual = texto(o.atual);
  if (!atual) return {};
  const anteriores = Array.isArray(o.anteriores)
    ? (o.anteriores as Record<string, unknown>[]).map(a => ({ nome: texto(a?.nome), ate: texto(a?.ate) })).filter(a => a.nome).slice(0, MAX_RAZOES_ANTERIORES)
    : [];
  return { razaoSocial: { atual, em: texto(o.em), por: texto(o.por), anteriores } };
}
