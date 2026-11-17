// Verificar por conta, na tela de subir o relatório: o "Lançamento fora do padrão" só das notas dessa conta
// (Vitor, 14/10/2026: "acoplar no verificar por conta, o fluxo vai ficar melhor"). As mesmas peças do Relatório.
import { GrupoFiscal } from '../../relatorio/partes/ForaDoPadraoFiscal';
import { GrupoServ } from '../../relatorio/partes/Servicos';
import type { useVerificarConta } from '../useVerificarConta';
import { Icone, useRetorno, Vazio } from '@nads/ui';
import { MarcaAlterdata } from '../../importacao/partes/MarcaAlterdata';
import { useLancamentoPadraoPeloRobo } from '../useLancamentoPadraoPeloRobo';

type Vm = ReturnType<typeof useVerificarConta>;

const ROTULO = { entradas: 'Entradas', saidas: 'Saídas', tomados: 'Tomados', prestados: 'Prestados' } as const;
const CORRIGIDOS = { marginTop: 16, fontWeight: 600, color: 'var(--ink)' } as const;

export function ForaDoPadraoDaConta({ vm }: { vm: Vm }) {
  const f = vm.foraDoPadrao;
  const robo = useLancamentoPadraoPeloRobo({ codigo: vm.empresaDoRobo.codigo, empresa: vm.empresaDoRobo.nome, meses: vm.empresaDoRobo.meses, fiscais: f.fiscais, notas: vm.notasDaEmpresa, marcar: vm.acoes.marcarNotaCorrigida });
  if (!f.fiscais.length && !f.servicos.length) return null;
  // mais de um tipo (a conta com entradas e tomados…): o nome do tipo em cima de cada um
  const titulo = f.fiscais.length + f.servicos.length > 1;
  return (
    <div className="card" id="vcForaDoPadrao">
      <div className="card-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h3>Lançamento fora do padrão</h3>
        <RoboDoPadrao r={robo} />
      </div>
      <AvisosDoRobo r={robo} />
      {f.fiscais.map(({ tipo, r }) => (
        <div key={tipo}>
          {titulo && <p className="hint" style={{ fontWeight: 600, color: 'var(--ink)' }}>{ROTULO[tipo]}</p>}
          {r.pendentes.length
            ? r.pendentes.map(g => <GrupoFiscal key={g.key} vm={vm.acoes} tipo={tipo} gr={g} marcado={false} />)
            : <Vazio compacto icone="checkCircle" texto="Nenhuma pendente — tudo corrigido." />}
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
            : <Vazio compacto icone="checkCircle" texto="Nenhuma pendente — tudo corrigido." />}
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

type Robo = ReturnType<typeof useLancamentoPadraoPeloRobo>;

/**
 * O botão Vitor no cabeçalho (17/11/2026, Vitor: "pode colocar na linha do cabecalho, do Lançamento fora do padrão"): o primeiro
 * clique é o ensaio (o robô só confere no Alterdata quantas notas acha); com tudo batendo, "Corrigir N notas" pede a confirmação e
 * troca o lançamento no Alterdata Fiscal. Puxando: a barra e o ×.
 */
function RoboDoPadrao({ r }: { r: Robo }) {
  const { modal } = useRetorno();
  if (!r.disponivel || r.soBloqueados) return null;
  if (r.andando) {
    return (
      <span className="imp-robo-mini" style={{ marginLeft: 'auto' }} title={'O robô de ' + r.rotulo + ' está no Alterdata Fiscal'}>
        <span className="imp-robo-barra"><span style={{ width: Math.max(6, r.pct) + '%' }} /></span>
        <button type="button" className="icon-btn icon-btn-sm imp-btn" onClick={r.cancelar} title="Cancelar: o robô para e volta o Alterdata ao ponto de antes" aria-label="Cancelar o robô"><Icone nome="x" /></button>
      </span>
    );
  }
  if (r.prontoParaCorrigir) {
    const corrigir = async () => {
      const ok = await modal<boolean>({
        icone: 'alert', titulo: 'Corrigir no Alterdata Fiscal?',
        html: 'O robô de ' + r.rotulo + ' vai pôr o lançamento padrão em <b>' + r.notasACorrigir + ' nota(s)</b> desses CFOPs no Alterdata Fiscal (' + r.foraDoPadrao + ' fora do padrão; as outras já estão nele ou ficam iguais). O ensaio conferiu as mesmas notas que o nads tem.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Corrigir', valor: true, variante: 'btn-primary' }],
      });
      if (ok) void r.corrigir();
    };
    return (
      <button type="button" className="btn btn-primary btn-icone-alterdata" style={{ marginLeft: 'auto' }} disabled={r.pedindo} onClick={() => { void corrigir(); }}
        title={'Trocar o lançamento de ' + r.notasACorrigir + ' nota(s) para o padrão no Alterdata Fiscal'} aria-label={'Corrigir ' + r.notasACorrigir + ' notas no Alterdata pelo robô de ' + r.rotulo}>
        <MarcaAlterdata />Corrigir {r.notasACorrigir}
      </button>
    );
  }
  return (
    <button type="button" className="btn btn-outline btn-icone-alterdata" style={{ marginLeft: 'auto' }} disabled={r.pedindo} onClick={() => { void r.ensaiar(); }}
      title="Ensaio: o robô confere no Alterdata Fiscal as notas fora do padrão, sem mudar nada" aria-label={'Conferir no Alterdata pelo robô de ' + r.rotulo}>
      <MarcaAlterdata />{r.rotulo}
    </button>
  );
}

function AvisosDoRobo({ r }: { r: Robo }) {
  if (!r.disponivel) return null;
  const linhas = [...(r.falha ? [{ tom: 'erro' as const, texto: r.falha }] : []), ...(r.espera ? [{ tom: 'info' as const, texto: r.espera }] : []), ...r.avisos];
  if (!linhas.length) return null;
  return (
    <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'grid', gap: 4 }}>
      {linhas.map((l, i) => <li key={i} className={'hint' + (l.tom === 'erro' ? ' ext-neg' : '')} style={l.tom === 'ok' ? { color: 'var(--ok, inherit)' } : undefined}>{l.texto}</li>)}
    </ul>
  );
}
