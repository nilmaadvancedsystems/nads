import { describe, expect, it } from 'vitest';
import { checklistDaFolha, type ContaDoBalancete } from './folha';

// as contas da folha do balancete da 292 (01 a 08/2026)
const C = (codigo: string, nome: string, valor: number, sintetica = false, grupo = codigo.startsWith('8') || codigo.startsWith('9') ? 'Despesa' : 'Passivo'): ContaDoBalancete => ({ codigo, nome, valor, sintetica, grupo });
const B292 = [
  C('83003', '13º Salário', 135.08), C('890', 'DESPESAS PROVISIONADAS', 427.24, true), C('83002', 'Férias', 428.14), C('40002', 'Férias a Pagar', 0),
  C('83005', 'FGTS', 1903.11), C('40005', 'FGTS a Recolher', 0), C('40004', 'INSS a Recolher', 11126.95), C('81002', 'INSS-Encargos da Empresa', 8326.01),
  C('83006', 'Multa Rescisória do FGTS', 1206.19), C('40008', 'Multa Rescisoria do FGTS a recolher', 0), C('40007', 'Rescisoes a Pagar', 0), C('40001', 'Salários a Pagar', 0), C('36006', 'Pro Labore a Pagar', 0), C('81001', 'Pró-labore', 8105),
  C('50003', 'Provisão de Encargos de FGTS e INSS s/Férias', 427.24), C('50001', 'Provisão para Férias', 1215.75),
  C('83004', 'Rescisoes', 636.82), C('83001', 'Salários e Ordenados', 22634.21),
];
const ATE_AGOSTO = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];

describe('checklist da Contabilização da Folha', () => {
  it('a 292 de janeiro a agosto: só as contas do Passivo (mesmo zeradas), na ordem, sem o 13º; FGTS, GRRF e INSS fora por enquanto', () => {
    const r = checklistDaFolha(B292, ATE_AGOSTO);
    expect(r.map(i => i.id)).toEqual(['salarios', 'pro-labore', 'ferias', 'rescisao']);
    expect(r.find(i => i.id === 'ferias')?.contas).toEqual(['40002 — Férias a Pagar']);
  });
  it('com novembro ou dezembro no período, o 13º entra', () => {
    expect(checklistDaFolha([...B292, C('40003', '13º Salário a Pagar', 0)], ['2026-11', '2026-12']).map(i => i.id)).toContain('decimo-terceiro');
  });
  it('sem rescisão, sem a Rescisão; empresa sem folha, lista vazia', () => {
    const semRescisao = B292.filter(c => c.codigo !== '40007');
    expect(checklistDaFolha(semRescisao, ATE_AGOSTO).map(i => i.id)).not.toContain('rescisao');
    expect(checklistDaFolha([C('11101', 'Caixa', 100)], ATE_AGOSTO)).toEqual([]);
  });
  it('o empréstimo do Crédito do Trabalhador (consignado), quando tem', () => {
    const r = checklistDaFolha([...B292, C('40020', 'Empréstimo Consignado Crédito do Trabalhador', 350)], ATE_AGOSTO);
    expect(r.map(i => i.id)).toEqual(['salarios', 'pro-labore', 'ferias', 'rescisao', 'credito-trabalhador']);
  });
});
