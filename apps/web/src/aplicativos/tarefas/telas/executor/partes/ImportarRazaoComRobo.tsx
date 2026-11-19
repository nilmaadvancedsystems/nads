// O ⬆ do razão com o botão Vitor (Vitor, 19/11/2026: "onde esta escrito razao coloca o botao vitor"; "mas so para vitor"): para o
// dono do robô de PC, o menu com "Importar do computador" e o robô puxando o razão da conta no período; para os outros, o ⬆ de
// sempre (o filho). Sem o código da conta (sem o dinâmico), também o de sempre.
import type { ReactNode } from 'react';
import { ComRoboDoRazao, MenuDeImportar } from '../../../etapas/extrator/telas/tarefa/BotaoVitorDoRazao';

export interface RoboDoRazaoDaTela { empresa: string; codigo: number | null; conta: string; meses: readonly string[] }

export function ImportarRazaoComRobo({ robo, titulo, aceitar = '.xls,.xlsx,.ods', importar, travado = false, children }: {
  robo: RoboDoRazaoDaTela | null; titulo: string; aceitar?: string; importar: (f: File) => unknown; travado?: boolean; children: ReactNode;
}) {
  if (!robo || !robo.codigo || !robo.conta || !robo.meses.length) return <>{children}</>;
  return (
    <ComRoboDoRazao codigo={robo.codigo} empresa={robo.empresa} conta={robo.conta} meses={robo.meses} importar={importar}>
      {r => (r ? <MenuDeImportar titulo={titulo + ' (' + robo.conta + ')'} aceitar={aceitar} travado={travado} robo={r} onArquivos={fs => { if (fs[0]) void importar(fs[0]); }} /> : children)}
    </ComRoboDoRazao>
  );
}
