// ViewModel de Entregas › Rota (16/10/2026, a entrega de documentos trazida do Entregas): as paradas que esperam a
// assinatura, na ordem da rota do Entregas (a que alguém pôs na mão, a ordem fixa do escritório, quem entrou primeiro), com
// a busca, o filtro de quem pôs na rota e o da região; subir e descer uma parada (grava o ordemRota, como o arrastar de
// lá); qual janela está aberta (a Nova entrega, ou a parada para confirmar).
import { entregas, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useEntregasDeDocumentos } from '../../dados/repo';

export interface LinhaDaRota {
  e: entregas.Entrega;
  posicao: number;
  competencia: string;
  documentos: string;
  total: string;
  regiao: string;
  aviso: string;
  /** quantas paradas da rota são no mesmo lugar (o mesmo cliente, ou o mesmo endereço) */
  juntas: number;
}

export function useRotaDeEntregas() {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const clientes = repo.clientes();
  const naRota = repo.naRota();
  const fixa = repo.rotaPadrao();
  const [busca, setBusca] = useState('');
  const [pessoa, setPessoa] = useState('');
  const [zonas, setZonas] = useState<string[]>([]);
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [movendo, setMovendo] = useState(false);

  const porId = useMemo(() => new Map(clientes.lista.map(c => [c.id, c])), [clientes.lista]);
  const ordenadas = useMemo(() => entregas.ordenarParadas(naRota.lista, fixa), [naRota.lista, fixa]);
  const pessoas = useMemo(() => [...new Set(ordenadas.map(e => e.entregadoPorNome || e.entregadoPor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [ordenadas]);
  const q = busca.trim();
  const visiveis = ordenadas.filter(e =>
    (!q || entregas.clienteCombina({ nome: e.clienteNome, codigoOrigem: '', documento: e.clienteId ? porId.get(e.clienteId)?.documento || '' : '' }, q))
    && (!pessoa || (e.entregadoPorNome || e.entregadoPor) === pessoa)
    && (!zonas.length || zonas.includes(e.zona)));
  const porParada = new Map<string, number>();
  for (const e of ordenadas) { const k = entregas.chaveDaParada(e, porId); porParada.set(k, (porParada.get(k) || 0) + 1); }
  const paradas = new Set(visiveis.map(e => entregas.chaveDaParada(e, porId))).size;

  const linhas: LinhaDaRota[] = visiveis.map((e, i) => {
    const total = entregas.totalDosItens(e.itens);
    return {
      e, posicao: i + 1,
      competencia: t.rotuloCompetencia(e.competencia || '2026-01'),
      documentos: entregas.textoDosItens(e.itens) || '—',
      total: total > 0 ? formatos.reais(total) : '',
      regiao: entregas.rotuloDaZona(e.zona),
      aviso: entregas.avisoDaParada(e),
      juntas: porParada.get(entregas.chaveDaParada(e, porId)) || 1,
    };
  });

  return {
    carregando: !naRota.carregada || !clientes.carregada,
    erro: naRota.erro || clientes.erro,
    exemplos: repo.exemplos,
    linhas,
    quantas: ordenadas.length,
    paradas,
    filtrando: !!(q || pessoa || zonas.length),
    busca, setBusca,
    pessoas, pessoa, setPessoa,
    zonasDaRota: entregas.ZONAS,
    zonas,
    rotuloDasZonas: !zonas.length ? 'Região' : zonas.length === 1 ? entregas.rotuloDaZona(zonas[0]) : zonas.length + ' regiões',
    alternarZona: (z: string) => setZonas(l => (l.includes(z) ? l.filter(x => x !== z) : [...l, z])),
    limparZonas: () => setZonas([]),
    nova, setNova, aberta, setAberta,
    movendo,
    /** sobe (-1) ou desce (+1) a parada na lista que está na tela, e grava a ordem nova de todas elas */
    async mover(id: string, passo: -1 | 1) {
      const ids = entregas.moverNaRota(visiveis.map(e => e.id), id, passo);
      setMovendo(true);
      try {
        await repo.reordenar(ids);
      } catch (e) {
        retorno.aviso({ tom: 'erro', titulo: 'Não consegui mudar a ordem', texto: (e as Error).message });
      } finally {
        setMovendo(false);
      }
    },
  };
}
