// ViewModel do executor (a tela cheia das etapas): a etapa da vez, a ferramenta dela, as objeções,
// o "Próximo" (check automático → marca feita e passa para a próxima), o "Interromper" (com o motivo)
// e o "Não se aplica". Cada coisa vira evento com hora e pessoa.
// Etapa com vários meses: a rota pode ser um período ('2026-06..2026-08'). Continua uma execução por mês; a
// etapa da vez é a primeira que falta em algum mês. Se a ferramenta trabalha o período (ferramenta.periodo, o
// Extrator), o Próximo confere e marca todos os meses que faltam de uma vez; senão, vai mês a mês.
// O período fica prometido: gravado em cada mês (execucao.periodo); abrir a empresa num desses meses leva de
// volta ao período, e só dá para encerrar quando todos os meses dele estiverem concluídos.
import { empresas, extrator, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { extratorDaEmpresa, repoDoCadastro } from '../../dados/fonte';
import { useExecucoesDoPeriodo, usePrestaServico, useRepo } from '../../dados/repo';
import { caminhoDaEmpresa, caminhoDaPagina, caminhoDoExecutor } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { CANCELAR_LOTE_A_QUALQUER_HORA } from '../../../../comum/desenvolvimento';

/**
 * Onde cada aplicativo mora. O Extratudo vem junto no site da Tarefas (mesmo endereço: o login do Entregas
 * fica guardado); o Conciliadorzinho ainda é o site dele. A Conferência é sempre a de verdade.
 */
const soTarefas = import.meta.env.VITE_APLICATIVO === 'tarefas';
const BASES: Record<t.FerramentaDaEtapa['app'], string> = {
  extratudo: '',
  conciliadorzinho: soTarefas ? 'https://conciliadorzinho-nilma.web.app' : '',
  // a Conferência vem junto no site da Tarefas (a etapa Conferência fiscal abre no mesmo endereço)
  'concilia-ai': '',
};

/**
 * A conferência automática do "Próximo" (extrato e razão importados…). DESLIGADA por enquanto (Vitor, 30/09/2026:
 * "libera pra mim, depois bloqueio de novo"): o Próximo marca a etapa como feita sem conferir. Para bloquear de
 * novo, volte para true.
 */
const CONFERIR_NO_PROXIMO = false;

export function useExecutor(rotaEmpresa: string, periodo: string) {
  const repo = useRepo();
  const navegar = useNavigate();
  const { toast, modal, aviso: avisar } = useRetorno();
  const op = useOperador().operador as Operador;
  const rotina = t.ROTINA_CONTABIL;
  // as seções da rotina, na ordem (Preparação, Ativo, Passivo, Resultado, Fechamento)
  const secoes = [...new Set(rotina.etapas.map(e => e.secao || ''))];
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rotaEmpresa);
  // a regra do Cadastro da empresa (presta serviços?): vai para a Conferência fiscal (?servicos=)
  const prestaServico = usePrestaServico(empresa?.nome ?? null, empresa?.codigo ?? null);
  const meses = t.competenciasDoPeriodo(periodo);
  const varios = meses.length > 1;
  const { porMes, carregada } = useExecucoesDoPeriodo(meses, rotina.departamento);
  // a execução de cada mês (a que já existe ou uma nova)
  const exDe: Record<string, t.Execucao> = {};
  if (empresa) for (const m of porMes) exDe[m.competencia] = m.execucoes.find(e => e.empresa === empresa.nome) || t.execucaoNova(empresa.nome, empresa.codigo, m.competencia, rotina.departamento);
  const concluidaEm = (id: string, c: string) => t.concluida(t.situacaoDa(exDe[c] || null, id));
  // a etapa da vez: a primeira que falta em algum mês do período
  const etapa = empresa && meses.length ? rotina.etapas.find(e => meses.some(c => !concluidaEm(e.id, c))) || null : null;
  const pendentes = etapa ? meses.filter(c => !concluidaEm(etapa.id, c)) : [];
  const f = etapa?.ferramenta || null;
  // em lote (vários meses: o período escolhido na Importação), toda etapa trabalha o período inteiro, do começo ao fim
  // (Vitor, 02/10/2026): as ações valem para todos os meses que faltam. Num mês só, a ferramenta de período também.
  const juntos = varios || !!f?.periodo;
  const alvos = juntos ? pendentes : pendentes.slice(0, 1);
  const competencia = pendentes[0] || meses[meses.length - 1] || '';
  const ex = exDe[competencia] || null;
  const carregando = !carregada;
  // um mês só, mas que faz parte de um período prometido: o executor leva para o período
  const periodoDoMes = !varios && carregada && ex?.periodo && ex.periodo !== periodo && t.competenciasDoPeriodo(ex.periodo).length > 1 ? ex.periodo : null;
  const concluido = varios && carregada && t.periodoConcluido(meses.map(c => exDe[c] || null), rotina);

  // abriu o período: grava a promessa em cada mês dele (uma vez)
  const gravouPeriodo = useRef('');
  useEffect(() => {
    if (!varios || !carregada || !empresa || gravouPeriodo.current === periodo) return;
    gravouPeriodo.current = periodo;
    for (const c of meses) {
      if (exDe[c] && exDe[c].periodo !== periodo) {
        const p = t.definirPeriodo(exDe[c], periodo, op.nome, new Date());
        repo.gravar(p.execucao, p.evento);
      }
    }
  });
  const [aviso, setAviso] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [interrompendo, setInterrompendo] = useState(false);

  // começou (ou voltou a) uma etapa: um evento por etapa aberta (conta o tempo de cada uma)
  const iniciadas = useRef(new Set<string>());
  const chaveDosAlvos = alvos.join(',');
  useEffect(() => {
    if (!carregada || !etapa) return;
    for (const c of chaveDosAlvos.split(',').filter(Boolean)) {
      const k = etapa.id + '|' + c;
      if (iniciadas.current.has(k) || !exDe[c]) continue;
      iniciadas.current.add(k);
      repo.registrar(exDe[c], t.eventoDeInicio(etapa.id, op.nome, new Date()));
    }
  });

  /**
   * Clique numa etapa do checklist: dá para voltar a uma etapa anterior já concluída — o check dela sai
   * e ela vira a da vez (as outras ficam como estão). Etapa da vez ou mais à frente: não faz nada.
   */
  async function voltarPara(id: string) {
    if (!etapa || carregando || conferindo) return;
    const alvo = rotina.etapas.findIndex(e => e.id === id);
    const daVez = rotina.etapas.findIndex(e => e.id === etapa.id);
    if (alvo < 0 || alvo === daVez) return;
    // uma etapa da frente já marcada (Vitor, 01/10/2026: "desmarque esses"): pergunta e desmarca só ela
    if (alvo > daVez) {
      if (!meses.some(m => concluidaEm(id, m))) return;
      const nome = rotina.etapas[alvo].nome;
      const ok = await modal({ icone: 'checkCircle', titulo: 'Desmarcar ' + nome + '?', texto: 'A etapa volta a ficar pendente' + (varios ? ' em todos os meses do período' : '') + '.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desmarcar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
    }
    // no período: volta em todos os meses em que ela estava feita
    for (const c of meses.filter(m => concluidaEm(id, m))) {
      const v = t.voltarPara(exDe[c], id, op.nome, new Date());
      iniciadas.current.delete(id + '|' + c);
      repo.gravar(v.execucao, v.evento);
    }
    setAviso(null);
  }

  const ultimo = meses[meses.length - 1] || competencia;
  const voltar = () => navegar(caminhoDaPagina('minhas-empresas', 'empresas') + '?competencia=' + ultimo);
  const rotuloCurto = (c: string) => t.rotuloCurtoCompetencia(c);

  /** Confere e marca a etapa em cada mês que falta (no período, todos de uma vez); o que não passou vira aviso. */
  /**
   * semCheque: a Importação disse que nenhum banco fecha negativo — o Cheque especial nem aparece: fica dispensado
   * junto (Vitor, 02/10/2026: "se não tiver saldo negativo, nem coloque essa tarefa").
   */
  async function proximo(semCheque = false) {
    if (!ex || !etapa || conferindo) return;
    const pulaCheque = semCheque && etapa.id === 'extratos';
    /** grava a etapa feita e, sem dia negativo, o Cheque especial dispensado em cima dela (a mesma execução) */
    const gravarFeita = (ev: ReturnType<typeof t.fazer>) => {
      repo.gravar(ev.execucao, ev.evento);
      if (!pulaCheque) return;
      const d = t.dispensar(ev.execucao, 'cheque-especial', 'sem-saldo-negativo', '', op.nome, new Date());
      repo.gravar(d.execucao, d.evento);
    };
    setConferindo(true);
    try {
      if (!CONFERIR_NO_PROXIMO) {
        // liberado: marca feita em cada mês que falta, sem conferir
        for (const c of alvos) {
          const fz = t.fazer(exDe[c], etapa.id, op.nome, new Date());
          gravarFeita(fz);
        }
        setAviso(null);
        toast(etapa.nome + ': feita' + (varios ? ' em ' + alvos.map(rotuloCurto).join(', ') : '') + '.');
        return;
      }
      const ext = t.precisaDoExtrator(etapa) ? await extratorDaEmpresa(ex.empresa) : null;
      // os bancos da empresa na competência: os do Cadastro, quando ela tem; senão, os de antes
      const cad = ext ? await repoDoCadastro().obter(ex.empresa, ex.codigo) : null;
      const falhas: string[] = [];
      const feitos: string[] = [];
      let semMov = 0;
      for (const c of alvos) {
        const exc = exDe[c];
        const { bancos, primeiro } = ext ? extrator.bancosDaEmpresaNa(ext, cad, exc.codigo, c) : { bancos: [], primeiro: undefined };
        if (ext && t.todosSemMovimento(exc, bancos)) {
          // nenhum banco teve movimento: a etapa não se aplica nesta competência
          const d = t.dispensar(exc, etapa.id, 'sem-movimento', '', op.nome, new Date());
          repo.gravar(d.execucao, d.evento);
          feitos.push(c); semMov++;
          continue;
        }
        const r = t.verificar(etapa, c, ext?.arquivos || [], ext ? { bancos, primeiro, semMovimento: exc.semMovimento || [] } : undefined);
        if (!r.ok) {
          falhas.push((varios ? rotuloCurto(c) + ': ' : '') + r.motivo);
          repo.registrar(exc, t.eventoDeVerificacaoFalhou(etapa.id, op.nome, new Date(), r.motivo));
          continue;
        }
        const fz = t.fazer(exc, etapa.id, op.nome, new Date());
        gravarFeita(fz);
        feitos.push(c);
      }
      setAviso(falhas.length ? falhas.join(' · ') : null);
      if (feitos.length) toast(etapa.nome + (semMov === feitos.length ? ': sem movimento' : ': feita') + (varios ? ' em ' + feitos.map(rotuloCurto).join(', ') : '') + '.');
    } catch (e) {
      setAviso('Não consegui conferir agora: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setConferindo(false);
    }
  }

  async function naoSeAplica(objecao: t.Objecao) {
    if (!ex || !etapa) return;
    const ok = await modal<boolean>({
      icone: 'checkCircle', titulo: 'Não se aplica?', texto: etapa.nome + ': "' + objecao.texto + '". A etapa conta como concluída nesta competência.',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Não se aplica', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    for (const c of alvos) {
      const d = t.dispensar(exDe[c], etapa.id, objecao.id, '', op.nome, new Date());
      repo.gravar(d.execucao, d.evento);
    }
    setAviso(null);
  }

  /** depois: para onde ir (a saída que a pessoa clicou); sem isso, volta para a lista */
  function interromper(objecao: string, observacao: string, depois?: () => void) {
    if (!ex || !etapa) return;
    for (const c of alvos) {
      const i = t.interromper(exDe[c], etapa.id, objecao, observacao, op.nome, new Date());
      repo.gravar(i.execucao, i.evento);
    }
    setInterrompendo(false);
    toast('Etapa interrompida: ' + etapa.nome + '.');
    if (depois) depois(); else voltar();
  }

  /** Solução de uma objeção (os botões embaixo): as que dependem de Drive/Contato ainda estão em desenvolvimento. */
  function resolver(o: t.Objecao) {
    if (o.solucao.tipo === 'orientacao') { avisar({ tom: 'info', titulo: o.texto, texto: o.solucao.texto }); return; }
    if (o.solucao.tipo === 'nao-se-aplica') { void naoSeAplica(o); return; }
    if (o.solucao.tipo === 'contato') { toast('Contato (e-mail ao cliente): em desenvolvimento.'); return; }
    if (o.solucao.tipo === 'drive') { toast('Drive: em desenvolvimento.'); return; }
  }

  // os grupos da rotina (os botões no canto do cabeçalho): quantas etapas feitas, o da vez e os da frente (travados)
  const concluidaNoPeriodo = (id: string) => meses.length > 0 && meses.every(c => concluidaEm(id, c));
  const iDaVez = etapa ? secoes.indexOf(etapa.secao || '') : secoes.length;
  const grupos = secoes.map((nome, i) => {
    const es = rotina.etapas.filter(e => (e.secao || '') === nome);
    return { nome, feitas: es.filter(e => concluidaNoPeriodo(e.id)).length, total: es.length, atual: i === iDaVez, travado: i > iDaVez };
  });
  /** Abrir um grupo de trás: volta para a primeira etapa dele (como clicar nela no checklist). O da vez e os da frente: nada. */
  function abrirGrupo(nome: string) {
    const i = secoes.indexOf(nome);
    if (i < 0 || i >= iDaVez) return;
    const primeira = rotina.etapas.find(e => (e.secao || '') === nome);
    if (primeira) void voltarPara(primeira.id);
  }

  return {
    grupos, abrirGrupo,
    empresa, competencia, periodo, meses, varios, rotuloCompetencia: t.rotuloDoPeriodo(meses.length ? meses : [competencia]),
    carregando: !carregada,
    etapas: rotina.etapas.map((e, i) => {
      const feitos = meses.filter(c => concluidaEm(e.id, c)).length;
      const parada = meses.some(c => t.situacaoDa(exDe[c] || null, e.id) === 'interrompida');
      // o grupo na barra lateral (Preparação, Ativo, Passivo…): a mesma seção, o mesmo número
      const grupo = secoes.indexOf(e.secao || '');
      // o Cheque especial dispensado por não ter dia negativo: some da lista
      const oculta = e.id === 'cheque-especial' && meses.length > 0 && meses.every(c => exDe[c]?.etapas[e.id]?.objecao === 'sem-saldo-negativo');
      return { id: e.id, n: i + 1, nome: e.nome, secao: e.secao, grupo, oculta, situacao: feitos === meses.length && meses.length ? 'feita' as const : parada ? 'interrompida' as const : 'pendente' as const, feitos, atual: e.id === etapa?.id };
    }),
    etapa, n: etapa ? rotina.etapas.findIndex(e => e.id === etapa.id) + 1 : 0, total: rotina.etapas.length,
    interrompidaAntes: etapa && ex ? t.estadoDa(ex, etapa.id)?.situacao === 'interrompida' ? t.estadoDa(ex, etapa.id) : null : null,
    // no período, a ferramenta que trabalha vários meses recebe todos (abas por mês); as outras, o mês da vez
    ferramenta: f && empresa ? { nome: f.nome, embutir: f.embutir, requisitos: !!f.requisitos, url: BASES[f.app] + f.caminho(empresas.rotaDaEmpresa(empresa)) + (f.app === 'extratudo' ? (f.caminho('').includes('?') ? '&' : '?') + 'competencia=' + competencia + (juntos && varios ? '&meses=' + meses.join(',') : '')
      // a Conferência roda no período que a pessoa está fazendo (o mês, ou os meses do Em Lote)
      : f.app === 'concilia-ai' ? '?meses=' + (juntos && varios ? meses : [competencia]).join(',') + (prestaServico == null ? '' : '&servicos=' + (prestaServico ? 'sim' : 'nao')) : '') } : null,
    /** os meses que a etapa ainda precisa (no período) */
    pendentes: pendentes.map(rotuloCurto),
    aviso, conferindo, proximo,
    voltarPara: (id: string) => { void voltarPara(id); },
    resolver,
    /** o Cheque especial aberto, mas sem nenhum dia negativo: dispensa e segue (Vitor, 02/10/2026) */
    dispensarSemCheque: () => {
      if (!etapa || etapa.id !== 'cheque-especial') return;
      for (const c of alvos) {
        const d = t.dispensar(exDe[c], etapa.id, 'sem-saldo-negativo', '', op.nome, new Date());
        repo.gravar(d.execucao, d.evento);
      }
    },
    interrompendo, abrirInterromper: () => setInterrompendo(true), fecharInterromper: () => setInterrompendo(false), interromper,
    sair: voltar,
    /** Os bancos sem movimento de cada mês (a ferramenta da etapa mostra a linha marcada no mês que estiver aberto). */
    semMovimentoPorMes: Object.fromEntries(meses.map(c => [c, exDe[c]?.semMovimento || []])) as Record<string, string[]>,
    marcarSemMovimento: (banco: string, marcado: boolean, mes?: string) => {
      const c = mes && exDe[mes] ? mes : competencia;
      if (!exDe[c] || !etapa || carregando) return;
      const m = t.marcarSemMovimento(exDe[c], etapa.id, banco, marcado, op.nome, new Date());
      repo.gravar(m.execucao, m.evento);
    },
    /** o mês aberto faz parte de um período prometido: para onde levar */
    irParaPeriodo: periodoDoMes && empresa ? caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), periodoDoMes) : null,
    /** todos os meses do período estão concluídos (só aí dá para encerrar) */
    periodoConcluido: concluido,
    /** Encerra os vários meses (só com todos concluídos): tira a promessa de cada mês e volta ao último mês. */
    encerrarPeriodo: () => {
      if (!varios || !empresa) return;
      // proibido cancelar depois de passar da Importação (Vitor, 02/10/2026); com tudo concluído, o lote só se encerra
      if (!concluido && etapa && etapa.id !== 'extratos') { toast('O Em lote só pode ser cancelado na Importação.'); return; }
      if (!concluido && !CANCELAR_LOTE_A_QUALQUER_HORA) { toast('Para cancelar a função, os ' + meses.length + ' meses precisam estar 100% concluídos.'); return; }
      for (const c of meses) {
        if (!exDe[c]?.periodo) continue;
        const p = t.definirPeriodo(exDe[c], null, op.nome, new Date());
        repo.gravar(p.execucao, p.evento);
      }
      toast('Em lote cancelado: ' + t.rotuloDoPeriodo(meses) + '.');
      navegar(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), ultimo));
    },
    /** A ferramenta trocou a competência ou o período (o seletor dela): a mesma empresa, no outro período. */
    trocarCompetencia: (c: string) => {
      if (!empresa || c === periodo || !t.competenciasDoPeriodo(c).length) return;
      // alterou o período do Em lote (a engrenagem): os meses que saíram dele deixam de estar prometidos
      if (varios) {
        const novos = new Set(t.competenciasDoPeriodo(c));
        for (const m of meses) {
          // um mês só: ele também sai do Em lote (senão o executor voltaria para o período antigo)
          if ((novos.has(m) && novos.size > 1) || !exDe[m]?.periodo) continue;
          const p = t.definirPeriodo(exDe[m], null, op.nome, new Date());
          repo.gravar(p.execucao, p.evento);
        }
      }
      navegar(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), c));
    },
    abrirEmpresa: () => { if (empresa) navegar(caminhoDaEmpresa(empresas.rotaDaEmpresa(empresa), ultimo)); },
  };
}
