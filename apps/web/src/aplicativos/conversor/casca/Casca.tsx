// View da casca do Conversor: o aplicativo mais simples do nads (Vitor, 06/10/2026: "separada, extremamente simples,
// em um domínio avulso"). Sem empresa e sem barra lateral: o título e, embaixo, a linha das etapas (Segmentado) com o
// Cancelar e o Próximo à direita, como no Creditor.
import { Casca, Segmentado, useRetorno } from '@nads/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { caminhoDaEtapa } from './navegacao';
import { MSG_ETAPA_TRAVADA, useSessao } from './sessao';

export function CascaConversor({ children }: { children: ReactNode }) {
  const s = useSessao();
  const navegar = useNavigate();
  const { modal, toast } = useRetorno();
  const atual = s.etapas.find(x => x.id === s.etapa);

  async function cancelar() {
    const ok = await modal<boolean>({
      titulo: 'Cancelar a conversão?', texto: 'O extrato lido será descartado.',
      botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Cancelar a conversão', valor: true, variante: 'btn-primary' }],
    });
    if (ok) { s.recomecar(); toast('Conversão cancelada.'); }
  }

  const inicio = () => navegar(caminhoDaEtapa('arquivo'));
  return (
    <Casca sistema="Conversor" empresa={null} versao={VERSAO_SISTEMA} secoes={[]} paginas={[]} titulo={atual ? atual.titulo : ''}
      lateral="nenhuma" onSecao={() => {}} onPagina={() => {}} onInicio={inicio} onEmpresa={inicio}>
      <div className="tarefas-barra-topo">
        <Segmentado valor={s.etapa} onMudar={s.irPara}
          opcoes={s.etapas.map(e => ({ valor: e.id, rotulo: e.rotulo, travada: s.podeAbrir(e.id) ? false : MSG_ETAPA_TRAVADA }))} />
        <span className="tarefas-barra-espaco" />
        {s.estado.extrato && <button className="btn btn-outline" type="button" onClick={() => { void cancelar(); }}>Cancelar</button>}
        {s.temProxima && <button className="btn btn-primary" type="button" disabled={!s.podeSeguir} onClick={s.proxima}
          title={s.podeSeguir ? undefined : MSG_ETAPA_TRAVADA}>Próximo</button>}
      </div>
      {children}
    </Casca>
  );
}
