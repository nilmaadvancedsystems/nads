// O bloco "Link do cliente" na janela da empresa do Cadastro (Vitor, 16/10/2026): liga o BlocoDoLink aos dados e às ações.
import { BlocoDoLink } from './partes/BlocoDoLink';
import { PessoasComSenha } from './partes/PessoasComSenha';
import { useLinkDaEmpresa } from './useLinkDaEmpresa';
import { usePessoasComSenha } from './usePessoasComSenha';

export function LinkDoClienteNaEmpresa({ codigo, nome }: { codigo: number; nome: string }) {
  const vm = useLinkDaEmpresa(codigo);
  const { acoes, link } = vm;
  // as pessoas com senha (18/11/2026: "a area de cliente vai ter senha de acesso", "Uma por pessoa")
  const pessoas = usePessoasComSenha(codigo, link?.token ?? '', acoes.pode);
  const e = { codigo, nome };
  return (
    <>
    <BlocoDoLink endereco={vm.endereco} data={vm.data} podeMexer={acoes.pode} carregando={vm.carregando} ocupado={acoes.ocupada === codigo}
      aoGerar={() => void acoes.gerar(e)} aoCopiar={() => link && acoes.copiar(link.token)} aoWhatsApp={() => link && acoes.whatsapp(e, link.token)}
      aoTrocar={() => void acoes.trocar(e)} aoRevogar={() => void acoes.revogar(e)}
      logo={vm.logo} gravandoLogo={vm.gravandoLogo} aoEnviarLogo={vm.enviarLogo} aoTirarLogo={vm.tirarLogo}
      guiasAbertas={vm.guiasAbertas} />
    <PessoasComSenha vm={pessoas} />
    </>
  );
}
