// A janela Importar planilha (15/10/2026: "quero que ele leia uma planilha com clientes que já pagaram para gerar para mim"):
// escolhe o arquivo do banco (xlsx, xls ou csv) → a prévia de uma nota por linha, com a situação de cada uma (pronta, ou o
// que falta) → "Emitir N notas". Só as prontas vêm marcadas; a linha com problema não se marca.
import { formatos } from '@nads/core';
import { BotaoFechar, CampoArquivos, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { dataBr, documentoFormatado } from './formatosDaNota';
import { useImportarPlanilha } from './useImportarPlanilha';

export function JanelaImportarPlanilha({ fechar }: { fechar: () => void }) {
  const vm = useImportarPlanilha();
  const r = vm.resumo;
  const emitindo = !!vm.progresso;

  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela) (emitindo, não fecha)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, emitindo ? null : fechar);

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !emitindo) fechar(); }}>
      <div ref={janela} className="modal registro-novo nf-importar" role="dialog" aria-modal="true" aria-label="Importar planilha">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Notas fiscais<Icone nome="chevronRight" /><b>Importar planilha</b></span>
          {vm.ambiente === 'homologacao' && <span className="badge badge-warn">Homologação — sem valor fiscal</span>}
          <BotaoFechar onClick={fechar} disabled={emitindo} />
        </header>

        <div className="registro-corpo">
          <div className="nf-importar-arquivo">
            <CampoArquivos id="nf-planilha" aceitar=".xlsx,.xls,.csv" rotulo={vm.arquivo ? 'Trocar a planilha (' + vm.arquivo + ')' : 'Escolher a planilha de recebimentos'} compacto={!!vm.arquivo}
              desabilitado={emitindo || vm.lendo} onEscolher={fs => { void vm.lerArquivo(fs[0]); }} />
            {vm.arquivo && <span className="fraco">{vm.arquivo}</span>}
          </div>
          {!vm.arquivo && <p className="registro-dica">A planilha do banco, sem cabeçalho: código do cliente "(00000)", nome, data do pagamento e valor. A data da nota é a da planilha.</p>}
          {vm.lendo && <p className="registro-dica"><span className="btn-spinner nf-roda" aria-hidden="true" />Lendo a planilha e o cadastro dos clientes…</p>}
          {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

          {r.total > 0 && (
            <>
              <div className="nf-resumo">
                <span><b>{r.total}</b> linhas</span>
                <span><b>{r.prontas}</b> prontas</span>
                <span><b>{r.comProblema}</b> com problema</span>
                <span>Total <b>{formatos.reais(r.valor)}</b></span>
                {vm.enderecos.total > 0 && (
                  <span className="fraco nf-resumo-end">
                    {vm.enderecos.andando && <span className="btn-spinner nf-roda" aria-hidden="true" />}
                    Endereços: {vm.enderecos.feitos} de {vm.enderecos.total}
                    {vm.enderecos.falharam > 0 && !vm.enderecos.andando && <button type="button" className="btn btn-ghost" onClick={vm.buscarDeNovo}>Buscar de novo ({vm.enderecos.falharam})</button>}
                  </span>
                )}
              </div>
              {vm.avisos.length > 0 && <p className="registro-dica" title={vm.avisos.join('\n')}><Icone nome="alert" />{vm.avisos.length} {vm.avisos.length === 1 ? 'linha ignorada' : 'linhas ignoradas'} da planilha (passe o mouse).</p>}

              <div className="table-wrap nf-importar-lista">
                <table className="tabela-empresas cad-lista nf-lista">
                  <thead>
                    <tr>
                      <th><input type="checkbox" checked={vm.todasMarcadas} onChange={vm.marcarTodas} disabled={emitindo || !r.prontas} aria-label="Marcar todas as prontas" /></th>
                      <th>Código</th><th>Cliente</th><th>CPF/CNPJ</th><th className="nf-direita">Valor</th><th>Data</th><th>Descrição</th><th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(l => (
                      <tr key={l.indice} className={l.pronta ? undefined : 'nf-sem-marca'}>
                        <td><input type="checkbox" checked={l.marcada} disabled={!l.pronta || emitindo} onChange={() => vm.marcar(l.indice)} aria-label={'Emitir a nota de ' + l.cliente} /></td>
                        <td className="num">{l.codigo}</td>
                        <td><span className="nf-corta" title={l.cliente}>{l.cliente}</span></td>
                        <td className="num fraco">{l.documento ? documentoFormatado(l.documento) : '—'}</td>
                        <td className="num nf-direita">{formatos.reais(l.valor)}</td>
                        <td className="num fraco">{dataBr(l.data)}</td>
                        <td><span className="nf-corta" title={l.descricao}>{l.descricao}</span></td>
                        <td><span className={'badge badge-' + l.tom}>{l.buscando && <span className="btn-spinner nf-roda" aria-hidden="true" />}{l.situacao}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {vm.faltas.length > 0 && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />Para emitir, falta: {vm.faltas.join(', ')}. Veja Financeiro › Configurações.</p>}
        </div>

        <footer className="registro-pe">
          {vm.progresso && <span className="registro-pe-rotulo"><span className="btn-spinner nf-roda" aria-hidden="true" />Pedindo: {vm.progresso.feitas} de {vm.progresso.total}</span>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar} disabled={emitindo}>Fechar</button>
          <button type="button" className="btn btn-primary" disabled={!vm.marcadas || emitindo || vm.faltas.length > 0} onClick={() => void vm.emitir()}
            title={vm.faltas.length ? 'Falta configurar o emissor' : undefined}>
            {emitindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="check" />}
            Emitir {vm.marcadas} {vm.marcadas === 1 ? 'nota' : 'notas'} ({formatos.reais(vm.totalMarcado)})
          </button>
        </footer>
      </div>
    </div>
  );
}
