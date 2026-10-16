// O LCDPR como parte da página da empresa (16/10/2026: "coloque o lcdpr como parte da empresa 62 de carlos lucas apenas";
// "quero integrar no app o importador lcpr e o entregas, só que preciso que fique tudo no visual igual para não destoar do
// app"): a trilha "Minhas empresas / 62 · … / LCDPR" e a página escolhida na barra lateral — Lançamentos (importar e
// conferir), as listas da Classificação (Categorias, Regras de NCM, Plano de contas), as Tabelas de apoio e a Configuração.
import type { lcdpr } from '@nads/core';
import { Navigate } from 'react-router';
import { TrilhaDoTopo } from '../../../../../comum/topo';
import { BASE } from '../../../casca/navegacao';
import { CadastrosLcdpr } from './CadastrosLcdpr';
import { ConfiguracaoLcdpr } from './ConfiguracaoLcdpr';
import { LancamentosLcdpr } from './LancamentosLcdpr';
import { usePaginaDoLcdpr } from './usePaginaDoLcdpr';

/** as listas de cada página de cadastro (as Tabelas de apoio juntam quatro, como na página antiga) */
const LISTAS_DA_PAGINA: Record<string, readonly lcdpr.ListaDoLcdpr[]> = {
  categorias: ['categorias'],
  regras: ['ncmRules'],
  plano: ['planoContas'],
  tabelas: ['imoveis', 'ieDest', 'tipoDoc', 'tipoLanc'],
};

export function PaginaDoLcdpr({ rota, pagina }: { rota: string; pagina: string }) {
  const vm = usePaginaDoLcdpr(rota, pagina);
  if (!vm.empresa) return <Navigate to={BASE} replace />;
  if (!vm.pagina) return <Navigate to={vm.paginaInicial} replace />;
  return (
    <section className="lcdpr">
      <TrilhaDoTopo itens={[
        { rotulo: 'Minhas empresas', titulo: 'Voltar para Minhas empresas', onClick: vm.voltarParaALista },
        { rotulo: vm.empresa, titulo: 'Abrir a página da empresa', onClick: vm.abrirAEmpresa },
        { rotulo: 'LCDPR' },
      ]} />
      {vm.pagina === 'lancamentos' ? <LancamentosLcdpr />
        : vm.pagina === 'configuracao' ? <ConfiguracaoLcdpr />
          : <CadastrosLcdpr key={vm.pagina} listas={LISTAS_DA_PAGINA[vm.pagina] || ['categorias']} />}
    </section>
  );
}
