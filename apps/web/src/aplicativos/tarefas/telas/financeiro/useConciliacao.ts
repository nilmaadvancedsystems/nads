// ViewModel de Financeiro › Conciliação (22/10/2026, o item 7 da lista do Painel: "importar o extrato do banco e conferir
// com o Caixa"): o extrato escolhido (PDF, OFX, planilha ou foto) é lido pelo Extrator (extrator.lerArquivo) e conferido
// com os lançamentos do Caixa do mesmo período (extrator.conferir, com 3 dias de folga na data), ao vivo: o que se lança
// no Caixa daqui já sai das pendências. O arquivo não é guardado; só se lê.
import { extrator, financeiro, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useCaixa } from '../../dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);

export type FiltroDaConciliacao = 'pendentes' | 'todas';
export const FILTROS_DA_CONCILIACAO: { valor: FiltroDaConciliacao; rotulo: string }[] = [
  { valor: 'pendentes', rotulo: 'Pendências' }, { valor: 'todas', rotulo: 'Todas' },
];
const ROTULOS: Record<extrator.Situacao, { rotulo: string; tom: string }> = {
  ok: { rotulo: 'Conferido', tom: 'ok' },
  faltando: { rotulo: 'Falta no Caixa', tom: 'bad' },
  amais: { rotulo: 'Só no Caixa', tom: 'warn' },
  diferente: { rotulo: 'Diferente', tom: 'warn' },
  duplicado: { rotulo: 'Duplicado', tom: 'warn' },
};

export function useConciliacao() {
  const repo = useCaixa();
  const lanc = repo.lancamentos();
  const { toast } = useRetorno();
  const operador = useOperador().operador?.nome || '';
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [lendo, setLendo] = useState(false);
  const [lido, setLido] = useState<{ nome: string; lancamentos: extrator.LancamentoDoArquivo[]; erro: string | null } | null>(null);
  const [filtro, setFiltro] = useState<FiltroDaConciliacao>('pendentes');
  const [lancando, setLancando] = useState<string | null>(null);

  async function escolher(f: File | null) {
    setArquivo(f);
    setLido(null);
    if (!f) return;
    setLendo(true);
    try {
      const r = await extrator.lerArquivo(f.name, new Uint8Array(await f.arrayBuffer()), 'banco');
      setLido({ nome: f.name, erro: r.erro, lancamentos: r.lancamentos.map((l, i) => ({ ...l, id: 'extrato:' + i, idArquivo: 'extrato', lado: 'banco' as const })) });
    } catch (e) {
      setLido({ nome: f.name, lancamentos: [], erro: 'Não consegui ler o arquivo: ' + (e instanceof Error ? e.message : String(e)) });
    } finally { setLendo(false); }
  }

  // o período é o do extrato (da primeira à última data); o Caixa entra só nesse período
  const periodo = useMemo(() => {
    const datas = (lido?.lancamentos ?? []).map(l => l.data).sort();
    return datas.length ? { de: datas[0], ate: datas[datas.length - 1] } : null;
  }, [lido]);
  const conf = useMemo(() => (lido && periodo && lido.lancamentos.length
    ? extrator.conferir(lido.lancamentos, financeiro.caixaParaConferir(lanc.lista, periodo.de, periodo.ate))
    : null), [lido, periodo, lanc.lista]);
  const linhas = (conf?.linhas ?? []).filter(l => filtro === 'todas' || l.situacao !== 'ok');
  const pendentes = conf ? conf.linhas.length - conf.contagem.ok : 0;

  return {
    carregando: !lanc.carregada,
    exemplos: repo.exemplos,
    arquivo, escolher, lendo,
    erro: lido?.erro || '',
    periodo: periodo ? { de: extrator.dataBR(periodo.de), ate: extrator.dataBR(periodo.ate) } : null,
    numeros: conf ? { extrato: lido?.lancamentos.length ?? 0, conferidos: conf.contagem.ok, faltando: conf.contagem.faltando, amais: conf.contagem.amais, outros: conf.contagem.diferente + conf.contagem.duplicado, pendentes } : null,
    filtro, setFiltro, filtros: FILTROS_DA_CONCILIACAO,
    linhas: linhas.map((l, i) => {
      const x = l.extrato ?? l.sistema;
      return {
        chave: (l.extrato?.id ?? '') + '|' + (l.sistema?.id ?? '') + '|' + i,
        data: extrator.dataBR(l.data),
        historico: l.extrato?.historico || l.sistema?.historico || '',
        noExtrato: l.extrato ? formatos.reais(l.extrato.valor / 100) : '—',
        noCaixa: l.sistema ? formatos.reais(l.sistema.valor / 100) : '—',
        entrada: (x?.valor ?? 0) > 0,
        situacao: ROTULOS[l.situacao],
        motivo: l.motivo,
        /** o que falta no Caixa pode ser lançado daqui */
        lancar: l.situacao === 'faltando' && l.extrato ? l.extrato : null,
      };
    }),
    lancando,
    /** lança no Caixa o que está no extrato e falta no Caixa (a data, o histórico e o valor do extrato) */
    async lancar(l: extrator.LancamentoDoArquivo) {
      setLancando(l.id);
      try {
        await repo.salvarLancamento({ data: l.data, descricao: l.historico || 'Lançado pela conciliação', valor: Math.abs(l.valor) / 100, tipo: l.valor > 0 ? 'E' : 'S', observacoes: 'Lançado pela conciliação com o extrato' }, operador);
        toast('Lançado no Caixa.');
      } catch (e) { toast('Não consegui lançar: ' + (e instanceof Error ? e.message : String(e))); }
      finally { setLancando(null); }
    },
  };
}
