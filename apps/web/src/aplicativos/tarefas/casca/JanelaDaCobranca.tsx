// A janela da cobrança (Vitor, 16/11/2026: "deixa mais explicito que foi cobrado, tome a tela inicial toda..., assim que
// cobrar, não deixa o usuario sair enquanto nao responder a cobrança, faça uma bela popup"): por cima de qualquer tela da
// Tarefas, com o fundo coberto; sem X, sem Esc e sem clique fora. Mandar atualização pede a resposta; para mais tempo, a pessoa
// escolhe Mais 5 ou Mais 10 minutos e só então escreve o motivo (18/11/2026), e a janela volta quando o tempo acaba. O ViewModel é o useJanelaDaCobranca.
import { Alerta, BotaoAcao, Icone, useJanela } from '@nads/ui';
import { useId, useRef, useState } from 'react';
import { useJanelaDaCobranca } from './useJanelaDaCobranca';

/** a janela nova (18/11/2026; publicada para todos: "tirando o carteira pode publicar tudo") */
export function JanelaDaCobranca() {
  const vm = useJanelaDaCobranca();
  const janela = useRef<HTMLDivElement>(null);
  const id = useId();
  // sem fechar: o Esc não faz nada (a pessoa responde ou pede mais tempo); no modo desenvolvedor, o Esc e o X fecham (27/11/2026)
  useJanela(janela, vm.fechar, !!vm.cobranca);
  // mais tempo (Vitor, 18/11/2026: "ele seleciona o tempo, depois de selecionar o tempo, libera a caixa de escrever o motivo")
  const [tempo, setTempo] = useState<(typeof vm.minutos)[number] | null>(null);
  const c = vm.cobranca;
  if (!c) return null;
  return (
    <div className="modal-overlay cobranca-fundo">
      <div ref={janela} className="modal cobranca-janela" role="alertdialog" aria-modal="true" aria-labelledby={id + '-titulo'}>
        {/* sem o sino; a empresa (o número e o nome) junto do título (Vitor, 18/11/2026) */}
        <header className="cobranca-topo">
          <span>
            <h2 id={id + '-titulo'}>{c.por} cobrou uma atualização</h2>
            {c.cliente && <span className="cobranca-empresa">{c.cliente}</span>}
            <span className="hint">{c.quando}{c.outras > 0 ? ' · mais ' + c.outras + (c.outras === 1 ? ' cobrança esperando' : ' cobranças esperando') : ''}</span>
          </span>
          {vm.fechar && <button type="button" className="icon-btn cobranca-fechar" onClick={vm.fechar} title="Fechar (Esc) · modo desenvolvedor: esta cobrança não abre mais neste navegador" aria-label="Fechar"><Icone nome="x" /></button>}
        </header>
        <div className="cobranca-corpo">
          {/* a tarefa, sem a mensagem de quem cobrou ("tira isso", 18/11/2026) */}
          <div className="cobranca-tarefa">
            <b>{c.tarefa}</b>
          </div>
          {c.adiamentos.map(a => <p key={a} className="hint cobranca-adiado"><Icone nome="clock" width={13} height={13} /> {a}</p>)}
          <div className="field">
            <label htmlFor={id + '-resposta'}>Sua resposta</label>
            <textarea id={id + '-resposta'} rows={3} value={vm.resposta} maxLength={vm.maiorTexto} autoFocus placeholder="Como está a tarefa? O que já foi feito, o que falta"
              onChange={e => vm.setResposta(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void vm.responder(); } }} />
          </div>
          <div className="cobranca-acoes">
            <BotaoAcao className="btn btn-primary" carregando={vm.ocupado === 'responder'} textoCarregando="Enviando" disabled={!!vm.ocupado || !vm.resposta.trim()} title="Mandar atualização (Ctrl+Enter)" onClick={() => { void vm.responder(); }}>
              <Icone nome="envelope" />Mandar atualização
            </BotaoAcao>
          </div>
          <div className="cobranca-tempo">
            <span className="cobranca-tempo-titulo">Precisa de mais tempo?</span>
            <div className="cobranca-acoes cobranca-escolha" role="radiogroup" aria-label="Quanto tempo a mais">
              {vm.minutos.map(m => (
                <button key={m} type="button" role="radio" aria-checked={tempo === m} disabled={!!vm.ocupado}
                  className={'btn ' + (tempo === m ? 'btn-primary' : 'btn-outline')} onClick={() => setTempo(t => (t === m ? null : m))}>
                  <Icone nome="clock" />Mais {m} minutos
                </button>
              ))}
            </div>
            {tempo != null && (
              <>
                <div className="field">
                  <label htmlFor={id + '-justificativa'}>Escreva o motivo</label>
                  <textarea id={id + '-justificativa'} rows={2} value={vm.justificativa} maxLength={vm.maiorTexto} autoFocus placeholder={'Ex.: estou atendendo o cliente, respondo em seguida'}
                    onChange={e => vm.setJustificativa(e.target.value)} />
                </div>
                <div className="cobranca-acoes">
                  <BotaoAcao className="btn btn-outline" carregando={vm.ocupado === tempo} textoCarregando="Pedindo" disabled={!!vm.ocupado || !vm.justificativa.trim()}
                    title={vm.justificativa.trim() ? 'A janela volta em ' + tempo + ' minutos' : 'Escreva o motivo para pedir mais tempo'} onClick={() => { void vm.adiar(tempo); }}>
                    <Icone nome="clock" />Pedir mais {tempo} minutos
                  </BotaoAcao>
                </div>
              </>
            )}
          </div>
          {vm.erro && <Alerta naLinha titulo={vm.erro} />}
        </div>
      </div>
    </div>
  );
}
