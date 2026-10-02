// O formulário de uma conta bancária (incluir e editar): primeiro o banco (com o logo), depois agência,
// conta, tipo, apelido, a conta contábil (com as contas do plano para escolher) e a primeira competência.
// Também o "Encerrar" (a última competência da conta). Só desenha: quem valida e grava é o ViewModel.
import type { empresas } from '@nads/core';
import { LogoBanco } from '@nads/ui';
import { useId, useState } from 'react';
import type { VmContasBancarias } from '../useContasBancarias';

export function FormConta({ vm, id, inicial, fechar }: { vm: VmContasBancarias; id: string | null; inicial?: empresas.cadastro.DadosDaConta; fechar: () => void }) {
  const [marca, setMarca] = useState(inicial?.marca || '');
  const [agencia, setAgencia] = useState(inicial?.agencia || '');
  const [conta, setConta] = useState(inicial?.conta || '');
  const [tipo, setTipo] = useState<empresas.cadastro.TipoContaBancaria | ''>(inicial ? inicial.tipo || '' : 'corrente');
  const [apelido, setApelido] = useState(inicial?.apelido || '');
  const [contaContabil, setContaContabil] = useState(inicial?.contaContabil || '');
  const [desde, setDesde] = useState(inicial?.desde || '');
  const lista = useId();

  if (!marca) {
    return (
      <div className="add-banco-lista cad-bancos-lista" role="menu">
        {vm.bancosParaEscolher.map(b => (
          <button key={b.id} type="button" className="popover-item add-banco-item" role="menuitem" onClick={() => setMarca(b.id)}>
            <span className="add-banco-logo"><LogoBanco banco={b.id} cor /></span>{b.nome}
          </button>
        ))}
      </div>
    );
  }

  const banco = vm.bancosParaEscolher.find(b => b.id === marca);
  const noPlano = vm.contasDoPlano.find(x => x.codigo === contaContabil.trim());
  const salvar = () => {
    const ok = vm.salvarConta(id, { marca, agencia, conta, tipo: tipo || undefined, apelido, contaContabil, desde: desde || undefined });
    if (ok) fechar();
  };

  return (
    <form className="add-banco-form cad-form" onSubmit={e => { e.preventDefault(); salvar(); }}>
      <div className="add-banco-titulo">
        <span className="add-banco-logo"><LogoBanco banco={marca} cor /></span><b>{banco?.nome || marca}</b>
        {!id && <button type="button" className="btn btn-ghost cad-trocar" onClick={() => setMarca('')}>Trocar banco</button>}
      </div>
      <div className="cad-form-2">
        <label className="field"><span className="hint">Agência</span>
          <input type="text" autoFocus inputMode="numeric" value={agencia} onChange={e => setAgencia(e.target.value)} placeholder="Ex.: 3001" />
        </label>
        <label className="field"><span className="hint">Conta</span>
          <input type="text" inputMode="numeric" value={conta} onChange={e => setConta(e.target.value)} placeholder="Ex.: 12345-6" />
        </label>
      </div>
      <div className="cad-form-2">
        <label className="field"><span className="hint">Tipo</span>
          <select value={tipo} onChange={e => setTipo(e.target.value as empresas.cadastro.TipoContaBancaria | '')}>
            <option value="">—</option>
            {vm.tipos.map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
          </select>
        </label>
        <label className="field"><span className="hint">Apelido (opcional)</span>
          <input type="text" value={apelido} onChange={e => setApelido(e.target.value)} placeholder="Ex.: Conta movimento" />
        </label>
      </div>
      <label className="field"><span className="hint">Conta contábil</span>
        <input type="text" inputMode="numeric" list={lista} value={contaContabil} onChange={e => setContaContabil(e.target.value)}
          placeholder={vm.temPlano ? 'Código ou nome da conta no plano' : 'Código da conta (ex.: 10503)'} />
        <datalist id={lista}>{vm.contasDoPlano.map(x => <option key={x.codigo} value={x.codigo}>{x.nome}</option>)}</datalist>
        <span className="hint cad-dica">
          {!contaContabil.trim() ? (vm.temPlano ? 'A conta do banco no plano de contas.' : 'Sem plano de contas importado: confira o código.')
            : noPlano ? noPlano.nome
              : vm.temPlano ? 'Não está no plano de contas (ou é sintética).' : ''}
        </span>
      </label>
      <label className="field"><span className="hint">Primeira competência</span>
        <input type="month" value={desde} max={vm.hoje} onChange={e => setDesde(e.target.value)} />
        <span className="hint cad-dica">Vazio = desde sempre. O Extrator pede o extrato desta conta a partir dela.</span>
      </label>
      <div className="add-banco-acoes">
        <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={!agencia.trim() || !conta.trim()}>{id ? 'Salvar' : 'Incluir'}</button>
      </div>
    </form>
  );
}

export function FormEncerrar({ vm, id, fechar }: { vm: VmContasBancarias; id: string; fechar: () => void }) {
  const [ate, setAte] = useState(vm.hoje);
  return (
    <form className="add-banco-form cad-form" onSubmit={e => { e.preventDefault(); if (vm.encerrar(id, ate)) fechar(); }}>
      <label className="field"><span className="hint">Última competência da conta</span>
        <input type="month" autoFocus value={ate} onChange={e => setAte(e.target.value)} />
        <span className="hint cad-dica">Depois dela, o Extrator deixa de pedir o extrato desta conta. Os meses anteriores ficam.</span>
      </label>
      <div className="add-banco-acoes">
        <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={!ate}>Encerrar</button>
      </div>
    </form>
  );
}
