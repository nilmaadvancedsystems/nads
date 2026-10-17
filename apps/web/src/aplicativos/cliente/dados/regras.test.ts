import { describe, expect, it } from 'vitest';
import type { DocumentoDoCliente, Empregado } from './areaCliente';
import { linkDoWhatsapp, erroDaAdmissao, erroDaDemissao, erroDasFerias, filtrarDocumentos, juntarPedacosDoPdf, mesesDosDocumentos, notificacoes, resumoDoPessoal, situacaoDoCertificado, textoDaAdmissao, textoDoChamado } from './regras';

const hoje = new Date(2026, 9, 16, 9, 0);

describe('situacaoDoCertificado', () => {
  it('em ordem, perto de vencer e vencido', () => {
    expect(situacaoDoCertificado({ tipo: 'A1', titular: 'X', validoAte: '2027-03-14' }, hoje).tom).toBe('ok');
    const perto = situacaoDoCertificado({ tipo: 'A1', titular: 'X', validoAte: '2026-10-30' }, hoje);
    expect(perto).toMatchObject({ tom: 'warn', dias: 14 });
    expect(perto.texto).toContain('faltam 14 dias');
    expect(situacaoDoCertificado({ tipo: 'A1', titular: 'X', validoAte: '2026-10-16' }, hoje).texto).toContain('(hoje)');
    expect(situacaoDoCertificado({ tipo: 'A1', titular: 'X', validoAte: '2026-10-15' }, hoje).tom).toBe('bad');
  });
});

describe('resumoDoPessoal', () => {
  const e = (id: string, admissao: string, salario: number, ferias: Empregado['ferias'] = 'em dia'): Empregado => ({ id, nome: id, cpf: '', cargo: '', admissao, salario, ferias });
  it('conta ativos, férias, folha e admissões do ano', () => {
    expect(resumoDoPessoal([e('a', '2021-03-12', 5400), e('b', '2026-02-01', 2450.5, 'em ferias'), e('c', '2026-08-10', 1850)], hoje))
      .toEqual({ ativos: 3, emFerias: 1, folha: 9700.5, admissoesNoAno: 2 });
  });
});

describe('documentos', () => {
  const d = (id: string, nome: string, area: DocumentoDoCliente['area'], competencia: string, enviadoEm: string): DocumentoDoCliente =>
    ({ id, nome, descricao: '', area, competencia, enviadoEm, novo: false, formato: 'PDF' });
  const docs = [d('1', 'Balancete', 'contabil', '2026-08', '2026-09-28'), d('2', 'Folha de pagamento', 'dp', '2026-09', '2026-10-03'), d('3', 'Certidão', 'societario', '', '2026-09-15')];
  it('filtra por busca sem acento, área e mês, mais novos primeiro', () => {
    expect(filtrarDocumentos(docs, { busca: '', area: '', mes: '' }).map(x => x.id)).toEqual(['2', '1', '3']);
    expect(filtrarDocumentos(docs, { busca: 'certidao', area: '', mes: '' }).map(x => x.id)).toEqual(['3']);
    expect(filtrarDocumentos(docs, { busca: '', area: 'dp', mes: '' }).map(x => x.id)).toEqual(['2']);
    expect(filtrarDocumentos(docs, { busca: '', area: '', mes: '2026-08' }).map(x => x.id)).toEqual(['1']);
  });
  it('os meses do filtro, sem os documentos sem mês', () => {
    expect(mesesDosDocumentos(docs)).toEqual(['2026-09', '2026-08']);
  });
});

describe('notificacoes', () => {
  it('guia vencida, documentos novos, chamado respondido e certificado perto de vencer', () => {
    const n = notificacoes({
      guias: [{ id: 'g1', tipo: 'DAS', competencia: '2026-09', vencimento: '11/10/2026', valor: 1, situacao: 'vencida', temPdf: true },
        { id: 'g2', tipo: 'FGTS', competencia: '2026-09', vencimento: '20/10/2026', valor: 1, situacao: 'a vencer', temPdf: true }],
      documentos: [{ id: 'd1', nome: 'Balancete', descricao: '', area: 'contabil', competencia: '2026-09', enviadoEm: '', novo: true, formato: 'PDF' }],
      chamados: [{ id: 'c1', tipo: 'duvida', titulo: 'Férias', situacao: 'respondido', mensagens: [] }],
      certificado: { tipo: 'A1', titular: 'X', validoAte: '2026-11-01' },
    }, hoje, g => g.tipo);
    expect(n.map(x => x.titulo)).toEqual(['DAS vencida', 'Documento novo', 'O escritório respondeu', 'Certificado digital perto de vencer']);
  });
});

describe('pedidos do pessoal', () => {
  it('admissão: confere e monta o texto do chamado só com o que foi preenchido', () => {
    const p = { nome: 'Maria Souza', cpf: '', cargo: 'Auxiliar', salario: 'R$ 2.000,00', inicio: '01/11/2026', contrato: 'Experiência', observacoes: '' };
    expect(erroDaAdmissao({ ...p, inicio: '1/11' })).toContain('data de início');
    expect(erroDaAdmissao(p)).toBe('');
    const t = textoDaAdmissao(p);
    expect(t.split('\n')[0]).toBe('Admissão: Maria Souza (Auxiliar)');
    expect(t).toContain('Salário: R$ 2.000,00');
    expect(t).not.toContain('CPF');
  });
  it('férias e demissão pedem o funcionário e a data', () => {
    expect(erroDasFerias({ empregado: '', inicio: '', dias: '30', adiantar13: false, observacoes: '' })).toContain('funcionário');
    expect(erroDaDemissao({ empregado: 'João', ultimoDia: '31/10/2026', motivo: '', aviso: '', observacoes: '' })).toContain('motivo');
  });
  it('o chamado leva a prioridade e o anexo no fim', () => {
    expect(textoDoChamado('', ' Preciso da CND ', 'Normal', '')).toBe('Preciso da CND');
    expect(textoDoChamado('CND estadual', 'Preciso da CND', 'Alta', 'contrato.pdf')).toBe('CND estadual\n\nPreciso da CND\n\nPrioridade: Alta\nAnexo enviado: contrato.pdf');
  });
});

describe('linkDoWhatsapp', () => {
  it('só os dígitos, com o 55 na frente', () => {
    expect(linkDoWhatsapp('(31) 99999-0000')).toBe('https://wa.me/5531999990000');
    expect(linkDoWhatsapp('+55 31 99999-0000')).toBe('https://wa.me/5531999990000');
    expect(linkDoWhatsapp('')).toBe('');
    expect(linkDoWhatsapp('3333')).toBe('');
  });
});

describe('juntarPedacosDoPdf', () => {
  const b64 = (t: string) => btoa(t);
  it('junta de 0 a total-1 na ordem, mesmo vindo fora de ordem', async () => {
    const pdf = juntarPedacosDoPdf([{ base64: b64('meio-'), n: 1, total: 3 }, { base64: b64('%PDF-'), n: 0, total: 3 }, { base64: b64('fim'), n: 2, total: 3 }]);
    expect(pdf?.type).toBe('application/pdf');
    expect(await pdf!.text()).toBe('%PDF-meio-fim');
  });
  it('recusa quando falta pedaço, começa em 1 ou o total não bate', () => {
    expect(juntarPedacosDoPdf([])).toBeNull();
    expect(juntarPedacosDoPdf([{ base64: b64('a'), n: 0, total: 2 }])).toBeNull();
    expect(juntarPedacosDoPdf([{ base64: b64('a'), n: 1, total: 2 }, { base64: b64('b'), n: 2, total: 2 }])).toBeNull();
    expect(juntarPedacosDoPdf([{ base64: b64('a'), n: 0, total: 2 }, { base64: b64('b'), n: 1, total: 3 }])).toBeNull();
  });
});
