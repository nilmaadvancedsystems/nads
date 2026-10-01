// O checklist da Contabilização da Folha (Vitor, 01/10/2026): montado a partir do balancete importado, na ordem
// Salários → Pró-labore → Férias → 13º → Rescisão → FGTS → Crédito do Trabalhador → GRRF → INSS. Só entra o que a
// empresa tem: uma conta analítica do assunto com saldo no balancete. O 13º só quando o período tem novembro ou
// dezembro; a GRRF (multa rescisória) só quando houve rescisão.
import { nomeNorm } from '../../formatos';

export interface ContaDoBalancete { codigo: string; nome: string; valor: number; sintetica?: boolean }

export interface ItemDaFolha {
  id: 'salarios' | 'pro-labore' | 'ferias' | 'decimo-terceiro' | 'rescisao' | 'fgts' | 'credito-trabalhador' | 'grrf' | 'inss';
  nome: string;
  /** as contas do balancete que mostram o item ("83001 — Salários e Ordenados") */
  contas: string[];
}

const ITENS: { id: ItemDaFolha['id']; nome: string; e: RegExp; nao?: RegExp }[] = [
  { id: 'salarios', nome: 'Folha de pagamento (Salários)', e: /\bsalario|\bordenado/, nao: /13|decimo|pro.?labore/ },
  { id: 'pro-labore', nome: 'Pró-labore', e: /pro.?labore/ },
  { id: 'ferias', nome: 'Férias', e: /ferias/, nao: /provis|encargo/ },
  { id: 'decimo-terceiro', nome: 'Décimo terceiro', e: /\b13|decimo terceiro/, nao: /provis|encargo/ },
  { id: 'rescisao', nome: 'Rescisão', e: /rescis/, nao: /multa|grrf/ },
  { id: 'fgts', nome: 'FGTS', e: /\bfgts\b/, nao: /multa|rescis|provis|encargos? (de|do)? ?fgts e|emprestimo|consignad|credito do trabalhador/ },
  { id: 'credito-trabalhador', nome: 'FGTS empréstimo · Crédito do Trabalhador', e: /credito do trabalhador|consignad|emprestimo.*(fgts|trabalhador|folha)/ },
  { id: 'grrf', nome: 'GRRF (multa rescisória)', e: /grrf|multa rescis/ },
  { id: 'inss', nome: 'INSS', e: /\binss\b/, nao: /provis/ },
];

const ZERO = 0.005;

/** meses: o período da tarefa ('aaaa-mm'), para o 13º (só com novembro ou dezembro). */
export function checklistDaFolha(contas: readonly ContaDoBalancete[], meses: readonly string[]): ItemDaFolha[] {
  const analiticas = contas.filter(c => !c.sintetica && Math.abs(c.valor) >= ZERO);
  const temNovDez = meses.some(m => m.endsWith('-11') || m.endsWith('-12'));
  const achados = ITENS.map(it => ({
    id: it.id, nome: it.nome,
    contas: analiticas.filter(c => { const n = nomeNorm(c.nome); return it.e.test(n) && !(it.nao && it.nao.test(n)); }).map(c => c.codigo + ' — ' + c.nome),
  }));
  const tem = (id: ItemDaFolha['id']) => achados.some(a => a.id === id && a.contas.length > 0);
  return achados.filter(a => {
    if (!a.contas.length) return false;
    if (a.id === 'decimo-terceiro') return temNovDez;
    if (a.id === 'grrf') return tem('rescisao');
    return true;
  });
}
