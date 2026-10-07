// A etapa Salários, INSS e FGTS como tela própria (Vitor, 07/10/2026): o título e, embaixo, as abas Salários / INSS / FGTS
// (o Segmentado, como em Clientes); cada aba mostra a parte dela. O mês devedor (ou a folha que não zerou) trava o Próximo.
import { tarefas } from '@nads/core';
import { Segmentado } from '@nads/ui';
import { useState } from 'react';
import { InssDaEtapa } from '../../partes/InssDaEtapa';
import { useSalarios } from './useSalarios';

const CONFERIR = tarefas.ROTINA_CONTABIL.etapas.find(e => e.id === 'folha')?.conferir;

type Aba = 'salarios' | 'inss' | 'fgts';
const ABAS: { valor: Aba; rotulo: string }[] = [{ valor: 'salarios', rotulo: 'Salários' }, { valor: 'inss', rotulo: 'INSS' }, { valor: 'fgts', rotulo: 'FGTS' }];

export function Salarios() {
  const vm = useSalarios();
  const [aba, setAba] = useState<Aba>('salarios');
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Salários, INSS e FGTS</h2></div></header>
      <div className="tarefas-barra-topo">
        <Segmentado<Aba> valor={aba} onMudar={setAba} opcoes={ABAS} />
      </div>
      <InssDaEtapa inss={vm.inss} conferir={CONFERIR} teste={vm.teste} folha={vm.folha} so={aba} />
    </section>
  );
}
