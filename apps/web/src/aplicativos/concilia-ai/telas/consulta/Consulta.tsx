// Movimento › Consulta de notas (conferencia.html ~L1246-1254; renderConsulta ~L3018-3070;
// thSort ~L2976; consTipoHtml ~L2953; "Baixar CSV" do topo ~L1980).
import { type conferencia as c, formatos } from '@nads/core';
import { baixarArquivo, CampoData, Icone, Segmentado } from '@nads/ui';
import { AcoesDoTopo } from '../../../../comum/topo';
import { useConsulta } from './useConsulta';

const { reais } = formatos;
type Vm = ReturnType<typeof useConsulta>;

export function Consulta() {
  const vm = useConsulta();
  const g = vm.aba;
  return (
    <section>
      <AcoesDoTopo>
        <button className="btn btn-primary" type="button" onClick={() => { const a = vm.csv(); baixarArquivo(a.texto, a.nome); }}>Baixar CSV</button>
      </AcoesDoTopo>

      <Segmentado id="consSeg" valor={vm.aba} opcoes={vm.abas} onMudar={vm.escolherAba} />

      <div id={'consulta-' + g}>
        {vm.vazia ? (
          <div className="gh-box">
            <div className="gh-blank">
              <Icone nome="search" />
              <h4>{vm.serv ? 'Nenhuma nota de serviço guardada' : 'Nenhuma nota fiscal guardada'}</h4>
              <p>Importe {vm.serv ? 'Tomados ou Prestados' : 'Entradas ou Saídas'} em Importação.</p>
            </div>
          </div>
        ) : (
          <div className="gh-box">
            <div className="gh-box-head cons-head">
              <div className="gh-search cons-busca">
                <input type="text" id={'fQ-' + g} value={vm.rascunho.q} autoComplete="off"
                  placeholder={vm.serv ? 'Procurar por participante, nota ou lançamento' : 'Procurar por participante, nota, CFOP ou lançamento'}
                  onChange={ev => vm.setBusca(ev.target.value)} onKeyDown={ev => { if (ev.key === 'Enter') vm.pesquisar(); }} />
                {vm.temBusca && <button type="button" className="gh-search-clear" title="Limpar busca" aria-label="Limpar busca" onClick={vm.limparBusca}>&times;</button>}
                <button type="button" className="gh-search-btn" title="Pesquisar" aria-label="Pesquisar" onClick={vm.pesquisar}><Icone nome="search" /></button>
              </div>
              <div className="gh-box-filters">
                <span>Período</span>
                <CampoData id={'fDe-' + g} valor={vm.rascunho.de} onMudar={vm.setDe} rotulo="Data inicial" onEnter={vm.pesquisar} />
                <span>até</span>
                <CampoData id={'fAte-' + g} valor={vm.rascunho.ate} onMudar={vm.setAte} rotulo="Data final" onEnter={vm.pesquisar} />
                <button type="button" className="btn" onClick={vm.pesquisar}>Filtrar</button>
                {vm.temPeriodo && <button type="button" className="btn" onClick={vm.limparPeriodo}>Limpar</button>}
              </div>
            </div>
            <p className="cons-resumo">
              <b>{vm.qtd}</b> {vm.qtd === 1 ? 'nota' : 'notas'}{vm.filtrado && <> <span>de {vm.qtdTotal}</span></>}
              <span className="cons-sep">·</span><b>{reais(vm.total)}</b>
            </p>
            {!vm.qtd ? (
              <div className="gh-blank">
                <Icone nome="search" />
                <h4>Nenhuma nota bate com a busca</h4>
                <p>Tente outro nome, número, CFOP ou período.</p>
              </div>
            ) : <TabelaConsulta vm={vm} />}
          </div>
        )}
      </div>
    </section>
  );
}

function TabelaConsulta({ vm }: { vm: Vm }) {
  const th = (campo: c.CampoOrdem, rotulo: string, extra?: string) => {
    const ativo = vm.ordem.col === campo;
    return (
      <th className={'th-sort' + (extra ? ' ' + extra : '')} onClick={() => vm.ordenar(campo)}>
        {rotulo}<span className="th-sort-ico">{ativo ? (vm.ordem.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
      </th>
    );
  };
  return (
    <>
      <div className="table-wrap">
        <table className="cons-tabela">
          <thead>
            <tr>
              {th('tipo', 'Tipo')}{th('data', 'Data')}{th('numero', 'Nota')}{th('nome', 'Participante')}
              {vm.serv ? th('iss', 'Valor de ISS', 'num') : th('cfop', 'CFOP')}{th('lanc', 'Lançamento')}{th('valor', vm.serv ? 'Valor' : 'Valor (R$)', 'num')}
            </tr>
          </thead>
          <tbody>
            {vm.linhas.map((n, i) => {
              const t = vm.tipos.find(x => x.tipo === n.tipo);
              return (
                <tr key={i}>
                  <td>{t && <span className="cons-tipo"><i style={{ background: t.cor }} />{t.rotulo}</span>}</td>
                  <td className="cons-data">{n.data}</td>
                  <td className="cons-mut">{n.numero}</td>
                  <td className="cons-nome" title={n.nome}>{n.nome}</td>
                  {vm.serv ? <td className="num cons-mut">{reais(n.iss)}</td> : <td className="cons-mut">{n.cfop || '—'}</td>}
                  <td className="cons-mut">{n.lanc || '—'}</td>
                  <td className="num cons-valor">{reais(n.valor)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {vm.qtd > vm.limite && <p className="cons-rodape">Mostrando {vm.limite} de {vm.qtd} notas. Refine a busca ou baixe o CSV.</p>}
    </>
  );
}
