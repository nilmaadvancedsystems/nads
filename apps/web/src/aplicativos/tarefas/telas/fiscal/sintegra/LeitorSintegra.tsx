// O leitor do SINTEGRA (15/10/2026): o campo do arquivo e, depois de ler, a empresa e o período, os avisos e quatro abas —
// o resumo por CFOP, a conferência com o SIEG, com o Alterdata e o que o validador recusaria. Usado na página SINTEGRA do
// Fiscal e no item "Entradas x SINTEGRA" da rotina (o ViewModel é o useLeitorSintegra).
// O visual (30/10/2026, "refazendo o fiscal inteiro"; o mesmo caminho do Gmail: parecer parte do site): sem arquivo, o
// Vazio com o campo no meio; com arquivo, a ficha do arquivo (a empresa, o CNPJ, o período e as notas) e um .card com as
// abas no topo, cada uma com o número do que há para olhar; as tabelas com o título e a contagem em cima.
import { formatos, tarefas as t } from '@nads/core';
import { Alerta, BotaoIcone, CampoArquivo, CampoArquivos, IconeDeArquivo, Segmentado, Stat, Vazio, formatoPeloNome } from '@nads/ui';
import type { AbaDoSintegra, VmLeitorSintegra } from './useLeitorSintegra';

const reais = (n: number) => 'R$ ' + formatos.brl(n);
const dataBr = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
const cnpjBr = (c: string) => (c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : c);
const notas = (n: number) => n + (n === 1 ? ' nota' : ' notas');

export function LeitorSintegra({ vm, id }: { vm: VmLeitorSintegra; id: string }) {
  const a = vm.arq;
  const campo = <CampoArquivo id={id} arquivo={vm.arquivo} onEscolher={f => void vm.ler(f)} aceitar=".txt,.TXT" />;
  return (
    <div className={'fs' + (vm.naEtapa ? ' fs-na-etapa' : '')}>
      {!vm.arquivo ? (
        <div className="fs-vazio">
          <Vazio icone="fileSearch" compacto={vm.naEtapa} titulo="Leia o arquivo do SINTEGRA"
            texto={vm.naEtapa
              ? 'Escolha o SINTEGRA (.txt) de ' + vm.rotuloCompetencia + ': o leitor resume por CFOP e confere com o SIEG, o Alterdata e o layout.'
              : 'Escolha o arquivo (.txt) do mês. O leitor acha a empresa e o período sozinho, resume por CFOP e confere com o SIEG, o Alterdata e o layout. O arquivo não é guardado: fica só na tela.'}>
            <div className="fs-vazio-campo">{campo}</div>
          </Vazio>
        </div>
      ) : (
        <div className="fs-ficha">
          <IconeDeArquivo formato={formatoPeloNome(vm.arquivo.name)} tamanho={36} />
          <div className="fs-ficha-texto">
            {vm.cab ? (
              <>
                <b className="fs-ficha-nome" title={vm.cab.razao}>{vm.cab.razao || cnpjBr(vm.cab.cnpj)}</b>
                <span className="fs-ficha-sub">
                  <span className="num">{cnpjBr(vm.cab.cnpj)}</span>
                  <span>{dataBr(vm.cab.inicio)} a {dataBr(vm.cab.fim)}</span>
                  {a && <span><b className="num">{a.notas.length}</b> {a.notas.length === 1 ? 'nota' : 'notas'}</span>}
                  {vm.empresa ? <span className="fs-ficha-cliente" title="O cliente do cadastro">{vm.empresa}</span> : !vm.naEtapa && <span className="fraco">fora do cadastro</span>}
                </span>
              </>
            ) : <b className="fs-ficha-nome">Arquivo sem o registro 10</b>}
          </div>
          <div className="fs-ficha-campo">{campo}</div>
        </div>
      )}
      {vm.avisos.map(x => <Alerta key={x} naLinha titulo={x} />)}
      {a && (
        <section className="card fs-cartao">
          <div className="fs-cartao-topo">
            <Segmentado<AbaDoSintegra> valor={vm.aba} onMudar={vm.setAba} opcoes={[
              { valor: 'resumo', rotulo: 'Resumo' },
              { valor: 'sieg', rotulo: 'SIEG' + (vm.pendenciasSieg != null ? ' · ' + vm.pendenciasSieg : '') },
              { valor: 'alterdata', rotulo: 'Alterdata' + (vm.pendenciasAlterdata != null ? ' · ' + vm.pendenciasAlterdata : '') },
              { valor: 'layout', rotulo: 'Layout · ' + a.problemas.length, ponto: a.problemas.length ? a.problemas.length + ' problemas no arquivo' : undefined },
            ]} />
            <span className="fs-cartao-dica">
              {vm.aba === 'resumo' ? 'Os valores do arquivo, sem as canceladas'
                : vm.aba === 'sieg' ? 'Nota a nota com os XMLs do SIEG'
                : vm.aba === 'alterdata' ? 'Por CFOP e nota a nota com o Alterdata'
                : 'O que o validador do SINTEGRA recusaria'}
            </span>
          </div>
          <div className="fs-cartao-corpo">
            {vm.aba === 'resumo' && vm.resumo && <Resumo r={vm.resumo} />}
            {vm.aba === 'sieg' && <ComSieg vm={vm} />}
            {vm.aba === 'alterdata' && <ComAlterdata vm={vm} id={id + '-alterdata'} />}
            {vm.aba === 'layout' && <Layout vm={vm} a={a} />}
          </div>
        </section>
      )}
    </div>
  );
}

function Resumo({ r }: { r: t.sintegra.ResumoSintegra }) {
  return (
    <>
      <div className="stat-grid fs-numeros">
        <Stat rotulo="Entradas" valor={reais(r.entradas.valor)} sub={notas(r.entradas.notas) + ' · ICMS ' + reais(r.entradas.icms)} />
        <Stat rotulo="Saídas" valor={reais(r.saidas.valor)} sub={notas(r.saidas.notas) + ' · ICMS ' + reais(r.saidas.icms)} />
        <Stat rotulo="Canceladas" valor={String(r.canceladas)} sub="fora dos valores" />
      </div>
      {!r.entradas.porCfop.length && !r.saidas.porCfop.length && <Vazio compacto icone="list" titulo="Nenhuma nota no arquivo" />}
      {([['Entradas por CFOP', r.entradas], ['Saídas por CFOP', r.saidas]] as const).filter(([, l]) => l.porCfop.length).map(([titulo, l]) => (
        <section key={titulo} className="fs-secao">
          <h4 className="fs-secao-titulo">{titulo}<span className="fs-conta">{l.porCfop.length} {l.porCfop.length === 1 ? 'CFOP' : 'CFOPs'}</span></h4>
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>CFOP</th><th className="num">Notas</th><th className="num">Valor</th><th className="num">Base ICMS</th><th className="num">ICMS</th><th className="num">Isenta</th><th className="num">Outras</th></tr></thead>
              <tbody>
                {l.porCfop.map(x => (
                  <tr key={x.cfop}><td className="fs-cfop">{x.cfop}</td><td className="num">{x.notas}</td><td className="num"><b>{reais(x.valor)}</b></td><td className="num">{reais(x.base)}</td><td className="num">{reais(x.icms)}</td><td className="num fraco">{reais(x.isenta)}</td><td className="num fraco">{reais(x.outras)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}

function ComSieg({ vm }: { vm: VmLeitorSintegra }) {
  if (!vm.competencia) return <Vazio compacto icone="calendar" titulo="Não sei o mês do arquivo" texto="O registro 10 não traz o período." />;
  if (!vm.temSieg || !vm.comSieg) return <Vazio compacto icone="download" titulo="Sem os XMLs do SIEG" texto={'Baixe os XMLs do SIEG de ' + vm.rotuloCompetencia + ' (no Download SIEG da rotina) para conferir nota a nota.'} />;
  const c = vm.comSieg;
  return (
    <>
      <div className="stat-grid fs-numeros">
        <Stat rotulo="Casadas" valor={String(c.casadas)} sub="iguais nos dois" />
        <NumeroDaConferencia rotulo="Só no SIEG" n={c.soNoSieg.length} sub="faltam no SINTEGRA" />
        <NumeroDaConferencia rotulo="Só no SINTEGRA" n={c.soNoSintegra.length} sub="o SIEG não tem" />
        <NumeroDaConferencia rotulo="Valor diferente" n={c.valorDiferente.length} sub="o mesmo número, outro valor" />
      </div>
      {vm.pendenciasSieg === 0 && <Alerta naLinha tom="ok" titulo="O SINTEGRA bate com o SIEG nota a nota." />}
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

/** Um número da conferência: em vermelho quando há o que olhar. */
function NumeroDaConferencia({ rotulo, n, sub }: { rotulo: string; n: number; sub: string }) {
  return <div className={'fs-numero' + (n ? ' fs-falta' : '')}><Stat rotulo={rotulo} valor={String(n)} sub={sub} /></div>;
}

/**
 * Os relatórios do Alterdata para comparar (29/10/2026): o de Entradas e o de Saídas (.xls/.xlsx/.csv, os mesmos que a
 * Conferência importa), vários de uma vez; a lista com o nome e quantas notas do mês, e o Tirar.
 */
function RelatoriosDoAlterdata({ vm, id }: { vm: VmLeitorSintegra; id: string }) {
  return (
    <section className="fs-relatorios" aria-label="Relatórios do Alterdata">
      <div className="fs-relatorios-topo">
        <div className="fs-relatorios-texto">
          <b>Relatórios do Alterdata{vm.relatorios.length > 0 && <span className="fraco"> · {vm.notasDosRelatorios} notas de {vm.rotuloCompetencia}</span>}</b>
          <span className="fraco">{vm.alterdataDosRelatorios ? 'Comparando com os relatórios abaixo.' : 'Sem relatório aqui, comparo com as Entradas e Saídas importadas na Conferência.'}</span>
        </div>
        <CampoArquivos id={id} aceitar=".xls,.xlsx,.csv" rotulo="Subir Entradas e Saídas" onEscolher={fs => void vm.lerRelatorios(fs)} />
      </div>
      {vm.relatorios.length > 0 && (
        <ul className="fs-relatorios-lista">
          {vm.relatorios.map(r => (
            <li key={r.id}>
              <IconeDeArquivo formato={formatoPeloNome(r.nome)} tamanho={28} />
              <span className="fs-relatorio-texto">
                <span className="fs-relatorio-nome" title={r.nome}>{r.nome}</span>
                <span className="fraco">{r.detalhe}</span>
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
  if (!vm.empresa && !vm.alterdataDosRelatorios) return <>{relatorios}<Vazio compacto icone="predio" titulo="Empresa fora do cadastro" texto="Não achei a empresa do arquivo no cadastro: suba os relatórios do Alterdata para comparar." /></>;
  if (!vm.comAlterdata) return <>{relatorios}<Vazio compacto icone="upload" titulo="Nada do Alterdata para comparar" texto={'Suba os relatórios de Entradas e Saídas de ' + vm.rotuloCompetencia + ' do Alterdata (ou importe na Conferência) para conferir.'} /></>;
  const c = vm.comAlterdata;
  return (
    <>
      {relatorios}
      {vm.pendenciasAlterdata === 0 && <Alerta naLinha tom="ok" titulo="O SINTEGRA bate com o Alterdata por CFOP e nota a nota." />}
      <section className="fs-secao">
        <h4 className="fs-secao-titulo">Por CFOP<span className="fs-conta">{vm.cfopsAlterdata.length} {vm.cfopsAlterdata.length === 1 ? 'CFOP' : 'CFOPs'}</span></h4>
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>CFOP</th><th className="num">Notas SINTEGRA</th><th className="num">Notas Alterdata</th><th className="num">Valor SINTEGRA</th><th className="num">Valor Alterdata</th><th className="num">Diferença</th></tr></thead>
            <tbody>
              {vm.cfopsAlterdata.map(x => (
                <tr key={x.cfop} className={x.bate ? '' : 'fs-linha-dif'}>
                  <td className="fs-cfop">{x.cfop}</td><td className="num">{x.notasSintegra}</td><td className="num">{x.notasAlterdata}</td>
                  <td className="num">{reais(x.valorSintegra)}</td><td className="num">{reais(x.valorAlterdata)}</td>
                  <td className="num">{x.bate ? <span className="badge badge-ok">bate</span> : <span className="badge badge-bad">{reais(x.dif)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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

function Layout({ vm, a }: { vm: VmLeitorSintegra; a: t.sintegra.ArquivoSintegra }) {
  return (
    <>
      {a.problemas.length === 0
        ? <Alerta naLinha tom="ok" titulo="O arquivo está dentro do layout do SINTEGRA." />
        : <Tabela titulo={a.problemas.length === 1 ? 'Problema que o validador recusaria' : 'Problemas que o validador recusaria'} cab={['Linha', 'Registro', 'Problema']}
          linhas={a.problemas.map(p => [p.linha ? String(p.linha) : '—', p.tipo, p.problema])} />}
      <section className="fs-secao">
        <h4 className="fs-secao-titulo">Registros no arquivo<span className="fs-conta">{vm.registros.length} tipos</span></h4>
        <ul className="fs-registros">
          {vm.registros.map(r => <li key={r.tipo}><b>{r.tipo}</b><span className="num">{r.quantos.toLocaleString('pt-BR')}</span></li>)}
        </ul>
      </section>
    </>
  );
}

/** Uma lista da conferência: o título com quantas linhas e a tabela; a coluna de reais à direita, o resto à esquerda. */
function Tabela({ titulo, cab, linhas }: { titulo: string; cab: string[]; linhas: string[][] }) {
  const emReais = cab.map((_, j) => linhas.some(l => /^R\$/.test(l[j] || '')));
  return (
    <section className="fs-secao">
      <h4 className="fs-secao-titulo">{titulo}<span className="fs-conta">{linhas.length}</span></h4>
      <div className="table-wrap">
        <table className="table-compact">
          <thead><tr>{cab.map((c, j) => <th key={c} className={emReais[j] ? 'num' : ''}>{c}</th>)}</tr></thead>
          <tbody>{linhas.map((l, i) => <tr key={i}>{l.map((c, j) => <td key={j} className={emReais[j] ? 'num' : /^[\d/.-]+$/.test(c) ? 'fs-cfop' : 'fs-texto'}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
