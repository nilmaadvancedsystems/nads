// Senhas › Certificados (07/10/2026: "um dashboard de certificados próximos a vencer, vencidos, válidos"): os números
// por situação (clicar filtra), a lista em ordem de vencimento e, ao clicar na empresa, a janela do certificado.
import { Esqueleto, Segmentado, Stat, useCarregando } from '@nads/ui';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import { SegredosDaEmpresa } from './SegredosDaEmpresa';
import { useCertificados, type FiltroDeCertificados } from './useCertificados';

const TOPICOS: TopicoDaJanela<'certificado'>[] = [{ id: 'certificado', rotulo: 'Certificado', icone: 'lock' }];
const data = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const ROTULOS: Record<FiltroDeCertificados, string> = { vence: 'Próximos a vencer', vencido: 'Vencidos', ok: 'Válidos', sem: 'Sem certificado' };
const ORDEM: FiltroDeCertificados[] = ['vence', 'vencido', 'ok', 'sem'];

function Situacao({ situacao, dias }: { situacao: FiltroDeCertificados; dias: number | null }) {
  const d = dias ?? 0;
  if (situacao === 'sem') return <span className="fraco">—</span>;
  if (situacao === 'vencido') return <span className="badge badge-danger">Vencido há {-d} {d === -1 ? 'dia' : 'dias'}</span>;
  if (situacao === 'vence') return <span className="badge badge-warn">{d === 0 ? 'Vence hoje' : 'Vence em ' + d + (d === 1 ? ' dia' : ' dias')}</span>;
  return <span className="badge badge-ok">Válido · {d} dias</span>;
}

export function Certificados() {
  const vm = useCertificados();
  useCarregando(vm.carregando);
  if (vm.carregando) return <Esqueleto linhas={8} />;
  return (
    <section>
      <div className="stat-grid cert-painel">
        {ORDEM.map(f => (
          <button key={f} type="button" className={'cert-painel-num cert-painel-' + f + (vm.filtro === f ? ' ativo' : '')} onClick={() => vm.setFiltro(f)}>
            <Stat rotulo={ROTULOS[f]} valor={vm.contagem[f]} />
          </button>
        ))}
      </div>
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.filtro} opcoes={ORDEM.map(f => ({ valor: f, rotulo: ROTULOS[f] + ' · ' + vm.contagem[f] }))} onMudar={vm.setFiltro} />
      </div>
      {vm.linhas.length ? (
        <div className="table-wrap cofre-tabela">
          <table>
            <thead><tr><th>Cód.</th><th>Empresa</th><th>Validade</th><th>Situação</th></tr></thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.chave} className="dp-linha-abre" onClick={() => vm.abrir(l.nome, l.codigo)}>
                  <td className="num fraco">{l.codigo ?? ''}</td>
                  <td className="cofre-nome">{l.nome}</td>
                  <td className="num">{data(l.validade) || <span className="fraco">—</span>}</td>
                  <td><Situacao situacao={l.situacao} dias={l.dias} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="fraco cert-painel-vazio">Nenhuma empresa aqui.</p>}
      {vm.aberta && (
        <JanelaLateral rotulo={vm.aberta.nome} topicos={TOPICOS} topico="certificado" mudar={() => undefined} fechar={vm.fechar} classe="cofre-janela" resumo={(
          <div className="usuario-quem"><b>{vm.aberta.nome}</b>{vm.aberta.codigo != null && <span className="fraco">{vm.aberta.codigo}</span>}</div>
        )}>
          <SegredosDaEmpresa vm={vm.cofre} empresa={vm.aberta.nome} codigo={vm.aberta.codigo} parte="certificado" />
        </JanelaLateral>
      )}
    </section>
  );
}
