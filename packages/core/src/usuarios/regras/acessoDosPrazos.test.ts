// As permissões dos prazos (plano do Acessórias, ficha E03).
import { describe, expect, it } from 'vitest';
import type { Usuario } from '../tipos';
import { pode, podeDispensar, podeNosPrazos } from './acesso';

type U = Pick<Usuario, 'papeis' | 'ativo' | 'nivel'>;
const junior: U = { papeis: ['fiscal'], ativo: true, nivel: 'junior' };
const admin: U = { papeis: ['admin'], ativo: true, nivel: 'pleno' };
const diretor: U = { papeis: ['fiscal'], ativo: true, nivel: 'diretor' };
const dono: U = { papeis: [], ativo: true, nivel: 'dono' };
const desativado: U = { papeis: ['admin'], ativo: false, nivel: 'diretor' };

describe('permissões dos prazos (E03)', () => {
  it('o Júnior não dispensa em lote; o admin, o Diretor e o Dono sim', () => {
    expect(podeNosPrazos(junior, 'prazos-dispensar-lote')).toBe(false);
    expect(podeNosPrazos(admin, 'prazos-dispensar-lote')).toBe(true);
    expect(podeNosPrazos(diretor, 'prazos-ajustar')).toBe(true);
    expect(podeNosPrazos(dono, 'indicadores-equipe')).toBe(true);
    // o pode de sempre não olha o nível
    expect(pode(diretor, 'prazos-ajustar')).toBe(false);
  });
  it('conta desativada não pode nada', () => {
    expect(podeNosPrazos(desativado, 'prazos-ajustar')).toBe(false);
    expect(podeDispensar(desativado, false)).toBe('nao');
  });
  it('uma por vez, todo ativo dispensa com motivo; em lote, só quem pode', () => {
    expect(podeDispensar(junior, false)).toBe('com-motivo');
    expect(podeDispensar(junior, true)).toBe('nao');
    expect(podeDispensar(diretor, true)).toBe('com-motivo');
  });
});
