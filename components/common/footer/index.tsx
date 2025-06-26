import Link from "next/link";
import XIcon from "../icons/x-icon";
import FacebookIcon from "../icons/facebook-icon";
import InstagramIcon from "../icons/instagram-icon";
import LinkedinIcon from "../icons/linkedin-icon";

export default function Footer() {
  return (
    <footer className="bg-primary">
      <section className="relative overflow-hidden py-10">
        <div className="relative z-10 gap-10 md:gap-14 lg:gap-0 container grid grid-cols-1 sm:grid-cols-2 text-base lg:grid-cols-4 justify-between text-white bg-primary">
          <div className="flex items-center justify-center w-full lg:border-r lg:border-white/80">
            {/* <picture className="">
              <img
                src={imgLogo.src}
                alt="Logo NCA"
                className="size-full object-cover "
              />
            </picture> */}
          </div>
          <div className="flex flex-col gap-4 linkHref text-center w-full lg:border-r lg:border-white/80">
            <div className="flex flex-col lg:self-center lg:text-start text-center gap-3">
              <span className="font-bold text-2xl">Accesos</span>
              <Link href={"/institucional"}>About</Link>
              <Link href={"/nuestra-red"}>Dashboard</Link>
            </div>
          </div>

          <div className="flex flex-col gap-4 linkHref text-center w-full lg:border-r lg:border-white/80">
            <div className="flex flex-col lg:self-center lg:text-start text-center gap-3">
              <span className="font-bold text-2xl">Términos legales</span>
              <Link href={"/terminos-y-condiciones"}>
                Términos y condiciones
              </Link>
              <Link href={"/politica-de-privacidad"}>
                Política de privacidad
              </Link>
              <Link href={"/politica-de-cookies"}>Política de cookies</Link>
            </div>
          </div>

          <div className="flex flex-col gap-4 linkHref text-center w-full">
            <div className="flex flex-col lg:self-center lg:text-start text-center gap-3">
              <span className="font-bold text-2xl">Redes sociales</span>
              <div className="flex lg:justify-start justify-center">
                <XIcon className="w-6 h-6 text-white hover:text-blue-400 transition-colors duration-300" />
                <FacebookIcon className="w-6 h-6 text-white hover:text-blue-400 transition-colors duration-300 ml-3" />
                <InstagramIcon className="w-6 h-6 text-white hover:text-blue-400 transition-colors duration-300 ml-3" />
                <LinkedinIcon className="w-6 h-6 text-white hover:text-blue-400 transition-colors duration-300 ml-3" />
              </div>
              <div className="mt-3">
                <Link href={"mailto:desarrollo@wallet.com"}>
                  desarrollo@wallet.com
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex bg-[#060D2E] py-4">
        <div className="container flex flex-col sm:flex-row items-center gap-10">
          <div className="flex gap-10 items-center">
            <div className="text-sm text-white">
              <p>© {new Date().getFullYear()} NCA</p>
              <p className="text-nowrap">Todos los derechos reservados</p>
            </div>
          </div>
        </div>
      </section>
    </footer>
  );
}
