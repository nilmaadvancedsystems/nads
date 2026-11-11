// ViewModel da etapa LCDPR (16/10/2026, o executor da 62: "ele só precisa do lcdpr"): a ferramenta LCDPR que já existia
// na página da empresa (telas/empresa/lcdpr), dentro da etapa. Lançamentos é a principal; Categorias, Regras de NCM, Plano
// de contas, Tabelas de apoio e Configuração ficam nas abas de cima, como as telas das outras etapas. A aba aberta fica no
// "onde parou" da etapa. O LCDPR não trava o Próximo: a pessoa confere, baixa a planilha e segue.
// Mês a mês (11/11/2026): a etapa abre o mês da Tarefa; e dá para abrir vários meses juntos ("quero poder mexer em mais de
// um mes ao mesmo tempo"): o "Meses" marca e desmarca cada mês dos últimos 12 (e os atalhos: só o da Tarefa, os últimos 3,
// o ano até ele). A escolha fica no "onde parou"; os lançamentos de cada mês ficam guardados no mês dele.
import { formatos, lcdpr } from '@nads/core';
import { useEffect } from 'react';
import { PAGINAS_DO_LCDPR } from '../../../../casca/navegacao';
import { useGuardado } from '../../../../../../comum/guardado';
import { abrirMeses } from '../../../empresa/lcdpr/useSessaoDoLcdpr';
import { useAbasDaEtapa, useChaveDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

/** as listas de cada aba de cadastro (as Tabelas de apoio juntam quatro, como na página antiga) */
const LISTAS_DA_PAGINA: Record<string, readonly lcdpr.ListaDoLcdpr[]> = {
  categorias: ['categorias'],
  regras: ['ncmRules'],
  plano: ['planoContas'],
  tabelas: ['imoveis', 'ieDest', 'tipoDoc', 'tipoLanc'],
};

const PRINCIPAL = PAGINAS_DO_LCDPR[0].id;

export function useLcdprDaEtapa() {
  const etapa = useEtapaAberta();
  const chave = useChaveDaEtapa('lcdpr');
  const [guardada, setPagina] = useGuardado<string>(chave + '|tela', PRINCIPAL);
  const daTarefa = etapa.meses.length ? etapa.meses : [etapa.competencia];
  const ultimoDaTarefa = [...daTarefa].sort().slice(-1)[0] || etapa.competencia;
  // os meses para escolher: os 12 até o último da Tarefa (e os da Tarefa, se forem de antes)
  const opcoes = [...new Set([...lcdpr.mesesAte(ultimoDaTarefa, 12), ...daTarefa])].sort().reverse();
  const [guardados, setMeses] = useGuardado<string[]>(chave + '|meses', [etapa.competencia]);
  const abertos = (Array.isArray(guardados) ? guardados : []).filter(m => opcoes.includes(m));
  const meses = abertos.length ? [...abertos].sort() : [etapa.competencia];
  const chaveDosMeses = meses.join(',');
  useEffect(() => { abrirMeses(etapa.codigo, chaveDosMeses.split(','), etapa.nome); }, [etapa.codigo, etapa.nome, chaveDosMeses]);
  const pagina = PAGINAS_DO_LCDPR.find(p => p.id === guardada) || PAGINAS_DO_LCDPR[0];
  useAbasDaEtapa(PAGINAS_DO_LCDPR.map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina.id })), setPagina);
  useRequisitosDaEtapa({ pronto: true, faltam: [] });
  return {
    pagina: pagina.id,
    titulo: pagina.titulo || 'LCDPR',
    /** o botão "Meses": o que está aberto, cada mês para marcar e os atalhos */
    rotuloDosMeses: meses.length === 1 ? formatos.rot(meses[0]) : meses.length + ' meses: ' + meses.map(formatos.mesCurto).join(', '),
    opcoesDeMes: opcoes.map(m => ({ valor: m, rotulo: formatos.rot(m), marcado: meses.includes(m) })),
    alternarMes: (m: string) => setMeses(lcdpr.alternarMes(meses, m)),
    atalhos: [
      { rotulo: 'Só ' + formatos.rot(etapa.competencia), meses: [etapa.competencia] },
      { rotulo: 'Os últimos 3 meses', meses: lcdpr.mesesAte(ultimoDaTarefa, 3).reverse() },
      { rotulo: 'O ano de ' + ultimoDaTarefa.slice(0, 4) + ' até ' + formatos.mesCurto(ultimoDaTarefa), meses: lcdpr.mesesDoAno(ultimoDaTarefa) },
    ],
    abrirSo: (ms: string[]) => setMeses(ms),
    /** a aba de cadastro aberta: as listas dela */
    listas: LISTAS_DA_PAGINA[pagina.id] || LISTAS_DA_PAGINA.categorias,
  };
}
