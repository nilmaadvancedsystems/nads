// O cartão da empresa aberta, no cabeçalho da Tarefas (27/10/2026: "no canto superior esquerdo a empresa, codigo e cnpj e
// se clicar abre o cadastro da empresa com informações"): o prédio, o nome e, embaixo, o código e o CNPJ. O clique abre a
// janela da empresa no Cadastro (quem mexe no Cadastro: o admin, o diretor e o sênior); para os outros, só mostra.
import { Icone } from '@nads/ui';
import { useCartaoDaEmpresa } from './useCartaoDaEmpresa';

export function CartaoDaEmpresa({ empresa }: { empresa: { codigo: number | null; nome: string; rota: string } }) {
  const vm = useCartaoDaEmpresa(empresa);
  return (
    <button type="button" className="cartao-empresa" onClick={vm.abrir} disabled={!vm.pode} title={vm.pode ? 'Abrir o cadastro de ' + vm.nome : vm.nome}>
      <span className="cartao-empresa-icone" aria-hidden="true"><Icone nome="predio" width={18} height={18} /></span>
      <span className="cartao-empresa-texto">
        <span className="cartao-empresa-nome">{vm.nome}</span>
        {vm.doc && <span className="cartao-empresa-doc num">{vm.doc}</span>}
      </span>
    </button>
  );
}
