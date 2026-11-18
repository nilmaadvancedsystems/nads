import { describe, expect, it } from 'vitest';
import { estaOnline, mudouSoOPonto, atividadeAtual, rotuloDaPresenca, veAtividade, ehHoraDoPonto, PONTO_DA_PRESENCA_MS, comPresenca, lerUsuario, type DocUsuario } from '.';

describe('o ponto em nadsPresenca (fora de usuarios, 17/11/2026)', () => {
  const t0 = '2026-11-17T14:00:00.000Z', t1 = '2026-11-17T14:05:00.000Z';
  const onde = { codigo: 12, empresa: 'Empresa Exemplo', etapa: 'Conciliação', competencia: '10/2026', em: t1 };
  const pessoa = (d: Partial<DocUsuario> = {}) => lerUsuario('u1', { nome: 'Pessoa', ...d } as DocUsuario);

  it('sem o documento novo, fica o ponto antigo de usuarios', () => {
    const p = pessoa({ nadsVistoEm: t0 });
    expect(comPresenca(p, undefined)).toBe(p);
    expect(comPresenca(p, {})).toBe(p);
  });
  it('o documento novo, mais novo, traz o ponto e a etapa', () => {
    const r = comPresenca(pessoa({ nadsVistoEm: t0 }), { vistoEm: t1, onde });
    expect(r.vistoNoNads).toBe(t1);
    expect(r.ondeNoNads).toEqual(onde);
  });
  it('quem nunca bateu o ponto antigo fica com o novo', () => {
    expect(comPresenca(pessoa(), { vistoEm: t1 }).vistoNoNads).toBe(t1);
  });
  it('valendo o novo sem etapa, a pessoa está em nenhuma (mesmo com etapa velha em usuarios)', () => {
    const r = comPresenca(pessoa({ nadsVistoEm: t0, nadsOnde: { ...onde, em: t0 } }), { vistoEm: t1 });
    expect(r.ondeNoNads).toBeNull();
  });
  it('o ponto antigo mais novo (o nads aberto na versão de antes) ganha', () => {
    const p = pessoa({ nadsVistoEm: t1, nadsOnde: onde });
    expect(comPresenca(p, { vistoEm: t0 })).toBe(p);
  });
  it('etapa pela metade não conta', () => {
    expect(comPresenca(pessoa(), { vistoEm: t1, onde: { empresa: 'X' } }).ondeNoNads).toBeNull();
  });
});

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

describe('o compasso do ponto (cada ponto é uma leitura em toda aba aberta)', () => {
  const t = agora.getTime();
  it('bate na primeira vez e depois de 5 min; não antes', () => {
    expect(ehHoraDoPonto(0, t)).toBe(true);
    expect(ehHoraDoPonto(t - 4 * 60000, t)).toBe(false);
    expect(ehHoraDoPonto(t - 5 * 60000, t)).toBe(true);
  });
  it('o ponto a cada 10 min mantém online (12 min de folga)', () => {
    expect(PONTO_DA_PRESENCA_MS).toBe(10 * 60000);
    expect(estaOnline(antes(10), agora)).toBe(true);
    expect(estaOnline(antes(12), agora)).toBe(false);
  });
});

describe('o ponto de presença não redesenha o app', () => {
  const onde = { codigo: 901, empresa: 'EMPRESA EXEMPLO', etapa: 'Importação', competencia: 'Agosto/2026', em: antes(3) };
  const doc = { nome: 'Pessoa', nadsVistoEm: antes(3), nadsOnde: onde } as DocUsuario;
  it('só a hora do ponto ou do sinal mudou', () => {
    expect(mudouSoOPonto(doc, { ...doc, nadsVistoEm: antes(0) })).toBe(true);
    expect(mudouSoOPonto(doc, { ...doc, nadsVistoEm: antes(0), nadsOnde: { ...onde, em: antes(0) } })).toBe(true);
  });
  it('mudou o cadastro, a etapa ou a pessoa saiu da etapa', () => {
    expect(mudouSoOPonto(doc, { ...doc, nome: 'Outra' } as DocUsuario)).toBe(false);
    expect(mudouSoOPonto(doc, { ...doc, nadsOnde: { ...onde, etapa: 'Fechamento' } })).toBe(false);
    expect(mudouSoOPonto(doc, { ...doc, nadsOnde: undefined })).toBe(false);
  });
  it('sem o documento de antes, avisa', () => {
    expect(mudouSoOPonto(undefined, doc)).toBe(false);
  });
});

describe('presença no nads', () => {
  it('online até 12 minutos sem sinal', () => {
    expect(estaOnline(antes(1), agora)).toBe(true);
    expect(estaOnline(antes(11.9), agora)).toBe(true);
    expect(estaOnline(antes(12), agora)).toBe(false);
    expect(estaOnline(null, agora)).toBe(false);
    expect(estaOnline('lixo', agora)).toBe(false);
  });
  it('o rótulo: online, minutos, horas, dias ou nunca', () => {
    expect(rotuloDaPresenca(antes(2), agora)).toBe('Online');
    expect(rotuloDaPresenca(antes(25), agora)).toBe('Visto há 25 min');
    expect(rotuloDaPresenca(antes(180), agora)).toBe('Visto há 3 h');
    expect(rotuloDaPresenca(antes(60 * 24), agora)).toBe('Visto há 1 dia');
    expect(rotuloDaPresenca(antes(60 * 72), agora)).toBe('Visto há 3 dias');
    expect(rotuloDaPresenca(undefined, agora)).toBe('Nunca abriu o nads');
  });
  it('onde a pessoa está: a empresa e a etapa, só com o sinal recente', () => {
    const onde = { codigo: 901, empresa: 'EMPRESA EXEMPLO', etapa: 'Importação', competencia: 'Agosto/2026', em: antes(2) };
    expect(atividadeAtual(onde, agora)).toEqual({ etapa: 'Importação', empresa: '901 · EMPRESA EXEMPLO', periodo: 'Agosto/2026' });
    expect(atividadeAtual({ ...onde, codigo: null }, agora)?.empresa).toBe('EMPRESA EXEMPLO');
    expect(atividadeAtual({ ...onde, em: antes(13) }, agora)).toBeNull();
    expect(atividadeAtual(null, agora)).toBeNull();
  });
});
