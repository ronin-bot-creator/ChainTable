import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";
import { ethers } from "ethers";
import type {
  LobbyType,
  CreateLobbyFormData,
  SupportedNetwork,
  SupportedToken,
} from "../types/lobby";
import { NETWORK_CONFIGS } from "../types/lobby";
import { useSocket } from "../hooks/useSocket";
import { socketService } from "../services/socketService";
import {
  getUserId,
  getUserSession,
  clearUserSession,
} from "../utils/userSession";
import { useTranslation } from 'react-i18next'

// Importar imágenes de tokens
import ronIcon from "../assets/tokens/ron.png";
import riceIcon from "../assets/tokens/rice.png";
import ronkeIcon from "../assets/tokens/ronke.png";

// Interfaz local para los formularios
interface LobbyFormData {
  name: string;
  password?: string;
  entryCost?: number;
}

const Lobbies: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation()
  const { address: walletAddress, isConnected: isWalletConnected } =
    useAccount();
  const { disconnect: disconnectWallet } = useDisconnect();
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [isUserNameSet, setIsUserNameSet] = useState<boolean>(false);
  // removed unused tabId state

  // Usar el hook de websockets
  const {
    isConnected,
    isLoading,
    error: socketError,
    activeLobbies,
    createLobby: socketCreateLobby,
    joinLobby: socketJoinLobby,
    joinLobbyOnchain: socketJoinLobbyOnchain,
    refreshLobbies,
    connect,
    disconnect,
  } = useSocket() as any;

  // Estado para los formularios de cada lobby
  const [lobbyForms, setLobbyForms] = useState<
    Record<LobbyType, LobbyFormData>
  >({
    publico: { name: "" },
    privado: { name: "", password: "" },
    // store entryCost as string to allow decimals like 0.001
    pago: { name: "", entryCost: "" as unknown as number },
  });
  // Estado adicional para lobbies pagos (modo, token y red)
  const [pagoMode, setPagoMode] = useState<"BEAST" | "CLASSIC">("BEAST");
  const [pagoToken, setPagoToken] = useState<SupportedToken>("RON");
  const [pagoNetwork, setPagoNetwork] = useState<SupportedNetwork>("ronin"); // Changed to ronin mainnet

  // Contract addresses per network (UnoLobbyV2 - Max 8 players - Nueva wallet segura)
  const CONTRACT_ADDRESSES: Record<string, string> = {
    sepolia: "0x640b9985a069782a662286D86CcD2681d2A35AD1",
    "ronin-saigon": "0x2161843aed57dd6aa085955c593E9Ff32153bEbe",
    ronin: "0x2161843aed57dd6aa085955c593E9Ff32153bEbe",
  }; // basic minimal ABI for createLobby and joinLobby
  const UNO_ABI = [
    "function createLobby(address token, uint256 entryFee, uint16 maxPlayers, uint8 mode) returns (uint256)",
    "function joinLobby(uint256 lobbyId) payable",
    "event LobbyCreated(uint256 indexed lobbyId, address indexed creator, address token, uint256 entryFee, uint16 maxPlayers, uint8 mode)",
  ];

  // Helper para obtener el icono del token
  const getTokenIcon = (tokenSymbol: SupportedToken): string => {
    switch (tokenSymbol) {
      case "RON":
        return ronIcon;
      case "RICE":
        return riceIcon;
      case "RONKE":
        return ronkeIcon;
      case "ETH":
        return "⟠"; // Ethereum (emoji como fallback)
      default:
        return "💰";
    }
  };

  // Cargar información del usuario desde la sesión y verificar wallet
  useEffect(() => {
    try {
      const session = getUserSession();
      if (
        session &&
        session.walletAddress &&
        isWalletConnected &&
        walletAddress === session.walletAddress
      ) {
        setUserName(session.walletAddress); // Usar la dirección como username
        setIsUserNameSet(true);
        console.log(
          "👤 Sesión EVM cargada en lobbies, Wallet:",
          session.walletAddress
        );
      } else {
        console.error("❌ No hay sesión EVM completa, redirigiendo a auth...");
        navigate("/auth");
      }
    } catch (error) {
      console.error(
        "❌ Error al cargar sesión EVM, redirigiendo a auth...",
        error
      );
      navigate("/auth");
    }
  }, [navigate, isWalletConnected, walletAddress]);

  // Conectar automáticamente cuando se tenga el nombre
  useEffect(() => {
    // La conexión la maneja el SocketProvider central; no invocamos connect() aquí
    // para evitar llamadas duplicadas que puedan recrear/desconectar el socket.
  }, [isUserNameSet, connect]);

  // Limpiar mensajes
  const clearMessages = useCallback(() => {
    setSuccessMessage("");
    setErrorMessage("");
  }, []);

  // Función para añadir una red a MetaMask si no existe
  const addNetworkToMetaMask = async (network: SupportedNetwork) => {
    const networkConfig = NETWORK_CONFIGS[network];
    const chainIdHex = "0x" + networkConfig.chainId.toString(16);

    try {
      await (window as any).ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: networkConfig.name,
            nativeCurrency: {
              name: networkConfig.nativeCurrency.name,
              symbol: networkConfig.nativeCurrency.symbol,
              decimals: networkConfig.nativeCurrency.decimals,
            },
            rpcUrls: [networkConfig.rpcUrl],
            blockExplorerUrls: networkConfig.blockExplorer
              ? [networkConfig.blockExplorer]
              : undefined,
          },
        ],
      });
      console.log(`✅ Red ${networkConfig.name} añadida a MetaMask`);
      return true;
    } catch (error: any) {
      console.error("Error añadiendo red a MetaMask:", error);
      throw new Error(
        `No se pudo añadir la red ${networkConfig.name}: ${error.message}`
      );
    }
  };

  // Cerrar sesión y desconectar wallet
  const handleLogout = useCallback(() => {
    clearUserSession();
    disconnect();
    disconnectWallet();
    navigate("/");
  }, [disconnect, disconnectWallet, navigate]);

  // Mostrar errores de socket
  useEffect(() => {
    if (socketError) {
      setErrorMessage(socketError);
    }
  }, [socketError]);

  // Manejo optimizado de creación de lobbies con useCallback
  const handleCreateLobby = useCallback(
    async (type: LobbyType) => {
      clearMessages();
      const formData = lobbyForms[type];

      try {
        // Crear los datos del formulario según el tipo
        const createLobbyData: CreateLobbyFormData = {
          type,
          name: formData.name,
          ...(type === "privado" && { password: formData.password }),
          ...(type === "pago" && {
            entryCost: formData.entryCost?.toString(),
            token: pagoToken,
            mode: pagoMode,
            network: pagoNetwork,
          }),
        };

        // Usar websockets para crear el lobby
        const creatorId = getUserId();
        const creatorUsername = userName;

        // Validaciones específicas para lobbies pagos
        if (type === "pago") {
          if (!createLobbyData.name || createLobbyData.name.trim().length < 3) {
            throw new Error("Nombre del lobby inválido");
          }
          if (
            !createLobbyData.entryCost ||
            parseFloat(createLobbyData.entryCost) <= 0
          ) {
            throw new Error("Costo de entrada inválido");
          }
          if (!userName) {
            throw new Error("Conecta tu wallet antes de crear un lobby pago");
          }

          // Validar que la red y el token sean compatibles
          const networkConfig = NETWORK_CONFIGS[pagoNetwork];
          const tokenConfig = networkConfig.supportedTokens.find(
            (t) => t.symbol === pagoToken
          );
          if (!tokenConfig) {
            throw new Error(
              `Token ${pagoToken} no soportado en la red ${networkConfig.name}`
            );
          }
        }

        // If this is a paid lobby with on-chain support, perform an on-chain createLobby first (MetaMask will prompt)
        const contractAddress = CONTRACT_ADDRESSES[pagoNetwork];
        if (type === "pago" && contractAddress) {
          console.log("🔗 Initiating on-chain lobby creation...", {
            type,
            pagoNetwork,
            contractAddress,
          });
          if (typeof window === "undefined" || !(window as any).ethereum)
            throw new Error("No web3 provider (MetaMask) detected");
          if (!contractAddress)
            throw new Error(
              `Contract address not configured for ${pagoNetwork}`
            );

          // Ensure MetaMask is connected; get signer via ethers BrowserProvider
          const provider = new ethers.BrowserProvider((window as any).ethereum);

          // Request accounts to ensure MetaMask is unlocked and get current account
          const accounts = await provider.send("eth_requestAccounts", []);
          if (!accounts || accounts.length === 0) {
            throw new Error(
              "No hay cuentas disponibles en MetaMask. Por favor conecta tu wallet."
            );
          }
          const currentAccount = accounts[0];
          console.log("✅ Cuenta actual de MetaMask:", currentAccount);

          // Get network config and try to switch to the correct network
          const networkConfig = NETWORK_CONFIGS[pagoNetwork];
          const chainIdHex = "0x" + networkConfig.chainId.toString(16);

          try {
            await provider.send("wallet_switchEthereumChain", [
              { chainId: chainIdHex },
            ]);
            console.log(
              `✅ Switched to ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`
            );
          } catch (switchError: any) {
            // Error code 4902: la red no está agregada a MetaMask
            if (switchError.code === 4902) {
              console.log(
                `⚠️ Red ${networkConfig.name} no encontrada, intentando agregarla...`
              );
              try {
                await addNetworkToMetaMask(pagoNetwork);
                // Después de agregar, intentar cambiar de nuevo
                await provider.send("wallet_switchEthereumChain", [
                  { chainId: chainIdHex },
                ]);
                console.log(`✅ Red ${networkConfig.name} agregada y activada`);
              } catch (addError: any) {
                console.error("Error agregando red:", addError);
                setErrorMessage(
                  `No se pudo agregar la red ${networkConfig.name}. Por favor agrégala manualmente.`
                );
                throw new Error(`Failed to add network ${networkConfig.name}`);
              }
            } else {
              // Usuario rechazó el cambio de red o error diferente
              console.warn(
                `Network switch to ${networkConfig.name} failed`,
                switchError
              );
              setErrorMessage(
                `Por favor cambia tu red de MetaMask a ${networkConfig.name} y reintenta.`
              );
              throw new Error(`MetaMask network not ${networkConfig.name}`);
            }
          }

          // Get signer AFTER switching network
          const signer = await provider.getSigner();

          // Obtener configuración del token seleccionado
          const tokenConfig = networkConfig.supportedTokens.find(
            (t) => t.symbol === pagoToken
          );
          if (!tokenConfig) {
            throw new Error(`Token ${pagoToken} no soportado`);
          }

          // map token selection to address (native currency -> address(0), ERC20 -> token address)
          const tokenAddr =
            tokenConfig.address || "0x0000000000000000000000000000000000000000";

          // Normalize entryCost input: accept strings with comma or point, or numbers.
          const rawEntry = (createLobbyData.entryCost ?? "").toString();
          console.log("🔍 DEBUG rawEntry:", rawEntry, "tipo:", typeof rawEntry);
          const normalizedEntry = rawEntry.replace(",", ".").trim();
          console.log("🔍 DEBUG normalizedEntry:", normalizedEntry);
          if (!normalizedEntry) throw new Error("Costo de entrada inválido");
          const parsedNum = Number(normalizedEntry);
          console.log("🔍 DEBUG parsedNum:", parsedNum);
          if (isNaN(parsedNum)) throw new Error("Costo de entrada inválido");

          // entryFeeWei: if the user provided a decimal (contains '.') or a small number, treat as ETH and parse to wei
          let entryFeeWei: bigint;
          if (normalizedEntry.includes(".") || parsedNum < 1e12) {
            console.log(
              "🔍 DEBUG: Usando parseEther con normalizedEntry:",
              normalizedEntry
            );
            // parse as ETH decimal -> returns bigint in ethers v6
            entryFeeWei = ethers.parseEther(normalizedEntry);
            console.log(
              "🔍 DEBUG: entryFeeWei después de parseEther:",
              entryFeeWei.toString()
            );
          } else {
            console.log("🔍 DEBUG: Usando BigInt directo");
            // assume already a wei integer
            try {
              entryFeeWei = BigInt(normalizedEntry);
              console.log(
                "🔍 DEBUG: entryFeeWei después de BigInt:",
                entryFeeWei.toString()
              );
            } catch (err) {
              throw new Error("Costo de entrada inválido");
            }
          }

          // mode: BEAST=0, CLASSIC=1
          const modeNum = createLobbyData.mode === "CLASSIC" ? 1 : 0;

          // Verify the signer address matches current account
          const signerAddress = await signer.getAddress();
          console.log("🔑 Dirección del signer:", signerAddress);

          if (signerAddress.toLowerCase() !== currentAccount.toLowerCase()) {
            console.warn(
              "⚠️ La dirección del signer no coincide con la cuenta actual"
            );
            throw new Error(
              "Por favor selecciona la cuenta correcta en MetaMask"
            );
          }

          const contract = new ethers.Contract(
            contractAddress,
            UNO_ABI,
            signer
          );

          // Paso 1: Crear lobby on-chain
          setSuccessMessage("Paso 1/2: Creando lobby on-chain...");
          const createTx = await contract.createLobby(
            tokenAddr,
            entryFeeWei,
            3,
            modeNum
          );
          console.log("📝 Transacción createLobby enviada:", createTx.hash);

          const createReceipt = await createTx.wait();
          console.log("✅ Lobby creado on-chain");

          // Obtener el lobbyId del evento LobbyCreated
          const lobbyCreatedEvent = createReceipt?.logs?.find((log: any) => {
            try {
              const parsed = contract.interface.parseLog({
                topics: [...log.topics],
                data: log.data,
              });
              return parsed?.name === "LobbyCreated";
            } catch {
              return false;
            }
          });

          let onchainLobbyId: number | null = null;
          if (lobbyCreatedEvent) {
            const parsed = contract.interface.parseLog({
              topics: [...lobbyCreatedEvent.topics],
              data: lobbyCreatedEvent.data,
            });
            onchainLobbyId = parsed?.args?.lobbyId
              ? Number(parsed.args.lobbyId)
              : null;
            console.log("🎯 Lobby ID on-chain:", onchainLobbyId);
          }

          if (!onchainLobbyId) {
            throw new Error(
              "No se pudo obtener el lobby ID del evento LobbyCreated"
            );
          }

          // Paso 2: Aprobar token ERC20 si es necesario
          const isNativeToken =
            tokenAddr === "0x0000000000000000000000000000000000000000";

          if (!isNativeToken) {
            // Token ERC20: necesita aprobación antes de joinLobby
            setSuccessMessage(`Paso 2/3: Aprobando ${pagoToken}...`);
            console.log(
              "🪙 Aprobando token ERC20:",
              pagoToken,
              "en dirección:",
              tokenAddr
            );

            // ABI mínimo para ERC20 approve
            const ERC20_ABI = [
              "function approve(address spender, uint256 amount) returns (bool)",
              "function allowance(address owner, address spender) view returns (uint256)",
            ];

            const tokenContract = new ethers.Contract(
              tokenAddr,
              ERC20_ABI,
              signer
            );

            // Verificar si ya hay allowance suficiente
            const currentAllowance = await tokenContract.allowance(
              signerAddress,
              contractAddress
            );
            console.log("💰 Allowance actual:", currentAllowance.toString());

            if (currentAllowance < entryFeeWei) {
              console.log("📝 Enviando transacción approve...");
              const approveTx = await tokenContract.approve(
                contractAddress,
                entryFeeWei
              );
              console.log("📝 Transacción approve enviada:", approveTx.hash);

              await approveTx.wait();
              console.log("✅ Token aprobado");
            } else {
              console.log("✅ Allowance ya suficiente, saltando approve");
            }
          }

          // Paso 3: Auto-join del creador
          const stepNum = isNativeToken ? "2/2" : "3/3";
          setSuccessMessage(
            `Paso ${stepNum}: Uniéndose al lobby #${onchainLobbyId}...`
          );
          console.log("🎮 Creador uniéndose al lobby on-chain...");
          console.log("💰 Entry fee:", {
            entryFeeWei: entryFeeWei.toString() + " wei",
            entryFeeETH: ethers.formatEther(entryFeeWei) + " " + pagoToken,
          });

          console.log("📝 Enviando transacción joinLobby (auto-join)...");
          const joinTx = await contract.joinLobby(onchainLobbyId, {
            value: isNativeToken ? entryFeeWei : 0, // Solo pagar value si es token nativo
          });
          console.log("📝 Transacción joinLobby enviada:", joinTx.hash);

          const joinReceipt = await joinTx.wait();
          console.log("✅ Creador se unió al lobby on-chain");

          setSuccessMessage(
            "Lobby creado y creador registrado. Continuando con servidor..."
          );

          // attach on-chain references to payload so backend can verify if needed
          (createLobbyData as any).onchain = {
            txHash:
              createReceipt?.hash ||
              (createReceipt as any)?.transactionHash ||
              createTx.hash,
            joinTxHash:
              joinReceipt?.hash ||
              (joinReceipt as any)?.transactionHash ||
              joinTx.hash,
            contract: contractAddress,
            chain: pagoNetwork, // Use the selected network instead of hardcoded 'sepolia'
            lobbyId: onchainLobbyId,
            token: pagoToken, // Add token symbol for display
            entryFee: entryFeeWei.toString(), // Store entry fee in wei
          };
          // store entryCost in wei so server-side validation compares correctly
          (createLobbyData as any).entryCost = entryFeeWei.toString();
        }

        const createdLobby = await socketCreateLobby(
          createLobbyData,
          creatorId,
          creatorUsername
        );

        // Si es un lobby on-chain con auto-join, registrar al creador en el servidor
        if (type === "pago" && (createLobbyData as any).onchain?.joinTxHash) {
          console.log(
            "🔗 Registrando creador en el servidor después de auto-join..."
          );
          try {
            await socketJoinLobbyOnchain(
              createdLobby.id,
              undefined, // sin password
              {
                txHash: (createLobbyData as any).onchain.joinTxHash,
                contract: (createLobbyData as any).onchain.contract,
                chain: (createLobbyData as any).onchain.chain,
              }
            );
            console.log("✅ Creador registrado en el servidor");
          } catch (joinError) {
            console.error(
              "⚠️ Error registrando creador en servidor:",
              joinError
            );
            // No es crítico, el lobby ya existe
          }
        }

        // Limpiar formulario después de crear
        setLobbyForms((prev) => ({
          ...prev,
          [type]:
            type === "pago"
              ? { name: "", entryCost: 0 }
              : type === "privado"
              ? { name: "", password: "" }
              : { name: "" },
        }));

  setSuccessMessage(t('lobby_created_success', { name: formData.name }));

        // Navegar al juego
        navigate(`/game/${createdLobby.id}`);
      } catch (error) {
        console.error("Error creando lobby:", error);
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Error desconocido al crear el lobby";
        setErrorMessage(errorMsg);
      }
    },
    [
      lobbyForms,
      clearMessages,
      socketCreateLobby,
      navigate,
      pagoMode,
      pagoToken,
      pagoNetwork,
      userName,
    ]
  );

  // Manejo de actualización de lista
  const handleUpdateList = useCallback(() => {
    clearMessages();

    try {
      refreshLobbies();

      // Crear mensaje informativo
      const totalLobbies = activeLobbies.length;
      const waitingCount = activeLobbies.filter(
        (lobby: any) => lobby.status === "Esperando jugadores"
      ).length;
      const inGameCount = activeLobbies.filter(
        (lobby: any) => lobby.status === "En partida"
      ).length;

      setSuccessMessage(
        `Total de lobbies: ${totalLobbies} | Esperando: ${waitingCount} | En partida: ${inGameCount}`
      );
    } catch (error) {
      console.error("Error actualizando lista:", error);
      setErrorMessage("Error al obtener la lista de lobbies");
    }
  }, [clearMessages, refreshLobbies, activeLobbies]);

  // Manejo de unirse a un lobby
  const handleJoinLobby = useCallback(
    async (lobbyId: string, lobbyType: LobbyType) => {
      clearMessages();

      try {
        // Si es un lobby privado, pedir contraseña (simplificado para demo)
        let password: string | undefined;
        if (lobbyType === "privado") {
          password = prompt(t('prompt_private_password')) || undefined;
          if (!password) {
            setErrorMessage(t('password_required'));
            return;
          }
        }

        if (lobbyType === "pago") {
          // For paid lobbies we require on-chain payment first (Sepolia native flow supported)
          // Fetch lobby info from server to get entryCost and onchain contract info
          // We'll use socketService directly to request the lobby info and wait for response
          // (we import socketService at top of file)
          const lobbyInfo: any = await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("Timeout fetching lobby info")),
              10000
            );
            const handler = (resp: any) => {
              try {
                socketService.off("game:lobbyInfo", handler);
              } catch (e) {}
              clearTimeout(timeout);
              if (
                resp &&
                resp.success &&
                resp.lobby &&
                resp.lobby.id === lobbyId
              )
                resolve(resp.lobby);
              else
                reject(
                  new Error(resp.error || "No se pudo obtener info del lobby")
                );
            };
            try {
              socketService.on("game:lobbyInfo", handler as any);
              socketService.getLobbyInfo(lobbyId);
            } catch (e) {
              clearTimeout(timeout);
              reject(e);
            }
          });

          // Ensure on-chain metadata exists
          if (!lobbyInfo.onchain || !lobbyInfo.onchain.chain) {
            throw new Error(
              "Este lobby requiere pago on-chain. No se encontró metadata de la blockchain."
            );
          }

          const lobbyChain = lobbyInfo.onchain.chain;
          const contractAddress =
            lobbyInfo.onchain.contract || CONTRACT_ADDRESSES[lobbyChain];

          if (!contractAddress) {
            throw new Error(
              `Dirección de contrato no disponible para la red ${lobbyChain}`
            );
          }

          console.log(`🔗 Uniéndose a lobby on-chain en ${lobbyChain}`, {
            contractAddress,
            lobbyInfo,
          });

          // entryCost expected in wei string
          const entryCostWeiStr = String(lobbyInfo.entryCost || "0");
          console.log("💰 DEBUG entryCost:", {
            entryCostWeiStr,
            type: typeof entryCostWeiStr,
            lobbyInfoEntryCost: lobbyInfo.entryCost,
            paymentConfig: lobbyInfo.paymentConfig,
          });

          let entryFeeWei: bigint;
          try {
            entryFeeWei = BigInt(entryCostWeiStr);
            console.log("✅ Parsed as BigInt:", entryFeeWei.toString());
          } catch (e) {
            console.log("⚠️ Failed to parse as BigInt, trying parseEther...");
            // fallback: try parse as decimal ETH
            entryFeeWei = ethers.parseEther(
              String(entryCostWeiStr).replace(",", ".")
            );
            console.log("✅ Parsed with parseEther:", entryFeeWei.toString());
          }

          if (typeof window === "undefined" || !(window as any).ethereum)
            throw new Error("No web3 provider (MetaMask) detected");
          const provider = new ethers.BrowserProvider((window as any).ethereum);

          // Request accounts to ensure MetaMask is unlocked and get current account
          const accounts = await provider.send("eth_requestAccounts", []);
          if (!accounts || accounts.length === 0) {
            throw new Error(
              "No hay cuentas disponibles en MetaMask. Por favor conecta tu wallet."
            );
          }
          const currentAccount = accounts[0];
          console.log(
            "✅ Cuenta actual de MetaMask para unirse:",
            currentAccount
          );

          // Get network config and switch to the correct network
          const networkConfig = NETWORK_CONFIGS[lobbyChain as SupportedNetwork];
          if (!networkConfig) {
            throw new Error(`Red no soportada: ${lobbyChain}`);
          }

          const chainIdHex = "0x" + networkConfig.chainId.toString(16);

          try {
            await provider.send("wallet_switchEthereumChain", [
              { chainId: chainIdHex },
            ]);
            console.log(
              `✅ Switched to ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`
            );
          } catch (switchError: any) {
            // Error code 4902: la red no está agregada a MetaMask
            if (switchError.code === 4902) {
              console.log(
                `⚠️ Red ${networkConfig.name} no encontrada, intentando agregarla...`
              );
              try {
                await addNetworkToMetaMask(lobbyChain as SupportedNetwork);
                // Después de agregar, intentar cambiar de nuevo
                await provider.send("wallet_switchEthereumChain", [
                  { chainId: chainIdHex },
                ]);
                console.log(`✅ Red ${networkConfig.name} agregada y activada`);
              } catch (addError: any) {
                console.error("Error agregando red:", addError);
                setErrorMessage(
                  `No se pudo agregar la red ${networkConfig.name}. Por favor agrégala manualmente.`
                );
                throw new Error(`Failed to add network ${networkConfig.name}`);
              }
            } else {
              // Usuario rechazó el cambio de red o error diferente
              setErrorMessage(
                `Por favor cambia tu red de MetaMask a ${networkConfig.name} y reintenta.`
              );
              throw new Error(`MetaMask network not ${networkConfig.name}`);
            }
          }

          // Get signer AFTER switching network
          const signer = await provider.getSigner();

          // Verify the signer address matches current account
          const signerAddress = await signer.getAddress();
          console.log("🔑 Dirección del signer para pago:", signerAddress);

          if (signerAddress.toLowerCase() !== currentAccount.toLowerCase()) {
            console.warn(
              "⚠️ La dirección del signer no coincide con la cuenta actual"
            );
            throw new Error(
              "Por favor selecciona la cuenta correcta en MetaMask"
            );
          }

          // IMPORTANTE: Necesitamos el lobbyId ON-CHAIN (no el server lobbyId)
          const onchainLobbyId =
            lobbyInfo.onchain?.lobbyId || lobbyInfo.onchainLobbyId;
          if (
            !onchainLobbyId ||
            onchainLobbyId === "0" ||
            onchainLobbyId === 0
          ) {
            throw new Error(
              "Este lobby no tiene un ID on-chain válido. No puedes unirte a este lobby."
            );
          }

          // Verificar estado del lobby on-chain antes de intentar unirse
          const contract = new ethers.Contract(
            contractAddress,
            UNO_ABI,
            signer
          );

          try {
            // ABI para getLobby
            const LOBBY_VIEW_ABI = [
              "function lobbies(uint256) view returns (address creator, address token, uint256 entryFee, uint16 maxPlayers, uint8 mode, uint8 state)",
              "function getLobbyPlayers(uint256 lobbyId) view returns (address[] memory)",
            ];
            const viewContract = new ethers.Contract(
              contractAddress,
              LOBBY_VIEW_ABI,
              signer
            );

            const lobbyData = await viewContract.lobbies(onchainLobbyId);
            const lobbyPlayers = await viewContract.getLobbyPlayers(
              onchainLobbyId
            );

            console.log("📊 Estado del lobby on-chain:", {
              lobbyId: onchainLobbyId,
              creator: lobbyData.creator,
              token: lobbyData.token,
              entryFee: lobbyData.entryFee.toString(),
              maxPlayers: lobbyData.maxPlayers,
              currentPlayers: lobbyPlayers.length,
              state: lobbyData.state,
              players: lobbyPlayers,
            });

            // Verificar si el lobby está lleno
            if (lobbyPlayers.length >= lobbyData.maxPlayers) {
              throw new Error(
                `Este lobby ya está lleno (${lobbyPlayers.length}/${lobbyData.maxPlayers} jugadores)`
              );
            }

            // Verificar si ya estás en el lobby
            const alreadyJoined = lobbyPlayers.some(
              (p: string) => p.toLowerCase() === signerAddress.toLowerCase()
            );
            if (alreadyJoined) {
              throw new Error("Ya estás unido a este lobby");
            }
          } catch (error: any) {
            console.error("❌ Error verificando estado del lobby:", error);
            if (
              error.message.includes("lleno") ||
              error.message.includes("unido")
            ) {
              throw error; // Re-lanzar errores de validación
            }
            // Si no podemos verificar el estado, continuar pero advertir
            console.warn(
              "⚠️ No se pudo verificar el estado del lobby, continuando..."
            );
          }

          // Obtener información del token usado en el lobby DIRECTAMENTE DEL CONTRATO
          // NO confiar en lobbyInfo.paymentConfig porque puede no estar sincronizado
          const LOBBY_VIEW_ABI = [
            "function lobbies(uint256) view returns (address creator, address token, uint256 entryFee, uint16 maxPlayers, uint8 mode, uint8 state)",
          ];
          const viewContract = new ethers.Contract(
            contractAddress,
            LOBBY_VIEW_ABI,
            signer
          );
          const lobbyDataOnChain = await viewContract.lobbies(onchainLobbyId);

          const tokenAddr = lobbyDataOnChain.token; // Obtener token address del contrato
          const isNativeToken =
            tokenAddr === "0x0000000000000000000000000000000000000000";
          const lobbyToken =
            lobbyInfo.onchain?.token || (isNativeToken ? "RON" : "ERC20"); // Token símbolo

          console.log("🔍 Token info obtenida del contrato:", {
            tokenAddress: tokenAddr,
            isNative: isNativeToken,
            symbol: lobbyToken,
          });

          console.log("💰 Uniéndose al lobby on-chain:", {
            lobbyId: onchainLobbyId,
            token: lobbyToken,
            tokenAddress: tokenAddr,
            isNative: isNativeToken,
            entryFee: ethers.formatEther(entryFeeWei) + " " + lobbyToken,
            entryFeeWei: entryFeeWei.toString() + " wei",
            contractAddress,
          });

          // Si es token ERC20, aprobar primero
          if (!isNativeToken) {
            setSuccessMessage(`Aprobando ${lobbyToken}...`);
            console.log(
              "🪙 Aprobando token ERC20:",
              lobbyToken,
              "en dirección:",
              tokenAddr
            );

            // ABI mínimo para ERC20 approve
            const ERC20_ABI = [
              "function approve(address spender, uint256 amount) returns (bool)",
              "function allowance(address owner, address spender) view returns (uint256)",
            ];

            const tokenContract = new ethers.Contract(
              tokenAddr,
              ERC20_ABI,
              signer
            );

            // Verificar si ya hay allowance suficiente
            const currentAllowance = await tokenContract.allowance(
              signerAddress,
              contractAddress
            );
            console.log("💰 Allowance actual:", currentAllowance.toString());

            if (currentAllowance < entryFeeWei) {
              console.log("📝 Enviando transacción approve...");
              const approveTx = await tokenContract.approve(
                contractAddress,
                entryFeeWei
              );
              console.log("📝 Transacción approve enviada:", approveTx.hash);

              setSuccessMessage(
                "Aprobación enviada. Esperando confirmación..."
              );
              await approveTx.wait();
              console.log("✅ Token aprobado");
              setSuccessMessage("Token aprobado. Uniéndose al lobby...");
            } else {
              console.log("✅ Allowance ya suficiente, saltando approve");
              setSuccessMessage("Uniéndose al lobby...");
            }
          } else {
            setSuccessMessage("Uniéndose al lobby...");
          }

          // 🔍 DEBUGGING PROFUNDO antes de joinLobby
          console.log(
            "🔍 ==================== DEBUGGING PROFUNDO ===================="
          );
          try {
            // Obtener estado del lobby on-chain justo antes de unirse
            const LOBBY_STATE_ABI = [
              "function getLobbyPlayers(uint256 lobbyId) view returns (address[] memory)",
              "function isPlayerInLobby(uint256 lobbyId, address player) view returns (bool)",
            ];
            const stateContract = new ethers.Contract(
              contractAddress,
              LOBBY_STATE_ABI,
              signer
            );

            const currentPlayers = await stateContract.getLobbyPlayers(
              onchainLobbyId
            );
            const alreadyInLobby = await stateContract.isPlayerInLobby(
              onchainLobbyId,
              signerAddress
            );

            console.log("🎮 Estado del lobby ON-CHAIN (justo antes de join):", {
              lobbyId: onchainLobbyId,
              creator: lobbyDataOnChain.creator,
              token: lobbyDataOnChain.token,
              entryFee: lobbyDataOnChain.entryFee.toString(),
              maxPlayers: lobbyDataOnChain.maxPlayers,
              currentPlayers: currentPlayers.length,
              state: lobbyDataOnChain.state, // 0=OPEN, 1=STARTED, 2=ENDED
              players: currentPlayers,
              yourAddress: signerAddress,
              alreadyInLobby,
            });

            // Validaciones críticas
            if (alreadyInLobby) {
              throw new Error("Ya estás en este lobby on-chain");
            }

            if (currentPlayers.length >= Number(lobbyDataOnChain.maxPlayers)) {
              throw new Error(
                `Lobby lleno (${currentPlayers.length}/${lobbyDataOnChain.maxPlayers})`
              );
            }

            if (Number(lobbyDataOnChain.state) !== 0) {
              throw new Error(
                `Lobby no está OPEN (estado: ${lobbyDataOnChain.state}, esperado: 0=OPEN)`
              );
            }

            if (
              lobbyDataOnChain.entryFee.toString() !== entryFeeWei.toString()
            ) {
              console.warn("⚠️ Entry fee mismatch!", {
                expected: lobbyDataOnChain.entryFee.toString(),
                sending: entryFeeWei.toString(),
              });
            }

            // Verificar balance y allowance del token si es ERC20
            if (!isNativeToken) {
              const ERC20_BALANCE_ABI = [
                "function balanceOf(address owner) view returns (uint256)",
                "function allowance(address owner, address spender) view returns (uint256)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)",
              ];
              const tokenContract = new ethers.Contract(
                tokenAddr,
                ERC20_BALANCE_ABI,
                signer
              );

              const balance = await tokenContract.balanceOf(signerAddress);
              const allowance = await tokenContract.allowance(
                signerAddress,
                contractAddress
              );
              let decimals = 18;
              let symbol = "TOKEN";

              try {
                decimals = await tokenContract.decimals();
                symbol = await tokenContract.symbol();
              } catch (e) {
                console.warn("No se pudo obtener decimals/symbol del token");
              }

              console.log("💰 Balance del token:", {
                balance: balance.toString(),
                balanceFormatted: ethers.formatUnits(balance, decimals),
                symbol,
                required: entryFeeWei.toString(),
                requiredFormatted: ethers.formatUnits(entryFeeWei, decimals),
                hasEnough: balance >= entryFeeWei,
              });

              console.log("🔓 Allowance del token:", {
                allowance: allowance.toString(),
                allowanceFormatted: ethers.formatUnits(allowance, decimals),
                required: entryFeeWei.toString(),
                requiredFormatted: ethers.formatUnits(entryFeeWei, decimals),
                hasEnough: allowance >= entryFeeWei,
              });

              // Validar que hay suficiente balance
              if (balance < entryFeeWei) {
                throw new Error(
                  `Balance insuficiente de ${symbol}. Tienes ${ethers.formatUnits(
                    balance,
                    decimals
                  )} pero necesitas ${ethers.formatUnits(
                    entryFeeWei,
                    decimals
                  )}`
                );
              }

              // Validar que hay suficiente allowance
              if (allowance < entryFeeWei) {
                throw new Error(
                  `Allowance insuficiente. Tienes ${ethers.formatUnits(
                    allowance,
                    decimals
                  )} aprobado pero necesitas ${ethers.formatUnits(
                    entryFeeWei,
                    decimals
                  )}`
                );
              }
            }
          } catch (debugError: any) {
            console.error("❌ Error en debugging:", debugError);
            throw debugError;
          }
          console.log(
            "🔍 ============================================================"
          );

          // Llamar a joinLobby del contrato (ya creamos la instancia arriba)
          console.log("📝 Enviando transacción joinLobby...");
          console.log("   - Lobby ID:", onchainLobbyId);
          console.log(
            "   - Value:",
            isNativeToken ? entryFeeWei.toString() : "0"
          );
          console.log("   - Token address:", tokenAddr);
          console.log("   - Is native:", isNativeToken);

          const tx = await contract.joinLobby(onchainLobbyId, {
            value: isNativeToken ? entryFeeWei : 0, // Solo enviar value si es token nativo
          });
          console.log("✅ Transacción enviada:", tx.hash);

          setSuccessMessage(
            "Transacción de unión enviada. Esperando confirmación..."
          );
          const receipt = await tx.wait();
          setSuccessMessage(t('payment_confirmed_joining'));

          // Get txHash from receipt or tx
          const txHash =
            receipt?.hash || (receipt as any)?.transactionHash || tx.hash;
          if (!txHash)
            throw new Error("No se pudo obtener txHash de la transacción");

          await socketJoinLobbyOnchain(lobbyId, password, {
            txHash,
            contract: contractAddress,
            chain: "sepolia",
          });
          setSuccessMessage(t('payment_confirmed_joined'));
          navigate(`/game/${lobbyId}`);
          return;
        }

        // Non-paid or other-network join (normal flow)
        await socketJoinLobby(lobbyId, password);
  setSuccessMessage(t('joined_lobby_success'));
        navigate(`/game/${lobbyId}`);
      } catch (error) {
        console.error("Error uniéndose al lobby:", error);
        const errorMsg =
          error instanceof Error
            ? error.message
            : "Error desconocido al unirse al lobby";
        setErrorMessage(errorMsg);
      }
    },
    [clearMessages, socketJoinLobby, navigate]
  );

  // Manejo de cambios en formularios
  const handleInputChange = useCallback(
    (type: LobbyType, field: keyof LobbyFormData, value: string | number) => {
      setLobbyForms((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          [field]: value,
        },
      }));
    },
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white font-sans flex flex-col">
      {/* Encabezado mejorado */}
      <div className="relative bg-gradient-to-r from-slate-900 via-blue-950/30 to-slate-900 border-b border-slate-700/50 shadow-xl overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px)",
            }}
          ></div>
        </div>

        <div className="relative z-10 text-center py-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
              <span className="text-2xl">🃏</span>
            </div>
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-wider font-jersey">
              {t('title')}
            </h1>
          </div>
          <p className="text-gray-400 text-sm">{t('lobbies_title')}</p>
        </div>
      </div>

      {/* Estado de la conexión y usuario mejorado */}
      <div className="bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-sm border-b border-slate-700/50 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-4 px-6 md:px-8">
          {/* Información del usuario */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl px-4 py-2 shadow-lg border border-slate-700/50">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-3 shadow-md">
                <span className="text-white font-bold text-sm">
                  {walletAddress ? walletAddress.charAt(2).toUpperCase() : "?"}
                </span>
              </div>
              <div className="text-white">
                <div className="text-sm font-medium font-mono">
                  {walletAddress
                    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(
                        -4
                      )}`
                    : t('loading')}
                </div>
                <div className="text-xs text-gray-400">{t('wallet_connected')}</div>
              </div>
            </div>

            <button
              onClick={() => navigate("/auth")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 text-sm font-semibold"
              title={t('auth_change_wallet')}
            >
              🔄 {t('auth_change_wallet')}
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 text-sm font-semibold"
            >
              🚪 {t('auth_logout')}
            </button>
          </div>

          {/* Estado de conexión mejorado */}
          <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg border transition-all ${
                  isConnected
                    ? "bg-green-950/50 border-green-600/50"
                    : "bg-red-950/50 border-red-600/50"
                }`}
              >
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-400" : "bg-red-400"
                } animate-pulse`}
              ></div>
              <span
                className={`text-sm font-medium ${
                  isConnected ? "text-green-400" : "text-red-400"
                }`}
              >
                {isConnected ? t('status_connected') : t('status_disconnected')}
              </span>
            </div>

            <button
              onClick={() => (isConnected ? disconnect() : connect())}
              className={`px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 text-sm font-semibold ${
                isConnected
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {isConnected ? t('disconnect') : t('connect')}
            </button>
          </div>
        </div>
      </div>

      {/* Secciones de los lobbies */}
      <div className="flex-1 flex items-start justify-center p-8 bg-slate-950">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl">
          {/* Tarjeta de Lobby Público */}
          <div className="group bg-gradient-to-br from-blue-950/30 to-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-blue-700/30 transform hover:scale-[1.02] transition-all duration-300 hover:shadow-blue-500/20">
            <div className="bg-gradient-to-r from-blue-700/20 to-blue-800/20 px-6 py-5 border-b border-blue-700/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-xl">🌍</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">
                      {t('lobbies_public_label')}
                  </h2>
                    <p className="text-xs text-blue-300">{t('lobby_public_sub')}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">
                  {t('label_lobby_name')}
                </label>
                <input
                  type="text"
                  placeholder={t('placeholder_public_example')}
                  value={lobbyForms.publico.name}
                  onChange={(e) =>
                    handleInputChange("publico", "name", e.target.value)
                  }
                  className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  disabled={isLoading}
                />
              </div>
              <button
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-blue-500/30 shadow-lg disabled:transform-none disabled:shadow-none"
                onClick={() => handleCreateLobby("publico")}
                disabled={isLoading || !isConnected}
              >
                {isLoading ? t('creating') : t('lobbies_create')}
              </button>
              <button
                className="w-full text-blue-400 hover:text-blue-300 disabled:text-slate-500 font-semibold text-sm transition-colors"
                onClick={handleUpdateList}
                disabled={isLoading}
              >
                {isLoading ? t('updating') : t('lobbies_update_list')}
              </button>
            </div>
          </div>

          {/* Tarjeta de Lobby Privado */}
          <div className="group bg-gradient-to-br from-purple-950/30 to-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-purple-700/30 transform hover:scale-[1.02] transition-all duration-300 hover:shadow-purple-500/20">
            <div className="bg-gradient-to-r from-purple-700/20 to-purple-800/20 px-6 py-5 border-b border-purple-700/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-xl">🔒</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">
                    {t('lobbies_private_label')}
                  </h2>
                  <p className="text-xs text-purple-300">{t('lobby_private_sub')}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">
                  {t('label_lobby_name')}
                </label>
                <input
                  type="text"
                  placeholder={t('placeholder_private_example')}
                  value={lobbyForms.privado.name}
                  onChange={(e) =>
                    handleInputChange("privado", "name", e.target.value)
                  }
                  className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">
                  {t('label_password')}
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={lobbyForms.privado.password || ""}
                  onChange={(e) =>
                    handleInputChange("privado", "password", e.target.value)
                  }
                  className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  disabled={isLoading}
                />
              </div>
              <button
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-purple-500/30 shadow-lg disabled:transform-none disabled:shadow-none"
                onClick={() => handleCreateLobby("privado")}
                disabled={isLoading || !isConnected}
              >
                {isLoading ? t('creating') : t('lobbies_create')}
              </button>
              <button
                className="w-full text-purple-400 hover:text-purple-300 disabled:text-slate-500 font-semibold text-sm transition-colors"
                onClick={handleUpdateList}
                disabled={isLoading}
              >
                {isLoading ? t('updating') : t('lobbies_update_list')}
              </button>
            </div>
          </div>

          {/* Tarjeta de Lobby Pago (mejorada) */}
          <div className="group bg-gradient-to-br from-yellow-950/30 to-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-yellow-700/30 transform hover:scale-[1.02] transition-all duration-300 hover:shadow-yellow-500/20">
            <div className="bg-gradient-to-r from-yellow-700/20 to-orange-800/20 px-6 py-5 border-b border-yellow-700/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-xl">💰</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">
                      {t('lobbies_paid_label')}
                    </h2>
                    <p className="text-xs text-yellow-300">{t('lobbies_paid_sub')}</p>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="px-3 py-1 rounded-full bg-yellow-600 text-black font-semibold text-xs shadow-lg">
                    💰
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold shadow-lg ${
                      pagoMode === "BEAST"
                        ? "bg-gradient-to-r from-rose-600 to-red-600 text-white"
                        : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
                    }`}
                  >
                    {pagoMode}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">
                  {t('label_lobby_name')}
                </label>
                <input
                  type="text"
                  placeholder={t('placeholder_paid_example')}
                  value={lobbyForms.pago.name}
                  onChange={(e) =>
                    handleInputChange("pago", "name", e.target.value)
                  }
                  className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">
                    {t('game_entry_cost')}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.001"
                    min={0}
                    value={lobbyForms.pago.entryCost || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "pago",
                        "entryCost",
                        e.target.value as unknown as number
                      )
                    }
                    className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                    disabled={isLoading}
                  />
                </div>

                {/* Selector de moneda - solo mostrar para Ronin mainnet */}
                {pagoNetwork === "ronin" &&
                NETWORK_CONFIGS[pagoNetwork].supportedTokens.length > 1 ? (
                  <div>
                    <label className="block text-sm text-gray-300 mb-2 font-medium">
                      {t('label_currency')}
                    </label>
                    <div className="flex flex-col gap-2">
                      {NETWORK_CONFIGS[pagoNetwork].supportedTokens.map(
                        (token) => {
                          const icon = getTokenIcon(token.symbol);
                          const isImage =
                            icon.startsWith("/") || icon.includes(".");
                          return (
                            <button
                              key={token.symbol}
                              type="button"
                              onClick={() => setPagoToken(token.symbol)}
                              className={`flex items-center gap-3 px-4 py-2 rounded-lg border-2 transition-all ${
                                pagoToken === token.symbol
                                  ? "bg-yellow-600 border-yellow-400 text-white shadow-lg scale-105"
                                  : "bg-slate-800 border-slate-700 text-gray-300 hover:border-slate-600"
                              }`}
                            >
                              {isImage ? (
                                <img
                                  src={icon}
                                  alt={token.symbol}
                                  className="w-6 h-6 object-contain"
                                />
                              ) : (
                                <span className="text-xl">{icon}</span>
                              )}
                              <span className="font-semibold">
                                {token.symbol}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-gray-300 mb-2 font-medium">
                      Moneda
                    </label>
                    <div className="bg-slate-800/50 border-2 border-slate-700 rounded-xl px-4 py-3 text-white font-semibold">
                      {NETWORK_CONFIGS[pagoNetwork].nativeCurrency.symbol}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">
                    {t('label_distribution_mode')}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagoMode("BEAST")}
                      className={`flex-1 px-3 py-2 rounded-xl font-bold transition-all ${
                        pagoMode === "BEAST"
                          ? "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg scale-105"
                          : "bg-slate-800 text-gray-300 hover:bg-slate-700"
                      }`}
                    >
                      BEAST
                    </button>
                    <button
                      onClick={() => setPagoMode("CLASSIC")}
                      className={`flex-1 px-3 py-2 rounded-xl font-bold transition-all ${
                        pagoMode === "CLASSIC"
                          ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg scale-105"
                          : "bg-slate-800 text-gray-300 hover:bg-slate-700"
                      }`}
                    >
                      CLASSIC
                    </button>
                  </div>
                </div>

                <div className="mt-2">
                  <label className="block text-sm text-gray-300 mb-2 font-medium">
                    {t('label_blockchain_network')}
                  </label>
                  <select
                    value={pagoNetwork}
                    onChange={(e) => {
                      const newNetwork = e.target.value as SupportedNetwork;
                      setPagoNetwork(newNetwork);
                      // Actualizar el token al nativo de la red seleccionada
                      setPagoToken(
                        NETWORK_CONFIGS[newNetwork].nativeCurrency.symbol
                      );
                    }}
                    className="w-full bg-slate-800/50 border-2 border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-yellow-500 transition-all"
                  >
                    {(Object.keys(NETWORK_CONFIGS) as SupportedNetwork[]).map(
                      (network) => (
                        <option key={network} value={network}>
                          {NETWORK_CONFIGS[network].name} (
                          {NETWORK_CONFIGS[network].nativeCurrency.symbol})
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="mt-3 p-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-yellow-300 mb-3 font-semibold flex items-center gap-2">
                    {t('config_summary_title')}
                  </div>
                  <div className="space-y-2 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span>{t('label_network')}:</span>
                      <span className="font-semibold text-white">
                        {NETWORK_CONFIGS[pagoNetwork].name}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>{t('label_currency')}:</span>
                      <span className="font-semibold text-white flex items-center gap-1">
                        {(() => {
                          const icon = getTokenIcon(pagoToken);
                          const isImage =
                            icon.startsWith("/") || icon.includes(".");
                          return isImage ? (
                            <img
                              src={icon}
                              alt={pagoToken}
                              className="w-4 h-4 object-contain inline"
                            />
                          ) : (
                            <span>{icon}</span>
                          );
                        })()}
                        {pagoToken}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('label_distribution_mode')}:</span>
                      <span
                        className={`font-semibold ${
                          pagoMode === "BEAST"
                            ? "text-rose-400"
                            : "text-indigo-400"
                        }`}
                      >
                        {pagoMode}
                      </span>
                    </div>
                    {lobbyForms.pago.entryCost && (
                      <div className="flex justify-between mt-2 pt-2 border-t border-slate-600">
                        <span>{t('game_entry_cost')}:</span>
                        <span className="font-bold text-yellow-400">
                          {lobbyForms.pago.entryCost} {pagoToken}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-gray-400">
                    {pagoMode === "BEAST" ? (
                      <div>
                        <strong className="text-rose-400">Beast:</strong> {t('beast_description')}
                      </div>
                    ) : (
                      <div>
                        <strong className="text-indigo-400">Classic:</strong> {t('classic_description')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-xl hover:shadow-yellow-500/30 shadow-lg disabled:transform-none disabled:shadow-none"
                  onClick={() => handleCreateLobby("pago")}
                  disabled={isLoading || !isConnected}
                >
                  {isLoading ? t('creating') : t('lobbies_create_paid')}
                </button>
                <button
                  className="w-full text-yellow-400 hover:text-yellow-300 disabled:text-slate-500 font-semibold text-sm transition-colors"
                  onClick={handleUpdateList}
                  disabled={isLoading}
                >
                  {isLoading ? t('updating') : t('lobbies_update_list')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de lobbies activos */}
      {activeLobbies.length > 0 && (
        <div className="px-8 pb-8 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              {t('lobbies_active_title')}
            </h2>

            <div className="space-y-4">
              {/* Lobbies esperando jugadores */}
              {activeLobbies.filter(
                (lobby: any) => lobby.status === "Esperando jugadores"
              ).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center">
                    <span className="mr-2">⏳</span>
                    {t('waiting_players')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeLobbies
                      .filter(
                        (lobby: any) => lobby.status === "Esperando jugadores"
                      )
                      .map((lobby: any) => (
                        <div
                          key={lobby.id}
                          className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-green-500 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white truncate mr-2">
                              {lobby.name}
                            </h4>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                lobby.type === "publico"
                                  ? "bg-blue-600 text-white"
                                  : lobby.type === "privado"
                                  ? "bg-purple-600 text-white"
                                  : "bg-yellow-600 text-white"
                              }`}
                            >
                              {lobby.type === "publico"
                                ? t('lobby_type_public_short')
                                : lobby.type === "privado"
                                ? t('lobby_type_private_short')
                                : t('lobby_type_paid_short')}
                            </span>
                          </div>
                          <div className="text-gray-400 text-sm space-y-1">
                            <div>
                              {t('game_players')}: {lobby.playerCount}/{lobby.maxPlayers}
                            </div>
                            {lobby.type === "pago" && lobby.onchain && (
                              <div className="flex items-center space-x-1 text-yellow-400 font-semibold">
                                <span>💰</span>
                                <span>
                                  {(() => {
                                    try {
                                      // entryCost está en wei, convertir a ETH
                                      const weiValue =
                                        lobby.entryCost ||
                                        lobby.onchain.entryFee ||
                                        "0";
                                      const ethValue =
                                        parseFloat(weiValue) / 1e18;
                                      return `${ethValue} ${
                                        lobby.onchain.token || "ETH"
                                      }`;
                                    } catch (e) {
                                      return "N/A";
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="mt-3">
                            <button
                              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors"
                              onClick={() =>
                                handleJoinLobby(lobby.id, lobby.type)
                              }
                              disabled={isLoading || !isConnected}
                            >
                              {isLoading ? t('connecting') : t('lobbies_join')}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Lobbies en partida */}
              {activeLobbies.filter(
                (lobby: any) => lobby.status === "En partida"
              ).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center">
                    <span className="mr-2">🔥</span>
                    {t('in_game_title')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeLobbies
                      .filter((lobby: any) => lobby.status === "En partida")
                      .map((lobby: any) => (
                        <div
                          key={lobby.id}
                          className="bg-slate-800 rounded-lg p-4 border border-slate-700 opacity-75"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white truncate mr-2">
                              {lobby.name}
                            </h4>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                lobby.type === "publico"
                                  ? "bg-blue-600 text-white"
                                  : lobby.type === "privado"
                                  ? "bg-purple-600 text-white"
                                  : "bg-yellow-600 text-white"
                              }`}
                            >
                              {lobby.type === "publico"
                                ? t('lobby_type_public_short')
                                : lobby.type === "privado"
                                ? t('lobby_type_private_short')
                                : t('lobby_type_paid_short')}
                            </span>
                          </div>
                          <div className="text-gray-400 text-sm space-y-1">
                            <div>{t('game_players')}: {lobby.playerCount}</div>
                            {lobby.type === "pago" && lobby.onchain && (
                              <div className="flex items-center space-x-1 text-yellow-400 font-semibold">
                                <span>💰</span>
                                <span>
                                  {(() => {
                                    try {
                                      // entryCost está en wei, convertir a ETH
                                      const weiValue =
                                        lobby.entryCost ||
                                        lobby.onchain.entryFee ||
                                        "0";
                                      const ethValue =
                                        parseFloat(weiValue) / 1e18;
                                      return `${ethValue} ${
                                        lobby.onchain.token || "ETH"
                                      }`;
                                    } catch (e) {
                                      return "N/A";
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="mt-3">
                            <button
                              disabled
                              className="w-full bg-gray-600 text-gray-400 font-bold py-2 px-4 rounded cursor-not-allowed"
                            >
                                {t('in_progress')}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay lobbies */}
      {activeLobbies.length === 0 && (
        <div className="px-8 pb-8 bg-slate-950">
          <div className="max-w-7xl mx-auto text-center">
            <div className="bg-slate-800 rounded-lg p-8 border border-slate-700">
              <div className="text-6xl mb-4">🎮</div>
              <h3 className="text-xl font-bold text-white mb-2">
                {t('lobbies_no_active')}
              </h3>
              <p className="text-gray-400">
                {t('lobbies_create_prompt')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensajes de estado */}
      {(successMessage || errorMessage) && (
        <div className="fixed bottom-4 right-4 z-50">
          {successMessage && (
            <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg mb-2 max-w-md">
              <div className="flex items-center justify-between">
                <span>{successMessage}</span>
                <button
                  onClick={() => setSuccessMessage("")}
                  className="ml-4 text-green-200 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg mb-2 max-w-md">
              <div className="flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  onClick={() => setErrorMessage("")}
                  className="ml-4 text-red-200 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Lobbies;
