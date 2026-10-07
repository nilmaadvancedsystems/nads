// O cofre fechado para quem está usando: criar o cofre (a primeira vez), pedir acesso (este navegador não tem chave),
// esperar a liberação, e o código de recuperação.
import { BotaoAcao, Icone } from '@nads/ui';
import { useState } from 'react';
import type { VmCofre } from './useCofre';

export function CofreFechado({ vm }: { vm: VmCofre }) {
  const [codigo, setCodigo] = useState('');
  if (vm.estado === 'carregando') return null;
  if (vm.estado === 'erro') return <div className="card gh-blank cofre-fechado"><Icone nome="alert" /><h4>O cofre não abriu</h4><p>{vm.erro}</p></div>;
  return (
    <div className="card gh-blank cofre-fechado">
      <Icone nome="lock" />
      {vm.dev && <p className="cofre-dev">{vm.avisoDev}</p>}
      {vm.estado === 'novo' ? (
        <>
          <h4>O cofre ainda não existe</h4>
          <BotaoAcao carregando={vm.ocupado} textoCarregando="Criando…" disabled={vm.dev} onClick={() => void vm.criar()}>Criar o cofre</BotaoAcao>
        </>
      ) : vm.estado === 'aguardando' ? (
        <h4>Aguardando a liberação</h4>
      ) : (
        <>
          <h4>Sem acesso ao cofre neste computador</h4>
          <BotaoAcao carregando={vm.ocupado} textoCarregando="Pedindo…" disabled={vm.dev} onClick={() => void vm.pedirAcesso()}>Pedir acesso</BotaoAcao>
        </>
      )}
      {vm.estado !== 'novo' && (
        <form className="cofre-codigo" onSubmit={e => { e.preventDefault(); if (codigo.trim()) void vm.recuperar(codigo); }}>
          <input type="text" className="pessoal-select" placeholder="Código de recuperação" aria-label="Código de recuperação" value={codigo} onChange={e => setCodigo(e.target.value)} autoComplete="off" />
          <button type="submit" className="btn btn-outline" disabled={!codigo.trim() || vm.ocupado}>Abrir com o código</button>
        </form>
      )}
    </div>
  );
}
