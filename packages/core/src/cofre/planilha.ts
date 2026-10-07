// A planilha de senhas gov.br (Vitor, 07/10/2026: "importe essas senhas gov"; ListaSenhas.xlsx): uma linha por conta de
// pessoa — Cidadão, CPF, Senha, Observações e Nível (o ID da planilha não é o código da empresa). Acha o cabeçalho (a
// linha com CPF e Senha; as células mescladas vêm vazias), pula as linhas sem CPF ou sem senha e fica com a última de cada
// CPF. Nada sai daqui às claras: quem chama embaralha antes de gravar.
import * as XLSX from 'xlsx';

export interface ContaGovDaPlanilha { nome: string; cpf: string; senha: string; obs: string; nivel: string }

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const texto = (v: unknown) => String(v ?? '').trim();

/** As contas das linhas da planilha (a primeira aba já como linhas). */
export function contasGovDasLinhas(linhas: readonly (readonly unknown[])[]): { contas: ContaGovDaPlanilha[]; ignoradas: number; erro?: string } {
  const cab = linhas.findIndex(r => r.some(v => norm(v) === 'cpf') && r.some(v => norm(v) === 'senha'));
  if (cab < 0) return { contas: [], ignoradas: 0, erro: 'Não achei as colunas CPF e Senha na planilha.' };
  const h = linhas[cab].map(norm);
  const col = (...nomes: string[]) => { for (const n of nomes) { const i = h.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = { nome: col('cidadao', 'nome', 'pessoa'), cpf: col('cpf'), senha: col('senha'), obs: col('observacoes', 'observacao', 'obs'), nivel: col('nivel') };
  const porCpf = new Map<string, ContaGovDaPlanilha>();
  let ignoradas = 0;
  for (const r of linhas.slice(cab + 1)) {
    if (!r.some(v => texto(v))) continue;
    // o CPF que a planilha guardou como número perde os zeros da frente (9 ou 10 dígitos): completa; menos que isso, não é CPF
    const digitos = texto(r[c.cpf]).replace(/\D/g, '');
    const cpf = digitos.length >= 9 && digitos.length <= 11 ? digitos.padStart(11, '0') : '';
    const senha = texto(r[c.senha]);
    if (!/^\d{11}$/.test(cpf) || /^0+$/.test(cpf) || !senha) { ignoradas++; continue; }
    porCpf.set(cpf, {
      nome: c.nome >= 0 ? texto(r[c.nome]) : '', cpf, senha,
      obs: c.obs >= 0 ? [texto(r[c.obs]), texto(r[c.obs + 1])].filter(Boolean).join(' ') : '',
      nivel: c.nivel >= 0 ? texto(r[c.nivel]) : '',
    });
  }
  return { contas: [...porCpf.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), ignoradas };
}

/** Lê o arquivo (xlsx, xls ou csv): a primeira aba. */
export function lerPlanilhaDeSenhas(buf: ArrayBuffer): { contas: ContaGovDaPlanilha[]; ignoradas: number; erro?: string } {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba) return { contas: [], ignoradas: 0, erro: 'A planilha está vazia.' };
  return contasGovDasLinhas(XLSX.utils.sheet_to_json(aba, { header: 1, defval: '' }) as unknown[][]);
}

/** O id da conta no cofre: um resumo (SHA-256) do CPF, para o CPF não aparecer no banco. */
export async function idDaContaGov(cpf: string): Promise<string> {
  const h = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode('nads-gov:' + cpf.replace(/\D/g, '')));
  return 'gov-' + [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** "123.456.789-01" mostrado só com o fim: "***.***.789-01". */
export const cpfMascarado = (cpf: string) => (/^\d{11}$/.test(cpf) ? '***.***.' + cpf.slice(6, 9) + '-' + cpf.slice(9) : '');
export const cpfFormatado = (cpf: string) => (/^\d{11}$/.test(cpf) ? cpf.slice(0, 3) + '.' + cpf.slice(3, 6) + '.' + cpf.slice(6, 9) + '-' + cpf.slice(9) : cpf);
