// Os planos de contas do SCI em Cadastro › Integração SCI (26/11/2026): a lista e o "Adicionar ou atualizar plano", que lê a
// exportação do plano no SCI (a "Impressão de campos da consulta", .xls), mostra o que muda e grava. Só desenha: usePlanosDoSci.
import { sci } from '@nads/core';
import { Icone } from '@nads/ui';
import { useRef } from 'react';
import { usePlanosDoSci } from './usePlanosDoSci';

const conta = (l: sci.LinhaDoPlanoSci) => l[0] + ' · ' + l[1] + ' · ' + l[2] + (l[3] ? ' (' + l[3] + ')' : '');

function Lista({ titulo, linhas }: { titulo: string; linhas: readonly sci.LinhaDoPlanoSci[] }) {
  if (!linhas.length) return null;
  return (
    <details className="sci-planos-lista">
      <summary>{titulo} ({linhas.length})</summary>
      <ul>{linhas.slice(0, 200).map(l => <li key={l[0]}>{conta(l)}</li>)}</ul>
    </details>
  );
}

export function PlanosDoSci() {
  const vm = usePlanosDoSci();
  const arquivo = useRef<HTMLInputElement>(null);
  const p = vm.previa;
  return (
    <div className="card cad-secao">
      <div className="cad-secao-topo">
        <span className="cad-faixa-icone" aria-hidden="true"><Icone nome="list" /></span>
        <h3>Planos de contas</h3>
        <span className="sci-planos-acao">
          <button type="button" className="btn btn-outline" onClick={() => arquivo.current?.click()} disabled={vm.carregando || vm.gravando}>
            <Icone nome="fileUp" />Adicionar ou atualizar plano
          </button>
          <input ref={arquivo} type="file" accept=".xls,.xlsx" hidden aria-label="A exportação do plano de contas do SCI"
            onChange={e => { const a = e.target.files?.[0]; e.target.value = ''; if (a) void vm.ler(a); }} />
        </span>
      </div>
      <p className="hint">No SCI, exporte o plano pela consulta do plano de contas (Impressão de campos da consulta, .xls) e mande aqui. O plano novo entra na lista; o que já existe é atualizado.</p>
      {vm.planos.map(x => (
        <div key={x.id} className="cad-chave">
          <div className="cad-chave-texto"><b>Plano {x.id}</b><span className="hint">{x.contas} contas · {x.origem}</span></div>
        </div>
      ))}
      {vm.erro && <p className="sci-planos-erro" role="alert">{vm.erro}</p>}
      {p && (
        <div className="sci-planos-previa">
          <p><b>Plano {p.id}</b> · {p.arquivo} · {p.linhas.length} contas</p>
          <p className="hint">
            {p.existe
              ? (p.novas.length || p.mudaram.length || p.sairam.length
                ? 'Atualiza o plano do nads: ' + p.novas.length + ' novas, ' + p.mudaram.length + ' mudaram, ' + p.sairam.length + ' saíram.'
                : 'Igual ao que o nads já tem: nada muda.')
              : 'Plano novo: entra na lista dos planos do SCI.'}
          </p>
          {p.existe && <><Lista titulo="Contas novas" linhas={p.novas} /><Lista titulo="Contas que mudaram" linhas={p.mudaram} /><Lista titulo="Contas que saíram" linhas={p.sairam} /></>}
          <div className="sci-planos-botoes">
            <button type="button" className="btn btn-ghost" onClick={vm.cancelar} disabled={vm.gravando}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={() => { void vm.gravar(); }} disabled={vm.gravando}>
              {vm.gravando ? 'Gravando…' : p.existe ? 'Atualizar o plano' : 'Adicionar o plano'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
