import { describe, expect, it } from 'vitest';
// o porte das regras que o robô usa para GRAVAR o espelho e para CONFERIR as caixas (robo/area-cliente-regras.js): o
// teste lê o que o robô grava e manda o que o robô confere, para a leitura e os pedidos não se afastarem dele
// @ts-expect-error: o robô é CommonJS sem tipos (robo/ fica fora do app)
import roboImportado from '../../../../../../robo/area-cliente-regras.js';
import {
  base64DosBytes, comPendentes, documentoFormatado, ehTokenDoLink, estadoDoEspelho, lerAgenda, lerChamado, lerGuia, lerRecibo, lerResumo,
  nomeDoPdfDaGuia, pedidoDeChamado, pedidoDeEnvio, respostaVoltou,
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
  it('a guia do FGTS (area-cliente.js) e a de DAS (envios-do-nads.js, sem número)', () => {
    const fgts = R.guiaDoFgts({ id: 'p1', competencia: '2026-09', status: 'pronto', modo: 'emitir', vencimento: '20/10/2026', valor: '1.917,42', numeroGuia: '123', aviso: '', pdfNome: 'f.pdf' }, HOJE);
    R.conferirListaBranca('guia', fgts);
    expect(lerGuia('p1', fgts)).toEqual(fgts);
    const das = { id: 'das-2026-09-58', tipo: 'DAS', competencia: '2026-09', vencimento: '20/10/2026', valor: 432.1, situacao: 'a vencer', temPdf: true };
    R.conferirListaBranca('guia', das);
    expect(lerGuia(das.id, das)).toEqual(das);
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
  it('o chamado: "Você" e "Escritório"; a nota interna nunca chegou ao espelho', () => {
    const interno = { tipo: 'ferias', titulo: 'Férias da Maria', situacao: 'respondido', mensagens: [
      { de: 'cliente', autor: 'Cliente', texto: 'Posso?', em: '2026-10-10T09:00:00.000Z' },
      { de: 'escritorio', autor: 'Clara', texto: 'Pode.', em: '2026-10-10T10:00:00.000Z' },
      { de: 'escritorio', autor: 'Clara', texto: 'nota nossa', em: '2026-10-10T10:01:00.000Z', interna: true },
    ] };
    const gravado = R.chamadoDoCliente(R.chamadoInterno('c1', interno));
    R.conferirListaBranca('chamado', gravado);
    const lido = lerChamado('c1', gravado)!;
    expect(lido).toEqual(gravado);
    expect(JSON.stringify(lido)).not.toContain('Clara');
  });
  it('os campos lidos são exatamente os que o robô pode gravar (lista branca)', () => {
    const C = R.CAMPOS_DO_ESPELHO;
    expect(C.resumo).toEqual(['empresas', 'escritorio', 'atualizadoEm']);
    expect(C.guia).toEqual(['id', 'tipo', 'competencia', 'vencimento', 'valor', 'numero', 'situacao', 'temPdf']);
    expect(C.agenda).toEqual(['mes', 'itens', 'atualizadoEm']);
    expect(C.item).toEqual(['id', 'nome', 'vence', 'situacao', 'feitoEm']);
    expect(C.chamado).toEqual(['id', 'tipo', 'titulo', 'situacao', 'mensagens']);
    expect(C.mensagem).toEqual(['de', 'autor', 'texto', 'em']);
    expect(C.recibo).toEqual(['id', 'nome', 'tipo', 'tamanho', 'recebidoEm']);
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
    expect(Uint8Array.from(atob(base64DosBytes(bytes)), c => c.charCodeAt(0))).toEqual(bytes);
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
    expect(e).toMatchObject({ carregado: true, valido: true, exemplos: false, erro: '', secoes: { documentos: false, dp: false, pagas: false } });
    expect(e.resumo?.empresas[0].nome).toBe('Padaria Boa');
    expect(e.agenda.map(a => a.mes)).toEqual(['2026-10', '2026-11']);
  });
  it('o nome do PDF da guia', () => {
    expect(nomeDoPdfDaGuia({ tipo: 'FGTS', competencia: '2026-09' })).toBe('guia-fgts-2026-09.pdf');
    expect(nomeDoPdfDaGuia(null)).toBe('guia.pdf');
  });
});
