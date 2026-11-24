import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarRepoSciReportExemplo, criarRepoSciReportFuncao, lerGuiaDoSci } from './sciReport';

const TOKEN = 'a'.repeat(40);
const GUIA = { id: '101', nome: 'DAS', competencia: '2026-10', vencimento: '20/11/2026', valor: 1534.27, situacao: 'vencida' };

/** a função de mentira: responde com o status e o corpo, e guarda o que o site mandou */
function funcao(status: number, corpo: unknown) {
  const pedidos: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => { pedidos.push({ url, init }); return { status, json: async () => corpo }; });
  return pedidos;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('Área do Cliente: as guias do SCI Report', () => {
  it('lê a guia campo a campo e descarta a torta', () => {
    expect(lerGuiaDoSci(GUIA)).toEqual(GUIA);
    expect(lerGuiaDoSci({ ...GUIA, situacao: 'pagamento informado', pagamentoEm: '19/11/2026', valorPago: 1534.27, extra: 'x' }))
      .toEqual({ ...GUIA, situacao: 'pagamento informado', pagamentoEm: '19/11/2026', valorPago: 1534.27 });
    expect(lerGuiaDoSci({ ...GUIA, id: 'abc' })).toBeNull();
    expect(lerGuiaDoSci({ ...GUIA, situacao: 'paga' })).toBeNull();
    expect(lerGuiaDoSci({ ...GUIA, vencimento: '2026-11-20' })).toBeNull();
  });

  it('pede à função só com o token (POST, sem referrer) e devolve as guias', async () => {
    const pedidos = funcao(200, { acesso: 'liberado', guias: [GUIA, { id: 'x' }], semEmpresaNoSci: 0 });
    expect(await criarRepoSciReportFuncao().guias(TOKEN)).toEqual({ estado: 'ok', guias: [GUIA] });
    expect(pedidos[0].url).toBe('https://southamerica-east1-entregas-2e5e2.cloudfunctions.net/guiasDoSciReport');
    expect(pedidos[0].init).toMatchObject({ method: 'POST', referrerPolicy: 'no-referrer', body: JSON.stringify({ token: TOKEN }) });
  });

  it('link recusado não é erro: o card some', async () => {
    funcao(403, { acesso: 'link invalido' });
    expect(await criarRepoSciReportFuncao().guias(TOKEN)).toEqual({ estado: 'sem acesso' });
    funcao(502, { acesso: 'erro' });
    expect((await criarRepoSciReportFuncao().guias(TOKEN)).estado).toBe('erro');
  });

  it('com "Exigir senha": a função responde 401 e o pedido vai de novo com o login do cliente', async () => {
    const pedidos: RequestInit[] = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      pedidos.push(init);
      const comLogin = (init.headers as Record<string, string>).Authorization === 'Bearer login-do-cliente';
      return comLogin ? { status: 200, json: async () => ({ acesso: 'liberado', guias: [GUIA] }) } : { status: 401, json: async () => ({ acesso: 'precisa entrar' }) };
    });
    expect(await criarRepoSciReportFuncao(async () => 'login-do-cliente').guias(TOKEN)).toEqual({ estado: 'ok', guias: [GUIA] });
    expect(pedidos).toHaveLength(2);
    // sem login: fica sem acesso, sem pedir de novo
    pedidos.length = 0;
    expect(await criarRepoSciReportFuncao(async () => '').guias(TOKEN)).toEqual({ estado: 'sem acesso' });
    expect(pedidos).toHaveLength(1);
  });

  it('o PDF: só a URL https; a guia de fora vira a frase para o cliente', async () => {
    funcao(200, { acesso: 'liberado', url: 'https://s3.exemplo/101.pdf' });
    expect(await criarRepoSciReportFuncao().urlDoPdf(TOKEN, '101')).toBe('https://s3.exemplo/101.pdf');
    funcao(200, { acesso: 'liberado', url: 'javascript:alert(1)' });
    await expect(criarRepoSciReportFuncao().urlDoPdf(TOKEN, '101')).rejects.toThrow('Não deu para abrir');
    funcao(403, { acesso: 'guia de outra empresa' });
    await expect(criarRepoSciReportFuncao().urlDoPdf(TOKEN, '555')).rejects.toThrow('não está mais no SCI Report');
  });

  it('o exemplo tem guias e não sai do navegador', async () => {
    const pedidos = funcao(200, {});
    const r = await criarRepoSciReportExemplo(new Date(2026, 10, 24)).guias('exemplo');
    expect(r.estado === 'ok' && r.guias.length).toBe(3);
    expect(pedidos).toHaveLength(0);
  });
});
