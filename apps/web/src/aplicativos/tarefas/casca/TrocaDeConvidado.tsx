// O modo convidado do modo desenvolvedor (26/11/2026: "No modo desenvolvedor coloca uma funcao de 2 usuarios ficticios, onde eu
// posso escolher o setor e a hierarquia"; "ai eu posso alterar entre os perfis"; "E ser duas pessoas diferentes vendo o nads,
// coloca no centro"; "O modo guest, apos ligar o desenvolvedor, fica 2 convidados"): no centro do topo, Eu · Convidado 1 ·
// Convidado 2; a engrenagem de cada convidado troca o nome, o setor e a hierarquia. Ser um convidado liga as tarefas de exemplo
// (tudo na memória, nada vai para o banco).
import type { usuarios } from '@nads/core';
import { Icone, MenuSuspenso } from '@nads/ui';
import { useTrocaDeConvidado } from './useTrocaDeConvidado';

export function TrocaDeConvidado() {
  const vm = useTrocaDeConvidado();
  if (!vm.ligado) return null;
  return (
    <div className="troca-convidado" role="group" aria-label="Modo convidado (desenvolvedor)">
      <button type="button" className={'troca-convidado-btn' + (vm.sendoEu ? ' ativo' : '')} onClick={vm.voltarAEu} title="Voltar a ser você">
        <Icone nome="usuario" width={14} height={14} />{vm.eu}
      </button>
      {vm.convidados.map(p => (
        <span key={p.uid} className={'troca-convidado-perfil' + (p.ativo ? ' ativo' : '')}>
          <button type="button" className="troca-convidado-btn" onClick={() => vm.ser(p)}
            title={'Ver o nads como ' + p.nome + ' (tarefas de exemplo, nada vai para o banco)'}>
            {p.nome}<small>{p.resumo}</small>
          </button>
          <MenuSuspenso className="troca-convidado-cfg" semSeta flutuante largura={240} titulo={'Ajustar ' + p.nome} dica={'Setor e hierarquia de ' + p.nome}
            rotulo={<Icone nome="settings" width={13} height={13} />}
            conteudo={() => (
              <div className="troca-convidado-form">
                <label><span>Nome</span>
                  <input type="text" className="input" defaultValue={p.nome} maxLength={40} onBlur={e => vm.mudar(p.uid, { nome: e.target.value.trim() })}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
                </label>
                <label><span>Setor</span>
                  <select className="input" value={p.departamento} onChange={e => vm.mudar(p.uid, { departamento: e.target.value as usuarios.Departamento })}>
                    {vm.setores.map(d => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
                  </select>
                </label>
                <label><span>Hierarquia</span>
                  <select className="input" value={p.nivel} onChange={e => vm.mudar(p.uid, { nivel: e.target.value as usuarios.Nivel })}>
                    {vm.niveis.map(n => <option key={n.id} value={n.id}>{n.rotulo}</option>)}
                  </select>
                </label>
              </div>
            )} />
        </span>
      ))}
    </div>
  );
}
