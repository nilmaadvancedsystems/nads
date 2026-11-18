// O envio agendado dos lotes (plano do Acessórias, 17/11/2026, ficha E17). Datas fixas.
import { describe, expect, it } from 'vitest';
import { agendadoParaIso, aindaAgendado, erroDoAgendamento, rotuloDoAgendamento, venceAntesDoEnvio } from './agendamento';

// 17/11/2026 às 14:00 em Brasília
const AGORA = new Date('2026-11-17T14:00:00-03:00');

describe('o envio agendado', () => {
  it('a data e a hora viram o ISO com o fuso de Brasília', () => {
    expect(agendadoParaIso('2026-11-20', '08:00')).toBe('2026-11-20T08:00:00-03:00');
    expect(agendadoParaIso('2026-11-20', '8h')).toBe('');
    expect(agendadoParaIso('20/11/2026', '08:00')).toBe('');
  });
  it('passado recusado; cedo demais recusado; mais de 30 dias recusado; no meio, pode', () => {
    expect(erroDoAgendamento('2026-11-17T13:00:00-03:00', AGORA)).toMatch(/já passou/);
    expect(erroDoAgendamento('2026-11-17T14:05:00-03:00', AGORA)).toMatch(/10 minutos/);
    expect(erroDoAgendamento('2026-12-18T08:00:00-03:00', AGORA)).toMatch(/30 dias/);
    expect(erroDoAgendamento('2026-11-20T08:00:00-03:00', AGORA)).toBe('');
    expect(erroDoAgendamento('', AGORA)).toMatch(/Escolha/);
  });
  it('o robô pula o lote agendado no futuro e atende o do passado (pelo instante, não pelo fuso da máquina)', () => {
    expect(aindaAgendado('2026-11-20T08:00:00-03:00', AGORA.getTime())).toBe(true);
    expect(aindaAgendado('2026-11-17T13:59:00-03:00', AGORA.getTime())).toBe(false);
    // 08:00 em Brasília = 11:00 UTC
    expect(aindaAgendado('2026-11-20T08:00:00-03:00', Date.parse('2026-11-20T10:59:00Z'))).toBe(true);
    expect(aindaAgendado('2026-11-20T08:00:00-03:00', Date.parse('2026-11-20T11:00:00Z'))).toBe(false);
    expect(aindaAgendado(undefined, AGORA.getTime())).toBe(false);
    expect(aindaAgendado('torto', AGORA.getTime())).toBe(false);
  });
  it('avisa a guia que vence antes do dia do envio', () => {
    expect(venceAntesDoEnvio('2026-11-23T08:00:00-03:00', ['25/11/2026', '20/11/2026', '19/11/2026'])).toBe('19/11/2026');
    expect(venceAntesDoEnvio('2026-11-19T08:00:00-03:00', ['19/11/2026', 'x'])).toBeNull();
    expect(venceAntesDoEnvio('2026-11-23T08:00:00-03:00', ['20-11-2026'])).toBe('20/11/2026');
  });
  it('o rótulo do selo', () => {
    expect(rotuloDoAgendamento('2026-11-20T08:00:00-03:00')).toBe('sex., 20/11 às 08:00');
  });
});
