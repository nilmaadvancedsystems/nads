// ViewModel da etapa Bens da Tarefa (Vitor, 07/10/2026): as notas de entrada de bem do ativo imobilizado (1551, 2551
// e os CFOPs ligados), as saídas que baixam bem e o uso e consumo com item de bem, das notas importadas na Conferência,
// no período da tarefa. Só olhar: nada é gravado. O ⚡ do modo desenvolvedor põe notas de teste só nesta tela.
import { demo, formatos, tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useNotasDaConferencia } from '../../../../../concilia-ai/importadosNaEtapa';
import { useDadosDeTesteDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

type Linha = tarefas.NotaDeBem;

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
  const chave = meses.join(',');
  const b = useMemo(() => tarefas.bensDoPeriodo(fonte?.entradas || [], fonte?.saidas || [], chave.split(',')), [fonte, chave]);
  const entradas = fonte?.entradas || [];

  useRequisitosDaEtapa(lidas || teste ? { pronto: true, faltam: [] } : { pronto: false, faltam: ['Carregando as notas da Conferência'] });

  const reais = formatos.reais;
  const linha = (n: Linha) => ({
    chave: n.chave, data: n.data, numero: n.numero, nome: n.nome, cfop: n.cfop, tipo: n.tipo, valor: reais(n.valor),
    ncms: n.ncms.join(', '), conta: n.conta, naoMexe: n.efeito === 'nao-mexe',
  });

  return {
    carregado: !!lidas || !!teste,
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
