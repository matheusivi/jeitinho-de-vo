import { requireRole } from "@/lib/auth/guard";
import { listUsers } from "@/lib/auth/users";
import { setActiveAction } from "./actions";
import { StaffForm } from "./StaffForm";

export default async function EquipePage() {
  const me = await requireRole("ADMIN");
  const users = await listUsers();
  return (
    <div className="pn-grid">
      <div>
        <h1 className="pn-h1">Equipe</h1>
        <p className="pn-sub">Funcionários veem pedidos e produção. Valores e relatórios ficam só com você.</p>
      </div>
      <StaffForm />
      <div className="pn-card pn-scroll">
        <table className="pn-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Acesso</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role === "ADMIN" ? "Administradora" : "Funcionário"}</td>
                <td><span className={`pn-tag ${u.active ? "" : "off"}`}>{u.active ? "Ativa" : "Desativada"}</span></td>
                <td>
                  {u.id !== me.id && (
                    <form action={setActiveAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="active" value={String(!u.active)} />
                      <button className="pn-btn ghost small" type="submit">{u.active ? "Desativar" : "Reativar"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
