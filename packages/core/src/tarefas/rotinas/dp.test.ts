import { describe, expect, it } from 'vitest';
import { CLIENTES_DO_DP, EMPRESAS_COM_DP, SO_DO_DP } from '../../empresas/dp';
import { EMPRESAS } from '../../empresas/lista';
import { empresasDaRotina, etapaNoMes, execucaoNova } from '../regras/execucao';
import { ROTINA_DP } from './dp';
import { rotinaDo } from './rotinaDo';

describe('rotina do DP (o Checklist Folha)', () => {
  it('é a rotina do departamento dp, com uma etapa por obrigação e o envio', () => {
    expect(rotinaDo('dp')).toBe(ROTINA_DP);
    expect(ROTINA_DP.etapas.map(e => e.obrigacaoDp)).toEqual(['recibos', 'folha', 's1200', 's1210', 's1299', 'dctfweb', 'darf', 'fgts', 'envio']);
    for (const e of ROTINA_DP.etapas) expect(e.checklist?.length).toBeGreaterThan(0);
  });
  it('a planilha: 233 clientes, cada um com as obrigações do movimento', () => {
    expect(CLIENTES_DO_DP).toHaveLength(233);
    const semMov = CLIENTES_DO_DP.filter(c => c.movimento === 'Sem Movimento');
    expect(semMov.every(c => c.obrigacoes.includes('s1299') && !c.obrigacoes.includes('folha'))).toBe(true);
  });
  it('só entram as etapas das obrigações que a empresa tem', () => {
    const folha = CLIENTES_DO_DP.find(c => c.movimento === 'Folha' && c.obrigacoes.length === 8)!;
    const semMov = CLIENTES_DO_DP.find(c => c.movimento === 'Sem Movimento' && c.obrigacoes.length === 2)!;
    const ex = (codigo: number) => execucaoNova('X', codigo, '2026-09', 'dp');
    expect(ROTINA_DP.etapas.filter(e => etapaNoMes(ex(folha.codigo), e.id))).toHaveLength(9);
    expect(ROTINA_DP.etapas.filter(e => etapaNoMes(ex(semMov.codigo), e.id)).map(e => e.id)).toEqual(['dp-s1299', 'dp-dctfweb', 'dp-envio']);
    // sem nenhuma obrigação (Apenas REINF): nem o envio
    const nada = CLIENTES_DO_DP.find(c => !c.obrigacoes.length)!;
    expect(ROTINA_DP.etapas.filter(e => etapaNoMes(ex(nada.codigo), e.id))).toHaveLength(0);
  });
  it('o DP trabalha os clientes da planilha; o Contábil e o Fiscal não veem os que só o DP tem', () => {
    expect(empresasDaRotina('dp', EMPRESAS_COM_DP)).toHaveLength(233);
    expect(empresasDaRotina('contabil', EMPRESAS_COM_DP)).toHaveLength(EMPRESAS.length);
    expect(SO_DO_DP.length).toBeGreaterThan(0);
  });
});
