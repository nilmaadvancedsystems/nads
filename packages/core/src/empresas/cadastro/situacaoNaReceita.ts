// A situação da empresa na Receita, consultada na hora (17/11/2026: "um botão no nads que consulte na Receita a situação
// da empresa e traga os dados atualizados"). Até aqui o nads só mostrava o retrato que o vigia do Entregas tira uma vez por
// semana (clientes/{id}.receita). Aqui, em puro: a resposta da consulta lida por inteiro (o retrato), a comparação com o
// que o nads já tem (antes × depois) e a gravação só do que a pessoa escolheu — nada é sobrescrito sozinho.
// Quem consulta é tarefas/dados/receita.ts (a BrasilAPI e, se ela falhar, a minhareceita.org: públicas, sem chave, o
// mesmo formato); o cadastro pelo CNPJ (receita.ts) lê a mesma resposta, só o que a empresa nova precisa.
import { trocarRazaoSocial, razaoSocialDoCadastro, type OutraEmpresa } from './razaoSocial';
import { definirRegime, definirSocios } from './regras';
import type { DadosDaEmpresaNoEntregas, RegimeDoEntregas } from './entregas';
import type { AtividadeDaReceita, CadastroDaEmpresa, OpcaoNaReceita, ReceitaNoCadastro, RetratoDaReceita, Socio, SocioNaReceita } from './tipos';

const so = (v: unknown) => String(v ?? '').replace(/\D/g, '');
/** o texto da resposta: a fonte às vezes manda "null" escrito */
const texto = (v: unknown) => (v == null || v === 'null' ? '' : String(v).trim().replace(/\s+/g, ' '));
/** para comparar: sem acento, sem pontuação, em maiúsculas */
const chave = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const dataIso = (v: unknown) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto(v)); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
/** '2024-02-01' → '01/02/2024' */
export const dataDaReceita = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : iso || ''; };

// ─── o retrato: a resposta da consulta no que interessa ─────────

const atividade = (codigo: unknown, descricao: unknown): AtividadeDaReceita | null => {
  const c = so(codigo);
  if (!c || /^0+$/.test(c)) return null;
  return { codigo: c.length === 7 ? c.replace(/^(\d{4})(\d)(\d{2})$/, '$1-$2/$3') : c, descricao: texto(descricao) };
};

const opcao = (optante: unknown, desde: unknown, exclusao: unknown): OpcaoNaReceita =>
  ({ optante: typeof optante === 'boolean' ? optante : null, desde: dataIso(desde), exclusao: dataIso(exclusao) });

/** O endereço como o vigia do Entregas grava: "RUA X, 100, CENTRO, MONTES CLAROS/MG". */
function enderecoEmTexto(d: Record<string, unknown>): string {
  const tipo = texto(d.descricao_tipo_de_logradouro);
  const rua = texto(d.logradouro);
  const logradouro = tipo && rua && !rua.toUpperCase().startsWith(tipo.toUpperCase()) ? tipo + ' ' + rua : rua;
  return [logradouro, texto(d.numero), texto(d.bairro), [texto(d.municipio), texto(d.uf)].filter(Boolean).join('/')].filter(Boolean).join(', ').toUpperCase();
}

/**
 * A resposta da consulta (BrasilAPI ou minhareceita.org) lida por inteiro; null se não for a empresa pedida ou se vier
 * sem a situação (a fonte às vezes responde 200 com o corpo vazio ou de erro: não pode virar "a empresa mudou tudo").
 */
export function retratoDaReceita(j: unknown, cnpjPedido: string, agora: Date): RetratoDaReceita | null {
  if (!j || typeof j !== 'object') return null;
  const d = j as Record<string, unknown>;
  const cnpj = so(d.cnpj);
  if (cnpj.length !== 14 || cnpj !== so(cnpjPedido)) return null;
  const situacao = texto(d.descricao_situacao_cadastral).toUpperCase();
  const razaoSocial = texto(d.razao_social).toUpperCase();
  if (!situacao || !razaoSocial) return null;
  const capitalTexto = texto(d.capital_social);
  const capital = typeof d.capital_social === 'number' ? d.capital_social : Number(capitalTexto.replace(',', '.'));
  const motivo = texto(d.descricao_motivo_situacao_cadastral);
  const secundarios = Array.isArray(d.cnaes_secundarios)
    ? (d.cnaes_secundarios as Record<string, unknown>[]).map(a => atividade(a?.codigo, a?.descricao)).filter((a): a is AtividadeDaReceita => !!a)
    : [];
  return {
    cnpj, situacao, situacaoDesde: dataIso(d.data_situacao_cadastral),
    // "SEM MOTIVO" é o que a fonte manda na ativa: não diz nada
    motivoSituacao: chave(motivo) === 'SEM MOTIVO' ? '' : motivo.toUpperCase(),
    razaoSocial, fantasia: texto(d.nome_fantasia).toUpperCase(),
    endereco: enderecoEmTexto(d), complemento: texto(d.complemento).toUpperCase(),
    cep: so(d.cep).length === 8 ? so(d.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2') : '',
    cnae: atividade(d.cnae_fiscal, d.cnae_fiscal_descricao),
    cnaesSecundarios: secundarios.filter((a, i) => secundarios.findIndex(b => b.codigo === a.codigo) === i),
    naturezaJuridica: texto(d.natureza_juridica),
    porte: texto(d.porte || d.descricao_porte).toUpperCase(),
    capitalSocial: capitalTexto !== '' && Number.isFinite(capital) ? capital : null,
    abertura: dataIso(d.data_inicio_atividade),
    socios: Array.isArray(d.qsa)
      ? (d.qsa as Record<string, unknown>[]).map(s => ({ nome: texto(s?.nome_socio).toUpperCase(), qualificacao: texto(s?.qualificacao_socio), desde: dataIso(s?.data_entrada_sociedade) })).filter(s => s.nome)
      : [],
    simples: opcao(d.opcao_pelo_simples, d.data_opcao_pelo_simples, d.data_exclusao_do_simples),
    mei: opcao(d.opcao_pelo_mei, d.data_opcao_pelo_mei, d.data_exclusao_do_mei),
    consultadoEm: agora.toISOString(),
  };
}

// ─── as falhas da consulta ─────────

/** Por que a consulta não trouxe a empresa. */
export type FalhaDaReceita = 'invalido' | 'nao-encontrado' | 'limite' | 'fora-do-ar';

export const MENSAGEM_DA_FALHA: Readonly<Record<FalhaDaReceita, string>> = {
  'invalido': 'CNPJ inválido: confira os 14 números.',
  'nao-encontrado': 'CNPJ não encontrado na Receita.',
  'limite': 'A consulta da Receita chegou ao limite de pedidos. Espere um minuto e tente de novo.',
  'fora-do-ar': 'A consulta da Receita não respondeu agora. Tente de novo daqui a pouco.',
};

/** A falha pela resposta da fonte (null = respondeu bem). Sem resposta (rede, demora), quem chama usa 'fora-do-ar'. */
export function falhaDaResposta(status: number): FalhaDaReceita | null {
  if (status >= 200 && status < 300) return null;
  if (status === 400) return 'invalido';
  if (status === 404) return 'nao-encontrado';
  if (status === 429) return 'limite';
  return 'fora-do-ar';
}

/** De várias fontes que falharam, a que explica: inválido, depois não encontrado, depois o limite; senão, fora do ar. */
export function falhaQueVale(falhas: readonly FalhaDaReceita[]): FalhaDaReceita {
  for (const f of ['invalido', 'nao-encontrado', 'limite'] as const) if (falhas.includes(f)) return f;
  return 'fora-do-ar';
}

// ─── o que o nads já sabia (antes) ─────────

/**
 * O que o Entregas sabe da Receita (o vigia de toda semana e o cadastro de lá) como retrato: só os campos que ele tem.
 * O regime do Entregas diz o Simples e o MEI (sem as datas).
 */
export function retratoDoEntregas(d: DadosDaEmpresaNoEntregas | null | undefined, regime?: RegimeDoEntregas | null): Partial<RetratoDaReceita> {
  const r: Partial<RetratoDaReceita> = {};
  if (d?.nomeFantasia) r.fantasia = d.nomeFantasia.toUpperCase();
  const e = d?.receita;
  if (e) {
    if (e.razaoSocial) r.razaoSocial = e.razaoSocial.toUpperCase();
    if (e.situacao) { r.situacao = e.situacao.toUpperCase(); r.situacaoDesde = dataIso(e.situacaoDesde); }
    if (e.cnae) r.cnae = atividade(e.cnae, e.cnaeDescricao);
    if (e.naturezaJuridica) r.naturezaJuridica = e.naturezaJuridica;
    if (e.porte) r.porte = e.porte.toUpperCase();
    if (e.abertura) r.abertura = dataIso(e.abertura);
    if (e.endereco) r.endereco = e.endereco.toUpperCase();
    if (e.socios.length) r.socios = e.socios.map(nome => ({ nome: nome.toUpperCase(), qualificacao: '', desde: '' }));
  } else if (d?.endereco) {
    r.endereco = [d.endereco, d.cidade].filter(Boolean).join(', ').toUpperCase();
  }
  if (regime?.receita) {
    r.simples = { optante: regime.receita === 'Simples' || regime.receita === 'MEI', desde: '', exclusao: '' };
    r.mei = { optante: regime.receita === 'MEI', desde: '', exclusao: '' };
  }
  return r;
}

/** O retrato que vale para mostrar: campo a campo, o gravado no nads; sem ele, o do Entregas. */
export function retratoQueVale(guardado: ReceitaNoCadastro | null | undefined, doEntregas: Partial<RetratoDaReceita>): Partial<RetratoDaReceita> {
  const r: Partial<RetratoDaReceita> = { ...doEntregas };
  if (guardado) for (const [k, v] of Object.entries(guardado)) if (k !== 'conferidoEm' && k !== 'por' && v !== undefined) (r as Record<string, unknown>)[k] = v;
  return r;
}

// ─── a comparação (antes × depois) ─────────

/** As linhas da comparação, na ordem da tela. */
export const CAMPOS_DA_RECEITA = [
  { id: 'situacao', rotulo: 'Situação cadastral' },
  { id: 'razaoSocial', rotulo: 'Razão social' },
  { id: 'fantasia', rotulo: 'Nome fantasia' },
  { id: 'endereco', rotulo: 'Endereço' },
  { id: 'cnae', rotulo: 'Atividade principal' },
  { id: 'cnaesSecundarios', rotulo: 'Atividades secundárias' },
  { id: 'naturezaJuridica', rotulo: 'Natureza jurídica' },
  { id: 'porte', rotulo: 'Porte' },
  { id: 'capitalSocial', rotulo: 'Capital social' },
  { id: 'abertura', rotulo: 'Abertura' },
  { id: 'socios', rotulo: 'Sócios' },
  { id: 'simples', rotulo: 'Simples / MEI' },
  { id: 'regime', rotulo: 'Regime no nads' },
] as const;
export type CampoDaReceita = (typeof CAMPOS_DA_RECEITA)[number]['id'];

/** Os campos do retrato que cada linha grava (a do regime grava só o regime do cadastro). */
const CHAVES_DO_CAMPO: Readonly<Record<CampoDaReceita, readonly (keyof RetratoDaReceita)[]>> = {
  situacao: ['situacao', 'situacaoDesde', 'motivoSituacao'], razaoSocial: ['razaoSocial'], fantasia: ['fantasia'],
  endereco: ['endereco', 'complemento', 'cep'], cnae: ['cnae'], cnaesSecundarios: ['cnaesSecundarios'], naturezaJuridica: ['naturezaJuridica'],
  porte: ['porte'], capitalSocial: ['capitalSocial'], abertura: ['abertura'], socios: ['socios'], simples: ['simples', 'mei'], regime: [],
};

/** Uma linha do antes × depois. */
export interface DiferencaDaReceita {
  campo: CampoDaReceita;
  rotulo: string;
  /** o que o nads tem ('' = não sabia) */
  antes: string;
  /** o que a Receita disse agora ('' = não informa) */
  depois: string;
  /** igual; mudou; novo = o nads não sabia (nada a perder gravando); vazio = a Receita não informa (nada a gravar) */
  estado: 'igual' | 'mudou' | 'novo' | 'vazio';
  /** dá para gravar no nads */
  gravavel: boolean;
  /** pede atenção: a empresa não está ativa, saiu do Simples ou do MEI, o regime não bate */
  grave: boolean;
  /** a explicação curta (o que muda ao gravar, ou por que não dá) */
  nota?: string;
}

const reais = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const textoDaAtividade = (a: AtividadeDaReceita | null | undefined) => (a ? a.codigo + (a.descricao ? ' · ' + a.descricao : '') : '');
const textoDaOpcao = (nome: string, o: OpcaoNaReceita | undefined) => {
  if (!o || o.optante == null) return '';
  if (o.optante) return nome + (o.desde ? ' desde ' + dataDaReceita(o.desde) : '');
  return 'Fora do ' + nome + (o.exclusao ? ' (excluída em ' + dataDaReceita(o.exclusao) + ')' : '');
};
/** MEI, Simples, fora ou '' (não disse) */
const categoriaDoSimples = (r: Partial<RetratoDaReceita>) => r.mei?.optante ? 'MEI' : r.simples?.optante ? 'SIMPLES' : r.simples?.optante === false ? 'FORA' : '';
/** o regime que a Receita indica: MEI, Simples ou '' (fora do Simples); null = não disse */
const regimeDaReceita = (r: RetratoDaReceita): 'MEI' | 'Simples' | '' | null =>
  r.mei.optante ? 'MEI' : r.simples.optante ? 'Simples' : r.simples.optante === false ? '' : null;

/** O texto de cada linha para a tela ('' = não tem). */
function textoDoCampo(campo: CampoDaReceita, r: Partial<RetratoDaReceita>): string {
  switch (campo) {
    case 'situacao': return !r.situacao ? '' :
      r.situacao + (r.situacaoDesde ? ' desde ' + dataDaReceita(r.situacaoDesde) : '') + (r.motivoSituacao ? ' (' + r.motivoSituacao.toLowerCase() + ')' : '');
    case 'endereco': return [r.endereco, r.complemento, r.cep ? 'CEP ' + r.cep : ''].filter(Boolean).join(' · ');
    case 'cnae': return textoDaAtividade(r.cnae);
    case 'cnaesSecundarios': return r.cnaesSecundarios ? (r.cnaesSecundarios.length ? r.cnaesSecundarios.map(textoDaAtividade).join('\n') : 'Nenhuma') : '';
    case 'capitalSocial': return r.capitalSocial == null ? '' : reais(r.capitalSocial);
    case 'abertura': return r.abertura ? dataDaReceita(r.abertura) : '';
    case 'socios': return r.socios?.length ? r.socios.map(s => s.nome + (s.qualificacao ? ' (' + s.qualificacao + ')' : '')).join('\n') : '';
    case 'simples': return r.mei?.optante ? textoDaOpcao('MEI', r.mei) : textoDaOpcao('Simples', r.simples);
    case 'regime': return '';
    default: return String(r[campo] ?? '');
  }
}

/**
 * O antes e o depois são o mesmo? Cada lado é comparado no que o antes sabe: o vigia do Entregas não guarda o motivo da
 * situação nem as datas do Simples, e o endereço dele não tem o complemento nem o CEP.
 */
function mesmoValor(campo: CampoDaReceita, a: Partial<RetratoDaReceita>, d: RetratoDaReceita): boolean {
  switch (campo) {
    case 'situacao': return chave(a.situacao || '') === chave(d.situacao) && (!a.situacaoDesde || a.situacaoDesde === d.situacaoDesde) &&
      (a.motivoSituacao === undefined || chave(a.motivoSituacao) === chave(d.motivoSituacao));
    case 'endereco': return chave(a.endereco || '') === chave(d.endereco) && (a.cep === undefined || so(a.cep) === so(d.cep)) &&
      (a.complemento === undefined || chave(a.complemento) === chave(d.complemento));
    case 'cnae': return so(a.cnae?.codigo) === so(d.cnae?.codigo);
    case 'cnaesSecundarios': { const k = (l: AtividadeDaReceita[] = []) => l.map(x => so(x.codigo)).sort().join(','); return k(a.cnaesSecundarios) === k(d.cnaesSecundarios); }
    case 'capitalSocial': return a.capitalSocial != null && d.capitalSocial != null && Math.abs(a.capitalSocial - d.capitalSocial) < 0.005;
    case 'socios': { const k = (l: SocioNaReceita[] = []) => l.map(s => chave(s.nome)).sort().join('|'); return k(a.socios) === k(d.socios); }
    case 'simples': {
      if (categoriaDoSimples(a) !== categoriaDoSimples(d)) return false;
      const semDatas = !a.simples?.desde && !a.simples?.exclusao && !a.mei?.desde && !a.mei?.exclusao;
      return semDatas || (a.simples?.desde === d.simples.desde && a.simples?.exclusao === d.simples.exclusao && a.mei?.desde === d.mei.desde && a.mei?.exclusao === d.mei.exclusao);
    }
    default: return chave(textoDoCampo(campo, a)) === chave(textoDoCampo(campo, d));
  }
}

/** O lado tem o campo? (para separar o "não sabia" do "mudou") */
function temValor(campo: CampoDaReceita, r: Partial<RetratoDaReceita>): boolean {
  if (campo === 'cnaesSecundarios') return r.cnaesSecundarios !== undefined;
  if (campo === 'simples') return !!categoriaDoSimples(r);
  return !!textoDoCampo(campo, r);
}

/** O que o nads tem e a comparação usa. */
export interface AntesDaReceita {
  cadastro: CadastroDaEmpresa;
  /** o nome da lista do escritório (a razão social sem troca no nads) */
  nomeDaLista: string;
  /** o que o Entregas sabe (retratoDoEntregas) */
  doEntregas: Partial<RetratoDaReceita>;
  /** o regime que vale hoje no nads (o escolhido no cadastro, o do Entregas ou o da lista; '' = nenhum) */
  regimeQueVale: string;
}

/**
 * Antes × depois, linha a linha: o que o nads tem (o gravado no cadastro; sem ele, o que o Entregas sabe) e o que a
 * Receita disse agora. A razão social e os sócios comparam com o próprio cadastro: é o que o nads usa e o que muda ao gravar.
 */
export function compararComReceita(a: AntesDaReceita, depois: RetratoDaReceita): DiferencaDaReceita[] {
  const antes = retratoQueVale(a.cadastro.receita, a.doEntregas);
  antes.razaoSocial = razaoSocialDoCadastro(a.cadastro, a.nomeDaLista).toUpperCase();
  antes.socios = (a.cadastro.socios || []).filter(s => s.nome).map(s => ({ nome: s.nome.toUpperCase(), qualificacao: '', desde: '' }));
  const linhas: DiferencaDaReceita[] = [];
  for (const { id: campo, rotulo } of CAMPOS_DA_RECEITA) {
    if (campo === 'regime') continue;
    const tinha = temValor(campo, antes), tem = temValor(campo, depois);
    if (!tinha && !tem) continue;
    const estado = !tem ? 'vazio' : !tinha ? 'novo' : mesmoValor(campo, antes, depois) ? 'igual' : 'mudou';
    const l: DiferencaDaReceita = { campo, rotulo, antes: textoDoCampo(campo, antes), depois: textoDoCampo(campo, depois), estado, gravavel: estado !== 'vazio', grave: false };
    if (campo === 'situacao') l.grave = depois.situacao !== 'ATIVA';
    if (campo === 'simples') l.grave = estado === 'mudou' && categoriaDoSimples(depois) === 'FORA';
    if (estado === 'vazio') l.nota = campo === 'socios' ? 'A Receita não lista sócios (no MEI e no empresário individual, o quadro vem vazio).' : 'A Receita não informa.';
    if (campo === 'socios' && estado === 'mudou') {
      const novos = new Set(depois.socios.map(s => chave(s.nome)));
      const saem = (a.cadastro.socios || []).filter(s => s.nome && !novos.has(chave(s.nome)));
      l.nota = 'Grava a lista da Receita; o CPF de quem continua fica.' + (saem.length ? ' Sai do cadastro: ' + saem.map(s => s.nome).join(', ') + '.' : '');
    }
    if (campo === 'razaoSocial' && (estado === 'mudou' || estado === 'novo')) l.nota = 'Troca a razão social que aparece no nads (a empresa continua a mesma).';
    linhas.push(l);
  }
  // o regime do nads: a Receita só sabe MEI, Simples ou fora do Simples (Presumido ou Real, a pessoa escolhe)
  const daReceita = regimeDaReceita(depois);
  const vale = a.regimeQueVale;
  if (daReceita != null && (daReceita ? daReceita !== vale : vale === 'Simples' || vale === 'MEI')) {
    linhas.push({
      campo: 'regime', rotulo: 'Regime no nads', antes: vale, depois: daReceita || 'Fora do Simples', estado: vale ? 'mudou' : 'novo',
      gravavel: !!daReceita, grave: !!vale,
      nota: daReceita ? 'Muda o regime da empresa no nads (a rotina do Fiscal segue o regime).' : 'Escolha Presumido ou Real em Fiscal › Parâmetros: a Receita não diz qual.',
    });
  }
  return linhas;
}

/** As linhas que pedem uma escolha (mudou ou novo, e dá para gravar). */
export const linhasParaEscolher = (linhas: readonly DiferencaDaReceita[]) => linhas.filter(l => l.gravavel && l.estado !== 'igual');

// ─── gravar o que a pessoa escolheu ─────────

/** Os sócios da Receita, com o CPF que o cadastro já tinha de quem continua (o da Receita vem mascarado). */
export function sociosDaReceita(cadastro: readonly Socio[], daReceita: readonly SocioNaReceita[]): Socio[] {
  return daReceita.map(s => ({ nome: s.nome, cpf: cadastro.find(c => chave(c.nome) === chave(s.nome))?.cpf || '' }));
}

export interface OpcoesDaGravacao {
  por: string;
  agora: Date;
  /** a lista do escritório, para a razão social não repetir a de outra empresa */
  outras: readonly OutraEmpresa[];
}

/**
 * Grava no cadastro só as linhas escolhidas e, junto, as iguais (não mudam nada e o retrato fica inteiro), com quem
 * conferiu e quando; sem nada escolhido, fica só "conferido". A razão social passa pela troca (a anterior fica
 * guardada); os sócios, pela lista do cadastro (o CPF de quem continua fica); o regime, pelo regime do cadastro. Cada um
 * vai para o histórico, e a consulta também. A razão social que não deu para trocar (o nome de outra empresa) volta em erros.
 */
export function gravarDaReceita(c: CadastroDaEmpresa, depois: RetratoDaReceita, linhas: readonly DiferencaDaReceita[], escolhidos: readonly CampoDaReceita[], o: OpcoesDaGravacao): { cadastro: CadastroDaEmpresa; erros: string[] } {
  const erros: string[] = [];
  const quer = new Set(escolhidos);
  const gravar = linhas.filter(l => l.gravavel && (l.estado === 'igual' || quer.has(l.campo)));
  let novo = c;
  const feitos: string[] = [];
  for (const l of gravar) {
    if (l.estado === 'igual') continue;
    if (l.campo === 'razaoSocial') {
      const r = trocarRazaoSocial(novo, depois.razaoSocial, o.outras, o.por, o.agora);
      if ('erro' in r) { erros.push(r.erro); continue; }
      novo = r;
    } else if (l.campo === 'socios') {
      novo = definirSocios(novo, sociosDaReceita(novo.socios || [], depois.socios), o.por, o.agora);
    } else if (l.campo === 'regime') {
      const r = regimeDaReceita(depois);
      if (!r) continue;
      novo = definirRegime(novo, r, o.por, o.agora);
    }
    feitos.push(l.campo);
  }
  const retrato: ReceitaNoCadastro = { ...(c.receita || {}), conferidoEm: depois.consultadoEm, por: o.por || '—' };
  for (const l of gravar) {
    if (l.estado !== 'igual' && !feitos.includes(l.campo)) continue;
    for (const k of CHAVES_DO_CAMPO[l.campo]) (retrato as Record<string, unknown>)[k] = depois[k];
  }
  retrato.cnpj = depois.cnpj;
  const rotulos = gravar.filter(l => l.estado !== 'igual' && feitos.includes(l.campo)).map(l => l.rotulo);
  const ts = o.agora.toISOString();
  novo = {
    ...novo, receita: retrato, atualizadoEm: ts,
    historico: [{ ts, por: o.por || '—', acao: 'Receita', detalhe: rotulos.length ? 'Gravado da consulta: ' + rotulos.join(', ') : 'Conferido na Receita: nada gravado' }, ...novo.historico],
  };
  return { cadastro: novo, erros };
}
