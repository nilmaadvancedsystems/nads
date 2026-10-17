// ViewModel das faixas de conexão e de gravação recusada (16/10/2026, a cópia fiel do Entregas: atualizarStatusConexao e
// mostrarPerdidas_). Sem sinal, o que a pessoa faz fica esperando e sobe quando a internet voltar (enquanto a página estiver
// aberta); o que o servidor recusar depois do "salvo" fica registrado neste aparelho até "Entendi, limpar aviso".
import { useEffect, useState } from 'react';
import { useEntregasDeDocumentos } from '../../dados/repo';

export function useFaixaDasGravacoes() {
  const repo = useEntregasDeDocumentos();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const n = repo.pendentesDeSubir();
  const fila = n ? ' ' + n + (n === 1 ? ' registro esperando' : ' registros esperando') + ' pra subir.' : '';
  const perdidas = repo.perdidas();
  const texto = perdidas.map(p => p.oQue + ' (' + p.motivo + ')').join('; ');
  return {
    conexao: !online ? { titulo: 'Sem conexão.', texto: 'O que você fizer agora fica guardado e sincroniza sozinho quando a internet voltar.' + fila }
      : n ? { titulo: 'Sincronizando.', texto: fila.trim() + ' Pode continuar usando normalmente.' } : null,
    perdidas: !perdidas.length ? '' : perdidas.length === 1 ? 'Isto não chegou no servidor: ' + texto + '. Refaça o registro.'
      : perdidas.length + ' registros não chegaram no servidor: ' + texto + '. Refaça esses registros.',
    limpar: () => repo.limparPerdidas(),
  };
}
