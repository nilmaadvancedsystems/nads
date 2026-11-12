// ViewModel do executor (a tela cheia das etapas): a etapa da vez, a ferramenta dela, as objeções,
// o "Próximo" (check automático → marca feita e passa para a próxima), o "Interromper" (com o motivo)
// e o "Não se aplica". Cada coisa vira evento com hora e pessoa.
// Etapa com vários meses: a rota pode ser um período ('2026-06..2026-08'). Continua uma execução por mês; a
// etapa da vez é a primeira que falta em algum mês. Se a ferramenta trabalha o período (ferramenta.periodo, o
// Extrator), o Próximo confere e marca todos os meses que faltam de uma vez; senão, vai mês a mês.
// O período fica prometido: gravado em cada mês (execucao.periodo); abrir a empresa num desses meses leva de
// volta ao período, e só dá para encerrar quando todos os meses dele estiverem concluídos.
import { clientes as cl, empresas, extrator, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { extratorDaEmpresa, repoDoCadastro } from '../../dados/fonte';
import { useCadastro, useCartaoEmpresarial, useCredLiquidacao, useVendeNoCartao, useExecucoesDoPeriodo, usePrestaServico, useRegimesDoEntregas, useRepo, useTarefasDelegadas } from '../../dados/repo';
import { caminhoDaEmpresa, caminhoDoExecutor, BASE } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { CANCELAR_LOTE_A_QUALQUER_HORA } from '../../../../comum/desenvolvimento';
import { useDepartamentoDaTela } from '../../casca/departamento';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { apagarTiques } from './useChecklistDaFolha';
import { useEscopoDoGuardado, useGuardado, useVersaoDoGuardado } from '../../../../comum/guardado';
import { dinamicoDaEmpresa } from '../../../../comum/contabilDaEmpresa';
import { criarTravaDeRepeticao } from '../../../../comum/travaDeRepeticao';
import { useEmpresasPermitidas } from '../empresas/andamento';

/**
 * A conferência automática do "Próximo" (extrato e razão importados…). DESLIGADA por enquanto (Vitor, 30/09/2026:
 * "libera pra mim, depois bloqueio de novo"): o Próximo marca a etapa como feita sem conferir. Para bloquear de
 * novo, volte para true.
 */
const CONFERIR_NO_PROXIMO = false;

export function useExecutor(rotaEmpresa: string, periodo: string) {
  useRegimesDoEntregas(); // o regime do Entregas, quando chega
  const repo = useRepo();
  const navegar = useNavigate();
  const { toast, modal, aviso: avisar } = useRetorno();
  const op = useOperador().operador as Operador;
  // o modo desenvolvedor (Vitor, 06/10/2026): navega por todas as etapas, sem marcar nem desmarcar nada
  const [dev] = useModoDesenvolvedor();
  // a rotina do departamento de quem está trabalhando (Contábil ou Fiscal)
  const { dep, comDep, lista } = useDepartamentoDaTela();
  // a empresa de outra pessoa não abre nem pelo endereço (29/10/2026: "se não é encarregado não deve nem ver"); até o
  // Cadastro chegar (de onde vem o responsável), nenhuma: a tela espera, sem mostrar
  const permitidas = useEmpresasPermitidas();
  const achada = empresas.empresaPelaRota(repo.listarEmpresas(), rotaEmpresa);
  const empresa = achada && permitidas.carregada && permitidas.pode(achada) ? achada : null;
  // a da empresa (16/10/2026): no Contábil, a 62 (com o LCDPR) tem só a etapa LCDPR
  const rotina = t.rotinaDaEmpresa(dep, empresa?.codigo) || t.ROTINA_CONTABIL;
  // as seções da rotina, na ordem (Preparação, Ativo, Passivo, Resultado, Fechamento)
  const secoes = [...new Set(rotina.etapas.map(e => e.secao || ''))];
  // só mexe nas etapas que a rotina tem (a do LCDPR não tem Cartões, Creditor nem os adiantamentos)
  const temEtapa = (id: string) => rotina.etapas.some(e => e.id === id);
  // o "onde parou" desta empresa também no banco (16/10/2026): o que for dela vai e, ao abrir, o mais novo volta
  useEscopoDoGuardado(empresa ? formatos.slug(empresa.nome) : null, [empresa?.codigo, empresa?.nome]);
  const versaoDoGuardado = useVersaoDoGuardado();
  // a regra do Cadastro da empresa (presta serviços?): vai para a Conferência fiscal (?servicos=)
  const prestaServico = usePrestaServico(empresa?.nome ?? null, empresa?.codigo ?? null);
  // o Cadastro diz se a empresa tem cartão empresarial: a etapa Cartões entra (ou sai) nos meses do período
  const cartaoEmpresarial = useCartaoEmpresarial(empresa?.nome ?? null, empresa?.codigo ?? null);
  // e se recebe liquidação de cobrança no caixa: Sim põe o Creditor em todos os meses (Vitor, 08/10/2026)
  const credLiquidacao = useCredLiquidacao(empresa?.nome ?? null, empresa?.codigo ?? null);
  // e se vende no cartão: a etapa Vendas no cartão (o Conciliadorzinho) entra ou sai (Vitor, 16/10/2026)
  const vendeNoCartao = useVendeNoCartao(empresa?.nome ?? null, empresa?.codigo ?? null);
  const meses = t.competenciasDoPeriodo(periodo);
  // os bancos da empresa, do Cadastro (o nome de cada conta): para o balão do suporte perguntar "Qual banco?" (20/10/2026)
  const cadastroDaEmpresa = useCadastro(empresa?.nome || '', empresa?.codigo ?? null).cadastro;
  const bancosDaEmpresa = (cadastroDaEmpresa?.bancos || []).map(b => b.nome).filter((n, i, l) => !!n && l.indexOf(n) === i);
  const varios = meses.length > 1;
  const { porMes, carregada } = useExecucoesDoPeriodo(meses, rotina.departamento);
  // a execução de cada mês (a que já existe ou uma nova)
  const exDe: Record<string, t.Execucao> = {};
  if (empresa) for (const m of porMes) exDe[m.competencia] = m.execucoes.find(e => e.empresa === empresa.nome) || t.execucaoNova(empresa.nome, empresa.codigo, m.competencia, rotina.departamento);
  const concluidaEm = (id: string, c: string) => t.concluida(t.situacaoDa(exDe[c] || null, id));
  // as tarefas delegadas: a etapa aberta pela tarefa (?delegada=) e a tarefa em conjunto
  const [paramsDaUrl] = useSearchParams();
  const idDelegada = paramsDaUrl.get('delegada');
  const repoDelegadas = useTarefasDelegadas();
  const listaDelegadas = repoDelegadas.lista();
  const euNaDelegacao = repoDelegadas.eu()?.uid || '';
  // a tarefa em conjunto (Vitor, 12/11/2026: "mais de uma pessoa delegada, aí você coloca todas as boxes, quando o usuário
  // entrar na empresa, vai ter apenas os processos que ele vai fazer"): quem recebeu etapas desta empresa e período vê só
  // elas e as conclui na rotina; quem delegou (e quem não recebeu nada) continua com a empresa inteira
  const emConjunto = t.delegadas.tarefasEmConjunto(listaDelegadas.tarefas, rotaEmpresa, periodo);
  const minhas = dev ? [] : t.delegadas.etapasDaPessoaEmConjunto(listaDelegadas.tarefas, rotaEmpresa, periodo, euNaDelegacao).filter(id => rotina.etapas.some(e => e.id === id));
  const soAsMinhas = minhas.length > 0;
  const minhaPendente = (id: string) => (soAsMinhas && minhas.includes(id) && meses.some(c => !concluidaEm(id, c)) ? rotina.etapas.find(e => e.id === id) || null : null);
  // a primeira que falta em algum mês do período
  const primeira = empresa && meses.length ? rotina.etapas.find(e => meses.some(c => !concluidaEm(e.id, c))) || null : null;
  // a rotina concluída em todos os meses (o "Tudo pronto"): dá para rever as etapas e reabrir a empresa (11/11/2026)
  const tudoPronto = !!empresa && carregada && meses.length > 0 && !primeira;
  // a pendente do grupo que dá para abrir fora da ordem (t.etapaLivre)
  // (na tarefa em conjunto, qualquer uma das da pessoa que falte, fora da ordem)
  const pendenteLivre = (id: string) => { if (soAsMinhas) return minhaPendente(id); const e = t.etapaLivre(rotina, primeira, id); return e && meses.some(c => !concluidaEm(e.id, c)) ? e : null; };
  // a que a pessoa abriu no grupo fica guardada, como o resto do "onde parou"; concluída, volta a primeira que falta
  const [escolhida, setEscolhida] = useGuardado<string | null>(empresa ? 'etapa-escolhida|' + dep + '|' + formatos.slug(empresa.nome) + '|' + periodo : null, null);
  // a etapa da vez: a que a pessoa abriu no grupo ou a primeira que falta
  const etapa = (escolhida ? pendenteLivre(escolhida) : null) || (soAsMinhas ? rotina.etapas.find(e => minhaPendente(e.id)) || null : primeira);
  // a pessoa da tarefa em conjunto já fez todas as dela
  const minhasFeitas = soAsMinhas && carregada && !etapa;
  const pendentes = etapa ? meses.filter(c => !concluidaEm(etapa.id, c)) : [];
  // em lote (vários meses: o período escolhido na Importação), toda etapa trabalha o período inteiro, do começo ao fim
  // (Vitor, 02/10/2026): as ações valem para todos os meses que faltam. Num mês só, a ferramenta de período também.
  const juntos = varios || !!etapa?.tela?.periodo;
  const alvos = juntos ? pendentes : pendentes.slice(0, 1);
  const competencia = pendentes[0] || meses[meses.length - 1] || '';
  const ex = exDe[competencia] || null;
  // a etapa delegada (Vitor, 10/11/2026: "o resto da empresa fica bloqueada"): aberta pela tarefa, só ela e sem concluir a rotina
  // (a tarefa em conjunto aberta pela tarefa não: vale o de cima, as etapas da pessoa)
  const recebida = idDelegada ? listaDelegadas.tarefas.find(x => x.id === idDelegada && !!x.etapaDelegada && !x.etapaDelegada.conjunto && x.responsavel.uid === euNaDelegacao && x.status !== 'cancelada') : undefined;
  const etapaDelegada = recebida ? rotina.etapas.find(e => e.id === recebida.etapaDelegada?.etapa) || null : null;
  const carregando = !carregada || ((!!idDelegada || soAsMinhas) && !listaDelegadas.carregadas);
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
        repo.gravar(p.execucao, p.evento, exDe[c]);
      }
    }
  });
  // as gravações que esta tela faz sozinha (Cartões, Vendas no cartão, Creditor e o balancete): a mesma mudança (mês,
  // etapa, entra ou sai) espera 1 min antes de ser pedida de novo, e o dobro a cada vez, até 1 h (06-07/11/2026: com a
  // gravação da tarefa negada pelo banco, a execução voltava sem a mudança e a conta gravava de novo sem parar; foram 2,6
  // milhões de eventos "retirada" na Dornas Havana, 3,5 GB no banco). Estes efeitos rodam a cada desenho.
  const [podePedir] = useState(() => criarTravaDeRepeticao());
  // a etapa Cartões segue o Cadastro (Vitor, 07/10/2026): "Cartão empresarial: Sim" põe ela nos meses do período; "Não"
  // tira a que ainda não foi feita; não informado, não mexe. Só grava o que mudou (a próxima volta já vê igual).
  useEffect(() => {
    if (dev || !carregada || !empresa || cartaoEmpresarial == null || !temEtapa('cartoes')) return;
    for (const c of meses) {
      const exc = exDe[c];
      if (!exc) continue;
      const esta = !!exc.adicionadas?.includes('cartoes');
      if (cartaoEmpresarial && !esta) {
        if (!podePedir(c + '|cartoes|true')) continue;
        const a = t.adicionarEtapa(exc, 'cartoes', 'Cadastro: cartão empresarial', op.nome, new Date());
        repo.gravar(a.execucao, a.evento, exc);
      } else if (!cartaoEmpresarial && esta && !t.estadoDa(exc, 'cartoes')) {
        if (!podePedir(c + '|cartoes|false')) continue;
        const r = t.retirarEtapa(exc, 'cartoes', 'Cadastro: sem cartão empresarial', op.nome, new Date());
        repo.gravar(r.execucao, r.evento, exc);
      }
    }
  });
  // a etapa Vendas no cartão segue o Cadastro, como a Cartões: "Vende no cartão: Sim" põe nos meses; "Não" tira a não feita
  useEffect(() => {
    if (dev || !carregada || !empresa || vendeNoCartao == null || !temEtapa('vendas-cartao')) return;
    for (const c of meses) {
      const exc = exDe[c];
      if (!exc) continue;
      const esta = !!exc.adicionadas?.includes('vendas-cartao');
      if (vendeNoCartao && !esta) {
        if (!podePedir(c + '|vendas-cartao|true')) continue;
        const a = t.adicionarEtapa(exc, 'vendas-cartao', 'Cadastro: vende no cartão', op.nome, new Date());
        repo.gravar(a.execucao, a.evento, exc);
      } else if (!vendeNoCartao && esta && !t.estadoDa(exc, 'vendas-cartao')) {
        if (!podePedir(c + '|vendas-cartao|false')) continue;
        const r = t.retirarEtapa(exc, 'vendas-cartao', 'Cadastro: não vende no cartão', op.nome, new Date());
        repo.gravar(r.execucao, r.evento, exc);
      }
    }
  });
  // o Creditor segue o Cadastro (Vitor, 08/10/2026): "Liquidação de cobrança: Sim" põe ele em todos os meses do período.
  // Não ou sem resposta, não mexe aqui: ele entra pelo razão do caixa (ajustarCreditor).
  useEffect(() => {
    if (dev || !carregada || !empresa || credLiquidacao !== true || !temEtapa('creditor')) return;
    for (const c of meses) {
      const exc = exDe[c];
      if (!exc || exc.adicionadas?.includes('creditor') || !podePedir(c + '|creditor|true')) continue;
      const a = t.adicionarEtapa(exc, 'creditor', 'Cadastro: liquidação de cobrança', op.nome, new Date());
      repo.gravar(a.execucao, a.evento, exc);
    }
  });
  /**
   * O balancete diz em quais meses uma etapa entra (Vitor, 15/10/2026: os adiantamentos só com saldo no dinâmico). Só
   * os meses que ele cobre; a etapa já feita no mês não sai.
   */
  // a mesma mudança (mês, etapa, entra ou sai) pela trava de cima: 1 min, depois o dobro a cada vez (06/11/2026: era só
  // 1 min, sem teto; com o banco negando o dia todo, ainda dava 60 eventos por hora por mudança)
  function ajustarPeloBalancete(b: { etapa: string; cobertos: readonly string[]; com: readonly string[]; motivo: string }) {
    if (!carregada || dev || !temEtapa(b.etapa)) return;
    for (const c of meses) {
      const exc = exDe[c];
      if (!exc || !b.cobertos.includes(c)) continue;
      const entra = b.com.includes(c) || !!t.estadoDa(exc, b.etapa);
      const pedida = c + '|' + b.etapa + '|' + entra;
      // a etapa que só existe quando o balancete pede (o Adiantamento salarial): entra e sai pelas adicionadas
      if (rotina.etapas.find(e => e.id === b.etapa)?.soQuandoAdicionada) {
        const esta = !!exc.adicionadas?.includes(b.etapa);
        const m = entra && !esta ? t.adicionarEtapa(exc, b.etapa, b.motivo, op.nome, new Date())
          : !entra && esta ? t.retirarEtapa(exc, b.etapa, b.motivo, op.nome, new Date()) : null;
        if (m && podePedir(pedida)) repo.gravar(m.execucao, m.evento, exc);
        continue;
      }
      const m = t.etapaPeloBalancete(exc, b.etapa, entra, b.motivo, op.nome, new Date());
      if (m && podePedir(pedida)) repo.gravar(m.execucao, m.evento, exc);
    }
  }
  const chaveDasExecucoes = meses.map(c => (exDe[c] ? JSON.stringify(exDe[c]) : '')).join('|');
  // os adiantamentos pelo balancete dinâmico já importado em Clientes (o guardado neste navegador), sem precisar abrir o
  // Clientes de novo (Vitor, 15/10/2026: "a 58 não tem adiantamento de clientes e você me pedindo")
  useEffect(() => {
    if (dev || !carregada || !empresa) return;
    // o da Importação (o primeiro passo; 16/10/2026) ou, antes dele, o que o Clientes importou
    const din = dinamicoDaEmpresa(empresa.nome, empresa.codigo);
    if (!din?.d) return;
    for (const [etapa, de, nome] of [['adiantamento-fornecedores', 'fornecedores', 'Adiantamento a fornecedores'], ['adiantamento-clientes', 'clientes', 'Adiantamento de clientes']] as const) {
      const a = cl.adiantamentoNoDinamico(din.d, meses, de);
      ajustarPeloBalancete({ etapa, ...a, motivo: (a.com.length ? nome + ' com saldo' : 'Sem ' + nome.toLowerCase()) + ' no balancete dinâmico' });
    }
    // o Empréstimos também (Vitor, 15/10/2026: "da mesma forma de empréstimo, tire ele daqui")
    const e = cl.emprestimosNoDinamico(din.d, meses);
    ajustarPeloBalancete({ etapa: 'emprestimos', ...e, motivo: (e.com.length ? 'Empréstimo ou financiamento com saldo' : 'Sem empréstimo nem financiamento') + ' no balancete dinâmico' });
    // e o Adiantamento salarial: só no mês com saldo (o certo é zerar; Vitor, 16/10/2026)
    const s = cl.adiantamentoSalarialNoDinamico(din.d, meses);
    ajustarPeloBalancete({ etapa: 'adiantamento-salarial', ...s, motivo: (s.com.length ? 'Adiantamento salarial com saldo' : 'Adiantamento salarial zerado') + ' no balancete dinâmico' });
  // só quando muda o que importa: o dinâmico é grande para ler a cada desenho (o guardado avisa quando muda)
  // (Vitor, 19/10/2026: "o nads está lerdo em outras máquinas") o porMes é uma lista nova a cada desenho: com ele aqui, o
  // dinâmico inteiro (às vezes vários MB) era lido e desfeito a cada desenho do Executor; vale o conteúdo das execuções
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dev, carregada, empresa?.nome, periodo, versaoDoGuardado, chaveDasExecucoes]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [interrompendo, setInterrompendo] = useState(false);
  // rever uma etapa já concluída (Vitor, 05/10/2026): ela abre como estava, com os checks, tudo ofuscado; só o Editar
  // (na barra de cima) desmarca e a faz voltar a ser a da vez
  const [vendo, setVendo] = useState<string | null>(null);
  const revista = etapaDelegada || (vendo && vendo !== etapa?.id && (dev || meses.some(c => concluidaEm(vendo, c))) ? rotina.etapas.find(e => e.id === vendo) || null : null);
  const vista = revista || etapa;
  // a etapa "só quando adicionada" (o Creditor) trabalha os meses em que entrou: os do caixa com CRÉD.LIQ.COBRANÇA
  // (Vitor, 05/10/2026: "já deixa configurado, de acordo com os meses de cred liq do caixa")
  // (só os que faltam concluir; revendo a etapa já feita, todos em que ela entrou)
  const entrouEm = vista?.soQuandoAdicionada ? meses.filter(c => t.etapaNoMes(exDe[c] || null, vista.id)) : [];
  const mesesDaEtapa = revista ? entrouEm : entrouEm.filter(c => !concluidaEm(vista!.id, c));
  const compV = mesesDaEtapa[0] || (revista ? meses[meses.length - 1] || competencia : competencia);
  const juntosV = varios || !!vista?.tela?.periodo;

  // a etapa em conjunto concluída em todos os meses: a tarefa de quem recebeu conclui junto (uma vez por tarefa nesta tela;
  // se o banco negar, não pede de novo sem parar)
  const concluiuTarefa = useRef(new Set<string>());
  useEffect(() => {
    if (dev || !carregada || !soAsMinhas || !meses.length) return;
    for (const x of emConjunto) {
      const id = x.etapaDelegada?.etapa || '';
      if (x.responsavel.uid !== euNaDelegacao || x.status === 'concluida' || concluiuTarefa.current.has(x.id) || !meses.every(c => concluidaEm(id, c))) continue;
      concluiuTarefa.current.add(x.id);
      repoDelegadas.salvar(x.id, { status: 'concluida' }).catch((e: unknown) => toast('Não concluí a tarefa: ' + (e instanceof Error ? e.message : String(e))));
    }
  });

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
    // a rotina concluída (sem etapa da vez) também volta: é reabrir a empresa (11/11/2026)
    if ((!etapa && !tudoPronto) || carregando || conferindo) return;
    const alvo = rotina.etapas.findIndex(e => e.id === id);
    const daVez = etapa ? rotina.etapas.findIndex(e => e.id === etapa.id) : rotina.etapas.length;
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
    // (30/10/2026: a cópia é a do clique, de antes da janela; com ela junto, o banco tira só o check desta etapa, sem
    // apagar o que chegou com a janela aberta)
    // a empresa concluída no mês: é reabrir a rotina (guarda quem reabriu e quando); senão, só a etapa volta
    for (const c of meses.filter(m => concluidaEm(id, m))) {
      const v = t.reabrirRotina(exDe[c], rotina, id, op.nome, new Date()) || t.voltarPara(exDe[c], id, op.nome, new Date());
      iniciadas.current.delete(id + '|' + c);
      repo.gravar(v.execucao, v.evento, exDe[c]);
    }
    setAviso(null);
    setVendo(null);
    setEscolhida(id);
  }

  /** Clique numa etapa do checklist: a concluída abre para rever (sem desmarcar); a da vez volta para ela; a pendente do grupo abre. */
  function abrirEtapa(id: string) {
    // desenvolvedor: abre qualquer uma, só para ver
    if (dev) { setVendo(id === etapa?.id ? null : id); return; }
    // tudo pronto: a etapa clicada abre para rever (antes o clique não fazia nada e a empresa ficava presa no "Tudo pronto")
    if (tudoPronto) { if (meses.some(c => concluidaEm(id, c))) { setVendo(id); setAviso(null); } return; }
    // a tarefa em conjunto com todas as da pessoa feitas: abre a clicada para rever
    if (minhasFeitas) { if (minhas.includes(id) && meses.some(c => concluidaEm(id, c))) { setVendo(id); setAviso(null); } return; }
    if (!etapa || carregando || conferindo) return;
    if (id === etapa.id) { setVendo(null); return; }
    if (pendenteLivre(id)) { setEscolhida(id); setVendo(null); setAviso(null); return; }
    if (meses.some(c => concluidaEm(id, c))) { setVendo(id); setAviso(null); }
  }

  const ultimo = meses[meses.length - 1] || competencia;
  const voltar = () => navegar(lista + 'competencia=' + ultimo);
  const rotuloCurto = (c: string) => t.rotuloCurtoCompetencia(c);

  /** Confere e marca a etapa em cada mês que falta (no período, todos de uma vez); o que não passou vira aviso. */
  /**
   * semCheque: a Importação disse que nenhum banco fecha negativo — o Cheque especial nem aparece: fica dispensado
   * junto (Vitor, 02/10/2026: "se não tiver saldo negativo, nem coloque essa tarefa").
   */
  async function proximo(semCheque = false, laranja: string | null = null) {
    if (!ex || !etapa || conferindo) return;
    const pulaCheque = semCheque && etapa.id === 'extratos';
    // pelo check laranja: marca sem conferir, com o que faltava (a caixinha fica laranja)
    const marcar = (exc: t.Execucao) => laranja !== null
      ? t.fazerComPendencia(exc, etapa.id, laranja, op.nome, new Date())
      : t.fazer(exc, etapa.id, op.nome, new Date());
    /** grava a etapa feita e, sem dia negativo, o Cheque especial dispensado em cima dela (a mesma execução) */
    const gravarFeita = (ev: ReturnType<typeof t.fazer>, antes: t.Execucao) => {
      repo.gravar(ev.execucao, ev.evento, antes);
      if (!pulaCheque) return;
      const d = t.dispensar(ev.execucao, 'cheque-especial', 'sem-saldo-negativo', '', op.nome, new Date());
      repo.gravar(d.execucao, d.evento, ev.execucao);
    };
    setConferindo(true);
    try {
      if (!CONFERIR_NO_PROXIMO || laranja !== null) {
        // liberado: marca feita em cada mês que falta, sem conferir
        for (const c of alvos) gravarFeita(marcar(exDe[c]), exDe[c]);
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
          repo.gravar(d.execucao, d.evento, exc);
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
        gravarFeita(fz, exc);
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

  /**
   * O check laranja ao lado do sino (Vitor, 11/11/2026: "está ocorrendo muitos bugs e está travando a equipe"): segue sem
   * o que a tela diz que falta; o que faltava fica no histórico da etapa, para olhar depois.
   */
  function seguirMesmoAssim(faltava: string[], semCheque = false) {
    return proximo(semCheque, faltava.join(' · '));
  }

  async function naoSeAplica(objecao: t.Objecao) {
    if (!ex || !etapa) return;
    const ok = await modal<boolean>({
      icone: 'checkCircle', titulo: 'Não se aplica?', texto: etapa.nome + ': "' + objecao.texto + '". A etapa conta como concluída nesta competência.',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Não se aplica', valor: true, variante: 'btn-primary' }],
    });
    if (!ok) return;
    // (30/10/2026: a cópia é a do clique, de antes da janela; com ela junto, o banco grava só esta etapa, sem apagar o que
    // chegou com a janela aberta)
    for (const c of alvos) {
      const d = t.dispensar(exDe[c], etapa.id, objecao.id, '', op.nome, new Date());
      repo.gravar(d.execucao, d.evento, exDe[c]);
    }
    setAviso(null);
  }

  /** depois: para onde ir (a saída que a pessoa clicou); sem isso, volta para a lista */
  function interromper(objecao: string, observacao: string, depois?: () => void) {
    if (!ex || !etapa) return;
    for (const c of alvos) {
      const i = t.interromper(exDe[c], etapa.id, objecao, observacao, op.nome, new Date());
      repo.gravar(i.execucao, i.evento, exDe[c]);
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
    /** o Cadastro ainda não chegou: não dá para saber se a empresa é da pessoa */
    esperandoEmpresa: !permitidas.carregada,
    bancosDaEmpresa,
    departamento: rotina.departamento,
    grupos, abrirGrupo,
    empresa, competencia, periodo, meses, varios, rotuloCompetencia: t.rotuloDoPeriodo(meses.length ? meses : [competencia]),
    carregando: !carregada,
    etapas: rotina.etapas.map((e, i) => {
      const feitos = meses.filter(c => concluidaEm(e.id, c)).length;
      const parada = meses.some(c => t.situacaoDa(exDe[c] || null, e.id) === 'interrompida');
      // feita pelo check laranja em algum mês: a caixinha fica laranja
      const laranja = meses.some(c => exDe[c]?.etapas[e.id]?.objecao === t.CHECK_LARANJA);
      // o grupo na barra lateral (Preparação, Ativo, Passivo…): a mesma seção, o mesmo número
      const grupo = secoes.indexOf(e.secao || '');
      // o Cheque especial dispensado por não ter dia negativo: some da lista
      // a etapa "só quando adicionada" (o Creditor) que não entrou em nenhum mês: também some
      // e a etapa de outro mês do ano (o Estoque só em dezembro; Vitor, 07/10/2026): fora dele, nem aparece
      const oculta = (e.id === 'cheque-especial' && meses.length > 0 && meses.every(c => exDe[c]?.etapas[e.id]?.objecao === 'sem-saldo-negativo'))
        || (!!e.soQuandoAdicionada && !meses.some(c => t.etapaNoMes(exDe[c] || null, e.id)))
        || (!!e.meses && meses.length > 0 && !meses.some(c => t.etapaNoMesDoAno(e, c)));
      return { id: e.id, n: i + 1, nome: e.nome, secao: e.secao, grupo, oculta, situacao: feitos === meses.length && meses.length ? 'feita' as const : parada ? 'interrompida' as const : 'pendente' as const, laranja, feitos, atual: e.id === vista?.id, daVez: e.id === etapa?.id };
    }),
    // a etapa na tela: a da vez ou, revendo, a concluída que a pessoa abriu
    etapa: vista, n: vista ? rotina.etapas.findIndex(e => e.id === vista.id) + 1 : 0, total: rotina.etapas.length,
    /** revendo uma etapa concluída: tudo ofuscado, só o Editar */
    // (no modo desenvolvedor, a etapa da frente aberta para ver não é "concluída": fica livre, sem a barra do Editar)
    revendo: !etapaDelegada && !!revista && meses.some(c => concluidaEm(revista.id, c)),
    /** aberta pela tarefa delegada: só esta etapa */
    delegada: !!etapaDelegada,
    /** a tarefa em conjunto: a pessoa recebeu etapas desta empresa e vê só elas */
    soAsMinhas, minhasFeitas,
    ehMinha: (id: string) => minhas.includes(id),
    /** com quem está a etapa na tarefa em conjunto (o nome; '' = com ninguém) */
    comQuem: (id: string) => emConjunto.find(x => x.etapaDelegada?.etapa === id)?.responsavel.nome || '',
    /** as tarefas em conjunto desta empresa e período (a janela de quem delega) */
    emConjunto,
    // o Editar pergunta antes de desmarcar (Vitor, 05/10/2026)
    // a empresa concluída: o Editar reabre a rotina nesta etapa (as outras continuam feitas; fica guardado quem reabriu)
    editar: async () => {
      if (!revista) return;
      const ok = tudoPronto
        ? await modal<boolean>({ icone: 'repeat', titulo: 'Reabrir ' + (empresa?.nome || 'a empresa') + '?', texto: revista.nome + ' volta a ficar pendente' + (varios ? ' em todos os meses do período' : '')
            + ' e a empresa sai de Concluída. As outras etapas continuam feitas, como estão. Fica registrado que ' + op.nome + ' reabriu agora.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Reabrir', valor: true, variante: 'btn-primary' }] })
        : await modal<boolean>({ titulo: 'Desmarcar ' + revista.nome + '?', texto: 'A etapa volta a ficar pendente' + (varios ? ' em todos os meses do período' : '') + ' e vira a etapa da vez.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desmarcar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      await voltarPara(revista.id, true);
      if (tudoPronto) toast((empresa?.nome || 'Empresa') + ' reaberta em ' + revista.nome + '.');
    },
    voltarAEtapaDaVez: () => setVendo(null),
    /** a rotina concluída em todos os meses: sem etapa da vez (o "Tudo pronto"); as etapas abrem para rever e reabrir */
    tudoPronto,
    /** Tudo pronto › Revisar: abre a primeira etapa feita, para rever (sem desmarcar nada) */
    revisar: () => {
      const p = rotina.etapas.find(e => meses.some(c => !!t.estadoDa(exDe[c] || null, e.id) && t.etapaNoMes(exDe[c] || null, e.id)));
      if (p) { setVendo(p.id); setAviso(null); }
    },
    /**
     * a última reabertura da empresa (quem, quando, em qual etapa): emAberto enquanto não foi concluída de novo (a faixa
     * acima do cabeçalho); depois, só a lembrança no "Tudo pronto"
     */
    reabertura: (() => {
      const r = meses.map(c => exDe[c]?.rotinaReaberta).filter((x): x is t.ReaberturaDaRotina => !!x).sort((a, b) => b.em.localeCompare(a.em))[0];
      if (!r) return null;
      const nome = rotina.etapas.find(e => e.id === r.etapa)?.nome || r.etapa;
      const quando = new Date(r.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      return { texto: 'Reaberta por ' + r.por + ' em ' + quando + ', na etapa ' + nome, emAberto: meses.some(c => !!t.reaberturaEmAberto(exDe[c] || null, rotina)) };
    })(),
    /** o modo desenvolvedor: só ver (o Avançar azul vai para a próxima etapa sem marcar nada) */
    dev,
    /** o X só sai, sem o "Por que interromper?": no modo desenvolvedor e na rotina que não pede (o LCDPR) */
    semJustificativa: dev || !!rotina.semInterromper,
    /** o relatório (início e fim): o regime e as etapas que entram no mês, cada uma com a situação, quem e quando */
    relatorio: {
      regime: t.regimeDaEmpresa(empresa?.codigo ?? null),
      etapas: rotina.etapas.filter(e => t.etapaNoMes(ex, e.id) && e.secao !== 'Relatório inicial' && e.secao !== 'Relatório final').map(e => {
        const est = t.estadoDa(ex, e.id);
        return { id: e.id, nome: e.nome, secao: e.secao || '', situacao: est?.situacao || ('pendente' as const), por: est?.por || '', em: est?.em || '' };
      }),
    },
    /** os valores que as etapas informaram neste mês (o total da folha do DP) */
    valores: ex?.valores || {},
    /**
     * a etapa informa um valor (o DP, o total da folha): fica na execução do mês. Vários seguidos partem da mesma cópia
     * (os números da conferência, 30/10/2026: só o último ficava); com a cópia junto, cada um grava só o seu valor
     */
    informarValor: (chave: string, valor: number) => {
      if (!ex || !etapa) return;
      const v = t.informarValor(ex, etapa.id, chave, valor, op.nome, new Date());
      repo.gravar(v.execucao, v.evento, ex);
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
          repo.gravar(v.execucao, v.evento, atual);
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
    /** a tela própria da etapa (no lugar da ferramenta em iframe): a empresa e os meses que ela trabalha */
    tela: vista?.tela && empresa ? {
      id: vista.tela.id,
      etapa: { nome: empresa.nome, codigo: empresa.codigo, competencia: compV, meses: mesesDaEtapa.length ? mesesDaEtapa : juntosV && varios ? [...meses] : [compV], dev, prestaServico,
        // os meses que iam no ?meses= do iframe: os da etapa (o Creditor, o Cartões…) ou os do Em lote; num mês só, nenhum
        mesesDaTarefa: mesesDaEtapa.length > 0 || (juntosV && varios) },
    } : null,
    /** os meses que a etapa ainda precisa (no período) */
    pendentes: pendentes.map(rotuloCurto),
    aviso, conferindo, proximo, seguirMesmoAssim,
    abrirEtapa,
    /** a etapa pendente do grupo que abre fora da ordem */
    livre: (id: string) => !dev && !!pendenteLivre(id),
    resolver,
    /** o Cheque especial aberto, mas sem nenhum dia negativo: dispensa e segue (Vitor, 02/10/2026) */
    dispensarSemCheque: () => {
      if (!etapa || etapa.id !== 'cheque-especial') return;
      for (const c of alvos) {
        const d = t.dispensar(exDe[c], etapa.id, 'sem-saldo-negativo', '', op.nome, new Date());
        repo.gravar(d.execucao, d.evento, exDe[c]);
      }
    },
    interrompendo, abrirInterromper: () => setInterrompendo(true), fecharInterromper: () => setInterrompendo(false), interromper,
    sair: etapaDelegada ? () => navegar(BASE + '/inicio?aba=minhas') : voltar,
    /** a etapa delegada em aberto: quem recebeu conclui a tarefa daqui mesmo (12/11/2026: a Clara não achava o Concluir) */
    podeConcluirDelegada: !!etapaDelegada && !!recebida && recebida.status !== 'concluida',
    concluirDelegada: async () => {
      if (!recebida) return;
      try {
        await repoDelegadas.salvar(recebida.id, { status: 'concluida' });
        toast('Tarefa concluída.');
        navegar(BASE + '/inicio?aba=minhas');
      } catch (e) { toast('Não concluí a tarefa: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** Os bancos sem movimento de cada mês (a ferramenta da etapa mostra a linha marcada no mês que estiver aberto). */
    semMovimentoPorMes: Object.fromEntries(meses.map(c => [c, exDe[c]?.semMovimento || []])) as Record<string, string[]>,
    marcarSemMovimento: (banco: string, marcado: boolean, mes?: string) => {
      const c = mes && exDe[mes] ? mes : competencia;
      if (!exDe[c] || !etapa || carregando) return;
      const m = t.marcarSemMovimento(exDe[c], etapa.id, banco, marcado, op.nome, new Date());
      repo.gravar(m.execucao, m.evento, exDe[c]);
    },
    /** o mês aberto faz parte de um período prometido: para onde levar */
    irParaPeriodo: !etapaDelegada && periodoDoMes && empresa ? comDep(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), periodoDoMes)) : null,
    /** todos os meses do período estão concluídos (só aí dá para encerrar) */
    periodoConcluido: concluido,
    /** a etapa na tela já foi concluída em todos os meses (a Importação: as empresas que já saíram dela seguem com os razões) */
    vistaConcluida: !!vista && concluidaNoPeriodo(vista.id),
    /** Encerra os vários meses (só com todos concluídos): tira a promessa de cada mês e volta ao último mês. */
    encerrarPeriodo: () => {
      if (!varios || !empresa) return;
      // proibido cancelar depois de passar da Importação (Vitor, 02/10/2026); com tudo concluído, o lote só se encerra
      if (!concluido && etapa && etapa.id !== 'extratos') { toast('O Em lote só pode ser cancelado na Importação.'); return; }
      if (!concluido && !CANCELAR_LOTE_A_QUALQUER_HORA) { toast('Para cancelar a função, os ' + meses.length + ' meses precisam estar 100% concluídos.'); return; }
      for (const c of meses) {
        if (!exDe[c]?.periodo) continue;
        const p = t.definirPeriodo(exDe[c], null, op.nome, new Date());
        repo.gravar(p.execucao, p.evento, exDe[c]);
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
          repo.gravar(p.execucao, p.evento, exDe[m]);
        }
      }
      navegar(comDep(caminhoDoExecutor(empresas.rotaDaEmpresa(empresa), c)));
    },
    /**
     * O razão do caixa importado: o Creditor entra nos meses do período com liquidação de cobrança no caixa
     * (CRÉD.LIQ.COBRANÇA) e sai dos outros, se ainda não foi feito (Vitor, 05/10/2026). Devolve os meses em que entrou.
     */
    ajustarPeloBalancete,
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
          repo.gravar(a.execucao, a.evento, exc);
          entrou.push(c);
        } else if (!tem && esta && !t.estadoDa(exc, 'creditor') && credLiquidacao !== true) {
          const r = t.retirarEtapa(exc, 'creditor', 'o razão do caixa não tem CRÉD.LIQ.COBRANÇA', op.nome, new Date());
          repo.gravar(r.execucao, r.evento, exc);
        }
      }
      return entrou;
    },
    // com o ?dep= (a rotina de outro setor), como as outras saídas do executor (31/10/2026: abria a página na rotina da pessoa)
    abrirEmpresa: () => { if (empresa) navegar(comDep(caminhoDaEmpresa(empresas.rotaDaEmpresa(empresa), ultimo))); },
  };
}
