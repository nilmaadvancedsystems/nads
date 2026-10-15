// Os formatos das telas do Financeiro (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): as datas
// em dd/mm/aaaa, o CPF/CNPJ com pontos, o valor digitado ("420,00") e o ISS da prévia. Puro, sem tela nem banco.
import { empresas, formatos, nfse } from '@nads/core';

/** AAAA-MM-DD (ou ISO com hora) → dd/mm/aaaa */
export const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso || ''; };

/** dd/mm/aaaa → AAAA-MM-DD ('' quando não é uma data que existe) */
export function isoDaData(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return d.getUTCFullYear() === Number(m[3]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[1]) ? m[3] + '-' + m[2] + '-' + m[1] : '';
}

/** ISO com hora → "dd/mm/aaaa hh:mm" (no horário do navegador) */
export function dataHoraBr(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** 11 dígitos: 000.000.000-00; 14: 00.000.000/0000-00; outro tamanho: como veio */
export function documentoFormatado(doc: string): string {
  const d = nfse.soDigitos(doc);
  if (d.length === 14) return empresas.cadastro.cnpjFormatado(d);
  if (d.length === 11) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  return doc;
}

/** O telefone só com os dígitos e o DDD (tira o 55 do país, se vier) */
export function foneSoDigitos(f: string): string {
  const d = nfse.soDigitos(f);
  return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d;
}

/** "420,00", "1.250,5" ou "R$ 420" → número (0 quando não dá para ler) */
export function valorDigitado(v: string): number {
  let s = v.replace(/[^\d.,]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** número → "1.250,50" (para mostrar no campo) */
export const valorNoCampo = (n: number) => (n > 0 ? formatos.brl(n) : '');

/** hoje em AAAA-MM-DD (no relógio do navegador) */
export function hoje(agora = new Date()): string {
  return agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
}

/** A descrição que a nota real do escritório usa: "Serviços Contábeis Ref. 09/2026" (o mês anterior ao de hoje). */
export function descricaoPadrao(agora = new Date()): string {
  const ant = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  return 'Serviços Contábeis Ref. ' + String(ant.getMonth() + 1).padStart(2, '0') + '/' + ant.getFullYear();
}

/** A prévia do imposto numa linha: "ISS 3,74% (Simples): R$ 15,71 · não retido" ('' sem valor ou sem alíquota). */
export function previaDoIss(valor: number, c: nfse.ConfigNfse): string {
  if (!(valor > 0)) return '';
  const regime = c.prestador.opSimpNac === 3 ? 'Simples' : c.prestador.opSimpNac === 2 ? 'MEI' : 'regime normal';
  const a = c.servico.pAliq;
  if (a == null) return 'ISS (' + regime + '): a prefeitura calcula · não retido';
  const iss = Math.round(valor * a) / 100;
  return 'ISS ' + a.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '% (' + regime + '): ' + formatos.reais(iss) + ' · não retido';
}
