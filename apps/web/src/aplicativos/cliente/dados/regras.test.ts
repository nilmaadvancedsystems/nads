import { describe, expect, it } from 'vitest';
import type { areaCliente as ac } from '@nads/core';
import type { DocumentoDoCliente } from './areaCliente';
import { linkDoWhatsapp, mimeDoArquivo, nomeDaPessoa, partesDaSolicitacao, passoDaSolicitacao, whatsappDaSolicitacao, erroDaAdmissao, erroDaDemissao, erroDasFerias, filtrarDocumentos, juntarPedacosDoPdf, mesesDosDocumentos, notificacoes, resumoDoPessoal, situacaoDoCertificado, textoDaAdmissao, textoDoChamado, textoDosAnexos, painelDasGuias, perfisComEste, iniciaisDaEmpresa, MAIS_PERFIS } from './regras';

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

describe('resumoDoPessoal (o Registro, 12/11/2026)', () => {
  it('os ativos, a remuneração do mês, quem entrou no ano e quem saiu', () => {
    const f = (id: string, desde: string, ativo: boolean) => ({ id, nome: id, cpf: '', matricula: '', remuneracao: 1000, desde, ultimo: ativo ? '2026-09' : '2026-07', ativo });
    expect(resumoDoPessoal({ funcionarios: [f('a', '2021-03', true), f('b', '2026-02', true), f('c', '2025-01', false)], competencia: '2026-09', total: 2000, atualizadoEm: '' }, hoje))
      .toEqual({ ativos: 2, folha: 2000, competencia: '2026-09', admissoesNoAno: 1, saidas: 1 });
    expect(resumoDoPessoal(null, hoje)).toEqual({ ativos: 0, folha: 0, competencia: '', admissoesNoAno: 0, saidas: 0 });
  });
  it('o nome como a gente escreve e o tipo do arquivo pelo nome', () => {
    expect(nomeDaPessoa('  MARIA DA SILVA  E SOUZA ')).toBe('Maria da Silva e Souza');
    expect(nomeDaPessoa('DE ALMEIDA')).toBe('De Almeida');
    expect([mimeDoArquivo('Folha.PDF'), mimeDoArquivo('ponto.xlsx'), mimeDoArquivo('sem')]).toEqual(['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream']);
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

describe('as solicitações sem chat (11/11/2026)', () => {
  it('o passo e o rótulo da situação', () => {
    expect(passoDaSolicitacao('aberto')).toEqual({ passo: 0, rotulo: 'Recebida' });
    expect(passoDaSolicitacao('em andamento')).toEqual({ passo: 1, rotulo: 'Em andamento' });
    expect(passoDaSolicitacao('respondido')).toEqual({ passo: 2, rotulo: 'Respondida' });
    expect(passoDaSolicitacao('concluido')).toEqual({ passo: 2, rotulo: 'Concluída' });
  });
  it('o pedido, o que o cliente somou depois e as respostas do escritório', () => {
    const p = partesDaSolicitacao({ mensagens: [
      { de: 'cliente', autor: 'Você', texto: 'Preciso da certidão', em: '2026-10-01T10:00:00Z' },
      { de: 'escritorio', autor: 'Escritório', texto: 'Está em Documentos', em: '2026-10-02T10:00:00Z' },
      { de: 'cliente', autor: 'Você', texto: 'A estadual também', em: '2026-10-03T10:00:00Z' },
    ] });
    expect(p).toEqual({ pedido: 'Preciso da certidão', complementos: ['A estadual também'], respostas: [{ texto: 'Está em Documentos', em: '2026-10-02T10:00:00Z' }] });
  });
  it('o WhatsApp com o assunto; sem número, nada', () => {
    expect(whatsappDaSolicitacao('(31) 99999-0000', 'Certidão & CND')).toBe('https://wa.me/5531999990000?text=' + encodeURIComponent('Olá! Sobre a solicitação "Certidão & CND":'));
    expect(whatsappDaSolicitacao('', 'x')).toBe('');
  });
});

describe('textoDosAnexos (o aviso na solicitação quando o cliente manda arquivos por ela)', () => {
  it('um arquivo, no singular', () => {
    expect(textoDosAnexos(['contrato.pdf'])).toBe('Enviei o arquivo: contrato.pdf.');
  });
  it('vários, no plural e sem os nomes vazios', () => {
    expect(textoDosAnexos([' rg.jpg ', '', 'cpf.pdf'])).toBe('Enviei os arquivos: rg.jpg, cpf.pdf.');
  });
});

describe('painelDasGuias (os números do mês e o calendário da aba Guias)', () => {
  const guia = (id: string, vencimento: string, valor: number, situacao: ac.GuiaDoCliente['situacao']): ac.GuiaDoCliente =>
    ({ id, tipo: 'DAS', competencia: '2026-10', vencimento, valor, situacao, temPdf: true });
  const guias = [guia('a', '07/11/2026', 300, 'vencida'), guia('b', '15/11/2026', 500, 'a vencer'), guia('c', '12/11/2026', 200, 'vence hoje')];
  const pagas = [{ nome: 'Honorários', valor: 1000, pagoEm: '06/11/2026' }];
  const agenda: ac.ItemDaAgenda[] = [{ id: 'x', nome: 'DCTFWeb', vence: '2026-11-13', situacao: 'a fazer' }, { id: 'y', nome: 'EFD', vence: '2026-12-02', situacao: 'a fazer' }];

  it('os totais: a pagar, vencidas e pagas', () => {
    const p = painelDasGuias(guias, pagas, agenda, '2026-11', new Date(2026, 10, 12), g => g.tipo);
    expect([p.aPagar, p.vencidas, p.pagas]).toEqual([{ valor: 1000, guias: 3 }, { valor: 300, guias: 1 }, { valor: 1000, guias: 1 }]);
  });

  it('o calendário: os dias do mês, o dia da semana do dia 1, hoje, e as marcas por dia (só a entrega do mês)', () => {
    const p = painelDasGuias(guias, pagas, agenda, '2026-11', new Date(2026, 10, 12), g => g.tipo);
    // 1º de novembro de 2026 é um domingo
    expect([p.linha.dias, p.linha.primeiroDia, p.linha.hoje]).toEqual([30, 0, 12]);
    expect(p.linha.marcas.map(x => [x.dia, x.tipo, x.tom, x.curto])).toEqual([[6, 'paga', 'feita', 'Honorários'], [7, 'guia', 'vencida', 'DAS'], [12, 'guia', 'hoje', 'DAS'], [13, 'entrega', 'aberta', 'DCTFWeb'], [15, 'guia', 'aberta', 'DAS']]);
    expect(painelDasGuias([], [], [], '2026-12', new Date(2026, 10, 12), g => g.tipo).linha).toEqual({ dias: 31, primeiroDia: 2, hoje: null, marcas: [] });
  });
});

describe('a troca de empresa (as empresas abertas neste aparelho)', () => {
  const p = (token: string, usadoEm: string, nome = 'Empresa ' + token) => ({ token, nome, documento: '', usadoEm });

  it('a empresa aberta agora vai para o alto (sem repetir); o resto pela última vez que abriu', () => {
    const lista = [p('a', '2026-11-01'), p('b', '2026-11-10'), p('c', '2026-11-05')];
    expect(perfisComEste(lista, p('c', '2026-11-12', 'C nova')).map(x => [x.token, x.nome])).toEqual([['c', 'C nova'], ['b', 'Empresa b'], ['a', 'Empresa a']]);
  });

  it('guarda no máximo 12 e ignora o guardado torto', () => {
    const muitos = Array.from({ length: 20 }, (_, i) => p('t' + i, '2026-10-' + String(i + 1).padStart(2, '0')));
    expect(perfisComEste(muitos, p('novo', '2026-11-12')).length).toBe(MAIS_PERFIS);
    expect(perfisComEste([null as never, { token: '', nome: 'x', documento: '', usadoEm: '' }], p('a', 'x')).map(x => x.token)).toEqual(['a']);
  });

  it('as iniciais da empresa, sem o Ltda e as palavras pequenas', () => {
    expect([iniciaisDaEmpresa('Personaly Company Comércio de Roupas Ltda'), iniciaisDaEmpresa('Padaria'), iniciaisDaEmpresa('')]).toEqual(['PC', 'P', '?']);
  });
});
