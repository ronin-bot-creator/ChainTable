import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-center">
      <h1 className="text-6xl font-extrabold mb-4 text-yellow-400 font-jersey">
        CHAIN TABLE 🃏
      </h1>
      <p className="text-lg mb-10 max-w-xl text-gray-300">
        El clásico UNO, ahora en la blockchain. Conecta tu billetera y jugá en
        lobbies públicos, privados o pagos.
      </p>
      <Link
        to="/auth"
        className="px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl hover:scale-105 transition"
      >
        Play now!
      </Link>
    </div>
  );
}
