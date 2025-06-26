import ContentHome from "@/components/module/home/content-home";

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
    </>
  );
}
