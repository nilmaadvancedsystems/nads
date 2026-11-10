import { describe, expect, it } from 'vitest';
import {
  ACOES_DE_COMANDAR, AJUSTES, administra, gravacaoDoAjuste, lerAlertas, lerHorarios, lerPermissao, lerValores, listaDeDias, mudancasDoGrupo, podeNaCentral, ROBOS_COM_HORARIO,
  SEM_PERMISSAO, temAcesso, textoDoAjuste, textoDoHorario, validarAjuste, validarAlertas, validarHorario, validarPermissao, type GrupoDeAjustes,
} from './ajustes';
import { roboPorId } from './central';

const grupo = (doc: string) => AJUSTES.find(g => g.doc === doc) as GrupoDeAjustes;

describe('os ajustes', () => {
  it('nenhum segredo na lista', () => {
    const campos = AJUSTES.flatMap(g => g.campos.map(c => c.campo));
    for (const c of campos) expect(c).not.toMatch(/senha|token|secret|certificado|chave|apikey|key|url|pfx/i);
    expect(campos).not.toContain('contasUrl');
  });
  it('só os campos da lista passam, mesmo que o documento tenha outros', () => {
    expect(lerValores(grupo('integracoes'), { iaMotor: 'gemini', contasUrl: 'https://segredo', chaveGemini: 'x' })).toEqual({ iaMotor: 'gemini', iaModeloClaude: '', iaModelo: '' });
  });
  it('sem documento, o padrão igual ao do robô', () => {
    expect(lerValores(grupo('fgts'), null)).toEqual({ onde: 'pc' });
    expect(lerValores(grupo('avisoCertificados'), {})).toEqual({ ligado: true });
    expect(lerValores(grupo('indiceDrive'), {})).toEqual({ contas: true, marcar: false });
    expect(lerValores(grupo('caixasGmail'), {})).toEqual({ enviarPeloRobo: true });
    expect(lerValores(grupo('cobranca'), { regua: { ligada: true, dias: '5, 10' } })).toMatchObject({ 'regua.ligada': true, 'regua.dias': [5, 10] });
  });
  it('confere o valor', () => {
    const c = (doc: string, campo: string) => grupo(doc).campos.find(x => x.campo === campo)!;
    expect(validarAjuste(c('fgts', 'onde'), 'marte')).toMatch(/opções/);
    expect(validarAjuste(c('cobranca', 'diaLimite'), 40)).toMatch(/0 a 31/);
    expect(validarAjuste(c('cobranca', 'regua.dias'), [30])).toMatch(/1 a 28/);
    expect(validarAjuste(c('roboIgnorados', 'remetentes'), ['ruim'])).toMatch(/inválido/);
    expect(validarAjuste(c('integracoes', 'iaModelo'), 'a b;c')).toMatch(/letras/);
    expect(validarAjuste(c('roboIgnorados', 'remetentes'), ['a@b.com'])).toBe('');
  });
  it('a gravação monta o caminho e recusa o que não está na lista', () => {
    expect(gravacaoDoAjuste(grupo('cobranca'), { 'regua.ligada': true, 'regua.dias': [5], diaLimite: 10 })).toEqual({ regua: { ligada: true, dias: [5] }, diaLimite: 10 });
    expect(() => gravacaoDoAjuste(grupo('integracoes'), { contasUrl: 'x' })).toThrow(/fora da lista/);
    expect(() => gravacaoDoAjuste(grupo('fgts'), { onde: 'marte' })).toThrow(/opções/);
  });
  it('lista de dias', () => { expect(listaDeDias('15, 5;5 10')).toEqual([5, 10, 15]); });
  it('só o que mudou, e em palavras', () => {
    const g = grupo('cobranca');
    const antes = lerValores(g, { regua: { ligada: false, dias: [5] } });
    expect(mudancasDoGrupo(g, antes, { ...antes })).toEqual({});
    expect(mudancasDoGrupo(g, antes, { ...antes, 'regua.ligada': true, 'regua.dias': [5] })).toEqual({ 'regua.ligada': true });
    expect(textoDoAjuste(g.campos[0], true)).toBe('Ligado');
    expect(textoDoAjuste(g.campos[1], [])).toBe('nenhum');
    expect(textoDoAjuste(grupo('fgts').campos[0], 'servidor')).toBe('Servidor');
  });
});

describe('os horários', () => {
  const sieg = roboPorId('sieg')!;
  const vigia = roboPorId('vigia')!;
  const h = { ativo: true, dias: [1], de: '08:00', ate: '18:00' };
  it('só nos robôs em que dá', () => {
    expect(ROBOS_COM_HORARIO.map(r => r.id).sort()).toEqual(['alterdata', 'fgts', 'ia', 'sieg', 'vigia']);
    expect(validarHorario(roboPorId('nfse')!, h)).toMatch(/não aceita/);
  });
  it('sem configuração vem desligado', () => { expect(lerHorarios(null).sieg.ativo).toBe(false); });
  it('em palavras', () => {
    expect(textoDoHorario(sieg, { ...h, ativo: false })).toMatch(/Sem horário/);
    expect(textoDoHorario(vigia, { ...h, dias: [2, 1], intervaloMin: 60 })).toBe('Seg, Ter, das 08:00 às 18:00, a cada 60 min');
  });
  it('confere', () => {
    expect(validarHorario(sieg, h)).toBe('');
    expect(validarHorario(sieg, { ...h, ativo: false, dias: [] })).toBe('');
    expect(validarHorario(sieg, { ...h, dias: [] })).toMatch(/dia/);
    expect(validarHorario(sieg, { ...h, ate: '08:30' })).toMatch(/1 hora/);
    expect(validarHorario(sieg, { ...h, de: '22:00', ate: '06:00' })).toBe('');
    expect(validarHorario(sieg, { ...h, intervaloMin: 60 })).toMatch(/intervalo/);
    expect(validarHorario(vigia, { ...h, intervaloMin: 5 })).toMatch(/intervalo/);
    expect(validarHorario(vigia, { ...h, intervaloMin: 60 })).toBe('');
  });
});

describe('os alertas', () => {
  it('começam desligados', () => {
    const a = lerAlertas(undefined);
    expect([a.ligado, a.erro.ligado, a.semSinal.ligado, a.disco.ligado, a.pessoas]).toEqual([false, false, false, false, []]);
    expect(validarAlertas(a)).toBe('');
  });
  it('ligar pede quem e o quê', () => {
    const a = lerAlertas({ ligado: true });
    expect(validarAlertas(a)).toMatch(/quem/);
    expect(validarAlertas({ ...a, pessoas: ['u'] })).toMatch(/um tipo/);
    expect(validarAlertas({ ...a, pessoas: ['u'], erro: { ligado: true, robos: [] } })).toBe('');
    expect(validarAlertas({ ...a, pessoas: ['u'], disco: { ligado: true, limite: 90, maquinas: [] } })).toMatch(/máquinas/);
    expect(validarAlertas({ ...a, pessoas: ['u'], erro: { ligado: true, robos: [] }, repetirMin: 1 })).toMatch(/repetir/);
  });
});

describe('quem pode o quê', () => {
  const ver = lerPermissao({ papel: 'ver' });
  const fgts = lerPermissao({ papel: 'comandar', robos: ['fgts', 'inventado'] });
  const adm = lerPermissao({ papel: 'administrar' });
  it('padrão: sem acesso', () => {
    expect(lerPermissao(null)).toEqual(SEM_PERMISSAO);
    expect(lerPermissao({ papel: 'dono' })).toEqual(SEM_PERMISSAO);
    expect(temAcesso(SEM_PERMISSAO)).toBe(false);
    expect(podeNaCentral(SEM_PERMISSAO, 'assistir', 'fgts')).toBe(false);
  });
  it('admin pode tudo, sem precisar de documento', () => {
    expect(podeNaCentral(lerPermissao(null, true), 'reiniciar')).toBe(true);
    expect(administra(lerPermissao(null, true))).toBe(true);
  });
  it('só olhar, comandar e administrar', () => {
    expect(podeNaCentral(ver, 'assistir', 'fgts')).toBe(true);
    expect(podeNaCentral(ver, 'pausar', 'fgts')).toBe(false);
    expect(fgts.robos).toEqual(['fgts']);
    expect(podeNaCentral(fgts, 'cancelar-item', 'fgts')).toBe(true);
    expect(podeNaCentral(fgts, 'cancelar-item', 'sieg')).toBe(false);
    expect(podeNaCentral(fgts, 'parar-tudo')).toBe(false);
    expect(podeNaCentral(fgts, 'reiniciar', 'fgts')).toBe(false);
    expect(podeNaCentral(adm, 'parar-tudo')).toBe(true);
    expect(administra(fgts)).toBe(false);
    expect(podeNaCentral(fgts, 'shell', 'fgts')).toBe(false);
  });
  it('comandar sem robô não serve', () => { expect(validarPermissao({ admin: false, papel: 'comandar', robos: [] })).toMatch(/robô/); });
  it('a lista de comandar é a da regra do banco', () => {
    expect([...ACOES_DE_COMANDAR].sort()).toEqual(['cancelar-item', 'limpar-fila', 'na-frente', 'pausar', 'pedir-cliente', 'refazer', 'retomar', 'rodar-agora']);
  });
});
