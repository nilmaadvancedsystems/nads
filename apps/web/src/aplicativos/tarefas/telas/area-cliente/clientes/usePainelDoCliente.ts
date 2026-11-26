// ViewModel do painel de uma empresa na seção Clientes (26/11/2026, o módulo Área do Cliente refeito: "o mais bonito e de
// facil entendimento possivel"). Tudo o que antes ficava no Cadastro › janela da empresa, em blocos separados: o link, as
// pessoas e a senha, a logo e as guias que o cliente abriu (os hooks antigos useLinkDaEmpresa, useAcoesDoLink e
// usePessoasComSenha, que o Cadastro ainda usa), mais a pasta DO ESCRITÓRIO do Drive (o que o cliente vê em "Do
// escritório"), lida do mapa só com o painel aberto. Só o admin mexe; os outros veem em modo leitura.
import { useNavigate } from 'react-router';
import { useModoDesenvolvedor } from '../../../../../comum/modoDesenvolvedor';
import { documentosDoEscritorioNoDrive, pastaDaEmpresaNoMapa } from '../../../dados/clientesDaArea';
import { useDriveDoEntregas } from '../../../dados/repo';
import { useLinkDaEmpresa } from '../useLinkDaEmpresa';
import { usePessoasComSenha } from '../usePessoasComSenha';
import { dataEHora } from '../base/comum';

/** "482 KB" */
function tamanho(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

export function usePainelDoCliente(codigo: number, nome: string) {
  const vm = useLinkDaEmpresa(codigo);
  const { acoes, link } = vm;
  const pode = acoes.pode;
  const pessoas = usePessoasComSenha(codigo, link?.token ?? '', pode);
  const drive = useDriveDoEntregas();
  const ir = useNavigate();
  const [dev] = useModoDesenvolvedor();
  const empresa = { codigo, nome };

  // a pasta DO ESCRITÓRIO da empresa no mapa do ano (o robô do Entregas mantém o mapa; os itens só carregam quando pedidos)
  const mapa = drive.mapa();
  const pasta = mapa.carregado ? pastaDaEmpresaNoMapa(mapa.clientes, codigo) : null;
  const itens = pasta ? drive.itens(pasta.id) : null;
  const documentos = itens ? documentosDoEscritorioNoDrive(itens.itens, pasta!.id) : [];

  return {
    /** o vm do link (para as peças BlocoDoLink e PessoasComSenha do catálogo, as mesmas do Cadastro) */
    link: vm,
    pode,
    carregando: vm.carregando,
    temLink: !!link,
    /** o endereço só aparece para o admin (23/11/2026: "apenas adm pode ver e editar isso"): o link é a chave da área */
    endereco: pode ? vm.endereco : '',
    linkDesde: link?.atualizadoEm ? dataEHora(link.atualizadoEm) : '',
    ocupado: acoes.ocupada === codigo,
    gerar: () => void acoes.gerar(empresa),
    copiar: () => { if (link) acoes.copiar(link.token); },
    whatsapp: () => { if (link) acoes.whatsapp(empresa, link.token); },
    temWhatsApp: !!acoes.telefoneDe(nome),
    trocar: () => void acoes.trocar(empresa),
    revogar: () => void acoes.revogar(empresa),

    pessoas,

    logo: vm.logo,
    gravandoLogo: vm.gravandoLogo,
    erroDasLogos: vm.erroDasLogos,
    enviarLogo: vm.enviarLogo,
    tirarLogo: vm.tirarLogo,

    guiasAbertas: vm.guiasAbertas,

    documentos: {
      carregando: !mapa.carregado || (!!pasta && !itens!.carregados),
      erro: mapa.erro ? 'Não consegui ler o mapa do Drive: ' + mapa.erro : '',
      semPasta: mapa.carregado && !mapa.erro && !pasta,
      lista: documentos.map(d => ({ id: d.id, nome: d.nome, area: d.rotuloDaArea, data: d.modificadoEm ? new Date(d.modificadoEm).toLocaleDateString('pt-BR') : '', tamanho: tamanho(d.tamanho) })),
    },

    /** abre a área como o cliente vê (só no modo desenvolvedor, rotasDoModoDev.tsx; lê o banco e não grava nada); null = sem botão */
    verComoCliente: dev && link ? () => ir('/cliente/' + encodeURIComponent(link.token)) : null,
  };
}
