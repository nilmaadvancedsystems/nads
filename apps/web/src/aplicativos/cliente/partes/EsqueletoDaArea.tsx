// O esqueleto de carregamento da Área do Cliente (versão D, Vitor, 16/10/2026): o desenho da Visão geral com as linhas do
// Esqueleto do nads, que já têm o brilho passando. "Melhora mais" de 17/10/2026: o veredito no alto (o círculo e a frase)
// e, embaixo, as duas colunas (as guias à esquerda; o envio e o atendimento à direita).
const Linha = ({ w, grande }: { w: string; grande?: boolean }) => <span className={'esqueleto-linha' + (grande ? ' grande' : '')} style={{ width: w }} />;

export function EsqueletoDaArea() {
  return (
    <div className="cli-esqueleto" role="status" aria-label="Carregando">
      <div className="card cli-veredito"><div className="cli-veredito-topo">
        <span className="cli-veredito-ico" aria-hidden="true" />
        <div className="cli-veredito-txt"><Linha w="22%" /><Linha w="40%" grande /><Linha w="58%" /></div>
      </div></div>
      <div className="cli-duas cli-visao">
        <div className="card">{[72, 58, 66, 50].map(w => <Linha key={w} w={w + '%'} />)}</div>
        <div className="card">{[60, 80, 45].map(w => <Linha key={w} w={w + '%'} />)}</div>
      </div>
    </div>
  );
}
