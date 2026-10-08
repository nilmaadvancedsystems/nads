// ViewModel da etapa Bens da Tarefa (Vitor, 07/10/2026): as notas de entrada de bem do ativo imobilizado (1551, 2551
// e os CFOPs ligados), as saídas que baixam bem e o uso e consumo com item de bem, das notas importadas na Conferência,
// no período da tarefa. Só olhar: nada é gravado. O ⚡ do modo desenvolvedor põe notas de teste só nesta tela.
// A verificação só roda no clique do Verificar (Vitor, 07/10/2026: abrir a etapa travava enquanto olhava os CFOPs), com a
// barra do topo e o botão girando por 2,7 segundos (Vitor, 08/10/2026).
import { demo, formatos, tarefas } from '@nads/core';
import { useCarregando, useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useNotasDaConferencia } from '../../../../../concilia-ai/importadosNaEtapa';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

type Linha = tarefas.NotaDeBem;

/** o tempo da verificação: o botão gira e a barra anda isso depois do clique (Vitor, 08/10/2026: 2,7 s) */
const TEMPO_DA_VERIFICACAO = 2700;

export function useBens() {
  const s = useEtapaAberta();
  const { aviso } = useRetorno();
  const lidas = useNotasDaConferencia(s.nome);
  const [teste, setTeste] = useState<ReturnType<typeof tarefas.notasDeBensDeTeste> | null>(null);
  const meses = s.meses.length ? s.meses : [s.competencia];

  useDadosDeTesteDaEtapa(s.dev || demo.ehEmpresaDemo(s.nome) ? [{ id: 'bens', rotulo: 'Notas de bens de teste' }] : [], () => {
    setTeste(tarefas.notasDeBensDeTeste(meses));
    aviso({ tom: 'ok', titulo: 'Notas de bens de teste', texto: 'Só nesta tela: nada vai para o banco.' });
  });

  const fonte = teste || lidas;
  // as listas, não o objeto: o useNotasDaConferencia devolve um objeto novo a cada desenho, e o efeito de baixo zerava o
  // clique do Verificar na hora (Vitor, 08/10/2026: "não funciona")
  const ent = fonte?.entradas, sai = fonte?.saidas, carregou = !!fonte;
  const chave = meses.join(',');
  // o clique do Verificar: a hora em que começou; o resultado, quando a conta e os 3 segundos acabam
  const [desde, setDesde] = useState<number | null>(null);
  const [b, setB] = useState<ReturnType<typeof tarefas.bensDoPeriodo> | null>(null);
  // outras notas (as de teste, ou as da empresa de volta): verificar de novo
  useEffect(() => { setB(null); setDesde(null); }, [ent, sai, chave]);
  useEffect(() => {
    if (desde === null || !carregou) return;
    // a conta depois de a barra aparecer, para a tela não travar antes dela
    let fim: ReturnType<typeof setTimeout> | undefined;
    const conta = setTimeout(() => {
      const r = tarefas.bensDoPeriodo(ent || [], sai || [], chave.split(','));
      fim = setTimeout(() => { setB(r); setDesde(null); }, Math.max(0, TEMPO_DA_VERIFICACAO - (Date.now() - desde)));
    }, 50);
    return () => { clearTimeout(conta); clearTimeout(fim); };
  }, [desde, carregou, ent, sai, chave]);
  const verificando = desde !== null;
  useCarregando(verificando);
  const verificar = () => { if (!verificando) setDesde(Date.now()); };
  const entradas = fonte?.entradas || [];

  useRequisitosDaEtapa(b ? { pronto: true, faltam: [] } : { pronto: false, faltam: ['Verificar as notas de bem'] });

  const reais = formatos.reais;
  const linha = (n: Linha) => ({
    chave: n.chave, data: n.data, numero: n.numero, nome: n.nome, cfop: n.cfop, tipo: n.tipo, valor: reais(n.valor),
    ncms: n.ncms.join(', '), conta: n.conta, naoMexe: n.efeito === 'nao-mexe',
  });

  if (!b) return { verificado: false as const, verificando, verificar, deTeste: !!teste, tirarTeste: () => setTeste(null) };

  return {
    verificado: true as const,
    verificando,
    verificar,
    deTeste: !!teste,
    tirarTeste: () => setTeste(null),
    periodo: meses.length > 1 ? tarefas.rotuloNumericoCompetencia(meses[0]) + ' a ' + tarefas.rotuloNumericoCompetencia(meses[meses.length - 1]) : tarefas.rotuloNumericoCompetencia(meses[0]),
    entradas: b.entradas.map(linha),
    saidas: b.saidas.map(linha),
    // no uso e consumo, o selo "Não mexe no imobilizado" não cabe: a dúvida é se devia ter entrado
    usoEConsumo: b.usoEConsumo.map(n => ({ ...linha(n), naoMexe: false })),
    entram: reais(b.totais.entram),
    saem: reais(b.totais.saem),
    nenhuma: !b.entradas.length && !b.saidas.length && !b.usoEConsumo.length,
    /** o relatório de entradas trouxe o NCM? (sem ele, não dá para achar bem no uso e consumo) */
    temNcm: entradas.some(n => !!n.ncm),
  };
}
