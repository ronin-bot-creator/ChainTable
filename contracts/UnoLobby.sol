// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract UnoLobby is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum Mode { BEAST, CLASSIC }
    enum LobbyState { OPEN, ENDED }

    struct Lobby {
        address creator;
        address token; // address(0) == native
        uint256 entryFee;
        uint16 maxPlayers;
        Mode mode;
        LobbyState state;
        address[] players;
        mapping(address => bool) joined;
    }

    uint256 public constant DEV_FEE_PCT = 5; // 5%
    uint256 public lobbyCount;
    address public devWallet;

    // simple storage of Lobby as mapping to struct with nested mapping -> use storage pattern
    mapping(uint256 => Lobby) private lobbies;

    // authorized callers (oracles/backends) that may end lobbies in addition to creator
    mapping(address => bool) public authorized;

    event LobbyCreated(uint256 indexed lobbyId, address indexed creator, address token, uint256 entryFee, uint16 maxPlayers, Mode mode);
    event PlayerJoined(uint256 indexed lobbyId, address indexed player);
    event LobbyEnded(uint256 indexed lobbyId, address indexed endedBy, address[] winners);
    event Payout(uint256 indexed lobbyId, address indexed to, uint256 amount);
    event FeeTaken(uint256 indexed lobbyId, address indexed to, uint256 amount);

    modifier onlyCreatorOrAuthorized(uint256 lobbyId) {
        require(msg.sender == lobbies[lobbyId].creator || authorized[msg.sender] || owner() == msg.sender, "Not authorized to end lobby");
        _;
    }

    constructor(address _devWallet) Ownable(msg.sender) {
        require(_devWallet != address(0), "devWallet required");
        devWallet = _devWallet;
    }

    function setDevWallet(address _devWallet) external onlyOwner {
        require(_devWallet != address(0), "devWallet required");
        devWallet = _devWallet;
    }

    function setAuthorized(address who, bool ok) external onlyOwner {
        authorized[who] = ok;
    }

    function createLobby(address token, uint256 entryFee, uint16 maxPlayers, Mode mode) external returns (uint256) {
        require(entryFee > 0, "entryFee>0");
        require(maxPlayers >= 2, "min 2 players");
        lobbyCount += 1;
        uint256 id = lobbyCount;

        Lobby storage L = lobbies[id];
        L.creator = msg.sender;
        L.token = token;
        L.entryFee = entryFee;
        L.maxPlayers = maxPlayers;
        L.mode = mode;
        L.state = LobbyState.OPEN;

        emit LobbyCreated(id, msg.sender, token, entryFee, maxPlayers, mode);
        return id;
    }

    function joinLobby(uint256 lobbyId) external payable nonReentrant {
        Lobby storage L = lobbies[lobbyId];
        require(L.state == LobbyState.OPEN, "lobby not open");
        require(!L.joined[msg.sender], "already joined");
        require(L.players.length < L.maxPlayers, "lobby full");

        if (L.token == address(0)) {
            // native
            require(msg.value == L.entryFee, "incorrect value");
        } else {
            // ERC20 - must have approved
            require(msg.value == 0, "dont send native");
            IERC20(L.token).safeTransferFrom(msg.sender, address(this), L.entryFee);
        }

        L.players.push(msg.sender);
        L.joined[msg.sender] = true;

        emit PlayerJoined(lobbyId, msg.sender);
    }

    function getLobbyPlayers(uint256 lobbyId) external view returns (address[] memory) {
        return lobbies[lobbyId].players;
    }

    function endLobby(uint256 lobbyId, address[] calldata winners) external nonReentrant onlyCreatorOrAuthorized(lobbyId) {
        Lobby storage L = lobbies[lobbyId];
        require(L.state == LobbyState.OPEN, "already ended");
        require(L.players.length >= 2, "not enough players");

        // validate winners according to mode
        if (L.mode == Mode.BEAST) {
            require(winners.length == 1, "BEAST needs 1 winner");
        } else {
            require(winners.length >= 1 && winners.length <= 3, "CLASSIC needs 1-3 winners");
        }

        // ensure winners are participants and distinct
        for (uint i = 0; i < winners.length; i++) {
            require(L.joined[winners[i]], "winner not participant");
            for (uint j = i + 1; j < winners.length; j++) {
                require(winners[i] != winners[j], "duplicate winner");
            }
        }

        L.state = LobbyState.ENDED;

        // calculate totals
        uint256 total = L.entryFee * L.players.length;
        uint256 fee = (total * DEV_FEE_PCT) / 100;
        uint256 remainder = total - fee;

        // transfer fee to devWallet first
        if (L.token == address(0)) {
            _safeNativeTransfer(devWallet, fee);
        } else {
            IERC20(L.token).safeTransfer(devWallet, fee);
        }
        emit FeeTaken(lobbyId, devWallet, fee);

        // distribute according to mode. CLASSIC percentages are applied over remainder
        if (L.mode == Mode.BEAST) {
            address winner = winners[0];
            uint256 pay = remainder; // 95% of total
            _payout(lobbyId, L.token, winner, pay);
        } else {
            // CLASSIC: 60%,20%,15% of remainder
            uint256 p1 = (remainder * 60) / 100;
            uint256 p2 = (remainder * 20) / 100;
            uint256 p3 = (remainder * 15) / 100;

            uint256 distributed = 0;
            if (winners.length >= 1) { _payout(lobbyId, L.token, winners[0], p1); distributed += p1; }
            if (winners.length >= 2) { _payout(lobbyId, L.token, winners[1], p2); distributed += p2; }
            if (winners.length >= 3) { _payout(lobbyId, L.token, winners[2], p3); distributed += p3; }

            // send any rounding leftover to devWallet
            if (remainder > distributed) {
                uint256 leftover = remainder - distributed;
                if (L.token == address(0)) {
                    _safeNativeTransfer(devWallet, leftover);
                } else {
                    IERC20(L.token).safeTransfer(devWallet, leftover);
                }
                emit FeeTaken(lobbyId, devWallet, leftover);
            }
        }

        emit LobbyEnded(lobbyId, msg.sender, winners);
    }

    function _payout(uint256 lobbyId, address token, address to, uint256 amount) internal {
        if (amount == 0) return;
        if (token == address(0)) {
            _safeNativeTransfer(to, amount);
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
        emit Payout(lobbyId, to, amount);
    }

    function _safeNativeTransfer(address to, uint256 amount) internal {
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "native transfer failed");
    }

    function cancelLobby(uint256 lobbyId) external nonReentrant onlyCreatorOrAuthorized(lobbyId) {
        Lobby storage L = lobbies[lobbyId];
        require(L.state == LobbyState.OPEN, "lobby not open");

        L.state = LobbyState.ENDED;

        // refund all players
        for (uint i = 0; i < L.players.length; i++) {
            address player = L.players[i];
            if (L.token == address(0)) {
                _safeNativeTransfer(player, L.entryFee);
            } else {
                IERC20(L.token).safeTransfer(player, L.entryFee);
            }
            emit Payout(lobbyId, player, L.entryFee);
        }

        emit LobbyEnded(lobbyId, msg.sender, new address[](0));
    }

    // Allow contract to receive native payments
    receive() external payable {}
}
