// ViewModel da etapa LCDPR (16/10/2026, o executor da 62: "ele só precisa do lcdpr"): a ferramenta LCDPR que já existia
// na página da empresa (telas/empresa/lcdpr), dentro da etapa. Lançamentos é a principal; Categorias, Regras de NCM, Plano
// de contas, Tabelas de apoio e Configuração ficam nas abas de cima, como as telas das outras etapas. A aba aberta fica no
// "onde parou" da etapa. O LCDPR não trava o Próximo: a pessoa confere, baixa a planilha e segue.
import type { lcdpr } from '@nads/core';
import { PAGINAS_DO_LCDPR } from '../../../../casca/navegacao';
import { useGuardado } from '../../../../../../comum/guardado';
import { useAbasDaEtapa, useChaveDaEtapa, useRequisitosDaEtapa } from '../contexto';

/** as listas de cada aba de cadastro (as Tabelas de apoio juntam quatro, como na página antiga) */
const LISTAS_DA_PAGINA: Record<string, readonly lcdpr.ListaDoLcdpr[]> = {
  categorias: ['categorias'],
  regras: ['ncmRules'],
  plano: ['planoContas'],
  tabelas: ['imoveis', 'ieDest', 'tipoDoc', 'tipoLanc'],
};

const PRINCIPAL = PAGINAS_DO_LCDPR[0].id;

export function useLcdprDaEtapa() {
  const [guardada, setPagina] = useGuardado<string>(useChaveDaEtapa('lcdpr') + '|tela', PRINCIPAL);
  const pagina = PAGINAS_DO_LCDPR.find(p => p.id === guardada) || PAGINAS_DO_LCDPR[0];
  useAbasDaEtapa(PAGINAS_DO_LCDPR.map(p => ({ id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === pagina.id })), setPagina);
  useRequisitosDaEtapa({ pronto: true, faltam: [] });
  return {
    pagina: pagina.id,
    titulo: pagina.titulo || 'LCDPR',
    /** a aba de cadastro aberta: as listas dela */
    listas: LISTAS_DA_PAGINA[pagina.id] || LISTAS_DA_PAGINA.categorias,
  };
}
