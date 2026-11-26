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
import type { CadastroNoRhNetNaArea } from '../../areaCliente/pessoal';

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
  // a liberação recusada (400) traz as pendências em retorno.erros, item por item
  const pendencias = pendenciasDaLiberacao(resposta);
  if (pendencias.length) return ('o RH NET não liberou: ' + pendencias.join(' ')).slice(0, 300);
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
  /** dias do contrato de experiência (o 1º prazo) */
  experienciaDias?: number;
  /** dias da prorrogação da experiência (o 2º prazo) */
  prorrogacaoDias?: number;
  /** a classe: 0 assalariado (o padrão), 1 doméstica, 2 estagiário, 3 aposentado, 4 temporário */
  classe?: 0 | 1 | 2 | 3 | 4;
  /** como recebe (o "Tipo de colaborador" da tela do SCI): 0 mensalista (o padrão), 1 diarista, 2 horista, 3 comissionado */
  remuneracao?: 0 | 1 | 2 | 3;
  /** o tipo de contrato: 1 prazo indeterminado (o padrão); null deixa para o escritório escolher */
  contratoTipo?: number | null;
  /** a categoria do eSocial: 101 empregado geral (o padrão), 103 aprendiz, 901 estagiário */
  categoriaEsocial?: number;
  observacao?: string;
  // (26/11/2026: "quero verificacao na tela de registro, que nao deixa nem passar") o que o RH NET exige para LIBERAR
  // (o "cadastro completo"; a lista veio do próprio RH NET, na tentativa de liberar a admissão de teste da 590)
  etnia?: number;
  estadoCivil?: number;
  grauInstrucao?: number;
  /** o código IBGE (7 dígitos) da cidade de nascimento; o robô acha pelo nome e a UF */
  nascimentoCidadeIbge?: number;
  rg?: string;
  rgOrgao?: string;
  rgUf?: string;
  /** 'aaaa-mm-dd' */
  rgEmissao?: string;
  endereco?: { cep: string; logradouroTipo: number; logradouro: string; numero: string; complemento?: string; bairro: string; cidadeIbge?: number };
  /** horas por semana (a mensal e a diária saem dela) */
  horasSemana?: number;
  horarioNoturno?: boolean;
}

/** O dia 'aaaa-mm-dd' somado de n dias (o 1º dia conta: 45 dias a partir de 01/12 terminam em 14/01). */
export function fimDoPrazo(inicio: string, dias: number): string {
  const [a, m, d] = inicio.split('-').map(Number);
  const fim = new Date(Date.UTC(a, m - 1, d + dias - 1));
  return fim.toISOString().slice(0, 10);
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
    // (26/11/2026) o que a pré-admissão do SCI marca como obrigatório: a classe, o tipo de admissão, a categoria, como
    // recebe, o tipo de contrato e o 1º prazo da experiência com o fim (0 e sem fim quando não tem experiência)
    classe_id: a.classe ?? 0, admissao_tipo_id: 1, categoria_esocial_id: a.categoriaEsocial ?? 101,
    funcionario_tipo_id: a.remuneracao ?? 0, contrato_tipo_id: a.contratoTipo === undefined ? 1 : a.contratoTipo,
    // o cadastro completo (26/11/2026): a pessoa, o documento, o endereço e a jornada; brasileiro por padrão (105)
    etnia_id: a.etnia ?? null, estado_civil_id: a.estadoCivil ?? null, grau_instrucao_id: a.grauInstrucao ?? null,
    nacionalidade_id: 105, pais_nacionalidade_id: 105, nascimento_cidade_id: a.nascimentoCidadeIbge ?? null,
    rg: texto(a.rg) || null, rg_orgao_emissor: texto(a.rgOrgao).toUpperCase() || null, rg_uf: texto(a.rgUf).toUpperCase() || null, rg_emissao: a.rgEmissao || null,
    ...(a.endereco ? {
      endereco_cep: digitos(a.endereco.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2') || null, endereco_logradouro_id: a.endereco.logradouroTipo || null,
      endereco: texto(a.endereco.logradouro).toUpperCase() || null, endereco_numero: texto(a.endereco.numero) || null,
      endereco_complemento: texto(a.endereco.complemento).toUpperCase() || null, endereco_bairro: texto(a.endereco.bairro).toUpperCase() || null,
      endereco_cidade_id: a.endereco.cidadeIbge ?? null,
    } : {}),
    hora_semanal: a.horasSemana ?? 44, hora_mensal: Math.min(220, Math.round((a.horasSemana ?? 44) * 5)), hora_diaria: Math.round(((a.horasSemana ?? 44) / 6) * 100) / 100,
    horario_noturno: a.horarioNoturno ? 1 : 0, fgts_ocorrencia_id: 1, forma_pagamento: 0,
    prazo_experiencia: a.experienciaDias ?? 0,
    prazo_experiencia_fim: a.experienciaDias ? fimDoPrazo(a.admissao, a.experienciaDias) : null,
    ...(a.experienciaDias && a.prorrogacaoDias ? {
      prazo_experiencia_prorrogacao: a.prorrogacaoDias,
      prazo_experiencia_prorrogacao_fim: fimDoPrazo(a.admissao, a.experienciaDias + a.prorrogacaoDias),
    } : {}),
    observacao: texto(a.observacao).slice(0, 500) || null,
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

// ---------------------------------- o que a Área do Cliente mostra ----------------------------------

/** A situação para o cliente, em português simples (o escritório é quem libera). */
export const SITUACAO_NA_AREA: Record<SituacaoNoRhNet, string> = {
  integrado: 'Na folha', nao_liberado: 'Aguardando o escritório', liberado: 'Indo para a folha', aguardando_integracao: 'Indo para a folha', recusado: 'Recusado',
};

/** '52998224725' ou '529.982.247-25' → '***.982.247-**' (o mesmo formato da Área); '' se não é CPF. */
export function cpfMascarado(cpf: unknown): string {
  const d = String(cpf ?? '').replace(/\D/g, '');
  return d.length === 11 ? '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**' : '';
}

/**
 * Um cadastro do RH NET (a admissão completa, como a API devolve) → o que a Área do Cliente mostra. LISTA BRANCA: só o nome, o
 * CPF mascarado, o tipo (o sócio do pró-labore, a função do funcionário), a entrada e a situação; nada de salário. O cadastro
 * desativado (desligado) não vai. `funcoes`: o nome de cada função pelo id (os cadastros da empresa).
 */
export function cadastroParaArea(x: unknown, funcoes: ReadonlyMap<number, string> = new Map()): CadastroNoRhNetNaArea | null {
  const o = objeto(x);
  const id = inteiro(o?.funcionario_contribuinte_id);
  const nome = texto(o?.nome).replace(/\s+/g, ' ');
  if (!o || !id || !nome || o.cadastro_ativo === false || o.cadastroAtivo === false || texto(o.desligamento_data)) return null;
  const categoria = inteiro(o.categoria_esocial_id);
  const contribuinte = o.tipo_colaborador === 'contribuinte';
  const funcao = funcoes.get(inteiro(o.v_funcao_id)) || '';
  const tipo = contribuinte ? (categoria >= 721 && categoria <= 723 ? 'Sócio – pró-labore' : 'Contribuinte') : funcao || 'Funcionário';
  const situacao = situacaoNoRhNet(o.situacao);
  return {
    id: 'rh' + id, nome: nome.slice(0, 120), cpf: cpfMascarado(o.cpf), tipo: tipo.slice(0, 60),
    entrada: (texto(o.entrada_data) || texto(o.admissao_data)).slice(0, 10).replace(/^(?!\d{4}-\d{2}-\d{2}$).*$/, ''),
    situacao: situacao ? SITUACAO_NA_AREA[situacao] : '',
  };
}

/** Os cadastros para a Área, sem repetir, em ordem de nome. */
export function cadastrosParaArea(itens: unknown[], funcoes: ReadonlyMap<number, string> = new Map()): CadastroNoRhNetNaArea[] {
  const porId = new Map<string, CadastroNoRhNetNaArea>();
  for (const x of itens) { const c = cadastroParaArea(x, funcoes); if (c) porId.set(c.id, c); }
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

// ---------------------------------- o pedido de admissão da Área do Cliente ----------------------------------

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * O pedido de admissão que o cliente manda pela Área do Cliente (o texto que a tela monta, textoDaAdmissao: "Nome completo:
 * …", "CPF: …", "Cargo: …", "Salário: R$ 2.500,00", "Início: dd/mm/aaaa", "Contrato: …", "Observações: …") → a admissão do
 * RH NET (25/11/2026; o dono: "pode fazer a 1"). O cargo vira a função quando o nome bate com uma função cadastrada no RH NET
 * da empresa; o cargo pedido, o contrato e as observações vão na observação (o DP confere antes de liberar).
 */
/** "Recebe por" da Área → o tipo de funcionário do RH NET */
const REMUNERACAO: [RegExp, 0 | 1 | 2 | 3][] = [[/hora|horista/, 2], [/dia|diarista/, 1], [/comiss/, 3], [/mes|mensal/, 0]];

/** O contrato escolhido na Área → a classe, a categoria, o tipo de contrato e os prazos da experiência no RH NET. O estágio e
 *  o aprendiz vão sem o tipo de contrato (o escritório escolhe na hora de liberar). */
function doContratoDaArea(contrato: string): Pick<AdmissaoParaRhNet, 'classe' | 'categoriaEsocial' | 'contratoTipo' | 'experienciaDias' | 'prorrogacaoDias'> {
  const c = semAcento(contrato);
  if (/estag/.test(c)) return { classe: 2, categoriaEsocial: 901, contratoTipo: null };
  if (/aprendiz/.test(c)) return { classe: 0, categoriaEsocial: 103, contratoTipo: null };
  const exp = /experiencia/.test(c) ? /(\d+)\s*\+\s*(\d+)/.exec(c) ?? ['', '45', '45'] : null;
  return { classe: 0, categoriaEsocial: 101, contratoTipo: 1, ...(exp ? { experienciaDias: Number(exp[1]), prorrogacaoDias: Number(exp[2]) } : {}) };
}

export function admissaoDoPedidoDaArea(texto: string, funcoes: readonly ItemDoCadastroRh[] = []): { admissao: AdmissaoParaRhNet; cidades?: CidadesDoPedido } | { erro: string } {
  const campos = new Map<string, string>();
  for (const linha of String(texto ?? '').split(/\r?\n/)) {
    const m = /^([^:]{2,30}):\s*(.*)$/.exec(linha.trim());
    if (m) campos.set(semAcento(m[1]), m[2].trim());
  }
  const nome = campos.get('nome completo') ?? '';
  const cpf = (campos.get('cpf') ?? '').replace(/\D/g, '');
  const cargo = campos.get('cargo') ?? '';
  const inicio = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(campos.get('inicio') ?? '');
  const salarioTexto = (campos.get('salario') ?? '').replace(/[^\d,.]/g, '');
  const salario = salarioTexto ? Number(salarioTexto.replace(/\./g, '').replace(',', '.')) : NaN;
  if (!nome) return { erro: 'o pedido veio sem o nome' };
  if (!cpf) return { erro: 'o pedido veio sem o CPF (o RH NET exige)' };
  if (!inicio) return { erro: 'o pedido veio sem a data de início' };
  const funcao = cargo ? funcoes.find(f => semAcento(f.nome) === semAcento(cargo)) : undefined;
  const contrato = campos.get('contrato') ?? '';
  const recebe = campos.get('recebe por') ?? '';
  const nascido = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(campos.get('nascimento') ?? '');
  const pis = (campos.get('pis') ?? '').replace(/\D/g, '');
  const completo = cadastroCompletoDoPedido(campos);
  const observacao = ['Pedido pela Área do Cliente.', cargo && 'Cargo pedido: ' + cargo + '.', contrato && 'Contrato: ' + contrato + '.', recebe && 'Recebe: ' + recebe + '.', campos.get('observacoes') && 'Observações: ' + campos.get('observacoes')]
    .filter(Boolean).join(' ');
  const admissao: AdmissaoParaRhNet = {
    nome, cpf, admissao: inicio[3] + '-' + inicio[2] + '-' + inicio[1], observacao,
    ...(nascido ? { nascimento: nascido[3] + '-' + nascido[2] + '-' + nascido[1] } : {}), ...(pis.length === 11 ? { pis } : {}),
    ...(salario > 0 ? { salario } : {}), ...(funcao ? { funcaoId: funcao.id } : {}),
    ...doContratoDaArea(contrato), remuneracao: REMUNERACAO.find(([r]) => r.test(semAcento(recebe)))?.[1] ?? 0,
    ...completo.admissao,
  };
  const erro = erroDaAdmissao(admissao);
  // as cidades em texto: o robô procura o código IBGE pelo nome e a UF
  return erro ? { erro } : { admissao, cidades: completo.cidades };
}

/** Os nomes das funções do RH NET como o Cargo da admissão da Área mostra: sem repetir, em ordem, no máximo 300 (26/11/2026). */
export function cargosParaArea(funcoes: readonly { nome: string }[] | null | undefined): string[] {
  const nomes = new Map<string, string>();
  for (const f of funcoes ?? []) {
    const n = String(f?.nome ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (n && !nomes.has(n.toUpperCase())) nomes.set(n.toUpperCase(), n);
  }
  return [...nomes.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, 300);
}

/**
 * (26/11/2026: "pesquisa como faz no rh net e faz baseado nisso") As pendências da liberação de admissão: o RH NET só
 * libera com o cadastro completo e, quando falta algo, responde 207 (parte liberada) ou 400 (nada liberado) com
 * retorno.erros = [{ funcionario_contribuinte_id, erros: { campo: [mensagens] } } ou { ..., mensagem }]. Só as mensagens,
 * sem repetir.
 */
export function pendenciasDaLiberacao(resposta: unknown): string[] {
  const lista = objeto(objeto(resposta)?.retorno)?.erros;
  if (!Array.isArray(lista)) return [];
  const saida = new Set<string>();
  for (const item of lista) {
    const o = objeto(item);
    if (!o) continue;
    const erros = objeto(o.erros);
    if (erros) for (const v of Object.values(erros)) for (const m of Array.isArray(v) ? v : [v]) { const t = texto(m).trim(); if (t) saida.add(t); }
    const m = texto(o.mensagem).trim();
    if (m) saida.add(m);
  }
  return [...saida].slice(0, 20);
}

/** A situação no RH NET → o que a solicitação de admissão da equipe mostra (as mesmas etapas do RH NET). */
export function situacaoDaAdmissaoNaEquipe(situacao: string): { rotulo: string; texto: string; tom: 'ok' | 'warn' | 'neutral' | 'bad'; podeLiberar: boolean } {
  switch (situacao) {
    case 'cadastrado': case 'nao_liberado':
      return { rotulo: 'Não liberada', texto: 'Pré-admissão no RH NET, ainda não liberada. Confira os dados e libere: o RH NET só aceita com o cadastro completo.', tom: 'warn', podeLiberar: true };
    case 'liberado':
      return { rotulo: 'Liberada', texto: 'Liberada no RH NET. Falta o SCI do escritório importar para a folha.', tom: 'neutral', podeLiberar: false };
    case 'aguardando_integracao':
      return { rotulo: 'Aguardando integração', texto: 'O SCI do escritório está importando para a folha.', tom: 'neutral', podeLiberar: false };
    case 'integrado':
      return { rotulo: 'Na folha', texto: 'Integrada: a pessoa já está na folha do SCI.', tom: 'ok', podeLiberar: false };
    case 'recusado':
      return { rotulo: 'Recusada', texto: 'O SCI do escritório recusou a admissão. Veja o motivo no RH NET.', tom: 'bad', podeLiberar: false };
    case 'enviando':
      return { rotulo: 'Cadastrando', texto: 'O robô está cadastrando no RH NET…', tom: 'neutral', podeLiberar: false };
    default:
      return { rotulo: 'Não cadastrada', texto: 'Não foi para o RH NET. Cadastre direto lá.', tom: 'bad', podeLiberar: false };
  }
}

// ---------------------------------- o cadastro completo da admissão da Área (26/11/2026) ----------------------------------
// "quero verificacao na tela de registro, que nao deixa nem passar": o formulário da Área pede tudo o que o RH NET exige
// para LIBERAR. As opções da tela e a leitura do pedido usam as mesmas listas daqui (o texto do pedido vira os códigos).

/** As opções do formulário (o rótulo da tela → o código do RH NET). */
export const OPCOES_DA_ADMISSAO = {
  sexo: [['Feminino', 0], ['Masculino', 1]],
  estadoCivil: [['Solteiro(a)', 0], ['Casado(a)', 1], ['União estável', 6], ['Divorciado(a)', 2], ['Separado(a) judicialmente', 5], ['Viúvo(a)', 3], ['Outro', 4]],
  racaCor: [['Branca', 1], ['Parda', 3], ['Preta', 4], ['Amarela', 0], ['Indígena', 2], ['Não quero informar', 5]],
  escolaridade: [
    ['Analfabeto', 1], ['Fundamental incompleto (até o 5º ano)', 2], ['5º ano completo', 3], ['Fundamental incompleto (6º ao 9º ano)', 4],
    ['Fundamental completo', 5], ['Médio incompleto', 6], ['Médio completo', 7], ['Superior incompleto', 8], ['Superior completo', 9],
    ['Pós-graduação', 12], ['Mestrado', 10], ['Doutorado', 11],
  ],
  logradouro: [['Rua', 1], ['Avenida', 2], ['Travessa', 37], ['Praça', 31], ['Alameda', 3], ['Estrada', 16], ['Rodovia', 4], ['Fazenda', 18], ['Sítio', 36], ['Outros', 5]],
} as const satisfies Record<string, readonly (readonly [string, number])[]>;

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'] as const;

/** As cidades do pedido em texto ('Montes Claros/MG'), para o robô achar o código IBGE. */
export interface CidadesDoPedido { nascimento?: { nome: string; uf: string }; endereco?: { nome: string; uf: string; cep: string } }

const codigoDaOpcao = (lista: readonly (readonly [string, number])[], v: string | undefined) => {
  const alvo = semAcento(v ?? '');
  return alvo ? lista.find(([r]) => semAcento(r) === alvo)?.[1] : undefined;
};
const cidadeUf = (v: string | undefined) => { const m = /^(.+?)\s*[/-]\s*([A-Za-z]{2})$/.exec(String(v ?? '').trim()); return m ? { nome: m[1].trim(), uf: m[2].toUpperCase() } : undefined; };
const diaIso = (v: string | undefined) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v ?? '').trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : undefined; };

/** O que o pedido traz do cadastro completo (as linhas do textoDaAdmissao da Área). */
function cadastroCompletoDoPedido(campos: Map<string, string>): { admissao: Partial<AdmissaoParaRhNet>; cidades: CidadesDoPedido } {
  const c = (k: string) => campos.get(k) ?? '';
  const O = OPCOES_DA_ADMISSAO;
  const nascimento = cidadeUf(c('cidade de nascimento'));
  const cidade = cidadeUf(c('cidade'));
  const cep = c('cep').replace(/\D/g, '');
  const celular = c('celular').replace(/\D/g, '');
  const horas = Number(c('horas por semana').replace(',', '.'));
  const a: Partial<AdmissaoParaRhNet> = {
    ...(codigoDaOpcao(O.sexo, c('sexo')) !== undefined ? { sexo: codigoDaOpcao(O.sexo, c('sexo')) as 0 | 1 } : {}),
    ...(codigoDaOpcao(O.estadoCivil, c('estado civil')) !== undefined ? { estadoCivil: codigoDaOpcao(O.estadoCivil, c('estado civil')) } : {}),
    ...(codigoDaOpcao(O.racaCor, c('raca/cor')) !== undefined ? { etnia: codigoDaOpcao(O.racaCor, c('raca/cor')) } : {}),
    ...(codigoDaOpcao(O.escolaridade, c('escolaridade')) !== undefined ? { grauInstrucao: codigoDaOpcao(O.escolaridade, c('escolaridade')) } : {}),
    ...(c('nome da mae') ? { maeNome: c('nome da mae') } : {}),
    ...(c('rg') ? { rg: c('rg') } : {}), ...(c('orgao emissor') ? { rgOrgao: c('orgao emissor') } : {}),
    ...(/^[A-Za-z]{2}$/.test(c('uf do rg')) ? { rgUf: c('uf do rg').toUpperCase() } : {}), ...(diaIso(c('emissao do rg')) ? { rgEmissao: diaIso(c('emissao do rg')) } : {}),
    ...(celular.length >= 10 ? { celular } : {}),
    ...(cep.length === 8 && c('logradouro') ? { endereco: {
      cep, logradouroTipo: codigoDaOpcao(O.logradouro, c('tipo de logradouro')) ?? 1, logradouro: c('logradouro'), numero: c('numero') || 'S/N',
      ...(c('complemento') ? { complemento: c('complemento') } : {}), bairro: c('bairro'),
    } } : {}),
    ...(horas > 0 && horas <= 44 ? { horasSemana: horas } : {}),
    ...(c('trabalha a noite') ? { horarioNoturno: /^sim/i.test(c('trabalha a noite')) } : {}),
  };
  return { admissao: a, cidades: { ...(nascimento ? { nascimento } : {}), ...(cidade && cep.length === 8 ? { endereco: { ...cidade, cep } } : {}) } };
}

/** O código IBGE da cidade na lista do IBGE da UF ({ id, nome }), pelo nome sem acento; 0 se não achou um só. */
export function codigoIbgeDaCidade(lista: readonly { id: number; nome: string }[], nome: string): number {
  const alvo = semAcento(nome).replace(/[^a-z0-9 ]/g, '');
  const achadas = lista.filter(m => semAcento(m.nome).replace(/[^a-z0-9 ]/g, '') === alvo);
  return achadas.length === 1 && /^\d{7}$/.test(String(achadas[0].id)) ? Number(achadas[0].id) : 0;
}
