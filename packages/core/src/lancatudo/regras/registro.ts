// O Registro do Lançatudo: as linhas do extrato do banco no mês, cada uma com a contrapartida. Ordem de quem manda na
// conta: a pessoa (na linha) > a regra > a conta aprendida do favorecido > a sugestão pelo razão já importado (esta só
// sugere: a linha fica "sugerida" até a pessoa confirmar). O que já está no razão do mês (importado no Extrator) fica
// marcado e fora da exportação: já foi lançado no Alterdata.
import type { ContaDoPlano } from '../../empresas/cadastro/tipos';
import { bancoDoArquivo } from '../../extratudo/extrator/regras/bancos';
import { conferir } from '../../extratudo/extrator/regras/conferencia';
import { sugestoesPorPendente } from '../../extratudo/extrator/regras/lancamentosParaOSistema';
import type { EmpresaExtrator, Lancamento, LancamentoDoArquivo } from '../../extratudo/extrator/tipos';
import { normalizarTexto } from '../../formatos';
import type { ConfigDoLancatudo, DecisaoDaLinha, LinhaDoRegistro, OrigemDaConta, SituacaoDaLinha, TotaisDoRegistro } from '../tipos';
import { idDaChave } from './documento';
import { chaveLembrada, historicoLimpo, historicoPelaRegra, regraDaLinha } from './motor';

/** O que o Extrator tem de um banco para o mês. */
export interface DadosDoBanco {
  /** as linhas do extrato no mês, na ordem do arquivo */
  extrato: Lancamento[];
  /** o razão da conta no mês (vazio = ainda não importado) */
  razaoDoMes: Lancamento[];
  /** o razão da conta em todos os meses com contrapartida: os modelos da sugestão */
  modelos: Lancamento[];
  /** o razão veio com os sinais trocados (o do Alterdata vem sempre: crédito positivo) */
  razaoInvertido: boolean;
}

const doLado = (e: EmpresaExtrator, banco: string, primeiro: string, lado: 'banco' | 'sistema') =>
  e.arquivos.filter(a => a.lado === lado && bancoDoArquivo(a, primeiro) === banco);

const comId = (l: readonly Lancamento[], prefixo: string): LancamentoDoArquivo[] =>
  l.map((x, i) => ({ ...x, id: prefixo + i, idArquivo: prefixo, lado: prefixo === 'b' ? 'banco' : 'sistema' }));

/** O extrato e o razão de um banco da empresa no mês ('aaaa-mm'), como o Extrator guardou. */
export function dadosDoBanco(e: EmpresaExtrator, banco: string, primeiro: string, competencia: string): DadosDoBanco {
  const extratos = doLado(e, banco, primeiro, 'banco');
  const razoes = doLado(e, banco, primeiro, 'sistema');
  const extrato = extratos.flatMap(a => a.lancamentos.filter(l => l.data.startsWith(competencia)));
  const razaoDoMes = razoes.flatMap(a => a.lancamentos.filter(l => l.data.startsWith(competencia)));
  const modelos = razoes.flatMap(a => a.lancamentos.filter(l => !!l.conta));
  // o sentido do razão pela conferência do último mês que tem os dois lados (o do Alterdata, sem mês para comparar, inverte)
  let razaoInvertido = modelos.length > 0;
  const mesesDoRazao = [...new Set(razoes.flatMap(a => a.lancamentos.map(l => l.data.slice(0, 7))))].sort().reverse();
  for (const mes of mesesDoRazao) {
    const b = extratos.flatMap(a => a.lancamentos.filter(l => l.data.startsWith(mes)));
    if (!b.length) continue;
    const s = razoes.flatMap(a => a.lancamentos.filter(l => l.data.startsWith(mes)));
    razaoInvertido = conferir(comId(b, 'b'), comId(s, 's')).sistemaInvertido;
    break;
  }
  return { extrato, razaoDoMes, modelos, razaoInvertido };
}

/** Os meses ('aaaa-mm') com extrato do banco no Extrator, o mais novo primeiro (para a tela oferecer quando o mês escolhido não tem). */
export function mesesComExtrato(e: EmpresaExtrator, banco: string, primeiro: string): string[] {
  const meses = new Set<string>();
  for (const a of doLado(e, banco, primeiro, 'banco')) for (const l of a.lancamentos) meses.add(l.data.slice(0, 7));
  return [...meses].sort().reverse();
}

/**
 * A chave de cada linha: o dia, o valor, o histórico (sem acento, sem caixa) e a ocorrência (a 2ª tarifa igual no mesmo
 * dia é outra linha), num resumo curto (vira nome de campo no banco). Sobrevive à releitura do extrato, que troca os
 * arquivos e as posições.
 */
export function chavesDasLinhas(l: readonly Lancamento[]): string[] {
  const vistas = new Map<string, number>();
  return l.map(x => {
    const base = x.data + '|' + x.valor + '|' + normalizarTexto(x.historico).slice(0, 80);
    const n = (vistas.get(base) || 0) + 1;
    vistas.set(base, n);
    return idDaChave(base) + '-' + n;
  });
}

export interface EntradaDoRegistro {
  dados: DadosDoBanco;
  banco: string;
  /** o código contábil da conta do banco (Cadastro › Contas bancárias) */
  contaDoBanco: string;
  config: ConfigDoLancatudo;
  /** as decisões do mês neste banco, pela chave da linha */
  decisoes: Readonly<Record<string, DecisaoDaLinha>>;
  /** o plano de contas da empresa (sem plano, qualquer código vale) */
  plano: readonly ContaDoPlano[] | null;
}

/** O que está errado na conta, pelo plano (null = nada). */
export function problemaDaConta(conta: string, plano: readonly ContaDoPlano[] | null, porCodigo?: ReadonlyMap<string, ContaDoPlano>): string | null {
  if (!plano?.length) return null;
  const c = (porCodigo || new Map(plano.map(x => [x.codigo, x]))).get(conta);
  if (!c) return 'A conta ' + conta + ' não está no plano de contas';
  if (c.sintetica) return 'A conta ' + conta + ' é de título (sintética): não recebe lançamento';
  return null;
}

/** As linhas do Registro do banco no mês. */
export function montarRegistro(p: EntradaDoRegistro): LinhaDoRegistro[] {
  const { dados, config, decisoes, plano } = p;
  const porCodigo = new Map((plano || []).map(c => [c.codigo, c]));
  const chaves = chavesDasLinhas(dados.extrato);

  // o que já está no razão do mês: o mesmo valor no mesmo dia (o "ok" da conferência); a contrapartida que o razão tem (a
  // coluna Contrapartida do razão da conciliação do Alterdata) é a conta da linha
  const noRazao = new Map<number, Lancamento>();
  if (dados.razaoDoMes.length) {
    const conf = conferir(comId(dados.extrato, 'b'), comId(dados.razaoDoMes, 's'));
    for (const l of conf.linhas) if (l.situacao === 'ok' && l.extrato && l.sistema) noRazao.set(Number(l.extrato.id.slice(1)), dados.razaoDoMes[Number(l.sistema.id.slice(1))]);
  }

  // a sugestão pelo razão só para as que ficaram sem conta (a conta é calculada antes)
  type Escolha = { conta: string | null; nome: string; origem: OrigemDaConta | null; regra?: string; historico: string; codHistorico: string };
  const escolhas: Escolha[] = dados.extrato.map((l, i) => {
    const d = decisoes[chaves[i]];
    const historicoDoBanco = historicoLimpo(l.historico);
    const r = regraDaLinha(config.regras, l, p.banco);
    const historicoBase = r ? historicoPelaRegra(r, l.historico) : historicoDoBanco;
    const historico = d?.historico?.trim() || historicoBase;
    const codHistorico = d?.codHistorico !== undefined ? d.codHistorico : r?.codHistorico || '';
    if (d && d.conta !== undefined) return { conta: d.conta || null, nome: '', origem: d.conta ? 'pessoa' : null, historico, codHistorico };
    if (r) return { conta: r.conta, nome: '', origem: 'regra', regra: r.id, historico, codHistorico };
    const k = chaveLembrada(l.historico, l.valor);
    const lembrada = k ? config.lembradas[k] : undefined;
    if (lembrada) return { conta: lembrada.conta, nome: '', origem: 'lembrada', historico, codHistorico };
    return { conta: null, nome: '', origem: null, historico, codHistorico };
  });

  // a conta do razão do mês vale para a linha que já está nele (o que o Alterdata já tem lançado)
  for (const [i, doRazao] of noRazao) {
    if (doRazao?.conta && doRazao.conta !== p.contaDoBanco) escolhas[i] = { ...escolhas[i], conta: doRazao.conta, nome: doRazao.historico, origem: 'lancada', regra: undefined };
  }
  const semConta = escolhas.map((e, i) => (e.conta === null && !(decisoes[chaves[i]]?.conta === '') && !noRazao.has(i) ? i : -1)).filter(i => i >= 0);
  if (semConta.length && dados.modelos.length) {
    const pend = semConta.map(i => ({ data: dados.extrato[i].data, valor: dados.extrato[i].valor, historico: dados.extrato[i].historico }));
    const sug = sugestoesPorPendente(pend, dados.modelos, p.contaDoBanco, dados.razaoInvertido);
    sug.forEach((s, j) => {
      if (!s) return;
      escolhas[semConta[j]] = { ...escolhas[semConta[j]], conta: s.conta, nome: s.nomeDaConta, origem: 'razao' };
    });
  }

  return dados.extrato.map((l, i) => {
    const e = escolhas[i];
    const d = decisoes[chaves[i]];
    const problema = e.conta ? problemaDaConta(e.conta, plano, porCodigo) : null;
    let situacao: SituacaoDaLinha;
    if (noRazao.has(i)) situacao = 'no-razao';
    else if (d?.ignorar) situacao = 'ignorada';
    else if (!e.conta || problema) situacao = 'pendente';
    else situacao = e.origem === 'razao' ? 'sugerida' : 'conciliada';
    return {
      chave: chaves[i], data: l.data, valor: l.valor, historicoDoBanco: l.historico,
      historico: e.historico, codHistorico: e.codHistorico, documento: d?.documento || '', contaDoBanco: p.contaDoBanco,
      conta: e.conta, nomeDaConta: (e.conta && porCodigo.get(e.conta)?.nome) || e.nome || '',
      origem: e.origem, ...(d && d.conta !== undefined ? { contaEscolhida: true } : {}), ...(e.regra ? { regra: e.regra } : {}), situacao, ...(problema ? { problema } : {}),
    };
  });
}

/** Os números do Registro. */
export function totaisDoRegistro(linhas: readonly LinhaDoRegistro[]): TotaisDoRegistro {
  const t: TotaisDoRegistro = { linhas: linhas.length, conciliadas: 0, sugeridas: 0, pendentes: 0, ignoradas: 0, noRazao: 0, entradas: 0, saidas: 0 };
  for (const l of linhas) {
    if (l.situacao === 'conciliada') t.conciliadas++;
    else if (l.situacao === 'sugerida') t.sugeridas++;
    else if (l.situacao === 'pendente') t.pendentes++;
    else if (l.situacao === 'ignorada') t.ignoradas++;
    else t.noRazao++;
    if (l.valor > 0) t.entradas += l.valor; else t.saidas -= l.valor;
  }
  return t;
}

/** Quanto do mês está pronto (0 a 100): as conciliadas, as ignoradas e as que já estão no razão sobre todas. */
export function percentualConciliado(t: TotaisDoRegistro): number {
  return t.linhas ? Math.floor(((t.conciliadas + t.ignoradas + t.noRazao) / t.linhas) * 100) : 0;
}
