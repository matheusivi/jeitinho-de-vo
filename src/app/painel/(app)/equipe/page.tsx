import { requireRole } from "@/lib/auth/guard";
import { listUsers } from "@/lib/auth/users";
import { ActiveToggle, ResetMfaButton, StaffForm } from "./StaffForm";

export default async function EquipePage() {
  const me = await requireRole("ADMIN");
  const users = await listUsers();
  return (
    <div className="pn-grid">
      <div>
        <h1 className="pn-h1">Equipe</h1>
        <p className="pn-sub">Funcionárias veem pedidos e produção. Valores e relatórios ficam só com administradoras, que entram sempre com o código do celular.</p>
      </div>
      <StaffForm />
      <div className="pn-card pn-scroll">
        <table className="pn-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Acesso</th><th>Código no celular</th><th>Situação</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role === "ADMIN" ? "Administradora" : "Funcionária"}</td>
                <td>
                  {u.mfaEnabled ? <span className="pn-tag">ativo</span> : <span className="pn-muted">{u.role === "ADMIN" ? "pendente" : "não usa"}</span>}
                  {u.mfaEnabled && u.role === "STAFF" && <div style={{ marginTop: 6 }}><ResetMfaButton id={u.id} /></div>}
                </td>
                <td><span className={`pn-tag ${u.active ? "" : "off"}`}>{u.active ? "Ativa" : "Desativada"}</span></td>
                <td>
                  {u.id !== me.id && <ActiveToggle id={u.id} active={u.active} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
