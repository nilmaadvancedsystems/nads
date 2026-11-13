import { describe, expect, it } from 'vitest';
import { avisoParaMim, comRecebido, faltaReceber, rotuloDoDestino, camposDoComunicado, juntarAvisos, limparAviso, linkValido, MAIOR_AVISO, ordenarAvisos, porcentagemDe, problemaDoAviso, problemaDoComunicado, proximasReunioes, resumoDoProgresso, type AvisoDoEscritorio, type ExtrasDoComunicado, rotuloDoTipoDoAviso } from './inicio';

describe('avisos do escritório', () => {
  it('limpa as pontas e as linhas em branco repetidas', () => {
    expect(limparAviso('  Reunião às 9h  \r\n\r\n\r\n\nTraga o notebook.  ')).toBe('Reunião às 9h\n\nTraga o notebook.');
  });
  it('não deixa publicar vazio nem grande demais', () => {
    expect(problemaDoAviso('   \n ')).toBe('Escreva o aviso.');
    expect(problemaDoAviso('x'.repeat(MAIOR_AVISO + 1))).toMatch(/passou/);
    expect(problemaDoAviso('Feriado na sexta')).toBe('');
  });
  it('fixados em cima, depois o mais novo', () => {
    const l = [
      { id: 'a', em: '2026-10-01T10:00:00Z' },
      { id: 'b', em: '2026-10-03T10:00:00Z' },
      { id: 'c', em: '2026-09-01T10:00:00Z', fixado: true },
    ];
    expect(ordenarAvisos(l).map(x => x.id)).toEqual(['c', 'b', 'a']);
  });
  it('o fixado antigo (fora dos mais novos) entra no mural, uma vez só', () => {
    const recentes = [{ id: 'n1', em: '2026-10-29T10:00:00Z', fixado: false }, { id: 'f2', em: '2026-10-28T10:00:00Z', fixado: true }];
    const fixados = [{ id: 'f2', em: '2026-10-28T10:00:00Z', fixado: true }, { id: 'f-velho', em: '2026-01-05T10:00:00Z', fixado: true }];
    expect(ordenarAvisos(juntarAvisos(recentes, fixados)).map(x => x.id)).toEqual(['f2', 'f-velho', 'n1']);
    // desafixado: os mais novos já dizem que não está fixado
    expect(juntarAvisos([{ id: 'f2', em: '', fixado: false }], [{ id: 'f2', em: '', fixado: true }])).toEqual([{ id: 'f2', em: '', fixado: false }]);
  });
});

describe('resumo do progresso', () => {
  it('conta por situação e soma as etapas', () => {
    const r = resumoDoProgresso([
      { situacao: 'concluida', concluidas: 5, total: 5 },
      { situacao: 'parada', concluidas: 2, total: 5 },
      { situacao: 'nao-iniciada', concluidas: 0, total: 5 },
    ]);
    expect(r.empresas).toBe(3);
    expect(r.porSituacao).toEqual({ 'nao-iniciada': 1, 'em-andamento': 0, parada: 1, concluida: 1 });
    expect(r.etapasFeitas).toBe(7);
    expect(r.etapasTotal).toBe(15);
    expect(r.porcentagem).toBe(46);
  });
  it('sem empresas, zero', () => {
    expect(resumoDoProgresso([]).porcentagem).toBe(0);
  });
  it('só chega a 100 com tudo feito', () => {
    expect(porcentagemDe(999, 1000)).toBe(99);
    expect(porcentagemDe(10, 10)).toBe(100);
    expect(porcentagemDe(3, 0)).toBe(0);
  });
});

describe('comunicados da equipe (as Notificações do Início novo)', () => {
  const extras = (p: Partial<ExtrasDoComunicado> = {}): ExtrasDoComunicado => ({ tipo: 'aviso', titulo: '', link: '', quando: '', ...p });
  it('aceita só link http(s)', () => {
    expect(linkValido('https://www.gov.br/receitafederal')).toBe(true);
    expect(linkValido('javascript:alert(1)')).toBe(false);
    expect(linkValido('www.gov.br')).toBe(false);
  });
  it('pede o link no estudo e o dia e a hora na reunião', () => {
    expect(problemaDoComunicado('Ler a IN', extras({ tipo: 'estudo' }))).toMatch(/link/);
    expect(problemaDoComunicado('Pauta', extras({ tipo: 'reuniao', quando: '2026-11-20' }))).toMatch(/dia e a hora/);
    expect(problemaDoComunicado('Pauta', extras({ tipo: 'reuniao', quando: '2026-11-20T09:00' }))).toBe('');
    expect(problemaDoComunicado('', extras())).toBe('Escreva o aviso.');
  });
  it('grava só os campos com valor (o aviso simples fica como o antigo)', () => {
    expect(camposDoComunicado(extras())).toEqual({});
    expect(camposDoComunicado(extras({ tipo: 'reuniao', titulo: ' Fechamento ', quando: '2026-11-20T09:00' }))).toEqual({ tipo: 'reuniao', titulo: 'Fechamento', quando: '2026-11-20T09:00' });
  });
  it('lista as próximas reuniões, a mais perto primeiro', () => {
    const l = [{ tipo: 'reuniao' as const, quando: '2026-11-21T09:00' }, { tipo: 'reuniao' as const, quando: '2026-11-10T09:00' }, { tipo: 'reuniao' as const, quando: '2026-11-15T14:00' }, { quando: '2026-11-16T09:00' }];
    expect(proximasReunioes(l, '2026-11-13T10:00').map(x => x.quando)).toEqual(['2026-11-15T14:00', '2026-11-21T09:00']);
  });
});

describe('o aviso com destinatários e o Recebido', () => {
  const equipe = [{ uid: 'a', nome: 'Ana', departamento: 'fiscal' }, { uid: 'b', nome: 'Bia', departamento: 'dp' }, { uid: 'c', nome: 'Caio', departamento: 'fiscal' }];
  it('só os destinatários veem; quem escreveu também', () => {
    expect(avisoParaMim({}, { uid: 'b' })).toBe(true);
    expect(avisoParaMim({ para: { tipo: 'setor', setores: ['fiscal'] } }, { uid: 'b', departamento: 'dp' })).toBe(false);
    expect(avisoParaMim({ para: { tipo: 'setor', setores: ['fiscal'] } }, { uid: 'a', departamento: 'fiscal' })).toBe(true);
    expect(avisoParaMim({ para: { tipo: 'pessoas', pessoas: [{ uid: 'c', nome: 'Caio' }] }, porUid: 'b' }, { uid: 'b' })).toBe(true);
    expect(avisoParaMim({ para: { tipo: 'pessoas', pessoas: [{ uid: 'c', nome: 'Caio' }] } }, { uid: 'a' })).toBe(false);
  });
  it('quem falta marcar o Recebido', () => {
    const a: AvisoDoEscritorio = { id: '1', texto: 'x', por: 'Nilma', porUid: 'n', em: '', pedeConfirmacao: true, para: { tipo: 'setor' as const, setores: ['fiscal'] } };
    expect(faltaReceber(a, equipe).map(p => p.nome)).toEqual(['Ana', 'Caio']);
    const marcado = comRecebido(a, { uid: 'a', nome: 'Ana' }, 'agora');
    expect(faltaReceber(marcado, equipe).map(p => p.nome)).toEqual(['Caio']);
    expect(comRecebido(marcado, { uid: 'a', nome: 'Ana' }, 'depois').recebidos).toHaveLength(1);
    expect(faltaReceber({ ...a, pedeConfirmacao: false }, equipe)).toEqual([]);
    expect(rotuloDoDestino(a.para, [{ id: 'fiscal', rotulo: 'Fiscal' }])).toBe('Fiscal');
  });
  it('grava o destino e o pedido de confirmação', () => {
    expect(camposDoComunicado({ tipo: 'aviso', titulo: '', link: '', quando: '', pedeConfirmacao: true, para: { tipo: 'pessoas', pessoas: [{ uid: 'c', nome: 'Caio' }] } }))
      .toEqual({ pedeConfirmacao: true, para: { tipo: 'pessoas', pessoas: [{ uid: 'c', nome: 'Caio' }] } });
    expect(problemaDoComunicado('x', { tipo: 'aviso', titulo: '', link: '', quando: '', para: { tipo: 'setor', setores: [] } })).toMatch(/setor/);
  });
});

describe('o jeito do aviso', () => {
  const base = { tipo: 'aviso' as const, titulo: '', link: 'https://x.com', quando: '' };
  it('a norma pede o PDF; o aviso não tem link', () => {
    expect(problemaDoComunicado('x', { ...base, jeito: 'norma' })).toMatch(/PDF/);
    expect(problemaDoComunicado('x', { ...base, jeito: 'norma', comPdf: true })).toBe('');
    expect(camposDoComunicado({ ...base, jeito: 'datas' })).toEqual({ jeito: 'datas' });
    expect(camposDoComunicado({ ...base, jeito: 'normal' })).toEqual({});
    expect(rotuloDoTipoDoAviso({ jeito: 'norma' })).toBe('Norma da empresa');
    expect(rotuloDoTipoDoAviso({ tipo: 'estudo' })).toBe('Estudo da legislação');
  });
});
