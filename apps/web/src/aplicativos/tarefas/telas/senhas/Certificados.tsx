// Senhas › Certificados (07/10/2026: "um dashboard de certificados próximos a vencer, vencidos, válidos"; depois "eu
// queria algo mais gráfico"): a rosca das situações (a legenda filtra), as barras dos vencimentos mês a mês (a barra
// filtra), os cartões com a contagem regressiva dos que pedem atenção e a lista; clicar abre o certificado da empresa.
import { Esqueleto, useCarregando } from '@nads/ui';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import { SegredosDaEmpresa } from './SegredosDaEmpresa';
import { useCertificados, type FiltroDeCertificados } from './useCertificados';

const TOPICOS: TopicoDaJanela<'certificado'>[] = [{ id: 'certificado', rotulo: 'Certificado', icone: 'lock' }];
const data = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const ROTULOS: Record<FiltroDeCertificados, string> = { vence: 'Próximos a vencer', vencido: 'Vencidos', ok: 'Válidos', sem: 'Sem certificado' };
const ORDEM: FiltroDeCertificados[] = ['vence', 'vencido', 'ok', 'sem'];
const MESES_LONGOS: Record<string, string> = { jan: 'janeiro', fev: 'fevereiro', mar: 'março', abr: 'abril', mai: 'maio', jun: 'junho', jul: 'julho', ago: 'agosto', set: 'setembro', out: 'outubro', nov: 'novembro', dez: 'dezembro' };
/** o raio do círculo com circunferência 100 (as fatias em porcentagem) */
const R = 15.915;

function Rosca({ contagem, total, filtro, mes, onFiltro }: { contagem: Record<FiltroDeCertificados, number>; total: number; filtro: FiltroDeCertificados; mes: string | null; onFiltro: (f: FiltroDeCertificados) => void }) {
  const soma = ORDEM.reduce((s, f) => s + contagem[f], 0) || 1;
  let antes = 0;
  return (
    <div className="cert-rosca">
      <svg viewBox="0 0 42 42" className="cert-rosca-svg" role="img" aria-label={ORDEM.map(f => ROTULOS[f] + ' ' + contagem[f]).join(', ')}>
        <circle cx="21" cy="21" r={R} className="cert-rosca-fundo" />
        {ORDEM.map(f => {
          const pct = (contagem[f] / soma) * 100;
          const fatia = pct > 0 && (
            <circle key={f} cx="21" cy="21" r={R} className={'cert-rosca-fatia cert-cor-' + f + (!mes && filtro === f ? ' ativa' : '')}
              strokeDasharray={pct + ' ' + (100 - pct)} strokeDashoffset={25 - antes} onClick={() => onFiltro(f)} />
          );
          antes += pct;
          return fatia;
        })}
        <text x="21" y="20.5" className="cert-rosca-total">{total}</text>
        <text x="21" y="26" className="cert-rosca-sub">com certificado</text>
      </svg>
      <ul className="cert-legenda">
        {ORDEM.map(f => (
          <li key={f}>
            <button type="button" className={'cert-legenda-item' + (!mes && filtro === f ? ' ativo' : '')} onClick={() => onFiltro(f)}>
              <span className={'cert-legenda-cor cert-cor-' + f} aria-hidden="true" />
              <span>{ROTULOS[f]}</span>
              <b className="num">{contagem[f]}</b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Barras({ meses, mes, onMes }: { meses: { chave: string; rotulo: string; ano: string; total: number; logo: boolean }[]; mes: string | null; onMes: (m: string) => void }) {
  const max = Math.max(1, ...meses.map(m => m.total));
  return (
    <div className="cert-barras">
      {meses.map(m => (
        <button key={m.chave} type="button" className={'cert-barra' + (mes === m.chave ? ' ativa' : '') + (m.logo ? ' logo' : '')} disabled={!m.total}
          onClick={() => onMes(m.chave)} aria-label={m.total + ' vencem em ' + MESES_LONGOS[m.rotulo] + ' de ' + m.chave.slice(0, 4)}>
          <span className="cert-barra-num num">{m.total || ''}</span>
          <span className="cert-barra-trilho"><span className="cert-barra-cheia" style={{ height: (m.total / max) * 100 + '%' }} /></span>
          <span className="cert-barra-mes">{m.rotulo}</span>
          <span className="cert-barra-ano fraco">{m.ano}</span>
        </button>
      ))}
    </div>
  );
}

/** o anel da contagem regressiva: cheio = 30 dias; vencido = o anel inteiro vermelho */
function Contagem({ dias }: { dias: number }) {
  const vencido = dias < 0;
  const pct = vencido ? 100 : Math.max(4, Math.min(100, (dias / 30) * 100));
  return (
    <span className={'cert-contagem ' + (vencido ? 'cert-cor-vencido' : 'cert-cor-vence')}>
      <svg viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r={R} className="cert-rosca-fundo" />
        <circle cx="21" cy="21" r={R} className="cert-contagem-arco" strokeDasharray={pct + ' ' + (100 - pct)} strokeDashoffset={25} />
      </svg>
      <span className="cert-contagem-num num">{Math.abs(dias)}</span>
      <span className="cert-contagem-txt">{vencido ? 'vencido' : dias === 1 ? 'dia' : 'dias'}</span>
    </span>
  );
}

export function Certificados() {
  const vm = useCertificados();
  useCarregando(vm.carregando);
  if (vm.carregando) return <Esqueleto linhas={8} />;
  const doMes = vm.mes ? vm.porMes.find(m => m.chave === vm.mes) : null;
  return (
    <section>
      <div className="cert-dash">
        <section className="card cert-dash-bloco">
          <div className="card-head"><h3>Situação</h3></div>
          <Rosca contagem={vm.contagem} total={vm.comCertificado} filtro={vm.filtro} mes={vm.mes} onFiltro={vm.setFiltro} />
        </section>
        <section className="card cert-dash-bloco">
          <div className="card-head"><h3>Vencimentos nos próximos 12 meses</h3></div>
          <Barras meses={vm.porMes} mes={vm.mes} onMes={vm.escolherMes} />
        </section>
      </div>

      {vm.urgentes.length > 0 && (
        <div className="cert-urgentes">
          {vm.urgentes.slice(0, 8).map(l => (
            <button key={l.chave} type="button" className={'card cert-urgente ' + (l.situacao === 'vencido' ? 'vencido' : 'vence')} onClick={() => vm.abrir(l.nome, l.codigo)}>
              <Contagem dias={l.dias ?? 0} />
              <span className="cert-urgente-texto">
                <b>{l.nome}</b>
                <span className="fraco num">{l.codigo != null ? l.codigo + ' · ' : ''}{data(l.validade)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <section className="card cert-lista">
        <div className="card-head">
          <h3>{doMes ? 'Vencem em ' + MESES_LONGOS[doMes.rotulo] + ' de ' + doMes.chave.slice(0, 4) : ROTULOS[vm.filtro]}</h3>
          <span className="badge badge-neutral">{vm.linhas.length}</span>
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
                    <td>
                      {l.situacao === 'sem' ? <span className="fraco">—</span>
                        : <span className={'badge ' + (l.situacao === 'vencido' ? 'badge-danger' : l.situacao === 'vence' ? 'badge-warn' : 'badge-ok')}>
                          {l.situacao === 'vencido' ? 'Vencido há ' + -(l.dias ?? 0) + ' dias' : l.dias === 0 ? 'Vence hoje' : (l.situacao === 'vence' ? 'Vence em ' : 'Válido · ') + l.dias + (l.dias === 1 ? ' dia' : ' dias')}
                        </span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="fraco cert-painel-vazio">Nenhuma empresa aqui.</p>}
      </section>

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
