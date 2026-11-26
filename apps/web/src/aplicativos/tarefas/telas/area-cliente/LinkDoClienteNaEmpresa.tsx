// A Área do Cliente na janela da empresa do Cadastro (Vitor, 16/10/2026). Desde 26/11/2026 (o módulo Área do Cliente
// refeito: "quero que esse modulo seja completamente refeito… o mais bonito e de facil entendimento possivel") o link, as
// senhas, a logo e a atividade ficam juntos na Área do Cliente › Clientes; aqui fica só a situação e o atalho para lá.
import { Icone } from '@nads/ui';
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { Selo } from './base/Base';
import { useLinkDaEmpresa } from './useLinkDaEmpresa';

export function LinkDoClienteNaEmpresa({ codigo }: { codigo: number; nome: string }) {
  const vm = useLinkDaEmpresa(codigo);
  const navegar = useNavigate();
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icone nome="usuario" width={16} height={16} />Área do Cliente</h3></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {vm.carregando ? <span className="hint">Procurando o link…</span>
          : vm.link ? <Selo tom="ok">Com acesso desde {vm.data}</Selo> : <Selo tom="neutro">Sem acesso</Selo>}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-outline btn-sm" onClick={() => navegar(caminhoDaPagina('area-cliente', 'clientes') + '?empresa=' + codigo)}>
          Link, senhas e logo na Área do Cliente<Icone nome="chevronRight" width={15} height={15} />
        </button>
      </div>
    </section>
  );
}
