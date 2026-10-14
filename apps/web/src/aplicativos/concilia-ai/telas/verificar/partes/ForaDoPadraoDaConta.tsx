// Verificar por conta, na tela de subir o relatório: o "Lançamento fora do padrão" só das notas dessa conta
// (Vitor, 14/10/2026: "acoplar no verificar por conta, o fluxo vai ficar melhor"). As mesmas peças do Relatório.
import { GrupoFiscal } from '../../relatorio/partes/ForaDoPadraoFiscal';
import { GrupoServ } from '../../relatorio/partes/Servicos';
import type { useVerificarConta } from '../useVerificarConta';

type Vm = ReturnType<typeof useVerificarConta>;

const ROTULO = { entradas: 'Entradas', saidas: 'Saídas', tomados: 'Tomados', prestados: 'Prestados' } as const;
const CORRIGIDOS = { marginTop: 16, fontWeight: 600, color: 'var(--ink)' } as const;

export function ForaDoPadraoDaConta({ vm }: { vm: Vm }) {
  const f = vm.foraDoPadrao;
  if (!f.fiscais.length && !f.servicos.length) return null;
  // mais de um tipo (a conta com entradas e tomados…): o nome do tipo em cima de cada um
  const titulo = f.fiscais.length + f.servicos.length > 1;
  return (
    <div className="card" id="vcForaDoPadrao">
      <div className="card-head"><h3>Lançamento fora do padrão</h3></div>
      {f.fiscais.map(({ tipo, r }) => (
        <div key={tipo}>
          {titulo && <p className="hint" style={{ fontWeight: 600, color: 'var(--ink)' }}>{ROTULO[tipo]}</p>}
          {r.pendentes.length
            ? r.pendentes.map(g => <GrupoFiscal key={g.key} vm={vm.acoes} tipo={tipo} gr={g} marcado={false} />)
            : <p className="empty">Nenhuma pendente — tudo corrigido.</p>}
          {r.corrigidos.length > 0 && (
            <>
              <p className="hint" style={CORRIGIDOS}>Corrigidos ({r.qtdCorrigidos})</p>
              {r.corrigidos.map(g => <GrupoFiscal key={g.key} vm={vm.acoes} tipo={tipo} gr={g} marcado />)}
            </>
          )}
        </div>
      ))}
      {f.servicos.map(({ tipo, r }) => (
        <div key={tipo}>
          {titulo && <p className="hint" style={{ fontWeight: 600, color: 'var(--ink)' }}>{ROTULO[tipo]}</p>}
          {r.pendentes.length
            ? r.pendentes.map(g => <GrupoServ key={g.key} vm={vm.acoes} tipo={tipo} gr={g} marcado={false} />)
            : <p className="empty">Nenhuma pendente — tudo corrigido.</p>}
          {r.corrigidos.length > 0 && (
            <>
              <p className="hint" style={CORRIGIDOS}>Corrigidos ({r.qtdCorrigidos})</p>
              {r.corrigidos.map(g => <GrupoServ key={g.key} vm={vm.acoes} tipo={tipo} gr={g} marcado />)}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
