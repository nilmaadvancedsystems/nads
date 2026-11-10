import { robos as r } from '@nads/core';
import { describe, expect, it } from 'vitest';
import { criarAjustesMemoria } from './ajustes';

const grupo = (doc: string) => r.AJUSTES.find(g => g.doc === doc)!;

describe('as configurações da central nos exemplos', () => {
  it('o papel de cada pessoa, e sem documento fica sem acesso', async () => {
    const repo = criarAjustesMemoria();
    expect(await repo.minhaPermissao({ nome: 'Nilma', admin: true })).toEqual(r.TODA_PERMISSAO);
    expect((await repo.minhaPermissao({ nome: 'Heverton', admin: false })).papel).toBe('ver');
    expect((await repo.minhaPermissao({ nome: 'Clara', admin: false })).robos).toEqual(['fgts', 'sieg']);
    expect(await repo.minhaPermissao({ nome: 'Felipe', admin: false })).toEqual(r.SEM_PERMISSAO);
    expect(await repo.minhaPermissao({ nome: 'Quem', admin: false })).toEqual(r.SEM_PERMISSAO);
  });
  it('tirar o acesso apaga; comandar sem robô é recusado', async () => {
    const repo = criarAjustesMemoria();
    await repo.gravarPermissao('ex-Heverton', r.SEM_PERMISSAO, 'Nilma');
    expect(await repo.minhaPermissao({ nome: 'Heverton', admin: false })).toEqual(r.SEM_PERMISSAO);
    await expect(repo.gravarPermissao('ex-Felipe', { admin: false, papel: 'comandar', robos: [] }, 'Nilma')).rejects.toThrow(/robô/);
  });
  it('um ajuste inválido não grava', async () => {
    const repo = criarAjustesMemoria();
    const antes = (await repo.lerAjustes()).fgts;
    await expect(repo.gravarAjuste(grupo('fgts'), antes, { onde: 'marte' }, 'Nilma')).rejects.toThrow(/opções/);
    expect((await repo.lerAjustes()).fgts.onde).toBe('pc');
    await repo.gravarAjuste(grupo('fgts'), antes, { onde: 'servidor' }, 'Nilma');
    expect((await repo.lerAjustes()).fgts.onde).toBe('servidor');
  });
  it('os alertas começam desligados e os horários sem configuração', async () => {
    const repo = criarAjustesMemoria();
    const a = await repo.lerAlertas();
    expect([a.ligado, a.erro.ligado, a.semSinal.ligado, a.disco.ligado]).toEqual([false, false, false, false]);
    expect(Object.values(await repo.lerHorarios()).every(h => !h.ativo)).toBe(true);
    await expect(repo.gravarAlertas({ ...a, ligado: true }, 'Nilma')).rejects.toThrow(/quem/);
    await expect(repo.gravarHorario('nfse', r.HORARIO_PADRAO, 'Nilma')).rejects.toThrow(/não aceita/);
  });
});
