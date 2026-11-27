// Quem fala com o RH NET (25/11/2026). Um cliente por empresa: o JWT sai do Token de Parceiro + o Token de Cliente DAQUELA
// empresa (o da contabilidade não entra no RH NET). Sem rede própria: o "buscar" e os tokens vêm de fora. O JWT fica só na
// memória; os tokens nunca vão para log nem para o banco.
import { lerLoginDoSci, sessaoDoSciAindaAceita, sessaoDoSciVale, SCI_AUTH, type SessaoDoSci } from '../../areaCliente/sciReport';
import { ErroDoSci, type BuscarNoSci, type MetodoDoSci } from '../../areaCliente/sciReportCliente';
import type { CadastroNoRhNetNaArea } from '../../areaCliente/pessoal';
import {
  admissaoDoRhNet, cadastrosParaArea, clienteIdDoJwt, corpoDaAdmissao, corpoDaLiberacao, corpoDaLiberacaoDaPlanilha, corpoDosLancamentos, empresaIdDoJwt, erroDaAdmissao,
  erroDoLancamento, itensDoCadastro, lerPaginaDoRhNet, mensagemDoRhNet, pendenciasDaLiberacao, CADASTROS_DO_RH, LIBERACAO_DA_PLANILHA, RH_NET, RH_NET_POR_PAGINA,
  type AdmissaoNoRhNet, type AdmissaoParaRhNet, type CadastrosDoRhNet, type LancamentoParaRhNet, type RecursoDeCadastroRh, type SituacaoNoRhNet, type TipoDePlanilhaRh,
} from './rhNet';

/** no máximo estas páginas por lista (100 por página) */
const MAX_PAGINAS = 30;

/** Os tokens de uma empresa: o de Parceiro (o mesmo de todas) e o de Cliente gerado no SCI WEB por um usuário dela. */
export interface TokensDoRhNet { parceiro: string; empresa: string; /** quando o JWT não traz, o escritório informa */ empresaId?: number; clienteId?: number }

export interface ClienteRhNet {
  /** o empresa_id e o cliente_id (do JWT, ou os informados); entra se ainda não entrou */
  identificacao(): Promise<{ empresaId: number; clienteId: number }>;
  cadastros(): Promise<CadastrosDoRhNet>;
  admissoes(situacao?: SituacaoNoRhNet): Promise<AdmissaoNoRhNet[]>;
  /** as pessoas da empresa como a Área do Cliente mostra (o nome, o CPF mascarado, o tipo, a entrada e a situação; sem salário) */
  cadastrosParaArea(): Promise<CadastroNoRhNetNaArea[]>;
  /** (27/11/2026: "Pode pôr") apaga a admissão no RH NET (sem registro de ponto, o RH NET remove de vez) */
  excluirAdmissao(id: number): Promise<void>;
  /** (26/11/2026) completa uma admissão já cadastrada (PUT: o RH NET troca o cadastro INTEIRO pelo que vai) */
  atualizarAdmissao(id: number, a: AdmissaoParaRhNet): Promise<void>;
  /** cadastra (fica "não liberado"); devolve o id do funcionário no RH NET */
  criarAdmissao(a: AdmissaoParaRhNet): Promise<AdmissaoNoRhNet>;
  /** libera (vai para a folha do SCI) ou volta para não liberado */
  liberarAdmissoes(ids: number[], situacao: 'liberado' | 'nao_liberado', observacao?: string): Promise<void>;
  criarLancamentos(lancamentos: LancamentoParaRhNet[], tipo?: TipoDePlanilhaRh): Promise<number>;
  liberarLancamentos(competencia: string, situacao: 'liberado' | 'nao_liberado', tipo?: TipoDePlanilhaRh, funcionarioId?: number): Promise<void>;
}

export function criarClienteRhNet(deps: { buscar: BuscarNoSci; tokens: () => TokensDoRhNet | Promise<TokensDoRhNet>; agora?: () => number }): ClienteRhNet {
  const agora = deps.agora ?? (() => Date.now());
  let sessao: SessaoDoSci | null = null;
  let ids: { empresaId: number; clienteId: number } | null = null;

  async function json(r: { status: number; json: () => Promise<unknown> }): Promise<unknown> {
    if (r.status === 204) return null;
    try { return await r.json(); } catch { return null; }
  }

  async function entrar(): Promise<SessaoDoSci> {
    if (sessaoDoSciAindaAceita(sessao, agora())) {
      const r = await deps.buscar(SCI_AUTH + '/api/v1/auth/refresh', { method: 'POST', headers: { Authorization: 'Bearer ' + sessao.token } });
      const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(await json(r), agora()) : null;
      if (nova) return (sessao = nova);
    }
    const t = await deps.tokens();
    if (!t.parceiro || !t.empresa) throw new ErroDoSci(0, 'faltam os tokens do RH NET desta empresa');
    const r = await deps.buscar(SCI_AUTH + '/api/v1/auth/credencial/login', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(t.parceiro + ':' + t.empresa) } });
    const nova = r.status === 201 || r.status === 200 ? lerLoginDoSci(await json(r), agora()) : null;
    if (!nova) throw new ErroDoSci(r.status, r.status === 401 ? 'a SCI recusou os tokens (o de Parceiro ou o da empresa)' : 'o login na SCI não deu certo (' + r.status + ')');
    // o empresa_id e o cliente_id: os informados valem mais que os do JWT
    ids = { empresaId: t.empresaId || empresaIdDoJwt(nova.token), clienteId: t.clienteId || clienteIdDoJwt(nova.token) };
    return (sessao = nova);
  }

  async function chamar(metodo: MetodoDoSci, caminho: string, corpo?: unknown): Promise<unknown> {
    for (let vez = 0; vez < 2; vez++) {
      const s = sessaoDoSciVale(sessao, agora()) ? sessao : await entrar();
      const r = await deps.buscar(RH_NET + caminho, {
        method: metodo, headers: { Authorization: 'Bearer ' + s.token, Accept: 'application/json', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
        ...(corpo ? { body: JSON.stringify(corpo) } : {}),
      });
      if (r.status === 401 && vez === 0) { sessao = null; continue; }
      const resposta = await json(r);
      if (r.status >= 200 && r.status < 300) return resposta;
      throw new ErroDoSci(r.status, r.status === 403 ? 'o RH NET não está liberado para esta empresa (ou o token não é de um usuário dela)' : mensagemDoRhNet(resposta, r.status));
    }
    throw new ErroDoSci(401, 'o RH NET recusou o login');
  }

  async function identificacao() {
    if (!ids || !sessaoDoSciVale(sessao, agora())) await entrar();
    if (!ids?.empresaId) throw new ErroDoSci(0, 'o número da empresa no RH NET não veio no token: informe-o na configuração do robô');
    return ids;
  }

  /** todas as páginas de uma lista */
  async function listar(caminho: string, filtros: Record<string, string> = {}) {
    const { empresaId } = await identificacao();
    const itens: Record<string, unknown>[] = [];
    for (let page = 1; page <= MAX_PAGINAS; page++) {
      const q = new URLSearchParams({ empresa_id: String(empresaId), page: String(page), per_page: String(RH_NET_POR_PAGINA), ...filtros });
      const p = lerPaginaDoRhNet(await chamar('GET', caminho + '?' + q.toString()));
      itens.push(...p.itens);
      if (!p.itens.length || p.paginaAtual >= p.ultimaPagina) break;
    }
    return itens;
  }

  return {
    identificacao,
    async cadastros() {
      const c = {} as CadastrosDoRhNet;
      for (const k of Object.keys(CADASTROS_DO_RH) as RecursoDeCadastroRh[]) c[k] = itensDoCadastro(k, await listar(CADASTROS_DO_RH[k].caminho));
      return c;
    },
    async admissoes(situacao) {
      return (await listar('/api/v1/admissoes', situacao ? { situacao } : {})).map(admissaoDoRhNet).filter((a): a is AdmissaoNoRhNet => !!a);
    },
    async cadastrosParaArea() {
      const funcoes = new Map(itensDoCadastro('funcoes', await listar(CADASTROS_DO_RH.funcoes.caminho)).map(f => [f.id, f.nome] as const));
      return cadastrosParaArea(await listar('/api/v1/admissoes'), funcoes);
    },
    async excluirAdmissao(id) {
      if (!(Number.isInteger(id) && id > 0)) throw new ErroDoSci(0, 'falta o número do funcionário no RH NET');
      const { empresaId } = await identificacao();
      await chamar('DELETE', '/api/v1/admissoes', { empresa_id: empresaId, funcionario_contribuinte_id: id });
    },
    async atualizarAdmissao(id, a) {
      const erro = erroDaAdmissao(a);
      if (erro) throw new ErroDoSci(0, erro);
      if (!(Number.isInteger(id) && id > 0)) throw new ErroDoSci(0, 'falta o número do funcionário no RH NET');
      const { empresaId } = await identificacao();
      await chamar('PUT', '/api/v1/admissoes', { ...corpoDaAdmissao(empresaId, a), funcionario_contribuinte_id: id });
    },
    async criarAdmissao(a) {
      const erro = erroDaAdmissao(a);
      if (erro) throw new ErroDoSci(0, erro);
      const { empresaId } = await identificacao();
      const resposta = await chamar('POST', '/api/v1/admissoes', corpoDaAdmissao(empresaId, a));
      const criada = admissaoDoRhNet((resposta as { retorno?: unknown } | null)?.retorno);
      if (!criada) throw new ErroDoSci(0, 'o RH NET não devolveu o número do funcionário');
      return criada;
    },
    async liberarAdmissoes(lista, situacao, observacao) {
      const { empresaId } = await identificacao();
      if (!lista.length) return;
      const r = await chamar('POST', '/api/v1/liberacoes/admissoes', corpoDaLiberacao(empresaId, lista, situacao, observacao));
      // o 207 (liberação parcial) volta como sucesso: as que não liberaram vêm em retorno.erros
      const pendencias = pendenciasDaLiberacao(r);
      if (pendencias.length) throw new ErroDoSci(207, 'o RH NET não liberou: ' + pendencias.join(' ').slice(0, 280));
    },
    async criarLancamentos(lancamentos, tipo = 'normais') {
      const erro = lancamentos.map(l => erroDoLancamento(l, tipo)).find(Boolean);
      if (erro) throw new ErroDoSci(0, erro);
      if (!lancamentos.length) return 0;
      const { empresaId } = await identificacao();
      await chamar('POST', '/api/v1/planilhas-lancamentos/' + tipo, corpoDosLancamentos(empresaId, lancamentos, tipo));
      return lancamentos.length;
    },
    async liberarLancamentos(competencia, situacao, tipo = 'normais', funcionarioId) {
      const { empresaId, clienteId } = await identificacao();
      if (!clienteId) throw new ErroDoSci(0, 'o número da contabilidade na SCI não veio no token: informe-o na configuração do robô');
      await chamar('POST', LIBERACAO_DA_PLANILHA[tipo], corpoDaLiberacaoDaPlanilha(clienteId, empresaId, competencia, situacao, funcionarioId));
    },
  };
}
