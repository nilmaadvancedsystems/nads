import { describe, expect, it } from 'vitest';
import { celula, criarAcumulador, diasDoPeriodo, gravacoesPorDia, nivelDoCalor, nomeComparavel, rotuloLimpo, somarUso, telaDoCaminho, usoDoDocumento } from '.';

describe('o mapa de uso do sistema (Gustavo, 20/10/2026)', () => {
  it('a tela do caminho: app/página, sem a empresa nem a competência', () => {
    expect(telaDoCaminho('/tarefas/fiscal/painel?competencia=2026-09')).toBe('fiscal/painel');
    expect(telaDoCaminho('/tarefas')).toBe('inicio');
    expect(telaDoCaminho('/tarefas/cadastro/empresas/padaria-pao-dourado/senhas')).toBe('cadastro/empresas/senhas');
    expect(telaDoCaminho('/tarefas/cadastro/empresas/padaria-pao-dourado')).toBe('cadastro/empresas/empresa');
    expect(telaDoCaminho('/tarefas/executar/padaria/2026-09')).toBe('executar');
    expect(telaDoCaminho('/tarefas/minhas-empresas/empresa/padaria')).toBe('minhas-empresas/empresa');
    expect(telaDoCaminho('/extratudo')).toBeNull();
  });

  it('o rótulo limpo: sem números, e-mails e nomes de empresa', () => {
    const nomes = [nomeComparavel('Padaria Pão Dourado Ltda')];
    expect(rotuloLimpo('  Exportar   Excel ')).toBe('Exportar Excel');
    expect(rotuloLimpo('Competência 09/2026')).toBe('Competência');
    expect(rotuloLimpo('Enviados2')).toBe('Enviados');
    expect(rotuloLimpo('Baixar 3 notas')).toBe('Baixar # notas');
    expect(rotuloLimpo('Responder para joao@cliente.com.br')).toBe('Responder para @');
    expect(rotuloLimpo('Abrir Padaria Pão Dourado', nomes)).toBe('empresa da lista');
    expect(rotuloLimpo('Abrir AURORA REFLORESTAMENTO E TRANSPORTES')).toBe('Abrir …');
    expect(rotuloLimpo('01.939.488/0001-80')).toBeNull();
    expect(rotuloLimpo('')).toBeNull();
    expect(rotuloLimpo('x'.repeat(80))!.length).toBe(48);
  });

  it('a célula da grade 50×50', () => {
    expect(celula(0, 0, 1000, 500)).toBe('0_0');
    expect(celula(1000, 500, 1000, 500)).toBe('49_49');
    expect(celula(510, 260, 1000, 500)).toBe('25_26');
    expect(celula(-1, 0, 1000, 500)).toBeNull();
  });

  it('o acumulador junta, tira e devolve; os vistos entram com 0 uma vez', () => {
    const a = criarAcumulador();
    const agora = new Date(2026, 9, 21, 10);
    a.visita('fiscal/painel', 'fiscal', 'Heverton', agora);
    a.clique('fiscal/painel', 'Exportar Excel', '10_10', 'fiscal', 'Heverton', agora);
    a.vistos('fiscal/painel', ['Exportar Excel', 'Imprimir'], true, agora);
    a.vistos('fiscal/painel', ['Outro'], true, agora);
    const u = a.tirar()!;
    expect(u.dia).toBe('2026-10-21');
    expect(u.telas['fiscal/painel']).toEqual({ v: 1, c: { 'Exportar Excel': 1, Imprimir: 0 }, p: { '10_10': 1 }, q: { fiscal: 2 } });
    expect(u.pessoas).toEqual({ Heverton: 2 });
    expect(a.tirar()).toBeNull();
    a.devolver(u);
    expect(a.tirar()?.telas['fiscal/painel'].v).toBe(1);
  });

  it('soma os dias: as mais visitadas, as nunca visitadas e os controles sem clique', () => {
    const nav = [{ tela: 'fiscal/painel', rotulo: 'Fiscal › Painel', app: 'fiscal' }, { tela: 'fiscal/reinf', rotulo: 'Fiscal › REINF', app: 'fiscal' }];
    const d1 = usoDoDocumento('2026-10-20', { telas: { 'fiscal/painel': { v: 3, c: { Exportar: 2, Imprimir: 0 }, p: { '1_1': 2 }, q: { fiscal: 5 } } }, pessoas: { Heverton: 5 } });
    const d2 = usoDoDocumento('2026-10-21', { telas: { 'fiscal/painel': { v: 1, c: { Exportar: 1, x: 'lixo' } } } });
    const s = somarUso([d1, d2], nav);
    expect(s.visitas).toBe(4);
    expect(s.cliques).toBe(3);
    expect(s.telas[0]).toMatchObject({ tela: 'fiscal/painel', rotulo: 'Fiscal › Painel', visitas: 4, semClique: ['Imprimir', 'x'], maiorCelula: 2 });
    expect(s.nuncaVisitadas.map(n => n.tela)).toEqual(['fiscal/reinf']);
    expect(s.possivelmenteInutil.controles.map(c => c.controle)).toEqual(['Imprimir', 'x']);
  });

  it('os dias do período e a estimativa de gravações', () => {
    expect(diasDoPeriodo(3, new Date(2026, 9, 1))).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
    expect(gravacoesPorDia(10)).toBe(10 * (96 + 20));
  });
});

describe('nivelDoCalor', () => {
  it('sem clique é 0; o mais clicado é 5; os poucos saem do frio', () => {
    expect(nivelDoCalor(0, 10)).toBe(0);
    expect(nivelDoCalor(10, 10)).toBe(5);
    expect(nivelDoCalor(1, 100)).toBe(1);
    expect(nivelDoCalor(25, 100)).toBe(3);
    expect(nivelDoCalor(3, 0)).toBe(1);
  });
});
