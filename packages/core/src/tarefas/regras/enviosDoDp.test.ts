import { describe, expect, it } from 'vitest';
import { arquivosJaEnviados, envioMarcaAEtapa, valoresDoLoteQueVao, type ResultadoComValores } from './enviosDoDp';
import { execucaoNova, fazer, informarValor, voltarPara } from './execucao';

const nova = () => execucaoNova('CONSTRUTOP MATERIAIS DE CONSTRUCAO LTDA', 593, '2026-10', 'dp');
const enviadoEm = '2026-10-30T13:00:00.000Z';

describe('DP › Envios: o cliente está enviado quando todos os arquivos do mês foram', () => {
  const doMes = ['fgts', 'folha', 'darf', 'recibo'];

  it('"Enviar só este" com 1 de 4: não está completo', () => {
    expect(arquivosJaEnviados(doMes, [{ status: 'enviado', arquivos: ['fgts'] }])).toEqual({ enviados: 1, total: 4, completo: false });
  });

  it('os pedidos do mês somam: o resto foi depois', () => {
    const r = arquivosJaEnviados(doMes, [{ status: 'enviado', arquivos: ['fgts'] }, { status: 'enviado', arquivos: ['folha', 'darf', 'recibo'] }]);
    expect(r.completo).toBe(true);
  });

  it('o pedido com erro ou na fila não conta', () => {
    const r = arquivosJaEnviados(doMes, [{ status: 'erro', arquivos: doMes }, { status: 'pendente', arquivos: doMes }]);
    expect(r).toEqual({ enviados: 0, total: 4, completo: false });
  });

  it('o pedido sem arquivos escolhidos levou todos (como o robô faz)', () => {
    expect(arquivosJaEnviados(doMes, [{ status: 'enviado', arquivos: [] }]).completo).toBe(true);
  });

  it('o arquivo novo na pasta depois do envio ainda falta', () => {
    expect(arquivosJaEnviados([...doMes, 'ferias'], [{ status: 'enviado', arquivos: doMes }]).completo).toBe(false);
  });
});

describe('DP › Envios: o envio marca a Entrega, mas quem mexeu depois decide', () => {
  it('sem nada na etapa, o envio marca', () => {
    expect(envioMarcaAEtapa(null, 'dp-envio', enviadoEm)).toBe(true);
    expect(envioMarcaAEtapa(nova(), 'dp-envio', enviadoEm)).toBe(true);
  });

  it('já marcada pelo envio (ou depois dele): não marca de novo', () => {
    const ex = fazer(nova(), 'dp-envio', 'Savio', new Date(enviadoEm)).execucao;
    expect(envioMarcaAEtapa(ex, 'dp-envio', enviadoEm)).toBe(false);
  });

  it('desfeita depois do envio: não volta a marcar (a etapa apagada guarda quando foi desfeita)', () => {
    const marcada = fazer(nova(), 'dp-envio', 'Savio', new Date(enviadoEm)).execucao;
    const desfeita = voltarPara(marcada, 'dp-envio', 'Heverton', new Date('2026-10-30T14:00:00.000Z')).execucao;
    expect(desfeita.etapas['dp-envio']).toBeUndefined();
    expect(desfeita.reabertas?.['dp-envio']).toBe('2026-10-30T14:00:00.000Z');
    expect(envioMarcaAEtapa(desfeita, 'dp-envio', enviadoEm)).toBe(false);
  });

  it('desfeita antes de um envio novo: o envio novo marca', () => {
    const desfeita = voltarPara(fazer(nova(), 'dp-envio', 'Savio', new Date(enviadoEm)).execucao, 'dp-envio', 'Heverton', new Date('2026-10-30T14:00:00.000Z')).execucao;
    expect(envioMarcaAEtapa(desfeita, 'dp-envio', '2026-10-30T15:00:00.000Z')).toBe(true);
  });

  it('marcada antes do envio (ex.: dispensada): o envio marca como feita', () => {
    const ex = fazer(nova(), 'dp-envio', 'Savio', new Date('2026-10-29T10:00:00.000Z')).execucao;
    expect(envioMarcaAEtapa(ex, 'dp-envio', enviadoEm)).toBe(true);
  });
});

describe('DP › Lote: os valores vão para a execução só do lote mais novo', () => {
  const r = (enviadoEm: string, valores: Record<string, number>, codigo = 593): ResultadoComValores => ({ codigo, competencia: '2026-10', status: 'enviado', enviadoEm, valores });
  const antigo = r('2026-10-28T10:00:00.000Z', { fgts: 100, darf: 50 });
  const novo = r('2026-10-29T10:00:00.000Z', { fgts: 120 });

  it('a execução vazia recebe tudo', () => {
    expect(valoresDoLoteQueVao(antigo, [antigo, novo], null)).toEqual({ fgts: 100, darf: 50 });
  });

  it('o valor igual não vai de novo', () => {
    const ex = informarValor(nova(), 'dp-fgts', 'fgts', 100, 'Savio', new Date(antigo.enviadoEm)).execucao;
    expect(valoresDoLoteQueVao(antigo, [antigo], ex)).toEqual({ darf: 50 });
  });

  it('abrir o lote antigo não troca o valor do lote mais novo (com a marca de quando veio)', () => {
    let ex = informarValor(nova(), 'dp-fgts', 'fgts', 100, 'Savio', new Date(antigo.enviadoEm)).execucao;
    ex = informarValor(ex, 'dp-darf', 'darf', 50, 'Savio', new Date(antigo.enviadoEm)).execucao;
    ex = informarValor(ex, 'dp-fgts', 'fgts', 120, 'Savio', new Date(novo.enviadoEm)).execucao;
    expect(valoresDoLoteQueVao(antigo, [antigo, novo], ex)).toEqual({});
  });

  it('o lote mais novo troca o valor de um lote antigo', () => {
    const ex = informarValor(nova(), 'dp-fgts', 'fgts', 100, 'Savio', new Date(antigo.enviadoEm)).execucao;
    expect(valoresDoLoteQueVao(novo, [antigo, novo], ex)).toEqual({ fgts: 120 });
  });

  it('o valor corrigido à mão depois do envio fica', () => {
    const ex = informarValor(nova(), 'dp-fgts', 'fgts', 110, 'Heverton', new Date('2026-10-29T12:00:00.000Z')).execucao;
    expect(valoresDoLoteQueVao(novo, [antigo, novo], ex)).toEqual({});
  });

  it('o valor sem a marca (gravado antes dela): só o lote mais novo do cliente/mês com aquele valor troca', () => {
    const ex = { ...nova(), valores: { fgts: 120, darf: 50 } };
    expect(valoresDoLoteQueVao(antigo, [antigo, novo], ex)).toEqual({});
    // a DARF só veio no antigo: ele é o mais novo com a DARF
    expect(valoresDoLoteQueVao(antigo, [antigo, novo], { ...ex, valores: { fgts: 120, darf: 40 } })).toEqual({ darf: 50 });
    // o lote de outro cliente não conta
    expect(valoresDoLoteQueVao(antigo, [antigo, r('2026-10-29T10:00:00.000Z', { fgts: 1 }, 7)], { ...ex, valores: { fgts: 90 } })).toEqual({ fgts: 100, darf: 50 });
  });
});
