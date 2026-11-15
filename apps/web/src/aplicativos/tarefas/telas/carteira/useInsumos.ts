// Os ViewModels dos Insumos (12/11/2026; 13/11/2026: "só vai ser, impressão, envelope, caixa... cliente registrado ou avulso...
// é um só, simples, que aparece no financeiro"): a lista do mês (a da pessoa; para o Diretor e o Financeiro, a de todos) e a
// janela de registrar, com o cliente do Cadastro (pela busca) ou avulso. A conta é do core (carteira).
import { carteira, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { podeVerOFinanceiro } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useInsumos as useRepoDosInsumos, useTodosOsCadastros } from '../../dados/repo';
import { dataBr, hoje, isoDaData } from '../financeiro/formatosDaNota';
import { mensagem, useMes } from './comum';

export function useInsumos() {
  const repo = useRepoDosInsumos();
  const { operador } = useOperador();
  const m = useMes();
  // uma lista só, sem o Meus e o Da equipe (Vitor, 13/11/2026: "não tem meus e nem da equipe, é um só, simples, que aparece no
  // financeiro"): cada pessoa vê os dela; o Diretor (e o Dono) e quem tem o Financeiro, os de todos (a mesma conta da regra do
  // banco: podeNoFinanceiroNads), com a coluna da pessoa
  const veTodos = podeVerOFinanceiro(operador);
  const [aberto, setAberto] = useState<carteira.Insumo | null | 'novo'>(null);
  const fonte = veTodos ? repo.insumosDoMes(m.mes) : repo.meusInsumos();
  const lista = fonte.lista.filter(x => x.competencia === m.mes);
  return {
    m, exemplos: repo.exemplos, veTodos,
    carregada: fonte.carregada, erro: fonte.erro, lista,
    totais: carteira.totaisDosInsumos(lista),
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
  const { toast, modal } = useRetorno();
  const cadastros = useTodosOsCadastros();
  const empresas = useMemo(() => [...cadastros.porId.values()].sort((a, b) => a.nome.localeCompare(b.nome)), [cadastros]);
  const [tipo, setTipo] = useState<carteira.TipoDeInsumo>(insumo && carteira.ehTipoRegistravel(insumo.tipo) ? insumo.tipo : 'impressao');
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
    tipo, setTipo, data, setData, quantidade, setQuantidade, erros, salvando, busca, setBusca, avulso, setAvulso, nomeAvulso, setNomeAvulso,
    /** o cliente escolhido, como aparece no botão ('' = nenhum) */
    cliente: cliente ? (cliente.codigo != null ? cliente.codigo + ' · ' : '') + cliente.nome : '',
    achadas: buscar(empresas, busca).map(e => ({ nome: e.nome, codigo: e.codigo })),
    escolherCliente: (c: { nome: string; codigo: number | null }) => { setCliente(c); setBusca(''); },
    async salvar() {
      const doCliente = avulso ? { nome: nomeAvulso.trim().toUpperCase(), codigo: null } : { nome: cliente?.nome ?? '', codigo: cliente?.codigo ?? null };
      const x: carteira.InsumoParaSalvar = { data: isoDaData(data), tipo, quantidade: carteira.quantidadeDigitada(quantidade), cliente: doCliente.nome, codigo: doCliente.codigo };
      const problemas = carteira.conferirInsumo(x);
      setErros(problemas);
      if (problemas.length) return;
      setSalvando(true);
      try { await repo.salvarInsumo(x, insumo?.id); toast(insumo ? 'Registro alterado.' : 'Insumo registrado.'); fechar(); }
      catch (e) { setErros([mensagem(e, 'Não consegui gravar.')]); }
      finally { setSalvando(false); }
    },
    async apagar() {
      if (!insumo) return;
      const ok = await modal<boolean>({ icone: 'alert', titulo: 'Apagar o registro?', texto: insumo.quantidade + ' · ' + carteira.rotuloDoInsumo(insumo.tipo) + ' · ' + insumo.cliente,
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-danger' }] });
      if (!ok) return;
      try { await repo.apagarInsumo(insumo.id); toast('Registro apagado.'); fechar(); } catch (e) { toast(mensagem(e, 'Não consegui apagar.')); }
    },
  };
}
