// A janela da cobrança (Vitor, 16/11/2026: "deixa mais explicito que foi cobrado, tome a tela inicial toda..., assim que
// cobrar, não deixa o usuario sair enquanto nao responder a cobrança, faça uma bela popup"): por cima de qualquer tela da
// Tarefas, com o fundo coberto; sem X, sem Esc e sem clique fora. Responder pede a resposta; Mais 5 e Mais 10 minutos pedem
// a justificativa, e a janela volta quando o tempo acaba. O ViewModel é o useJanelaDaCobranca.
import { Alerta, BotaoAcao, Icone, useJanela } from '@nads/ui';
import { useId, useRef } from 'react';
import { useJanelaDaCobranca } from './useJanelaDaCobranca';

export function JanelaDaCobranca() {
  const vm = useJanelaDaCobranca();
  const janela = useRef<HTMLDivElement>(null);
  const id = useId();
  // sem fechar: o Esc não faz nada (a pessoa responde ou pede mais tempo)
  useJanela(janela, null, !!vm.cobranca);
  const c = vm.cobranca;
  if (!c) return null;
  return (
    <div className="modal-overlay cobranca-fundo">
      <div ref={janela} className="modal cobranca-janela" role="alertdialog" aria-modal="true" aria-labelledby={id + '-titulo'}>
        <header className="cobranca-topo">
          <span className="cobranca-sino"><Icone nome="sino" /></span>
          <span>
            <h2 id={id + '-titulo'}>{c.por} cobrou uma atualização</h2>
            <span className="hint">{c.quando}{c.outras > 0 ? ' · mais ' + c.outras + (c.outras === 1 ? ' cobrança esperando' : ' cobranças esperando') : ''}</span>
          </span>
        </header>
        <div className="cobranca-corpo">
          <div className="cobranca-tarefa">
            <b>{c.tarefa}</b>
            {c.cliente && <span className="hint">{c.cliente}</span>}
          </div>
          <blockquote className="cobranca-mensagem">{c.texto}</blockquote>
          {c.adiamentos.map(a => <p key={a} className="hint cobranca-adiado"><Icone nome="clock" width={13} height={13} /> {a}</p>)}
          <div className="field">
            <label htmlFor={id + '-resposta'}>Sua resposta</label>
            <textarea id={id + '-resposta'} rows={3} value={vm.resposta} maxLength={vm.maiorTexto} autoFocus placeholder="Como está a tarefa? O que já foi feito, o que falta"
              onChange={e => vm.setResposta(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.responder(); } }} />
          </div>
          <div className="cobranca-acoes">
            <BotaoAcao className="btn btn-primary" carregando={vm.ocupado === 'responder'} textoCarregando="Enviando" disabled={!!vm.ocupado || !vm.resposta.trim()} title="Responder (Ctrl+Enter)" onClick={() => { void vm.responder(); }}>
              <Icone nome="envelope" />Responder cobrança
            </BotaoAcao>
          </div>
          <div className="cobranca-tempo">
            <div className="field">
              <label htmlFor={id + '-justificativa'}>Precisa de mais tempo? Escreva o motivo</label>
              <textarea id={id + '-justificativa'} rows={2} value={vm.justificativa} maxLength={vm.maiorTexto} placeholder={'Ex.: estou atendendo o cliente, respondo em seguida'}
                onChange={e => vm.setJustificativa(e.target.value)} />
            </div>
            <div className="cobranca-acoes">
              {vm.minutos.map(m => (
                <BotaoAcao key={m} className="btn btn-outline" carregando={vm.ocupado === m} textoCarregando="Pedindo" disabled={!!vm.ocupado || !vm.justificativa.trim()}
                  title={vm.justificativa.trim() ? 'A janela volta em ' + m + ' minutos' : 'Escreva o motivo para pedir mais tempo'} onClick={() => { void vm.adiar(m); }}>
                  <Icone nome="clock" />Mais {m} minutos
                </BotaoAcao>
              ))}
            </div>
          </div>
          {vm.erro && <Alerta naLinha titulo={vm.erro} />}
        </div>
      </div>
    </div>
  );
}
