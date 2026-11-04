// A página Alterdata da empresa aberta (Vitor, 04/11/2026: "quero criar um robo que puxa balancete e planilha de conta e
// upa no nads"): o mês e o Pedir ao robô na barra; o aviso quando o Contábil do servidor não está pronto; a tabela dos
// pedidos da empresa com a situação ao vivo e o Baixar do balancete (.xlsx) e do razão de todas as contas (.csv). Só as
// peças do catálogo (SeletorMes, BotaoAcao, Alerta na linha, Tabela padrão, selos, Vazio, Esqueleto).
import { Alerta, BotaoAcao, Esqueleto, Icone, SeletorMes, useCarregando, Vazio } from '@nads/ui';
import { tarefas as t } from '@nads/core';
import { RELATORIOS_DO_ALTERDATA, type PedidoMensalDoAlterdata } from '../../../dados/alterdata';
import { situacaoDo, useAlterdataDaEmpresa, type SituacaoDoPedido, type VmAlterdataDaEmpresa } from './useAlterdataDaEmpresa';

// os selos como os do FGTS: verde pronto, laranja andando, vermelho parado, cinza o resto
const SELO: Record<SituacaoDoPedido, { classe: string; rotulo: string }> = {
  fila: { classe: 'badge badge-neutral', rotulo: 'Na fila' },
  trabalhando: { classe: 'badge badge-warn', rotulo: 'Com o robô' },
  pronto: { classe: 'badge badge-ok', rotulo: 'Pronto' },
  parcial: { classe: 'badge badge-warn', rotulo: 'Saiu um só' },
  erro: { classe: 'badge badge-parada', rotulo: 'Não deu' },
  cancelado: { classe: 'badge badge-neutral', rotulo: 'Cancelado' },
};
const hora = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const tamanho = (n: number) => (n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB');

/** o que se diz embaixo do selo: a posição na fila, o último passo do robô ou o motivo do erro */
function detalhe(vm: VmAlterdataDaEmpresa, p: PedidoMensalDoAlterdata): string {
  const s = situacaoDo(p);
  if (s === 'fila') { const n = vm.posicao(p); return n > 1 ? 'Esperando a vez: ' + n + 'º na fila' : 'É o próximo'; }
  if (s === 'trabalhando') return p.passos.length ? p.passos[p.passos.length - 1].nome : 'Começando…';
  if (s === 'erro' || s === 'parcial') return p.erro;
  if (p.mesmoQue) return 'O mesmo mês já tinha saído: são os mesmos arquivos';
  return '';
}

export function AlterdataDaEmpresa() {
  const vm = useAlterdataDaEmpresa();
  useCarregando(vm.carregando);
  if (!vm.empresa) return <div className="card fc-cartao"><Vazio icone="briefcase" titulo="Empresa não encontrada" /></div>;
  const andando = vm.andandoNoMes;
  return (
    <section className="fc">
      <div className="tarefas-barra-topo fc-topo">
        <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Competência" />
        <BotaoAcao onClick={() => void vm.pedir()} carregando={vm.fazendo === 'pedir'} textoCarregando="Pedindo…" disabled={!!andando}
          title={andando ? vm.rotuloCompetencia + ' já está na fila do robô' : 'O robô gera o balancete e o razão de todas as contas no Alterdata'}>
          <Icone nome="download" width={16} height={16} />{andando ? 'Já está na fila' : 'Pedir balancete e razão'}
        </BotaoAcao>
      </div>
      {vm.robo.carregado && !vm.robo.pronto && (
        <Alerta naLinha titulo="O robô não está com o Contábil aberto" texto={vm.robo.motivo + ' Os pedidos esperam na fila até alguém entrar no Contábil do NILMA-SERVER.'} />
      )}
      <section className="card fc-cartao">
        <header className="fc-cartao-topo">
          <h3 className="fc-cartao-titulo">Pedidos ao robô do Alterdata</h3>
          <span className="fc-contagem">{vm.lista.length === 1 ? '1 pedido' : vm.lista.length + ' pedidos'}</span>
        </header>
        {vm.carregando ? <Esqueleto linhas={4} /> : !vm.lista.length ? (
          <Vazio icone="fileText" titulo="Nenhum pedido ainda" texto="Escolha o mês e clique em Pedir: o robô gera no Alterdata o balancete e o razão de todas as contas, e os dois ficam aqui para baixar." />
        ) : (
          <div className="table-wrap fc-tabela">
            <table className="table-compact">
              <thead>
                <tr><th>Mês</th><th>Situação</th><th>Pedido por</th>{RELATORIOS_DO_ALTERDATA.map(r => <th key={r.id}>{r.rotulo}</th>)}<th aria-label="Ações" /></tr>
              </thead>
              <tbody>
                {vm.lista.map(p => {
                  const s = situacaoDo(p);
                  const d = detalhe(vm, p);
                  return (
                    <tr key={p.id}>
                      <td><b>{t.rotuloCompetencia(p.competencia)}</b></td>
                      <td>
                        <span className={SELO[s].classe}>{SELO[s].rotulo}</span>
                        {d && <div className="fraco">{d}</div>}
                      </td>
                      <td>{p.criadoPor}<div className="fraco">{hora(p.criadoEm)}</div></td>
                      {RELATORIOS_DO_ALTERDATA.map(r => {
                        const a = p.arquivos[r.id];
                        if (!a) return <td key={r.id} className="fraco">—</td>;
                        if (a.status === 'erro') return <td key={r.id}><span className="fraco" title={a.erro}>Não saiu</span></td>;
                        return (
                          <td key={r.id}>
                            <BotaoAcao className="btn btn-outline btn-sm" onClick={() => void vm.baixar(p, r.id)} carregando={vm.fazendo === 'baixar:' + p.id + ':' + r.id} textoCarregando="Baixando…" title={a.nome}>
                              <Icone nome="download" width={14} height={14} />Baixar <span className="fraco">{tamanho(a.tamanho)}</span>
                            </BotaoAcao>
                          </td>
                        );
                      })}
                      <td>
                        {(s === 'fila' || s === 'trabalhando') && (
                          <BotaoAcao className="btn btn-ghost btn-sm" onClick={() => void vm.cancelar(p)} carregando={vm.fazendo === 'cancelar:' + p.id} textoCarregando="Cancelando…">Cancelar</BotaoAcao>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
