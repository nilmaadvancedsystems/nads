// Os ViewModels dos Insumos (12/11/2026; 13/11/2026: "só vai ser, impressão, envelope, caixa... cliente registrado ou avulso...
// é um só, simples, que aparece no financeiro"): a lista do mês (a da pessoa; para o Diretor e o Financeiro, a de todos) e a
// janela de registrar, com o cliente do Cadastro (pela busca) ou avulso. A conta é do core (carteira).
import { carteira, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { podeVerOFinanceiro } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useAcesso, useInsumos as useRepoDosInsumos, useTodosOsCadastros } from '../../dados/repo';
import { dataBr, hoje, isoDaData, valorDigitado, valorNoCampo } from '../financeiro/formatosDaNota';
import { mensagem, useMes } from './comum';

export function useInsumos() {
  const repo = useRepoDosInsumos();
  const { operador } = useOperador();
  const m = useMes();
  // uma lista só, sem o Meus e o Da equipe (Vitor, 13/11/2026: "não tem meus e nem da equipe, é um só, simples, que aparece no
  // financeiro"): cada pessoa vê os dela; o Diretor (e o Dono) e quem tem o Financeiro, os de todos (a mesma conta da regra do
  // banco: podeNoFinanceiroNads), com a coluna da pessoa. A regra pede o login liberado, admin inclusive (o Financeiro, 09/11/2026);
  // na Carteira, sem ele, o Diretor vê só os dele, como os outros, e não o "Sem permissão no banco" (16/11/2026: "Corrigir insumos")
  const sessao = useAcesso().minhaSessao();
  const doFinanceiro = podeVerOFinanceiro(operador);
  const veTodos = doFinanceiro && sessao.liberada;
  const [aberto, setAberto] = useState<carteira.Insumo | null | 'novo'>(null);
  // a lista dos insumos e os preços do Financeiro (15/11/2026): quem é do Financeiro vê os valores e muda a lista
  const [configurando, setConfigurando] = useState(false);
  const tipos = repo.tipos();
  const fonte = veTodos ? repo.insumosDoMes(m.mes) : repo.meusInsumos();
  const lista = fonte.lista.filter(x => x.competencia === m.mes);
  return {
    m, exemplos: repo.exemplos, veTodos, configurando, setConfigurando,
    carregada: fonte.carregada && (!doFinanceiro || sessao.carregada), erro: fonte.erro, lista,
    /** do Financeiro, mas com o login ainda não liberado: só os dele aqui; os de todos no Financeiro › Insumos da equipe */
    semLiberacao: doFinanceiro && sessao.carregada && !sessao.liberada,
    totais: carteira.totaisDosInsumos(lista, tipos.lista),
    nomeDe: (x: carteira.Insumo) => carteira.rotuloDoInsumo(x, tipos.lista),
    valorDe: (x: carteira.Insumo) => carteira.valorDoInsumo(x),
    /** só os da própria pessoa abrem para mudar */
    podeAbrir: (x: carteira.Insumo) => x.uid === repo.meuUid(),
    aberto, setAberto,
  };
}

/** A busca do cliente (como no Novo ticket do Mandei): pelo código ou pelo nome, sem acento; até 40. */
function buscar<T extends { codigo: number | null; nome: string }>(lista: readonly T[], busca: string): T[] {
  const q = formatos.normalizarTexto(busca).trim();
  if (!q) return lista.slice(0, 40);
  const palavras = q.split(/\s+/);
  const peso = (e: T) => {
    const cod = String(e.codigo ?? '');
    const nome = formatos.normalizarTexto(e.nome);
    if (cod === q) return 0;
    if (/^\d+$/.test(q) && cod.startsWith(q)) return 1;
    if (nome.startsWith(q)) return 2;
    return palavras.every(p => nome.includes(p) || cod.includes(p)) ? 3 : -1;
  };
  return lista.map(e => ({ e, p: peso(e) })).filter(x => x.p >= 0).sort((a, b) => a.p - b.p).slice(0, 40).map(x => x.e);
}

export function useJanelaDoInsumo(insumo: carteira.Insumo | null, fechar: () => void) {
  const repo = useRepoDosInsumos();
  const tipos = repo.tipos().lista;
  const { toast, modal } = useRetorno();
  const cadastros = useTodosOsCadastros();
  const empresas = useMemo(() => [...cadastros.porId.values()].sort((a, b) => a.nome.localeCompare(b.nome)), [cadastros]);
  // o insumo: um da lista do Financeiro (o do registro, se ainda está nela; senão o primeiro)
  const [escolhido, setTipo] = useState<carteira.TipoDeInsumo>(insumo?.tipo ?? '');
  const tipo = tipos.some(t => t.id === escolhido) ? escolhido : tipos[0]?.id ?? '';
  const [data, setData] = useState(dataBr(insumo?.data ?? hoje()));
  const [cliente, setCliente] = useState<{ nome: string; codigo: number | null } | null>(insumo ? { nome: insumo.cliente, codigo: insumo.codigo } : null);
  const [busca, setBusca] = useState('');
  // o cliente avulso (13/11/2026: "ele tem que selecionar um cliente registrado ou avulso"): só o nome, sem o código
  const [avulso, setAvulso] = useState(!!insumo && insumo.codigo == null);
  const [nomeAvulso, setNomeAvulso] = useState(insumo && insumo.codigo == null ? insumo.cliente : '');
  const [quantidade, setQuantidade] = useState(insumo ? String(insumo.quantidade) : '');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  return {
    tipos: tipos.map(t => ({ valor: t.id, rotulo: t.nome })),
    tipo, setTipo, data, setData, quantidade, setQuantidade, erros, salvando, busca, setBusca, avulso, setAvulso, nomeAvulso, setNomeAvulso,
    /** o cliente escolhido, como aparece no botão ('' = nenhum) */
    cliente: cliente ? (cliente.codigo != null ? cliente.codigo + ' · ' : '') + cliente.nome : '',
    achadas: buscar(empresas, busca).map(e => ({ nome: e.nome, codigo: e.codigo })),
    escolherCliente: (c: { nome: string; codigo: number | null }) => { setCliente(c); setBusca(''); },
    async salvar() {
      const doCliente = avulso ? { nome: nomeAvulso.trim().toUpperCase(), codigo: null } : { nome: cliente?.nome ?? '', codigo: cliente?.codigo ?? null };
      const x: carteira.InsumoParaSalvar = { data: isoDaData(data), tipo, quantidade: carteira.quantidadeDigitada(quantidade), cliente: doCliente.nome, codigo: doCliente.codigo };
      const problemas = carteira.conferirInsumo(x, tipos);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try { await repo.salvarInsumo(x, insumo?.id); toast(insumo ? 'Registro alterado.' : 'Insumo registrado.'); fechar(); }
      catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
      finally { setSalvando(false); }
    },
    async apagar() {
      if (!insumo) return;
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar o registro?', texto: insumo.quantidade + ' · ' + carteira.rotuloDoInsumo(insumo, tipos) + ' · ' + insumo.cliente,
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      try { await repo.apagarInsumo(insumo.id); toast('Registro apagado.'); fechar(); } catch (e) { toast(mensagem(e, 'Não consegui apagar.')); }
    },
  };
}

/**
 * A lista dos insumos do Financeiro (15/11/2026: "o preço do insumo é o financeiro que decide, e quais insumos são"): o nome e o
 * preço de cada um; acrescentar, mudar e tirar. Mudar o preço não mexe no que já foi registrado (cada registro guarda o do dia).
 */
export function useJanelaDosInsumos(fechar: () => void) {
  const repo = useRepoDosInsumos();
  const { toast } = useRetorno();
  const salvos = repo.tipos();
  const [lista, setLista] = useState<{ id: string; nome: string; preco: string }[] | null>(null);
  const [novo, setNovo] = useState('');
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const atual = lista ?? salvos.lista.map(t => ({ id: t.id, nome: t.nome, preco: t.preco ? valorNoCampo(t.preco) : '' }));
  const comoTipos = (): carteira.TipoConfigurado[] => atual.map(t => ({ id: t.id, nome: t.nome, preco: t.preco.trim() ? valorDigitado(t.preco) : 0 }));
  return {
    carregada: salvos.carregada, erro: salvos.erro, lista: atual, novo, setNovo, erros, salvando,
    mudar: (id: string, campo: 'nome' | 'preco', v: string) => setLista(atual.map(t => (t.id === id ? { ...t, [campo]: v } : t))),
    tirar: (id: string) => setLista(atual.filter(t => t.id !== id)),
    acrescentar() {
      const nome = novo.trim();
      if (!nome) return;
      setLista([...atual, { id: carteira.idDoInsumo(nome, atual.map(t => t.id)), nome, preco: '' }]);
      setNovo('');
    },
    async salvar() {
      const x = comoTipos();
      const problemas = carteira.conferirTipos(x);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try { await repo.salvarTipos(x); toast('Insumos e preços gravados.'); fechar(); }
      catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
      finally { setSalvando(false); }
    },
  };
}
