// O cartão da empresa aberta, no cabeçalho da Tarefas (27/10/2026: "no canto superior esquerdo a empresa, codigo e cnpj"):
// o prédio, o nome e, embaixo, o código e o CNPJ. O clique abre uma janela flutuante com os dados da empresa, sem sair da
// tela ("quando eu clicar e para abrir uma janela flutuante dos dados da empresa não ir para o cadastro"); quem mexe no
// Cadastro tem, no pé dela, o "Editar no Cadastro". Fecha no ×, no Fechar, clicando fora ou no Esc.
import { BotaoFechar, Esqueleto, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { useCartaoDaEmpresa } from './useCartaoDaEmpresa';

type Vm = ReturnType<typeof useCartaoDaEmpresa>;

function JanelaDosDados({ vm }: { vm: Vm }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  return (
    <div className="modal-overlay" role="presentation" onClick={vm.fechar}>
      <div ref={janela} className="modal dados-empresa" role="dialog" aria-modal="true" aria-labelledby="dadosEmpresaTitulo" onClick={e => e.stopPropagation()}>
        <header className="dados-empresa-topo">
          <span className="cartao-empresa-icone" aria-hidden="true"><Icone nome="predio" width={18} height={18} /></span>
          <div className="cartao-empresa-texto">
            <h3 id="dadosEmpresaTitulo" className="dados-empresa-nome">{vm.nome}</h3>
            {vm.doc && <span className="cartao-empresa-doc num">{vm.doc}</span>}
          </div>
          <BotaoFechar onClick={vm.fechar} />
        </header>
        <div className="dados-empresa-corpo">
          {vm.carregando ? <Esqueleto linhas={5} /> : (
            <dl className="dados-empresa-lista">
              {vm.linhas.map(l => (
                <div key={l.rotulo} className="dados-empresa-linha">
                  <dt>{l.rotulo}</dt>
                  <dd>{l.valor}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="modal-actions">
          {vm.podeEditar && <button type="button" className="btn btn-outline" onClick={vm.editar}><Icone nome="lapis" width={16} height={16} />Editar no Cadastro</button>}
          <button type="button" className="btn btn-primary" onClick={vm.fechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export function CartaoDaEmpresa({ empresa }: { empresa: { codigo: number | null; nome: string; rota: string } }) {
  const vm = useCartaoDaEmpresa(empresa);
  return (
    <>
      <button type="button" className="cartao-empresa" onClick={vm.abrir} title={'Ver os dados de ' + vm.nome}>
        <span className="cartao-empresa-icone" aria-hidden="true"><Icone nome="predio" width={18} height={18} /></span>
        <span className="cartao-empresa-texto">
          <span className="cartao-empresa-nome">{vm.nome}</span>
          {vm.doc && <span className="cartao-empresa-doc num">{vm.doc}</span>}
        </span>
      </button>
      {vm.aberta && <JanelaDosDados vm={vm} />}
    </>
  );
}
