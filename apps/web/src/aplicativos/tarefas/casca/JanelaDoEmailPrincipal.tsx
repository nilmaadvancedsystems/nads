// A janela do e-mail principal (Vitor, 16/11/2026: "Olá, para concluir seu cadastro do NADS precisamos do seu e-mail
// principal. Consegue me fornecer por gentileza?"): por cima de qualquer tela da Tarefas, até a pessoa responder; "Agora não"
// fecha até a próxima vez que o nads abrir. O ViewModel é o useJanelaDoEmailPrincipal.
import { Alerta, BotaoAcao, useJanela } from '@nads/ui';
import { useId, useRef } from 'react';
import { useJanelaDoEmailPrincipal } from './useJanelaDoEmailPrincipal';

export function JanelaDoEmailPrincipal() {
  const vm = useJanelaDoEmailPrincipal();
  const janela = useRef<HTMLFormElement>(null);
  const id = useId();
  useJanela(janela, vm.enviando ? null : vm.fechar, vm.aberta);
  if (!vm.aberta) return null;
  return (
    <div className="modal-overlay email-principal-fundo">
      <form ref={janela} className="modal" role="dialog" aria-modal="true" aria-labelledby={id + '-titulo'}
        onSubmit={e => { e.preventDefault(); void vm.enviar(); }}>
        <h3 id={id + '-titulo'}>Seu e-mail principal{vm.deTeste ? ' · simulação' : ''}</h3>
        <p style={{ paddingBottom: 0 }}>Olá, para concluir seu cadastro do NADS precisamos do seu e-mail principal. Consegue me fornecer por gentileza?</p>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label htmlFor={id + '-email'}>E-mail principal</label>
            <input id={id + '-email'} type="email" autoComplete="email" autoFocus placeholder="nome@gmail.com" value={vm.email} disabled={vm.enviando} onChange={e => vm.setEmail(e.target.value)} />
            <span className="hint">{vm.loginDeHoje && !vm.troca
              ? 'É o e-mail com que você entra hoje. Se for este mesmo, é só confirmar.'
              : 'Ele passa a ser o seu login: você entra com ele e a mesma senha de sempre.'}</span>
          </div>
          {vm.troca && (
            <>
              <div className="field">
                <label htmlFor={id + '-confirmacao'}>Digite o e-mail de novo</label>
                <input id={id + '-confirmacao'} type="email" autoComplete="off" value={vm.confirmacao} disabled={vm.enviando} onChange={e => vm.setConfirmacao(e.target.value)}
                  onPaste={e => e.preventDefault()} />
              </div>
              <div className="field">
                <label htmlFor={id + '-senha'}>Sua senha</label>
                <input id={id + '-senha'} type="password" autoComplete="current-password" value={vm.senha} disabled={vm.enviando} onChange={e => vm.setSenha(e.target.value)} />
                <span className="hint">A mesma de sempre: ela continua igual, só o login muda.</span>
              </div>
            </>
          )}
          {vm.erro && <Alerta naLinha titulo={vm.erro} />}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" disabled={vm.enviando} onClick={vm.fechar}>Agora não</button>
          <BotaoAcao type="submit" className="btn btn-primary" carregando={vm.enviando} textoCarregando="Enviando" disabled={!vm.podeEnviar}>
            {vm.troca ? 'Enviar' : 'Confirmar'}
          </BotaoAcao>
        </div>
      </form>
    </div>
  );
}
