import { describe, expect, it } from 'vitest';
import type { areaCliente as ac } from '@nads/core';
import type { DocumentoDoCliente } from './areaCliente';
import { linkDoWhatsapp, mimeDoArquivo, nomeDaPessoa, partesDaSolicitacao, passoDaSolicitacao, whatsappDaSolicitacao, erroDaAdmissao, erroDaDemissao, erroDasFerias, filtrarDocumentos, juntarPedacosDoPdf, mesesDosDocumentos, notificacoes, resumoDoPessoal, situacaoDoCertificado, textoDaAdmissao, textoDoChamado, textoDosAnexos, painelDasGuias, perfisComEste, iniciaisDaEmpresa, MAIS_PERFIS, ultimaEmpresa, abasDoCelular, seloDoRegime, tempoDeEmpresa, dadosParaCopiar, tokenDoLink, diaRelativo, contaDasFerias, contaDaAdmissao, primeiraDataDasFerias, mesDasFerias, marcarNoCalendario, textoDosDias, resumoDasGuias, abaDoDia, vencimentoDaGuia, legendaDoCalendario } from './regras';

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
    expect(p).toEqual({ pedido: 'Preciso da certidão', complementos: ['A estadual também'], respostas: [{ texto: 'Está em Documentos', em: '2026-10-02T10:00:00Z', autor: '' }] });
    expect(partesDaSolicitacao({ mensagens: [{ de: 'escritorio', autor: 'Carla', texto: 'Ok', em: '2026-10-02T10:00:00Z' }] }).respostas[0].autor).toBe('Carla');
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

describe('o app no celular (13/11/2026)', () => {
  it('sem link, abre a última empresa usada neste aparelho', () => {
    const p = (token: string, usadoEm: string) => ({ token, nome: token, documento: '', usadoEm });
    expect(ultimaEmpresa([p('a', '2026-11-10'), p('b', '2026-11-12'), p('c', '2026-11-11')])).toBe('b');
    expect(ultimaEmpresa([p('exemplo', '')])).toBe('');
    expect(ultimaEmpresa([])).toBe('');
  });
  it('as abas de baixo: Visão geral, Guias, Documentos (se tem) e Solicitações', () => {
    expect(abasDoCelular(['inicio', 'documentos', 'guias', 'dp', 'chamados', 'empresa'])).toEqual(['inicio', 'guias', 'documentos', 'chamados']);
    expect(abasDoCelular(['inicio', 'guias', 'chamados'])).toEqual(['inicio', 'guias', 'chamados']);
  });
});

describe('o selo do regime (13/11/2026)', () => {
  it('o Simples e o MEI em verde; o resto neutro', () => {
    expect(seloDoRegime('Simples Nacional')).toBe('badge badge-ok');
    expect(seloDoRegime('MEI')).toBe('badge badge-ok');
    expect(seloDoRegime('Lucro Presumido')).toBe('badge badge-neutral');
  });
});

describe('os dados cadastrais (13/11/2026)', () => {
  it('há quanto tempo a empresa abriu', () => {
    const hoje = new Date(2026, 10, 13);
    expect(tempoDeEmpresa('2019-04-02', hoje)).toBe('há 7 anos');
    expect(tempoDeEmpresa('2026-06-10', hoje)).toBe('há 5 meses');
    expect(tempoDeEmpresa('2026-10-01', hoje)).toBe('há 1 mês');
    expect(tempoDeEmpresa('2026-11-01', hoje)).toBe('este mês');
    expect(tempoDeEmpresa('', hoje)).toBe('');
  });
  it('os dados num texto para colar, sem as linhas vazias', () => {
    expect(dadosParaCopiar({ razaoSocial: 'A Ltda', cnpj: '00.000.000/0001-91', nomeFantasia: '', regime: 'Simples Nacional' }))
      .toBe('Razão social: A Ltda\nCNPJ: 00.000.000/0001-91\nRegime: Simples Nacional');
  });
});

describe('a troca de empresa (13/11/2026)', () => {
  it('o token no link colado (ou só o token)', () => {
    expect(tokenDoLink('https://cliente.nilmacontabilidade.com/cliente/AbC123xyz/guias')).toBe('AbC123xyz');
    expect(tokenDoLink('  AbC123xyz ')).toBe('AbC123xyz');
    expect(tokenDoLink('oi')).toBe('');
    expect(tokenDoLink('https://exemplo.com/outra/coisa')).toBe('');
  });
  it('o dia relativo', () => {
    const hoje = new Date(2026, 10, 13, 15);
    expect(diaRelativo(new Date(2026, 10, 13, 9).toISOString(), hoje)).toBe('hoje');
    expect(diaRelativo(new Date(2026, 10, 12, 9).toISOString(), hoje)).toBe('ontem');
    expect(diaRelativo(new Date(2026, 9, 2, 9).toISOString(), hoje)).toBe('02/10');
  });
});

describe('as contas das janelas do DP (13/11/2026)', () => {
  const agora = new Date(2026, 10, 13, 9);
  it('as férias: de quando a quando, a volta, o pagamento e os avisos', () => {
    expect(contaDasFerias({ inicio: '', dias: '30 dias' }, agora)).toBeNull();
    expect(contaDasFerias({ inicio: '07/12/2026', dias: '30 dias' }, agora)).toEqual({ de: '07/12', ate: '05/01/2027', dias: 30, vende: 0, volta: 'qua, 06/01/2027', pagarAte: 'sex, 04/12/2026', avisos: ['Faltam 24 dias: a lei pede o aviso de férias 30 dias antes. O escritório confere se dá.'] });
    const vendendo = contaDasFerias({ inicio: '04/01/2027', dias: '20 dias e vender 10' }, agora);
    expect(vendendo).toMatchObject({ dias: 20, vende: 10, ate: '23/01/2027', avisos: [] });
    expect(contaDasFerias({ inicio: '08/01/2027', dias: '30 dias' }, agora)?.avisos[0]).toMatch(/^Começa na sexta/);
    expect(contaDasFerias({ inicio: '01/11/2026', dias: '30 dias' }, agora)?.avisos[0]).toBe('Essa data já passou.');
  });
  it('a admissão: o prazo do eSocial e a experiência', () => {
    expect(contaDaAdmissao({ inicio: '01/12/2026', contrato: 'Prazo indeterminado' }, agora)).toEqual({ registrarAte: 'seg, 30/11/2026', experiencia: '', aviso: '' });
    expect(contaDaAdmissao({ inicio: '01/12/2026', contrato: 'Experiência (45 + 45 dias)' }, agora)?.experiencia).toBe('Experiência até 14/01, prorrogável até dom, 28/02/2027');
    expect(contaDaAdmissao({ inicio: '14/11/2026', contrato: 'Estágio' }, agora)?.aviso).toMatch(/^Em cima da hora/);
  });
});

describe('o calendário da janela de férias (13/11/2026)', () => {
  const agora = new Date(2026, 10, 13, 9);
  it('a primeira segunda com 30 dias de aviso', () => {
    expect(primeiraDataDasFerias(agora)).toBe('14/12/2026');
  });
  it('o mês em semanas de domingo, com o pagamento, as férias e a volta marcados', () => {
    const dez = mesDasFerias('2026-12', { inicio: '14/12/2026', dias: '10 dias (uma parte)' }, agora);
    expect(dez.length).toBe(35);
    expect(dez[0]).toMatchObject({ br: '29/11/2026', doMes: false });
    const de = (br: string) => dez.find(d => d.br === br)!;
    expect(de('11/12/2026')).toMatchObject({ pagamento: true, evitar: true });
    expect(de('14/12/2026')).toMatchObject({ inicio: true, ferias: true });
    expect(de('23/12/2026')).toMatchObject({ fim: true, ferias: true });
    expect(de('24/12/2026')).toMatchObject({ volta: true, ferias: false });
    expect(mesDasFerias('2026-11', { inicio: '', dias: '30 dias' }, agora).find(d => d.br === '12/11/2026')?.passou).toBe(true);
  });
  it('o aviso de quando passa do limite do período', () => {
    expect(contaDasFerias({ inicio: '15/02/2027', dias: '30 dias' }, agora, '2027-02')?.avisos).toContain('Termina depois de 02/2027, o limite do período: os dias que passarem são pagos em dobro.');
    expect(contaDasFerias({ inicio: '01/02/2027', dias: '20 dias e vender 10' }, agora, '2027-02')?.avisos).toEqual([]);
  });
});

describe('marcar as férias no calendário, como hotel (13/11/2026)', () => {
  const agora = new Date(2026, 10, 13, 9);
  it('o primeiro toque é o começo; o segundo, o último dia', () => {
    const um = marcarNoCalendario({ inicio: '', dias: '30 dias' }, '14/12/2026', 'inicio');
    expect(um).toEqual({ inicio: '14/12/2026', dias: '30 dias', fase: 'fim' });
    expect(marcarNoCalendario(um, '20/12/2026', 'fim')).toEqual({ inicio: '14/12/2026', dias: '7 dias corridos', fase: 'inicio' });
    expect(marcarNoCalendario(um, '28/12/2026', 'fim').dias).toBe('15 dias (primeira parte)');
    // antes do começo: recomeça dali
    expect(marcarNoCalendario(um, '10/12/2026', 'fim')).toEqual({ inicio: '10/12/2026', dias: '30 dias', fase: 'fim' });
    expect(textoDosDias(30)).toBe('30 dias');
  });
  it('as partes: 7 dias pode (com o aviso), menos de 5 não, mais de 30 não', () => {
    const p = (dias: string) => ({ empregado: 'Ana', inicio: '14/12/2026', dias, adiantar13: false, observacoes: '' });
    expect(erroDasFerias(p('7 dias corridos'))).toBe('');
    expect(erroDasFerias(p('4 dias corridos'))).toContain('pelo menos 5');
    expect(erroDasFerias(p('31 dias corridos'))).toContain('no máximo 30');
    expect(contaDasFerias({ inicio: '14/12/2026', dias: '7 dias corridos' }, agora)).toMatchObject({ dias: 7, ate: '20/12/2026', volta: 'seg, 21/12/2026' });
    expect(contaDasFerias({ inicio: '14/12/2026', dias: '7 dias corridos' }, agora)?.avisos[0]).toMatch(/^Com 7 dias, esta é uma das partes/);
  });
  it('a prévia do último dia no calendário', () => {
    const dez = mesDasFerias('2026-12', { inicio: '14/12/2026', dias: '30 dias' }, agora, '18/12/2026');
    expect(dez.find(d => d.br === '18/12/2026')).toMatchObject({ fim: true, ferias: true });
    expect(dez.find(d => d.br === '19/12/2026')).toMatchObject({ volta: true, ferias: false });
  });
});
describe('resumoDasGuias (a linha embaixo do título das Guias)', () => {
  const base = { nomeDoMes: 'novembro', aPagar: { valor: 'R$ 2.633,89', guias: 3 }, vencidas: { valor: 'R$ 1.284,37', guias: 1 }, proxima: { data: '16/11', nome: 'FGTS', faltam: 'em 3 dias' }, pagas: 1 };
  it('o total, as vencidas e o próximo vencimento', () => {
    expect(resumoDasGuias(base)).toEqual([
      { valor: 'R$ 2.633,89', depois: 'a pagar em novembro (3 guias)' },
      { valor: '1 vencida', depois: '(R$ 1.284,37)', tom: 'perigo' },
      { antes: 'próximo vencimento', valor: '16/11', depois: '(FGTS, em 3 dias)' },
    ]);
  });
  it('sem vencida e com o vencimento hoje', () => {
    const r = resumoDasGuias({ ...base, aPagar: { valor: 'R$ 10,00', guias: 1 }, vencidas: { valor: 'R$ 0,00', guias: 0 }, proxima: { data: '13/11', nome: 'DAS', faltam: '' } });
    expect(r).toEqual([{ valor: 'R$ 10,00', depois: 'a pagar em novembro (1 guia)' }, { antes: 'próximo vencimento', valor: '13/11', depois: '(DAS, hoje)' }]);
  });
  it('só vencidas: sem próximo vencimento', () => {
    const r = resumoDasGuias({ ...base, aPagar: { valor: 'R$ 5,00', guias: 2 }, vencidas: { valor: 'R$ 5,00', guias: 2 }, proxima: null });
    expect(r.map(t => t.valor)).toEqual(['R$ 5,00', '2 vencidas']);
  });
  it('nada a pagar, com e sem pagas', () => {
    const nada = { ...base, aPagar: { valor: 'R$ 0,00', guias: 0 }, vencidas: { valor: 'R$ 0,00', guias: 0 }, proxima: null };
    expect(resumoDasGuias(nada)).toEqual([{ valor: 'Nada a pagar', depois: 'em novembro' }, { valor: '1 guia paga', depois: 'no mês' }]);
    expect(resumoDasGuias({ ...nada, pagas: 0 })).toEqual([{ valor: 'Nada a pagar', depois: 'em novembro' }]);
  });
});

describe('abaDoDia (o clique num dia da agenda das Guias)', () => {
  it('a pagar primeiro, depois as pagas; só entrega fica onde está', () => {
    expect(abaDoDia(8, [8, 16], [7], 'pagas', 'apagar', 'pagas')).toBe('apagar');
    expect(abaDoDia(7, [8, 16], [7], 'apagar', 'apagar', 'pagas')).toBe('pagas');
    expect(abaDoDia(20, [8, 16], [7], 'pagas', 'apagar', 'pagas')).toBe('pagas');
  });
});

describe('vencimentoDaGuia (a linha menor de cada guia a pagar)', () => {
  it('a palavra em cor só quando pede atenção; o resto numa frase', () => {
    expect(vencimentoDaGuia('vencida', '08/11/2026', -5)).toEqual({ palavra: 'Vencida', texto: 'em 08/11, há 5 dias' });
    expect(vencimentoDaGuia('vencida', '12/11/2026', -1)).toEqual({ palavra: 'Vencida', texto: 'em 12/11, há 1 dia' });
    expect(vencimentoDaGuia('vence hoje', '13/11/2026', 0)).toEqual({ palavra: 'Vence hoje', texto: '' });
    expect(vencimentoDaGuia('a vencer', '14/11/2026', 1)).toEqual({ palavra: '', texto: 'Vence amanhã, 14/11' });
    expect(vencimentoDaGuia('a vencer', '16/11/2026', 3)).toEqual({ palavra: '', texto: 'Vence em 16/11, daqui a 3 dias' });
  });
  it('sem data legível, sem frase pela metade', () => {
    expect(vencimentoDaGuia('a vencer', '', null)).toEqual({ palavra: '', texto: 'A pagar' });
    expect(vencimentoDaGuia('vencida', '', null)).toEqual({ palavra: 'Vencida', texto: '' });
  });
});

describe('legendaDoCalendario (só as cores que aparecem no mês)', () => {
  it('na ordem fixa, sem repetir', () => {
    const r = legendaDoCalendario([{ tipo: 'entrega', tom: 'feita' }, { tipo: 'guia', tom: 'vencida' }, { tipo: 'entrega', tom: 'aberta' }, { tipo: 'guia', tom: 'hoje' }]);
    expect(r).toEqual([{ classe: 'guia-hoje', rotulo: 'vence hoje' }, { classe: 'guia-vencida', rotulo: 'vencida' }, { classe: 'entrega-aberta', rotulo: 'do escritório' }]);
    expect(legendaDoCalendario([{ tipo: 'paga', tom: 'feita' }, { tipo: 'guia', tom: 'aberta' }]).map(x => x.rotulo)).toEqual(['a pagar', 'paga']);
  });
});
