// Área do Cliente › Hoje. 26/11/2026: o módulo refeito ("O que preciso fazer agora?"). 27/11/2026: refeito pelos grandes
// ("se baseia na UI deles e monte um para nós"): como o painel do TaxDome e a caixa do Intercom, três filas no alto (quem
// espera a equipe, quem o escritório espera e os arquivos para revisar), uma lista só com abas, cada linha com há quanto
// tempo espera (verde, amarelo, vermelho) e o responsável; ao lado, o pendente de cada responsável (tocar filtra) e o que
// está no ar. Só desenha.
import { Esqueleto, Icone, Vazio, useCarregando, type NomeIcone } from '@nads/ui';
import { AvisosDaArea } from '../base/Base';
import { useHoje } from './useHoje';
import type { FilaDoHoje } from '../../../dados/hojeDaArea';

const ICONE_DA_FILA: Record<FilaDoHoje, NomeIcone> = { equipe: 'mensagem', cliente: 'clock', revisar: 'caixaEntrada' };

function Painel({ tom, icone, rotulo, valor, sub, ativo, onClick }: { tom: string; icone: NomeIcone; rotulo: string; valor: number; sub: string; ativo?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={'stat stat-filtro painel-numero painel-' + tom + (ativo ? ' hoje-ativo' : '')} onClick={onClick} aria-pressed={ativo}>
      <span className="painel-numero-icone" aria-hidden="true"><Icone nome={icone} width={16} height={16} /></span>
      <p className="stat-label">{rotulo}</p>
      <p className="stat-value num">{valor}</p>
      <p className="hint" style={{ margin: 0 }}>{sub}</p>
    </button>
  );
}

const atrasadosTexto = (n: number, total: number, padrao: string) => (n ? n + (n === 1 ? ' atrasado' : ' atrasados') : total ? 'tudo em dia' : padrao);

export function Hoje() {
  const vm = useHoje();
  useCarregando(vm.carregando);
  const c = vm.conta, r = vm.resumo;
  const filaAtual = vm.filas.find(f => f.id === vm.fila)!;
  return (
    <section>
      <AvisosDaArea exemplos={vm.exemplos} erro={vm.erro} oQue="a Área do Cliente" />
      {vm.carregando ? <Esqueleto linhas={4} /> : <>
        <div className="stat-grid dp-numeros" style={{ marginBottom: 20 }}>
          <Painel tom={c.atrasados.equipe ? 'marca' : c.equipe ? 'aviso' : 'ok'} icone="mensagem" rotulo="Esperando a equipe" valor={c.equipe}
            sub={atrasadosTexto(c.atrasados.equipe, c.equipe, 'nada esperando')} ativo={vm.fila === 'equipe'} onClick={() => vm.setFila('equipe')} />
          <Painel tom={c.atrasados.cliente ? 'aviso' : 'info'} icone="clock" rotulo="Esperando o cliente" valor={c.cliente}
            sub={atrasadosTexto(c.atrasados.cliente, c.cliente, 'nada pedido')} ativo={vm.fila === 'cliente'} onClick={() => vm.setFila('cliente')} />
          <Painel tom={c.atrasados.revisar ? 'aviso' : 'roxo'} icone="caixaEntrada" rotulo="Arquivos para revisar" valor={c.revisar}
            sub={atrasadosTexto(c.atrasados.revisar, c.revisar, 'nada novo')} ativo={vm.fila === 'revisar'} onClick={() => vm.setFila('revisar')} />
          <Painel tom={r.acessosComErro ? 'marca' : 'ciano'} icone="equipe" rotulo="Clientes com acesso" valor={r.comAcesso}
            sub={r.acessosComErro ? r.acessosComErro + (r.acessosComErro === 1 ? ' senha com problema' : ' senhas com problema') : 'empresas com link'} onClick={vm.ir.clientes} />
        </div>

        <div className="hoje-grade">
          <div className="card hoje-fila">
            <div className="card-head hoje-fila-topo">
              <div className="hoje-abas" role="tablist" aria-label="Filas">
                {vm.filas.map(f => (
                  <button key={f.id} type="button" role="tab" aria-selected={vm.fila === f.id} className={'hoje-aba' + (vm.fila === f.id ? ' ativa' : '')} onClick={() => vm.setFila(f.id)}>
                    {f.rotulo}<span className="hoje-aba-n">{c[f.id]}</span>
                  </button>
                ))}
              </div>
              {vm.responsavel && (
                <button type="button" className="btn btn-ghost hoje-filtro" onClick={() => vm.setResponsavel('')} title="Tirar o filtro">
                  {vm.responsavel}<Icone nome="x" width={14} height={14} />
                </button>
              )}
            </div>
            {vm.itens.length ? (
              <ul className="ent-linhas area-linhas hoje-linhas">
                {vm.itens.map(i => (
                  <li key={i.chave}>
                    <button type="button" className="ent-linha-abre" onClick={() => vm.abrir(i)}>
                      <span className="area-linha-icone"><Icone nome={ICONE_DA_FILA[i.fila]} width={16} height={16} /></span>
                      <div className="hoje-linha-txt">
                        <b title={i.titulo}>{i.titulo}</b>
                        <span className="fraco">{i.codigo != null ? i.codigo + ' · ' : ''}{i.empresa}</span>
                      </div>
                      <span className="hoje-linha-resp fraco" title="Responsável">{i.responsavel || 'Sem responsável'}</span>
                      <span className={'hoje-espera hoje-espera-' + i.tom} title={'Desde ' + i.desdeCompleto}>{i.espera}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Vazio compacto icone="checkCircle" titulo={filaAtual.vazio} texto={vm.responsavel ? 'Com o filtro de ' + vm.responsavel + '.' : undefined} />}
          </div>

          <div className="hoje-lado">
            <div className="card">
              <div className="card-head"><h3>Por responsável</h3></div>
              {vm.porResponsavel.length ? (
                <table className="cad-tabela hoje-resp">
                  <thead><tr><th>Quem</th><th className="num" title="Esperando a equipe">Equipe</th><th className="num" title="Esperando o cliente">Cliente</th><th className="num" title="Arquivos para revisar">Revisar</th></tr></thead>
                  <tbody>
                    {vm.porResponsavel.map(l => (
                      <tr key={l.nome} className={vm.responsavel === l.nome ? 'ativa' : undefined} onClick={() => vm.setResponsavel(vm.responsavel === l.nome ? '' : l.nome)} title={'Ver só de ' + l.nome}>
                        <td>{l.nome}{l.atrasados > 0 && <span className="hoje-atrasados" title={l.atrasados + ' atrasados'}>{l.atrasados}</span>}</td>
                        <td className="num">{l.equipe || '—'}</td><td className="num">{l.cliente || '—'}</td><td className="num">{l.revisar || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="hint" style={{ padding: '0 16px 16px' }}>Ninguém com pendência.</p>}
            </div>
            <div className="card hoje-no-ar">
              <button type="button" className="hoje-no-ar-linha" onClick={vm.ir.comunicados}>
                <Icone nome="sino" width={16} height={16} /><span>Comunicados no ar</span><b>{r.comunicadosNoAr}</b>
              </button>
              <button type="button" className="hoje-no-ar-linha" onClick={vm.ir.solicitacoes}>
                <Icone nome="trofeu" width={16} height={16} /><span>Nota do atendimento no mês</span><b>{r.nota.total ? r.nota.media.toFixed(1).replace('.', ',') : '—'}</b>
              </button>
            </div>
          </div>
        </div>
      </>}
    </section>
  );
}
