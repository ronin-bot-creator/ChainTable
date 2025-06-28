// app/page.tsx
 // <--- Asegúrate de que esta línea esté presente si el botón es un componente de cliente o si en esta página necesitas interactuar con el navegador.

import ContentHome from "@/components/module/home/content-home";
import React from "react";
import DailyCheckInButton from "@/components/common/DailyCheckInButton/DailyCheckInButton";

export function generateMetadata() {
  return {
    title: "CryptoApp - Tu Plataforma de Criptomonedas",
    openGraph: {
      type: "website",
      url: "https://cryptoapp.com",
      title: "CryptoApp - Tu Plataforma de Criptomonedas",
      description:
        "Invierte, gestiona y explora el mundo blockchain con nuestra plataforma segura y moderna.",
      // images: [
      //   {
      //     url: (imagen.url as string) || "",
      //   },
      // ],
    },
    twitter: {
      card: "summary_large_image",
      title: "CryptoApp - Tu Plataforma de Criptomonedas",
      description:
        "Invierte, gestiona y explora el mundo blockchain con nuestra plataforma segura y moderna.",
      // images: [
      //   {
      //     url: (imagen.url as string) || "",
      //   },
      // ],
    },
  };
}

export default function Home() {
  return (
    <>
      <ContentHome />
      {/* Aquí es donde agregas el DailyCheckInButton */}
      <div style={{ margin: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '10px' }}>Sección de Check-in</h2>
        <DailyCheckInButton />
      </div>
    </>
  );
}