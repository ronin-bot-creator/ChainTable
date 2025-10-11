import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { ethers } from 'ethers';
import type { LobbyType, CreateLobbyFormData, SupportedNetwork, SupportedToken } from '../types/lobby';
import { NETWORK_CONFIGS } from '../types/lobby';
import { useSocket } from '../hooks/useSocket';
import { socketService } from '../services/socketService';
import { getUserId, getUserSession, clearUserSession } from '../utils/userSession';

// Interfaz local para los formularios
interface LobbyFormData {
  name: string;
  password?: string;
  entryCost?: number;
}

const Lobbies: React.FC = () => {
  const navigate = useNavigate();
  const { address: walletAddress, isConnected: isWalletConnected } = useAccount();
  const { disconnect: disconnectWallet } = useDisconnect();
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [isUserNameSet, setIsUserNameSet] = useState<boolean>(false);
  const [tabId] = useState<string>(() => `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  
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
    disconnect
  } = useSocket() as any;

  // Estado para los formularios de cada lobby
  const [lobbyForms, setLobbyForms] = useState<Record<LobbyType, LobbyFormData>>({
    publico: { name: '' },
    privado: { name: '', password: '' },
    // store entryCost as string to allow decimals like 0.001
    pago: { name: '', entryCost: '' as unknown as number }
  });
  // Estado adicional para lobbies pagos (modo, token y red)
  const [pagoMode, setPagoMode] = useState<'BEAST' | 'CLASSIC'>('BEAST');
  const [pagoToken, setPagoToken] = useState<SupportedToken>('ETH');
  const [pagoNetwork, setPagoNetwork] = useState<SupportedNetwork>('sepolia');


  // Contract addresses per network (UnoLobbyV2)
  const CONTRACT_ADDRESSES: Record<string, string> = {
    sepolia: '0x5099CA1a00a96869A6D1DCEC7BF579bf72D51E1B', // ✅ UnoLobbyV2
    // keep existing networks blank for now
    ronin: '',
    ethereum: '',
    base: '',
    abstract: ''
  };

  // basic minimal ABI for createLobby and joinLobby
  const UNO_ABI = [
    'function createLobby(address token, uint256 entryFee, uint16 maxPlayers, uint8 mode) returns (uint256)',
    'function joinLobby(uint256 lobbyId) payable',
    'event LobbyCreated(uint256 indexed lobbyId, address indexed creator, address token, uint256 entryFee, uint16 maxPlayers, uint8 mode)'
  ];

  // Cargar información del usuario desde la sesión y verificar wallet
  useEffect(() => {
    try {
      const session = getUserSession();
      if (session && session.walletAddress && isWalletConnected && walletAddress === session.walletAddress) {
        setUserName(session.walletAddress); // Usar la dirección como username
        setIsUserNameSet(true);
        console.log('👤 Sesión EVM cargada en lobbies, Wallet:', session.walletAddress);
      } else {
        console.error('❌ No hay sesión EVM completa, redirigiendo a auth...');
        navigate('/auth');
      }
    } catch (error) {
      console.error('❌ Error al cargar sesión EVM, redirigiendo a auth...', error);
      navigate('/auth');
    }
  }, [navigate, isWalletConnected, walletAddress]);

  // Conectar automáticamente cuando se tenga el nombre
  useEffect(() => {
    // La conexión la maneja el SocketProvider central; no invocamos connect() aquí
    // para evitar llamadas duplicadas que puedan recrear/desconectar el socket.
  }, [isUserNameSet, connect]);

  // Limpiar mensajes
  const clearMessages = useCallback(() => {
    setSuccessMessage('');
    setErrorMessage('');
  }, []);

  // Cerrar sesión y desconectar wallet
  const handleLogout = useCallback(() => {
    clearUserSession();
    disconnect();
    disconnectWallet();
    navigate('/');
  }, [disconnect, disconnectWallet, navigate]);

  // Mostrar errores de socket
  useEffect(() => {
    if (socketError) {
      setErrorMessage(socketError);
    }
  }, [socketError]);

  // Manejo optimizado de creación de lobbies con useCallback
  const handleCreateLobby = useCallback(async (type: LobbyType) => {
    clearMessages();
    const formData = lobbyForms[type];
    
    try {
      // Crear los datos del formulario según el tipo
      const createLobbyData: CreateLobbyFormData = {
        type,
        name: formData.name,
        ...(type === 'privado' && { password: formData.password }),
        ...(type === 'pago' && { 
          entryCost: formData.entryCost?.toString(), 
          token: pagoToken, 
          mode: pagoMode, 
          network: pagoNetwork 
        })
      };

      // Usar websockets para crear el lobby
      const creatorId = getUserId();
      const creatorUsername = userName;
      
      // Validaciones específicas para lobbies pagos
      if (type === 'pago') {
        if (!createLobbyData.name || createLobbyData.name.trim().length < 3) {
          throw new Error('Nombre del lobby inválido');
        }
        if (!createLobbyData.entryCost || parseFloat(createLobbyData.entryCost) <= 0) {
          throw new Error('Costo de entrada inválido');
        }
        if (!userName) {
          throw new Error('Conecta tu wallet antes de crear un lobby pago');
        }
        
        // Validar que la red y el token sean compatibles
        const networkConfig = NETWORK_CONFIGS[pagoNetwork];
        const tokenConfig = networkConfig.supportedTokens.find(t => t.symbol === pagoToken);
        if (!tokenConfig) {
          throw new Error(`Token ${pagoToken} no soportado en la red ${networkConfig.name}`);
        }
      }

      // If this is a paid lobby on Sepolia, perform an on-chain createLobby first (MetaMask will prompt)
      if (type === 'pago' && pagoNetwork === 'sepolia') {
        console.log('🔗 Initiating on-chain lobby creation...', { type, pagoNetwork, contractAddress: CONTRACT_ADDRESSES['sepolia'] });
        if (typeof window === 'undefined' || !(window as any).ethereum) throw new Error('No web3 provider (MetaMask) detected');
        const contractAddress = CONTRACT_ADDRESSES['sepolia'];
        if (!contractAddress) throw new Error('Contract address not configured for Sepolia');

        // Ensure MetaMask is connected and on Sepolia; get signer via ethers BrowserProvider
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        
        // Request accounts to ensure MetaMask is unlocked and get current account
        const accounts = await provider.send('eth_requestAccounts', []);
        if (!accounts || accounts.length === 0) {
          throw new Error('No hay cuentas disponibles en MetaMask. Por favor conecta tu wallet.');
        }
        const currentAccount = accounts[0];
        console.log('✅ Cuenta actual de MetaMask:', currentAccount);
        
        // Try to switch the network to Sepolia (chainId 11155111 -> 0xaa36a7)
        try {
          await provider.send('wallet_switchEthereumChain', [{ chainId: '0xaa36a7' }]);
        } catch (switchError: any) {
          // If the user rejected or the chain is not added, inform them to switch manually
          console.warn('Network switch to Sepolia failed', switchError);
          setErrorMessage('Por favor cambia tu red de MetaMask a Sepolia y reintenta (o agrega Sepolia a MetaMask).');
          throw new Error('MetaMask network not Sepolia');
        }
        
        // Get signer AFTER switching network
        const signer = await provider.getSigner();

        // Obtener configuración del token seleccionado
        const networkConfig = NETWORK_CONFIGS[pagoNetwork];
        const tokenConfig = networkConfig.supportedTokens.find(t => t.symbol === pagoToken);
        if (!tokenConfig) {
          throw new Error(`Token ${pagoToken} no soportado`);
        }
        
        // map token selection to address (native currency -> address(0), ERC20 -> token address)
        const tokenAddr = tokenConfig.address || '0x0000000000000000000000000000000000000000';
        
        // Normalize entryCost input: accept strings with comma or point, or numbers.
        const rawEntry = (createLobbyData.entryCost ?? '').toString();
        console.log('🔍 DEBUG rawEntry:', rawEntry, 'tipo:', typeof rawEntry);
        const normalizedEntry = rawEntry.replace(',', '.').trim();
        console.log('🔍 DEBUG normalizedEntry:', normalizedEntry);
        if (!normalizedEntry) throw new Error('Costo de entrada inválido');
        const parsedNum = Number(normalizedEntry);
        console.log('🔍 DEBUG parsedNum:', parsedNum);
        if (isNaN(parsedNum)) throw new Error('Costo de entrada inválido');

        // entryFeeWei: if the user provided a decimal (contains '.') or a small number, treat as ETH and parse to wei
        let entryFeeWei: bigint;
        if (normalizedEntry.includes('.') || parsedNum < 1e12) {
          console.log('🔍 DEBUG: Usando parseEther con normalizedEntry:', normalizedEntry);
          // parse as ETH decimal -> returns bigint in ethers v6
          entryFeeWei = ethers.parseEther(normalizedEntry);
          console.log('🔍 DEBUG: entryFeeWei después de parseEther:', entryFeeWei.toString());
        } else {
          console.log('🔍 DEBUG: Usando BigInt directo');
          // assume already a wei integer
          try {
            entryFeeWei = BigInt(normalizedEntry);
            console.log('🔍 DEBUG: entryFeeWei después de BigInt:', entryFeeWei.toString());
          } catch (err) {
            throw new Error('Costo de entrada inválido');
          }
        }

        // mode: BEAST=0, CLASSIC=1
        const modeNum = createLobbyData.mode === 'CLASSIC' ? 1 : 0;

        // Verify the signer address matches current account
        const signerAddress = await signer.getAddress();
        console.log('🔑 Dirección del signer:', signerAddress);
        
        if (signerAddress.toLowerCase() !== currentAccount.toLowerCase()) {
          console.warn('⚠️ La dirección del signer no coincide con la cuenta actual');
          throw new Error('Por favor selecciona la cuenta correcta en MetaMask');
        }

        const contract = new ethers.Contract(contractAddress, UNO_ABI, signer);
        
        // Paso 1: Crear lobby on-chain
        setSuccessMessage('Paso 1/2: Creando lobby on-chain...');
        const createTx = await contract.createLobby(tokenAddr, entryFeeWei, 3, modeNum);
        console.log('📝 Transacción createLobby enviada:', createTx.hash);
        
        const createReceipt = await createTx.wait();
        console.log('✅ Lobby creado on-chain');
        
        // Obtener el lobbyId del evento LobbyCreated
        const lobbyCreatedEvent = createReceipt?.logs?.find((log: any) => {
          try {
            const parsed = contract.interface.parseLog({
              topics: [...log.topics],
              data: log.data
            });
            return parsed?.name === 'LobbyCreated';
          } catch {
            return false;
          }
        });
        
        let onchainLobbyId: number | null = null;
        if (lobbyCreatedEvent) {
          const parsed = contract.interface.parseLog({
            topics: [...lobbyCreatedEvent.topics],
            data: lobbyCreatedEvent.data
          });
          onchainLobbyId = parsed?.args?.lobbyId ? Number(parsed.args.lobbyId) : null;
          console.log('🎯 Lobby ID on-chain:', onchainLobbyId);
        }
        
        if (!onchainLobbyId) {
          throw new Error('No se pudo obtener el lobby ID del evento LobbyCreated');
        }
        
        // Paso 2: Auto-join del creador
        setSuccessMessage(`Paso 2/2: Uniéndose al lobby #${onchainLobbyId}...`);
        console.log('🎮 Creador uniéndose al lobby on-chain...');
        console.log('💰 Entry fee:', {
          entryFeeWei: entryFeeWei.toString() + ' wei',
          entryFeeETH: ethers.formatEther(entryFeeWei) + ' ETH'
        });
        
        console.log('📝 Enviando transacción joinLobby (auto-join) con value:', entryFeeWei.toString());
        const joinTx = await contract.joinLobby(onchainLobbyId, {
          value: entryFeeWei // Pagar el entry fee
        });
        console.log('📝 Transacción joinLobby enviada:', joinTx.hash);
        
        const joinReceipt = await joinTx.wait();
        console.log('✅ Creador se unió al lobby on-chain');
        
        setSuccessMessage('Lobby creado y creador registrado. Continuando con servidor...');

        // attach on-chain references to payload so backend can verify if needed
        (createLobbyData as any).onchain = {
          txHash: createReceipt?.hash || (createReceipt as any)?.transactionHash || createTx.hash,
          joinTxHash: joinReceipt?.hash || (joinReceipt as any)?.transactionHash || joinTx.hash,
          contract: contractAddress,
          chain: 'sepolia',
          lobbyId: onchainLobbyId
        };
        // store entryCost in wei so server-side validation compares correctly
        (createLobbyData as any).entryCost = entryFeeWei.toString();
      }

      const createdLobby = await socketCreateLobby(createLobbyData, creatorId, creatorUsername);
      
      // Si es un lobby on-chain con auto-join, registrar al creador en el servidor
      if (type === 'pago' && (createLobbyData as any).onchain?.joinTxHash) {
        console.log('🔗 Registrando creador en el servidor después de auto-join...');
        try {
          await socketJoinLobbyOnchain(
            createdLobby.id,
            undefined, // sin password
            {
              txHash: (createLobbyData as any).onchain.joinTxHash,
              contract: (createLobbyData as any).onchain.contract,
              chain: (createLobbyData as any).onchain.chain
            }
          );
          console.log('✅ Creador registrado en el servidor');
        } catch (joinError) {
          console.error('⚠️ Error registrando creador en servidor:', joinError);
          // No es crítico, el lobby ya existe
        }
      }
      
      // Limpiar formulario después de crear
      setLobbyForms(prev => ({
        ...prev,
        [type]: type === 'pago' 
          ? { name: '', entryCost: 0 }
          : type === 'privado' 
          ? { name: '', password: '' }
          : { name: '' }
      }));
      
      setSuccessMessage(`Lobby "${formData.name}" creado exitosamente!`);
      
      // Navegar al juego
      navigate(`/game/${createdLobby.id}`);
      
    } catch (error) {
      console.error('Error creando lobby:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al crear el lobby';
      setErrorMessage(errorMsg);
    }
  }, [lobbyForms, clearMessages, socketCreateLobby, navigate, pagoMode, pagoToken, pagoNetwork, userName]);

  // Manejo de actualización de lista
  const handleUpdateList = useCallback(() => {
    clearMessages();
    
    try {
      refreshLobbies();
      
      // Crear mensaje informativo
  const totalLobbies = activeLobbies.length;
  const waitingCount = activeLobbies.filter((lobby: any) => lobby.status === 'Esperando jugadores').length;
  const inGameCount = activeLobbies.filter((lobby: any) => lobby.status === 'En partida').length;
      
      setSuccessMessage(`Total de lobbies: ${totalLobbies} | Esperando: ${waitingCount} | En partida: ${inGameCount}`);
      
    } catch (error) {
      console.error('Error actualizando lista:', error);
      setErrorMessage('Error al obtener la lista de lobbies');
    }
  }, [clearMessages, refreshLobbies, activeLobbies]);

  // Manejo de unirse a un lobby
  const handleJoinLobby = useCallback(async (lobbyId: string, lobbyType: LobbyType) => {
    clearMessages();
    
    try {
      // Si es un lobby privado, pedir contraseña (simplificado para demo)
      let password: string | undefined;
      if (lobbyType === 'privado') {
        password = prompt('Ingresa la contraseña del lobby privado:') || undefined;
        if (!password) {
          setErrorMessage('Contraseña requerida para lobby privado');
          return;
        }
      }

      if (lobbyType === 'pago') {
        // For paid lobbies we require on-chain payment first (Sepolia native flow supported)
        // Fetch lobby info from server to get entryCost and onchain contract info
        // We'll use socketService directly to request the lobby info and wait for response
        // (we import socketService at top of file)
        const lobbyInfo: any = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout fetching lobby info')), 10000);
          const handler = (resp: any) => {
            try { socketService.off('game:lobbyInfo', handler); } catch(e) {}
            clearTimeout(timeout);
            if (resp && resp.success && resp.lobby && resp.lobby.id === lobbyId) resolve(resp.lobby);
            else reject(new Error(resp.error || 'No se pudo obtener info del lobby'));
          };
          try {
            socketService.on('game:lobbyInfo', handler as any);
            socketService.getLobbyInfo(lobbyId);
          } catch (e) { clearTimeout(timeout); reject(e); }
        });

        // Ensure Sepolia native flow
        if (!lobbyInfo.onchain || lobbyInfo.onchain.chain !== 'sepolia') {
          throw new Error('Este lobby requiere pago on-chain en Sepolia. No se encontró metadata.');
        }
        const contractAddress = lobbyInfo.onchain.contract;
        if (!contractAddress) throw new Error('Dirección de contrato no disponible en el lobby');

        // entryCost expected in wei string
        const entryCostWeiStr = String(lobbyInfo.entryCost || '0');
        console.log('💰 DEBUG entryCost:', {
          entryCostWeiStr,
          type: typeof entryCostWeiStr,
          lobbyInfoEntryCost: lobbyInfo.entryCost,
          paymentConfig: lobbyInfo.paymentConfig
        });
        
        let entryFeeWei: bigint;
        try {
          entryFeeWei = BigInt(entryCostWeiStr);
          console.log('✅ Parsed as BigInt:', entryFeeWei.toString());
        } catch (e) {
          console.log('⚠️ Failed to parse as BigInt, trying parseEther...');
          // fallback: try parse as decimal ETH
          entryFeeWei = ethers.parseEther(String(entryCostWeiStr).replace(',', '.'));
          console.log('✅ Parsed with parseEther:', entryFeeWei.toString());
        }

        if (typeof window === 'undefined' || !(window as any).ethereum) throw new Error('No web3 provider (MetaMask) detected');
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        
        // Request accounts to ensure MetaMask is unlocked and get current account
        const accounts = await provider.send('eth_requestAccounts', []);
        if (!accounts || accounts.length === 0) {
          throw new Error('No hay cuentas disponibles en MetaMask. Por favor conecta tu wallet.');
        }
        const currentAccount = accounts[0];
        console.log('✅ Cuenta actual de MetaMask para unirse:', currentAccount);
        
        try {
          await provider.send('wallet_switchEthereumChain', [{ chainId: '0xaa36a7' }]);
        } catch (switchError: any) {
          setErrorMessage('Por favor cambia tu red de MetaMask a Sepolia y reintenta (o agrega Sepolia a MetaMask).');
          throw new Error('MetaMask network not Sepolia');
        }
        
        // Get signer AFTER switching network
        const signer = await provider.getSigner();
        
        // Verify the signer address matches current account
        const signerAddress = await signer.getAddress();
        console.log('🔑 Dirección del signer para pago:', signerAddress);
        
        if (signerAddress.toLowerCase() !== currentAccount.toLowerCase()) {
          console.warn('⚠️ La dirección del signer no coincide con la cuenta actual');
          throw new Error('Por favor selecciona la cuenta correcta en MetaMask');
        }

        // IMPORTANTE: Necesitamos el lobbyId ON-CHAIN (no el server lobbyId)
        const onchainLobbyId = lobbyInfo.onchain?.lobbyId || lobbyInfo.onchainLobbyId;
        if (!onchainLobbyId || onchainLobbyId === '0' || onchainLobbyId === 0) {
          throw new Error('Este lobby no tiene un ID on-chain válido. No puedes unirte a este lobby.');
        }

        console.log('💰 Uniéndose al lobby on-chain:', {
          lobbyId: onchainLobbyId,
          entryFee: ethers.formatEther(entryFeeWei) + ' ETH',
          entryFeeWei: entryFeeWei.toString() + ' wei',
          contractAddress
        });

        // Llamar a joinLobby del contrato (NO solo enviar ETH)
        const contract = new ethers.Contract(contractAddress, UNO_ABI, signer);
        
        console.log('📝 Enviando transacción joinLobby con value:', entryFeeWei.toString());
        const tx = await contract.joinLobby(onchainLobbyId, { value: entryFeeWei });
        console.log('✅ Transacción enviada:', tx.hash);
        
        setSuccessMessage('Transacción de unión enviada. Esperando confirmación...');
        const receipt = await tx.wait();
        setSuccessMessage('¡Pago confirmado! Uniéndote al lobby...');

        // Get txHash from receipt or tx
        const txHash = receipt?.hash || (receipt as any)?.transactionHash || tx.hash;
        if (!txHash) throw new Error('No se pudo obtener txHash de la transacción');
        
        await socketJoinLobbyOnchain(lobbyId, password, { txHash, contract: contractAddress, chain: 'sepolia' });
        setSuccessMessage('¡Pago confirmado y te uniste al lobby!');
        navigate(`/game/${lobbyId}`);
        return;
      }

      // Non-paid or other-network join (normal flow)
      await socketJoinLobby(lobbyId, password);
      setSuccessMessage('¡Te has unido al lobby exitosamente!');
      navigate(`/game/${lobbyId}`);
      
    } catch (error) {
      console.error('Error uniéndose al lobby:', error);
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido al unirse al lobby';
      setErrorMessage(errorMsg);
    }
  }, [clearMessages, socketJoinLobby, navigate]);

  // Manejo de cambios en formularios
  const handleInputChange = useCallback((type: LobbyType, field: keyof LobbyFormData, value: string | number) => {
    setLobbyForms(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  }, []);



  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
      {/* Encabezado */}
      <div className="text-center py-6 bg-slate-900 border-b-2 border-slate-700 shadow-lg">
        <h1 className="text-4xl font-extrabold text-blue-500 tracking-wider font-jersey">
          CHAIN TABLE
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          {tabId} - {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Sin wallet'}
        </p>
      </div>

      {/* Estado de la conexión y usuario */}
      <div className="flex justify-between items-center py-4 bg-slate-900 border-b border-slate-700 px-8">
        {/* Información del usuario */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 rounded-full px-4 py-2 shadow">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">
                {walletAddress ? walletAddress.charAt(2).toUpperCase() : '?'}
              </span>
            </div>
            <div className="text-white">
              <div className="text-sm font-medium font-mono">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Cargando...'}
              </div>
              <div className="text-xs text-gray-400">
                Wallet Address
              </div>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/auth')}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full transition-colors"
            title="Cambiar wallet"
          >
            Cambiar Wallet
          </button>
          
          <button
            onClick={handleLogout}
            className="text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-full transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* Estado de conexión */}
        <div className="text-sm font-medium text-white px-4 py-2 bg-slate-800 rounded-full shadow">
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
          </span>
          <button 
            onClick={() => isConnected ? disconnect() : connect()}
            className="ml-3 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full transition-colors"
          >
            {isConnected ? 'Desconectar' : 'Conectar'}
          </button>
        </div>
      </div>

      {/* Secciones de los lobbies */}
      <div className="flex-1 flex items-start justify-center p-8 bg-slate-950">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl">

          {/* Tarjeta de Lobby Público */}
          <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">Lobby Público</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Nombre del lobby:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Mesa pública"
                  value={lobbyForms.publico.name}
                  onChange={(e) => handleInputChange('publico', 'name', e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <button 
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-lg disabled:transform-none"
                onClick={() => handleCreateLobby('publico')}
                disabled={isLoading || !isConnected}
              >
                {isLoading ? 'Creando...' : 'Crear lobby'}
              </button>
              <button 
                className="w-full text-blue-400 hover:text-blue-300 disabled:text-blue-600 font-semibold text-sm underline mt-2"
                onClick={handleUpdateList}
                disabled={isLoading}
              >
                {isLoading ? 'Actualizando...' : 'Actualizar lobbies'}
              </button>
            </div>
          </div>

          {/* Tarjeta de Lobby Privado */}
          <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
              <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">Lobby Privado</h2>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Nombre del lobby:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Solo amigos"
                  value={lobbyForms.privado.name}
                  onChange={(e) => handleInputChange('privado', 'name', e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Contraseña:
                </label>
                <input
                  type="password"
                  placeholder="••••••"
                  value={lobbyForms.privado.password || ''}
                  onChange={(e) => handleInputChange('privado', 'password', e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
                  disabled={isLoading}
                />
              </div>
              <button 
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-lg disabled:transform-none"
                onClick={() => handleCreateLobby('privado')}
                disabled={isLoading || !isConnected}
              >
                {isLoading ? 'Creando...' : 'Crear lobby'}
              </button>
              <button 
                className="w-full text-green-400 hover:text-green-300 disabled:text-green-600 font-semibold text-sm underline mt-2"
                onClick={handleUpdateList}
                disabled={isLoading}
              >
                {isLoading ? 'Actualizando...' : 'Actualizar lobbies'}
              </button>
            </div>
          </div>

          {/* Tarjeta de Lobby Pago (mejorada) */}
          <div className="bg-gradient-to-br from-yellow-900/10 to-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800 transform hover:scale-105 transition-transform duration-300">
            <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-wide font-jersey">Lobby pago</h2>
                <p className="text-xs text-gray-400">Crea lobbies con entrada y reparto automático</p>
              </div>
              <div className="flex gap-2 items-center">
                <span className="px-3 py-1 rounded-full bg-yellow-700 text-black font-semibold text-sm">Pago</span>
                <span className={`px-3 py-1 rounded-full text-sm ${pagoMode === 'BEAST' ? 'bg-rose-600' : 'bg-indigo-600'}`}>{pagoMode}</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2 font-medium">Nombre del lobby</label>
                <input
                  type="text"
                  placeholder="Ej: Torneo de la tarde"
                  value={lobbyForms.pago.name}
                  onChange={(e) => handleInputChange('pago', 'name', e.target.value)}
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">Costo de entrada</label>
                  <div className="flex">
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.001"
                      min={0}
                      value={lobbyForms.pago.entryCost || ''}
                      onChange={(e) => handleInputChange('pago', 'entryCost', e.target.value as unknown as number)}
                      className="w-full bg-slate-800 border-2 border-slate-700 rounded-l-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                      disabled={isLoading}
                    />
                    <select 
                      value={pagoToken} 
                      onChange={(e) => setPagoToken(e.target.value as SupportedToken)} 
                      className="bg-slate-800 border-2 border-slate-700 rounded-r-lg px-3 py-3 text-white"
                    >
                      {NETWORK_CONFIGS[pagoNetwork].supportedTokens.map((token) => (
                        <option key={token.symbol} value={token.symbol}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">Modo de reparto</label>
                  <div className="flex gap-2">
                    <button onClick={() => setPagoMode('BEAST')} className={`flex-1 px-3 py-2 rounded-lg ${pagoMode === 'BEAST' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-gray-300'}`}>BEAST</button>
                    <button onClick={() => setPagoMode('CLASSIC')} className={`flex-1 px-3 py-2 rounded-lg ${pagoMode === 'CLASSIC' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-gray-300'}`}>CLASSIC</button>
                  </div>

                  </div>

                <div className="mt-2">
                  <label className="block text-sm text-gray-400 mb-2 font-medium">Red Blockchain</label>
                  <select 
                    value={pagoNetwork} 
                    onChange={(e) => {
                      const newNetwork = e.target.value as SupportedNetwork;
                      setPagoNetwork(newNetwork);
                      // Actualizar el token al nativo de la red seleccionada
                      setPagoToken(NETWORK_CONFIGS[newNetwork].nativeCurrency.symbol);
                    }} 
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-lg px-3 py-3 text-white"
                  >
                    {(Object.keys(NETWORK_CONFIGS) as SupportedNetwork[]).map((network) => (
                      <option key={network} value={network}>
                        {NETWORK_CONFIGS[network].name} ({NETWORK_CONFIGS[network].nativeCurrency.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div className="text-xs text-gray-400 mb-2 font-semibold">📊 Resumen de configuración</div>
                  <div className="space-y-1 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span>Red:</span>
                      <span className="font-semibold text-white">{NETWORK_CONFIGS[pagoNetwork].name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Moneda:</span>
                      <span className="font-semibold text-white">{pagoToken}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Modo de reparto:</span>
                      <span className={`font-semibold ${pagoMode === 'BEAST' ? 'text-rose-400' : 'text-indigo-400'}`}>
                        {pagoMode}
                      </span>
                    </div>
                    {lobbyForms.pago.entryCost && (
                      <div className="flex justify-between mt-2 pt-2 border-t border-slate-600">
                        <span>Costo de entrada:</span>
                        <span className="font-bold text-yellow-400">{lobbyForms.pago.entryCost} {pagoToken}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700 text-xs text-gray-400">
                    {pagoMode === 'BEAST' ? (
                      <div><strong className="text-rose-400">Beast:</strong> 95% al ganador, 5% fee</div>
                    ) : (
                      <div><strong className="text-indigo-400">Classic:</strong> 60% / 20% / 15%, resto fee</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button 
                  className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 transform hover:scale-105 shadow-lg disabled:transform-none"
                  onClick={() => handleCreateLobby('pago')}
                  disabled={isLoading || !isConnected}
                >
                  {isLoading ? 'Creando...' : 'Crear lobby'}
                </button>
                <button 
                  className="w-full text-yellow-400 hover:text-yellow-300 disabled:text-yellow-600 font-semibold text-sm underline mt-2"
                  onClick={handleUpdateList}
                  disabled={isLoading}
                >
                  {isLoading ? 'Actualizando...' : 'Actualizar lobbies'}
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
              🎮 Lobbies Activos
            </h2>
            
            <div className="space-y-4">
              {/* Lobbies esperando jugadores */}
              {activeLobbies.filter((lobby: any) => lobby.status === 'Esperando jugadores').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center">
                    <span className="mr-2">⏳</span>
                    Esperando Jugadores
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeLobbies
                      .filter((lobby: any) => lobby.status === 'Esperando jugadores')
                      .map((lobby: any) => (
                        <div key={lobby.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-green-500 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white truncate mr-2">{lobby.name}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              lobby.type === 'publico' ? 'bg-blue-600 text-white' :
                              lobby.type === 'privado' ? 'bg-purple-600 text-white' :
                              'bg-yellow-600 text-white'
                            }`}>
                              {lobby.type === 'publico' ? 'Público' : 
                               lobby.type === 'privado' ? 'Privado' : 'Pago'}
                            </span>
                          </div>
                          <div className="text-gray-400 text-sm">
                            Jugadores: {lobby.playerCount}/{lobby.maxPlayers}
                          </div>
                          <div className="mt-3">
                            <button 
                              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition-colors"
                              onClick={() => handleJoinLobby(lobby.id, lobby.type)}
                              disabled={isLoading || !isConnected}
                            >
                              {isLoading ? 'Conectando...' : 'Unirse'}
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Lobbies en partida */}
              {activeLobbies.filter((lobby: any) => lobby.status === 'En partida').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center">
                    <span className="mr-2">🔥</span>
                    En Partida
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeLobbies
                      .filter((lobby: any) => lobby.status === 'En partida')
                      .map((lobby: any) => (
                        <div key={lobby.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 opacity-75">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white truncate mr-2">{lobby.name}</h4>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              lobby.type === 'publico' ? 'bg-blue-600 text-white' :
                              lobby.type === 'privado' ? 'bg-purple-600 text-white' :
                              'bg-yellow-600 text-white'
                            }`}>
                              {lobby.type === 'publico' ? 'Público' : 
                               lobby.type === 'privado' ? 'Privado' : 'Pago'}
                            </span>
                          </div>
                          <div className="text-gray-400 text-sm">
                            Jugadores: {lobby.playerCount}
                          </div>
                          <div className="mt-3">
                            <button disabled className="w-full bg-gray-600 text-gray-400 font-bold py-2 px-4 rounded cursor-not-allowed">
                              En curso...
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
              <h3 className="text-xl font-bold text-white mb-2">No hay lobbies activos</h3>
              <p className="text-gray-400">¡Crea un lobby para empezar a jugar!</p>
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
                  onClick={() => setSuccessMessage('')}
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
                  onClick={() => setErrorMessage('')}
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
