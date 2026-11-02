// Os segredos de uma empresa (07/10/2026): a senha gov.br e o certificado digital A1, em cartões com uma opção por linha.
// Mostrar/esconder e copiar a senha; escolher e baixar o .pfx. Usado na janela do módulo Senhas e na aba Senhas do Cadastro.
import { BotaoIcone, Esqueleto, Icone, useRetorno } from '@nads/ui';
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

export function SegredosDaEmpresa({ vm: cofre, empresa, codigo, parte }: { vm: VmCofre; empresa: string; codigo: number | null; parte: 'gov' | 'certificado' | 'simples' | 'tudo' }) {
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
          <div className="cofre-acoes"><a className="btn btn-outline" href="https://sso.acesso.gov.br/login" target="_blank" rel="noreferrer"><Icone nome="link" />Abrir o gov.br</a></div>
        </Cartao>
      )}
      {/* o código de acesso do Simples Nacional (Heverton, 20/10/2026): no cofre, embaralhado como a senha gov.br */}
      {(parte === 'simples' || parte === 'tudo') && (
        <Cartao titulo="Simples Nacional">
          <Linha rotulo="Código de acesso"><Senha valor={vm.simples.codigo} onMudar={v => vm.setSimples({ ...vm.simples, codigo: v })} rotulo="Código de acesso do Simples Nacional" /></Linha>
          <Linha rotulo="CPF do responsável">
            <span className="cofre-senha">
              <input type="text" inputMode="numeric" className="pessoal-select" value={vm.simples.cpf} onChange={e => vm.setSimples({ ...vm.simples, cpf: e.target.value })} aria-label="CPF do responsável" placeholder="Só os números" autoComplete="off" />
              <BotaoIcone icone="copiar" titulo="Copiar" onClick={() => { void navigator.clipboard.writeText(vm.simples.cpf.replace(/\D/g, '')).then(() => toast('Copiado.')); }} />
            </span>
          </Linha>
          <Linha rotulo="Observação">
            <input type="text" className="pessoal-select cofre-obs" value={vm.simples.obs} onChange={e => vm.setSimples({ ...vm.simples, obs: e.target.value })} aria-label="Observação do Simples Nacional" />
          </Linha>
          {vm.mudouSimples && <div className="cofre-salvar"><button type="button" className="btn btn-primary" disabled={cofre.ocupado} onClick={() => void vm.salvarSimples()}>Salvar</button></div>}
          <div className="cofre-acoes"><a className="btn btn-outline" href="https://www8.receita.fazenda.gov.br/SimplesNacional/controleAcesso/Autentica.aspx?id=6" target="_blank" rel="noreferrer"><Icone nome="link" width={16} height={16} />Abrir o portal do Simples</a></div>
        </Cartao>
      )}
      {(parte === 'certificado' || parte === 'tudo') && <CertificadoA1 vm={vm} ocupado={cofre.ocupado} baixar={baixar} />}
    </>
  );
}
