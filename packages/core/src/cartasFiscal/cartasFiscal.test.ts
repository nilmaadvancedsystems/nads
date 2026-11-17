import { describe, expect, it } from 'vitest';
import {
  anoSugeridoDoBalanco, checklistDeHoje, checklistEmTexto, configDoChecklist, dadosDaCarta, dataPorExtenso, diaDoChecklist,
  emailDaCarta, emailDoChecklist, idDoChecklist, juntar, nomeDoPdfDaCarta, pedidoDaCarta, podeMandarDeNovo, prazoDoChecklist,
  prazoPadraoDoBalanco, problemaDaCarta, situacaoPorCliente, textoDaCarta, textoDaDeclaracao, type RegistroDoEnvio,
} from './index';

describe('a Carta de balanço', () => {
  const d = dadosDaCarta({ empresa: '  Marisfrutas   LTDA ', ano: 2025, prazo: '2026-01-10', hoje: new Date(2025, 11, 5) });

  it('os dados do modelo: o inventário em 31/12, o prazo, o ano seguinte e o local com a data por extenso', () => {
    expect(d).toEqual({ empresa: 'Marisfrutas LTDA', ano: 2025, inventarioEm: '31/12/2025', prazo: '10/01/2026', proximoAno: 2026, localEData: 'Taiobeiras - MG, 05 de Dezembro de 2025.' });
    expect(dataPorExtenso(new Date(2026, 0, 2))).toBe('02 de Janeiro de 2026');
  });

  it('o texto da carta e o da declaração, com a empresa, o ano e o prazo', () => {
    const c = textoDaCarta(d);
    expect(juntar(c.paragrafos[0])).toContain('referente ao ano de 2025');
    expect(juntar(c.paragrafos[0])).toContain('em 31/12/2025 e nos fazer a entrega do mesmo no máximo até 10/01/2026, em formato eletrônico: txt ou Excel.');
    expect(c.paragrafos[0].filter(t => t.negrito).map(t => t.texto)).toEqual(['10/01/2026', 'txt ou Excel']);
    expect(c.votos).toBe('Desejamos-lhe(s) um feliz natal e um ano de 2026 repleto de realizações!');
    const dec = textoDaDeclaracao(d).paragrafos[0];
    expect(juntar(dec)).toContain('minha empresa Marisfrutas LTDA, inventariado em 31/12/2025 é de R$');
    expect(dec.filter(t => t.negrito).map(t => t.texto)).toEqual(['Marisfrutas LTDA', '31/12/2025']);
  });

  it('o prazo de sempre (10 de janeiro do ano seguinte) e o ano que a tela sugere', () => {
    expect(prazoPadraoDoBalanco(2026)).toBe('2027-01-10');
    expect(anoSugeridoDoBalanco(new Date(2026, 10, 12))).toBe(2026);
    expect(anoSugeridoDoBalanco(new Date(2027, 0, 5))).toBe(2026);
  });

  it('o ano e o prazo têm que fazer sentido', () => {
    expect(problemaDaCarta(2026, '2027-01-10')).toBe('');
    expect(problemaDaCarta(2026, '2026-12-31')).toContain('depois de 31/12/2026');
    expect(problemaDaCarta(2026, '2028-01-10')).toContain('passa do ano seguinte');
    expect(problemaDaCarta(2026, '2027-02-30')).toContain('não é uma data válida');
    expect(problemaDaCarta(2026, '')).toContain('falta o prazo');
    expect(problemaDaCarta(1999, '2000-01-10')).toContain('ano');
  });

  it('o e-mail e o nome do anexo', () => {
    const e = emailDaCarta(d);
    expect(e.assunto).toBe('Carta de balanço 2025 · Marisfrutas LTDA');
    expect(e.texto).toContain('em 31/12/2025 e o envio até 10/01/2026');
    expect(e.texto).toContain('um 2026 repleto');
    expect(nomeDoPdfDaCarta('A/B: "LTDA"', 2025)).toBe('Carta de balanço 2025 - A B LTDA.pdf');
  });

  it('o pedido na fila do robô: do Fiscal, com quem pediu; sem código ou com prazo errado, não sai', () => {
    const quem = { nome: 'Adivânia', email: 'Fiscal@X.com ', uid: 'u1' };
    const agora = new Date('2026-12-05T12:00:00Z');
    expect(pedidoDaCarta({ codigo: 58, empresa: 'Marisfrutas LTDA', ano: 2026, prazo: '2027-01-10', quem, agora })).toEqual({
      tipo: 'cartaBalanco', status: 'pendente', departamento: 'fiscal', origem: 'nads', codigo: '58', empresa: 'Marisfrutas LTDA', ano: 2026,
      prazo: '2027-01-10', teste: false, criadoEm: '2026-12-05T12:00:00.000Z', criadoPor: 'Adivânia', criadoPorEmail: 'fiscal@x.com', criadoPorUid: 'u1',
    });
    expect(pedidoDaCarta({ codigo: '58', empresa: 'M', ano: 2026, prazo: '2027-01-10', teste: true, quem, agora }).teste).toBe(true);
    expect(() => pedidoDaCarta({ codigo: '', empresa: 'M', ano: 2026, prazo: '2027-01-10', quem, agora })).toThrow('sem código');
    expect(() => pedidoDaCarta({ codigo: 58, empresa: 'M', ano: 2026, prazo: '2026-12-01', quem, agora })).toThrow('depois de 31/12/2026');
  });
});

describe('a situação de cada cliente', () => {
  const r = (x: Partial<RegistroDoEnvio>): RegistroDoEnvio => ({ id: 'x', tipo: 'cartaBalanco', status: 'pendente', codigo: '58', ano: 2026, criadoEm: '2026-12-01T10:00:00Z', ...x });

  it('o pedido mais novo vale; o teste e outro ano ficam de fora', () => {
    const s = situacaoPorCliente([
      r({ status: 'erro', erro: 'sem e-mail', criadoEm: '2026-12-01T10:00:00Z' }),
      r({ status: 'pendente', criadoEm: '2026-12-02T10:00:00Z' }),
      r({ codigo: '7', status: 'enviado', enviadoEm: '2026-12-02T11:00:00Z', para: ['a@b.com'] }),
      r({ codigo: '9', status: 'enviado', teste: true }),
      r({ codigo: '10', status: 'enviado', ano: 2025 }),
    ], 'cartaBalanco', { ano: 2026 });
    expect(s['58'].situacao).toBe('fila');
    expect(s['7']).toEqual({ situacao: 'enviada', em: '2026-12-02T11:00:00Z', erro: '', para: ['a@b.com'] });
    expect(s['9']).toBeUndefined();
    expect(s['10']).toBeUndefined();
  });

  it('a carta já enviada não volta a erro por uma tentativa depois', () => {
    const s = situacaoPorCliente([r({ status: 'enviado', enviadoEm: 'a' }), r({ status: 'erro', criadoEm: '2026-12-03T10:00:00Z' })], 'cartaBalanco', { ano: 2026 });
    expect(s['58'].situacao).toBe('enviada');
  });

  it('só manda de novo quem não tem pedido ou deu erro', () => {
    expect(podeMandarDeNovo(undefined)).toBe(true);
    expect(podeMandarDeNovo({ situacao: 'erro', em: '', erro: 'x', para: [] })).toBe(true);
    expect(podeMandarDeNovo({ situacao: 'fila', em: '', erro: '', para: [] })).toBe(false);
    expect(podeMandarDeNovo({ situacao: 'enviada', em: '', erro: '', para: [] })).toBe(false);
  });

  it('o checklist por competência', () => {
    const s = situacaoPorCliente([
      { id: idDoChecklist('2026-11', 58), tipo: 'checklistMensal', status: 'enviado', codigo: '58', competencia: '2026-11', enviadoEm: 'e' },
      { id: idDoChecklist('2026-10', 7), tipo: 'checklistMensal', status: 'enviado', codigo: '7', competencia: '2026-10' },
    ], 'checklistMensal', { competencia: '2026-11' });
    expect(Object.keys(s)).toEqual(['58']);
    expect(idDoChecklist('2026-11', 58)).toBe('checklist_2026-11_58');
  });
});

describe('o Checklist mensal', () => {
  it('sai no último dia útil do mês (sem fim de semana nem feriado nacional)', () => {
    expect(diaDoChecklist('2026-11')).toBe('2026-11-30'); // segunda
    expect(diaDoChecklist('2026-10')).toBe('2026-10-30'); // 31 é sábado
    expect(diaDoChecklist('2026-12')).toBe('2026-12-31'); // quinta
    expect(diaDoChecklist('2027-01')).toBe('2027-01-29'); // 30 e 31 no fim de semana
    expect(diaDoChecklist('2026-13')).toBe('');
  });

  it('o prazo do cliente é o 2º dia útil do mês seguinte', () => {
    expect(prazoDoChecklist('2026-11')).toBe('2026-12-02');
    expect(prazoDoChecklist('2026-12')).toBe('2027-01-05'); // 1º de janeiro é feriado; 2 e 3 são fim de semana
    expect(prazoDoChecklist('2027-01')).toBe('2027-02-02');
  });

  it('qual checklist sai hoje: do último dia útil até o fim do mês; antes, nenhum', () => {
    expect(checklistDeHoje('2026-11-27')).toBeNull();
    expect(checklistDeHoje('2026-11-30')).toBe('2026-11');
    expect(checklistDeHoje('2026-10-31')).toBe('2026-10');
    expect(checklistDeHoje('2026-12-01')).toBeNull();
    expect(checklistDeHoje('')).toBeNull();
  });

  it('o e-mail com o mês e o prazo, e o checklist em texto', () => {
    const e = emailDoChecklist('2026-11', ' Marisfrutas LTDA ');
    expect(e.assunto).toBe('Checklist de documentos de novembro de 2026 · Marisfrutas LTDA');
    expect(e.texto).toContain('até 02/12/2026');
    const t = checklistEmTexto();
    expect(t).toContain('1) DOCUMENTOS FISCAIS (OBRIGATÓRIO TODO MÊS)');
    expect(t).toContain('  - Extratos bancários de TODAS as contas da empresa (PDF e OFX)');
    expect(t).toContain('ATENÇÃO:');
  });

  it('a configuração: ligado sem nada escrito, os códigos de fora limpos', () => {
    expect(configDoChecklist(undefined)).toEqual({ ligado: true, fora: [] });
    expect(configDoChecklist({ ligado: false, fora: [58, ' 7 ', 'x', 58] })).toEqual({ ligado: false, fora: ['58', '7'] });
  });
});
