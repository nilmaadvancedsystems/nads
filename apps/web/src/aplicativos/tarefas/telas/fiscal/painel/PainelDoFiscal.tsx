// O Painel do Fiscal (Vitor, 09/10/2026): os clientes do mês numa tela, com as peças do Painel do DP (os filtros, os números
// em painéis coloridos e a lista em card). Em cada linha, o que a rotina e o SIEG apontam; o número em amarelo é o que
// pede atenção, o "—" é o que ainda não foi conferido (a rotina do cliente ainda não foi aberta, ou o SIEG não contou).
import { Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { Link } from 'react-router';
import { useVisaoDoFiscal, type FiltroDoPainel } from './useVisaoDoFiscal';

const FILTROS: { valor: FiltroDoPainel; rotulo: string }[] = [{ valor: 'todos', rotulo: 'Todos' }, { valor: 'pendencias', rotulo: 'Com pendência' }];

/** O número da coluna: "—" sem conferir, o zero apagado, o resto em destaque. */
function Numero({ n, titulo }: { n: number | null; titulo: string }) {
  if (n == null) return <span className="fraco" title="Ainda não conferido">—</span>;
  if (n === 0) return <span className="fraco num">0</span>;
  return <span className="badge badge-warn num" title={titulo}>{n}</span>;
}

export function PainelDoFiscal() {
  const vm = useVisaoDoFiscal();
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro">
          <span className="hint">Competência</span>
          <select className="select-compact" value={vm.competencia} onChange={e => vm.setCompetencia(e.target.value)}>
            {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </label>
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar cliente</span>
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Nome ou código" aria-label="Buscar cliente (nome ou código)" />
        </label>
        <label className="field dp-filtro">
          <span className="hint">Mostrar</span>
          <Segmentado opcoes={FILTROS} valor={vm.filtro} onMudar={vm.setFiltro} />
        </label>
      </div>
      {vm.carregando ? <Esqueleto linhas={6} numeros={6} /> : (
        <>
          <div className="stat-grid dp-numeros">
            {vm.numeros.map(n => (
              <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
                <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
                <p className="stat-label">{n.rotulo}</p>
                <p className="stat-value num">{n.valor}</p>
              </div>
            ))}
          </div>
          <section className="card dp-lista">
            <div className="dp-lista-topo">
              <h3 className="dp-titulo">Clientes do mês</h3>
              <span className="badge badge-neutral">{vm.quantas}</span>
              <span className="hint">os números da rotina aparecem depois que ela é aberta no mês</span>
            </div>
            {vm.quantas === 0 ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              <div className="table-wrap">
                <table className="dp-tabela fiscal-painel-tabela">
                  <thead>
                    <tr>
                      <th>Cód.</th><th>Cliente</th><th>Etapa</th>
                      <th className="num">Notas no SIEG</th><th className="num">XMLs</th><th className="num">Buracos</th>
                      <th className="num">Faltam no Alterdata</th><th className="num">Valores</th><th className="num">Tributação</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(l => (
                      <tr key={l.chave}>
                        <td className="num fraco">{l.codigo}</td>
                        <td className="dp-cliente"><b>{l.nome}</b></td>
                        <td className="wrap"><span className={'bolinha-sit ' + l.situacao} aria-hidden="true" /> {l.etapa}{l.situacao !== 'nao-iniciada' && l.situacao !== 'concluida' ? <span className="hint"> · {l.progresso}%</span> : null}</td>
                        <td className="num">{l.notas == null ? <span className="fraco">—</span> : l.notas}</td>
                        <td className="num">{l.xmls == null ? <span className="fraco">—</span> : l.xmls}</td>
                        <td className="num"><Numero n={l.buracos} titulo="Números faltando na sequência das notas emitidas" /></td>
                        <td className="num"><Numero n={l.faltam} titulo="Notas dos XMLs que não estão no Alterdata" /></td>
                        <td className="num"><Numero n={l.valores} titulo="Notas com valor diferente, canceladas lançadas ou lançadas sem XML" /></td>
                        <td className="num"><Numero n={l.tributacao} titulo="Itens com a tributação para revisar" /></td>
                        <td><Link className="btn btn-outline" to={l.rota}>Abrir</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
