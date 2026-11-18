// A janela do Consultar na Receita (17/11/2026): o antes × depois de cada dado (o que o nads tem e o que a Receita disse
// agora), o que mudou em destaque no topo, e uma caixa em cada linha que dá para gravar. Só grava o que estiver marcado.
import { BotaoFechar, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import type { useConsultaNaReceita } from './useConsultaNaReceita';

type Consulta = ReturnType<typeof useConsultaNaReceita>;

const ROTULO_DO_ESTADO = { mudou: 'Mudou', novo: 'Novo', igual: 'Igual', vazio: 'Não informa' } as const;
const dataHora = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); };

/** um valor que pode ter várias linhas (os sócios, as atividades secundárias) */
const Texto = ({ v }: { v: string }) => (v ? <>{v.split('\n').map((t, i) => <span key={i} className="receita-valor-linha">{t}</span>)}</> : <span className="vazio">—</span>);

export function JanelaDaReceita({ consulta: vm }: { consulta: Consulta }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  const resumo = [
    vm.mudaram ? vm.mudaram + (vm.mudaram === 1 ? ' dado mudou' : ' dados mudaram') + ' em relação ao cadastro' : 'Nada mudou em relação ao cadastro',
    vm.novos ? vm.novos + (vm.novos === 1 ? ' dado o nads ainda não tinha' : ' dados o nads ainda não tinha') : '',
  ].filter(Boolean).join('; ') + '.';
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="modal receita-modal" role="dialog" aria-modal="true" aria-label="Consulta na Receita">
        <header className="receita-topo">
          <div>
            <h3>Consulta na Receita</h3>
            <span className="hint">Consultado em {dataHora(vm.consultadoEm)} · {resumo}</span>
          </div>
          <BotaoFechar onClick={vm.fechar} />
        </header>

        {vm.graves > 0 && <p className="receita-alerta"><Icone nome="alert" />Atenção: {vm.graves === 1 ? 'um dado pede' : vm.graves + ' dados pedem'} conferência (situação, Simples ou regime).</p>}
        {vm.aviso && <p className="receita-alerta"><Icone nome="alert" />{vm.aviso}</p>}
        {vm.gravado && !vm.aviso && <p className="receita-ok"><Icone nome="checkCircle" />Gravado no cadastro.</p>}

        <div className="receita-corpo">
          <table className="receita-tabela">
            <thead>
              <tr>
                <th className="receita-marcar">
                  {vm.paraEscolher > 0 && vm.podeGravar && (
                    <input type="checkbox" aria-label="Marcar todas" checked={vm.marcadas === vm.paraEscolher}
                      ref={el => { if (el) el.indeterminate = vm.marcadas > 0 && vm.marcadas < vm.paraEscolher; }}
                      onChange={ev => vm.marcarTodas(ev.target.checked)} />
                  )}
                </th>
                <th>Dado</th>
                <th>No cadastro (antes)</th>
                <th>Na Receita (agora)</th>
              </tr>
            </thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.campo} className={'receita-linha receita-' + l.estado + (l.grave && l.estado !== 'igual' ? ' receita-grave' : '')}>
                  <td className="receita-marcar">
                    {l.escolhivel && <input type="checkbox" aria-label={'Gravar ' + l.rotulo} checked={l.marcada} onChange={ev => vm.marcar(l.campo, ev.target.checked)} />}
                  </td>
                  <td>
                    <b>{l.rotulo}</b>
                    <span className={'receita-estado receita-estado-' + l.estado}>{ROTULO_DO_ESTADO[l.estado]}</span>
                    {(l.bloqueio || l.nota) && l.estado !== 'igual' && <span className="receita-nota">{l.bloqueio || l.nota}</span>}
                  </td>
                  <td className="receita-antes"><Texto v={l.antes} /></td>
                  <td className="receita-depois"><Texto v={l.depois} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="modal-actions">
          <span className="hint receita-pe">
            {!vm.podeGravar ? 'Só o sênior, o diretor e o admin gravam no cadastro.'
              : vm.paraEscolher ? 'Só o que estiver marcado vai para o cadastro.' : 'Tudo igual: grave só a conferência.'}
          </span>
          <button type="button" className="btn btn-outline" onClick={vm.fechar}>Fechar</button>
          {vm.podeGravar && (
            <button type="button" className="btn btn-primary" disabled={vm.paraEscolher > 0 && vm.marcadas === 0} onClick={vm.gravar}>
              <Icone nome="check" />
              {vm.paraEscolher ? 'Gravar ' + (vm.marcadas === 1 ? '1 dado' : vm.marcadas + ' dados') : 'Marcar como conferido'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
