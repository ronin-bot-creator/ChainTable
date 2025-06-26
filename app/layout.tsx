"use client";
import { Inter } from "next/font/google";
import { getDefaultConfig, TantoProvider } from "@sky-mavis/tanto-widget";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import "./globals.css";
import Navbar from "@/components/common/navbar";
import Footer from "@/components/common/footer";
import "react-material-symbols/rounded";

const inter = Inter({ subsets: ["latin"] });

const config = getDefaultConfig({
  keylessWalletConfig: {
    enable: true,
    clientId: "your-client-id",
  },
});
const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <TantoProvider>
              <Navbar />
              {children}
              <Footer />
            </TantoProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
