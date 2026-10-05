// Etapa Exclusão do Creditor, no visual da Importação: o que fazer no Alterdata numa linha, e a linha do banco com o
// razão (o ícone de importar; importado, o Ok verde ou o Não bate), o saldo final do extrato e do razão no meio e a
// seta com os dias que não batem.
import { Alerta, Icone, LogoBanco } from '@nads/ui';
import { useRef, useState } from 'react';
import { useExclusao } from './useExclusao';

export function Exclusao() {
  const vm = useExclusao();
  const arquivo = useRef<HTMLInputElement>(null);
  const [aberta, setAberta] = useState(false);
  const temDias = vm.dias.length > 0 || vm.partesFaltando.length > 0;
  return (
    <section>
      <p className="hint" style={{ marginTop: 0 }}>
        No Alterdata, importe o .xls do Creditor e exclua o lançamento do total (CRÉD.LIQ.COBRANÇA) que ele substituiu. Depois, reimporte aqui o razão da conta {vm.contaBanco}.
      </p>
      {!vm.banco ? (
        <Alerta titulo="Não achei o banco da conta" texto={'Nenhuma conta bancária do Cadastro está ligada à conta contábil ' + vm.contaBanco + '. Ligue no Cadastro da empresa (Contas bancárias).'} />
      ) : (
        <div className="imp-lista">
          <div className={'imp-bloco' + (vm.bate ? ' imp-ok' : '')}>
            <div className="imp-linha">
              <button type="button" className={'imp-seta' + (aberta && temDias ? ' aberta' : '')} aria-expanded={aberta && temDias} disabled={!temDias}
                title={aberta ? 'Fechar os dias' : 'Ver os dias que não batem'} aria-label="Os dias que não batem" onClick={() => setAberta(a => !a)}>
                <Icone nome="caretDown" />
              </button>
              <span className="imp-ico imp-logo"><LogoBanco banco={vm.banco.marca || ''} cor /></span>
              <div className="imp-txt"><span><b>{vm.banco.nome}</b>{vm.banco.conta && <span className="imp-conta">{vm.banco.conta}</span>}</span></div>
              <div className="imp-resumo">
                {vm.lendo ? <div><span>Lendo…</span></div> : vm.resumo.length > 0 && <div>{vm.resumo.map(t => <span key={t}>{t}</span>)}</div>}
              </div>
              <div className="imp-grupos">
                {vm.temRazao && (vm.bate
                  ? <span className="badge badge-ok" title="O saldo do razão bate com o do extrato, dia a dia e no fim do período">Ok</span>
                  : vm.partesFaltando.length
                    ? <span className="badge badge-bad" title="As partes do .xls do Creditor ainda não estão no razão: importe o .xls no Alterdata e exclua o total">Faltam {vm.partesFaltando.length} partes</span>
                    : <span className="badge badge-bad" title={'Diferença no fim do período: ' + vm.diferencaFinal}>Não bate</span>)}
                <div className="imp-grupo" aria-label="Razão da conta">
                  <span className="imp-rotulo">Razão</span>
                  {vm.lendo ? <span className="btn-spinner" /> : vm.temRazao ? (
                    // importado: o check que, com o mouse em cima, vira o × e exclui — igual à Importação
                    <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.excluirRazao}
                      title={'Importado: ' + vm.nomeDoRazao + '. Clique para excluir.'} aria-label="Excluir o razão importado">
                      <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                    </button>
                  ) : (
                    <>
                      <button type="button" className="icon-btn icon-btn-sm imp-btn" title={'Importar o razão da conta ' + vm.contaBanco}
                        aria-label="Importar o razão da conta" onClick={() => arquivo.current?.click()}>
                        <Icone nome="upload" />
                      </button>
                      <input ref={arquivo} type="file" accept=".xls,.xlsx,.csv,.txt,.pdf" className="sr-only" tabIndex={-1} aria-hidden="true"
                        onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; vm.importarRazao(f); }} />
                    </>
                  )}
                </div>
              </div>
            </div>
            {aberta && vm.partesFaltando.length > 0 && (
              <div className="imp-mov-caixa">
                <div className="imp-mov">
                  <table className="table-compact">
                    <thead><tr><th>Dia</th><th>Parte do .xls que não está no razão</th><th className="num">Valor</th></tr></thead>
                    <tbody>
                      {vm.partesFaltando.map((p, i) => (
                        <tr key={i}><td>{p.data}</td><td className="wrap">{p.historico}</td><td className="num">{p.valor}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {aberta && vm.dias.length > 0 && (
              <div className="imp-mov-caixa">
                <div className="imp-mov">
                  <table className="table-compact">
                    <thead><tr><th>Dia</th><th className="num">Saldo no extrato</th><th className="num">Saldo no razão</th><th className="num">Diferença</th></tr></thead>
                    <tbody>
                      {vm.dias.map(d => (
                        <tr key={d.data}>
                          <td>{d.data}</td><td className="num">{d.extrato}</td><td className="num">{d.razao}</td><td className="num ext-neg">{d.diferenca}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
