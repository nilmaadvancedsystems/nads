// A rotina do Contábil das empresas com o LCDPR (16/10/2026, o executor da 62 com a Importação, o Cheque especial, a
// Conferência fiscal e a Folha: "ele só precisa do lcdpr"): uma etapa só, o LCDPR — importar os relatórios do SIEG,
// conferir a classificação e baixar a planilha. Quem tem o LCDPR: lcdpr/empresas (EMPRESAS_COM_LCDPR); quem escolhe a
// rotina: rotinaDaEmpresa (rotinaDo.ts).
import type { Rotina } from '../tipos';

export const ROTINA_LCDPR: Rotina = {
  departamento: 'contabil',
  etapas: [
    {
      id: 'lcdpr',
      secao: 'LCDPR',
      nome: 'LCDPR',
      descricao: 'Importe os relatórios do SIEG, confira a classificação dos lançamentos e baixe a planilha do LCDPR.',
      ferramenta: null,
      // a ferramenta LCDPR (a da página da empresa) dentro da etapa: Lançamentos e as listas nas abas de cima
      tela: { id: 'lcdpr', periodo: true },
      verificacao: 'manual',
      objecoes: [
        { id: 'sem-relatorios', texto: 'Os relatórios do SIEG não chegaram', soMotivo: true, solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Baixe no SIEG o Relatório de Detalhamento de Produtos e o de CT-e da competência e importe em Lançamentos.' } },
        { id: 'sem-movimento', texto: 'O produtor não teve movimento no mês', solucao: { tipo: 'nao-se-aplica', rotulo: 'Sem movimento' } },
      ],
    },
  ],
};
