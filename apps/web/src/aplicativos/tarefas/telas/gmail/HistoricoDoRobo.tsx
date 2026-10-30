// Gmail › Histórico (13/10/2026: "refaça toda a UI do Gmail"): as últimas leituras do robô do Gmail em frases ("Leu 12
// e-mails · 4 anexos salvos · 2 sem cliente"), com o total das leituras no topo; os erros em destaque.
// Sem a barra lateral do Gmail (30/10/2026), o "Voltar para os e-mails" fica no alto.
import { Icone, useCarregando, Vazio } from '@nads/ui';
import { Link } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { useHistoricoDoRobo } from './useHistoricoDoRobo';

const n = (v: number, um: string, varios: string) => v + ' ' + (v === 1 ? um : varios);

const Voltar = () => <Link className="btn btn-ghost gm-voltar-caixa" to={caminhoDaPagina('contato', 'caixa')}><Icone nome="chevronLeft" />Voltar para os e-mails</Link>;

export function HistoricoDoRobo() {
  const vm = useHistoricoDoRobo();
  useCarregando(vm.carregando);
  if (vm.erro) return <><Voltar /><Vazio icone="alert" titulo="Não consegui ler o robô" texto={vm.erro} onTentarDeNovo={() => location.reload()} /></>;
  if (!vm.carregando && !vm.linhas.length) return (
    <>
      <Voltar />
      <div className="gm-lista-vazia gm-historico-vazio">
        <span className="gm-vazio-icone" aria-hidden="true"><Icone nome="clock" /></span>
        <b>O robô ainda não leu nada</b>
      </div>
    </>
  );
  const soma = (k: 'emails' | 'baixados' | 'naoReconhecidos' | 'erros') => vm.linhas.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  return (
    <section className="gm-historico">
      <Voltar />
      <div className="gm-historico-numeros">
        <span><b>{vm.linhas.length}</b> leituras</span>
        <span><b>{soma('emails')}</b> e-mails lidos</span>
        <span><b>{soma('baixados')}</b> anexos salvos</span>
        <span><b>{soma('naoReconhecidos')}</b> sem cliente</span>
        {soma('erros') > 0 && <span className="gm-historico-erro"><b>{soma('erros')}</b> com erro</span>}
      </div>
      <ol className="gm-historico-lista">
        {vm.linhas.map(x => (
          <li key={x.em} className={x.erros ? 'com-erro' : undefined}>
            <span className="gm-historico-ponto" aria-hidden="true"><Icone nome={x.erros ? 'alert' : 'check'} /></span>
            <div className="gm-historico-txt">
              <b>{x.emails ? 'Leu ' + n(x.emails, 'e-mail', 'e-mails') : 'Nenhum e-mail novo'}</b>
              <span className="fraco">
                {[x.marcados ? n(x.marcados, 'marcado', 'marcados') : '', x.baixados ? n(x.baixados, 'anexo salvo', 'anexos salvos') : '',
                  x.naoReconhecidos ? n(x.naoReconhecidos, 'sem cliente', 'sem cliente') : '', x.conversas ? n(x.conversas, 'conversa', 'conversas') : '',
                  x.dias ? 'olhou ' + n(Number(x.dias), 'dia', 'dias') : ''].filter(Boolean).join(' · ')}
              </span>
            </div>
            {x.erros > 0 && <span className="badge badge-bad">{n(x.erros, 'erro', 'erros')}</span>}
            <span className="gm-historico-hora">{x.quando}{x.duracao && <small>{x.duracao}</small>}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
