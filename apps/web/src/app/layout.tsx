import type { Metadata } from "next";
import { SocketProvider } from "../hooks/useSocket";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Split or Steal Arena",
  description: "Can you trust the person in front of you?",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SocketProvider>
          <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            {children}
          </main>
        </SocketProvider>
      </body>
    </html>
  );
}
