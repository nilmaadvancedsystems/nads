// O esqueleto de carregamento da Área do Cliente (versão D, Vitor, 16/10/2026): o desenho da Visão geral (o cartão de
// boas-vindas, os quatro números e a lista) com as linhas do Esqueleto do nads, que já têm o brilho passando.
const Linha = ({ w, grande }: { w: string; grande?: boolean }) => <span className={'esqueleto-linha' + (grande ? ' grande' : '')} style={{ width: w }} />;

export function EsqueletoDaArea() {
  return (
    <div className="cli-esqueleto" role="status" aria-label="Carregando">
      <div className="card"><Linha w="18%" /><Linha w="46%" grande /><Linha w="62%" /></div>
      <div className="cli-numeros">
        {[0, 1, 2, 3].map(i => <div key={i} className="cli-numero"><Linha w="55%" /><Linha w="35%" grande /><Linha w="70%" /></div>)}
      </div>
      <div className="card">{[72, 58, 66, 50].map(w => <Linha key={w} w={w + '%'} />)}</div>
    </div>
  );
}
