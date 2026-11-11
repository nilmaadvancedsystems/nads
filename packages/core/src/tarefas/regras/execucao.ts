// O andamento das etapas de uma empresa numa competência: o que está feito, o que é a próxima,
// e as ações da tela (fazer, dispensar, interromper), cada uma devolvendo a execução nova e o evento.
import { clienteDoDp, SO_DO_DP } from '../../empresas/dp';
import { EMPRESAS } from '../../empresas/lista';
import type { EmpresaDoEscritorio } from '../../empresas/tipos';
import type { Departamento } from '../../usuarios/tipos';
import { ROTINA_CONTABIL } from '../rotinas/contabil';
import { ROTINA_DP } from '../rotinas/dp';
import { ROTINA_FISCAL } from '../rotinas/fiscal';
import type { Etapa, EstadoEtapa, Evento, Execucao, ReaberturaDaRotina, Rotina, SituacaoEtapa } from '../tipos';

/** As etapas que só entram no mês quando outra as adiciona (Etapa.soQuandoAdicionada): o Creditor, pelo caixa. */
const SO_QUANDO_ADICIONADAS = new Set([...ROTINA_CONTABIL.etapas, ...ROTINA_FISCAL.etapas].filter(e => e.soQuandoAdicionada).map(e => e.id));

/** Quando a Conciliação caixa virou um check à parte (10/11/2026). */
const CONCILIACAO_CAIXA_DESDE = '2026-11-10T14:00:00.000Z';

/** As etapas que valem só para alguns regimes ou só em alguns meses (Fiscal, 06/10/2026: a rotina pelo regime). */
const RESTRITAS = new Map([...ROTINA_CONTABIL.etapas, ...ROTINA_FISCAL.etapas, ...ROTINA_DP.etapas].filter(e => e.regimes || e.meses || e.obrigacaoDp).map(e => [e.id, e]));
const REGIME_POR_CODIGO = new Map(EMPRESAS.filter(e => e.codigo != null).map(e => [e.codigo, e.regime]));

let doCadastro: (codigo: number) => string = () => '';
/** O regime que está no cadastro da empresa (13/10/2026): o aplicativo liga aqui a leitura do Cadastro. */
export function usarRegimesDoCadastro(f: (codigo: number) => string): void { doCadastro = f; }

/** O regime da empresa: o do cadastro; sem ele, o da lista de empresas; '' quando não se sabe. */
export function regimeDaEmpresa(codigo: number | null | undefined): string {
  return codigo == null ? '' : doCadastro(codigo) || REGIME_POR_CODIGO.get(codigo) || '';
}

/** O regime da lista do escritório (sem o do cadastro): o que vale quando o cadastro não escolhe. */
export function regimeDaLista(codigo: number | null | undefined): string {
  return codigo == null ? '' : REGIME_POR_CODIGO.get(codigo) || '';
}

/**
 * A etapa faz parte da rotina deste mês? As "só quando adicionada", só depois de adicionadas; as de alguns regimes, só
 * para eles (regime desconhecido: entra, para nada sumir por engano); as de alguns meses, só neles.
 */
export function etapaNoMes(ex: Execucao | null, etapa: string): boolean {
  if (SO_QUANDO_ADICIONADAS.has(etapa) && !ex?.adicionadas?.includes(etapa)) return false;
  // o mês que já tinha passado da etapa final quando a Conciliação caixa virou um check não reabre
  if (etapa === 'conciliacao-caixa' && ex?.etapas.despesas && concluida(ex.etapas.despesas.situacao) && ex.etapas.despesas.em < CONCILIACAO_CAIXA_DESDE) return false;
  if (ex?.retiradas?.includes(etapa)) return false;
  const e = RESTRITAS.get(etapa);
  if (e && ex) {
    const regime = regimeDaEmpresa(ex.codigo);
    if (e.regimes && regime && !e.regimes.includes(regime)) return false;
    if (!etapaNoMesDoAno(e, ex.competencia)) return false;
    // o DP (06/10/2026): só as obrigações que a empresa tem na planilha do DP (fora dela, entra)
    const dp = e.obrigacaoDp ? clienteDoDp(ex.codigo) : null;
    if (dp && e.obrigacaoDp === 'envio' && !dp.obrigacoes.length) return false;
    if (dp && e.obrigacaoDp === 'reinf' && !dp.reinfAutorizada) return false;
    if (dp && e.obrigacaoDp && e.obrigacaoDp !== 'envio' && e.obrigacaoDp !== 'reinf' && !dp.obrigacoes.includes(e.obrigacaoDp)) return false;
  }
  return true;
}

/**
 * A etapa existe nesta competência pelo mês do ano (Etapa.meses)? O Estoque só em dezembro, as apurações trimestrais só
 * em março, junho, setembro e dezembro. Fora do mês a etapa some da tela (Vitor, 07/10/2026: "não vai ter essa etapa").
 */
export function etapaNoMesDoAno(etapa: Pick<Etapa, 'meses'>, competencia: string): boolean {
  const mes = Number(competencia.slice(5, 7));
  return !etapa.meses || !mes || etapa.meses.includes(mes);
}

export function execucaoNova(empresa: string, codigo: number | null, competencia: string, departamento: Departamento): Execucao {
  return { empresa, codigo, competencia, departamento, etapas: {} };
}

export function estadoDa(ex: Execucao | null, etapa: string): EstadoEtapa | null {
  return ex?.etapas[etapa] || null;
}

export function situacaoDa(ex: Execucao | null, etapa: string): SituacaoEtapa {
  // a etapa que não entrou no mês conta como concluída ("não se aplica")
  return estadoDa(ex, etapa)?.situacao || (etapaNoMes(ex, etapa) ? 'pendente' : 'dispensada');
}

/** Feita ou dispensada ("não se aplica") = não precisa mais fazer. */
export function concluida(s: SituacaoEtapa): boolean {
  return s === 'feita' || s === 'dispensada';
}

/** A primeira etapa que ainda não foi concluída (null = tudo pronto). */
export function proximaEtapa(ex: Execucao | null, rotina: Rotina): Etapa | null {
  // a etapa que saiu do mês (retirada, ou o regime mudou) não prende a rotina, mesmo tendo sido interrompida antes
  return rotina.etapas.find(e => etapaNoMes(ex, e.id) && !concluida(situacaoDa(ex, e.id))) || null;
}

/**
 * No Contábil, as etapas do grupo ficam livres (Vitor, 10/11/2026: "libera todas as tarefas daquela página, só não deixe ir
 * para a próxima sem resolver o outro grupo"): a etapa pedida, se for do grupo da primeira que falta. A Importação vem antes
 * de tudo, porque é ela que traz os dados e escolhe o período.
 */
export function etapaLivre(rotina: Rotina, primeira: Etapa | null, id: string): Etapa | null {
  if (rotina.departamento !== 'contabil' || !primeira || primeira.id === rotina.etapas[0]?.id) return null;
  return rotina.etapas.find(e => e.id === id && (e.secao || '') === (primeira.secao || '')) || null;
}

export interface Progresso { concluidas: number; total: number; interrompida: Etapa | null }

export function progresso(ex: Execucao | null, rotina: Rotina): Progresso {
  // só as etapas do mês (a "só quando adicionada" conta quando entrou)
  const doMes = rotina.etapas.filter(e => etapaNoMes(ex, e.id));
  const concluidas = doMes.filter(e => concluida(situacaoDa(ex, e.id))).length;
  const proxima = proximaEtapa(ex, rotina);
  return { concluidas, total: doMes.length, interrompida: proxima && situacaoDa(ex, proxima.id) === 'interrompida' ? proxima : null };
}

export type SituacaoGeral = 'nao-iniciada' | 'em-andamento' | 'parada' | 'concluida';

export function situacaoGeral(ex: Execucao | null, rotina: Rotina): SituacaoGeral {
  const p = progresso(ex, rotina);
  if (p.concluidas === p.total) return 'concluida';
  if (p.interrompida) return 'parada';
  return p.concluidas === 0 && !Object.keys(ex?.etapas || {}).length ? 'nao-iniciada' : 'em-andamento';
}

export const ROTULO_SITUACAO_GERAL: Record<SituacaoGeral, string> = {
  'nao-iniciada': 'Não iniciada', 'em-andamento': 'Em andamento', parada: 'Parada', concluida: 'Concluída',
};

function mudar(ex: Execucao, etapa: string, estado: EstadoEtapa): Execucao {
  return { ...ex, etapas: { ...ex.etapas, [etapa]: estado } };
}

/** A pessoa começou (ou voltou a) uma etapa. Não muda o estado; só vira evento (conta o tempo). */
export function eventoDeInicio(etapa: string, por: string, agora: Date): Evento {
  return { tipo: 'inicio', etapa, por, em: agora.toISOString() };
}

/** O "Próximo" conferiu e a etapa está feita. */
export function fazer(ex: Execucao, etapa: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  return { execucao: mudar(ex, etapa, { situacao: 'feita', por, em }), evento: { tipo: 'feita', etapa, por, em } };
}

/** a objeção da etapa feita pelo check laranja do executor (seguiu com pendência; Vitor, 11/11/2026) */
export const CHECK_LARANJA = 'check-laranja';

/** Feita pelo check laranja: conta como concluída, com o que faltava na observação (a caixinha fica laranja). */
export function fazerComPendencia(ex: Execucao, etapa: string, faltava: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  const obs = faltava.trim();
  const extra = { objecao: CHECK_LARANJA, ...(obs ? { observacao: obs } : {}) };
  return { execucao: mudar(ex, etapa, { situacao: 'feita', por, em, ...extra }), evento: { tipo: 'feita', etapa, por, em, ...extra } };
}

/** "Não se aplica": conta como concluída, com o motivo. */
export function dispensar(ex: Execucao, etapa: string, objecao: string, observacao: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  const obs = observacao.trim();
  return {
    execucao: mudar(ex, etapa, { situacao: 'dispensada', por, em, objecao, ...(obs ? { observacao: obs } : {}) }),
    evento: { tipo: 'dispensada', etapa, por, em, objecao, ...(obs ? { observacao: obs } : {}) },
  };
}

/** "Interromper": a etapa fica parada com o motivo, até alguém retomar. */
export function interromper(ex: Execucao, etapa: string, objecao: string, observacao: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  const obs = observacao.trim();
  return {
    execucao: mudar(ex, etapa, { situacao: 'interrompida', por, em, objecao, ...(obs ? { observacao: obs } : {}) }),
    evento: { tipo: 'interrompida', etapa, por, em, objecao, ...(obs ? { observacao: obs } : {}) },
  };
}

/**
 * A pessoa clicou numa etapa já concluída no checklist: volta para ela e o check sai (a etapa fica
 * pendente de novo; as outras continuam como estão). O evento guarda como ela estava; a execução guarda quando foi
 * desfeita (reabertas), para o que marca sozinho não refazer o que a pessoa desfez (30/10/2026).
 */
export function voltarPara(ex: Execucao, etapa: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const antes = situacaoDa(ex, etapa);
  const em = agora.toISOString();
  const etapas = { ...ex.etapas };
  delete etapas[etapa];
  return { execucao: { ...ex, etapas, reabertas: { ...(ex.reabertas || {}), [etapa]: em } }, evento: { tipo: 'reaberta', etapa, por, em, observacao: antes } };
}

/** O que o evento da reabertura da rotina diz (o histórico: Usuários, produtividade). */
export const ROTINA_REABERTA = 'rotina reaberta';

/**
 * Reabrir a empresa concluída (11/11/2026: "quando eu termino uma empresa, quero ter a opção de voltar nela: pode ter
 * faltado algo ou eu quero revisar"): a etapa escolhida volta a ficar pendente, como no voltarPara, e todas as outras
 * continuam como estão (nada do que foi feito se perde). A execução guarda quem reabriu, quando e por qual etapa
 * (rotinaReaberta); o evento é o 'reaberta' de sempre, dizendo que foi a rotina inteira que reabriu.
 * null: a rotina não está concluída, ou a etapa não é dela ou não está concluída (aí é o voltarPara de sempre).
 */
export function reabrirRotina(ex: Execucao, rotina: Rotina, etapa: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } | null {
  if (situacaoGeral(ex, rotina) !== 'concluida' || !rotina.etapas.some(e => e.id === etapa) || !estadoDa(ex, etapa)) return null;
  const v = voltarPara(ex, etapa, por, agora);
  return {
    execucao: { ...v.execucao, rotinaReaberta: { por, em: v.evento.em, etapa } },
    evento: { ...v.evento, observacao: ROTINA_REABERTA + ' (a etapa estava ' + v.evento.observacao + ')' },
  };
}

/**
 * A reabertura que ainda vale: a rotina foi reaberta e não foi concluída de novo (concluída de novo, a reabertura vira só
 * história). null: nunca foi reaberta, ou já foi concluída de novo.
 */
export function reaberturaEmAberto(ex: Execucao | null, rotina: Rotina): ReaberturaDaRotina | null {
  return ex?.rotinaReaberta && situacaoGeral(ex, rotina) !== 'concluida' ? ex.rotinaReaberta : null;
}

/**
 * O Fiscal transmitiu a REINF (Vitor, 07/10/2026: "quando transmitir a REINF, quero que apareça para o responsável do DP
 * na aba de REINF e o notifique"): a etapa REINF do DP fica feita "pelo Fiscal" e guarda quem avisar (o robô manda o
 * aviso no celular, o mesmo das entregas, e grava avisadoEm).
 */
export function reinfPeloFiscal(ex: Execucao, por: string, avisar: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const r = fazer(ex, 'dp-reinf', por + ' (Fiscal)', agora);
  const etapas = { ...r.execucao.etapas, 'dp-reinf': { ...r.execucao.etapas['dp-reinf'], ...(avisar ? { avisar } : {}) } };
  return { execucao: { ...r.execucao, etapas }, evento: { ...r.evento, observacao: 'REINF transmitida pelo Fiscal' + (avisar ? '; avisar ' + avisar : '') } };
}

/**
 * O Fiscal transmitiu a REINF e a do DP já está feita pelo Fiscal: não grava de novo. Feita por outro (a importação do
 * Toriba marcou a REINF de setembro), a marca passa a ser a do Fiscal (29/10/2026: "quando eu clico em transmitir no
 * fiscal ele não conta no DP que foi transmitido ou removido").
 */
export function reinfJaMarcadaPeloFiscal(ex: Execucao): boolean {
  const e = ex.etapas['dp-reinf'];
  return !!e && e.situacao === 'feita' && e.por.endsWith('(Fiscal)');
}

/** O Fiscal desfez a transmissão: a REINF do DP volta a fazer, seja quem for que marcou (a REINF é do Fiscal). */
export function reinfDesfeitaPeloFiscal(ex: Execucao, por: string, agora: Date): { execucao: Execucao; evento: Evento } | null {
  if (!ex.etapas['dp-reinf']) return null;
  return voltarPara(ex, 'dp-reinf', por + ' (Fiscal)', agora);
}

/**
 * A etapa informa um valor do mês (ex.: o DP, o total da folha): fica na execução, com o instante a que se refere
 * (valoresEm: agora, ou o envio do lote de onde veio); o evento guarda o que mudou.
 */
export function informarValor(ex: Execucao, etapa: string, chave: string, valor: number, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const em = agora.toISOString();
  const valores = { ...(ex.valores || {}), [chave]: Math.round(valor * 100) / 100 };
  return { execucao: { ...ex, valores, valoresEm: { ...(ex.valoresEm || {}), [chave]: em } }, evento: { tipo: 'valor', etapa, por, em, observacao: chave + '=' + valores[chave] } };
}

/**
 * Uma etapa "só quando adicionada" entra no mês (o razão do caixa tem liquidação de cobrança: o Creditor). O motivo vai
 * no evento.
 */
export function adicionarEtapa(ex: Execucao, etapa: string, motivo: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const atuais = (ex.adicionadas || []).filter(e => e !== etapa);
  return { execucao: { ...ex, adicionadas: [...atuais, etapa] }, evento: { tipo: 'adicionada', etapa, por, em: agora.toISOString(), observacao: motivo } };
}

/** A etapa sai do mês (o razão novo não tem mais o motivo); o que já foi feito nela fica guardado. */
export function retirarEtapa(ex: Execucao, etapa: string, motivo: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  return { execucao: { ...ex, adicionadas: (ex.adicionadas || []).filter(e => e !== etapa) }, evento: { tipo: 'retirada', etapa, por, em: agora.toISOString(), observacao: motivo } };
}

/**
 * O balancete diz se a etapa entra no mês (Vitor, 15/10/2026): sem a conta com saldo, ela sai (retiradas); com, volta.
 * Devolve null quando não muda nada.
 */
export function etapaPeloBalancete(ex: Execucao, etapa: string, entra: boolean, motivo: string, por: string, agora: Date): { execucao: Execucao; evento: Evento } | null {
  const fora = !!ex.retiradas?.includes(etapa);
  if (entra === !fora) return null;
  const retiradas = entra ? (ex.retiradas || []).filter(e => e !== etapa) : [...(ex.retiradas || []), etapa];
  return { execucao: { ...ex, retiradas }, evento: { tipo: entra ? 'adicionada' : 'retirada', etapa, por, em: agora.toISOString(), observacao: motivo } };
}

/** O "Próximo" conferiu e ainda não está feita (vira evento: mostra onde as pessoas tropeçam). */
export function eventoDeVerificacaoFalhou(etapa: string, por: string, agora: Date, motivo: string): Evento {
  return { tipo: 'verificacao-falhou', etapa, por, em: agora.toISOString(), observacao: motivo };
}

/** "Não teve movimento" na linha de um banco (marcar ou desmarcar). O evento diz qual banco. */
export function marcarSemMovimento(ex: Execucao, etapa: string, banco: string, marcado: boolean, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const atuais = (ex.semMovimento || []).filter(b => b !== banco);
  return {
    execucao: { ...ex, semMovimento: marcado ? [...atuais, banco] : atuais },
    evento: { tipo: marcado ? 'sem-movimento' : 'com-movimento', etapa, por, em: agora.toISOString(), observacao: banco },
  };
}

/**
 * Vários meses: põe o mês no período prometido (ou tira, com null). O evento guarda o período (a etapa fica vazia:
 * vale para a competência inteira).
 */
export function definirPeriodo(ex: Execucao, periodo: string | null, por: string, agora: Date): { execucao: Execucao; evento: Evento } {
  const sem: Execucao = { ...ex };
  delete sem.periodo;
  return {
    execucao: periodo ? { ...ex, periodo } : sem,
    evento: { tipo: periodo ? 'periodo' : 'periodo-encerrado', etapa: '', por, em: agora.toISOString(), observacao: periodo || ex.periodo || '' },
  };
}

/** Os meses do período estão todos concluídos (todas as etapas feitas ou "não se aplica")? Só aí dá para encerrar. */
export function periodoConcluido(execucoes: readonly (Execucao | null)[], rotina: Rotina): boolean {
  return execucoes.length > 0 && execucoes.every(ex => situacaoGeral(ex, rotina) === 'concluida');
}

/** Todos os bancos da empresa sem movimento? (aí a etapa dos extratos conta como "não se aplica") */
export function todosSemMovimento(ex: Execucao | null, bancos: readonly { id: string }[]): boolean {
  return bancos.length > 0 && bancos.every(b => ex?.semMovimento?.includes(b.id));
}

const SO_DO_DP_CODIGOS = new Set(SO_DO_DP.map(e => e.codigo));

/**
 * As empresas da rotina do departamento (06/10/2026): o DP trabalha os clientes da planilha do DP (inclusive os que só ele
 * tem: pessoa física, domésticas…); o Contábil e o Fiscal, a lista do escritório.
 */
export function empresasDaRotina<E extends EmpresaDoEscritorio>(departamento: Departamento | string, lista: readonly E[]): E[] {
  return departamento === 'dp' ? lista.filter(e => !!clienteDoDp(e.codigo)) : lista.filter(e => e.codigo == null || !SO_DO_DP_CODIGOS.has(e.codigo));
}
