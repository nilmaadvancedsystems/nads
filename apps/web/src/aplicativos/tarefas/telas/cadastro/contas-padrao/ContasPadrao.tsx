// Cadastro › Contas padrão: um campo por conta (com as contas do plano para escolher e o nome embaixo) e
// os códigos de histórico. Grava ao sair do campo (ou Enter).
import { Icone, useCarregando } from '@nads/ui';
import { useId, useState } from 'react';
import { TrocarEmpresa } from '../partes/TrocarEmpresa';
import { useContasPadrao, type CampoPadrao } from './useContasPadrao';

type Vm = ReturnType<typeof useContasPadrao>;

function Campo({ vm, c, lista }: { vm: Vm; c: CampoPadrao; lista: string }) {
  const [texto, setTexto] = useState(c.valor);
  const [antes, setAntes] = useState(c.valor);
  // o valor mudou de fora (outra pessoa, o Creditor): o campo acompanha
  if (c.valor !== antes) { setAntes(c.valor); setTexto(c.valor); }
  const gravar = () => { if (texto.trim() !== c.valor) vm.definir(c.id, texto); };
  return (
    <label className="field cad-campo">
      <span className="cad-campo-rotulo">{c.rotulo}</span>
      <span className="hint">{vm.paraQue[c.id]}</span>
      <input type="text" inputMode="numeric" list={c.doPlano ? lista : undefined} value={texto} placeholder="automático"
        onChange={e => setTexto(e.target.value)} onBlur={gravar}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); gravar(); } if (e.key === 'Escape') setTexto(c.valor); }} />
      <span className={'hint cad-dica' + (c.aviso ? ' cad-dica-aviso' : '')}>
        {c.aviso || (c.valor ? (c.nome || '') : 'Vazio: ' + c.seVazio + '.')}
      </span>
    </label>
  );
}

export function ContasPadrao({ rota }: { rota: string }) {
  const vm = useContasPadrao(rota);
  const lista = useId();
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-barra-topo">
        <TrocarEmpresa empresa={vm.empresa} rota={rota} pagina="contas-padrao" />
      </div>
      {!vm.temPlano && !vm.carregando && (
        <div className="alert cad-aviso">
          <Icone nome="alert" />
          <div>
            <p className="alert-title">Sem plano de contas</p>
            <p className="alert-text">Dá para preencher os códigos, mas o nome e a conferência das contas aparecem depois de importar o plano (Cadastro › Plano de contas).</p>
          </div>
        </div>
      )}
      <datalist id={lista}>{vm.contasDoPlano.map(x => <option key={x.codigo} value={x.codigo}>{x.nome}</option>)}</datalist>
      {!vm.carregando && (
        <div className="cad-grade">
          <div className="card">
            <h3>Contas</h3>
            {vm.campos.filter(c => c.doPlano).map(c => <Campo key={c.id} vm={vm} c={c} lista={lista} />)}
          </div>
          <div className="card">
            <h3>Históricos</h3>
            {vm.campos.filter(c => !c.doPlano).map(c => <Campo key={c.id} vm={vm} c={c} lista={lista} />)}
          </div>
        </div>
      )}
    </section>
  );
}
