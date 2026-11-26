// ViewModel da seção Solicitações da Área do Cliente refeita (26/11/2026: "quero que esse modulo seja completamente refeito
// para suportar e gerenciar de maneira mais simples e coerente a area do cliente como está hoje, preciso que seja o mais
// bonito e de facil entendimento possivel"). O que a tela antiga (useChamadosDoCliente) fazia — filtro, busca, situação,
// passos do DP, nota do mês, responder e responder e concluir — e o anexo na resposta ("tem que ter a opcao de subir um
// arquivo por aqui" / "nao tem como eu enviar um arquivo via area do cliente por aqui"): o arquivo vai pelo Drive para
// Documentos › Do escritório e a resposta ganha a linha do arquivo. Sem chat: o cliente conversa pelo WhatsApp.
import { areaCliente as ac } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SITUACOES_DO_CHAMADO, type ChamadoNaEquipe } from '../../../dados/areaCliente';
import { useAreaCliente } from '../../../dados/repo';
import {
  FILTROS_DA_SITUACAO, FILTROS_DO_TIPO, areaDoAnexo, contagemPorSituacao, estrelas, filtrarSolicitacoes, filtroInicial,
  passosDaSolicitacao, rotuloDoTipo, textoDaResposta, type FiltroDaSituacao, type FiltroDoTipo,
} from '../../../dados/solicitacoesDaArea';
import { mensagemDoErro } from '../base/comum';
import { useEnviarAoCliente } from '../base/useEnviarAoCliente';
import { useEmpresasDaPessoa } from '../base/useEmpresasDaPessoa';

export function useSolicitacoes() {
  const repo = useAreaCliente();
  const { toast } = useRetorno();
  const envio = useEnviarAoCliente();
  // só as empresas da pessoa (26/11/2026: "a pessoa vai ver apenas as empresas dela")
  const daPessoa = useEmpresasDaPessoa();
  const doBanco = repo.chamados();
  const todos = useMemo(() => ({ ...doBanco, carregada: doBanco.carregada && daPessoa.carregada, lista: doBanco.lista.filter(c => daPessoa.podeAlguma(c.codigos)) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doBanco, daPessoa.carregada, daPessoa.filtra, daPessoa.empresas]);

  // o filtro começa em "Abertas" se houver alguma (senão "Todas"); enquanto a pessoa não escolhe, segue a lista
  const [escolhido, setEscolhido] = useState<FiltroDaSituacao | null>(null);
  const [tipo, setTipo] = useState<FiltroDoTipo>('todos');
  const [busca, setBusca] = useState('');
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [resposta, setResposta] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);
  const [areaEscolhida, setAreaEscolhida] = useState<ac.AreaDoEscritorio | null>(null);
  const [enviando, setEnviando] = useState(false);

  const filtro = escolhido ?? filtroInicial(todos.lista);
  const linhas = useMemo(() => filtrarSolicitacoes(todos.lista, { situacao: filtro, tipo, busca }), [todos.lista, filtro, tipo, busca]);
  const conta = useMemo(() => contagemPorSituacao(todos.lista, { tipo, busca }), [todos.lista, tipo, busca]);
  const aberto: ChamadoNaEquipe | null = abertoId ? todos.lista.find(c => c.id === abertoId) ?? null : null;
  const area = areaEscolhida ?? (aberto ? areaDoAnexo(aberto.tipo) : 'societario');

  // o Hoje leva para ?abrir=<id do chamado> (26/11/2026): abre o painel uma vez, tira o parâmetro do endereço e, se a
  // solicitação não cabe no filtro atual, passa para "Todas"
  const [params, setParams] = useSearchParams();
  const pedidoParaAbrir = params.get('abrir');
  useEffect(() => {
    if (!pedidoParaAbrir || !todos.carregada) return;
    const c = todos.lista.find(x => x.id === pedidoParaAbrir);
    if (c) {
      if (!filtrarSolicitacoes([c], { situacao: filtro, tipo, busca }).length) { setEscolhido('todas'); setTipo('todos'); setBusca(''); }
      setAbertoId(c.id); setResposta(''); setAnexo(null); setAreaEscolhida(null);
    }
    setParams(p => { const n = new URLSearchParams(p); n.delete('abrir'); return n; }, { replace: true });
  }, [pedidoParaAbrir, todos.carregada, todos.lista, filtro, tipo, busca, setParams]);

  function limparResposta() { setResposta(''); setAnexo(null); setAreaEscolhida(null); envio.limpar(); }

  return {
    exemplos: repo.exemplos,
    carregando: !todos.carregada,
    erro: todos.erro,
    total: todos.lista.length,
    linhas,
    filtro, setFiltro: (f: FiltroDaSituacao) => setEscolhido(f),
    filtros: FILTROS_DA_SITUACAO.map(f => ({ valor: f.valor, rotulo: f.rotulo, conta: conta[f.valor] })),
    tipo, setTipo, tipos: FILTROS_DO_TIPO,
    busca, setBusca,
    /** filtros que escondem linhas (para o vazio dizer "nada neste filtro" e oferecer limpar) */
    temFiltro: filtro !== 'todas' || tipo !== 'todos' || !!busca.trim(),
    limparFiltros() { setEscolhido('todas'); setTipo('todos'); setBusca(''); },
    // a nota do mês pelas avaliações dos clientes (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento; frase do dono: "Seguir")
    notaDoMes: ac.mediaDasAvaliacoes(todos.lista.flatMap(c => (c.avaliacao ? [c.avaliacao] : [])), new Date().toISOString().slice(0, 7)),
    rotuloDaNota: (n: number) => ac.ROTULO_DA_NOTA[n] ?? '',
    estrelas,
    rotuloDoTipo,
    rotuloDaSituacao: (s: ac.SituacaoDoChamado) => ac.ROTULO_DA_SITUACAO_DO_CHAMADO[s],
    situacoes: SITUACOES_DO_CHAMADO,

    aberto,
    abrir(id: string) { if (enviando) return; setAbertoId(id); limparResposta(); },
    fechar() { if (enviando) return; setAbertoId(null); limparResposta(); },

    resposta, setResposta,
    anexo, area, areas: ac.AREAS_DO_ESCRITORIO,
    setArea: (a: ac.AreaDoEscritorio) => setAreaEscolhida(a),
    /** o arquivo escolhido no "Anexar arquivo" (confere o tamanho e a extensão já aqui) */
    escolherAnexo(f: File | null) {
      envio.limpar();
      if (!f) { setAnexo(null); return; }
      const erro = ac.erroDoEnvioAoCliente({ nome: f.name, tamanho: f.size });
      if (erro) { toast(erro); return; }
      setAnexo(f);
    },
    tirarAnexo() { setAnexo(null); envio.limpar(); },
    andamento: envio.andamento,
    enviando,
    podeResponder: !enviando && (!!resposta.trim() || !!anexo),

    /**
     * Responde; concluir = já fecha a solicitação (11/11/2026: sem chat, a resposta costuma encerrar o pedido). Com anexo,
     * primeiro sobe o arquivo e espera o robô gravar no Drive; só então grava a resposta com a linha do arquivo.
     */
    async responder(concluir = false) {
      const c = aberto;
      if (!c || enviando || (!resposta.trim() && !anexo)) return;
      const previa = textoDaResposta(resposta, anexo ? anexo.name : null);
      if (previa.length > ac.MAIOR_TEXTO_DO_CHAMADO) { toast('A resposta passa de ' + ac.MAIOR_TEXTO_DO_CHAMADO + ' caracteres.'); return; }
      const codigo = c.codigos[0];
      if (anexo && codigo == null) { toast('Esta solicitação não tem o código da empresa; não dá para anexar o arquivo.'); return; }
      setEnviando(true);
      try {
        let nomeFinal: string | null = null;
        if (anexo && codigo != null) nomeFinal = (await envio.enviar(anexo, { codigo, nome: c.empresa }, area)).nomeFinal;
        await repo.responder(c.id, textoDaResposta(resposta, nomeFinal));
        if (concluir) await repo.mudarSituacao(c.id, 'concluido');
        setResposta(''); setAnexo(null); setAreaEscolhida(null);
        toast((concluir ? 'Respondida e concluída.' : 'Resposta enviada ao cliente.') + (nomeFinal ? ' O arquivo aparece para o cliente em até 30 min.' : ''));
      }
      catch (e) { toast('Não deu para responder: ' + mensagemDoErro(e)); }
      finally { setEnviando(false); }
    },

    /** os passos do pedido do DP (23/11/2026, ficha processos-visiveis): o cliente vê só o último marcado */
    passosDe: passosDaSolicitacao,
    async marcarPasso(id: string, passo: string, marcar: boolean) {
      try { await repo.marcarPasso(id, passo, marcar); toast(marcar ? 'Passo marcado: ' + passo + '. O cliente vê este passo.' : 'Passo desmarcado.'); }
      catch (e) { toast('Não deu para marcar o passo: ' + mensagemDoErro(e)); }
    },
    async mudarSituacao(id: string, situacao: ac.SituacaoDoChamado) {
      try { await repo.mudarSituacao(id, situacao); toast('Solicitação: ' + ac.ROTULO_DA_SITUACAO_DO_CHAMADO[situacao].toLowerCase() + '.'); }
      catch (e) { toast('Não deu para mudar a situação: ' + mensagemDoErro(e)); }
    },
  };
}
