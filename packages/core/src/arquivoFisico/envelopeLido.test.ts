import { describe, expect, it } from 'vitest';
import { adicionarEnvelopes, codigoDoEnvelope, lerCodigoDoEnvelope, linkDoEnvelope, montarCaixa, procurarEnvelope, type RascunhoDaCaixa } from './index';

const r = (x: Partial<RascunhoDaCaixa> = {}): RascunhoDaCaixa => ({ codigo: 37, nome: 'A EXEMPLO', tipo: 'PJ-F', departamento: 'Fiscal', ano: 2026, numero: 1, arquivadaEm: '2026-11-19', local: 'Prateleira 1 · Fileira 1', observacoes: '', ...x });
const caixa = (x: Partial<RascunhoDaCaixa> = {}, meses: string[] = []) => adicionarEnvelopes(montarCaixa(r(x), 'x', 'agora'), meses, (x.departamento || 'Fiscal'), '', 'x', 'agora').caixa;

describe('o QR do envelope', () => {
  it('o código diz a empresa, o departamento e o mês, e volta igual', () => {
    expect(codigoDoEnvelope({ codigo: 37, departamento: 'Fiscal', competencia: '2026-05' })).toBe('37-F-2026-05');
    expect(codigoDoEnvelope({ codigo: 5, departamento: 'Pessoal', competencia: '2025' })).toBe('5-P-2025');
    expect(lerCodigoDoEnvelope('37-F-2026-05')).toEqual({ codigo: 37, departamento: 'Fiscal', competencia: '2026-05' });
    expect(lerCodigoDoEnvelope(' 12-c-2026 ')).toEqual({ codigo: 12, departamento: 'Contábil', competencia: '2026' });
    expect(lerCodigoDoEnvelope('37-X-2026-05')).toBeNull();
    expect(lerCodigoDoEnvelope('37-F-2026-13')).toBeNull();
    expect(lerCodigoDoEnvelope('')).toBeNull();
    expect(linkDoEnvelope('https://nads.exemplo/', { codigo: 37, departamento: 'Fiscal', competencia: '2026-05' })).toBe('https://nads.exemplo/tarefas/arquivo-fisico/caixas?envelope-lido=37-F-2026-05');
  });

  it('guardado: a caixa e o envelope (o sem observação primeiro)', () => {
    const c = adicionarEnvelopes(caixa({}, ['2026-05']), ['2026-05'], 'Fiscal', 'Notas', 'x', 'agora').caixa;
    const achado = procurarEnvelope([caixa({ codigo: 10 }, ['2026-05']), c], { codigo: 37, departamento: 'Fiscal', competencia: '2026-05' });
    expect(achado.situacao).toBe('guardado');
    if (achado.situacao === 'guardado') { expect(achado.caixa.id).toBe('37-2026-F-001'); expect(achado.envelope.observacao).toBe(''); }
  });

  it('solto: as caixas da empresa, do ano e do departamento, a mais nova primeiro; a descartada e as outras não', () => {
    const cs = [
      caixa({}, ['2026-01']), caixa({ numero: 2 }, ['2026-02']), caixa({ ano: 2025 }), caixa({ departamento: 'Pessoal', tipo: 'PJ-P' }),
      { ...caixa({ numero: 3 }), descartadaEm: '2026-11-01' }, caixa({ codigo: 10 }),
    ];
    const achado = procurarEnvelope(cs, { codigo: 37, departamento: 'Fiscal', competencia: '2026-05' });
    expect(achado.situacao).toBe('solto');
    if (achado.situacao === 'solto') expect(achado.caixas.map(c => c.id)).toEqual(['37-2026-F-002', '37-2026-F-001']);
    // sem caixa nenhuma da empresa naquele ano: a lista vazia (a tela oferece criar)
    const nada = procurarEnvelope(cs, { codigo: 99, departamento: 'Fiscal', competencia: '2026-05' });
    expect(nada).toEqual({ situacao: 'solto', caixas: [] });
  });
});

describe('impresso → arquivado', () => {
  it('imprimir registra só o que não está em caixa; reimprimir não duplica', async () => {
    const { novosImpressos } = await import('./index');
    const cs = [caixa({}, ['2026-01'])];
    const novos = novosImpressos([
      { ref: { codigo: 37, departamento: 'Fiscal', competencia: '2026-01' }, nome: 'A' },
      { ref: { codigo: 37, departamento: 'Fiscal', competencia: '2026-05' }, nome: 'A' },
      { ref: { codigo: 37, departamento: 'Fiscal', competencia: '2026-05' }, nome: 'A' },
      { ref: { codigo: 10, departamento: 'Pessoal', competencia: '2026-05' }, nome: 'B' },
    ], cs, 'Ana', '2026-11-19T10:00:00.000Z');
    expect(novos.map(x => x.id)).toEqual(['37-F-2026-05', '10-P-2026-05']);
    expect(novos[0]).toMatchObject({ impressoPor: 'Ana', arquivadoEm: '', caixa: '' });
  });

  it('aguardando: sem confirmação e que ninguém guardou; confirmar tira da fila', async () => {
    const { novosImpressos, aguardandoArquivamento, arquivarImpresso, lerImpresso, impressoParaOBanco } = await import('./index');
    const [a, b] = novosImpressos([
      { ref: { codigo: 37, departamento: 'Fiscal', competencia: '2026-05' }, nome: 'A' },
      { ref: { codigo: 37, departamento: 'Fiscal', competencia: '2026-06' }, nome: 'A' },
    ], [], 'Ana', '2026-11-19T10:00:00.000Z');
    expect(aguardandoArquivamento([a, b], []).map(x => x.id)).toEqual(['37-F-2026-05', '37-F-2026-06']);
    // junho foi guardado direto na caixa (sem passar pelo QR): sai da fila também
    const cs = [caixa({}, ['2026-06'])];
    const conf = arquivarImpresso(a, '37-2026-F-001', 'Bia', '2026-11-19T11:00:00.000Z');
    expect(aguardandoArquivamento([conf, b], cs)).toEqual([]);
    expect(conf).toMatchObject({ arquivadoPor: 'Bia', caixa: '37-2026-F-001' });
    // o banco: ida e volta, e o id que não é de envelope fica de fora
    expect(lerImpresso(conf.id, JSON.parse(JSON.stringify(impressoParaOBanco(conf))))).toEqual(conf);
    expect(lerImpresso('lixo', {})).toBeNull();
  });

  it('o envelope guardado leva quem arquivou e quando', () => {
    const c = adicionarEnvelopes(montarCaixa(r(), 'x', 'agora'), ['2026-05'], 'Fiscal', '', 'Bia', '2026-11-19T11:00:00.000Z').caixa;
    expect(c.envelopes[0]).toMatchObject({ arquivadoPor: 'Bia', arquivadoEm: '2026-11-19T11:00:00.000Z' });
  });
});
