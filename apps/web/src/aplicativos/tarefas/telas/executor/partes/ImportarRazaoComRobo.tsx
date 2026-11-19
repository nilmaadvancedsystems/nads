// O ⬆ do razão com o botão Vitor (Vitor, 19/11/2026: "onde esta escrito razao coloca o botao vitor"; "mas so para vitor"): para o
// dono do robô de PC, o menu com "Importar do computador" e o robô puxando o razão da conta no período; para os outros, o ⬆ de
// sempre (o filho). Sem o código da conta (sem o dinâmico), também o de sempre.
import { Icone } from '@nads/ui';
import { useState, type ReactNode } from 'react';
import { ComRoboDoRazao, MenuDeImportar } from '../../../etapas/extrator/telas/tarefa/BotaoVitorDoRazao';
import { usePeriodoDaTarefa } from '../etapas/contexto';

export interface RoboDoRazaoDaTela { empresa: string; codigo: number | null; conta: string; meses: readonly string[]; /** só para o dono do robô de PC (o hook decide) */ informar?: (codigo: string) => void }

/**
 * Sem a conta (Vitor, 19/11/2026: "sempre que o nads ver que nao tem a conta, pede para informar e grave na etapa"): o campo
 * pequeno com o código e o ✓; grava no Cadastro da empresa e o botão Vitor aparece. Só para o dono do robô de PC.
 */
function InformarConta({ informar, titulo }: { informar: (codigo: string) => void; titulo: string }) {
  const [v, setV] = useState('');
  const ok = /^\d{2,10}$/.test(v.trim());
  return (
    <span className="razao-informar" title={'O nads não achou a conta de ' + titulo + ': informe o código (fica gravado na empresa) para o robô puxar o razão'}>
      <input type="text" inputMode="numeric" placeholder="Conta" aria-label={'O código da conta de ' + titulo} value={v}
        onChange={e => setV(e.target.value.replace(/\D/g, '').slice(0, 10))} onKeyDown={e => { if (e.key === 'Enter' && ok) informar(v.trim()); }} />
      <button type="button" className="icon-btn icon-btn-sm" disabled={!ok} onClick={() => informar(v.trim())} aria-label="Gravar a conta" title="Gravar a conta na empresa"><Icone nome="check" /></button>
    </span>
  );
}

export function ImportarRazaoComRobo({ robo: roboDaTela, titulo, aceitar = '.xls,.xlsx,.ods', importar, travado = false, children }: {
  robo: RoboDoRazaoDaTela | null; titulo: string; aceitar?: string; importar: (f: File) => unknown; travado?: boolean; children: ReactNode;
}) {
  // sempre o período da Tarefa lá em cima (Vitor, 19/11/2026: "respeite o periodo! 01 ao 09 la em cima"); a etapa só sabe os meses que
  // faltam nela (o Adiantamento salarial mandava 07 a 09)
  const daTarefa = usePeriodoDaTarefa();
  const robo = roboDaTela && daTarefa ? { ...roboDaTela, meses: daTarefa } : roboDaTela;
  if (!robo || !robo.codigo || !robo.meses.length) return <>{children}</>;
  if (!robo.conta) return <>{robo.informar && <InformarConta informar={robo.informar} titulo={titulo.replace(/^o razão (de |do |da )?/, '')} />}{children}</>;
  return (
    <ComRoboDoRazao codigo={robo.codigo} empresa={robo.empresa} conta={robo.conta} meses={robo.meses} importar={importar}>
      {r => (r ? <MenuDeImportar titulo={titulo + ' (' + robo.conta + ')'} aceitar={aceitar} travado={travado} robo={r} onArquivos={fs => { if (fs[0]) void importar(fs[0]); }} /> : children)}
    </ComRoboDoRazao>
  );
}
