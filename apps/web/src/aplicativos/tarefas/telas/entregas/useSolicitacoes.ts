// ViewModel de Entregas › Solicitações (16/10/2026, a cópia fiel das Solicitações do Entregas: "cadê as solicitações").
// A janela de Solicitações de lá (nilma-solicitacoes.js, que substituiu a aba): Nova solicitação (o tipo; no atestado, a
// clínica, o funcionário e a empresa cliente buscada por nome, código ou CNPJ; o cliente ou local; a descrição; "Concluir
// até", que já vem com daqui a 2 dias; a prioridade), Pendentes (as urgentes num cartão, as outras pelo prazo; Atrasada;
// Concluir) e Concluídas (as últimas 30), com a busca no alto. O office boy vê e conclui a fila da equipe inteira; o resto,
// o que pediu.
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { textoDoErro } from './useJanelaDaParada';

type Solicitacao = ReturnType<typeof entregas.solicitacaoDoDocumento>;
type Cliente = ReturnType<typeof entregas.clienteDaRotaDoDocumento>;
export type TopicoDasSolicitacoes = 'nova' | 'pendentes' | 'concluidas';

const dataBr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '');
const dataIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };

export function useSolicitacoes() {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const quem = repo.quem();
  const papeis = quem?.papeis || [];
  const email = quem?.email || '';
  const pendentes = repo.solicitacoesPendentes();
  const [topico, setTopico] = useState<TopicoDasSolicitacoes>('pendentes');
  const [busca, setBusca] = useState('');
  const [concluidas, setConcluidas] = useState<{ lista: Solicitacao[]; erro: string } | null>(null);
  const [concluindo, setConcluindo] = useState<string[]>([]);
  const avisar = (titulo: string, tom: 'ok' | 'erro' = 'ok') => retorno.aviso({ tom, titulo });

  // as concluídas só são lidas ao abrir o tópico (e de novo depois de concluir uma)
  useEffect(() => {
    if (topico !== 'concluidas' || concluidas) return;
    let vivo = true;
    repo.solicitacoesConcluidas().then(l => { if (vivo) setConcluidas({ lista: l, erro: '' }); },
      err => { if (vivo) setConcluidas({ lista: [], erro: textoDoErro(err, 'Não foi possível carregar as concluídas.') }); });
    return () => { vivo = false; };
  }, [topico, concluidas, repo]);

  const filtradas = pendentes.lista.filter(s => entregas.solicitacaoCombina(s, busca));
  const fila = entregas.pendentesPeloPrazo(filtradas);
  const linha = (s: Solicitacao) => ({ s, ...entregas.linhaDaSolicitacao(s, email), podeConcluir: s.status !== 'concluida' && entregas.podeConcluirSolicitacao(s, papeis, email), concluindo: concluindo.includes(s.id) });

  // ---- a Nova solicitação ----
  const [tipo, setTipo] = useState<entregas.TipoDaSolicitacao>('entregar');
  const [clinica, setClinica] = useState('Assegi');
  const [funcionario, setFuncionario] = useState('');
  const [buscaEmpresa, setBuscaEmpresa] = useState('');
  const [empresa, setEmpresa] = useState<Cliente | null>(null);
  const [listaEmpresa, setListaEmpresa] = useState(false);
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState(dataBr(entregas.prazoPadraoDaSolicitacao()));
  const [urgente, setUrgente] = useState(false);
  const [erro, setErro] = useState<{ texto: string; campo: string }>({ texto: '', campo: '' });
  const [enviando, setEnviando] = useState(false);
  const clientes = repo.clientes().lista;
  const achadas = useMemo(() => {
    const q = buscaEmpresa.trim();
    return q && !empresa ? clientes.filter(c => c.ativo && entregas.clienteCombina(c, q)).slice(0, 8) : [];
  }, [buscaEmpresa, empresa, clientes]);
  const limparErro = () => setErro({ texto: '', campo: '' });

  return {
    exemplos: repo.exemplos,
    carregando: !pendentes.carregada,
    topico, setTopico,
    topicos: [
      { id: 'nova' as const, rotulo: 'Nova solicitação', icone: 'plus' as const, n: 0, urgente: false },
      { id: 'pendentes' as const, rotulo: 'Pendentes', icone: 'clock' as const, n: pendentes.lista.length, urgente: pendentes.lista.some(s => s.urgente) },
      { id: 'concluidas' as const, rotulo: 'Concluídas', icone: 'checkCircle' as const, n: 0, urgente: false },
    ],
    busca,
    setBusca(v: string) {
      setBusca(v);
      if (!v.trim()) return;
      // vai pro tópico que tem o que foi buscado (como a busca de lá)
      const naFila = pendentes.lista.some(s => entregas.solicitacaoCombina(s, v));
      const nasFeitas = !!concluidas?.lista.some(s => entregas.solicitacaoCombina(s, v));
      if (topico === 'nova') setTopico('pendentes');
      if (topico === 'pendentes' && !naFila && nasFeitas) setTopico('concluidas');
      else if (topico === 'concluidas' && !nasFeitas && naFila) setTopico('pendentes');
    },
    subPendentes: entregas.veTodasAsSolicitacoes(papeis) ? 'Pedidos da equipe que ainda não foram feitos.' : 'O que você pediu e ainda não foi feito.',
    subConcluidas: entregas.veTodasAsSolicitacoes(papeis) ? 'As últimas feitas pela equipe.' : 'As últimas que você pediu e já foram feitas.',
    erroDaLista: pendentes.erro,
    urgentes: fila.urgentes.map(linha),
    outras: fila.outras.map(linha),
    nenhumaPendente: !pendentes.lista.length,
    concluidas: concluidas ? concluidas.lista.filter(s => entregas.solicitacaoCombina(s, busca)).map(linha) : null,
    erroConcluidas: concluidas?.erro || '',
    async concluir(id: string) {
      setConcluindo(c => [...c, id]);
      try { await repo.concluirSolicitacao(id); avisar('Solicitação concluída.'); setConcluidas(null); } catch (err) {
        avisar(textoDoErro(err, 'Não foi possível concluir.'), 'erro');
      }
      setConcluindo(c => c.filter(x => x !== id));
    },
    // ---- a Nova solicitação ----
    tipos: entregas.TIPOS_DE_SOLICITACAO, clinicas: entregas.CLINICAS,
    tipo, setTipo: (v: entregas.TipoDaSolicitacao) => { setTipo(v); limparErro(); },
    clinica, setClinica,
    funcionario, setFuncionario: (v: string) => { setFuncionario(v); limparErro(); },
    buscaEmpresa, achadas: achadas.map(c => ({ c, nome: entregas.rotuloDoCliente(c), doc: c.documento })), listaEmpresa: listaEmpresa && achadas.length > 0,
    digitarEmpresa(v: string) { setBuscaEmpresa(v); setEmpresa(null); setListaEmpresa(true); void repo.garantirTodosOsClientes(); },
    abrirListaEmpresa() { setListaEmpresa(true); void repo.garantirTodosOsClientes(); },
    fecharListaEmpresa: () => setListaEmpresa(false),
    escolherEmpresa(c: Cliente) { setEmpresa(c); setBuscaEmpresa(entregas.rotuloDoCliente(c)); setListaEmpresa(false); limparErro(); },
    local, setLocal,
    descricao, setDescricao: (v: string) => { setDescricao(v); limparErro(); },
    prazo, setPrazo: (v: string) => { setPrazo(v); limparErro(); },
    urgente, setUrgente,
    erro, enviando,
    async enviar() {
      if (enviando) return;
      const n: entregas.SolicitacaoNova = { tipo, local, descricao, clinica, funcionario, empresa, prazo: dataIso(prazo), urgente };
      const f = entregas.faltaNaSolicitacao(n);
      setErro(f);
      if (f.texto) return;
      setEnviando(true);
      try {
        const r = await repo.enviarSolicitacao(n);
        avisar(r === 'aparelho' ? 'Solicitação salva; vai subir quando a internet voltar.' : 'Solicitação enviada.');
        setTipo('entregar'); setFuncionario(''); setEmpresa(null); setBuscaEmpresa(''); setLocal(''); setDescricao('');
        setPrazo(dataBr(entregas.prazoPadraoDaSolicitacao())); setUrgente(false);
        setTopico('pendentes');
      } catch (err) {
        setErro({ texto: textoDoErro(err, 'Não foi possível enviar.'), campo: '' });
      }
      setEnviando(false);
    },
  };
}
