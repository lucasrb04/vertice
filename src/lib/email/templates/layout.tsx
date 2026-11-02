import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

const font = "Georgia, 'Times New Roman', serif";

/** Moldura comum dos e-mails: texto sobre fundo claro, filete fino, sem imagens. */
export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#fafaf9", margin: 0, padding: "24px 0", fontFamily: font, color: "#1c1917" }}>
        <Container style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", padding: "24px", maxWidth: "560px" }}>
          <Text style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Vértice</Text>
          <Hr style={{ borderColor: "#e7e5e4", margin: "16px 0" }} />
          <Section>{children}</Section>
          <Hr style={{ borderColor: "#e7e5e4", margin: "16px 0" }} />
          <Text style={{ margin: 0, fontSize: "12px", color: "#78716c" }}>
            Mensagem automática do Vértice, plataforma de vagas e projetos da UNIFEI. Não responda a este e-mail.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const paragraph = { margin: "0 0 12px", fontSize: "15px", lineHeight: "1.5" } as const;
export const linkStyle = { color: "#1c1917", textDecoration: "underline" } as const;
