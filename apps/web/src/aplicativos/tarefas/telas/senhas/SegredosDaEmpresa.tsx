// Os segredos de uma empresa (07/10/2026): a senha gov.br e o certificado digital A1, em cartões com uma opção por linha.
// Mostrar/esconder e copiar a senha; escolher e baixar o .pfx. Usado na janela do módulo Senhas e na aba Senhas do Cadastro.
import { BotaoIcone, Esqueleto, useRetorno } from '@nads/ui';
import { useState } from 'react';
import { Cartao, Linha } from '../janela/JanelaLateral';
import { CertificadoA1 } from './CertificadoA1';
import { CofreFechado } from './CofreFechado';
import type { VmCofre } from './useCofre';
import { useSegredos } from './useSegredos';

export function Senha({ valor, onMudar, rotulo }: { valor: string; onMudar: (v: string) => void; rotulo: string }) {
  const [ver, setVer] = useState(false);
  const { toast } = useRetorno();
  return (
    <span className="cofre-senha">
      <input type={ver ? 'text' : 'password'} className="pessoal-select" value={valor} onChange={e => onMudar(e.target.value)} aria-label={rotulo} autoComplete="off" />
      <BotaoIcone icone="olho" titulo={ver ? 'Esconder' : 'Mostrar'} onClick={() => setVer(!ver)} />
      <BotaoIcone icone="copiar" titulo="Copiar" onClick={() => { void navigator.clipboard.writeText(valor).then(() => toast('Copiado.')); }} />
    </span>
  );
}

export function SegredosDaEmpresa({ vm: cofre, empresa, codigo, parte }: { vm: VmCofre; empresa: string; codigo: number | null; parte: 'gov' | 'certificado' | 'tudo' }) {
  const vm = useSegredos(cofre, empresa, codigo);
  const { toast } = useRetorno();
  if (!vm.aberto) return <CofreFechado vm={cofre} />;
  if (!vm.carregado) return <Esqueleto linhas={4} />;
  const baixar = () => {
    const a = vm.arquivoParaBaixar();
    if (!a) return;
    const url = URL.createObjectURL(new Blob([a.dados], { type: 'application/x-pkcs12' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: a.nome });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <>
      {(parte === 'gov' || parte === 'tudo') && (
        <Cartao titulo="gov.br">
          <Linha rotulo="Login">
            <span className="cofre-senha">
              <input type="text" className="pessoal-select" value={vm.gov.login} onChange={e => vm.setGov({ ...vm.gov, login: e.target.value })} aria-label="Login gov.br" placeholder="CPF ou CNPJ" autoComplete="off" />
              <BotaoIcone icone="copiar" titulo="Copiar" onClick={() => { void navigator.clipboard.writeText(vm.gov.login).then(() => toast('Copiado.')); }} />
            </span>
          </Linha>
          <Linha rotulo="Senha"><Senha valor={vm.gov.senha} onMudar={v => vm.setGov({ ...vm.gov, senha: v })} rotulo="Senha gov.br" /></Linha>
          <Linha rotulo="Observação">
            <input type="text" className="pessoal-select cofre-obs" value={vm.gov.obs} onChange={e => vm.setGov({ ...vm.gov, obs: e.target.value })} aria-label="Observação gov.br" />
          </Linha>
          {vm.mudouGov && <div className="cofre-salvar"><button type="button" className="btn btn-primary" disabled={cofre.ocupado} onClick={() => void vm.salvarGov()}>Salvar</button></div>}
        </Cartao>
      )}
      {(parte === 'certificado' || parte === 'tudo') && <CertificadoA1 vm={vm} ocupado={cofre.ocupado} baixar={baixar} />}
    </>
  );
}
