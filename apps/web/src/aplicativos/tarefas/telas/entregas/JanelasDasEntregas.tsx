// O lugar das janelas da entrega de documentos (16/10/2026, a cópia fiel do Entregas: uma janela por vez, como o
// modalRoot de lá). Cada página do módulo põe a sua tela dentro dele; quem abre uma janela pede pelo useJanelasDasEntregas.
import { useMemo, useState, type ReactNode } from 'react';
import { CtxDasJanelas, type JanelaDaEntrega } from './contextoDasJanelas';
import { JanelaDaParada } from './JanelaDaParada';
import { JanelaDasJuntas } from './JanelaDasJuntas';
import { JanelaDoCliente } from './JanelaDoCliente';
import { JanelaAglutinar, JanelaCorrigirLocal, JanelaDaEntregaFeita, JanelaLinkDoCliente } from './JanelasDoCliente';
import { JanelaAssinarNoCelular, JanelaDaMeta, JanelaDosLembretes, JanelaLerGuia, JanelaParaCopiar, JanelaSemEntrega } from './JanelasPequenas';

export function JanelasDasEntregas({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState<JanelaDaEntrega | null>(null);
  // cada abertura ganha uma chave nova: abrir a mesma janela de novo (voltar do QR para a parada) remonta o quadro
  const [vez, setVez] = useState(0);
  const controle = useMemo(() => ({
    aberta,
    abrir: (j: JanelaDaEntrega) => { setAberta(j); setVez(v => v + 1); },
    fechar: () => setAberta(null),
  }), [aberta]);
  return (
    <CtxDasJanelas.Provider value={controle}>
      {children}
      {aberta && <Janela key={vez} j={aberta} />}
    </CtxDasJanelas.Provider>
  );
}

function Janela({ j }: { j: JanelaDaEntrega }) {
  switch (j.tipo) {
    case 'parada': return <JanelaDaParada entrega={j.entrega} assinatura={j.assinatura} />;
    case 'juntas': return <JanelaDasJuntas titulo={j.titulo} lista={j.entregas} />;
    case 'lembretes': return <JanelaDosLembretes clientes={j.clientes} />;
    case 'assinarNoCelular': return <JanelaAssinarNoCelular entrega={j.entrega} />;
    case 'lerGuia': return <JanelaLerGuia />;
    case 'cliente': return <JanelaDoCliente clienteId={j.clienteId} consulta={j.consulta} aba={j.aba} />;
    case 'entrega': return <JanelaDaEntregaFeita entrega={j.entrega} nome={j.nome} clienteId={j.clienteId} voltar={j.voltar} />;
    case 'corrigirLocal': return <JanelaCorrigirLocal clienteId={j.clienteId} voltar={j.voltar} />;
    case 'aglutinar': return <JanelaAglutinar clienteId={j.clienteId} voltar={j.voltar} />;
    case 'link': return <JanelaLinkDoCliente clienteId={j.clienteId} />;
    case 'meta': return <JanelaDaMeta />;
    case 'semEntrega': return <JanelaSemEntrega ids={j.ids} />;
    case 'copiar': return <JanelaParaCopiar titulo={j.titulo} texto={j.texto} />;
  }
}
