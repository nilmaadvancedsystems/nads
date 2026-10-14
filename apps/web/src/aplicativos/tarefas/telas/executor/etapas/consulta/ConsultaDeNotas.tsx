// A Consulta de notas das etapas Clientes, Fornecedores e Adiantamento (Vitor, 14/10/2026: "coloque em uma barra
// superior isso, igual à Consulta normal"): a aba Consulta no menu de cima da Tarefa (useAbasDaConsulta) e a página no
// mesmo desenho da Consulta do Concilia aí (concilia-ai/telas/consulta): o Segmentado do tipo, a busca com o botão, o
// resumo e a tabela que ordena no título. Clientes: Saídas e Prestados; Fornecedores: Entradas e Tomados.
import type { conferencia as c } from '@nads/core';
import { Icone, Segmentado } from '@nads/ui';
import { useState } from 'react';
import { useAbasDaEtapa } from '../contexto';
import { useConsultaDeNotas, type TipoConsultado } from './useConsultaDeNotas';

/** As duas abas de cima (a tela da etapa e a Consulta); devolve se a Consulta está aberta. */
export function useAbasDaConsulta(rotuloDaTela: string): boolean {
  const [consulta, setConsulta] = useState(false);
  useAbasDaEtapa([
    { id: 'tela', rotulo: rotuloDaTela, icone: 'usuario', ativa: !consulta },
    { id: 'consulta', rotulo: 'Consulta', icone: 'search', ativa: consulta },
  ], id => setConsulta(id === 'consulta'));
  return consulta;
}

export function ConsultaDeNotas({ tipos }: { tipos: readonly [TipoConsultado, TipoConsultado] }) {
  const vm = useConsultaDeNotas(tipos);
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Consulta de notas</h2></div></header>
      <Segmentado<TipoConsultado> valor={vm.tipo} onMudar={vm.escolherTipo} opcoes={vm.tipos} />
      {vm.carregando ? null : !vm.total ? (
        <div className="gh-box">
          <div className="gh-blank">
            <Icone nome="search" />
            <h4>Nenhuma nota de {vm.rotulo.toLowerCase()} nos meses da etapa</h4>
            <p>Importe {vm.rotulo} na Importação.</p>
          </div>
        </div>
      ) : (
        <div className="gh-box">
          <div className="gh-box-head cons-head">
            <div className="gh-search cons-busca">
              <input type="text" value={vm.busca} autoComplete="off" aria-label="Buscar nota"
                placeholder={vm.servico ? 'Procurar por participante, nota ou lançamento' : 'Procurar por participante, nota, CFOP ou lançamento'}
                onChange={ev => vm.buscar(ev.target.value)} />
              {vm.busca && <button type="button" className="gh-search-clear" title="Limpar busca" aria-label="Limpar busca" onClick={() => vm.buscar('')}>&times;</button>}
              <button type="button" className="gh-search-btn" title="Pesquisar" aria-label="Pesquisar"><Icone nome="search" /></button>
            </div>
          </div>
          <p className="cons-resumo">
            <b>{vm.qtd}</b> {vm.qtd === 1 ? 'nota' : 'notas'}{vm.qtd !== vm.total && <> <span>de {vm.total}</span></>}
            <span className="cons-sep">·</span><b>{vm.soma}</b>
          </p>
          {!vm.qtd ? (
            <div className="gh-blank">
              <Icone nome="search" />
              <h4>Nenhuma nota bate com a busca</h4>
              <p>Tente outro nome, número, CFOP ou lançamento.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="cons-tabela">
                  <thead>
                    <tr>
                      <Th o={vm.ordem} ordenar={vm.ordenar} campo="data" rotulo="Data" />
                      <Th o={vm.ordem} ordenar={vm.ordenar} campo="numero" rotulo="Nota" />
                      <Th o={vm.ordem} ordenar={vm.ordenar} campo="nome" rotulo="Participante" />
                      {vm.servico ? <Th o={vm.ordem} ordenar={vm.ordenar} campo="iss" rotulo="Valor de ISS" num /> : <Th o={vm.ordem} ordenar={vm.ordenar} campo="cfop" rotulo="CFOP" />}
                      <Th o={vm.ordem} ordenar={vm.ordenar} campo="lanc" rotulo="Lançamento" />
                      <Th o={vm.ordem} ordenar={vm.ordenar} campo="valor" rotulo={vm.servico ? 'Valor' : 'Valor (R$)'} num />
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(l => (
                      <tr key={l.chave}>
                        <td className="cons-data">{l.data}</td>
                        <td className="cons-mut">{l.numero}</td>
                        <td className="cons-nome" title={l.nome}>{l.nome}</td>
                        {vm.servico ? <td className="num cons-mut">{l.iss}</td> : <td className="cons-mut">{l.cfop || '—'}</td>}
                        <td className="cons-mut">{l.lanc || '—'}</td>
                        <td className="num cons-valor">{l.valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {vm.corte > 0 && <p className="cons-rodape">Mostrando {vm.corte} de {vm.qtd} notas. Refine a busca.</p>}
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** O título da coluna que ordena, como na Consulta do Concilia aí (▲ ▼). */
function Th({ o, ordenar, campo, rotulo, num }: { o: Pick<c.FiltroConsulta, 'sortCol' | 'sortDir'>; ordenar: (campo: c.CampoOrdem) => void; campo: c.CampoOrdem; rotulo: string; num?: boolean }) {
  const ativo = o.sortCol === campo;
  return (
    <th className={'th-sort' + (num ? ' num' : '')} onClick={() => ordenar(campo)}>
      {rotulo}<span className="th-sort-ico">{ativo ? (o.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
    </th>
  );
}
