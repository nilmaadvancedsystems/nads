// O avatar de uma pessoa na Área do Cliente (versão D, Vitor, 16/10/2026): a foto quando tem; sem foto, as iniciais num
// círculo de tom suave (sempre o mesmo para o mesmo nome). Com onFoto, vira o botão de subir a foto: ao passar o mouse (ou,
// no celular, sempre num cantinho) aparece a câmera "Adicionar foto" ou "Trocar foto", e o clique abre o seletor de imagem
// (JPG ou PNG). Peça do catálogo (Avatares).
import { Icone } from '@nads/ui';
import { useId } from 'react';
import { ACEITA_FOTO } from './foto';
import { iniciais, tomDoNome } from './pessoa';

export function Avatar({ nome, foto, tamanho = 36, onFoto, ocupado }: {
  nome: string; /** data URL */ foto?: string; /** em px: 36 na tabela, 72 na ficha */ tamanho?: number; onFoto?: (arquivo: File) => void; ocupado?: boolean;
}) {
  const id = useId();
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.35) };
  const rosto = foto
    ? <img className="cli-avatar-foto" src={foto} alt="" width={tamanho} height={tamanho} />
    : <span className={'cli-iniciais' + tomDoNome(nome)} style={estilo}>{iniciais(nome)}</span>;
  if (!onFoto) return <span className="cli-avatar" style={estilo} aria-hidden="true">{rosto}</span>;
  const acao = (foto ? 'Trocar a foto de ' : 'Adicionar uma foto de ') + nome;
  return (
    <label htmlFor={id} className={'cli-avatar cli-avatar-mexe' + (ocupado ? ' ocupado' : '')} style={estilo} title={foto ? 'Trocar foto' : 'Adicionar foto'}>
      {rosto}
      <span className="cli-avatar-camera" aria-hidden="true"><Icone nome="camera" width={Math.max(14, Math.round(tamanho * 0.36))} height={Math.max(14, Math.round(tamanho * 0.36))} /></span>
      <input id={id} type="file" className="sr-only" accept={ACEITA_FOTO} aria-label={acao} disabled={ocupado}
        onChange={ev => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) onFoto(f); }} />
    </label>
  );
}
