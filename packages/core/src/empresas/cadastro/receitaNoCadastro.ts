// O retrato da Receita que o nads guarda no cadastro (17/11/2026: o botão Consultar na Receita), lido do documento do
// banco campo a campo. À parte de situacaoNaReceita.ts porque regras.ts (que lê o documento) não pode depender dele.
import type { AtividadeDaReceita, CadastroDaEmpresa, OpcaoNaReceita, ReceitaNoCadastro } from './tipos';

const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const dataIso = (v: unknown) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto(v)); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };

const opcaoDoDocumento = (v: unknown): OpcaoNaReceita | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  return { optante: typeof o.optante === 'boolean' ? o.optante : null, desde: dataIso(o.desde), exclusao: dataIso(o.exclusao) };
};
const atividadeDoDocumento = (v: unknown): AtividadeDaReceita | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return texto(o.codigo) ? { codigo: texto(o.codigo), descricao: texto(o.descricao) } : null;
};

const TEXTOS = ['cnpj', 'situacao', 'situacaoDesde', 'motivoSituacao', 'razaoSocial', 'fantasia', 'endereco', 'complemento', 'cep', 'naturezaJuridica', 'porte', 'abertura'] as const;

/** O retrato do documento do banco (sem conferidoEm = nunca foi gravado). */
export function receitaDoDocumento(v: unknown): Pick<CadastroDaEmpresa, 'receita'> {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const conferidoEm = texto(o.conferidoEm);
  if (!conferidoEm) return {};
  const r: ReceitaNoCadastro = { conferidoEm, por: texto(o.por) };
  for (const k of TEXTOS) if (typeof o[k] === 'string') r[k] = texto(o[k]);
  if ('cnae' in o) r.cnae = atividadeDoDocumento(o.cnae);
  if (Array.isArray(o.cnaesSecundarios)) r.cnaesSecundarios = o.cnaesSecundarios.map(atividadeDoDocumento).filter((a): a is AtividadeDaReceita => !!a);
  if (typeof o.capitalSocial === 'number' || o.capitalSocial === null) r.capitalSocial = o.capitalSocial as number | null;
  if (Array.isArray(o.socios)) {
    r.socios = (o.socios as Record<string, unknown>[]).map(s => ({ nome: texto(s?.nome), qualificacao: texto(s?.qualificacao), desde: dataIso(s?.desde) })).filter(s => s.nome);
  }
  const simples = opcaoDoDocumento(o.simples), mei = opcaoDoDocumento(o.mei);
  if (simples) r.simples = simples;
  if (mei) r.mei = mei;
  return { receita: r };
}
