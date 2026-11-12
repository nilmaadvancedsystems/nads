// A etapa LCDPR (16/10/2026: a 62 "só precisa do lcdpr"): a mesma ferramenta LCDPR de antes (telas/empresa/lcdpr), sem
// duplicar nada — a aba de cima escolhe a tela: Lançamentos (importar e conferir), as listas da Classificação, as Tabelas
// de apoio e a Configuração. No topo, o "Meses": os meses abertos juntos (11/11/2026).
import { MenuSuspenso } from '@nads/ui';
import { CadastrosLcdpr } from '../../../empresa/lcdpr/CadastrosLcdpr';
import { ConfiguracaoLcdpr } from '../../../empresa/lcdpr/ConfiguracaoLcdpr';
import { LancamentosLcdpr } from '../../../empresa/lcdpr/LancamentosLcdpr';
import { useLcdprDaEtapa } from './useLcdprDaEtapa';

export function LcdprDaEtapa() {
  const vm = useLcdprDaEtapa();
  return (
    <section>
      <header className="topbar">
        <div><h2 className="page-title">{vm.titulo}</h2></div>
        <MenuSuspenso rotulo={vm.rotuloDosMeses} titulo="Os meses abertos (marque mais de um para mexer neles juntos)" className="btn btn-outline" direita largura={300}
          itens={[
            ...vm.atalhos.map(a => ({ rotulo: a.rotulo, icone: 'calendar' as const, onClick: () => vm.abrirSo(a.meses) })),
            'separador' as const,
            ...vm.opcoesDeMes.map(m => ({ rotulo: m.rotulo, marcado: m.marcado, onClick: () => vm.alternarMes(m.valor) })),
          ]} />
      </header>
      {vm.pagina === 'lancamentos' ? <LancamentosLcdpr />
        : vm.pagina === 'configuracao' ? <ConfiguracaoLcdpr />
          : <CadastrosLcdpr key={vm.pagina} listas={vm.listas} />}
    </section>
  );
}
