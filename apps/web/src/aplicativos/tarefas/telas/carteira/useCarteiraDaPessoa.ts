// Os ViewModels da Carteira (12/11/2026): o que cada tela mostra e faz, a partir do repositório (as telas não falam com
// ele). A lógica de conta é do core (carteira); aqui fica o estado da tela e as ações com o aviso de erro.
import { carteira, empresas, type financeiro } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import type { Decisao } from '../../dados/carteira';
import { empresasNovas } from '../../dados/fonte';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { useAcesso, useCarteira, useTesteDaCarteira, useTodosOsCadastros } from '../../dados/repo';
import { dataBr, hoje, isoDaData, valorDigitado, valorNoCampo } from '../financeiro/formatosDaNota';
import { abrirBytes, baixarDaCarteira, mensagem, useMes } from './comum';

/** as contas ligadas à pessoa (a consulta já é só dela) como os pagamentos da Carteira */
const pagamentosDe = (contas: readonly financeiro.ContaAPagar[]) => carteira.pagamentosDaCarteira(contas, contas[0]?.funcionario?.uid ?? '');

/** As comissões da pessoa, pelo mês do pagamento: abre no mês seguinte, onde entram as que ela registra (12/11/2026). */
export function useMinhasComissoes() {
  const repo = useCarteira();
  const m = useMes('comecar');
  const [aberta, setAberta] = useState<carteira.Comissao | null | 'nova'>(null);
  const todas = repo.minhasComissoes();
  const lista = todas.lista.filter(c => c.competencia === m.mes);
  return { m, exemplos: repo.exemplos, carregada: todas.carregada, erro: todas.erro, lista, totais: carteira.totaisDasComissoes(lista), aberta, setAberta };
}

/** O cliente do cadastro no menu da comissão (pelo código do ERP). */
export interface ClienteDaLista { codigo: number; nome: string }

/** Os clientes do escritório para o menu da comissão: a lista do escritório e as empresas cadastradas pelo nads (com código). */
function useClientesDoEscritorio(): ClienteDaLista[] {
  const cadastros = useTodosOsCadastros();
  return useMemo(() => {
    const porCodigo = new Map<number, string>();
    for (const e of [...empresas.EMPRESAS_COM_DP, ...empresasNovas()]) if (e.codigo != null && !porCodigo.has(e.codigo)) porCodigo.set(e.codigo, e.nome);
    return [...porCodigo].map(([codigo, nome]) => ({ codigo, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // as empresas novas vêm do cadastro: refaz quando ele muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastros]);
}

/**
 * A janela de registrar a comissão. Pela Carteira, o mês do pagamento é sempre o seguinte ao atual (Vitor, 12/11/2026);
 * pelo Financeiro (doFinanceiro), escolhe a pessoa e qualquer mês (a retroativa), e a comissão já entra aprovada.
 */
export function useJanelaDaComissao(comissao: carteira.Comissao | null, fechar: () => void, doFinanceiro = false) {
  const repo = useCarteira();
  const { toast, modal } = useRetorno();
  const equipe = useAcesso().equipe();
  const clientes = useClientesDoEscritorio();
  const servicos = repo.servicos();
  const porPessoa = repo.porPessoa();
  const agora = new Date();
  const [competencia, setCompetencia] = useState(comissao?.competencia ?? (doFinanceiro ? carteira.competenciaDe(agora) : carteira.mesDoPagamento(agora)));
  const [para, setPara] = useState<{ uid: string; nome: string } | null>(null);
  const [data, setData] = useState(dataBr(comissao?.data ?? hoje()));
  // a comissão de antes (sem o código do cliente) abre como avulsa
  const [avulso, setAvulso] = useState(!!comissao && comissao.clienteCodigo == null);
  const [clienteCodigo, setClienteCodigo] = useState<number | null>(comissao?.clienteCodigo ?? null);
  const [nomeAvulso, setNomeAvulso] = useState(comissao && comissao.clienteCodigo == null ? comissao.cliente : '');
  const [porte, setPorte] = useState<carteira.Porte | null>(comissao?.porte ?? null);
  const [servico, setServico] = useState(comissao?.servico ?? '');
  const [valorServico, setValorServico] = useState(valorNoCampo(comissao?.valorServico ?? 0));
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const travada = !!comissao && !carteira.podeEditar(comissao);
  // a %: a que ficou gravada na comissão já decidida; senão, a própria da pessoa (quando o Financeiro definiu) ou a de hoje
  // do serviço
  const uidDaComissao = doFinanceiro ? para?.uid ?? null : comissao?.uid ?? repo.meuUid();
  const propria = !travada && (porPessoa.lista.find(p => p.uid === uidDaComissao)?.percentual ?? 0) > 0;
  const percentual = travada ? comissao!.percentual ?? 0 : carteira.percentualDaComissao(servicos.lista, porPessoa.lista, uidDaComissao, servico);
  const vs = valorDigitado(valorServico);
  const cliente = avulso ? nomeAvulso : clientes.find(c => c.codigo === clienteCodigo)?.nome ?? comissao?.cliente ?? '';
  const pessoas = equipe.lista.filter(u => u.ativo).map(u => ({ uid: u.uid, nome: u.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    doFinanceiro, travada, salvando, erros,
    competencia, setCompetencia, mesesDoFinanceiro: [carteira.mesDoPagamento(agora), ...carteira.ultimosMeses(agora, 12)],
    pessoas, para, setPara,
    data, setData,
    clientes, avulso, clienteCodigo, cliente, nomeAvulso, setNomeAvulso, porte, setPorte,
    escolherCliente: (codigo: number) => { setAvulso(false); setClienteCodigo(codigo); },
    marcarAvulso: () => { setAvulso(true); setClienteCodigo(null); },
    servicos: servicos.lista, servico, setServico, percentual, propria,
    valorServico, setValorServico,
    /** a comissão que vai sair (valor do serviço × %) */
    valor: travada ? comissao!.valor : vs > 0 && percentual > 0 ? carteira.valorDaComissao(vs, percentual) : 0,
    async salvar() {
      if (travada) return;
      const c: carteira.ComissaoParaSalvar = {
        competencia, data: isoDaData(data), cliente: cliente.trim(), clienteCodigo: avulso ? null : clienteCodigo, porte: avulso ? porte : null,
        servico, valorServico: vs, percentual,
      };
      const problemas = [...(doFinanceiro && !para ? ['Escolha a pessoa.'] : []), ...carteira.conferirComissao(c)];
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try {
        if (doFinanceiro) { await repo.registrarComissaoDe(para!, c); toast('Comissão registrada para ' + para!.nome + ', já aprovada.'); }
        else { await repo.salvarComissao(c, comissao?.id); toast(comissao ? 'Comissão alterada.' : 'Comissão registrada. O Financeiro vê e aprova.'); }
        fechar();
      } catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
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

/** A janela dos serviços comissionados (o Financeiro): os serviços, a % de cada um, acrescentar e tirar. */
export function useJanelaDosServicos(fechar: () => void) {
  const repo = useCarteira();
  const { toast } = useRetorno();
  const salvos = repo.servicos();
  const salvasPorPessoa = repo.porPessoa();
  const equipe = useAcesso().equipe();
  const [pessoas, setPessoas] = useState<{ uid: string; nome: string; percentual: string }[] | null>(null);
  const [lista, setLista] = useState<{ id: string; nome: string; percentual: string }[] | null>(null);
  const [novo, setNovo] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  // a lista que está na tela: a do banco até a pessoa mexer
  const atual = lista ?? salvos.lista.map(s => ({ id: s.id, nome: s.nome, percentual: s.percentual ? valorNoCampo(s.percentual) : '' }));
  const comoServicos = () => atual.map(s => ({ id: s.id, nome: s.nome, percentual: s.percentual.trim() ? valorDigitado(s.percentual) : 0 }));
  // a % própria por pessoa (12/11/2026): vale para todos os serviços dela
  const pessoasAtuais = pessoas ?? salvasPorPessoa.lista.map(p => ({ uid: p.uid, nome: p.nome, percentual: valorNoCampo(p.percentual) }));
  const comoPorPessoa = () => pessoasAtuais.map(p => ({ uid: p.uid, nome: p.nome, percentual: p.percentual.trim() ? valorDigitado(p.percentual) : 0 }));
  const semPropria = equipe.lista.filter(u => u.ativo && !pessoasAtuais.some(p => p.uid === u.uid)).map(u => ({ uid: u.uid, nome: u.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return {
    carregada: salvos.carregada, erro: salvos.erro, lista: atual, novo, setNovo, erros, salvando,
    pessoas: pessoasAtuais, semPropria,
    acrescentarPessoa: (p: { uid: string; nome: string }) => setPessoas([...pessoasAtuais, { ...p, percentual: '' }]),
    mudarPessoa: (uid: string, v: string) => setPessoas(pessoasAtuais.map(p => (p.uid === uid ? { ...p, percentual: v } : p))),
    tirarPessoa: (uid: string) => setPessoas(pessoasAtuais.filter(p => p.uid !== uid)),
    mudar: (id: string, campo: 'nome' | 'percentual', v: string) => setLista(atual.map(s => (s.id === id ? { ...s, [campo]: v } : s))),
    tirar: (id: string) => setLista(atual.filter(s => s.id !== id)),
    acrescentar() {
      if (!novo.trim()) return;
      const s = carteira.novoServico(comoServicos(), novo);
      setLista([...atual, { id: s.id, nome: s.nome, percentual: '' }]);
      setNovo('');
    },
    async salvar() {
      const l = comoServicos();
      const p = comoPorPessoa();
      const problemas = [...carteira.conferirServicos(l), ...carteira.conferirPorPessoa(p)];
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try { await repo.salvarServicos(l, p); toast('Serviços gravados.'); fechar(); }
      catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
      finally { setSalvando(false); }
    },
  };
}

/** Holerites e pagamentos (12/11/2026: os valores da Visão geral vieram para cá): o mês, os números e os últimos 6 meses. */
export function useHoleritesEPagamentos() {
  const repo = useCarteira();
  const { toast } = useRetorno();
  const m = useMes();
  const comissoes = repo.minhasComissoes(), docs = repo.meusDocumentos(), contas = repo.minhasContas();
  const pags = pagamentosDe(contas.lista);
  const hist = carteira.historico(m.meses.slice(0, 6), comissoes.lista, [], docs.lista);
  return {
    m, exemplos: repo.exemplos, carregando: !comissoes.carregada || !docs.carregada || !contas.carregada, erro: comissoes.erro || docs.erro || contas.erro,
    salario: carteira.salarioDoMes(docs.lista, m.mes),
    recebido: carteira.recebidoNoMes(pags, m.mes),
    totais: carteira.totaisDasComissoes(comissoes.lista.filter(c => c.competencia === m.mes)),
    hist, maior: Math.max(1, ...hist.map(h => h.salario + h.comissoes)),
    docs: docs.lista, docsCarregados: docs.carregada, pags, contasCarregadas: contas.carregada,
    abrirDocumento: (d: carteira.DocumentoDaCarteira) => void abrirBytes(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    baixarDocumento: (d: carteira.DocumentoDaCarteira) => void baixarDaCarteira(() => repo.bytesDoDocumento(d.id), d.arquivo, toast),
    abrirComprovante: (contaId: string, c: { id: string; nome: string }) => void abrirBytes(() => repo.bytesDoComprovante(contaId, c.id), c.nome, toast),
  };
}

export function useComissoesDaEquipe() {
  const repo = useCarteira();
  const { toast, modal } = useRetorno();
  const m = useMes('incluir');
  const [aberta, setAberta] = useState('');
  const [fazendo, setFazendo] = useState('');
  // as janelas do Financeiro: registrar a comissão de alguém (a retroativa) e os serviços comissionados com a %
  const [janela, setJanela] = useState<'' | 'registrar' | 'servicos'>('');
  const doMes = repo.comissoesDoMes(m.mes);
  const [dev] = useModoDesenvolvedor();
  return {
    m, exemplos: repo.exemplos, dev, teste: useTesteDaCarteira(), carregada: doMes.carregada, erro: doMes.erro, todas: doMes.lista,
    resumo: carteira.resumoParaPagar(doMes.lista), totais: carteira.totaisDasComissoes(doMes.lista),
    aberta, alternar: (uid: string) => setAberta(a => (a === uid ? '' : uid)), fazendo, janela, setJanela,
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
