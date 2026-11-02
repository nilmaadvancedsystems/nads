// O cartão da empresa aberta, no cabeçalho da Tarefas (27/10/2026: "no canto superior esquerdo a empresa, codigo e cnpj"):
// o prédio, o nome e, embaixo, o código e o CNPJ. O clique abre a janela da empresa do Cadastro por cima da tela, sem sair
// dela ("era pra seguir o layout do cadastro"): quem mexe no Cadastro, com todas as abas; os outros, só os dados.
import { ConfigLinha, ConfigSecao, Esqueleto, Icone } from '@nads/ui';
import { Suspense } from 'react';
import { createPortal } from 'react-dom';
import { pedaco } from '../../../comum/pedaco';
import { useCartaoDaEmpresa } from './useCartaoDaEmpresa';

// a janela do Cadastro só baixa quando a pessoa clica no cartão
const JanelaDaEmpresa = pedaco(() => import('../telas/cadastro/janela/JanelaDaEmpresa'), 'JanelaDaEmpresa');

type Vm = ReturnType<typeof useCartaoDaEmpresa>;

/** a aba Dados da empresa para quem não mexe no Cadastro: as linhas, sem editar */
function DadosSoLeitura({ vm }: { vm: Vm }) {
  if (vm.carregando) return <Esqueleto linhas={5} />;
  return (
    <ConfigSecao titulo="Identificação">
      {vm.linhas.map(l => <ConfigLinha key={l.rotulo} titulo={l.rotulo}><span className="cfg-valor">{l.valor}</span></ConfigLinha>)}
    </ConfigSecao>
  );
}

export function CartaoDaEmpresa({ empresa }: { empresa: { codigo: number | null; nome: string; rota: string } }) {
  const vm = useCartaoDaEmpresa(empresa);
  return (
    <>
      <button type="button" className="cartao-empresa" onClick={vm.abrir} title={'Ver o cadastro de ' + vm.nome}>
        <span className="cartao-empresa-icone" aria-hidden="true"><Icone nome="predio" width={18} height={18} /></span>
        <span className="cartao-empresa-texto">
          <span className="cartao-empresa-nome">{vm.nome}</span>
          {vm.doc && <span className="cartao-empresa-doc num">{vm.doc}</span>}
        </span>
      </button>
      {/* no corpo da página: dentro do cabeçalho, a janela ficava presa no tamanho dele */}
      {vm.aba && createPortal(
        // enquanto a janela baixa, nada aparece (a barra do topo anda)
        <Suspense fallback={null}>
          <JanelaDaEmpresa rota={empresa.rota} aba={vm.aba} local={{ irPara: vm.irPara, fechar: vm.fechar }}
            soLeitura={vm.podeEditar ? undefined : <DadosSoLeitura vm={vm} />} />
        </Suspense>,
        document.body,
      )}
    </>
  );
}
