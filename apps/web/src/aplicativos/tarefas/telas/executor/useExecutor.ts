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
import { caminhoDaEmpresa, caminhoDoExecutor } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { CANCELAR_LOTE_A_QUALQUER_HORA } from '../../../../comum/desenvolvimento';
import { useDepartamentoDaTela } from '../../casca/departamento';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { apagarTiques } from './useChecklistDaFolha';

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
  // o modo desenvolvedor (Vitor, 06/10/2026): navega por todas as etapas, sem marcar nem desmarcar nada
  const [dev] = useModoDesenvolvedor();
  // a rotina do departamento de quem está trabalhando (Contábil ou Fiscal)
  const { dep, comDep, lista } = useDepartamentoDaTela();
  const rotina = t.rotinaDo(dep) || t.ROTINA_CONTABIL;
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
  const juntos = varios || !!f?.periodo || !!etapa?.tela?.periodo;
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
    if (dev || !varios || !carregada || !empresa || gravouPeriodo.current === periodo) return;
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
  // rever uma etapa já concluída (Vitor, 05/10/2026): ela abre como estava, com os checks, tudo ofuscado; só o Editar
  // (na barra de cima) desmarca e a faz voltar a ser a da vez
  const [vendo, setVendo] = useState<string | null>(null);
  const revista = vendo && vendo !== etapa?.id && (dev || meses.some(c => concluidaEm(vendo, c))) ? rotina.etapas.find(e => e.id === vendo) || null : null;
  const vista = revista || etapa;
  const fv = vista?.ferramenta || null;
  // a etapa "só quando adicionada" (o Creditor) trabalha os meses em que entrou: os do caixa com CRÉD.LIQ.COBRANÇA
  // (Vitor, 05/10/2026: "já deixa configurado, de acordo com os meses de cred liq do caixa")
  // (só os que faltam concluir; revendo a etapa já feita, todos em que ela entrou)
  const entrouEm = vista?.soQuandoAdicionada ? meses.filter(c => t.etapaNoMes(exDe[c] || null, vista.id)) : [];
  const mesesDaEtapa = revista ? entrouEm : entrouEm.filter(c => !concluidaEm(vista!.id, c));
  const compV = mesesDaEtapa[0] || (revista ? meses[meses.length - 1] || competencia : competencia);
  const juntosV = varios || !!fv?.periodo || !!vista?.tela?.periodo;
  const mesesV = mesesDaEtapa.length ? '&meses=' + mesesDaEtapa.join(',') : juntosV && varios ? '&meses=' + meses.join(',') : '';

  // começou (ou voltou a) uma etapa: um evento por etapa aberta (conta o tempo de cada uma)
  const iniciadas = useRef(new Set<string>());
  const chaveDosAlvos = alvos.join(',');
  useEffect(() => {
    if (!carregada || !etapa || dev) return;
    for (const c of chaveDosAlvos.split(',').filter(Boolean)) {
      const k = etapa.id + '|' + c;
      if (iniciadas.current.has(k) || !exDe[c]) continue;
      iniciadas.current.add(k);
      repo.registrar(exDe[c], t.eventoDeInicio(etapa.id, op.nome, new Date()));
    }
  });

  /**
   * Editar uma etapa concluída (o botão da barra de cima, ao rever): o check dela sai e ela vira a da vez (as outras
   * ficam como estão). Uma da frente pergunta antes. Etapa da vez: não faz nada.
   */
  async function voltarPara(id: string, confirmado = false) {
    if (!etapa || carregando || conferindo) return;
    const alvo = rotina.etapas.findIndex(e => e.id === id);
    const daVez = rotina.etapas.findIndex(e => e.id === etapa.id);
    if (alvo < 0 || alvo === daVez) return;
    // uma etapa da frente já marcada (Vitor, 01/10/2026: "desmarque esses"): pergunta e desmarca só ela
    if (alvo > daVez) {
      if (!meses.some(m => concluidaEm(id, m))) return;
      // o Editar já perguntou
      if (!confirmado) {
        const nome = rotina.etapas[alvo].nome;
        const ok = await modal({ icone: 'checkCircle', titulo: 'Desmarcar ' + nome + '?', texto: 'A etapa volta a ficar pendente' + (varios ? ' em todos os meses do período' : '') + '.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desmarcar', valor: true, variante: 'btn-primary' }] });
        if (!ok) return;
      }
    }
    // no período: volta em todos os meses em que ela estava feita
    for (const c of meses.filter(m => concluidaEm(id, m))) {
      const v = t.voltarPara(exDe[c], id, op.nome, new Date());
      iniciadas.current.delete(id + '|' + c);
      repo.gravar(v.execucao, v.evento);
    }
    setAviso(null);
    setVendo(null);
  }

  /** Clique numa etapa do checklist: a concluída abre para rever (sem desmarcar); a da vez volta para ela. */
  function abrirEtapa(id: string) {
    // desenvolvedor: abre qualquer uma, só para ver
    if (dev) { setVendo(id === etapa?.id ? null : id); return; }
    if (!etapa || carregando || conferindo) return;
    if (id === etapa.id) { setVendo(null); return; }
    if (meses.some(c => concluidaEm(id, c))) { setVendo(id); setAviso(null); }
  }

  const ultimo = meses[meses.length - 1] || competencia;
  const voltar = () => navegar(lista + '?competencia=' + ultimo);
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
  const iVisto = vista ? secoes.indexOf(vista.secao || '') : iDaVez;
  // feito: os de trás (tudo concluído); atual: o da vez; travado: os da frente; visto: o que está na tela
  const grupos = secoes.map((nome, i) => {
    const es = rotina.etapas.filter(e => (e.secao || '') === nome);
    return { nome, feitas: es.filter(e => concluidaNoPeriodo(e.id)).length, total: es.length, feito: i < iDaVez, atual: i === iDaVez, travado: !dev && i > iDaVez, visto: i === iVisto };
  });
  /** Abrir um grupo de trás: revê a primeira etapa dele (sem desmarcar nada); o da vez: volta para a etapa da vez. */
  function abrirGrupo(nome: string) {
    if (dev) { const p = rotina.etapas.find(e => (e.secao || '') === nome); if (p) setVendo(p.id === etapa?.id ? null : p.id); return; }
    const i = secoes.indexOf(nome);
    if (i < 0 || i > iDaVez) return;
    if (i === iDaVez) { setVendo(null); return; }
    const primeira = rotina.etapas.find(e => (e.secao || '') === nome && meses.some(c => concluidaEm(e.id, c)));
    if (primeira) { setVendo(primeira.id); setAviso(null); }
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
      // a etapa "só quando adicionada" (o Creditor) que não entrou em nenhum mês: também some
      const oculta = (e.id === 'cheque-especial' && meses.length > 0 && meses.every(c => exDe[c]?.etapas[e.id]?.objecao === 'sem-saldo-negativo'))
        || (!!e.soQuandoAdicionada && !meses.some(c => t.etapaNoMes(exDe[c] || null, e.id)));
      return { id: e.id, n: i + 1, nome: e.nome, secao: e.secao, grupo, oculta, situacao: feitos === meses.length && meses.length ? 'feita' as const : parada ? 'interrompida' as const : 'pendente' as const, feitos, atual: e.id === vista?.id, daVez: e.id === etapa?.id };
    }),
    // a etapa na tela: a da vez ou, revendo, a concluída que a pessoa abriu
    etapa: vista, n: vista ? rotina.etapas.findIndex(e => e.id === vista.id) + 1 : 0, total: rotina.etapas.length,
    /** revendo uma etapa concluída: tudo ofuscado, só o Editar */
    // (no modo desenvolvedor, a etapa da frente aberta para ver não é "concluída": fica livre, sem a barra do Editar)
    revendo: !!revista && meses.some(c => concluidaEm(revista.id, c)),
    // o Editar pergunta antes de desmarcar (Vitor, 05/10/2026)
    editar: async () => {
      if (!revista) return;
      const ok = await modal<boolean>({ titulo: 'Desmarcar ' + revista.nome + '?', texto: 'A etapa volta a ficar pendente' + (varios ? ' em todos os meses do período' : '') + ' e vira a etapa da vez.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desmarcar', valor: true, variante: 'btn-primary' }] });
      if (ok) await voltarPara(revista.id, true);
    },
    voltarAEtapaDaVez: () => setVendo(null),
    /** o modo desenvolvedor: só ver (o Avançar azul vai para a próxima etapa sem marcar nada) */
    dev,
    /** os valores que as etapas informaram neste mês (o total da folha do DP) */
    valores: ex?.valores || {},
    /** a etapa informa um valor (o DP, o total da folha): fica na execução do mês */
    informarValor: (chave: string, valor: number) => {
      if (!ex || !etapa) return;
      const v = t.informarValor(ex, etapa.id, chave, valor, op.nome, new Date());
      repo.gravar(v.execucao, v.evento);
    },
    /**
     * O ⚡ › Apagar início (Vitor, 06/10/2026): a rotina volta ao começo — toda etapa pendente, em todos os meses do
     * período, e os tiques dos checklists apagados. Só no modo desenvolvedor: nada vai para o banco (fica só nesta tela).
     */
    apagarInicio: async () => {
      if (!dev || !empresa) return;
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar o início?', texto: 'Todas as etapas de ' + empresa.nome + ' voltam a ficar pendentes' + (varios ? ' em todos os meses do período' : '') + ' e os checklists ficam sem tiques. Modo desenvolvedor: só nesta tela, nada muda no banco.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar o início', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      const agora = new Date();
      for (const c of meses) {
        let atual = exDe[c];
        if (!atual) continue;
        for (const id of Object.keys(atual.etapas || {})) {
          const v = t.voltarPara(atual, id, op.nome, agora);
          repo.gravar(v.execucao, v.evento);
          atual = v.execucao;
        }
      }
      apagarTiques(empresa.nome);
      iniciadas.current.clear();
      setAviso(null);
      setVendo(null);
    },
    temAvancar: dev && !!vista && rotina.etapas.findIndex(e => e.id === vista.id) < rotina.etapas.length - 1,
    avancar: () => {
      const i = vista ? rotina.etapas.findIndex(e => e.id === vista.id) : -1;
      const p = rotina.etapas[i + 1];
      if (p) setVendo(p.id === etapa?.id ? null : p.id);
    },
    interrompidaAntes: etapa && ex ? t.estadoDa(ex, etapa.id)?.situacao === 'interrompida' ? t.estadoDa(ex, etapa.id) : null : null,
    // no período, a ferramenta que trabalha vários meses recebe todos (abas por mês); as outras, o mês da vez
    ferramenta: fv && empresa ? { nome: fv.nome, embutir: fv.embutir, requisitos: !!fv.requisitos, url: BASES[fv.app] + fv.caminho(empresas.rotaDaEmpresa(empresa)) + (fv.app === 'extratudo' ? (fv.caminho('').includes('?') ? '&' : '?') + 'competencia=' + compV + mesesV
      // a Conferência roda no período que a pessoa está fazendo (o mês, ou os meses do Em Lote)
      : fv.app === 'concilia-ai' ? '?meses=' + (juntosV && varios ? meses : [compV]).join(',') + (prestaServico == null ? '' : '&servicos=' + (prestaServico ? 'sim' : 'nao')) : '') } : null,
    /** a tela própria da etapa (no lugar da ferramenta em iframe): a empresa e os meses que ela trabalha */
    tela: vista?.tela && empresa ? {
      id: vista.tela.id,
      etapa: { nome: empresa.nome, codigo: empresa.codigo, competencia: compV, meses: mesesDaEtapa.length ? mesesDaEtapa : juntosV && varios ? [...meses] : [compV], dev },
    } : null,
    /** os meses que a etapa ainda precisa (no período) */
    pendentes: pendentes.map(rotuloCurto),
    aviso, conferindo, proximo,
    abrirEtapa,
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
    irParaPeriodo: periodoDoMes && empresa ? comDep(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), periodoDoMes)) : null,
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
      navegar(comDep(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), ultimo)));
    },
    /** A ferramenta trocou a competência ou o período (o seletor dela): a mesma empresa, no outro período. */
    trocarCompetencia: (c: string) => {
      if (!empresa || c === periodo || !t.competenciasDoPeriodo(c).length) return;
      // o período só se escolhe na primeira etapa (a Importação); nas outras, as ferramentas seguem o período à risca
      // (Vitor, 05/10/2026: "essa seleção de mês é só na primeira etapa")
      if (etapa && etapa.id !== rotina.etapas[0].id) { toast('O período só se escolhe na Importação.'); return; }
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
      navegar(comDep(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), c)));
    },
    /**
     * O razão do caixa importado: o Creditor entra nos meses do período com liquidação de cobrança no caixa
     * (CRÉD.LIQ.COBRANÇA) e sai dos outros, se ainda não foi feito (Vitor, 05/10/2026). Devolve os meses em que entrou.
     */
    ajustarCreditor: (comLiquidacao: readonly string[]): string[] => {
      if (carregando) return [];
      const entrou: string[] = [];
      for (const c of meses) {
        const exc = exDe[c];
        if (!exc) continue;
        const tem = comLiquidacao.includes(c);
        const esta = !!exc.adicionadas?.includes('creditor');
        if (tem && !esta) {
          const a = t.adicionarEtapa(exc, 'creditor', 'CRÉD.LIQ.COBRANÇA no razão do caixa', op.nome, new Date());
          repo.gravar(a.execucao, a.evento);
          entrou.push(c);
        } else if (!tem && esta && !t.estadoDa(exc, 'creditor')) {
          const r = t.retirarEtapa(exc, 'creditor', 'o razão do caixa não tem CRÉD.LIQ.COBRANÇA', op.nome, new Date());
          repo.gravar(r.execucao, r.evento);
        }
      }
      return entrou;
    },
    abrirEmpresa: () => { if (empresa) navegar(caminhoDaEmpresa(empresas.rotaDaEmpresa(empresa), ultimo)); },
  };
}
