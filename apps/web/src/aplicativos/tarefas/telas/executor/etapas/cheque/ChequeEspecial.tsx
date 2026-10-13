// A etapa Cheque especial da Tarefa (Vitor, 13/10/2026), com as peças que já existem: cada banco na linha da Importação
// (o logo, o nome e a conta; no canto, o Ok ou a cápsula laranja com os dias negativos) e, no banco que falta o cheque
// especial, os dias negativos na tabela padrão, a conta do banco e a do cheque especial (o campo com o nome em cima)
// e o Baixar .xls. O histórico é sempre o 92029.
import { BotaoAcao, Icone, LogoBanco } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useChequeEspecial } from './useChequeEspecial';

type Vm = ReturnType<typeof useChequeEspecial>;
type Banco = Vm['bancos'][number];

export function ChequeEspecial() {
  const vm = useChequeEspecial();
  return (
    <section>
      <header className="topbar">
        <div><h2 className="page-title">Cheque especial</h2></div>
        {/* os extratos do Drive importados antes do saldo impresso: relê só o saldo (Vitor, 13/10/2026: "dá um update aqui") */}
        {vm.semSaldo > 0 && (
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <BotaoAcao className="btn btn-primary" carregando={vm.atualizando} textoCarregando="Atualizando" onClick={vm.atualizarPeloDrive}
              title="Relê no Drive o saldo que o banco imprime em cada dia (os dias negativos passam a ser os do banco)">
              <Icone nome="repeat" />Atualizar pelo Drive · {vm.semSaldo}
            </BotaoAcao>
          </div>
        )}
      </header>
      {vm.carregado && (
        <div className="imp-lista" style={{ gap: 16 }}>
          {vm.bancos.map(b => <BlocoDoBanco key={b.id} b={b} vm={vm} />)}
        </div>
      )}
    </section>
  );
}

function BlocoDoBanco({ b, vm }: { b: Banco; vm: Vm }) {
  const falta = b.dias.length > 0;
  return (
    <div className={'imp-bloco' + (falta ? '' : ' imp-ok')}>
      <div className="imp-linha">
        <span className="imp-ico imp-logo"><LogoBanco banco={b.marca} cor /></span>
        <div className="imp-txt"><span><b>{b.nome}</b>{b.conta && <span className="imp-conta">{b.conta}</span>}</span></div>
        <span className="imp-topo-meio" />
        <div className="imp-grupos">
          {falta
            ? <span className="badge badge-conferido" title={'Total do ajuste: ' + b.total}>{b.dias.length === 1 ? '1 dia negativo' : b.dias.length + ' dias negativos'}</span>
            : <span className="badge badge-ok" title={b.negativos ? 'O razão já tem o cheque especial dos dias negativos' : 'Nenhum dia negativo no período'}>Ok</span>}
        </div>
      </div>
      {falta && (
        <div className="imp-periodo-linha" style={{ padding: 16 }}>
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Dia</th><th className="num">Saldo do dia</th></tr></thead>
              <tbody>{b.dias.map(d => <tr key={d.data}><td>{d.data}</td><td className="num ext-neg">{d.saldo}</td></tr>)}</tbody>
            </table>
          </div>
          {/* as contas com o nome em cima, sem o #, e mais espaço entre as caixas (Vitor, 13/10/2026: "deixa mais bonitinho") */}
          <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
            <Conta rotulo="Conta do banco" valor={b.contaBanco} desabilitado={!b.noCadastro} onGravar={v => vm.gravarConta(b.id, 'contaContabil', v)} />
            <Conta rotulo="Conta do cheque especial" valor={b.contaCheque} desabilitado={!b.noCadastro} onGravar={v => vm.gravarConta(b.id, 'contaChequeEspecial', v)} />
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary" disabled={!b.contaBanco || !b.contaCheque} onClick={() => vm.baixar(b.id)}
              title={b.contaBanco && b.contaCheque ? 'O ajuste e o estorno de cada dia negativo, no .xls do Alterdata' : 'Informe a conta do banco e a do cheque especial'}>
              <Icone nome="download" />Baixar .xls
            </button>
          </div>
          {!b.noCadastro && <p className="hint">Cadastre esta conta em Cadastro › Contas bancárias para gravar as contas contábeis.</p>}
        </div>
      )}
    </div>
  );
}

/** O código da conta: grava no Cadastro ao sair do campo (ou no Enter); na próxima vez já vem preenchido. */
function Conta({ rotulo, valor, desabilitado, onGravar }: { rotulo: string; valor: string; desabilitado: boolean; onGravar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => { setTexto(valor); }, [valor]);
  return (
    <label className="field" style={{ margin: 0, width: 260 }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{rotulo}</span>
      <input type="text" inputMode="numeric" placeholder="Código da conta" aria-label={rotulo} value={texto} disabled={desabilitado}
        onChange={e => setTexto(e.target.value)} onBlur={() => { if (texto !== valor) onGravar(texto); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </label>
  );
}
