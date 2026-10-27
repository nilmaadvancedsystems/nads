// A descrição automática das notas (23/10/2026: "cadastrar nas Configurações do financeiro a descrição automática das notas
// fiscais"): o modelo fica em config/nfse.descricao, com a competência entrando sozinha. Sem modelo, o texto da nota real do
// escritório: "Serviços Contábeis Ref. 09/2026". A Nova nota e a planilha de recebimentos montam a descrição por aqui.
import { preencherModelo } from './email';

export const DESCRICAO_PADRAO = 'Serviços Contábeis Ref. {competencia}';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** As variáveis do modelo, para a explicação nas Configurações. */
export const VARIAVEIS_DA_DESCRICAO: { nome: string; exemplo: string }[] = [
  { nome: '{competencia}', exemplo: '09/2026' },
  { nome: '{mes}', exemplo: 'setembro' },
  { nome: '{ano}', exemplo: '2026' },
];

/** O modelo como veio do banco (vazio ou não texto = o padrão). */
export const modeloDaDescricao = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : DESCRICAO_PADRAO);

/** O mês anterior ao de uma data AAAA-MM-DD, em AAAA-MM (os honorários de outubro são a competência de setembro). */
export function competenciaAnterior(data: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(data || '');
  if (!m) return '';
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  return (mes === 1 ? ano - 1 : ano) + '-' + String(mes === 1 ? 12 : mes - 1).padStart(2, '0');
}

/** Troca {competencia} (MM/AAAA), {mes} (por extenso) e {ano} pela competência AAAA-MM; sem competência, só tira o "Ref.". */
export function descricaoDaNota(modelo: string, competencia: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(competencia || '');
  const usado = modeloDaDescricao(modelo);
  if (!m) return preencherModelo(usado, { competencia: '', mes: '', ano: '' }).replace(/\s*Ref\.?\s*$/i, '').replace(/\s+/g, ' ').trim();
  return preencherModelo(usado, { competencia: m[2] + '/' + m[1], mes: MESES[Number(m[2]) - 1] || '', ano: m[1] }).replace(/\s+/g, ' ').trim();
}
