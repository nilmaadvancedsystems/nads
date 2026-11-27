// Quem fala com o SCI Report 24h (24/11/2026): o login com o JWT guardado na memória, a empresa pelo CNPJ, as guias da
// empresa e a URL do PDF; e o atendimento da Área do Cliente, que confere o link (e a senha) antes de perguntar à SCI.
// Sem rede própria: o "buscar" vem de fora (na função do Firebase, o fetch do Node), e os tokens também (segredos()).
// Os tokens nunca vão para o navegador, para o banco nem para o log: só o JWT de 1 hora fica na memória.
import {
  acessoDaArea, consultaDePublicados, empresaDoSciPeloDocumento, guiasDoSciReport, janelaDoSci, lerEmpresasDoSci, lerLoginDoSci,
  lerPaginaDePublicados, sessaoDoSciAindaAceita, sessaoDoSciVale, urlDoPdfDoSci, SCI_AUTH, SCI_RELATORIO,
  type AcessoDaArea, type GuiaDoSciReport, type LinkDaArea, type LoginDaArea, type PublicacaoDoSci, type SessaoDoSci,
} from './sciReport';

/** O publicadosId da resposta da publicação manual ({ publicados: [{ publicadosId }] }); 0 se não veio. */
export function publicadosIdDaResposta(resposta: unknown): number {
  // (26/11/2026, o primeiro DAS de teste da 590: publicou, mas a resposta não veio como a documentação diz) procura o
  // publicadosId em qualquer nível da resposta (publicados[0], dados, retorno…), até 4 de fundo
  const achar = (x: unknown, fundo: number): number => {
    if (!x || typeof x !== 'object' || fundo > 4) return 0;
    if (Array.isArray(x)) { for (const i of x) { const n = achar(i, fundo + 1); if (n) return n; } return 0; }
    const o = x as Record<string, unknown>;
    const n = Number(o.publicadosId);
    if (Number.isInteger(n) && n > 0) return n;
    for (const v of Object.values(o)) { const m = achar(v, fundo + 1); if (m) return m; }
    return 0;
  };
  return achar(resposta, 0);
}

export type MetodoDoSci = 'GET' | 'POST' | 'PUT';
/** O fetch, do tamanho que o cliente usa (o da função é o fetch do Node). */
export type BuscarNoSci = (url: string, init: { method: MetodoDoSci; headers: Record<string, string>; body?: string | Uint8Array | FormData }) => Promise<{ status: number; json: () => Promise<unknown> }>;
/** Os dois tokens: o de Parceiro (a SCI emite) e o de Cliente (gerado no SCI WEB com um usuário da contabilidade). */
export interface SegredosDoSci { parceiro: string; cliente: string }

/** O erro de uma chamada à SCI, com o status (a mensagem nunca leva os tokens). */
export class ErroDoSci extends Error {
  constructor(readonly status: number, mensagem: string) { super(mensagem); this.name = 'ErroDoSci'; }
}

/** no máximo estas páginas por empresa (200 guias cada): mais que isto é engano, não guia de três meses */
const MAX_PAGINAS = 10;

export interface ClienteSciReport {
  /** o código da empresa no SCI pelo CNPJ/CPF (guardado na memória); null se não achou ou se ficou em dúvida */
  empresaPeloDocumento(documento: string): Promise<number | null>;
  /** os impostos publicados da empresa entre duas competências ('aaaa-mm') */
  publicacoes(empresaId: number, de: string, ate: string, publicadosId?: number): Promise<PublicacaoDoSci[]>;
  /** a URL temporária do PDF (com o token da contabilidade não marca como visto no SCI) */
  urlDoPdf(publicadosId: number, empresaId: number): Promise<string>;
  /**
   * Publica um PDF na empresa (POST /publicacao-manual, BETA na SCI: pode mudar). `campos` sai de camposDaPublicacao; devolve
   * o publicadosId. Erro de validação (422) vira ErroDoSci com a mensagem da SCI.
   */
  publicar(campos: Record<string, string>, pdf: Uint8Array, nomeDoArquivo: string): Promise<number>;
}

export function criarClienteSciReport(deps: { buscar: BuscarNoSci; segredos: () => SegredosDoSci | Promise<SegredosDoSci>; agora?: () => number }): ClienteSciReport {
  const agora = deps.agora ?? (() => Date.now());
  let sessao: SessaoDoSci | null = null;
  const empresas = new Map<string, number | null>();

  async function json(r: { status: number; json: () => Promise<unknown> }): Promise<unknown> {
    if (r.status === 204) return null;
    try { return await r.json(); } catch { return null; }
  }
  const mensagemDe = (corpo: unknown) => {
    const m = corpo && typeof corpo === 'object' ? (corpo as { mensagem?: unknown }).mensagem : '';
    return typeof m === 'string' && m.trim() ? m.trim().slice(0, 200) : '';
  };

  async function entrar(): Promise<SessaoDoSci> {
    // o refresh primeiro, enquanto o JWT ainda é aceito (não manda os tokens de novo)
    if (sessaoDoSciAindaAceita(sessao, agora())) {
      const r = await deps.buscar(SCI_AUTH + '/api/v1/auth/refresh', { method: 'POST', headers: { Authorization: 'Bearer ' + sessao.token } });
      const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(await json(r), agora()) : null;
      if (nova) return (sessao = nova);
    }
    const s = await deps.segredos();
    if (!s.parceiro || !s.cliente) throw new ErroDoSci(0, 'faltam os tokens do SCI Report');
    const r = await deps.buscar(SCI_AUTH + '/api/v1/auth/credencial/login', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(s.parceiro + ':' + s.cliente) } });
    const corpo = await json(r);
    const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(corpo, agora()) : null;
    if (!nova) throw new ErroDoSci(r.status, r.status === 401 ? 'a SCI recusou os tokens (o de Parceiro ou o de Cliente)' : 'o login na SCI não deu certo (' + r.status + ')');
    return (sessao = nova);
  }

  /** uma chamada ao SCI Report com o JWT; o 401 (sessão caiu) entra de novo uma vez */
  async function chamar(metodo: MetodoDoSci, caminho: string, montarCorpo?: () => FormData): Promise<unknown> {
    for (let vez = 0; vez < 2; vez++) {
      const s = sessaoDoSciVale(sessao, agora()) ? sessao : await entrar();
      // o FormData é montado de novo a cada tentativa (o corpo não se reaproveita depois de enviado)
      const r = await deps.buscar(SCI_RELATORIO + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + s.token, Accept: 'application/json' }, ...(montarCorpo ? { body: montarCorpo() } : {}) });
      if (r.status === 401 && vez === 0) { sessao = null; continue; }
      const corpo = await json(r);
      if (r.status >= 200 && r.status < 300) return corpo;
      throw new ErroDoSci(r.status, mensagemDe(corpo) || 'o SCI Report respondeu ' + r.status);
    }
    throw new ErroDoSci(401, 'o SCI Report recusou o login');
  }

  return {
    async empresaPeloDocumento(documento) {
      const d = documento.replace(/\D/g, '');
      if (empresas.has(d)) return empresas.get(d) ?? null;
      if (d.length !== 14 && d.length !== 11) return null;
      // (26/11/2026, o primeiro DAS de teste da 590) a busca da SCI só acha o documento FORMATADO: com só os números ela
      // responde 204 (vazio) e a guia não era publicada ("a empresa não foi achada no SCI Report pelo CNPJ")
      const formatado = d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
      const id = empresaDoSciPeloDocumento(lerEmpresasDoSci(await chamar('GET', '/api/v1/empresa/busca/?' + new URLSearchParams({ numeroDocumento: formatado }).toString())), d);
      empresas.set(d, id);
      return id;
    },
    async publicacoes(empresaId, de, ate, publicadosId) {
      const todas: PublicacaoDoSci[] = [];
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        const p = lerPaginaDePublicados(await chamar('GET', '/api/v1/publicados/busca?' + consultaDePublicados({ empresaId, de, ate, pagina, publicadosId })));
        // só o que é desta empresa (a busca já filtra; aqui é a segunda trava)
        todas.push(...p.itens.filter(x => x.empresaId === empresaId));
        if (p.paginaAtual >= p.ultimaPagina) break;
      }
      return todas;
    },
    async urlDoPdf(publicadosId, empresaId) {
      const q = new URLSearchParams({ publicadoId: String(publicadosId), empresaId: String(empresaId) });
      const url = urlDoPdfDoSci(await chamar('PUT', '/api/v1/publicados/visualiza?' + q.toString()));
      if (!url) throw new ErroDoSci(0, 'o SCI Report não devolveu o PDF');
      return url;
    },
    async publicar(campos, pdf, nomeDoArquivo) {
      const resposta = await chamar('POST', '/api/v1/publicacao-manual', () => {
        const f = new FormData();
        for (const [k, v] of Object.entries(campos)) f.append(k, v);
        f.append('arquivo', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), nomeDoArquivo.replace(/[^\w.-]+/g, '_') || 'guia.pdf');
        return f;
      });
      const id = publicadosIdDaResposta(resposta);
      if (id) return id;
      // sem o número na resposta, procura a publicação que acabou de entrar (a mesma competência, vencimento e valor)
      const competencia = campos.anoRef + '-' + campos.mesRef;
      const venc = String(campos.dataVencimento || '').replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');
      const valor = Math.round(Number(campos.valor) * 100);
      const lista = await this.publicacoes(Number(campos.empresaId), competencia, competencia);
      const achada = lista.filter(p => p.vencimento === venc && Math.round(p.valor * 100) === valor && (!p.relatorioId || p.relatorioId === campos.relatorioId))
        .sort((x, y) => y.publicadosId - x.publicadosId)[0];
      if (achada) return achada.publicadosId;
      throw new ErroDoSci(0, 'o SCI Report não devolveu o número da publicação');
    },
  };
}

// ---------------------------------- o atendimento da Área do Cliente ----------------------------------

export interface DepsDaArea {
  sci: ClienteSciReport;
  /** areasCliente/{token} pelo Admin SDK (existe, exigeSenha); null se não existe */
  lerLink(token: string): Promise<LinkDaArea | null>;
  /** as empresas do link com o CNPJ/CPF (o resumo que o robô grava) */
  lerEmpresas(token: string): Promise<{ codigo: number; cnpj: string }[]>;
  /**
   * A chave da Área e as empresas com o SCI ligado (config/sci: areaCliente e empresas). Sem ela (teste antigo), tudo ligado.
   * Desligada: a Área não pergunta nada à SCI e não mostra o cartão.
   */
  config?(): Promise<{ ligado: boolean; empresas: number[] }>;
  /** as permissões do login do cliente pelo idToken (verifyIdToken); null sem login ou com login inválido */
  lerLogin(idToken: string): Promise<LoginDaArea | null>;
}

export type RespostaDasGuias = { acesso: 'liberado'; guias: GuiaDoSciReport[]; semEmpresaNoSci: number; desligado?: true } | { acesso: Exclude<AcessoDaArea, 'liberado'> };
export type RespostaDoPdf = { acesso: 'liberado'; url: string } | { acesso: Exclude<AcessoDaArea, 'liberado'> | 'guia de outra empresa' };

export interface AtendimentoDaArea {
  guias(token: string, idToken: string, hoje: Date): Promise<RespostaDasGuias>;
  pdf(token: string, idToken: string, publicadosId: string, hoje: Date): Promise<RespostaDoPdf>;
}

export function criarAtendimentoDaArea(deps: DepsDaArea): AtendimentoDaArea {
  async function conferir(token: string, idToken: string): Promise<AcessoDaArea> {
    if (!/^[0-9a-f]{40}$/.test(token)) return 'link invalido';
    const link = await deps.lerLink(token);
    const login = link?.exigeSenha === true && idToken ? await deps.lerLogin(idToken) : null;
    return acessoDaArea(token, link, login);
  }
  /** as empresas do link que podem ir à SCI; null = a Área está com o SCI desligado */
  async function empresasDoLink(token: string): Promise<{ ids: number[]; semEmpresaNoSci: number } | null> {
    const cfg = deps.config ? await deps.config() : null;
    if (cfg && !cfg.ligado) return null;
    const ligadas = cfg ? new Set(cfg.empresas) : null;
    const empresas = (await deps.lerEmpresas(token)).filter(e => !ligadas || ligadas.has(Number(e.codigo)));
    const documentos = [...new Set(empresas.map(e => String(e.cnpj ?? '').replace(/\D/g, '')).filter(Boolean))];
    const ids: number[] = [];
    let semEmpresaNoSci = 0;
    for (const d of documentos) {
      const id = await deps.sci.empresaPeloDocumento(d);
      if (id) ids.push(id); else semEmpresaNoSci++;
    }
    return { ids: [...new Set(ids)], semEmpresaNoSci };
  }
  return {
    async guias(token, idToken, hoje) {
      const acesso = await conferir(token, idToken);
      if (acesso !== 'liberado') return { acesso };
      const doLink = await empresasDoLink(token);
      if (!doLink) return { acesso, guias: [], semEmpresaNoSci: 0, desligado: true };
      const { ids, semEmpresaNoSci } = doLink;
      const { de, ate } = janelaDoSci(hoje);
      const publicacoes: PublicacaoDoSci[] = [];
      for (const id of ids) publicacoes.push(...await deps.sci.publicacoes(id, de, ate));
      return { acesso, guias: guiasDoSciReport(publicacoes, hoje), semEmpresaNoSci };
    },
    async pdf(token, idToken, publicadosId, hoje) {
      const acesso = await conferir(token, idToken);
      if (acesso !== 'liberado') return { acesso };
      const id = Number(publicadosId);
      if (!Number.isInteger(id) || id <= 0) return { acesso: 'guia de outra empresa' };
      // o PDF só sai se a guia é de uma empresa DESTE link e está na janela que a Área mostra (o token da contabilidade
      // enxerga o escritório inteiro: sem esta conferência, um link abriria a guia de outro cliente)
      const { de, ate } = janelaDoSci(hoje);
      for (const empresaId of (await empresasDoLink(token))?.ids ?? []) {
        const achou = (await deps.sci.publicacoes(empresaId, de, ate, id)).some(p => p.publicadosId === id && !p.individual);
        if (achou) return { acesso, url: await deps.sci.urlDoPdf(id, empresaId) };
      }
      return { acesso: 'guia de outra empresa' };
    },
  };
}
