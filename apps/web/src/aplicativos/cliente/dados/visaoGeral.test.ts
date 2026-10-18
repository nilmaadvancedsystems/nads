import type { areaCliente as ac } from '@nads/core';
import { describe, expect, it } from 'vitest';
import { areaComoNoBanco, areaDeExemplo } from './areaCliente.memoria';
import { atividadeRecente, guiasDoMomento, pendenciasDoCliente, quandoFoi, vereditoDoMes } from './visaoGeral';

const hoje = new Date(2026, 9, 17, 10, 0);
const guia = (id: string, tipo: ac.TipoDeGuia, vencimento: string, temPdf = true): ac.GuiaDoCliente =>
  ({ id, tipo, competencia: '2026-09', vencimento, valor: 100, situacao: 'a vencer', temPdf });
const vazio = { guias: [], chamados: [], certificado: null, avisos: [] };

describe('guiasDoMomento', () => {
  it('só as que vencem neste mês ou depois: as dos meses passados (o espelho traz 12 meses de FGTS) ficam de fora', () => {
    const gs = [guia('ago', 'FGTS', '20/08/2026'), guia('set', 'FGTS', '18/09/2026'), guia('out', 'FGTS', '20/10/2026'), guia('das', 'DAS', '12/10/2026'), guia('nov', 'FGTS', '20/11/2026')];
    expect(guiasDoMomento(gs, hoje).map(g => [g.id, g.situacao])).toEqual([['das', 'vencida'], ['out', 'a vencer'], ['nov', 'a vencer']]);
  });
});

describe('pendenciasDoCliente e vereditoDoMes', () => {
  it('sem nada: tudo em dia, com a próxima guia', () => {
    const p = pendenciasDoCliente({ ...vazio, guias: [guia('out', 'FGTS', '20/10/2026')] }, hoje);
    expect(p).toEqual([]);
    expect(vereditoDoMes(p, guiasDoMomento([guia('out', 'FGTS', '20/10/2026')], hoje))).toEqual({ tom: 'ok', titulo: 'Tudo em dia', texto: 'Nada pendente com você. A próxima guia, do FGTS, vence em 20/10.' });
    expect(vereditoDoMes([], []).texto).toBe('Nada pendente com você.');
  });
  it('a guia vencida pede uma nova; a de hoje baixa; a resposta do escritório abre o chamado', () => {
    const p = pendenciasDoCliente({
      ...vazio,
      guias: [guia('das', 'DAS', '12/10/2026'), guia('fgts', 'FGTS', '17/10/2026'), guia('velha', 'FGTS', '18/09/2026')],
      chamados: [
        { id: 'c1', tipo: 'documento', titulo: 'Certidão', situacao: 'respondido', mensagens: [] },
        { id: 'c2', tipo: 'duvida', titulo: 'Outra', situacao: 'em andamento', mensagens: [] },
      ],
    }, hoje);
    expect(p.map(x => [x.id, x.tom, x.rotulo])).toEqual([['g-das', 'bad', 'Pedir guia nova'], ['g-fgts', 'warn', 'Baixar guia'], ['c-c1', 'warn', 'Ver resposta']]);
    expect(p[0].titulo).toBe('O DAS venceu em 12/10');
    expect(p[0].acao).toEqual({ tipo: 'pedir-guia', titulo: 'Guia nova do DAS (competência 09/2026)' });
    expect(p[1].acao).toEqual({ tipo: 'baixar-guia', guia: 'fgts' });
    expect(vereditoDoMes(p, [])).toEqual({ tom: 'bad', titulo: 'Você tem 3 pendências', texto: '1 guia vencida, 1 guia vence hoje e 1 resposta do escritório.' });
  });
  it('uma só: o veredito é ela', () => {
    const p = pendenciasDoCliente({ ...vazio, chamados: [{ id: 'c1', tipo: 'documento', titulo: 'Certidão negativa', situacao: 'respondido', mensagens: [] }] }, hoje);
    expect(vereditoDoMes(p, [])).toEqual({ tom: 'warn', titulo: 'O escritório respondeu', texto: 'Certidão negativa' });
  });
  it('sem PDF, a guia de hoje leva para Guias; o recado sem destino não entra', () => {
    const p = pendenciasDoCliente({ ...vazio, guias: [guia('fgts', 'FGTS', '17/10/2026', false)], avisos: [{ id: 'a', titulo: 'Oi', texto: 'só um recado' }, { id: 'b', titulo: 'Extratos', texto: 'mande', ir: 'documentos' }] }, hoje);
    expect(p.map(x => x.acao)).toEqual([{ tipo: 'ir', aba: 'guias' }, { tipo: 'enviar' }]);
  });
  it('o exemplo como no banco: a guia vencida e a resposta; o vazio: tudo em dia', () => {
    const real = areaComoNoBanco(hoje);
    expect(pendenciasDoCliente(real, hoje).map(x => x.origem)).toEqual(['guia', 'chamado']);
    const vazia = areaComoNoBanco(hoje, true);
    expect(vereditoDoMes(pendenciasDoCliente(vazia, hoje), guiasDoMomento(vazia.guias, hoje)).titulo).toBe('Tudo em dia');
    // o exemplo completo: a vencida, a resposta, o certificado e o recado dos extratos (4, o mais urgente primeiro)
    expect(pendenciasDoCliente(areaDeExemplo(hoje), hoje).map(x => x.origem)).toEqual(['guia', 'chamado', 'certificado', 'aviso']);
  });
});

describe('atividadeRecente', () => {
  it('o mais novo primeiro, sem o que ainda não aconteceu, no limite', () => {
    const a = atividadeRecente({
      envios: [{ id: 'e1', nome: 'extrato.pdf', tipo: 'extrato', tamanho: 1, recebidoEm: '2026-10-11T12:12:00.000Z' }],
      chamados: [{ id: 'c1', tipo: 'documento', titulo: 'Certidão', situacao: 'respondido', mensagens: [
        { de: 'cliente', autor: 'Você', texto: 'a', em: '2026-10-14T13:05:00.000Z' },
        { de: 'escritorio', autor: 'Escritório', texto: 'b', em: '2026-10-15T12:40:00.000Z' },
        { de: 'cliente', autor: 'Você', texto: 'c', em: '2026-10-16T12:40:00.000Z' },
      ] }],
      agenda: [{ mes: '2026-10', itens: [
        { id: 'dctf', nome: 'DCTFWeb', vence: '2026-10-15', situacao: 'feito', feitoEm: '2026-10-12T18:30:00.000Z' },
        { id: 'fgts', nome: 'FGTS', vence: '2026-10-20', situacao: 'feito', feitoEm: '2026-10-20T18:30:00.000Z' },
        { id: 'das', nome: 'DAS', vence: '2026-10-20', situacao: 'a fazer' },
      ] }],
      documentos: [],
    }, hoje);
    expect(a.map(x => x.titulo)).toEqual(['Você respondeu', 'O escritório respondeu', 'Você abriu um chamado', 'DCTFWeb', 'Recebemos seu arquivo']);
    expect(a[1]).toMatchObject({ origem: 'resposta', chamado: 'c1' });
    expect(atividadeRecente({ envios: [], chamados: [], agenda: [], documentos: [] }, hoje)).toEqual([]);
  });
});

describe('quandoFoi', () => {
  it('hoje e ontem com a hora; antes, o dia', () => {
    expect(quandoFoi(new Date(2026, 9, 17, 9, 12).toISOString(), hoje)).toBe('hoje, 09:12');
    expect(quandoFoi(new Date(2026, 9, 16, 16, 40).toISOString(), hoje)).toBe('ontem, 16:40');
    expect(quandoFoi(new Date(2026, 9, 11, 9, 0).toISOString(), hoje)).toBe('11/10');
    expect(quandoFoi('', hoje)).toBe('');
  });
});
