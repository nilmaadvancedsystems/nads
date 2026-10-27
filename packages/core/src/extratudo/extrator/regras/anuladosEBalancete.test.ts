import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { conferenciaDoBanco } from './situacaoDoBanco';
import { tirarSobreposicaoDosExtratos } from './importacao';

const l = (data: string, valor: number, historico: string, extra: Partial<Lancamento> = {}): Lancamento => ({ data, valor, historico, ...extra });
const arq = (id: string, lado: 'banco' | 'sistema', lancamentos: Lancamento[]): ArquivoImportado =>
  ({ id, lado, nome: id, importadoEm: '2026-10-27', modo: 'primeira', banco: 'bb', lancamentos });

describe('o que o razão lançou e estornou no mesmo dia (Vitor, 27/10/2026: a TED e a devolução da TED na 237)', () => {
  const extrato = [l('2026-02-02', 188000, 'TED-Crédito em Conta')];
  const razao = (devolucao: number) => [
    // o sinal do razão da conciliação do Alterdata: o débito na conta do banco (a entrada) vem negativo
    l('2026-02-02', -188000, 'Caixa Economica Federal', { conta: '10503', complemento: '515013 ENVIO TED' }),
    l('2026-02-02', -188000, 'Caixa Economica Federal', { conta: '10503', complemento: '082652 ENVIO TED' }),
    l('2026-02-02', devolucao, 'Caixa Economica Federal', { conta: '10503', complemento: '082652 DEV . TED' }),
  ];
  const empresa = (devolucao: number): EmpresaExtrator => ({ nome: 'T', auditoria: [], arquivos: [arq('e', 'banco', extrato), arq('r', 'sistema', razao(devolucao))] });
  it('o par que se anula (mesmo dia, mesma contrapartida, valor contrário) não é pendência', () => {
    expect(conferenciaDoBanco(empresa(188000), 'bb', 'bb', ['2026-02']).pendencias).toEqual([]);
  });
  it('sem o estorno, a sobra continua pendência', () => {
    expect(conferenciaDoBanco(empresa(5000), 'bb', 'bb', ['2026-02']).pendencias.flatMap(p => p.linhas).length).toBeGreaterThan(0);
  });
});

describe('o lançamento do BB "Consultas" pela Dt. movimento que o mês do balancete já traz (Vitor, 27/10/2026: "é do mês 04")', () => {
  const abril = arq('abr', 'banco', [l('2026-04-30', -3095, 'Cobrança de Juros'), l('2026-04-30', 3095, '12378 619 Devolução Juros-Lim Esp')]);
  const maio = (balancete: string | undefined) => arq('mai', 'banco', [l('2026-05-04', 3095, '12378 619 Devolução Juros-Lim Esp', balancete ? { balancete } : {}), l('2026-05-04', 400000, 'Dep dinheiro ATM')]);
  it('sai do mês do movimento', () => {
    const r = tirarSobreposicaoDosExtratos({ nome: 'T', auditoria: [], arquivos: [abril, maio('2026-04-30')] }, a => a.banco || '', new Date());
    expect(r.tirados).toBe(1);
    expect(r.empresa.arquivos.find(a => a.id === 'mai')!.lancamentos.map(x => x.valor)).toEqual([400000]);
  });
  it('sem a Dt. balancete, ou sem o lançamento no outro mês, fica', () => {
    expect(tirarSobreposicaoDosExtratos({ nome: 'T', auditoria: [], arquivos: [abril, maio(undefined)] }, a => a.banco || '', new Date()).tirados).toBe(0);
    expect(tirarSobreposicaoDosExtratos({ nome: 'T', auditoria: [], arquivos: [maio('2026-04-30')] }, a => a.banco || '', new Date()).tirados).toBe(0);
  });
});
