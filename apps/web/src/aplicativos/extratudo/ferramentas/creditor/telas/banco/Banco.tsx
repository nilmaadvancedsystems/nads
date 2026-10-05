// Etapa 2 do Creditor: o relatório de liquidação do banco, no visual da Importação (Vitor, 05/10/2026: "se tiver
// importado do Drive, faça da mesma maneira que a tela de importação"). Em cima, a competência e quantos títulos; a
// linha do relatório com o resumo no meio, o check (ou o logo do Drive) que exclui e a seta que abre os títulos.
import { creditor as cr } from '@nads/core';
import { Alerta, Icone, LogoDrive, MenuSuspenso } from '@nads/ui';
import { useRef, useState } from 'react';
import { useBanco } from './useBanco';

export function Banco() {
  const vm = useBanco();
  const arquivo = useRef<HTMLInputElement>(null);
  const [aberta, setAberta] = useState(false);
  const l = vm.lido;
  return (
    <section>
      <div className={'imp-topo' + (vm.lendo ? ' travado' : '')} aria-busy={vm.lendo}>
        <span className="imp-periodo-info"><Icone nome="calendar" />{vm.competencia}</span>
        <span className="imp-topo-num"><Icone nome="recibo" /><b>{l ? l.qtd : 0}</b> {l?.qtd === 1 ? 'título' : 'títulos'}</span>
        <span className="imp-topo-meio" />
        <button type="button" className="btn btn-primary" disabled={!vm.podeContinuar} onClick={vm.continuar}>Continuar</button>
      </div>

      <div className="imp-lista">
        <div className={'imp-bloco' + (l ? ' imp-ok' : '')}>
          <div className="imp-linha">
            <button type="button" className={'imp-seta' + (aberta && l ? ' aberta' : '')} aria-expanded={aberta && !!l} disabled={!l}
              title={aberta ? 'Fechar os títulos' : 'Ver os títulos do relatório'} aria-label="Títulos do relatório" onClick={() => setAberta(a => !a)}>
              <Icone nome="caretDown" />
            </button>
            <span className="imp-ico imp-logo"><Icone nome="recibo" /></span>
            <div className="imp-txt"><span><b>Relatório de liquidação</b></span></div>
            <div className="imp-resumo">
              {vm.lendo ? <div><span>Lendo…</span></div> : l && <div>{l.resumo.map(t => <span key={t}>{t}</span>)}</div>}
            </div>
            <div className="imp-grupos">
              <div className="imp-grupo" aria-label="Relatório de liquidação">
                <span className="imp-rotulo">Relatório</span>
                {l ? (
                  // importado: o check (ou o logo do Drive) que, com o mouse em cima, vira o × e exclui — igual à Importação
                  <button type="button" className={'icon-btn icon-btn-sm imp-btn imp-feito' + (l.doDrive ? ' imp-feito-drive' : '')} onClick={vm.excluir}
                    title={'Importado: ' + l.origem + '. Clique para excluir.'} aria-label="Excluir o relatório de liquidação">
                    {l.doDrive ? <span className="imp-feito-ok"><LogoDrive cor /></span> : <Icone nome="check" className="imp-feito-ok" />}
                    <Icone nome="x" className="imp-feito-x" />
                  </button>
                ) : vm.lendo ? <span className="btn-spinner" /> : (
                  <>
                    <MenuSuspenso rotulo="" icone="upload" className="gh-topo-btn gh-topo-menu imp-mes-menu" direita dica="Importar o relatório de liquidação"
                      itens={[
                        { rotulo: 'Importar do computador', icone: 'upload', onClick: () => arquivo.current?.click() },
                        { rotulo: 'Testar com o exemplo', icone: 'fileText', onClick: vm.exemplo },
                      ]} />
                    <input ref={arquivo} type="file" accept={vm.aceitar} className="sr-only" tabIndex={-1} aria-hidden="true"
                      onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; vm.importar(f); }} />
                  </>
                )}
              </div>
            </div>
          </div>
          {l && aberta && <Titulos titulos={l.titulos} />}
        </div>
      </div>

      {vm.erro && <Alerta titulo="Não foi possível ler o relatório" texto={vm.erro} onFechar={vm.fecharErro} />}
      {l && l.avisos.length > 0 && (
        <Alerta titulo="Confira">
          {l.avisos.map((a, i) => <p key={i} className="alert-text">{a}</p>)}
        </Alerta>
      )}
    </section>
  );
}

/** Os títulos do relatório, como o movimento do extrato na Importação: a busca em cima e a tabela. */
function Titulos({ titulos }: { titulos: NonNullable<ReturnType<typeof useBanco>['lido']>['titulos'] }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const linhas = q ? titulos.filter(t => [t.liquidacao, t.sacado, t.nf, cr.brl(t.valor)].join(' ').toLowerCase().includes(q)) : titulos;
  return (
    <div className="imp-mov-caixa">
      <div className="imp-mov-topo">
        <label className="busca-curta imp-mov-busca">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar no relatório" aria-label="Buscar no relatório (data, cliente, nota ou valor)" value={busca}
            onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setBusca(''); }} />
        </label>
        {q && <span className="imp-mov-periodo" aria-live="polite"><b>{linhas.length}</b> {linhas.length === 1 ? 'título' : 'títulos'} · {cr.brl(cr.somar(linhas.map(t => t.valor)))}</span>}
      </div>
      <div className="imp-mov">
        <table className="table-compact">
          <thead><tr>
            <th>Liquidação</th><th>Cliente</th><th>Nota</th><th className="num">Valor</th><th className="num">Juros</th><th className="num">Desconto</th><th className="num">Cobrado</th>
          </tr></thead>
          <tbody>
            {!linhas.length && <tr><td colSpan={7} className="hint">Nada com essa busca.</td></tr>}
            {linhas.map(t => (
              <tr key={t.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{t.liquidacao}</td>
                <td className="wrap">{t.sacado}</td>
                <td>{t.nf}</td>
                <td className="num">{cr.brl(t.valor)}</td>
                <td className="num">{t.juros ? cr.brl(t.juros) : ''}</td>
                <td className="num">{t.desconto ? cr.brl(t.desconto) : ''}</td>
                <td className="num">{t.cobrado != null ? cr.brl(t.cobrado) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
