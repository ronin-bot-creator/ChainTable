// components/DailyCheckInButton.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract, // Mantenemos este hook para leer el contador de streak
  useAccount,
} from "wagmi";
import { mainnet } from 'wagmi/chains'

const DAILY_CHECK_IN_CONTRACT_ADDRESS = "0x739cd8c33076b8e28363642fd8f1955e97a27d9c";


const DAILY_CHECK_IN_CONTRACT_ABI = [
  // --- TU ABI COMPLETO VA AQUÍ ---
  // (Deja todo tu ABI aquí tal como lo tienes, ya que es el ABI correcto para tu contrato)
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "limitDailyCheckIn",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "periodStartTimeInUTC",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AlreadyCheckedIn",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "DailyLimitExceeded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidInitialization",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotInitializing",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "period",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "count",
        "type": "uint256"
      }
    ],
    "name": "CheckedIn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "version",
        "type": "uint64"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "limitDailyCheckIn",
        "type": "uint256"
      }
    ],
    "name": "LimitDailyCheckInUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_QUERY_LIMIT",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PERIOD_DURATION",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "checkIn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "computePeriod",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "delegatee",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "period",
        "type": "uint256"
      }
    ],
    "name": "getCheckInCount",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getCurrentStreak",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "from",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "to",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "limit",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "offset",
      "type": "uint256"
      }
    ],
    "name": "getHistory",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "numPeriod",
        "type": "uint256"
      },
      {
        "internalType": "uint256[]",
        "name": "periods",
        "type": "uint256[]"
      },
      {
        "internalType": "uint256[]",
        "name": "streakCounts",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "getLastUpdatedPeriod",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLimitDailyCheckIn",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPeriodStartTimeInUTC",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "period",
        "type": "uint256"
      }
    ],
    "name": "getStreakAtPeriod",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "isCheckedInToday",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "name": "isMissedCheckIn",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "limitDailyCheckIn",
        "type": "uint256"
      }
    ],
    "name": "setLimitDailyCheckIn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
// --- FIN CONFIGURACIÓN DE TU CONTRATO ---

export default function DailyCheckInButton() {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusColor, setStatusColor] = useState<string>("black");

  const { address: userAddress, isConnected } = useAccount();

  const {
    data: hash,
    writeContract,
    isPending: isCheckInPending,
    isError: isWriteError,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });


  const {
    data: checkInCount, // Aquí se almacenará el valor de la racha (streak)
    refetch: refetchCheckInCount, // Función para actualizar manualmente este contador
    isFetching: isFetchingCheckInCount, // Estado de carga de la lectura
    isError: isCheckInCountError, // Si hay un error al leer
    error: checkInCountError, // El objeto de error si existe
  } = useReadContract({
    address: DAILY_CHECK_IN_CONTRACT_ADDRESS,
    abi: DAILY_CHECK_IN_CONTRACT_ABI,
    functionName: "getCurrentStreak", // Nombre de la función en tu contrato para obtener la racha/contador
    args: [userAddress!], // Pasa la dirección del usuario como argumento, ¡es crucial!
    query: {
      enabled: isConnected && !!userAddress, // Solo se ejecuta si la wallet está conectada y hay una dirección
      refetchInterval: 10000, // Refresca el contador cada 10 segundos
    }
  });


  useEffect(() => {
    if (isCheckInPending) {
      setStatusMessage("Enviando transacción de check-in...");
      setStatusColor("orange");
    } else if (isConfirming) {
      setStatusMessage("Esperando confirmación de la transacción...");
      setStatusColor("blue");
    } else if (isConfirmed) {
      setStatusMessage("¡Check-in realizado con éxito!");
      setStatusColor("green");
      // Ahora queremos refrescar el nuevo contador, no el viejo "lastCheckIn"
      refetchCheckInCount(); // Llama a la función para refrescar el contador
    } else if (isWriteError) {
      console.error("Error al enviar el check-in:", writeError);
      let errorMessage = "Error desconocido al enviar la transacción.";
      if (
        writeError?.cause &&
        typeof (writeError.cause as any).shortMessage === "string"
      ) {
        errorMessage = (writeError.cause as any).shortMessage;
      } else if (writeError?.message) {
        errorMessage = writeError.message;
      }
      setStatusMessage(`Error: ${errorMessage}`);
      setStatusColor("red");
    }
    // Asegúrate de que refetchCheckInCount esté aquí y que refetchLastCheckIn NO esté.
  }, [isCheckInPending, isConfirming, isConfirmed, isWriteError, writeError, refetchCheckInCount]);

  const handleCheckIn = async () => {
    if (!isConnected || !userAddress) {
      setStatusMessage("Por favor, conecta tu wallet primero.");
      setStatusColor("red");
      return;
    }

    writeContract({
      address: DAILY_CHECK_IN_CONTRACT_ADDRESS,
      abi: DAILY_CHECK_IN_CONTRACT_ABI,
      // VERIFICA: Esta línea ya debería estar correcta, solo asegúrate del nombre de la función.
      functionName: "checkIn",
      // VERIFICA: Esta línea ya debería estar correcta, solo asegúrate que la función checkIn en tu contrato toma un 'address user'.
      args: [userAddress],
    });
  };


  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-md">
      <h2 className="text-xl font-bold">Daily Check-in</h2>
      
      {userAddress && (
        <p className="text-sm text-gray-600">
          Tu Wallet: <span className="font-mono">{userAddress.slice(0, 6)}...{userAddress.slice(-4)}</span>
        </p>
      )}

      <p className="text-sm">
        Daily Checks:{" "}
        {isFetchingCheckInCount ? ( // Muestra "Cargando..." mientras se obtiene el contador
          <span>Cargando...</span>
        ) : isCheckInCountError ? ( // Muestra un mensaje de error si falla la lectura
          <span className="text-red-500">Error al cargar ({checkInCountError?.shortMessage || checkInCountError?.message})</span>
        ) : (
          // Muestra el contador si todo está bien. .toString() convierte el BigInt a string.
          <span className="font-semibold">{checkInCount != null ? checkInCount.toString() : "N/A"}</span>
        )}
      </p>

      <Button
        onClick={handleCheckIn}
        className="bg-white text-black hover:text-white"
        disabled={!isConnected || isCheckInPending || isConfirming}
      >
        {isCheckInPending ? "Enviando..." : isConfirming ? "Confirmando..." : "Daily Check-in"}
      </Button>

      {statusMessage && (
        <p style={{ color: statusColor }} className="mt-2 text-sm text-center">
          {statusMessage}
        </p>
      )}
      
      {hash && !isConfirming && isConfirmed && (
        <p className="text-xs text-gray-500 break-words mt-1">
          Transacción Hash: <a href={`https://saigon-app.roninchain.com/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">{hash}</a>
        </p>
      )}
    </div>
  );
}