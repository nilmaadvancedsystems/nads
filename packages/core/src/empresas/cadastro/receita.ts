// O cadastro pelo CNPJ (Vitor, 13/10/2026: "coloca o cadastro por CNPJ via Receita"): a resposta da consulta pública
// (BrasilAPI ou minhareceita.org, o mesmo formato; o Entregas usa as duas) lida em puro. Quem consulta é
// tarefas/dados/receita.ts; aqui só se confere o CNPJ e se tira o que o cadastro usa.
import type { Regime } from './regras';

const so = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const texto = (v: unknown) => (v == null ? '' : String(v).trim());

/** O CNPJ tem 14 números e os dígitos verificadores batem? */
export function cnpjValido(cnpj: string): boolean {
  const d = so(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = base.split('').reduce((s, c, i) => s + Number(c) * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

/** 00.000.000/0000-00 */
export const cnpjFormatado = (cnpj: string) => so(cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

export interface DadosDaReceita {
  cnpj: string;
  razaoSocial: string;
  fantasia: string;
  /** ATIVA, BAIXADA, INAPTA… */
  situacao: string;
  /** o que a Receita sabe do regime: MEI ou Simples; fora do Simples, '' (Presumido ou Real, a pessoa escolhe) */
  regime: Extract<Regime, 'MEI' | 'Simples'> | '';
  cnae: string;
  cnaeDescricao: string;
  municipio: string;
  uf: string;
  abertura: string;
  /**
   * O endereço, para a nota fiscal (15/10/2026: a NFS-e com tomador CNPJ exige o endereço nacional, erro E1358): o
   * município pelo código do IBGE; null se a resposta não trouxer o essencial.
   */
  endereco: { cMun: string; cep: string; logradouro: string; numero: string; bairro: string } | null;
}

/** O endereço da resposta (BrasilAPI e minhareceita: o tipo do logradouro vem à parte, o IBGE em codigo_municipio_ibge). */
function enderecoDaReceita(d: Record<string, unknown>): DadosDaReceita['endereco'] {
  const cMun = so(d.codigo_municipio_ibge);
  const cep = so(d.cep);
  const tipo = texto(d.descricao_tipo_de_logradouro);
  const rua = texto(d.logradouro);
  const logradouro = (tipo && rua && !rua.toUpperCase().startsWith(tipo.toUpperCase()) ? tipo + ' ' + rua : rua).toUpperCase();
  if (cMun.length !== 7 || cep.length !== 8 || !logradouro) return null;
  return { cMun, cep, logradouro, numero: texto(d.numero) || 'S/N', bairro: texto(d.bairro).toUpperCase() || 'CENTRO' };
}

/** A resposta da consulta (BrasilAPI ou minhareceita.org) no que o cadastro usa; null se não for uma empresa. */
export function dadosDaReceita(j: unknown): DadosDaReceita | null {
  if (!j || typeof j !== 'object') return null;
  const d = j as Record<string, unknown>;
  const cnpj = so(d.cnpj);
  const razaoSocial = texto(d.razao_social).toUpperCase();
  if (cnpj.length !== 14 || !razaoSocial) return null;
  const cnae = so(d.cnae_fiscal);
  return {
    cnpj, razaoSocial, fantasia: texto(d.nome_fantasia),
    situacao: texto(d.descricao_situacao_cadastral).toUpperCase(),
    regime: d.opcao_pelo_mei === true ? 'MEI' : d.opcao_pelo_simples === true ? 'Simples' : '',
    cnae: cnae.length === 7 ? cnae.replace(/^(\d{4})(\d)(\d{2})$/, '$1-$2/$3') : cnae,
    cnaeDescricao: texto(d.cnae_fiscal_descricao),
    municipio: texto(d.municipio), uf: texto(d.uf).toUpperCase(),
    abertura: texto(d.data_inicio_atividade),
    endereco: enderecoDaReceita(d),
  };
}
