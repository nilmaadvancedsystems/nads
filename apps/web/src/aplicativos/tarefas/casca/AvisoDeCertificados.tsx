// A faixa dos certificados digitais (Vitor, 19/10/2026: "quero que notifique quando o certificado venceu ou está próximo de
// vencer"): o admin abre a Tarefas e vê quantos certificados do cofre estão vencidos ou vencem em até 30 dias, com o
// botão para Senhas › Certificados. Fechar esconde até o dia seguinte, neste navegador. O celular e o e-mail são do robô
// (robo/certificados-do-cofre.js). O ViewModel é o useAvisoDeCertificados.
import { Alerta } from '@nads/ui';
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from './navegacao';
import { useAvisoDeCertificados } from './useAvisoDeCertificados';

export function AvisoDeCertificados({ ligado }: { ligado: boolean }) {
  const ir = useNavigate();
  const vm = useAvisoDeCertificados(ligado);
  if (!vm.mostrar) return null;
  return (
    // pergunta: a faixa fica até a pessoa agir (sozinha ela some em 3 s e o aviso passaria sem ninguém ver)
    <Alerta titulo={vm.titulo} texto={vm.texto} pergunta>
      <button type="button" className="btn btn-outline" onClick={() => { vm.fechar(); ir(caminhoDaPagina('senhas', 'certificados')); }}>Ver os certificados</button>
      <button type="button" className="btn btn-ghost" onClick={vm.fechar}>Fechar até amanhã</button>
    </Alerta>
  );
}
