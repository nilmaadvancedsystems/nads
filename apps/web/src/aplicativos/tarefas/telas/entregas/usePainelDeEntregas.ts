// ViewModel de Entregas › Painel (16/10/2026, a cópia fiel da aba Painel do entregas.html: "só copia o entregas e joga
// aqui no design n1"). As categorias de lá: Entregas (o painel da competência — a busca, a situação, Exportar PDF e
// Exportar planilha; a linha do cliente abre a página dele só para ler; o avulso abre a entrega — e "Sem entrega há
// tempo") e Números (as entregas por dia, o ranking da equipe com a meta do mês e o cartão do mapa com o anel de quantos
// clientes já receberam).
import { entregas, tarefas as t } from '@nads/core';
import { baixarBytes, useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { useJanelasDasEntregas } from './contextoDasJanelas';

type Linha = ReturnType<typeof entregas.linhasDoPainel>[number];
export type CategoriaDoPainel = 'entregas' | 'numeros';

export function usePainelDeEntregas() {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const { operador } = useOperador();
  const admin = !!operador?.admin || !!repo.quem()?.papeis.includes('admin');
  const [categoria, setCategoria] = useState<CategoriaDoPainel>('entregas');
  const [competencia, setCompetencia] = useState(entregas.competenciaAtual());
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<entregas.FiltroDoPainel>('com_entrega');
  const [mapaAberto, setMapaAberto] = useState(false);
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const clientes = repo.clientes();
  const naRota = repo.naRota();
  const doMes = repo.doMes(competencia);
  const avisar = (titulo: string, tom: 'ok' | 'erro' | 'info' = 'ok') => retorno.aviso({ tom, titulo });

  const linhas = useMemo(() => entregas.linhasDoPainel({ clientes: clientes.lista, pendentes: naRota.lista, doMes: doMes.lista, busca, filtro }),
    [clientes.lista, naRota.lista, doMes.lista, busca, filtro]);
  const daConta = useMemo(() => entregas.clientesDeEntrega(clientes.lista, naRota.lista), [clientes.lista, naRota.lista]);
  const numeros = entregas.numerosDoMes(daConta, doMes.lista);
  const ranking = entregas.rankingDaEquipe(doMes.lista);
  const meta = repo.metaPorPessoa();
  const porDia = entregas.entregasPorDia(doMes.lista);

  // "Sem entrega há tempo": os do Entregas sem entrega confirmada nas últimas 3 competências (guardado 12 h)
  const [comEntrega, setComEntrega] = useState<string[] | null>(null);
  useEffect(() => {
    if (!clientes.carregada) return;
    let vivo = true;
    repo.comEntregaRecente().then(ids => { if (vivo) setComEntrega(ids); }, () => undefined);
    return () => { vivo = false; };
  }, [clientes.carregada, repo]);
  const semEntrega = comEntrega ? entregas.clientesSemEntrega(clientes.lista, naRota.lista, new Set(comEntrega)) : [];

  return {
    exemplos: repo.exemplos,
    carregando: !doMes.carregada || !clientes.carregada,
    erro: doMes.erro || clientes.erro,
    categorias: [{ id: 'entregas' as const, rotulo: 'Entregas', icone: 'barChart' as const }, { id: 'numeros' as const, rotulo: 'Números', icone: 'painel' as const }],
    categoria, setCategoria,
    competencia, setCompetencia, busca, setBusca,
    filtros: entregas.FILTROS_DO_PAINEL, filtro, setFiltro,
    linhas: linhas.map(l => {
      const s = entregas.rotuloDaSituacao(l.situacao, l.entregas[0]);
      return { l, sub: entregas.subtituloDaLinhaDoPainel(l), rotulo: s.rotulo, tom: s.tom === 'bad' ? 'danger' : s.tom };
    }),
    abrir(l: Linha) {
      if (l.cliente) { janelas.abrir({ tipo: 'cliente', clienteId: l.cliente.id, consulta: true }); return; }
      const e = l.entregas[0];
      if (!e) return;
      if (e.status === 'confirmada' || e.status === 'falha') janelas.abrir({ tipo: 'entrega', entrega: e, nome: e.clienteNome, clienteId: null, voltar: null });
      else janelas.abrir({ tipo: 'parada', entrega: e });
    },
    exportarPdf: () => window.print(),
    exportarPlanilha() {
      if (!doMes.lista.length) { avisar('Nenhuma entrega para exportar nesta competência.', 'erro'); return; }
      const b = busca.trim().toLowerCase();
      const rows = b ? doMes.lista.filter(e => (e.clienteNome || '').toLowerCase().includes(b)) : doMes.lista;
      if (!rows.length) { avisar('Nenhuma entrega para exportar com esse filtro.', 'erro'); return; }
      baixarBytes(t.planilhaXlsx('Entregas', entregas.CABECALHO_DA_PLANILHA, entregas.linhasDaPlanilha(rows)), 'entregas-' + competencia + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      avisar('Planilha baixada.');
    },
    avisoDoLimite: doMes.carregada && doMes.lista.length >= 1500 ? 'Esta competência tem mais de 1500 entregas: o Painel pode não estar mostrando todas.' : '',
    semEntrega: semEntrega.length,
    verSemEntrega: () => janelas.abrir({ tipo: 'semEntrega', ids: semEntrega.map(c => c.id) }),
    // ---- Números ----
    porDia: porDia.map(d => ({ chave: d.dia, rotulo: d.dia.slice(8, 10), total: d.total, leitura: d.total + ' entrega(s) em ' + entregas.dataBr(d.dia) })),
    diaEscolhido, escolherDia: (d: string) => setDiaEscolhido(x => (x === d ? null : d)),
    ranking: ranking.map((r, i) => ({ ...r, posicao: i + 1, pct: entregas.pctDaMeta(r.total, meta), batida: meta > 0 && r.total >= meta })),
    meta: meta ? entregas.metaDaEquipe(ranking, meta) : null,
    podeDefinirMeta: admin,
    definirMeta: () => janelas.abrir({ tipo: 'meta' }),
    numeros,
    resumoDoMes: numeros.entregue + ' de ' + numeros.total + ' clientes já receberam em ' + entregas.rotuloDaCompetencia(competencia),
    mapaAberto, alternarMapa: () => setMapaAberto(v => !v),
    pontos: entregas.pontosDoMapa(doMes.lista).map(p => ({ ...p, link: 'https://maps.google.com/?q=' + p.lat + ',' + p.lng })),
    filtrarPeloAnel(id: string) { setFiltro(id === 'receberam' ? 'entregue' : 'sem_entrega'); setCategoria('entregas'); },
  };
}
