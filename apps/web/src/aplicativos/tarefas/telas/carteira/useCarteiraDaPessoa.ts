// Os ViewModels da Carteira (12/11/2026): o que cada tela mostra e faz, a partir do repositório (as telas não falam com
// ele). A lógica de conta é do core (carteira); aqui fica o estado da tela e as ações com o aviso de erro.
import { carteira, type financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Decisao } from '../../dados/carteira';
import { useAcesso, useCarteira } from '../../dados/repo';
import { dataBr, hoje, isoDaData, valorDigitado, valorNoCampo } from '../financeiro/formatosDaNota';
import { abrirBytes, baixarDaCarteira, mensagem, useMes } from './comum';

/** as contas ligadas à pessoa (a consulta já é só dela) como os pagamentos da Carteira */
const pagamentosDe = (contas: readonly financeiro.ContaAPagar[]) => carteira.pagamentosDaCarteira(contas, contas[0]?.funcionario?.uid ?? '');

export function useVisaoDaCarteira() {
  const repo = useCarteira();
  const m = useMes();
  const comissoes = repo.minhasComissoes(), lancamentos = repo.meusLancamentos(), docs = repo.meusDocumentos(), contas = repo.minhasContas();
  const doMes = comissoes.lista.filter(c => c.competencia === m.mes);
  const hist = carteira.historico(m.meses.slice(0, 6), comissoes.lista, lancamentos.lista, docs.lista);
  return {
    m, exemplos: repo.exemplos,
    carregando: !comissoes.carregada || !lancamentos.carregada || !docs.carregada || !contas.carregada,
    erro: comissoes.erro || lancamentos.erro || docs.erro || contas.erro,
    salario: carteira.salarioDoMes(docs.lista, m.mes),
    recebido: carteira.recebidoNoMes(pagamentosDe(contas.lista), m.mes),
    totais: carteira.totaisDasComissoes(doMes),
    financas: carteira.resumoDasFinancas(lancamentos.lista, m.mes),
    hist, maior: Math.max(1, ...hist.map(h => h.salario + h.comissoes)),
    doMes,
  };
}

export function useMinhasComissoes() {
  const repo = useCarteira();
  const m = useMes();
  const [params, setParams] = useSearchParams();
  const [aberta, setAberta] = useState<carteira.Comissao | null | 'nova'>(null);
  // o "Registrar comissão" da Visão geral chega com ?nova=1
  useEffect(() => { if (params.get('nova')) { setAberta('nova'); setParams({}, { replace: true }); } }, [params, setParams]);
  const todas = repo.minhasComissoes();
  const lista = todas.lista.filter(c => c.competencia === m.mes);
  return { m, exemplos: repo.exemplos, carregada: todas.carregada, erro: todas.erro, lista, totais: carteira.totaisDasComissoes(lista), aberta, setAberta };
}

export function useJanelaDaComissao(comissao: carteira.Comissao | null, fechar: () => void) {
  const repo = useCarteira();
  const { toast, modal } = useRetorno();
  const meses = carteira.ultimosMeses(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), 6);
  const [competencia, setCompetencia] = useState(comissao?.competencia ?? carteira.competenciaDe(new Date()));
  const [data, setData] = useState(dataBr(comissao?.data ?? hoje()));
  const [cliente, setCliente] = useState(comissao?.cliente ?? '');
  const [descricao, setDescricao] = useState(comissao?.descricao ?? '');
  const [valor, setValor] = useState(valorNoCampo(comissao?.valor ?? 0));
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const travada = !!comissao && !carteira.podeEditar(comissao);
  return {
    competencia, setCompetencia, data, setData, cliente, setCliente, descricao, setDescricao, valor, setValor, erros, salvando, travada,
    meses: [...new Set([competencia, ...meses])].sort().reverse(),
    async salvar() {
      if (travada) return;
      const c = { competencia, data: isoDaData(data), cliente, descricao, valor: valorDigitado(valor) };
      const problemas = carteira.conferirComissao(c);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try { await repo.salvarComissao(c, comissao?.id); toast(comissao ? 'Comissão alterada.' : 'Comissão registrada. O Financeiro vê e aprova.'); fechar(); }
      catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
      finally { setSalvando(false); }
    },
    async apagar() {
      if (!comissao) return;
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar a comissão?', texto: comissao.cliente + ' · R$ ' + comissao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      try { await repo.apagarComissao(comissao.id); toast('Comissão apagada.'); fechar(); } catch (e) { toast(mensagem(e, 'Não consegui apagar.')); }
    },
  };
}

export function useFinancasPessoais() {
  const repo = useCarteira();
  const m = useMes();
  const [aberto, setAberto] = useState<carteira.Lancamento | null | 'novo'>(null);
  const todos = repo.meusLancamentos();
  return {
    m, exemplos: repo.exemplos, carregado: todos.carregada, erro: todos.erro, aberto, setAberto,
    lista: todos.lista.filter(l => l.data.slice(0, 7) === m.mes),
    resumo: carteira.resumoDasFinancas(todos.lista, m.mes),
  };
}

export function useJanelaDoLancamentoPessoal(lancamento: carteira.Lancamento | null, fechar: () => void) {
  const repo = useCarteira();
  const { toast } = useRetorno();
  const [tipo, setTipo] = useState<carteira.TipoDeLancamento>(lancamento?.tipo ?? 'saida');
  const [data, setData] = useState(dataBr(lancamento?.data ?? hoje()));
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? '');
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? 'Outros');
  const [valor, setValor] = useState(valorNoCampo(lancamento?.valor ?? 0));
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const categorias = carteira.CATEGORIAS[tipo];
  return {
    tipo, mudarTipo: (t: carteira.TipoDeLancamento) => { setTipo(t); setCategoria('Outros'); },
    data, setData, descricao, setDescricao, valor, setValor, erros, salvando, categorias,
    categoria: categorias.includes(categoria) ? categoria : 'Outros', setCategoria,
    async salvar() {
      const l = { tipo, data: isoDaData(data), descricao, categoria: categorias.includes(categoria) ? categoria : 'Outros', valor: valorDigitado(valor) };
      const problemas = carteira.conferirLancamento(l);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try { await repo.salvarLancamento(l, lancamento?.id); toast(lancamento ? 'Lançamento alterado.' : 'Lançado.'); fechar(); }
      catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
      finally { setSalvando(false); }
    },
    async apagar() {
      if (!lancamento) return;
      try { await repo.apagarLancamento(lancamento.id); toast('Lançamento apagado.'); fechar(); } catch (e) { toast(mensagem(e, 'Não consegui apagar.')); }
    },
  };
}

export function useHoleritesEPagamentos() {
  const repo = useCarteira();
  const { toast } = useRetorno();
  const docs = repo.meusDocumentos(), contas = repo.minhasContas();
  return {
    exemplos: repo.exemplos, carregando: !docs.carregada || !contas.carregada, erro: docs.erro || contas.erro,
    docs: docs.lista, docsCarregados: docs.carregada, pags: pagamentosDe(contas.lista), contasCarregadas: contas.carregada,
    abrirDocumento: (d: carteira.DocumentoDaCarteira) => void abrirBytes(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    baixarDocumento: (d: carteira.DocumentoDaCarteira) => void baixarDaCarteira(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    abrirComprovante: (contaId: string, c: { id: string; nome: string }) => void abrirBytes(() => repo.bytesDoComprovante(contaId, c.id), c.nome, toast),
  };
}

export function useComissoesDaEquipe() {
  const repo = useCarteira();
  const { toast, modal } = useRetorno();
  const m = useMes();
  const [aberta, setAberta] = useState('');
  const [fazendo, setFazendo] = useState('');
  const doMes = repo.comissoesDoMes(m.mes);
  return {
    m, exemplos: repo.exemplos, carregada: doMes.carregada, erro: doMes.erro, todas: doMes.lista,
    resumo: carteira.resumoParaPagar(doMes.lista), totais: carteira.totaisDasComissoes(doMes.lista),
    aberta, alternar: (uid: string) => setAberta(a => (a === uid ? '' : uid)), fazendo,
    /** aprovar, recusar (com o motivo), marcar como pago (confirma antes) ou voltar para lançada */
    async decidir(chave: string, ids: string[], situacao: Decisao, ok: string, pedirMotivo?: (guardar: (t: string) => void) => unknown) {
      if (!ids.length || fazendo) return;
      let motivo: string | undefined;
      if (situacao === 'recusada') {
        let digitado = '';
        const sim = await modal<boolean>({ icone: 'alert', titulo: 'Recusar a comissão?', texto: 'A pessoa vê o motivo na Carteira dela.',
          corpo: pedirMotivo?.(t => { digitado = t; }) as never,
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Recusar', valor: true, variante: 'btn-danger' }] });
        if (!sim) return;
        motivo = digitado;
      }
      if (situacao === 'paga') {
        const sim = await modal<boolean>({ icone: 'dinheiro', titulo: 'Marcar como pago?', texto: ids.length + (ids.length === 1 ? ' comissão aprovada passa' : ' comissões aprovadas passam') + ' para Paga. A pessoa vê na Carteira.',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Marcar como pago', valor: true, variante: 'btn-primary' }] });
        if (!sim) return;
      }
      setFazendo(chave);
      try { await repo.decidirComissoes(ids, situacao, motivo); toast(ok); } catch (e) { toast(mensagem(e, 'Não consegui gravar.')); } finally { setFazendo(''); }
    },
  };
}

export function useEnviarHolerites() {
  const repo = useCarteira();
  const equipe = useAcesso().equipe();
  const { toast, modal } = useRetorno();
  const m = useMes();
  const [enviando, setEnviando] = useState<{ uid: string; nome: string; tipo: carteira.TipoDeDocumento } | null>(null);
  const docs = repo.documentosDoMes(m.mes);
  const pessoas = equipe.lista.filter(u => u.ativo || docs.lista.some(d => d.uid === u.uid)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    m, exemplos: repo.exemplos, carregando: !docs.carregada || !equipe.carregada, erro: docs.erro, pessoas,
    comHolerite: pessoas.filter(u => docs.lista.some(d => d.uid === u.uid && d.tipo === 'holerite')).length,
    docsDe: (uid: string, tipo: carteira.TipoDeDocumento) => docs.lista.filter(d => d.uid === uid && d.tipo === tipo),
    enviando, setEnviando,
    abrir: (d: carteira.DocumentoDaCarteira) => void abrirBytes(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    async tirar(d: carteira.DocumentoDaCarteira) {
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Tirar este documento?', texto: d.arquivo + ' sai da Carteira de ' + d.nome + '.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      try { await repo.apagarDocumento(d.id); toast('Documento tirado.'); } catch (e) { toast(mensagem(e, 'Não consegui tirar.')); }
    },
  };
}

export function useJanelaDoDocumento(para: { uid: string; nome: string; tipo: carteira.TipoDeDocumento }, competencia: string, fechar: () => void) {
  const repo = useCarteira();
  const { toast } = useRetorno();
  const [arquivo, setArquivo] = useState<{ nome: string; bytes: Uint8Array } | null>(null);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  return {
    arquivo, tirarArquivo: () => setArquivo(null), valor, setValor, erro, enviando,
    async escolher(f: File | undefined) {
      if (!f) return;
      if (!f.size) { setErro('O arquivo está vazio.'); return; }
      if (f.size > carteira.LIMITE_DO_DOCUMENTO) { setErro('O arquivo passa de 10 MB.'); return; }
      setErro('');
      setArquivo({ nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
    },
    async enviar() {
      if (!arquivo) { setErro('Escolha o arquivo.'); return; }
      const v = valor.trim() ? valorDigitado(valor) : null;
      if (v != null && !(v > 0)) { setErro('Confira o valor (ou deixe em branco).'); return; }
      setEnviando(true);
      try { await repo.enviarDocumento({ ...para, competencia, valor: v }, arquivo); toast(carteira.rotuloDoDocumento(para.tipo) + ' enviado para ' + para.nome + '.'); fechar(); }
      catch (e) { setErro(mensagem(e, 'Não consegui enviar.')); }
      finally { setEnviando(false); }
    },
  };
}
