import { describe, expect, it } from 'vitest';
import { lerBalanceteDoArquivo, lerPlanilha } from '../arquivos';
import { balanceteDeExemploEmBase64, base64ParaBuffer, competenciaDoBalancete, textoDoAndamento } from './alterdata';

describe('o balancete que vem do robô do Alterdata', () => {
  it('na fila: "Na fila…" e dá para cancelar', () => {
    expect(textoDoAndamento({ status: 'pendente', erro: '', passos: [] })).toMatchObject({ tom: 'andando', titulo: 'Na fila…', podeCancelar: true });
  });
  it('com o robô: mostra o último passo e dá para cancelar', () => {
    const t = textoDoAndamento({ status: 'trabalhando', erro: '', passos: [{ nome: 'abrindo o Alterdata' }, { nome: 'gerando o balancete' }] });
    expect(t).toMatchObject({ tom: 'andando', detalhe: 'gerando o balancete', podeCancelar: true });
  });
  it('erro: o motivo do robô; pronto e cancelado não cancelam', () => {
    expect(textoDoAndamento({ status: 'erro', erro: 'empresa não encontrada', passos: [] })).toMatchObject({ tom: 'erro', detalhe: 'empresa não encontrada', podeCancelar: false });
    expect(textoDoAndamento({ status: 'pronto', erro: '', passos: [] }).tom).toBe('ok');
    expect(textoDoAndamento({ status: 'cancelado', erro: '', passos: [] })).toMatchObject({ tom: 'erro', podeCancelar: false });
  });

  it('a competência: o último mês marcado; sem mês, o anterior ao de hoje (virando o ano também)', () => {
    expect(competenciaDoBalancete(['2026-08', '2026-06', 'x'], new Date(2026, 9, 14))).toBe('2026-08');
    expect(competenciaDoBalancete([], new Date(2026, 9, 14))).toBe('2026-09');
    expect(competenciaDoBalancete([], new Date(2026, 0, 5))).toBe('2025-12');
  });

  it('o base64 do robô entra no mesmo leitor do arquivo escolhido (o exemplo traz as contas com o código entre colchetes)', () => {
    const lido = lerBalanceteDoArquivo(lerPlanilha(base64ParaBuffer(balanceteDeExemploEmBase64())));
    expect(Object.keys(lido.contas)).toContain('11002');
    expect(lido.contas['11002']).toMatchObject({ nome: 'BANCOS CONTA MOVIMENTO', valor: 12000, dc: 'D', grupo: 'Ativo', sintetica: false });
    expect(lido.contas['11']).toMatchObject({ sintetica: true });
    expect(lido.contas['21001']).toMatchObject({ dc: 'C', grupo: 'Passivo' });
  });
});
