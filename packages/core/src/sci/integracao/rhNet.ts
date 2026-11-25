// O RH NET da SCI (25/11/2026; o dono: "quero que deixe tudo pronto para suportar a rhnet"). Funções puras; quem fala com
// a API é o rhNetCliente.ts (com o "buscar" de fora). A API (portal-dev.sci.com.br, OpenAPI rhnetsocial, BETA na SCI):
//   - JWT da API de Autenticação gerado com o Token de Cliente da EMPRESA (o da contabilidade não entra no RH NET): um token
//     por empresa, e o acesso vale só para o empresa_id dela;
//   - cadastros (só leitura): departamentos, funções, centros de custo, quadros de horário, sindicatos, bancos, agências;
//   - admissões: POST /api/v1/admissoes (mínimo: empresa_id, tipo_colaborador, nome, cpf, admissao_data) entra como
//     "não liberado"; POST /api/v1/liberacoes/admissoes muda a situação (liberado → vai para a folha do SCI);
//   - planilha de lançamentos: POST /api/v1/planilhas-lancamentos/{normais|intermitentes|centros-custos} { dados: [...] }
//     (valor OU referência por verba e competência) e a liberação em lote por competência;
//   - respostas { sucesso, status, mensagem, paginacao: { pagina_atual, ultima_pagina, ... }, retorno }.
// Dados pessoais (CPF, salário, dependentes): nada daqui vai para log; o pedido guarda os dados só até o robô mandar.
import { cpfValido } from '../../empresas/cadastro/receita';

export const RH_NET = 'https://api2.rhnetsocial.com.br';
/** o maior lote por página que o nads pede */
export const RH_NET_POR_PAGINA = 100;

export type SituacaoNoRhNet = 'integrado' | 'nao_liberado' | 'liberado' | 'aguardando_integracao' | 'recusado';
export const ROTULO_DA_SITUACAO_RH: Record<SituacaoNoRhNet, string> = {
  nao_liberado: 'Não liberado', liberado: 'Liberado', aguardando_integracao: 'Aguardando a folha', integrado: 'Na folha', recusado: 'Recusado',
};
const SITUACOES = new Set<string>(Object.keys(ROTULO_DA_SITUACAO_RH));
export const situacaoNoRhNet = (v: unknown): SituacaoNoRhNet | '' => (typeof v === 'string' && SITUACOES.has(v) ? (v as SituacaoNoRhNet) : '');

type Solto = Record<string, unknown>;
const objeto = (v: unknown): Solto | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Solto) : null);
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const inteiro = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };

// ---------------------------------- a resposta ----------------------------------

export interface PaginaDoRhNet { itens: Solto[]; paginaAtual: number; ultimaPagina: number; total: number }

/** { retorno: [...], paginacao } → a página (o retorno que não é lista vira lista de um, se for objeto). */
export function lerPaginaDoRhNet(resposta: unknown): PaginaDoRhNet {
  const r = objeto(resposta);
  const ret = r?.retorno;
  const itens = (Array.isArray(ret) ? ret : objeto(ret) ? [ret] : []).map(objeto).filter((x): x is Solto => !!x);
  const p = objeto(r?.paginacao);
  const paginaAtual = inteiro(p?.pagina_atual) || 1;
  return { itens, paginaAtual, ultimaPagina: inteiro(p?.ultima_pagina) || paginaAtual, total: inteiro(p?.total) || itens.length };
}

/** A mensagem de erro do RH NET (mensagem e, se vier, a lista de erros de validação), sem dados pessoais do pedido. */
export function mensagemDoRhNet(resposta: unknown, status: number): string {
  const r = objeto(resposta);
  const base = texto(r?.mensagem) || 'o RH NET respondeu ' + status;
  const erros = objeto(r?.erros) || objeto(r?.errors);
  const detalhe = erros ? Object.entries(erros).map(([k, v]) => k + ': ' + (Array.isArray(v) ? v.map(texto).join(', ') : texto(v))).join('; ') : '';
  return (detalhe ? base + ' (' + detalhe + ')' : base).slice(0, 300);
}

// ---------------------------------- os cadastros da empresa ----------------------------------

export interface ItemDoCadastroRh { id: number; nome: string; codigo?: string }
export interface CadastrosDoRhNet {
  departamentos: ItemDoCadastroRh[];
  funcoes: ItemDoCadastroRh[];
  centrosCusto: ItemDoCadastroRh[];
  quadrosHorario: ItemDoCadastroRh[];
  sindicatos: ItemDoCadastroRh[];
}
export type RecursoDeCadastroRh = keyof CadastrosDoRhNet;

/** O caminho de cada cadastro, o campo do id e o do nome (como a API devolve). */
export const CADASTROS_DO_RH: Record<RecursoDeCadastroRh, { caminho: string; id: string; nome: string[]; codigo?: string; rotulo: string }> = {
  departamentos: { caminho: '/api/v1/departamentos', id: 'departamento_id', nome: ['departamento'], codigo: 'cod_departamento', rotulo: 'Departamentos' },
  funcoes: { caminho: '/api/v1/funcoes', id: 'v_funcao_id', nome: ['funcao'], codigo: 'cbo', rotulo: 'Funções' },
  centrosCusto: { caminho: '/api/v1/centros-custo', id: 'centro_custo_id', nome: ['nome', 'centro_custo'], rotulo: 'Centros de custo' },
  quadrosHorario: { caminho: '/api/v1/quadros-horarios', id: 'v_quadro_horario_id', nome: ['descricao'], rotulo: 'Quadros de horário' },
  sindicatos: { caminho: '/api/v1/sindicatos', id: 'v_sindicato_id', nome: ['nome'], rotulo: 'Sindicatos' },
};

/** Os itens de um cadastro como o nads guarda (id, nome e o código quando tem), sem repetir, em ordem de nome. */
export function itensDoCadastro(recurso: RecursoDeCadastroRh, itens: Solto[]): ItemDoCadastroRh[] {
  const c = CADASTROS_DO_RH[recurso];
  const porId = new Map<number, ItemDoCadastroRh>();
  for (const x of itens) {
    const id = inteiro(x[c.id]);
    const nome = c.nome.map(k => texto(x[k])).find(Boolean) || '';
    if (!id || !nome) continue;
    const codigo = c.codigo ? texto(x[c.codigo]) : '';
    porId.set(id, { id, nome: nome.slice(0, 120), ...(codigo ? { codigo: codigo.slice(0, 20) } : {}) });
  }
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

/** O resumo dos cadastros para a tela ("Departamentos 4 · Funções 12 · …"). */
export function resumoDosCadastros(c: CadastrosDoRhNet): string {
  return (Object.keys(CADASTROS_DO_RH) as RecursoDeCadastroRh[]).map(k => CADASTROS_DO_RH[k].rotulo + ' ' + c[k].length).join(' · ');
}

/** Lê os cadastros gravados no resultado do pedido (o que vier torto some). */
export function lerCadastrosDoRhNet(v: unknown): CadastrosDoRhNet | null {
  const o = objeto(v);
  if (!o) return null;
  const lista = (k: string): ItemDoCadastroRh[] => (Array.isArray(o[k]) ? (o[k] as unknown[]) : []).flatMap(x => {
    const i = objeto(x);
    const id = inteiro(i?.id);
    const nome = texto(i?.nome);
    return id && nome ? [{ id, nome, ...(texto(i?.codigo) ? { codigo: texto(i?.codigo) } : {}) }] : [];
  });
  return { departamentos: lista('departamentos'), funcoes: lista('funcoes'), centrosCusto: lista('centrosCusto'), quadrosHorario: lista('quadrosHorario'), sindicatos: lista('sindicatos') };
}

// ---------------------------------- a empresa no RH NET ----------------------------------

/** As informações de dentro do JWT (a parte do meio, em base64url); {} se não der para ler. Não valida a assinatura. */
export function informacoesDoJwt(jwt: string): Record<string, unknown> {
  const partes = String(jwt ?? '').split('.');
  if (partes.length < 2) return {};
  try {
    const b64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    return objeto(json) || {};
  } catch { return {}; }
}

const numeroDoJwt = (jwt: string, chaves: string[]) => { const o = informacoesDoJwt(jwt); for (const k of chaves) { const n = inteiro(o[k]); if (n) return n; } return 0; };

/**
 * Os dados do usuário dentro do JWT, como a SCI manda de verdade (visto no primeiro login, 25/11/2026):
 * usuario: { tipo, usuarioId, dados: { clienteId, empresasVinculadas: [empresaId], acessos } }.
 */
function dadosDoUsuarioNoJwt(jwt: string): Solto {
  return objeto(objeto(informacoesDoJwt(jwt).usuario)?.dados) || {};
}

/**
 * O empresa_id do Token de Cliente da empresa: o de usuario.dados.empresasVinculadas quando há uma só (com mais de uma, fica a
 * dúvida e o escritório informa), senão as chaves soltas. 0 quando não tem: aí o escritório informa na configuração do robô.
 */
export function empresaIdDoJwt(jwt: string): number {
  const vinculadas = dadosDoUsuarioNoJwt(jwt).empresasVinculadas;
  if (Array.isArray(vinculadas)) {
    const ids = [...new Set(vinculadas.map(inteiro).filter(Boolean))];
    if (ids.length === 1) return ids[0];
    if (ids.length > 1) return 0;
  }
  return numeroDoJwt(jwt, ['empresa_id', 'empresaId', 'empresa', 'emp_id']);
}
/** O cliente_id (o código da contabilidade na SCI; a liberação da planilha pede): o de usuario.dados, senão as chaves soltas; 0 quando não tem. */
export const clienteIdDoJwt = (jwt: string) => inteiro(dadosDoUsuarioNoJwt(jwt).clienteId) || numeroDoJwt(jwt, ['cliente_id', 'clienteId', 'cliente']);

// ---------------------------------- a admissão ----------------------------------

/** O que o nads manda numa admissão (o mínimo da SCI e os campos que o DP costuma ter; o resto, a pessoa completa no SCI). */
export interface AdmissaoParaRhNet {
  nome: string;
  cpf: string;
  /** 'aaaa-mm-dd' */
  admissao: string;
  /** 'aaaa-mm-dd' */
  nascimento?: string;
  /** 0 feminino, 1 masculino (a enumeração da SCI) */
  sexo?: 0 | 1;
  email?: string;
  celular?: string;
  maeNome?: string;
  pis?: string;
  salario?: number;
  funcaoId?: number;
  departamentoId?: number;
  centroCustoId?: number;
  quadroHorarioId?: number;
  sindicatoId?: number;
  /** dias do contrato de experiência */
  experienciaDias?: number;
  observacao?: string;
}

const DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** O que falta ou está errado na admissão ('' = pode mandar). */
export function erroDaAdmissao(a: AdmissaoParaRhNet): string {
  if (!texto(a.nome) || texto(a.nome).length < 3) return 'falta o nome completo';
  if (!cpfValido(String(a.cpf ?? '').replace(/\D/g, ''))) return 'o CPF não é válido';
  if (!DIA.test(String(a.admissao ?? ''))) return 'falta a data de admissão';
  if (a.nascimento && !DIA.test(a.nascimento)) return 'a data de nascimento está errada';
  if (a.salario !== undefined && !(a.salario > 0)) return 'o salário tem de ser maior que zero';
  if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) return 'o e-mail não parece certo';
  return '';
}

/** O corpo do POST /api/v1/admissoes (funcionário CLT). Os campos não preenchidos vão como null, como a SCI pede. */
export function corpoDaAdmissao(empresaId: number, a: AdmissaoParaRhNet): Record<string, unknown> {
  const digitos = (v?: string) => String(v ?? '').replace(/\D/g, '');
  const cel = digitos(a.celular);
  // o RH NET só aceita o CPF formatado (o primeiro teste, 25/11/2026: só os números voltou "não possui o formato válido de CPF")
  const cpf = digitos(a.cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return {
    empresa_id: empresaId, tipo_colaborador: 'funcionario',
    nome: texto(a.nome).toUpperCase(), cpf, admissao_data: a.admissao,
    nascimento_data: a.nascimento || null, sexo: a.sexo ?? null, email: texto(a.email) || null,
    ddd_celular: cel.length >= 10 ? cel.slice(0, 2) : null, celular: cel.length >= 10 ? cel.slice(2) : null,
    mae_nome: texto(a.maeNome).toUpperCase() || null, pis_numero: digitos(a.pis) || null,
    salario_base: a.salario ?? null, v_funcao_id: a.funcaoId ?? null, departamento_id: a.departamentoId ?? null,
    centro_custo_id: a.centroCustoId ?? null, v_quadro_horario_id: a.quadroHorarioId ?? null, v_sindicato_id: a.sindicatoId ?? null,
    prazo_experiencia: a.experienciaDias ?? null, observacao: texto(a.observacao).slice(0, 500) || null,
    habilita_acesso_modulo_colaborador: false,
  };
}

/** O que o nads guarda de uma admissão no RH NET (sem dados pessoais: só o id, a situação e o primeiro nome). */
export interface AdmissaoNoRhNet { id: number; situacao: SituacaoNoRhNet | ''; primeiroNome: string; admissao: string }

export function admissaoDoRhNet(x: unknown): AdmissaoNoRhNet | null {
  const o = objeto(x);
  const id = inteiro(o?.funcionario_contribuinte_id);
  if (!o || !id) return null;
  return { id, situacao: situacaoNoRhNet(o.situacao), primeiroNome: texto(o.nome).split(/\s+/)[0] || '', admissao: texto(o.admissao_data).slice(0, 10) };
}

/** O corpo da liberação (ou recusa) de admissões. */
export function corpoDaLiberacao(empresaId: number, ids: number[], situacao: 'liberado' | 'nao_liberado', observacao = ''): Record<string, unknown> {
  return { empresa_id: empresaId, situacao, funcionario_contribuinte_id: [...new Set(ids.filter(n => inteiro(n)))], ...(observacao ? { observacao_liberacao: observacao.slice(0, 500) } : {}) };
}

// ---------------------------------- a planilha de lançamentos ----------------------------------

export type TipoDePlanilhaRh = 'normais' | 'intermitentes' | 'centros-custos';

/** Um lançamento: a verba do SCI (v_verba_id) de um funcionário numa competência, com valor OU referência. */
export interface LancamentoParaRhNet { funcionarioId: number; verbaId: number; competencia: string; valor?: number; referencia?: number; centroCustoId?: number; contratoIntermitenteId?: number }

export function erroDoLancamento(l: LancamentoParaRhNet, tipo: TipoDePlanilhaRh = 'normais'): string {
  if (!inteiro(l.funcionarioId)) return 'falta o funcionário';
  if (!inteiro(l.verbaId)) return 'falta a verba';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(l.competencia)) return 'a competência está errada';
  if (l.valor === undefined && l.referencia === undefined) return 'falta o valor ou a referência';
  if (tipo === 'centros-custos' && !inteiro(l.centroCustoId)) return 'falta o centro de custo';
  if (tipo === 'intermitentes' && !inteiro(l.contratoIntermitenteId)) return 'falta o contrato intermitente';
  return '';
}

/** O corpo do POST da planilha ({ dados: [...] }, competência no dia 1). */
export function corpoDosLancamentos(empresaId: number, lancamentos: LancamentoParaRhNet[], tipo: TipoDePlanilhaRh = 'normais'): { dados: Record<string, unknown>[] } {
  return {
    dados: lancamentos.map(l => ({
      empresa_id: empresaId, funcionario_contribuinte_id: l.funcionarioId, v_verba_id: l.verbaId, competencia: l.competencia + '-01',
      valor: l.valor ?? null, referencia: l.referencia ?? null,
      ...(tipo === 'centros-custos' ? { centro_custo_id: l.centroCustoId } : {}),
      ...(tipo === 'intermitentes' ? { contrato_intermitente_id: l.contratoIntermitenteId } : {}),
    })),
  };
}

/** O corpo da liberação da planilha de uma competência (de todos, ou só de um funcionário). */
export function corpoDaLiberacaoDaPlanilha(clienteId: number, empresaId: number, competencia: string, situacao: 'liberado' | 'nao_liberado', funcionarioId?: number, observacao = ''): Record<string, unknown> {
  return {
    cliente_id: clienteId, empresa_id: empresaId, competencia: competencia + '-01', situacao,
    ...(funcionarioId ? { funcionario_contribuinte_id: funcionarioId } : {}), ...(observacao ? { observacao_liberacao: observacao.slice(0, 250) } : {}),
  };
}

/** O caminho da liberação de cada tipo de planilha. */
export const LIBERACAO_DA_PLANILHA: Record<TipoDePlanilhaRh, string> = {
  normais: '/api/v1/liberacoes/planilhas-lancamentos-normais',
  intermitentes: '/api/v1/liberacoes/planilhas-lancamentos-intermitentes',
  'centros-custos': '/api/v1/liberacoes/planilhas-lancamentos-centros-custo',
};
