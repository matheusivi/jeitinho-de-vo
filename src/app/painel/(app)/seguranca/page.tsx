import { needsMfaSetup, requireUserForSetup } from "@/lib/auth/guard";
import { mfaStatus, startEnrollment } from "@/lib/auth/mfa";
import { ConfirmForm, DisableForm, RegenerateForm } from "./MfaForms";

export const metadata = { title: "Segurança · Painel Jeitinho de Vó" };

export default async function SegurancaPage() {
  const user = await requireUserForSetup();
  const status = await mfaStatus(user.id);
  const admin = user.role === "ADMIN";

  if (!status.enabled) {
    const { secret, qrSvg } = await startEnrollment(user);
    const grouped = secret.match(/.{1,4}/g)!.join(" ");
    return (
      <div className="pn-grid" style={{ gap: 24, maxWidth: 760 }}>
        <div>
          <h1 className="pn-h1">Código no celular</h1>
          {needsMfaSetup(user) ? (
            <p className="pn-msg err" style={{ margin: 0 }}>
              Para administradora, o código no celular é obrigatório. Ative agora para usar o painel: leva 2 minutos.
            </p>
          ) : (
            <p className="pn-sub" style={{ margin: 0 }}>
              Opcional para você. Com ele, além da senha, o login pede um código que só o seu celular tem.
            </p>
          )}
        </div>
        <section className="pn-card pn-grid" aria-label="Configurar">
          <ol className="pn-steps">
            <li>
              Instale no celular um aplicativo autenticador: <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> ou <strong>Authy</strong>.
            </li>
            <li>
              No aplicativo, toque em adicionar (+) e leia o QR code abaixo com a câmera.
              <div className="pn-row" style={{ alignItems: "center", gap: 20, marginTop: 12 }}>
                <div className="pn-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-label="QR code para o aplicativo autenticador" role="img" />
                <div style={{ flex: "1 1 220px" }}>
                  <p className="pn-muted" style={{ margin: 0 }}>Não conseguiu ler? Digite esta chave no aplicativo:</p>
                  <code style={{ fontSize: 16, wordBreak: "break-all" }}>{grouped}</code>
                </div>
              </div>
            </li>
            <li>Digite o código de 6 números que o aplicativo mostrar e toque em Ativar.</li>
          </ol>
          <ConfirmForm />
        </section>
      </div>
    );
  }

  return (
    <div className="pn-grid" style={{ gap: 24, maxWidth: 760 }}>
      <div>
        <h1 className="pn-h1">Código no celular</h1>
        <p className="pn-sub" style={{ margin: 0 }}>
          <span className="pn-tag">ativo</span> O login pede a senha e o código do aplicativo. Restam {status.recoveryLeft} código(s) de recuperação.
        </p>
      </div>
      <section className="pn-card pn-grid" aria-label="Códigos de recuperação">
        <h2 style={{ margin: 0, fontSize: 18 }}>Códigos de recuperação</h2>
        {status.recoveryLeft <= 2 && <p className="pn-msg err" style={{ margin: 0 }}>Restam poucos códigos. Gere novos e guarde.</p>}
        <RegenerateForm />
      </section>
      {!admin && (
        <section className="pn-card pn-grid" aria-label="Desativar">
          <h2 style={{ margin: 0, fontSize: 18 }}>Desativar</h2>
          <p className="pn-muted" style={{ margin: 0 }}>Você volta a entrar só com a senha.</p>
          <DisableForm />
        </section>
      )}
    </div>
  );
}
