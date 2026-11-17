import { describe, expect, it } from 'vitest';
import { cadastroVazio, pedirTransferencia, quemPodeSerResponsavel, trocarResponsavelDireto } from './regras';

const agora = new Date('2026-11-17T12:00:00.000Z');

describe('trocar o responsável direto, pelo Cadastro › Dados da empresa', () => {
  it('grava quem cuida, no departamento, com o registro no histórico', () => {
    const c = trocarResponsavelDireto(cadastroVazio('DOUGLAS AUTO CENTER LTDA', 510), 'fiscal', 'Heverton', 'Nilma', agora);
    expect(c.responsaveis).toEqual({ fiscal: 'Heverton' });
    expect(c.historico[0]).toMatchObject({ por: 'Nilma', acao: 'Responsável', detalhe: 'Fiscal: Heverton' });
  });

  it('a mesma pessoa não muda nada; vazio tira o responsável', () => {
    const c = trocarResponsavelDireto(cadastroVazio('X', 1), 'contabil', 'Clara', 'Nilma', agora);
    expect(trocarResponsavelDireto(c, 'contabil', 'Clara', 'Nilma', agora)).toBe(c);
    expect(trocarResponsavelDireto(c, 'contabil', '', 'Nilma', agora).responsaveis).toEqual({});
  });

  it('a transferência pedida no departamento cai; a do outro fica', () => {
    let c = trocarResponsavelDireto(cadastroVazio('X', 1), 'fiscal', 'Adivania', 'Nilma', agora);
    c = trocarResponsavelDireto(c, 'contabil', 'Clara', 'Nilma', agora);
    c = pedirTransferencia(c, 'fiscal', 'Adivania', 'Heverton', 'Nilma', agora).cadastro;
    c = pedirTransferencia(c, 'contabil', 'Clara', 'Felipe', 'Nilma', agora).cadastro;
    const d = trocarResponsavelDireto(c, 'fiscal', 'Heverton', 'Nilma', agora);
    expect(d.responsaveis).toEqual({ fiscal: 'Heverton', contabil: 'Clara' });
    expect(d.transferencias?.fiscal).toBeUndefined();
    expect(d.transferencias?.contabil).toMatchObject({ de: 'Clara', para: 'Felipe' });
    expect(d.historico.slice(0, 2).map(h => h.acao)).toEqual(['Responsável', 'Cancelou a transferência']);
  });

  it('quem pode ser responsável: os ativos do departamento ou com o papel dele, em ordem de nome', () => {
    const equipe = [
      { nome: 'Heverton', ativo: true, departamento: 'fiscal', papeis: ['staff', 'fiscal'] },
      { nome: 'Adivania', ativo: true, departamento: 'fiscal', papeis: ['staff', 'fiscal'] },
      { nome: 'Vitor', ativo: true, departamento: 'contabil', papeis: ['staff', 'contabil', 'fiscal'] },
      { nome: 'Saiu', ativo: false, departamento: 'fiscal', papeis: ['staff', 'fiscal'] },
      { nome: 'Sávio', ativo: true, departamento: 'dp', papeis: ['staff', 'dp'] },
    ];
    expect(quemPodeSerResponsavel(equipe, 'fiscal')).toEqual(['Adivania', 'Heverton', 'Vitor']);
    expect(quemPodeSerResponsavel(equipe, 'contabil')).toEqual(['Vitor']);
  });
});
