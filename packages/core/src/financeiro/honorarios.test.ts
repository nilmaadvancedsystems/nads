import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { competenciaAnterior, linkDoWhatsapp, mensagemDeCobranca, seloDaNfse, telefoneParaWhatsapp, conferirRecebimento, descricaoDoRecebimento, idDoRecebimento, linhasDosHonorarios, planilhaDosHonorarios, situacaoDaCompetencia, type ContratoDeHonorario, type RecebimentoDeHonorario } from './index';

const c = (id: string, codigo: string, nome: string, valor: number, ativo = true): ContratoDeHonorario => ({ id, clienteId: '', codigo, nome, cnpj: '11222333000181', valor, ativo, criadoEm: '', criadoPor: '' });
const r = (contratoId: string, competencia: string, valor: number, forma: RecebimentoDeHonorario['forma'] = 'pix'): RecebimentoDeHonorario =>
  ({ id: idDoRecebimento(contratoId, competencia), contratoId, competencia, valor, recebidoEm: '2026-10-05', forma, por: 'x', em: '' });
const contratos = [c('b', '10', 'Beta Ltda', 300.5), c('a', '2', 'Alfa Ltda', 450), c('z', '3', 'Inativa', 999, false), c('d', '11', 'Delta', 0)];
const recebimentos = [r('a', '2026-09', 450), r('b', '2026-08', 300.5), r('z', '2026-09', 999)];

describe('os honorários', () => {
  it('a competência padrão é o mês anterior', () => {
    expect(competenciaAnterior('2026-10-19')).toBe('2026-09');
    expect(competenciaAnterior('2026-01-02')).toBe('2025-12');
  });
  it('soma só os contratos ativos e conta pagos e em aberto por competência', () => {
    const s = situacaoDaCompetencia(contratos, recebimentos, '2026-09');
    expect(s.total).toBe(3);
    expect(s.previsto).toBe(750.5);
    expect(s.recebido).toBe(450);
    expect(s.emAberto).toBe(300.5);
    expect(s.pagos).toBe(1);
    expect(s.linhas.map(l => l.contrato.id)).toEqual(['a', 'b', 'd']);
    // outro mês: ninguém pagou
    expect(situacaoDaCompetencia(contratos, recebimentos, '2026-10').pagos).toBe(0);
  });
  it('filtra por situação e busca sem mudar os números', () => {
    expect(situacaoDaCompetencia(contratos, recebimentos, '2026-09', 'pagos').linhas.map(l => l.contrato.id)).toEqual(['a']);
    const ab = situacaoDaCompetencia(contratos, recebimentos, '2026-09', 'abertos', 'beta');
    expect(ab.linhas.map(l => l.contrato.id)).toEqual(['b']);
    expect(ab.previsto).toBe(750.5);
  });
  it('a descrição do Caixa e o id do recebimento', () => {
    expect(descricaoDoRecebimento(' Alfa Ltda ', '2026-09')).toBe('HC ALFA LTDA 09/2026');
    expect(idDoRecebimento('a', '2026-09')).toBe('a_2026-09');
  });
  it('confere o recebimento', () => {
    const ok = { valor: 10, recebidoEm: '2026-10-05', forma: 'pix' as const, competencia: '2026-09' };
    expect(conferirRecebimento(ok)).toEqual([]);
    expect(conferirRecebimento({ ...ok, valor: 0, recebidoEm: '2026-02-30', competencia: '2026-13' })).toHaveLength(3);
  });
  it('monta a planilha do mês', () => {
    const linhas = situacaoDaCompetencia(contratos, recebimentos, '2026-09').linhas;
    const l = linhasDosHonorarios('2026-09', linhas);
    expect(l[0]).toEqual(['Honorários — 09/2026']);
    expect(l[2]).toEqual(['Cód.', 'Cliente', 'Valor', 'Situação', 'Recebido em', 'Forma']);
    expect(l[3]).toEqual(['2', 'Alfa Ltda', 450, 'Pago', '05/10/2026', 'PIX']);
    expect(l[4]).toEqual(['10', 'Beta Ltda', 300.5, 'Em aberto', '', '']);
    const ws = XLSX.read(planilhaDosHonorarios('2026-09', linhas), { type: 'array' }).Sheets['Honorários'];
    expect(ws['C4'].v).toBe(450);
  });
});

const nota = (status: string, documento: string, competencia: string, numeroNfse = '') => ({ status, numeroNfse, tomador: { documento }, servico: { competencia } });
describe('a NFS-e do honorário', () => {
  const cnpj = '11222333000181';
  it('casa pelo CNPJ e pelo mês do serviço', () => {
    expect(seloDaNfse([nota('autorizada', '11.222.333/0001-81', '2026-09-30', '123')], cnpj, '2026-09')).toEqual({ rotulo: 'NFS-e 123', tom: 'ok' });
    expect(seloDaNfse([nota('autorizada', cnpj, '2026-08-31', '9')], cnpj, '2026-09')).toBeNull();
    expect(seloDaNfse([nota('autorizada', '99999999999999', '2026-09-30', '9')], cnpj, '2026-09')).toBeNull();
    expect(seloDaNfse([], '', '2026-09')).toBeNull();
  });
  it('a autorizada vale mais, a andando vem depois e a cancelada não conta', () => {
    expect(seloDaNfse([nota('processando', cnpj, '2026-09-30'), nota('autorizada', cnpj, '2026-09-30', '5')], cnpj, '2026-09')?.rotulo).toBe('NFS-e 5');
    expect(seloDaNfse([nota('pedida', cnpj, '2026-09-30')], cnpj, '2026-09')).toEqual({ rotulo: 'NFS-e pedida', tom: 'info' });
    expect(seloDaNfse([nota('erro', cnpj, '2026-09-30')], cnpj, '2026-09')?.tom).toBe('bad');
    expect(seloDaNfse([nota('cancelada', cnpj, '2026-09-30', '4')], cnpj, '2026-09')).toBeNull();
  });
});

describe('a cobrança', () => {
  const d = { nome: 'Alfa Ltda', competencia: '2026-09', valor: 1250.5, pix: '11.222.333/0001-81' };
  it('preenche o modelo', () => {
    expect(mensagemDeCobranca(d)).toBe('Olá, Alfa Ltda! Passando para lembrar do honorário contábil de 09/2026, no valor de R$ 1.250,50. Chave PIX: 11.222.333/0001-81. Qualquer dúvida, estamos à disposição. — Nilma Contabilidade');
  });
  it('sem chave PIX, tira a frase da chave', () => {
    const m = mensagemDeCobranca({ ...d, pix: ' ' });
    expect(m).not.toMatch(/PIX/);
    expect(m).toContain('R$ 1.250,50. Qualquer dúvida');
  });
  it('o link do WhatsApp com o 55 e o texto codificado', () => {
    expect(telefoneParaWhatsapp('(38) 99999-0000')).toBe('5538999990000');
    expect(telefoneParaWhatsapp('5538999990000')).toBe('5538999990000');
    expect(telefoneParaWhatsapp('999')).toBe('');
    expect(linkDoWhatsapp('38999990000', 'Olá & tchau')).toBe('https://wa.me/5538999990000?text=Ol%C3%A1%20%26%20tchau');
    expect(linkDoWhatsapp('', 'x')).toBe('');
  });
});
