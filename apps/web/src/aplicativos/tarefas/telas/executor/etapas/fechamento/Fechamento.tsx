// A etapa Fechar a competência (Vitor, 16/10/2026): a linha do balancete dinâmico final (o da Importação; um mais novo,
// importado aqui, vale para todas as etapas), as pendências que o dinâmico mostra (ou o Ok) e o envio único ao cliente:
// o que foi marcado no "+" de Clientes e de Fornecedores, num ticket só do Mandei.
import { CampoArquivo, Icone } from '@nads/ui';
import { useId } from 'react';
import { useFechamento } from './useFechamento';

export function Fechamento() {
  const vm = useFechamento();
  const id = useId();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Fechar a competência</h2></div></header>
      <div className="imp-lista">
        <div className={'imp-bloco' + (vm.temDinamico && !vm.pendencias.length ? ' imp-ok' : '')}>
          <div className="imp-linha">
            <span className="imp-ico"><Icone nome="scale" /></span>
            <div className="imp-txt"><span><b>Balancete dinâmico</b>{vm.arquivo && <span className="imp-conta">{vm.arquivo}</span>}</span></div>
            <div className="imp-resumo"><div><span>{!vm.temDinamico ? 'Importe o dinâmico final' : vm.pendencias.length ? vm.pendencias.length + (vm.pendencias.length === 1 ? ' pendência' : ' pendências') : 'Tudo certo'}</span></div></div>
            <div className="imp-grupos">
              <div className="imp-grupo" aria-label="Balancete dinâmico final">
                <span className="imp-rotulo">Dinâmico</span>
                <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title="Importar o dinâmico final (depois das correções): vale para todas as etapas" aria-label="Importar o balancete dinâmico final"><Icone nome="upload" /></label>
                <CampoArquivo semCaixa id={id} aceitar=".xls,.xlsx,.ods" onEscolher={f => { void vm.importar(f); }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {vm.temDinamico && !vm.pendencias.length && (
        <div className="gh-blank">
          <Icone nome="checkCircle" />
          <h4>O balancete fecha e nada está do lado errado</h4>
        </div>
      )}
      {vm.pendencias.map(p => (
        <div key={p.id} style={{ marginTop: 16 }}>
          <p><b>{p.titulo}</b> <span className="hint">{p.dica}</span></p>
          <div className="table-wrap" style={{ maxHeight: 'none' }}>
            <table className="table-compact">
              <thead><tr><th>Conta</th><th>Nome</th><th>Meses</th></tr></thead>
              <tbody>
                {p.contas.map(c => (
                  <tr key={c.conta + c.nome}><td>{c.conta || '—'}</td><td className="wrap">{c.nome}</td><td className="wrap" style={{ fontSize: 12 }}>{c.meses}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* o envio único ao cliente: Clientes e Fornecedores juntos */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <b>Para o cliente</b>
          <span style={{ flex: 1 }} />
          {vm.questoes.length > 0 && (
            <button type="button" className="btn btn-primary" disabled={vm.faltaNoCadastro.length > 0 || vm.jaMandado || !vm.carregado} onClick={vm.mandar}
              title={vm.faltaNoCadastro.length ? 'Falta no Cadastro da empresa: ' + vm.faltaNoCadastro.join(' e ') : 'Mandar para ' + [vm.contato.email, vm.contato.whatsapp && 'o WhatsApp ' + vm.contato.whatsapp].filter(Boolean).join(' e ')}>
              <Icone nome={vm.jaMandado ? 'check' : 'caixaEntrada'} />{vm.jaMandado ? 'Mandado pelo Mandei' : 'Mandar pelo Mandei'}
            </button>
          )}
        </div>
        {!vm.questoes.length ? <p className="hint">Nada para questionar: em Clientes e Fornecedores, nenhuma linha marcada no +.</p> : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="table-compact">
              <thead><tr><th>Lado</th><th>Conta</th><th>Nome</th><th className="num">Saldo</th><th>Vai perguntar</th></tr></thead>
              <tbody>
                {vm.questoes.map(q => (
                  <tr key={q.id}><td>{q.lado}</td><td>{q.codigo}</td><td className="wrap">{q.nome}</td><td className="num">{q.valor}</td><td className="wrap">{q.perguntar}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
