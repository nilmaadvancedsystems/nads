// Quem fala com o Integra NET (24/11/2026). Sem rede própria: o "buscar" vem de fora (no robô, o fetch do Node), e os
// tokens também (segredos()). Os tokens vão só para a SCI: o PUT do arquivo na URL pré-assinada (S3) vai SEM eles.
import { ErroDoSci, type BuscarNoSci, type SegredosDoSci } from '../../areaCliente/sciReportCliente';
import { INTEGRA_NET, chavesDasUrls, marcaDoEnviado, periodoNoIntegra, type TipoNoIntegra, type XmlParaEnviar } from './integraNet';

/** no máximo estas páginas por consulta (a API devolve só a lista, sem dizer qual é a última) */
const MAX_PAGINAS = 60;

export interface ResultadoDoEnvio {
  /** as marcas (chave da nota ou nome do evento) do que entrou: vão para o "já foram" do próximo envio */
  enviadas: string[];
  falhas: number;
  erro: string;
  /** a SCI respondeu 403 (a empresa sem licença do Integra NET): nada mais foi tentado */
  semLicenca: boolean;
}

export interface ClienteIntegraNet {
  /** manda os lotes da empresa (pelo CNPJ). Erro de um lote não para os outros; sem licença, para tudo */
  enviar(cnpj: string, lotes: { tipo: TipoNoIntegra; itens: XmlParaEnviar[] }[]): Promise<ResultadoDoEnvio>;
  /** as chaves de um tipo e direção na competência ('aaaa-mm') */
  chavesDoMes(empresaId: number, tipo: TipoNoIntegra, movimentacao: 'entrada' | 'saida', competencia: string): Promise<string[]>;
}

export function criarClienteIntegraNet(deps: { buscar: BuscarNoSci; segredos: () => SegredosDoSci | Promise<SegredosDoSci> }): ClienteIntegraNet {
  async function cabecalhos(): Promise<Record<string, string>> {
    const s = await deps.segredos();
    if (!s.parceiro || !s.cliente) throw new ErroDoSci(0, 'faltam os tokens da SCI');
    return { 'Service-Token': s.parceiro, Authorization: 'Bearer ' + s.cliente, Accept: 'application/json' };
  }
  async function json(r: { status: number; json: () => Promise<unknown> }): Promise<unknown> {
    try { return await r.json(); } catch { return null; }
  }
  const mensagem = (corpo: unknown, status: number) => {
    const o = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {};
    const m = typeof o.error === 'string' ? o.error : typeof o.mensagem === 'string' ? o.mensagem : '';
    return (m || 'o Integra NET respondeu ' + status).slice(0, 200);
  };

  return {
    async enviar(cnpj, lotes) {
      const doc = String(cnpj ?? '').replace(/\D/g, '');
      const r: ResultadoDoEnvio = { enviadas: [], falhas: 0, erro: '', semLicenca: false };
      if (doc.length !== 14 && doc.length !== 11) return { ...r, falhas: lotes.reduce((s, l) => s + l.itens.length, 0), erro: 'a empresa está sem CNPJ' };
      const h = await cabecalhos();
      for (let k = 0; k < lotes.length; k++) {
        const lote = lotes[k];
        const resp = await deps.buscar(INTEGRA_NET + '/' + lote.tipo, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ cnpj: doc, nomeArquivo: lote.itens.map(x => x.nome) }) });
        const corpo = await json(resp);
        if (resp.status === 403) {
          // sem licença: o resto também não passaria
          r.semLicenca = true;
          r.erro = mensagem(corpo, 403);
          r.falhas += lotes.slice(k).reduce((s, l) => s + l.itens.length, 0);
          return r;
        }
        if (resp.status === 401) throw new ErroDoSci(401, 'o Integra NET recusou os tokens');
        const urls = resp.status === 200 && corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : null;
        if (!urls) { r.falhas += lote.itens.length; r.erro = mensagem(corpo, resp.status); continue; }
        for (const x of lote.itens) {
          const url = typeof urls[x.nome] === 'string' ? (urls[x.nome] as string) : '';
          if (!url.startsWith('https://')) { r.falhas++; r.erro = 'o Integra NET não devolveu o endereço de ' + x.nome; continue; }
          try {
            // a URL já autoriza o envio: sem os tokens aqui
            const put = await deps.buscar(url, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: new TextEncoder().encode(x.xml) });
            if (put.status >= 200 && put.status < 300) r.enviadas.push(marcaDoEnviado(x));
            else { r.falhas++; r.erro = 'o envio de ' + x.nome + ' voltou ' + put.status; }
          } catch (e) { r.falhas++; r.erro = 'o envio de ' + x.nome + ' falhou (' + String((e as Error)?.message ?? e).slice(0, 80) + ')'; }
        }
      }
      return r;
    },

    async chavesDoMes(empresaId, tipo, movimentacao, competencia) {
      const h = await cabecalhos();
      const { dataIni, dataFim } = periodoNoIntegra(competencia);
      const todas = new Set<string>();
      let anterior = '';
      for (let page = 1; page <= MAX_PAGINAS; page++) {
        const q = new URLSearchParams({ empresaId: String(empresaId), dataIni, dataFim, page: String(page) });
        const resp = await deps.buscar(INTEGRA_NET + '/' + tipo + '/' + movimentacao + '?' + q.toString(), { method: 'GET', headers: h });
        if (resp.status === 404) break;
        const corpo = await json(resp);
        if (resp.status === 401) throw new ErroDoSci(401, 'o Integra NET recusou os tokens');
        if (resp.status === 403) throw new ErroDoSci(403, mensagem(corpo, 403));
        if (resp.status !== 200) throw new ErroDoSci(resp.status, mensagem(corpo, resp.status));
        const chaves = chavesDasUrls(corpo);
        const assinatura = chaves.join(',');
        // página vazia ou repetida: acabou (a API não diz qual é a última)
        if (!chaves.length || assinatura === anterior) break;
        anterior = assinatura;
        chaves.forEach(c => todas.add(c));
      }
      return [...todas];
    },
  };
}
