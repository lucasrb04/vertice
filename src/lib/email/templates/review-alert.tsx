import { Link, Text } from "@react-email/components";
import { EmailLayout, linkStyle, paragraph } from "./layout";

export type ReviewAlertProps = {
  targetLabel: string;
  targetName: string;
  url: string;
};

export function ReviewAlertEmail({ targetLabel, targetName, url }: ReviewAlertProps) {
  return (
    <EmailLayout preview={`${targetLabel} em revisão por denúncias: ${targetName}`}>
      <Text style={paragraph}>
        {targetLabel} <strong>{targetName}</strong> atingiu o limite de denúncias e foi ocultado da vitrine até a
        revisão.
      </Text>
      <Text style={paragraph}>
        Para restaurar, ocultar em definitivo ou descartar as denúncias, acesse o{" "}
        <Link href={url} style={linkStyle}>
          portal de administração
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}
