// O repositório do banco da Área do Cliente com um Firestore de mentira (vi.mock): o que ele ouve, quando a tela vira
// "link inválido" e o que ele grava nas caixas (as chaves exatas das regras). Nada vai ao banco de verdade.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EstadoDaArea } from './areaCliente';

type Dados = Record<string, unknown>;
interface Ouvinte { caminho: string; proximo: (s: unknown) => void; erro: (e: { code: string; message: string }) => void; ativo: boolean }

const falso = vi.hoisted(() => ({
  ouvintes: [] as Ouvinte[],
  gravados: [] as { caminho: string; dados: Dados }[],
  recusar: '',
  pdf: [] as Dados[],
  lidos: [] as string[],
}));

vi.mock('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({ name: 'cliente' }) }));
vi.mock('firebase/firestore', () => {
  const ref = (base: { path: string }, ...seg: string[]) => ({ path: [base.path, ...seg].filter(Boolean).join('/') });
  return {
    initializeFirestore: () => ({ path: '' }),
    getFirestore: () => ({ path: '' }),
    doc: ref,
    collection: ref,
    serverTimestamp: () => 'HORA-DO-SERVIDOR',
    onSnapshot: (r: { path: string }, proximo: Ouvinte['proximo'], erro: Ouvinte['erro']) => {
      const o = { caminho: r.path, proximo, erro, ativo: true };
      falso.ouvintes.push(o);
      return () => { o.ativo = false; };
    },
    addDoc: async (r: { path: string }, dados: Dados) => {
      if (falso.recusar) throw Object.assign(new Error('recusado'), { code: falso.recusar });
      falso.gravados.push({ caminho: r.path, dados });
      return { id: 'pedido' + falso.gravados.length };
    },
    getDocs: async (r: { path: string }) => { falso.lidos.push(r.path); return { docs: falso.pdf.map((x, i) => ({ id: String(i), data: () => x })) }; },
  };
});

const { criarRepoAreaClienteFirestore } = await import('./areaCliente.firestore');

const TOKEN = '0123456789abcdef'.repeat(3).slice(0, 40);
const RAIZ = 'areasCliente/' + TOKEN;
const docSnap = (dados: Dados | null) => ({ exists: () => dados != null, get: (k: string) => dados?.[k], data: () => dados });
const colSnap = (docs: Record<string, Dados>) => ({ docs: Object.entries(docs).map(([id, x]) => ({ id, data: () => x })) });
const ouvinte = (caminho: string) => falso.ouvintes.find(o => o.caminho === caminho && o.ativo)!;

const CHAMADO = { id: 'c1', tipo: 'ferias', titulo: 'Férias', situacao: 'respondido', mensagens: [
  { de: 'cliente', autor: 'Você', texto: 'Posso?', em: '2026-10-10T09:00:00.000Z' },
  { de: 'escritorio', autor: 'Escritório', texto: 'Pode.', em: '2026-10-10T10:00:00.000Z' },
] };

/** abre o link e entrega o espelho inteiro; devolve as telas que a tela recebeu */
function abrirComEspelho(repo: ReturnType<typeof criarRepoAreaClienteFirestore>) {
  const telas: EstadoDaArea[] = [];
  const parar = repo.assinar(TOKEN, e => telas.push(e));
  ouvinte(RAIZ).proximo(docSnap({ codigos: [58], nome: 'Padaria Boa', criadoPor: 'Fulano' }));
  ouvinte(RAIZ + '/resumo/atual').proximo(docSnap({ empresas: [{ codigo: 58, nome: 'Padaria Boa Ltda', cnpj: '12345678000190' }], escritorio: { whatsapp: '(38) 9138-3638' }, atualizadoEm: '2026-10-17T10:00:00.000Z' }));
  ouvinte(RAIZ + '/guias').proximo(colSnap({ 'das-2026-09-58': { id: 'das-2026-09-58', tipo: 'DAS', competencia: '2026-09', vencimento: '20/10/2026', valor: 432.1, situacao: 'a vencer', temPdf: true } }));
  ouvinte(RAIZ + '/agenda').proximo(colSnap({ '2026-10': { mes: '2026-10', itens: [{ id: 'das', nome: 'DAS do Simples Nacional', vence: '2026-10-20', situacao: 'a fazer' }], atualizadoEm: 'x' } }));
  ouvinte(RAIZ + '/envios').proximo(colSnap({ e1: { id: 'e1', nome: 'extrato.pdf', tipo: 'extrato', tamanho: 10, recebidoEm: '2026-10-17T09:00:00.000Z' } }));
  ouvinte(RAIZ + '/chamados').proximo(colSnap({ c1: CHAMADO }));
  return { telas, parar };
}

beforeEach(() => {
  falso.ouvintes.length = 0; falso.gravados.length = 0; falso.recusar = ''; falso.pdf.length = 0; falso.lidos.length = 0;
});

describe('abrir o link', () => {
  it('token que não é de 40 hex: link inválido sem ir ao banco', () => {
    const telas: EstadoDaArea[] = [];
    criarRepoAreaClienteFirestore().assinar('nao-e-token', e => telas.push(e));
    expect(falso.ouvintes).toHaveLength(0);
    expect(telas).toEqual([expect.objectContaining({ carregado: true, valido: false, erro: '' })]);
  });

  it('link que não existe (o banco recusa): link inválido, e só o documento do link foi pedido', () => {
    const telas: EstadoDaArea[] = [];
    criarRepoAreaClienteFirestore().assinar(TOKEN, e => telas.push(e));
    expect(falso.ouvintes.map(o => o.caminho)).toEqual([RAIZ]);
    ouvinte(RAIZ).erro({ code: 'permission-denied', message: 'Missing or insufficient permissions.' });
    expect(telas).toEqual([expect.objectContaining({ carregado: true, valido: false, erro: '' })]);
    expect(falso.ouvintes.filter(o => o.ativo)).toHaveLength(0);
  });

  it('outro erro do banco não vira "link inválido": a tela diz para tentar depois', () => {
    const telas: EstadoDaArea[] = [];
    criarRepoAreaClienteFirestore().assinar(TOKEN, e => telas.push(e));
    ouvinte(RAIZ).erro({ code: 'resource-exhausted', message: 'cota' });
    expect(telas[0]).toMatchObject({ carregado: true, valido: false });
    expect(telas[0].erro).toMatch(/Tente de novo/);
  });

  it('link bom: ouve o espelho e só mostra quando tudo chegou; nada do documento do link além do nome', () => {
    const { telas } = abrirComEspelho(criarRepoAreaClienteFirestore());
    expect(falso.ouvintes.map(o => o.caminho).sort()).toEqual([RAIZ, RAIZ + '/agenda', RAIZ + '/chamados', RAIZ + '/envios', RAIZ + '/guias', RAIZ + '/resumo/atual'].sort());
    expect(telas).toHaveLength(1);
    const e = telas[0];
    expect(e).toMatchObject({ carregado: true, valido: true, exemplos: false, secoes: { documentos: false, dp: false, pagas: false } });
    expect(e.resumo?.empresas).toEqual([{ codigo: 58, nome: 'Padaria Boa Ltda', cnpj: '12.345.678/0001-90' }]);
    expect(e.guias.map(g => g.id)).toEqual(['das-2026-09-58']);
    expect(e.agenda[0].itens).toHaveLength(1);
    expect(e.envios.map(x => x.id)).toEqual(['e1']);
    expect(e.chamados.map(c => c.id)).toEqual(['c1']);
    expect(JSON.stringify(e)).not.toContain('Fulano');
  });

  it('revogado com a página aberta: a tela vira "link inválido" e para de ouvir', () => {
    const { telas } = abrirComEspelho(criarRepoAreaClienteFirestore());
    ouvinte(RAIZ).erro({ code: 'permission-denied', message: 'x' });
    expect(telas.at(-1)).toMatchObject({ valido: false });
    expect(falso.ouvintes.filter(o => o.ativo)).toHaveLength(0);
  });
});

describe('o que o cliente manda', () => {
  it('abrir chamado: a caixa areaClienteChamados com as chaves da regra; aparece na hora como aberto', async () => {
    const repo = criarRepoAreaClienteFirestore();
    const { telas } = abrirComEspelho(repo);
    const id = await repo.abrirChamado(TOKEN, { tipo: 'documento', texto: 'Preciso da CND estadual', foto: 'AAAA' });
    expect(id).toBe('pedido1');
    expect(falso.gravados).toEqual([{ caminho: 'areaClienteChamados', dados: { token: TOKEN, tipo: 'documento', titulo: 'Preciso da CND estadual', texto: 'Preciso da CND estadual', criadoEm: 'HORA-DO-SERVIDOR' } }]);
    expect(telas.at(-1)!.chamados[0]).toMatchObject({ id: 'pedido1', situacao: 'aberto' });
    // o robô processou: o espelho traz o chamado com o mesmo id e ele não aparece duas vezes
    ouvinte(RAIZ + '/chamados').proximo(colSnap({ c1: CHAMADO, pedido1: { ...CHAMADO, id: 'pedido1', tipo: 'documento', situacao: 'aberto', mensagens: [CHAMADO.mensagens[0]] } }));
    expect(telas.at(-1)!.chamados.filter(c => c.id === 'pedido1')).toHaveLength(1);
  });

  it('responder: o id e o tipo do chamado, sem título', async () => {
    const repo = criarRepoAreaClienteFirestore();
    const { telas } = abrirComEspelho(repo);
    await repo.responderChamado(TOKEN, 'c1', ' Obrigado ');
    expect(falso.gravados[0]).toEqual({ caminho: 'areaClienteChamados', dados: { token: TOKEN, chamadoId: 'c1', tipo: 'ferias', texto: 'Obrigado', criadoEm: 'HORA-DO-SERVIDOR' } });
    expect(telas.at(-1)!.chamados[0].mensagens.at(-1)).toMatchObject({ de: 'cliente', texto: 'Obrigado' });
    await expect(repo.responderChamado(TOKEN, 'nao-existe', 'oi')).rejects.toThrow(/ainda não chegou/);
  });

  it('enviar: areaClienteEnvios com o mime pela extensão e o arquivo em base64', async () => {
    const repo = criarRepoAreaClienteFirestore();
    const bytes = new TextEncoder().encode('%PDF-1.4 teste');
    await repo.enviar(TOKEN, 'extrato', [new File([bytes], 'Extrato Outubro.PDF', { type: '' })]);
    expect(falso.gravados).toHaveLength(1);
    const { caminho, dados } = falso.gravados[0];
    expect(caminho).toBe('areaClienteEnvios');
    expect(Object.keys(dados).sort()).toEqual(['base64', 'criadoEm', 'mime', 'nome', 'tamanho', 'tipo', 'token']);
    expect(dados).toMatchObject({ token: TOKEN, nome: 'Extrato Outubro.PDF', tipo: 'extrato', mime: 'application/pdf', tamanho: bytes.length, criadoEm: 'HORA-DO-SERVIDOR' });
    expect(atob(dados.base64 as string)).toBe('%PDF-1.4 teste');
  });

  it('arquivo grande ou de outro tipo: nada vai ao banco (nem os bons do mesmo lote)', async () => {
    const repo = criarRepoAreaClienteFirestore();
    const bom = new File([new Uint8Array(10)], 'a.pdf');
    await expect(repo.enviar(TOKEN, 'extrato', [bom, new File([new Uint8Array(716801)], 'b.pdf')])).rejects.toThrow(/700 KB/);
    await expect(repo.enviar(TOKEN, 'extrato', [new File([new Uint8Array(10)], 'c.exe')])).rejects.toThrow(/só aceitamos/);
    expect(falso.gravados).toHaveLength(0);
  });

  it('o banco recusa (link revogado): a mensagem em português', async () => {
    const repo = criarRepoAreaClienteFirestore();
    falso.recusar = 'permission-denied';
    await expect(repo.abrirChamado(TOKEN, { tipo: 'duvida', texto: 'oi' })).rejects.toThrow('Este link não vale mais. Peça um novo ao escritório.');
    falso.recusar = 'unavailable';
    await expect(repo.enviar(TOKEN, 'nota', [new File([new Uint8Array(4)], 'n.xml')])).rejects.toThrow(/Confira a internet/);
  });
});

describe('o PDF da guia', () => {
  it('junta os pedaços (n de 0) e dá o nome pela guia', async () => {
    const repo = criarRepoAreaClienteFirestore();
    abrirComEspelho(repo);
    falso.pdf.push({ base64: btoa('meio'), n: 1, total: 2 }, { base64: btoa('%PDF-'), n: 0, total: 2 });
    const r = await repo.baixarGuia(TOKEN, 'das-2026-09-58');
    expect(falso.lidos).toEqual([RAIZ + '/guias/das-2026-09-58/pdf']);
    expect(r?.nome).toBe('guia-das-2026-09.pdf');
    expect(await r!.arquivo.text()).toBe('%PDF-meio');
  });
  it('faltando pedaço ou com id estranho: null (a tela avisa)', async () => {
    const repo = criarRepoAreaClienteFirestore();
    falso.pdf.push({ base64: btoa('x'), n: 1, total: 2 });
    expect(await repo.baixarGuia(TOKEN, 'g1')).toBeNull();
    expect(await repo.baixarGuia(TOKEN, '../segredo')).toBeNull();
  });
});
