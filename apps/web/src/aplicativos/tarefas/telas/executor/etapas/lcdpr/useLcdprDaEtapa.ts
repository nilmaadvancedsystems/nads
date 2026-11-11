// ViewModel da etapa LCDPR (16/10/2026, o executor da 62: "ele só precisa do lcdpr"): a ferramenta LCDPR que já existia
// na página da empresa (telas/empresa/lcdpr), dentro da etapa. Lançamentos é a principal; Categorias, Regras de NCM, Plano
// de contas, Tabelas de apoio e Configuração ficam nas abas de cima, como as telas das outras etapas. A aba aberta fica no
// "onde parou" da etapa. O LCDPR não trava o Próximo: a pessoa confere, baixa a planilha e segue.
// Mês a mês (11/11/2026): a etapa abre o mês da Tarefa (com vários meses no período, a pessoa escolhe qual, e a escolha
// fica no "onde parou"); os lançamentos de cada mês ficam guardados.
import { formatos, type lcdpr } from '@nads/core';
import { useEffect } from 'react';
import { PAGINAS_DO_LCDPR } from '../../../../casca/navegacao';
import { useGuardado } from '../../../../../../comum/guardado';
import { abrirMes } from '../../../empresa/lcdpr/useSessaoDoLcdpr';
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
  const meses = etapa.meses.length ? etapa.meses : [etapa.competencia];
  const [mesGuardado, setMes] = useGuardado<string>(chave + '|mes', etapa.competencia);
  const mes = meses.includes(mesGuardado) ? mesGuardado : meses.includes(etapa.competencia) ? etapa.competencia : meses[meses.length - 1];
  useEffect(() => { abrirMes(etapa.codigo, mes, etapa.nome); }, [etapa.codigo, etapa.nome, mes]);
  const pagina = PAGINAS_DO_LCDPR.find(p => p.id === guardada) || PAGINAS_DO_LCDPR[0];
  useAbasDaEtapa(PAGINAS_DO_LCDPR.map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina.id })), setPagina);
  useRequisitosDaEtapa({ pronto: true, faltam: [] });
  return {
    pagina: pagina.id,
    titulo: pagina.titulo || 'LCDPR',
    /** os meses da Tarefa (a escolha só aparece com mais de um) */
    meses: meses.length > 1 ? meses.map(m => ({ valor: m, rotulo: formatos.mesCurto(m) })) : [],
    mes,
    escolherMes: setMes,
    /** a aba de cadastro aberta: as listas dela */
    listas: LISTAS_DA_PAGINA[pagina.id] || LISTAS_DA_PAGINA.categorias,
  };
}
