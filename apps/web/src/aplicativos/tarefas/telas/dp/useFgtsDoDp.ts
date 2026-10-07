// ViewModel de DP › FGTS Digital (07/10/2026: "tenho que baixar FGTS toda vez pelo site do governo manualmente… daria
// pra mandar a vm fazer isso?"): os clientes do DP com folha no mês (o movimento Folha), o CNPJ (do cadastro do Entregas), o último pedido
// de cada um ao robô e o estado do robô (o certificado do escritório). Pedir: um cliente (Ensaio ou Emitir) ou todos os
// que faltam. A guia pronta baixa o PDF; os passos do robô (o que ele viu em cada tela) abrem numa janela.
import { tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { competenciasDaTela } from '../../casca/navegacao';
import { useFgts, useGmailDoEntregas } from '../../dados/repo';
import type { ModoFgts, PedidoFgts } from '../../dados/fgts';
import { useClientesDoDp } from './useClientesDoDp';

export type SituacaoFgts = 'sem-cnpj' | 'nada' | 'fila' | 'trabalhando' | 'emitida' | 'ensaio-ok' | 'erro' | 'captcha';
export type FiltroFgts = 'todos' | 'faltam' | 'emitidas' | 'problemas';

export function situacaoDoPedido(p: PedidoFgts | undefined, temCnpj: boolean): SituacaoFgts {
  if (!temCnpj) return 'sem-cnpj';
  if (!p) return 'nada';
  if (p.status === 'pendente') return 'fila';
  if (p.status === 'trabalhando') return 'trabalhando';
  if (p.status === 'captcha') return 'captcha';
  if (p.status === 'erro') return 'erro';
  if (p.status === 'pronto') return p.modo === 'emitir' ? 'emitida' : 'ensaio-ok';
  return 'nada';
}

export function useFgtsDoDp() {
  const repo = useFgts();
  const gmail = useGmailDoEntregas();
  const { toast } = useRetorno();
  const competencias = competenciasDaTela(12);
  const [competencia, setCompetencia] = useState(competencias[0]);
  const [filtro, setFiltro] = useState<FiltroFgts>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const doDp = useClientesDoDp(competencia);
  const robo = repo.robo();
  const { carregados, porCnpj } = repo.pedidos(competencia);
  const clientesDoEntregas = gmail.clientes();
  const cnpjDoCodigo = new Map(clientesDoEntregas.lista.filter(c => c.documento && c.documento.length === 14).map(c => [Number(c.codigo), c.documento as string]));

  const todas = doDp.clientes
    // só quem tem folha no mês (Vitor, 07/10/2026: "só apareça na emissão do FGTS empresas que tem folha"): o movimento do DP
    .filter(c => c.movimento === 'Folha')
    .map(c => {
      const cnpj = cnpjDoCodigo.get(c.codigo) || '';
      const pedido = cnpj ? porCnpj.get(cnpj) : undefined;
      return { codigo: c.codigo, nome: c.nomeNaTela, cnpj, pedido, situacao: situacaoDoPedido(pedido, !!cnpj) };
    })
    .sort((a, b) => a.codigo - b.codigo);
  const q = busca.trim().toLowerCase();
  const qDigitos = q.replace(/\D/g, '');
  const linhas = todas.filter(l => (!q || l.nome.toLowerCase().includes(q) || String(l.codigo).includes(q) || (!!qDigitos && l.cnpj.includes(qDigitos)))
    && (filtro === 'todos' || (filtro === 'emitidas' ? l.situacao === 'emitida' : filtro === 'problemas' ? ['erro', 'captcha', 'sem-cnpj'].includes(l.situacao) : !['emitida', 'sem-cnpj'].includes(l.situacao))));
  const faltam = todas.filter(l => l.cnpj && ['nada', 'erro', 'ensaio-ok'].includes(l.situacao));

  async function pedir(l: (typeof todas)[number], modo: ModoFgts) {
    if (!l.cnpj) return;
    await repo.pedir({ cnpj: l.cnpj, codigo: l.codigo, empresa: l.nome, competencia, modo });
  }

  return {
    exemplos: repo.exemplos,
    robo,
    carregando: !carregados || !clientesDoEntregas.carregados,
    competencia,
    competencias: competencias.map(c => ({ valor: c, rotulo: t.rotuloCompetencia(c) })),
    setCompetencia,
    filtro, setFiltro, busca, setBusca,
    contagem: {
      todos: todas.length,
      faltam: todas.filter(l => !['emitida', 'sem-cnpj'].includes(l.situacao)).length,
      emitidas: todas.filter(l => l.situacao === 'emitida').length,
      problemas: todas.filter(l => ['erro', 'captcha', 'sem-cnpj'].includes(l.situacao)).length,
    },
    linhas,
    faltam: faltam.length,
    pedindo,
    async pedir(codigo: number, modo: ModoFgts) {
      const l = todas.find(x => x.codigo === codigo);
      if (!l) return;
      try { await pedir(l, modo); } catch (e) { toast('Não deu: ' + (e instanceof Error ? e.message : String(e))); }
    },
    /** pede a guia de todos os que ainda não têm (nem estão na fila) */
    async emitirTodas() {
      if (pedindo || !faltam.length) return;
      setPedindo(true);
      try {
        for (const l of faltam) await pedir(l, 'emitir');
        toast(faltam.length + (faltam.length === 1 ? ' guia pedida' : ' guias pedidas') + ' ao robô.');
      } catch (e) { toast('Parou no meio: ' + (e instanceof Error ? e.message : String(e))); } finally { setPedindo(false); }
    },
    async baixar(p: PedidoFgts) {
      const a = await repo.pdf(p.id);
      if (!a) { toast('O PDF não está no pedido.'); return; }
      baixarBytes(Uint8Array.from(atob(a.base64), ch => ch.charCodeAt(0)), a.nome, 'application/pdf');
    },
    aberto: aberto ? todas.find(l => l.pedido?.id === aberto) || null : null,
    abrir: (id: string) => setAberto(id),
    fechar: () => setAberto(null),
    telas: repo.telas,
  };
}
