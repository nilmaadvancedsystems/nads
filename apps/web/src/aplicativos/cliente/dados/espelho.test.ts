import { describe, expect, it } from 'vitest';
// o porte das regras que o robô usa para GRAVAR o espelho e para CONFERIR as caixas (robo/area-cliente-regras.js): o
// teste lê o que o robô grava e manda o que o robô confere, para a leitura e os pedidos não se afastarem dele
// @ts-expect-error: o robô é CommonJS sem tipos (robo/ fica fora do app)
import roboImportado from '../../../../../../robo/area-cliente-regras.js';
import {
  base64DosBytes, comPendentes, documentoFormatado, ehTokenDoLink, estadoDoEspelho, lerAgenda, lerCertidao, lerCertificado, lerDocumentoDoEscritorio, lerEntregas, lerFicha, lerParcelamentos, lerPendencias, lerTickets, lerChamado, lerGuia, lerRecibo, lerResumo,
  nomeDoPdfDaGuia, pedidoDeChamado, pedidoDeEnvio, respostaVoltou, lerExtratoDoMes,
} from './espelho';

type Solto = Record<string, unknown>;
const R = roboImportado as Record<string, (...a: unknown[]) => Solto> & { CAMPOS_DO_ESPELHO: Record<string, string[]> };

const TOKEN = 'a1'.repeat(20);
const HOJE = new Date(2026, 9, 17, 10, 0, 0);

describe('o token', () => {
  it('40 hex minúsculos; o resto nem vai ao banco', () => {
    expect(ehTokenDoLink(TOKEN)).toBe(true);
    expect(ehTokenDoLink('A1'.repeat(20))).toBe(false);
    expect(ehTokenDoLink('exemplo')).toBe(false);
    expect(ehTokenDoLink(TOKEN + '/guias')).toBe(false);
  });
});

describe('o espelho que o robô grava, lido de volta sem perder campo', () => {
  it('o resumo: as empresas com o CNPJ mascarado e o contato do escritório', () => {
    const gravado = R.resumoDoCliente([{ codigo: 58, nome: 'Padaria Boa Ltda', cnpj: '12.345.678/0001-90' }], { whatsapp: '(38) 9138-3638', email: 'nilmacontabilidade@gmail.com', telefone: ' ' }, '2026-10-17T10:00:00.000Z');
    R.conferirListaBranca('resumo', gravado);
    expect(lerResumo(gravado)).toEqual({
      empresas: [{ codigo: 58, nome: 'Padaria Boa Ltda', cnpj: '12.345.678/0001-90' }],
      escritorio: { whatsapp: '(38) 9138-3638', email: 'nilmacontabilidade@gmail.com' },
      atualizadoEm: '2026-10-17T10:00:00.000Z',
    });
    expect(lerResumo(null)).toBeNull();
  });
  it('o boleto dos honorários (24/11/2026, ficha 50): lido de volta e separado das guias de imposto, nunca "pago"', () => {
    const hon = R.guiaDoHonorario({ id: 'b1', competencia: '2026-10', vencimento: '2026-10-15', valor: 850, linha: '75691.31324 01000.000102 00000.012345 6 00000000085000', partes: 1, envio: { status: 'enviado' } }, 58, HOJE);
    R.conferirListaBranca('guia', hon);
    expect(lerGuia('hon-2026-10-58', hon)).toEqual(hon);
    const fgts = R.guiaDoFgts({ id: 'p1', competencia: '2026-09', status: 'pronto', modo: 'emitir', vencimento: '20/10/2026', valor: '1.917,42', numeroGuia: '123', aviso: '', pdfNome: 'f.pdf' }, HOJE);
    // mesmo que viesse com pagoEm, o honorário não vai para Pagas, nem fica entre as guias (é vencida pela data, mas não conta)
    const lidas = [lerGuia('p1', fgts)!, { ...lerGuia('hon-2026-10-58', hon)!, pagoEm: '14/10/2026' }];
    const e = estadoDoEspelho({ resumo: null, nomeDoLink: 'X', guias: lidas, agenda: [], envios: [], chamados: [] });
    expect(e.guias.map(g => g.id)).toEqual(['p1']);
    expect(e.pagas).toEqual([]);
    expect(e.secoes.pagas).toBe(false);
    expect(e.honorarios.map(g => [g.id, g.tipo, g.vencimento, 'pagoEm' in g])).toEqual([['hon-2026-10-58', 'HON', '15/10/2026', false]]);
  });
  it('a guia do FGTS (area-cliente.js) e a de DAS (envios-do-nads.js, sem número)', () => {
    const fgts = R.guiaDoFgts({ id: 'p1', competencia: '2026-09', status: 'pronto', modo: 'emitir', vencimento: '20/10/2026', valor: '1.917,42', numeroGuia: '123', aviso: '', pdfNome: 'f.pdf' }, HOJE);
    R.conferirListaBranca('guia', fgts);
    expect(lerGuia('p1', fgts)).toEqual(fgts);
    const das = { id: 'das-2026-09-58', tipo: 'DAS', competencia: '2026-09', vencimento: '20/10/2026', valor: 432.1, situacao: 'a vencer', temPdf: true };
    R.conferirListaBranca('guia', das);
    expect(lerGuia(das.id, das)).toEqual(das);
  });
  it('a DARF dos lotes com o tributo (ficha todas-as-guias, 17/11/2026); tributo torto não passa', () => {
    const darf = { id: 'darf-inss-2026-10-58', tipo: 'DARF', competencia: '2026-10', vencimento: '19/11/2026', valor: 900, tributo: 'INSS', situacao: 'a vencer', temPdf: true };
    R.conferirListaBranca('guia', darf);
    expect(lerGuia(darf.id, darf)).toEqual(darf);
    expect(lerGuia('x', { ...darf, tributo: '<script>' })).not.toHaveProperty('tributo');
    expect(lerGuia('x', { ...darf, tipo: 'DAM', tributo: undefined })).toMatchObject({ tipo: 'DAM' });
    expect(lerGuia('x', { ...darf, vencimento: '' })).toBeNull();
  });
  it('a guia torta fica de fora (sem valor, data quebrada, competência ruim)', () => {
    const boa = { tipo: 'DAS', competencia: '2026-09', vencimento: '20/10/2026', valor: 1, situacao: 'a vencer', temPdf: true };
    expect(lerGuia('x', { ...boa, valor: '1,00' })).toBeNull();
    expect(lerGuia('x', { ...boa, vencimento: '31/02/2026' })).toBeNull();
    expect(lerGuia('x', { ...boa, competencia: '2026-13' })).toBeNull();
    expect(lerGuia('x', { ...boa, tipo: 'IPTU', situacao: '??', temPdf: 'sim' })).toMatchObject({ tipo: 'outra', situacao: 'a vencer', temPdf: false });
  });
  it('a agenda do mês do vencimento', () => {
    const empresa = { codigo: 58, nome: 'Padaria', regime: 'Simples', dp: null, execucoes: { '2026-09': { fiscal: null, dp: null } } };
    const [mes] = R.agendaDoLink([empresa], ['2026-09']) as unknown as Solto[];
    const gravado = { mes: mes.mes, itens: mes.itens, atualizadoEm: '2026-10-17T10:00:00.000Z' };
    R.conferirListaBranca('agenda', gravado);
    expect(lerAgenda('2026-10', gravado)).toEqual({ mes: '2026-10', itens: [{ id: 'das', nome: 'DAS do Simples Nacional', vence: '2026-10-20', situacao: 'a fazer' }] });
    expect(lerAgenda('2026-10', { itens: [{ id: 'x', nome: 'X', vence: 'amanhã', situacao: 'a fazer' }] })).toEqual({ mes: '2026-10', itens: [] });
  });
  it('o recibo do envio', () => {
    const gravado = R.reciboDoEnvio({ id: 'e1', nome: 'extrato.pdf', tipo: 'extrato', tamanho: 1000, recebidoEm: '2026-10-17T10:00:00.000Z' });
    R.conferirListaBranca('recibo', gravado);
    expect(lerRecibo('e1', gravado)).toEqual(gravado);
  });
  it('o chamado: "Você" e o primeiro nome de quem respondeu; a nota interna nunca chegou ao espelho', () => {
    const interno = { tipo: 'ferias', titulo: 'Férias da Maria', situacao: 'respondido', mensagens: [
      { de: 'cliente', autor: 'Cliente', texto: 'Posso?', em: '2026-10-10T09:00:00.000Z' },
      { de: 'escritorio', autor: 'Clara Souza', texto: 'Pode.', em: '2026-10-10T10:00:00.000Z' },
      { de: 'escritorio', autor: 'Clara', texto: 'nota nossa', em: '2026-10-10T10:01:00.000Z', interna: true },
    ] };
    const gravado = R.chamadoDoCliente(R.chamadoInterno('c1', interno));
    R.conferirListaBranca('chamado', gravado);
    const lido = lerChamado('c1', gravado)!;
    expect(lido).toEqual(gravado);
    expect(lido.mensagens[1].autor).toBe('Clara');
    expect(JSON.stringify(lido)).not.toContain('Souza');
    expect(JSON.stringify(lido)).not.toContain('nota nossa');
  });
  it('os campos lidos são exatamente os que o robô pode gravar (lista branca)', () => {
    const C = R.CAMPOS_DO_ESPELHO;
    expect(C.resumo).toEqual(['empresas', 'escritorio', 'atualizadoEm']);
    expect(C.guia).toEqual(['id', 'tipo', 'competencia', 'vencimento', 'valor', 'numero', 'tributo', 'situacao', 'temPdf', 'pagoEm', 'linha']); // o tributo da DARF (17/11/2026, ficha todas-as-guias); pagoEm (18/11/2026, ficha guia-paga-confirmada); a linha do boleto dos honorários (24/11/2026, ficha 50)
    expect(C.agenda).toEqual(['mes', 'itens', 'atualizadoEm']);
    expect(C.item).toEqual(['id', 'nome', 'vence', 'situacao', 'feitoEm']);
    expect(C.chamado).toEqual(['id', 'tipo', 'titulo', 'situacao', 'mensagens', 'passo']); // o passo atual do pedido (23/11/2026)
    expect(C.passoChamado).toEqual(['nome', 'n', 'total']);
    expect(C.mensagem).toEqual(['de', 'autor', 'texto', 'em']);
    expect(C.recibo).toEqual(['id', 'nome', 'tipo', 'tamanho', 'recebidoEm', 'recusa']); // a recusa com o motivo (22/11/2026)
    expect(C.recusaRecibo).toEqual(['motivo', 'em']);
    expect(C.itemComunicado).toEqual(['id', 'titulo', 'texto', 'ate']); // os comunicados (22/11/2026)
    expect(C.pdf).toEqual(['base64', 'n', 'total']);
  });
});

describe('o CNPJ e o CPF', () => {
  it('a máscara pelos dígitos', () => {
    expect(documentoFormatado('12345678000190')).toBe('12.345.678/0001-90');
    expect(documentoFormatado('12345678901')).toBe('123.456.789-01');
    expect(documentoFormatado('')).toBe('');
  });
});

describe('os pedidos que o cliente manda, conferidos pelo robô', () => {
  it('chamado novo: as chaves da regra, com o título; o robô aceita', () => {
    const p = pedidoDeChamado(TOKEN, { tipo: 'duvida', texto: '  Preciso da CND\nObrigado ' });
    expect('pedido' in p && p.pedido).toEqual({ token: TOKEN, tipo: 'duvida', titulo: 'Preciso da CND', texto: 'Preciso da CND\nObrigado' });
    if (!('pedido' in p)) throw new Error('sem pedido');
    expect(R.validarPedidoDeChamado({ ...p.pedido, criadoEm: '2026-10-17T10:00:00Z' }).erro).toBeUndefined();
  });
  it('resposta: o id do chamado e o tipo dele, sem título', () => {
    const p = pedidoDeChamado(TOKEN, { tipo: 'ferias', texto: 'Mais uma coisa', chamadoId: 'AbC123' });
    expect('pedido' in p && p.pedido).toEqual({ token: TOKEN, chamadoId: 'AbC123', tipo: 'ferias', texto: 'Mais uma coisa' });
    if (!('pedido' in p)) throw new Error('sem pedido');
    expect(R.validarPedidoDeChamado({ ...p.pedido, criadoEm: 'x' }).pedido).toMatchObject({ chamadoId: 'AbC123' });
  });
  it('recusa antes de ir ao banco: sem assunto, texto vazio ou grande, chamado com barra, token ruim', () => {
    expect(pedidoDeChamado(TOKEN, { tipo: '', texto: 'oi' })).toEqual({ erro: 'Escolha o assunto.' });
    expect(pedidoDeChamado(TOKEN, { tipo: 'duvida', texto: '   ' })).toEqual({ erro: 'Conte o que você precisa.' });
    expect('erro' in pedidoDeChamado(TOKEN, { tipo: 'duvida', texto: 'x'.repeat(4001) })).toBe(true);
    expect('erro' in pedidoDeChamado(TOKEN, { tipo: 'duvida', texto: 'oi', chamadoId: '../c1' })).toBe(true);
    expect('erro' in pedidoDeChamado('exemplo', { tipo: 'duvida', texto: 'oi' })).toBe(true);
  });
  it('envio: o mime pela extensão e o base64 que o robô confere pelos bytes', () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 teste');
    const p = pedidoDeEnvio(TOKEN, 'extrato', { nome: 'Extrato.PDF', tamanho: bytes.length }, base64DosBytes(bytes));
    if (!('pedido' in p)) throw new Error(p.erro);
    expect(Object.keys(p.pedido).sort()).toEqual(['base64', 'mime', 'nome', 'tamanho', 'tipo', 'token']);
    expect(p.pedido.mime).toBe('application/pdf');
    const v = R.validarPedidoDeEnvio({ ...p.pedido, criadoEm: 'x' });
    expect(v.erro).toBeUndefined();
  });
  it('envio recusado: extensão, tamanho, tipo e nome grande', () => {
    expect('erro' in pedidoDeEnvio(TOKEN, 'extrato', { nome: 'a.exe', tamanho: 10 }, 'AAAA')).toBe(true);
    expect('erro' in pedidoDeEnvio(TOKEN, 'extrato', { nome: 'a.pdf', tamanho: 716801 }, 'AAAA')).toBe(true);
    expect('erro' in pedidoDeEnvio(TOKEN, 'foto', { nome: 'a.pdf', tamanho: 10 }, 'AAAA')).toBe(true);
    expect('erro' in pedidoDeEnvio(TOKEN, 'extrato', { nome: 'a'.repeat(201) + '.pdf', tamanho: 10 }, 'AAAA')).toBe(true);
  });
  it('o base64 de um arquivo grande (em blocos) volta igual', () => {
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => i % 251);
    const volta = Uint8Array.from(atob(base64DosBytes(bytes)), c => c.charCodeAt(0));
    // byte a byte num laço só (o toEqual em 200 mil bytes passava dos 5 s)
    expect(volta.length).toBe(bytes.length);
    expect(volta.every((b, i) => b === bytes[i])).toBe(true);
  });
});

describe('o que o cliente mandou e o robô ainda não devolveu', () => {
  const doEspelho = { id: 'c1', tipo: 'ferias' as const, titulo: 'Férias', situacao: 'respondido' as const, mensagens: [
    { de: 'cliente' as const, autor: 'Você', texto: 'Posso?', em: '2026-10-10T09:00:00.000Z' },
    { de: 'escritorio' as const, autor: 'Escritório', texto: 'Pode.', em: '2026-10-10T10:00:00.000Z' },
  ] };
  it('o chamado novo aparece aberto, em cima; some quando o espelho traz o de verdade', () => {
    const novo = { id: 'n1', tipo: 'duvida' as const, titulo: 'CND', texto: 'CND', em: '2026-10-17T10:00:00.000Z' };
    const l = comPendentes([doEspelho], [novo], []);
    expect(l.map(c => [c.id, c.situacao])).toEqual([['n1', 'aberto'], ['c1', 'respondido']]);
    expect(comPendentes([{ ...doEspelho, id: 'n1' }], [novo], []).map(c => c.id)).toEqual(['n1']);
  });
  it('a resposta entra no fim e o respondido volta para aberto, até o robô gravar', () => {
    const r = { chamadoId: 'c1', texto: 'Obrigado', em: '2026-10-17T10:00:00.000Z' };
    const [c] = comPendentes([doEspelho], [], [r]);
    expect(c.situacao).toBe('aberto');
    expect(c.mensagens.at(-1)).toMatchObject({ de: 'cliente', texto: 'Obrigado' });
    const voltou = { ...doEspelho, situacao: 'aberto' as const, mensagens: [...doEspelho.mensagens, { de: 'cliente' as const, autor: 'Você', texto: 'Obrigado', em: '2026-10-17T10:00:05.000Z' }] };
    expect(respostaVoltou(r, [voltou])).toBe(true);
    expect(comPendentes([voltou], [], [r])[0].mensagens).toHaveLength(3);
    // o mesmo texto de uma mensagem antiga não conta
    expect(respostaVoltou({ ...r, texto: 'Posso?' }, [doEspelho])).toBe(false);
  });
});

describe('o estado da tela', () => {
  it('do banco: sem exemplo, só as seções com fonte; o nome do link enquanto não tem resumo', () => {
    const e = estadoDoEspelho({ resumo: null, nomeDoLink: 'Padaria Boa', guias: [], agenda: [{ mes: '2026-11', itens: [] }, { mes: '2026-10', itens: [] }], envios: [], chamados: [] });
    expect(e).toMatchObject({ carregado: true, valido: true, exemplos: false, erro: '', secoes: { documentos: false, dp: true, pagas: false } });
    expect(e.resumo?.empresas[0].nome).toBe('Padaria Boa');
    expect(e.agenda.map(a => a.mes)).toEqual(['2026-10', '2026-11']);
  });
  it('o nome do PDF da guia', () => {
    expect(nomeDoPdfDaGuia({ tipo: 'FGTS', competencia: '2026-09' })).toBe('guia-fgts-2026-09.pdf');
    expect(nomeDoPdfDaGuia(null)).toBe('guia.pdf');
  });
});

describe('os lançamentos do mês pelos extratos (13/11/2026)', () => {
  it('o que o robô grava (a lista branca) é o que o site lê', () => {
    const gravado = { codigo: 58, competencia: '2026-10', lancamentos: [{ dia: 2, historico: 'PIX', valor: 10.5, conta: 'itau' }, { dia: 3, historico: 'TARIFA', valor: -2, conta: 'itau' }], cortados: 0, atualizadoEm: '2026-11-13T10:00:00.000Z' };
    R.conferirListaBranca('extratoLista', gravado);
    expect(lerExtratoDoMes(gravado)).toEqual({ lancamentos: gravado.lancamentos, cortados: 0 });
    expect(lerExtratoDoMes({ lancamentos: [{ dia: 1, valor: 'x' }] })).toEqual({ lancamentos: [], cortados: 0 });
    expect(lerExtratoDoMes(null)).toBeNull();
  });
});

describe('o Registro com a folha de verdade (13/11/2026)', () => {
  it('o que o robô grava (a lista branca) é o que o site lê; o torto fica de fora', async () => {
    const { lerPessoal } = await import('./espelho');
    const funcionario = { id: 'f1', nome: 'MARIA', cpf: '***.456.789-**', matricula: '1', remuneracao: 2000, desde: '2023-06', ultimo: '2026-10', ativo: true,
      cargo: 'VENDEDORA', admissao: '2023-06-15', salarioBase: 2000, liquido: 1630, feriasVencidas: true, afastadoDe: '2026-10-08', afastadoAte: '2026-10-22',
      periodosDeFerias: [{ inicio: '2025-06-15', fim: '2026-06-14', direito: 30, gozados: 0, aGozar: 30, concederAte: '2027-05-15' }], fonte: 'folha' };
    const gravado = { funcionarios: [funcionario], competencia: '2026-10', total: 2000, atualizadoEm: '2026-11-13T10:00:00.000Z',
      historico: [{ competencia: '2026-10', base: 2000, fgts: 160, funcionarios: 1, proventos: 2000, descontos: 370, liquido: 1630, inss: 150, irrf: 0, holerites: 1 }] };
    R.conferirListaBranca('pessoal', gravado);
    expect(lerPessoal(gravado)).toEqual(gravado);
    const torto = lerPessoal({ ...gravado, funcionarios: [{ ...funcionario, admissao: '15/06/2023', liquido: 'x', periodosDeFerias: [{ inicio: 'ontem' }] }] });
    expect(torto?.funcionarios[0]).not.toHaveProperty('admissao');
    expect(torto?.funcionarios[0]).not.toHaveProperty('liquido');
    expect(torto?.funcionarios[0]).not.toHaveProperty('periodosDeFerias');
  });
});

// o certificado A1 do cofre (plano do Acessórias, 17/11/2026, ficha certificado-digital)
describe('o certificado no espelho', () => {
  const bom = { tipo: 'A1', titular: 'Padaria X Ltda', validoAte: '2026-12-10', atualizadoEm: '2026-11-17T10:00:00.000Z' };
  it('o robô só pode gravar a validade e a razão social (a lista branca corta o resto)', () => {
    expect(() => R.conferirListaBranca('certificado', bom)).not.toThrow();
    expect(() => R.conferirListaBranca('certificado', { ...bom, senha: 'x' })).toThrow(/senha/);
    expect(() => R.conferirListaBranca('certificado', { ...bom, pfx: 'x' })).toThrow(/pfx/);
  });
  it('lerCertificado: o bom passa; data torta e tipo estranho não', () => {
    expect(lerCertificado(bom)).toEqual({ tipo: 'A1', titular: 'Padaria X Ltda', validoAte: '2026-12-10' });
    expect(lerCertificado({ ...bom, validoAte: '10/12/2026' })).toBeNull();
    expect(lerCertificado({ ...bom, validoAte: '2026-13-40' })).toBeNull();
    expect(lerCertificado({ ...bom, tipo: 'gov' })).toBeNull();
    expect(lerCertificado({ ...bom, titular: '' })).toBeNull();
  });
  it('estadoDoEspelho com e sem certificado', () => {
    const base = { resumo: null, nomeDoLink: 'Padaria', guias: [], agenda: [], envios: [], chamados: [] };
    expect(estadoDoEspelho(base).certificado).toBeNull();
    expect(estadoDoEspelho({ ...base, certificado: lerCertificado(bom) }).certificado?.validoAte).toBe('2026-12-10');
  });
});

// o que falta mandar e os pedidos do Mandei, no sino (plano do Acessórias, 17/11/2026, fichas o-que-falta-mandar e pedidos-do-mandei)
describe('o que o escritório espera do cliente', () => {
  const pend = { itens: [{ id: 'extrato-2026-10', titulo: 'Extrato bancário de outubro', tipo: 'extrato', competencia: '2026-10' }], competencia: '2026-10', atualizadoEm: 'x' };
  const tick = { tickets: [{ codigo: 'AAAAAAAAAAAAAAAAAAAAAAAA', numero: '#0003', assunto: 'Saldos de outubro', validoAte: '2026-11-25T00:00:00.000Z', total: 3, faltam: 2, refazer: 0 }], atualizadoEm: 'x' };
  it('as listas brancas do robô cortam o que não pode sair', () => {
    expect(() => R.conferirListaBranca('pendencias', pend)).not.toThrow();
    expect(() => R.conferirListaBranca('pendencias', { ...pend, cobradoPor: 'Clara' })).toThrow(/cobradoPor/);
    expect(() => R.conferirListaBranca('pendencias', { ...pend, itens: [{ ...pend.itens[0], email: 'x' }] })).toThrow(/email/);
    expect(() => R.conferirListaBranca('tickets', tick)).not.toThrow();
    expect(() => R.conferirListaBranca('tickets', { ...tick, tickets: [{ ...tick.tickets[0], para: 'x' }] })).toThrow(/para/);
  });
  it('lerPendencias vira aviso com o tipo do envio; o torto fica de fora', () => {
    expect(lerPendencias(pend)).toEqual([{ id: 'extrato-2026-10', titulo: 'Extrato bancário de outubro', texto: '', ir: 'documentos', tipo: 'extrato' }]);
    expect(lerPendencias({ itens: [{ id: '../x', titulo: 'y' }, { id: 'extrato-2026-10', titulo: '' }] })).toEqual([]);
    expect(lerPendencias(null)).toEqual([]);
  });
  it('lerTickets: o bom passa; código torto e número negativo não', () => {
    expect(lerTickets(tick)).toEqual(tick.tickets);
    expect(lerTickets({ tickets: [{ ...tick.tickets[0], codigo: 'a/b' }] })).toEqual([]);
    expect(lerTickets({ tickets: [{ ...tick.tickets[0], faltam: -1 }] })).toEqual([]);
  });
  it('o estado leva os avisos e os tickets', () => {
    const base = { resumo: null, nomeDoLink: 'Padaria', guias: [], agenda: [], envios: [], chamados: [] };
    const e = estadoDoEspelho({ ...base, avisos: lerPendencias(pend), tickets: lerTickets(tick) });
    expect([e.avisos.length, e.tickets.length]).toEqual([1, 1]);
    expect(estadoDoEspelho(base).avisos).toEqual([]);
  });
});

// o acervo do escritório (plano do Acessórias, 17/11/2026, ficha documentos-do-escritorio)
describe('os documentos do escritório', () => {
  const bom = { tipo: 'escritorio', id: 'esc-58-contrato-pdf-abc', nome: 'Contrato social.pdf', area: 'societario', enviadoEm: '2026-11-17T10:00:00.000Z', tamanho: 1000, partes: 1 };
  it('a lista branca do robô corta o que não pode sair', () => {
    expect(() => R.conferirListaBranca('documentoEscritorio', bom)).not.toThrow();
    expect(() => R.conferirListaBranca('documentoEscritorio', { ...bom, caminho: 'G:/2026/58' })).toThrow(/caminho/);
  });
  it('lê o documento; o Novo some quando foi baixado neste aparelho; o torto fica de fora', () => {
    expect(lerDocumentoDoEscritorio(bom.id, bom)).toMatchObject({ id: bom.id, nome: 'Contrato social.pdf', area: 'societario', novo: true, formato: 'PDF', partes: 1 });
    expect(lerDocumentoDoEscritorio(bom.id, bom, new Set([bom.id]))?.novo).toBe(false);
    expect(lerDocumentoDoEscritorio(bom.id, { ...bom, tipo: 'dp' })).toBeNull();
    expect(lerDocumentoDoEscritorio(bom.id, { ...bom, area: 'outra' })).toBeNull();
    expect(lerDocumentoDoEscritorio('../x', bom)).toBeNull();
  });
  it('a Central só aparece com documento', () => {
    const base = { resumo: null, nomeDoLink: 'Padaria', guias: [], agenda: [], envios: [], chamados: [] };
    expect(estadoDoEspelho(base).secoes.documentos).toBe(false);
    const e = estadoDoEspelho({ ...base, documentos: [lerDocumentoDoEscritorio(bom.id, bom)!] });
    expect(e.secoes.documentos).toBe(true);
    expect(e.documentos.map(d => d.nome)).toEqual(['Contrato social.pdf']);
    expect('partes' in e.documentos[0]).toBe(false);
  });
});

// a ficha cadastral da empresa (plano do Acessórias, 18/11/2026, ficha dados-cadastrais)
describe('a ficha da empresa no espelho', () => {
  const bom = { razaoSocial: 'PADARIA BOA LTDA', cnpj: '12345678000190', regime: 'Simples', cnae: '1091-1/02 - Padaria', abertura: '2015-03-02', endereco: 'RUA A, 10', socios: [{ nome: 'MARIA SOUZA' }], atualizadoEm: 'x' };
  it('a lista branca do robô: os sócios só pelo nome', () => {
    expect(() => R.conferirListaBranca('ficha', bom)).not.toThrow();
    expect(() => R.conferirListaBranca('ficha', { ...bom, socios: [{ nome: 'MARIA', cpf: '123' }] })).toThrow(/cpf/);
    expect(() => R.conferirListaBranca('ficha', { ...bom, situacao: 'ATIVA' })).toThrow(/situacao/);
  });
  it('lerFicha: o CNPJ formatado e os sócios; sem razão social ou CNPJ, nada', () => {
    expect(lerFicha(bom)).toMatchObject({ razaoSocial: 'PADARIA BOA LTDA', cnpj: '12.345.678/0001-90', socios: [{ nome: 'MARIA SOUZA' }] });
    expect(lerFicha({ ...bom, cnpj: '123' })).toBeNull();
    expect(lerFicha({ ...bom, razaoSocial: '' })).toBeNull();
  });
  it('o estado leva a ficha', () => {
    const base = { resumo: null, nomeDoLink: 'Padaria', guias: [], agenda: [], envios: [], chamados: [] };
    expect(estadoDoEspelho(base).ficha).toBeNull();
    expect(estadoDoEspelho({ ...base, ficha: lerFicha(bom) }).ficha?.razaoSocial).toBe('PADARIA BOA LTDA');
  });
});

// as certidões (plano do Acessórias, 18/11/2026, ficha certidoes)
describe('as certidões no espelho', () => {
  const bom = { tipo: 'certidao', id: 'cert-58-federal', nome: 'Certidão Federal.pdf', orgao: 'Federal', validoAte: '2026-12-15', tamanho: 1000, partes: 1 };
  it('a lista branca do robô', () => {
    expect(() => R.conferirListaBranca('documentoCertidao', bom)).not.toThrow();
    expect(() => R.conferirListaBranca('documentoCertidao', { ...bom, observacao: 'x' })).toThrow(/observacao/);
  });
  it('lerCertidao: na pasta Certidões, com a validade; o torto fica de fora', () => {
    expect(lerCertidao(bom.id, bom)).toMatchObject({ nome: 'Certidão Federal', descricao: 'válida até 15/12/2026', pasta: 'certidoes', validoAte: '2026-12-15', novo: true });
    expect(lerCertidao(bom.id, { ...bom, validoAte: '' })?.descricao).toBe('sem a validade no nome do arquivo');
    expect(lerCertidao(bom.id, { ...bom, tipo: 'escritorio' })).toBeNull();
    expect(lerCertidao(bom.id, { ...bom, orgao: '' })).toBeNull();
  });
});

// as entregas a confirmar (plano do Acessórias, 18/11/2026, ficha confirmar-entrega)
describe('as entregas a confirmar no espelho', () => {
  const bom = { itens: [{ id: 'ent000001', titulo: 'DAS de outubro', competencia: '2026-10' }], atualizadoEm: '2026-11-18T10:00:00Z' };
  it('a lista branca do robô: sem quem levou nem valores', () => {
    expect(() => R.conferirListaBranca('entregas', bom)).not.toThrow();
    expect(() => R.conferirListaBranca('entregas', { itens: [{ ...bom.itens[0], entregadoPor: 'x' }] })).toThrow(/entregadoPor/);
  });
  it('lerEntregas: o item torto fica de fora', () => {
    expect(lerEntregas(bom)).toEqual(bom.itens);
    expect(lerEntregas({ itens: [{ id: '../x', titulo: 'a' }, { id: 'ent000002', titulo: '' }, { id: 'ent000003', titulo: 'FGTS', competencia: 'out' }] })).toEqual([{ id: 'ent000003', titulo: 'FGTS', competencia: '' }]);
    expect(lerEntregas(null)).toEqual([]);
  });
  it('o estado leva as entregas', () => {
    const base = { resumo: null, nomeDoLink: 'Padaria', guias: [], agenda: [], envios: [], chamados: [] };
    expect(estadoDoEspelho(base).entregas).toEqual([]);
    expect(estadoDoEspelho({ ...base, entregas: bom.itens }).entregas).toEqual(bom.itens);
  });
});

// a guia paga pelo extrato (plano do Acessórias, 18/11/2026, ficha guia-paga-confirmada)
describe('a guia paga no espelho', () => {
  const guia = { id: 'das-2026-10-58', tipo: 'DAS', competencia: '2026-10', vencimento: '20/11/2026', valor: 917.42, situacao: 'a vencer', temPdf: true };
  it('a lista branca do robô aceita o pagoEm; lerGuia lê a data e ignora a torta', () => {
    expect(() => R.conferirListaBranca('guia', { ...guia, pagoEm: '18/11/2026' })).not.toThrow();
    expect(lerGuia(guia.id, { ...guia, pagoEm: '18/11/2026' })?.pagoEm).toBe('18/11/2026');
    expect(lerGuia(guia.id, { ...guia, pagoEm: 'ontem' })).not.toHaveProperty('pagoEm');
  });
  it('a paga sai de "a pagar", vai para Pagas e a aba aparece', () => {
    const base = { resumo: null, nomeDoLink: 'Padaria', agenda: [], envios: [], chamados: [] };
    const paga = lerGuia(guia.id, { ...guia, pagoEm: '18/11/2026' })!;
    const aberta = lerGuia('fgts-2026-10-58', { ...guia, tipo: 'FGTS' })!;
    const e = estadoDoEspelho({ ...base, guias: [paga, aberta] });
    expect(e.guias.map(g => g.id)).toEqual(['fgts-2026-10-58']);
    expect(e.pagas).toEqual([{ id: 'das-2026-10-58', tipo: 'DAS', nome: 'DAS (Simples Nacional)', competencia: '2026-10', valor: 917.42, pagoEm: '18/11/2026', temComprovante: false }]);
    expect(e.secoes.pagas).toBe(true);
    expect(estadoDoEspelho({ ...base, guias: [aberta] }).secoes.pagas).toBe(false);
  });
});

// os parcelamentos (plano do Acessórias, 18/11/2026, ficha parcelamentos)
describe('os parcelamentos no espelho', () => {
  const item = { id: 'pgfn-1', orgao: 'PGFN · Dívida ativa', modalidade: 'Transação', parcela: 12, parcelas: 60, valorParcela: 350.5, vencimento: '20/11/2026' };
  it('a lista branca do robô: sem obs nem número do processo', () => {
    expect(() => R.conferirListaBranca('parcelamentos', { itens: [item], atualizadoEm: 'x' })).not.toThrow();
    expect(() => R.conferirListaBranca('parcelamentos', { itens: [{ ...item, obs: 'x' }] })).toThrow(/obs/);
    expect(() => R.conferirListaBranca('parcelamentos', { itens: [{ ...item, numero: '1' }] })).toThrow(/numero/);
  });
  it('lerParcelamentos: o torto fica de fora', () => {
    expect(lerParcelamentos({ itens: [item] })).toEqual([item]);
    expect(lerParcelamentos({ itens: [{ ...item, parcela: 61 }, { ...item, vencimento: 'x' }, { ...item, valorParcela: 0 }] })).toEqual([]);
    expect(lerParcelamentos(null)).toEqual([]);
  });
});
