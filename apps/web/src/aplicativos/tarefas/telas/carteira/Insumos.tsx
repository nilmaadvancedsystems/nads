// Carteira › Insumos (Vitor, 12/11/2026: "um menu de Insumos, onde a pessoa registra impressões, pastas, envelopes e caixas
// criadas"): os do mês, com o cliente de cada um. O Diretor e o Financeiro trocam para "Da equipe": os de todos, somados por
// pessoa e por cliente. Aberto para toda a equipe (não só para quem já tem a Carteira).
import { carteira } from '@nads/core';
import { Icone, Segmentado, useCarregando, Vazio, type NomeIcone } from '@nads/ui';
import { SeletorDoMes } from './comum';
import { JanelaDoInsumo } from './JanelaDoInsumo';
import { useInsumos, type VisaoDosInsumos } from './useInsumos';

const ICONE: Record<carteira.TipoDeInsumo, NomeIcone> = { impressao: 'impressora', pasta: 'pasta', envelope: 'envelope', caixa: 'arquivo' };
const qtd = (n: number) => (n ? n.toLocaleString('pt-BR') : '—');

function TabelaDoResumo({ titulo, linhas, comCodigo }: { titulo: string; linhas: carteira.LinhaDoResumo[]; comCodigo?: boolean }) {
  return (
    <section className="card dp-lista">
      <h3 className="cart-titulo">{titulo}</h3>
      {linhas.length ? (
        <div className="table-wrap">
          <table className="dp-tabela">
            <thead><tr><th>{comCodigo ? 'Cliente' : 'Pessoa'}</th>{carteira.TIPOS_DE_INSUMO.map(t => <th key={t.valor} className="num">{t.plural}</th>)}</tr></thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.chave}>
                  <td>{comCodigo && l.codigo != null && <span className="num fraco">{l.codigo} · </span>}{l.nome}</td>
                  {carteira.TIPOS_DE_INSUMO.map(t => <td key={t.valor} className="num">{qtd(l.totais[t.valor])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="fraco cart-vazio">Nada no mês.</p>}
    </section>
  );
}

export function Insumos() {
  const vm = useInsumos();
  const { m, lista, totais, aberto, setAberto, daEquipe } = vm;
  useCarregando(!vm.carregada);
  return (
    <section className="dp-painel">
      {aberto && <JanelaDoInsumo insumo={aberto === 'novo' ? null : aberto} fechar={() => setAberto(null)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        {vm.veTodos && <Segmentado<VisaoDosInsumos> valor={vm.visao} opcoes={[{ valor: 'meus', rotulo: 'Meus' }, { valor: 'equipe', rotulo: 'Da equipe' }]} onMudar={vm.setVisao} />}
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-primary" onClick={() => setAberto('novo')}><Icone nome="plus" />Registrar insumo</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      <div className="stat-grid dp-numeros">
        {carteira.TIPOS_DE_INSUMO.map(t => (
          <div key={t.valor} className="stat painel-numero painel-neutro">
            <span className="painel-numero-icone" aria-hidden="true"><Icone nome={ICONE[t.valor]} /></span>
            <p className="stat-label">{t.plural}</p><p className="stat-value num">{totais[t.valor].toLocaleString('pt-BR')}</p>
          </div>
        ))}
      </div>
      {daEquipe && lista.length > 0 && (
        <div className="cart-duas">
          <TabelaDoResumo titulo="Por pessoa" linhas={vm.porPessoa} />
          <TabelaDoResumo titulo="Por cliente" linhas={vm.porCliente} comCodigo />
        </div>
      )}
      <section className="card dp-lista">
        {vm.carregada && !lista.length ? (
          <Vazio icone="impressora" titulo={'Nada registrado em ' + carteira.mesPorExtenso(m.mes)} texto="Registre as impressões, pastas, envelopes e caixas que você fez, com o cliente de cada uma.">
            <button type="button" className="btn btn-primary" onClick={() => setAberto('novo')}><Icone nome="plus" />Registrar insumo</button>
          </Vazio>
        ) : (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Data</th>{daEquipe && <th>Pessoa</th>}<th>Tipo</th><th>Cliente</th><th className="num">Quantidade</th></tr></thead>
              <tbody>
                {lista.map(x => {
                  const abre = vm.podeAbrir(x);
                  return (
                    <tr key={x.id} className={abre ? 'linha-abre' : undefined} tabIndex={abre ? 0 : undefined} title={abre ? 'Abrir o registro' : undefined}
                      onClick={abre ? () => setAberto(x) : undefined} onKeyDown={abre ? e => { if (e.key === 'Enter') setAberto(x); } : undefined}>
                      <td className="num">{x.data.split('-').reverse().join('/')}</td>
                      {daEquipe && <td>{x.nome}</td>}
                      <td><Icone nome={ICONE[x.tipo]} width={14} height={14} /> {carteira.rotuloDoInsumo(x.tipo)}</td>
                      <td>{x.codigo != null && <span className="num fraco">{x.codigo} · </span>}{x.cliente}</td>
                      <td className="num">{x.quantidade.toLocaleString('pt-BR')}</td>
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
