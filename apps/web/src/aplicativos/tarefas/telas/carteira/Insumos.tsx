// Carteira › Insumos (Vitor, 12/11/2026; 13/11/2026: "Esse insumos só vai ser, impressão, envelope, caixa, ele tem que selecionar
// um cliente registrado ou avulso, não há comissão descontada, apenas os valores dos insumos que intermedia eles do financeiro.
// não tem meus e nem da equipe, é um só, simples, que aparece no financeiro"): os do mês numa lista só, com o cliente de cada
// um. A pessoa vê os dela; o Diretor e o Financeiro, os de todos (a mesma tela aparece no Financeiro, em Insumos da equipe).
// Aberto para toda a equipe (não só para quem já tem a Carteira).
import { carteira } from '@nads/core';
import { Icone, useCarregando, Vazio, type NomeIcone } from '@nads/ui';
import { DadosDeTesteDaCarteira, SeletorDoMes } from './comum';
import { JanelaDoInsumo } from './JanelaDoInsumo';
import { useInsumos } from './useInsumos';

const ICONE: Record<carteira.TipoDeInsumo, NomeIcone> = { impressao: 'impressora', pasta: 'pasta', envelope: 'envelope', caixa: 'arquivo' };

export function Insumos() {
  const vm = useInsumos();
  const { m, lista, totais, aberto, setAberto, veTodos } = vm;
  useCarregando(!vm.carregada);
  return (
    <section className="dp-painel">
      {aberto && <JanelaDoInsumo insumo={aberto === 'novo' ? null : aberto} fechar={() => setAberto(null)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <DadosDeTesteDaCarteira />
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
      <section className="card dp-lista">
        {vm.carregada && !lista.length ? (
          <Vazio icone="impressora" titulo={'Nada registrado em ' + carteira.mesPorExtenso(m.mes)} texto="Registre as impressões, os envelopes e as caixas, com o cliente de cada um.">
            <button type="button" className="btn btn-primary" onClick={() => setAberto('novo')}><Icone nome="plus" />Registrar insumo</button>
          </Vazio>
        ) : (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Data</th>{veTodos && <th>Pessoa</th>}<th>Tipo</th><th>Cliente</th><th className="num">Quantidade</th></tr></thead>
              <tbody>
                {lista.map(x => {
                  const abre = vm.podeAbrir(x);
                  return (
                    <tr key={x.id} className={abre ? 'linha-abre' : undefined} tabIndex={abre ? 0 : undefined} title={abre ? 'Abrir o registro' : undefined}
                      onClick={abre ? () => setAberto(x) : undefined} onKeyDown={abre ? e => { if (e.key === 'Enter') setAberto(x); } : undefined}>
                      <td className="num">{x.data.split('-').reverse().join('/')}</td>
                      {veTodos && <td>{x.nome}</td>}
                      <td><Icone nome={ICONE[x.tipo]} width={14} height={14} /> {carteira.rotuloDoInsumo(x.tipo)}</td>
                      <td>
                        {x.codigo != null && <span className="num fraco">{x.codigo} · </span>}
                        <span className="ini-empresa">{x.cliente}</span>
                        {x.codigo == null && <span className="fraco"> · avulso</span>}
                      </td>
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
