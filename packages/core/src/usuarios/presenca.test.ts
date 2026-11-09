import { describe, expect, it } from 'vitest';
import { estaOnline, rotuloDaPresenca, rotuloDoOnde, veAtividade } from '.';

describe('quem vê a atividade atual', () => {
  const contabil = { departamento: 'contabil' };
  it('o Diretor vê todos os setores', () => {
    expect(veAtividade({ nivel: 'diretor', departamento: 'fiscal' }, contabil)).toBe(true);
  });
  it('o Sênior vê só o próprio setor', () => {
    expect(veAtividade({ nivel: 'senior', departamento: 'contabil' }, contabil)).toBe(true);
    expect(veAtividade({ nivel: 'senior', departamento: 'fiscal' }, contabil)).toBe(false);
  });
  it('o Pleno e o Júnior não veem, nem do próprio setor', () => {
    expect(veAtividade({ nivel: 'pleno', departamento: 'contabil' }, contabil)).toBe(false);
    expect(veAtividade({ nivel: 'junior', departamento: 'contabil' }, contabil)).toBe(false);
  });
  it('o Sênior sem setor não vê, nem quem também está sem setor', () => {
    expect(veAtividade({ nivel: 'senior', departamento: null }, contabil)).toBe(false);
    expect(veAtividade({ nivel: 'senior', departamento: null }, { departamento: null })).toBe(false);
  });
});

const agora = new Date('2026-10-05T14:00:00.000Z');
const antes = (min: number) => new Date(agora.getTime() - min * 60000).toISOString();

describe('presença no nads', () => {
  it('online até 5 minutos sem sinal', () => {
    expect(estaOnline(antes(1), agora)).toBe(true);
    expect(estaOnline(antes(4.9), agora)).toBe(true);
    expect(estaOnline(antes(5), agora)).toBe(false);
    expect(estaOnline(null, agora)).toBe(false);
    expect(estaOnline('lixo', agora)).toBe(false);
  });
  it('o rótulo: online, minutos, horas, dias ou nunca', () => {
    expect(rotuloDaPresenca(antes(2), agora)).toBe('Online');
    expect(rotuloDaPresenca(antes(12), agora)).toBe('Visto há 12 min');
    expect(rotuloDaPresenca(antes(180), agora)).toBe('Visto há 3 h');
    expect(rotuloDaPresenca(antes(60 * 24), agora)).toBe('Visto há 1 dia');
    expect(rotuloDaPresenca(antes(60 * 72), agora)).toBe('Visto há 3 dias');
    expect(rotuloDaPresenca(undefined, agora)).toBe('Nunca abriu o nads');
  });
  it('onde a pessoa está: a empresa e a etapa, só com o sinal recente', () => {
    const onde = { codigo: 901, empresa: 'EMPRESA EXEMPLO', etapa: 'Importação', em: antes(2) };
    expect(rotuloDoOnde(onde, agora)).toBe('901 · EMPRESA EXEMPLO › Importação');
    expect(rotuloDoOnde({ ...onde, codigo: null }, agora)).toBe('EMPRESA EXEMPLO › Importação');
    expect(rotuloDoOnde({ ...onde, em: antes(6) }, agora)).toBe('');
    expect(rotuloDoOnde(null, agora)).toBe('');
  });
});
