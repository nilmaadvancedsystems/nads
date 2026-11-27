// O extrato do PGDAS-D subido na Projeção do Fator R também vai para o faturamento (27/11/2026).
import { tarefas as t } from '@nads/core';
import { describe, expect, it } from 'vitest';
import { criarFatorRMemoria } from './fatorR';

const TEXTO = [
  'Extrato do Simples Nacional Período de Apuração (PA): 10/2026 Número da Declaração: 99888777202610001',
  'CNPJ Matriz: 99.888.777/0001-66 Nome empresarial: CLINICA FICTICIA LTDA Data de abertura no CNPJ: 02/03/2015',
  'Receita Bruta do PA (RPA) - Competência 30.000,00 0,00 30.000,00',
  '2.2) Receitas Brutas Anteriores (R$) 2.2.1) Mercado Interno 11/2025 10.000,00 12/2025 20.000,00',
  '2.2.2) Mercado Externo 11/2025 0,00 12/2025 0,00',
  '2.3) Folha de Salários Anteriores (R$) 11/2025 3.000,00 12/2025 4.000,00',
  '3) Resumo da Declaração',
].join(' ');

describe('o extrato do Fator R no faturamento', () => {
  it('junta os meses no PGDAS-D da empresa (o que o faturamento lê) e a tela já mostra', async () => {
    const repo = criarFatorRMemoria();
    const extrato = t.pgdas.extratoDoPgdas(TEXTO);
    if (!extrato) throw new Error('o texto de exemplo não é extrato');
    expect(await repo.extratoNoFaturamento({ codigo: 9001, cnpj: '99888777000166', nome: 'CLINICA FICTICIA LTDA' }, extrato)).toBe(true);
    const pg = repo.daEmpresa(9001, [2026]).pgdas;
    expect(Object.keys(pg?.meses || {}).sort()).toEqual(['2025-11', '2025-12', '2026-10']);
    expect(pg?.meses['2026-10'].receita).toBe(30000);
  });
  it('o extrato de outro CNPJ não vai', async () => {
    const repo = criarFatorRMemoria();
    const extrato = t.pgdas.extratoDoPgdas(TEXTO)!;
    await expect(repo.extratoNoFaturamento({ codigo: 9001, cnpj: '11222333000181', nome: 'OUTRA' }, extrato)).rejects.toThrow();
  });
});
