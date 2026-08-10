/**
 * UserSelect — Seletor de usuário vinculado à lista de usuários ativos do sistema.
 * Substitui campos de texto livre de "Responsável / Operador / Colaborador".
 *
 * Props:
 *   value      — nome do usuário selecionado (string) ou null/undefined
 *   onChange   — callback com o nome selecionado (string) ou "" para limpar
 *   placeholder — texto exibido quando nenhum usuário está selecionado
 *   className  — classes extras para o elemento <select>
 *   allowEmpty — se true, exibe opção "— Sem responsável —" (padrão: true)
 */
import { trpc } from "@/lib/trpc";

interface UserSelectProps {
  value: string | null | undefined;
  onChange: (name: string) => void;
  placeholder?: string;
  className?: string;
  allowEmpty?: boolean;
  style?: React.CSSProperties;
}

export default function UserSelect({
  value,
  onChange,
  placeholder = "Selecionar responsável",
  className = "",
  allowEmpty = true,
  style,
}: UserSelectProps) {
  const { data: users = [], isLoading } = trpc.localUsers.activeList.useQuery();

  const baseClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white " +
    className;

  if (isLoading) {
    return (
      <select disabled className={baseClass} style={style}>
        <option>Carregando usuários...</option>
      </select>
    );
  }

  return (
    <select
      className={baseClass}
      style={style}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
    >
      {allowEmpty && (
        <option value="">{placeholder}</option>
      )}
      {users.map(u => (
        <option key={u.id} value={u.name}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
