// O leitor do SINTEGRA (15/10/2026): o campo do arquivo e, depois de ler, a empresa e o período, os avisos e quatro abas —
// o resumo por CFOP, a conferência com o SIEG, com o Alterdata e o que o validador recusaria. Usado na página SINTEGRA do
// Fiscal e no item "Entradas x SINTEGRA" da rotina (o ViewModel é o useLeitorSintegra).
import { formatos, tarefas as t } from '@nads/core';
import { Alerta, BotaoIcone, CampoArquivo, CampoArquivos, IconeDeArquivo, Segmentado, formatoPeloNome } from '@nads/ui';
import type { AbaDoSintegra, VmLeitorSintegra } from './useLeitorSintegra';

const reais = (n: number) => 'R$ ' + formatos.brl(n);
const dataBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

export function LeitorSintegra({ vm, id }: { vm: VmLeitorSintegra; id: string }) {
  const a = vm.arq;
  return (
    <div className="sintegra">
      <div className="sintegra-topo">
        <CampoArquivo id={id} arquivo={vm.arquivo} onEscolher={f => void vm.ler(f)} aceitar=".txt,.TXT" />
        {a && vm.cab && (
          <span className="hint">
            {vm.cab.razao || vm.cab.cnpj} · {dataBr(vm.cab.inicio)} a {dataBr(vm.cab.fim)} · <b className="num">{a.notas.length}</b> notas
          </span>
        )}
      </div>
      {!a && <p className="hint sintegra-vazio">Escolha o arquivo do SINTEGRA (.txt) do mês.</p>}
      {vm.avisos.map(x => <Alerta key={x} naLinha titulo={x} />)}
      {a && (
        <>
          <Segmentado<AbaDoSintegra> valor={vm.aba} onMudar={vm.setAba} opcoes={[
            { valor: 'resumo', rotulo: 'Resumo' },
            { valor: 'sieg', rotulo: 'SIEG' + (vm.comSieg ? ' · ' + (vm.comSieg.soNoSieg.length + vm.comSieg.soNoSintegra.length + vm.comSieg.valorDiferente.length + vm.comSieg.situacaoDiferente.length) : '') },
            { valor: 'alterdata', rotulo: 'Alterdata' + (vm.comAlterdata ? ' · ' + (vm.comAlterdata.soNoAlterdata.length + vm.comAlterdata.soNoSintegra.length) : '') },
            { valor: 'layout', rotulo: 'Layout · ' + a.problemas.length, ponto: a.problemas.length ? a.problemas.length + ' problemas no arquivo' : undefined },
          ]} />
          {vm.aba === 'resumo' && vm.resumo && <Resumo r={vm.resumo} />}
          {vm.aba === 'sieg' && <ComSieg vm={vm} />}
          {vm.aba === 'alterdata' && <ComAlterdata vm={vm} id={id + '-alterdata'} />}
          {vm.aba === 'layout' && <Layout a={a} />}
        </>
      )}
    </div>
  );
}

function Resumo({ r }: { r: t.sintegra.ResumoSintegra }) {
  return (
    <>
      <div className="stat-grid sintegra-numeros">
        <div className="stat"><p className="stat-label">Entradas</p><p className="stat-value">{reais(r.entradas.valor)}</p><p className="hint">{r.entradas.notas} notas · ICMS {reais(r.entradas.icms)}</p></div>
        <div className="stat"><p className="stat-label">Saídas</p><p className="stat-value">{reais(r.saidas.valor)}</p><p className="hint">{r.saidas.notas} notas · ICMS {reais(r.saidas.icms)}</p></div>
        <div className="stat"><p className="stat-label">Canceladas</p><p className="stat-value">{r.canceladas}</p><p className="hint">fora dos valores</p></div>
      </div>
      {([['Entradas por CFOP', r.entradas], ['Saídas por CFOP', r.saidas]] as const).filter(([, l]) => l.porCfop.length).map(([titulo, l]) => (
        <div key={titulo} className="table-wrap">
          <table className="dp-tabela sintegra-tabela">
            <caption>{titulo}</caption>
            <thead><tr><th>CFOP</th><th className="num">Notas</th><th className="num">Valor</th><th className="num">Base ICMS</th><th className="num">ICMS</th><th className="num">Isenta</th><th className="num">Outras</th></tr></thead>
            <tbody>
              {l.porCfop.map(x => (
                <tr key={x.cfop}><td className="num">{x.cfop}</td><td className="num">{x.notas}</td><td className="num">{reais(x.valor)}</td><td className="num">{reais(x.base)}</td><td className="num">{reais(x.icms)}</td><td className="num fraco">{reais(x.isenta)}</td><td className="num fraco">{reais(x.outras)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function ComSieg({ vm }: { vm: VmLeitorSintegra }) {
  if (!vm.competencia) return <p className="hint sintegra-vazio">Não sei o mês do arquivo.</p>;
  if (!vm.temSieg || !vm.comSieg) return <p className="hint sintegra-vazio">Baixe os XMLs do SIEG de {vm.rotuloCompetencia} (no Download SIEG da rotina) para conferir nota a nota.</p>;
  const c = vm.comSieg;
  const tudoCerto = !c.soNoSieg.length && !c.soNoSintegra.length && !c.valorDiferente.length && !c.situacaoDiferente.length;
  return (
    <>
      <div className="stat-grid sintegra-numeros">
        <div className="stat"><p className="stat-label">Casadas</p><p className="stat-value">{c.casadas}</p></div>
        <div className={'stat' + (c.soNoSieg.length ? ' sintegra-falta' : '')}><p className="stat-label">Só no SIEG</p><p className="stat-value">{c.soNoSieg.length}</p><p className="hint">faltam no SINTEGRA</p></div>
        <div className={'stat' + (c.soNoSintegra.length ? ' sintegra-falta' : '')}><p className="stat-label">Só no SINTEGRA</p><p className="stat-value">{c.soNoSintegra.length}</p><p className="hint">o SIEG não tem</p></div>
        <div className={'stat' + (c.valorDiferente.length ? ' sintegra-falta' : '')}><p className="stat-label">Valor diferente</p><p className="stat-value">{c.valorDiferente.length}</p></div>
      </div>
      {tudoCerto && <Alerta naLinha tom="ok" titulo="O SINTEGRA bate com o SIEG nota a nota." />}
      {c.soNoSieg.length > 0 && (
        <Tabela titulo="No SIEG e não no SINTEGRA" cab={['Nota', 'Lado', 'Participante', 'Data', 'Valor']}
          linhas={c.soNoSieg.map(n => [n.numero + (n.serie ? '/' + n.serie : ''), n.entrada ? 'Entrada' : 'Saída', n.nome, n.data, reais(n.valor)])} />
      )}
      {c.soNoSintegra.length > 0 && (
        <Tabela titulo="No SINTEGRA e não no SIEG" cab={['Nota', 'Lado', 'CNPJ/CPF', 'Data', 'Valor']}
          linhas={c.soNoSintegra.map(n => [String(Number(n.numero)) + '/' + (n.serie || '0'), n.entrada ? 'Entrada' : 'Saída', n.cnpj, dataBr(n.data), reais(n.valor)])} />
      )}
      {c.valorDiferente.length > 0 && (
        <Tabela titulo="Valor diferente" cab={['Nota', 'Participante', 'No SINTEGRA', 'No SIEG']}
          linhas={c.valorDiferente.map(n => [n.numero, n.nome, reais(n.noSintegra), reais(n.noSieg)])} />
      )}
      {c.situacaoDiferente.length > 0 && (
        <Tabela titulo="Cancelada num lado e normal no outro" cab={['Nota', 'No SINTEGRA', 'No SIEG']}
          linhas={c.situacaoDiferente.map(n => [n.numero, n.noSintegra === 'N' ? 'normal' : 'situação ' + n.noSintegra, n.noSieg])} />
      )}
    </>
  );
}

/**
 * Os relatórios do Alterdata para comparar (29/10/2026): o de Entradas e o de Saídas (.xls/.xlsx/.csv, os mesmos que a
 * Conferência importa), vários de uma vez; a lista com o nome e quantas notas do mês, e o Tirar.
 */
function RelatoriosDoAlterdata({ vm, id }: { vm: VmLeitorSintegra; id: string }) {
  return (
    <section className="tdl-anexos" aria-label="Relatórios do Alterdata">
      <div className="tdl-anexos-topo">
        <h3 className="tdl-secao">Relatórios do Alterdata{vm.relatorios.length > 0 && <span className="fraco"> · {vm.notasDosRelatorios} notas de {vm.rotuloCompetencia}</span>}</h3>
        <CampoArquivos id={id} aceitar=".xls,.xlsx,.csv" rotulo="Subir Entradas e Saídas" onEscolher={fs => void vm.lerRelatorios(fs)} />
      </div>
      <p className="hint">
        {vm.alterdataDosRelatorios ? 'Comparando com os relatórios abaixo.' : 'Sem relatório aqui, comparo com as Entradas e Saídas importadas na Conferência.'}
      </p>
      {vm.relatorios.length > 0 && (
        <ul className="tdl-anexos-lista">
          {vm.relatorios.map(r => (
            <li key={r.id} className="tdl-anexo">
              <IconeDeArquivo formato={formatoPeloNome(r.nome)} tamanho={28} />
              <span className="tdl-anexo-texto">
                <span className="tdl-anexo-nome">{r.nome}</span>
                <span className="hint">{r.detalhe}</span>
              </span>
              <BotaoIcone icone="lixeira" titulo={'Tirar ' + r.nome} pequeno onClick={() => vm.tirarRelatorio(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ComAlterdata({ vm, id }: { vm: VmLeitorSintegra; id: string }) {
  const relatorios = <RelatoriosDoAlterdata vm={vm} id={id} />;
  if (!vm.empresa && !vm.alterdataDosRelatorios) return <>{relatorios}<p className="hint sintegra-vazio">Não achei a empresa do arquivo no cadastro: suba os relatórios do Alterdata para comparar.</p></>;
  if (!vm.comAlterdata) return <>{relatorios}<p className="hint sintegra-vazio">Suba os relatórios de Entradas e Saídas de {vm.rotuloCompetencia} do Alterdata (ou importe na Conferência) para conferir.</p></>;
  const c = vm.comAlterdata;
  return (
    <>
      {relatorios}
      <div className="table-wrap">
        <table className="dp-tabela sintegra-tabela">
          <caption>Por CFOP</caption>
          <thead><tr><th>CFOP</th><th className="num">Notas SINTEGRA</th><th className="num">Notas Alterdata</th><th className="num">Valor SINTEGRA</th><th className="num">Valor Alterdata</th><th className="num">Diferença</th></tr></thead>
          <tbody>
            {c.porCfop.map(x => {
              const dif = Math.round((x.valorSintegra - x.valorAlterdata) * 100) / 100;
              const bate = !dif && x.notasSintegra === x.notasAlterdata;
              return (
                <tr key={x.cfop} className={bate ? '' : 'sintegra-linha-dif'}>
                  <td className="num">{x.cfop}</td><td className="num">{x.notasSintegra}</td><td className="num">{x.notasAlterdata}</td>
                  <td className="num">{reais(x.valorSintegra)}</td><td className="num">{reais(x.valorAlterdata)}</td>
                  <td className="num">{bate ? <span className="badge badge-ok">bate</span> : <span className="badge badge-bad">{reais(dif)}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {c.soNoAlterdata.length > 0 && (
        <Tabela titulo="No Alterdata e não no SINTEGRA" cab={['Nota', 'CFOP', 'Participante', 'Data', 'Valor']}
          linhas={c.soNoAlterdata.map(n => [n.numero, n.cfop, n.nome, n.data, reais(n.valor)])} />
      )}
      {c.soNoSintegra.length > 0 && (
        <Tabela titulo="No SINTEGRA e não no Alterdata" cab={['Nota', 'CFOP', 'CNPJ/CPF', 'Data', 'Valor']}
          linhas={c.soNoSintegra.map(n => [String(Number(n.numero)), n.cfops.join(', '), n.cnpj, dataBr(n.data), reais(n.valor)])} />
      )}
    </>
  );
}

function Layout({ a }: { a: t.sintegra.ArquivoSintegra }) {
  const tipos = Object.entries(a.contagem).sort(([x], [y]) => x.localeCompare(y));
  return (
    <>
      {a.problemas.length === 0
        ? <Alerta naLinha tom="ok" titulo="O arquivo está dentro do layout do SINTEGRA." />
        : <Tabela titulo={a.problemas.length + (a.problemas.length === 1 ? ' problema que o validador recusaria' : ' problemas que o validador recusaria')} cab={['Linha', 'Registro', 'Problema']}
          linhas={a.problemas.map(p => [p.linha ? String(p.linha) : '—', p.tipo, p.problema])} />}
      <p className="hint">Registros no arquivo: {tipos.map(([tipo, q]) => tipo + ' (' + q + ')').join(', ')}.</p>
    </>
  );
}

function Tabela({ titulo, cab, linhas }: { titulo: string; cab: string[]; linhas: string[][] }) {
  return (
    <div className="table-wrap">
      <table className="dp-tabela sintegra-tabela">
        <caption>{titulo}</caption>
        <thead><tr>{cab.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j} className={/^R\$|^\d/.test(c) ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
