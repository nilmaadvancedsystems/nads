// A tela de bloqueio do Senhas (13/10/2026: "não era pra tela nem abrir… era pra aparecer uma tela de bloqueio"): sem
// acesso ao cofre, a página inteira é só isto — o cadeado, o que falta (pedir acesso, esperar a liberação ou criar o
// cofre) e, embaixo, abrir com o código de recuperação.
import { BotaoAcao, Icone } from '@nads/ui';
import { useState } from 'react';
import { FotoDaPessoa } from '../cadastro/responsaveis/FotoDaPessoa';
import type { VmCofre } from './useCofre';

export function TelaDeBloqueio({ vm }: { vm: VmCofre }) {
  const [codigo, setCodigo] = useState('');
  if (vm.estado === 'carregando') return null;
  const titulo = vm.estado === 'erro' ? 'O cofre não abriu' : vm.estado === 'novo' ? 'O cofre ainda não existe'
    : vm.estado === 'aguardando' ? 'Aguardando liberação' : 'Acesso bloqueado';
  const texto = vm.estado === 'erro' ? vm.erro : vm.estado === 'novo' ? 'Crie o cofre para guardar as senhas gov.br e os certificados.'
    : vm.estado === 'aguardando' ? 'Seu pedido foi enviado. Quem já tem acesso libera em Senhas › Acesso.'
      : 'As senhas gov.br e os certificados ficam no cofre. Peça acesso a quem já tem.';
  return (
    <div className="cofre-bloqueio">
      <div className="cofre-bloqueio-cartao">
        <span className={'cofre-bloqueio-icone' + (vm.estado === 'aguardando' ? ' esperando' : '')} aria-hidden="true">
          <Icone nome={vm.estado === 'erro' ? 'alert' : vm.estado === 'aguardando' ? 'clock' : 'lock'} />
        </span>
        <h2>{titulo}</h2>
        <p className="cofre-bloqueio-texto">{texto}</p>
        {vm.dev && <p className="cofre-dev">{vm.avisoDev}</p>}
        {vm.estado === 'novo' && <BotaoAcao carregando={vm.ocupado} textoCarregando="Criando…" disabled={vm.dev} onClick={() => void vm.criar()}><Icone nome="lock" />Criar o cofre</BotaoAcao>}
        {vm.estado === 'sem-chave' && <BotaoAcao carregando={vm.ocupado} textoCarregando="Pedindo…" disabled={vm.dev} onClick={() => void vm.pedirAcesso()}><Icone nome="unlock" />Pedir acesso</BotaoAcao>}
        {(vm.estado === 'sem-chave' || vm.estado === 'aguardando') && vm.comAcesso.length > 0 && (
          <div className="cofre-bloqueio-quem">
            <span className="hint">{vm.estado === 'aguardando' ? 'Quem pode liberar' : 'Quem tem acesso'}</span>
            <ul>
              {vm.comAcesso.filter((p, i, t) => t.findIndex(x => x.nome.trim().toLowerCase() === p.nome.trim().toLowerCase()) === i).map(p => { const f = vm.fotoDe(p.nome); return <li key={p.id}><FotoDaPessoa foto={f.foto} iniciais={f.iniciais} />{p.nome.split(' ')[0]}</li>; })}
            </ul>
          </div>
        )}
        {vm.estado !== 'novo' && vm.estado !== 'erro' && (
          <form className="cofre-bloqueio-codigo" onSubmit={e => { e.preventDefault(); if (codigo.trim()) void vm.recuperar(codigo); }}>
            <span className="hint">ou abra com o código de recuperação</span>
            <span className="cofre-bloqueio-linha">
              <input type="text" className="field" placeholder="Código de recuperação" aria-label="Código de recuperação" value={codigo} onChange={e => setCodigo(e.target.value)} autoComplete="off" />
              <button type="submit" className="btn btn-outline" disabled={!codigo.trim() || vm.ocupado}>Abrir</button>
            </span>
          </form>
        )}
      </div>
    </div>
  );
}
