// Carteira › Insumos (Vitor, 12/11/2026; 15/11/2026: "o preço do insumo é o financeiro que decide, e quais insumos são, o
// usuário só registra o tipo e quantidade": quem é do Financeiro tem o botão Insumos e preços e vê os valores; 13/11/2026: "Esse insumos só vai ser, impressão, envelope, caixa, ele tem que selecionar
// um cliente registrado ou avulso, não há comissão descontada, apenas os valores dos insumos que intermedia eles do financeiro.
// não tem meus e nem da equipe, é um só, simples, que aparece no financeiro"): os do mês numa lista só, com o cliente de cada
// um. A pessoa vê os dela; o Diretor e o Financeiro, os de todos (a mesma tela aparece no Financeiro, em Insumos da equipe).
// Aberto para toda a equipe (não só para quem já tem a Carteira).
import { carteira, formatos } from '@nads/core';
import { Icone, useCarregando, Vazio, type NomeIcone } from '@nads/ui';
import { DadosDeTesteDaCarteira, SeletorDoMes } from './comum';
import { JanelaDoInsumo } from './JanelaDoInsumo';
import { JanelaDosInsumos } from './JanelaDosInsumos';
import { useInsumos } from './useInsumos';

// o ícone dos insumos de sempre; os que o Financeiro criar ficam com o da lista
const ICONE: Record<string, NomeIcone> = { impressao: 'impressora', pasta: 'pasta', envelope: 'envelope', caixa: 'arquivo' };
const icone = (tipo: string): NomeIcone => ICONE[tipo] ?? 'list';

/** emJanela: dentro da janela Impressões e materiais da Carteira (19/11/2026); o botão vira só "Registrar" */
export function Insumos({ emJanela = false }: { emJanela?: boolean } = {}) {
  const vm = useInsumos();
  const { m, lista, totais, aberto, setAberto, veTodos } = vm;
  useCarregando(!vm.carregada);
  return (
    <section className={'dp-painel' + (emJanela ? ' insumos-na-janela' : '')}>
      {aberto && <JanelaDoInsumo insumo={aberto === 'novo' ? null : aberto} fechar={() => setAberto(null)} />}
      {vm.configurando && <JanelaDosInsumos fechar={() => vm.setConfigurando(false)} />}
      <div className="tarefas-barra-topo dp-filtros-linha">
        <SeletorDoMes {...m} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <DadosDeTesteDaCarteira />
        {/* o Financeiro decide quais insumos são e o preço de cada um (15/11/2026) */}
        {veTodos && <button type="button" className="btn btn-outline" onClick={() => vm.setConfigurando(true)}><Icone nome="settings" />Insumos e preços</button>}
        <button type="button" className="btn btn-primary" onClick={() => setAberto('novo')}><Icone nome="plus" />{emJanela ? 'Registrar' : 'Registrar insumo'}</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {vm.semLiberacao && <p className="registro-dica"><Icone nome="lock" />Aqui estão só os seus. Os de toda a equipe e os preços ficam no Financeiro › Insumos da equipe, que abre com o login liberado.</p>}
      {emJanela ? (
        // na janela da Carteira, as caixinhas mais enxutas (Vitor, 19/11/2026: "Faz umas box mais bonitas... Essas estao zuadas"):
        // o ícone, o nome, a quantidade grande e o valor numa linha só
        <div className="insumo-caixas">
          {totais.porInsumo.map(t => (
            <div key={t.id} className={'insumo-caixa' + (t.quantidade ? ' tem' : '')}>
              <span className="insumo-caixa-icone" aria-hidden="true"><Icone nome={icone(t.id)} /></span>
              <span className="insumo-caixa-txt">
                <span className="insumo-caixa-nome">{t.nome}</span>
                <b className="num">{t.quantidade.toLocaleString('pt-BR')}</b>
                {veTodos && <span className="insumo-caixa-valor num">{formatos.reais(t.valor)}</span>}
              </span>
            </div>
          ))}
          {veTodos && (
            <div className="insumo-caixa insumo-caixa-total">
              <span className="insumo-caixa-icone" aria-hidden="true"><Icone nome="dinheiro" /></span>
              <span className="insumo-caixa-txt"><span className="insumo-caixa-nome">Valor do mês</span><b className="num">{formatos.reais(totais.valor)}</b></span>
            </div>
          )}
        </div>
      ) : (
      <div className="stat-grid dp-numeros">
          {/* cada insumo da lista do Financeiro: as unidades do mês; para o Financeiro, também o valor */}
          {totais.porInsumo.map(t => (
            <div key={t.id} className="stat painel-numero painel-neutro">
              <span className="painel-numero-icone" aria-hidden="true"><Icone nome={icone(t.id)} /></span>
              <p className="stat-label">{t.nome}</p><p className="stat-value num">{t.quantidade.toLocaleString('pt-BR')}</p>
              {veTodos && <p className="hint num">{formatos.reais(t.valor)}</p>}
            </div>
          ))}
          {veTodos && (
            <div className="stat painel-numero painel-neutro">
              <span className="painel-numero-icone" aria-hidden="true"><Icone nome="dinheiro" /></span>
              <p className="stat-label">Valor do mês</p><p className="stat-value num">{formatos.reais(totais.valor)}</p>
            </div>
          )}
        </div>
      )}
      <section className="card dp-lista">
        {vm.carregada && !lista.length ? (
          <Vazio icone="impressora" titulo={'Nada registrado em ' + carteira.mesPorExtenso(m.mes)} texto="Registre o insumo e a quantidade, com o cliente de cada um.">
            <button type="button" className="btn btn-primary" onClick={() => setAberto('novo')}><Icone nome="plus" />Registrar insumo</button>
          </Vazio>
        ) : (
          <div className="table-wrap">
            <table className="dp-tabela">
              <thead><tr><th>Data</th>{veTodos && <th>Pessoa</th>}<th>Insumo</th><th>Cliente</th><th className="num">Quantidade</th>{veTodos && <th className="num">Valor</th>}</tr></thead>
              <tbody>
                {lista.map(x => {
                  const abre = vm.podeAbrir(x);
                  return (
                    <tr key={x.id} className={abre ? 'linha-abre' : undefined} tabIndex={abre ? 0 : undefined} title={abre ? 'Abrir o registro' : undefined}
                      onClick={abre ? () => setAberto(x) : undefined} onKeyDown={abre ? e => { if (e.key === 'Enter') setAberto(x); } : undefined}>
                      <td className="num">{x.data.split('-').reverse().join('/')}</td>
                      {veTodos && <td>{x.nome}</td>}
                      <td><Icone nome={icone(x.tipo)} width={14} height={14} /> {vm.nomeDe(x)}</td>
                      <td>
                        {x.codigo != null && <span className="num fraco">{x.codigo} · </span>}
                        <span className="ini-empresa">{x.cliente}</span>
                        {x.codigo == null && <span className="fraco"> · avulso</span>}
                      </td>
                      <td className="num">{x.quantidade.toLocaleString('pt-BR')}</td>
                      {veTodos && <td className="num">{x.preco ? formatos.reais(vm.valorDe(x)) : <span className="fraco" title="Registrado sem preço">—</span>}</td>}
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
