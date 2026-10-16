// Senhas › Certificados (07/10/2026: "um dashboard de certificados próximos a vencer, vencidos, válidos"; depois "eu
// queria algo mais gráfico"): a rosca das situações (a legenda filtra), as barras dos vencimentos mês a mês (a barra
// filtra), os cartões com a contagem regressiva dos que pedem atenção e a lista; clicar abre o certificado da empresa.
// As peças do gráfico (rosca, barras e cartão com anel) vêm do @nads/ui: o Painel do DP usa as mesmas (Savio, 15/10/2026).
import { BarrasEmColuna, CartaoComAnel, Esqueleto, Icone, RoscaComLegenda, useCarregando, type TomDoPainel } from '@nads/ui';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import { TelaDeBloqueio } from './TelaDeBloqueio';
import { SegredosDaEmpresa } from './SegredosDaEmpresa';
import { useCertificados, type FiltroDeCertificados } from './useCertificados';

const TOPICOS: TopicoDaJanela<'certificado'>[] = [{ id: 'certificado', rotulo: 'Certificado', icone: 'lock' }];
const data = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const ROTULOS: Record<FiltroDeCertificados, string> = { vence: 'Próximos a vencer', vencido: 'Vencidos', ok: 'Válidos', sem: 'Sem certificado' };
const ORDEM: FiltroDeCertificados[] = ['vence', 'vencido', 'ok', 'sem'];
const MESES_LONGOS: Record<string, string> = { jan: 'janeiro', fev: 'fevereiro', mar: 'março', abr: 'abril', mai: 'maio', jun: 'junho', jul: 'julho', ago: 'agosto', set: 'setembro', out: 'outubro', nov: 'novembro', dez: 'dezembro' };
/** a situação do certificado no tom das peças do painel */
const TOM: Record<FiltroDeCertificados, TomDoPainel> = { vence: 'aviso', vencido: 'perigo', ok: 'ok', sem: 'neutro' };

export function Certificados() {
  const vm = useCertificados();
  useCarregando(vm.carregando);
  if (vm.carregando) return <Esqueleto linhas={8} />;
  // sem acesso ao cofre, só a tela de pedir acesso (13/10/2026: "não era pra tela nem abrir, era pra só ter a tela de pedir acesso")
  if (vm.cofre.estado !== 'aberto') return <TelaDeBloqueio vm={vm.cofre} />;
  const doMes = vm.mes ? vm.porMes.find(m => m.chave === vm.mes) : null;
  return (
    <section>
      <div className="cert-dash">
        <section className="card cert-dash-bloco">
          <div className="card-head"><h3>Situação</h3></div>
          <RoscaComLegenda fatias={ORDEM.map(f => ({ id: f, rotulo: ROTULOS[f], valor: vm.contagem[f], tom: TOM[f] }))} total={vm.comCertificado} subtitulo="com certificado"
            ativa={vm.mes ? null : vm.filtro} onEscolher={f => vm.setFiltro(f as FiltroDeCertificados)} />
        </section>
        <section className="card cert-dash-bloco">
          <div className="card-head"><h3>Vencimentos nos próximos 12 meses</h3></div>
          <BarrasEmColuna ativa={vm.mes} onEscolher={vm.escolherMes}
            colunas={vm.porMes.map(m => ({ chave: m.chave, rotulo: m.rotulo, sub: m.ano, total: m.total, aviso: m.logo, leitura: m.total + ' vencem em ' + MESES_LONGOS[m.rotulo] + ' de ' + m.chave.slice(0, 4) }))} />
        </section>
      </div>

      {vm.urgentes.length > 0 && (
        <div className="cert-urgentes">
          {vm.urgentes.slice(0, 8).map(l => (
            <CartaoComAnel key={l.chave} dias={l.dias ?? 0} titulo={l.nome} atrasado={l.situacao === 'vencido'}
              prazo={(l.dias ?? 0) < 0 ? 'Vencido há ' + -(l.dias ?? 0) + (l.dias === -1 ? ' dia' : ' dias') : l.dias === 0 ? 'Vence hoje' : 'Vence em ' + l.dias + (l.dias === 1 ? ' dia' : ' dias')}
              apoio={(l.codigo != null ? l.codigo + ' · ' : '') + data(l.validade)} classe={vm.cofre.bloqueio ? 'cofre-bloqueado' : undefined}
              dica={vm.cofre.bloqueio || undefined} onClick={() => vm.abrir(l.nome, l.codigo)} />
          ))}
        </div>
      )}

      <section className="card cert-lista">
        <div className="card-head">
          <h3>{doMes ? 'Vencem em ' + MESES_LONGOS[doMes.rotulo] + ' de ' + doMes.chave.slice(0, 4) : ROTULOS[vm.filtro]}</h3>
          <span className="badge badge-neutral">{vm.linhas.length}</span>
          <span className="tarefas-barra-espaco" />
          {/* a busca da lista (Savio, 15/10/2026): empresa, código ou CNPJ */}
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar empresa, código ou CNPJ" aria-label="Buscar certificado" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
          </label>
        </div>
        {vm.linhas.length ? (
          <div className="table-wrap cofre-tabela">
            <table>
              <thead><tr><th>Cód.</th><th>Empresa</th><th>Validade</th><th>Situação</th></tr></thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.chave} className={vm.cofre.bloqueio ? 'cofre-bloqueado' : 'dp-linha-abre'} title={vm.cofre.bloqueio || undefined} onClick={() => vm.abrir(l.nome, l.codigo)}>
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
        ) : <p className="fraco cert-painel-vazio">{vm.busca.trim() ? 'Nenhuma empresa achada nesta lista.' : 'Nenhuma empresa aqui.'}</p>}
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
