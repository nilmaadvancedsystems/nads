// O esqueleto de carregamento da Área do Cliente (versão D, Vitor, 16/10/2026), refeito no formato da Visão geral de
// hoje (13/11/2026: "primeira impressão"): a saudação, o "Precisa de você" com as linhas (o ícone redondo, o título, o
// texto e o botão) e, embaixo, os próximos vencimentos e o enviar documento com os quatro tipos. As linhas do Esqueleto do
// nads, com o brilho passando.
const Linha = ({ w, grande }: { w: string; grande?: boolean }) => <span className={'esqueleto-linha' + (grande ? ' grande' : '')} style={{ width: w }} />;

export function EsqueletoDaArea() {
  return (
    <div className="cli-esqueleto" role="status" aria-label="Carregando a sua área">
      <div className="cli-esq-titulo"><Linha w="180px" grande /><Linha w="240px" /></div>
      <div className="card">
        <Linha w="140px" />
        {[64, 52, 58].map(w => (
          <div key={w} className="cli-esq-linha">
            <span className="cli-esq-bola" />
            <span className="cli-esq-txt"><Linha w={w + '%'} /><Linha w={w - 18 + '%'} /></span>
            <span className="cli-esq-botao" />
          </div>
        ))}
      </div>
      <div className="cli-esq-duas">
        <div className="card">{[30, 70, 62, 74, 58].map((w, i) => <Linha key={i} w={w + '%'} />)}</div>
        <div className="card">
          <Linha w="45%" />
          <div className="cli-esq-tipos">{[0, 1, 2, 3].map(i => <span key={i} className="cli-esq-tipo" />)}</div>
          <span className="cli-esq-soltar" />
        </div>
      </div>
      <p className="cli-esq-texto">Abrindo a sua área…</p>
    </div>
  );
}
