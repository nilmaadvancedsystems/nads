// A Baixa no caixa no minimum (26/11/2026: "Quero fazer a baixa no caixa conta 5 e contra partida 16"; "The user import the file and
// you give me the output to import in SCI"): sobe a "Impressão de campos da consulta" do SCI; em cima, o caixa e o histórico da
// baixa; embaixo, as baixas (D Caixa × C Clientes, com o cliente a crédito) e a planilha do gerador do SCI. No jeito do Extrato → SCI.
// Só desenha: tudo vem do ViewModel.
import { sci } from '@nads/core';
import { Icone, LogoExcel, MenuSuspenso } from '@nads/ui';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { AcoesDoTopo } from '../../../../comum/topo';
import { BalaoDeGuia } from './BalaoDeGuia';
import { ContaNaTabela, HistoricoNaTabela } from './CelulasDaTabela';
import { useBaixaNoCaixa, type VmBaixaNoCaixa } from './useBaixaNoCaixa';
import type { VmShadersCi } from './useShadersCi';

export function BaixaNoCaixa({ min }: { min: VmShadersCi }) {
  const vm = useBaixaNoCaixa(min);
  const campo = useRef<HTMLInputElement>(null);
  const escolher = () => campo.current?.click();
  // sem consulta, a janela de trazer o arquivo já abre, como no Visualizar lançamentos
  const [janela, setJanela] = useState(() => !vm.temConsulta);
  useEffect(() => { if (vm.temConsulta) setJanela(false); }, [vm.temConsulta]);
  return (
    <>
      <AcoesDoTopo>
        <button type="button" className="btn btn-outline sci-btn-icone" onClick={vm.voltar} title="Voltar aos apps" aria-label="Voltar aos apps"><Icone nome="chevronLeft" /></button>
        {vm.dev && (
          <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={300} titulo="Modo desenvolvedor · fica só neste navegador"
            itens={[
              { rotulo: 'Consulta de exemplo (fictícia)', icone: 'zap', onClick: vm.carregarExemplo },
              'separador',
              { rotulo: 'Tirar a consulta da tela', icone: 'x', desabilitado: !vm.temConsulta, onClick: vm.limpar },
            ]} />
        )}
        {vm.temConsulta
          ? <button type="button" className="btn btn-outline" onClick={escolher} disabled={vm.lendo}><Icone nome="upload" />{vm.lendo ? 'Lendo…' : 'Outra consulta'}</button>
          : (
            <BalaoDeGuia lado="direita" texto={<>Importe as vendas do SCI em <b>.xls</b>, <b>.xlsx</b> ou <b>.csv</b> (a "Impressão de campos da consulta")</>}>
              <button type="button" className="btn btn-primary sci-btn-pulsa" onClick={escolher} disabled={vm.lendo}><Icone nome="upload" />{vm.lendo ? 'Lendo…' : 'Importar a consulta'}</button>
            </BalaoDeGuia>
          )}
        {vm.temConsulta && (
          <button type="button" className="btn btn-primary" disabled={!vm.lancamentos.length} onClick={vm.baixar}
            title="A planilha do gerador do SCI (modelo nads: linha inicial 2, descarta 1 no fim). As baixas com problema vão na aba Conferir.">
            <LogoExcel />Baixar planilha do SCI{vm.prontos > 0 && <span className="menu-contador">{vm.prontos}</span>}
          </button>
        )}
      </AcoesDoTopo>
      <input ref={campo} type="file" accept=".xls,.xlsx,.csv" hidden onChange={e => { void vm.importar(e.target.files?.[0]); e.target.value = ''; }} />
      {janela && !vm.temConsulta && <JanelaDoArquivo vm={vm} escolher={escolher} fechar={() => setJanela(false)} />}
      {vm.temConsulta && <BaixasAbertas vm={vm} />}
    </>
  );
}

function JanelaDoArquivo({ vm, escolher, fechar }: { vm: VmBaixaNoCaixa; escolher: () => void; fechar: () => void }) {
  const [arrastando, setArrastando] = useState(false);
  useEffect(() => {
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const soltar = (e: DragEvent) => { e.preventDefault(); setArrastando(false); void vm.importar(e.dataTransfer.files[0]); };
  return createPortal(
    <div className="sci-paleta-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className={'sci-upload' + (arrastando ? ' arrastando' : '')} role="dialog" aria-modal="true" aria-label="Baixa no caixa"
        onDragOver={e => { e.preventDefault(); setArrastando(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setArrastando(false); }} onDrop={soltar}>
        <button type="button" className="icon-btn sci-upload-fechar" onClick={fechar} title="Fechar (Esc)" aria-label="Fechar"><Icone nome="x" /></button>
        <span className="sci-upload-icone" aria-hidden="true"><Icone nome="upload" /></span>
        <h3>Baixa no caixa</h3>
        <p>Traga a <b>Impressão de campos da consulta</b> com as vendas, exportada do SCI em <b>.xls</b>, <b>.xlsx</b> ou <b>.csv</b>. Cada venda a prazo vira a baixa no caixa, pronta para importar no SCI.</p>
        <div className="sci-upload-area">
          <Icone nome="upload" />
          <span>{vm.lendo ? 'Lendo a consulta…' : 'Arraste o arquivo para cá'}</span>
          <span className="hint">ou</span>
          <button type="button" className="btn btn-primary" onClick={escolher} disabled={vm.lendo}>Escolher o arquivo</button>
        </div>
        <p className="hint sci-upload-pe">Fica só neste navegador, nesta empresa. Nada vai para o banco.</p>
      </div>
    </div>,
    document.body,
  );
}

function BaixasAbertas({ vm }: { vm: VmBaixaNoCaixa }) {
  return (
    <>
      {/* em cima, como no Extrato → SCI: o caixa e o histórico da baixa (o padrão do plano: a conta CX e o 477) e o lote */}
      <div className="sci-razao-filtros">
        <div className="sci-razao-filtro">
          <label className="sci-razao-rotulo" htmlFor="sci-bx-caixa">Caixa (débito)</label>
          <input id="sci-bx-caixa" type="text" className="sci-ext-lote" value={vm.caixa} autoComplete="off" onChange={e => vm.mudarCaixa(e.target.value)}
            title={'A conta do caixa no SCI (o padrão do plano ' + vm.plano + ' é a ' + vm.padrao.caixa + ')'} />
          <span className="hint">{vm.nomeDoCaixa || 'fora do plano'}</span>
        </div>
        <div className="sci-razao-filtro">
          <label className="sci-razao-rotulo" htmlFor="sci-bx-hist">Histórico</label>
          <input id="sci-bx-hist" type="text" className="sci-ext-lote" value={vm.historico} autoComplete="off" onChange={e => vm.mudarHistorico(e.target.value)}
            title={'O número do histórico padrão do SCI (o padrão é o ' + vm.padrao.historico + ')'} />
          <span className="hint">{vm.nomeDoHistorico || 'fora do plano de históricos'}</span>
        </div>
        <div className="sci-razao-filtro">
          <span className="sci-razao-rotulo">Lote</span>
          <span>{vm.lote}</span>
        </div>
      </div>

      <section className="card ini-grupo sci-tabela-card">
        <div className="table-wrap sci-tabela-caixa">
          <table className="table-compact ini-delegadas sci-tabela">
            <thead>
              <tr><th>Data</th><th>Débito</th><th>Crédito</th><th className="num">Valor</th><th>Histórico</th><th>Doc.</th><th title="O cliente, a crédito (código no SCI)">Part. C</th><th aria-label="Situação" /></tr>
            </thead>
            <tbody>
              {vm.lancamentos.map((l, i) => (
                <tr key={i} className={'ini-tr' + (i % 2 ? ' sci-zebra' : '')} title={l.problemas.join('\n') || undefined}>
                  <td className="ini-delegadas-curta">{sci.dataParaTexto(l.data)}</td>
                  <td><ContaNaTabela codigo={l.debito} nome={l.nomeD} lado="debito" /></td>
                  <td><ContaNaTabela codigo={l.credito} nome={l.nomeC} lado="credito" /></td>
                  <td className="num sci-valor">{sci.valorParaTexto(l.valor)}</td>
                  <td className="sci-hist"><HistoricoNaTabela codigo={l.historico} nome={vm.nomeDoHistorico} complemento={l.complemento} /></td>
                  <td className="ini-delegadas-curta">{l.documento}</td>
                  <td className="ini-delegadas-curta">{l.participanteC}</td>
                  <td className="ini-delegadas-curta">{l.problemas.length ? <span className="hint sci-falta"><Icone nome="alert" />{l.problemas[0]}</span> : <span className="hint"><Icone nome="check" /></span>}</td>
                </tr>
              ))}
              {!vm.lancamentos.length && <tr><td colSpan={8} className="hint sci-razao-nada">Nenhuma venda a prazo para baixar nesta consulta.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="sci-razao-registros">
        Baixas: <b>{vm.lancamentos.length}</b> · <b className="num">R$ {sci.valorParaTexto(vm.total)}</b> · prontas para o SCI: <b>{vm.prontos}</b>
        {vm.jaBaixadas > 0 && <> · {vm.jaBaixadas === 1 ? '1 venda já baixada' : vm.jaBaixadas + ' vendas já baixadas'} na consulta</>}
        {vm.outras > 0 && <> · {vm.outras === 1 ? '1 linha não é venda' : vm.outras + ' linhas não são venda'}</>}
      </p>
      <p className="hint sci-razao-pe">Consulta: {vm.arquivo}</p>
    </>
  );
}
