const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('UnoLobbyV2 - Refund Tests', function () {
  let UnoLobbyV2, MockERC20, lobby, token, owner, dev, alice, bob, carol, dave;

  beforeEach(async function () {
    [owner, dev, alice, bob, carol, dave] = await ethers.getSigners();
    
    // Deploy contracts
    UnoLobbyV2 = await ethers.getContractFactory('UnoLobbyV2');
    lobby = await UnoLobbyV2.deploy(dev.address);
    await lobby.deployed();
    
    MockERC20 = await ethers.getContractFactory('MockERC20');
    token = await MockERC20.deploy('MockWETH', 'WETH', ethers.utils.parseEther('10000'));
    await token.deployed();
    
    console.log('✅ Contracts deployed');
    console.log('   UnoLobbyV2:', lobby.address);
    console.log('   MockERC20:', token.address);
    console.log('   Dev wallet:', dev.address);
  });

  describe('❌ Cancel Lobby with ETH - Full Refund Test', function () {
    it('Should refund all players when lobby is cancelled (ETH)', async function () {
      const entryFee = ethers.utils.parseEther('0.1');
      
      console.log('\n📝 Creating lobby with ETH...');
      console.log('   Entry fee:', ethers.utils.formatEther(entryFee), 'ETH');
      console.log('   Max players: 4');
      console.log('   Creator: Alice');
      
      // Alice creates lobby
      const tx = await lobby.connect(alice).createLobby(
        ethers.constants.AddressZero, // ETH nativo
        entryFee,
        4, // max players
        0  // BEAST mode
      );
      await tx.wait();
      const lobbyId = 1;
      
      console.log('✅ Lobby created with ID:', lobbyId);

      // Record balances BEFORE joining
      const aliceBalanceBefore = await ethers.provider.getBalance(alice.address);
      const bobBalanceBefore = await ethers.provider.getBalance(bob.address);
      const carolBalanceBefore = await ethers.provider.getBalance(carol.address);
      
      console.log('\n💰 Balances BEFORE joining:');
      console.log('   Alice:', ethers.utils.formatEther(aliceBalanceBefore), 'ETH');
      console.log('   Bob:', ethers.utils.formatEther(bobBalanceBefore), 'ETH');
      console.log('   Carol:', ethers.utils.formatEther(carolBalanceBefore), 'ETH');

      // Players join
      console.log('\n👥 Players joining lobby...');
      
      const joinTx1 = await lobby.connect(alice).joinLobby(lobbyId, { value: entryFee });
      const joinReceipt1 = await joinTx1.wait();
      const gasUsedAliceJoin = joinReceipt1.gasUsed.mul(joinReceipt1.effectiveGasPrice);
      console.log('   ✅ Alice joined (gas:', ethers.utils.formatEther(gasUsedAliceJoin), 'ETH)');
      
      const joinTx2 = await lobby.connect(bob).joinLobby(lobbyId, { value: entryFee });
      const joinReceipt2 = await joinTx2.wait();
      const gasUsedBobJoin = joinReceipt2.gasUsed.mul(joinReceipt2.effectiveGasPrice);
      console.log('   ✅ Bob joined (gas:', ethers.utils.formatEther(gasUsedBobJoin), 'ETH)');
      
      const joinTx3 = await lobby.connect(carol).joinLobby(lobbyId, { value: entryFee });
      const joinReceipt3 = await joinTx3.wait();
      const gasUsedCarolJoin = joinReceipt3.gasUsed.mul(joinReceipt3.effectiveGasPrice);
      console.log('   ✅ Carol joined (gas:', ethers.utils.formatEther(gasUsedCarolJoin), 'ETH)');

      // Check contract balance
      const contractBalance = await ethers.provider.getBalance(lobby.address);
      console.log('\n💼 Contract balance:', ethers.utils.formatEther(contractBalance), 'ETH');
      expect(contractBalance).to.equal(entryFee.mul(3));

      // Get lobby info
      const lobbyInfo = await lobby.getLobbyInfo(lobbyId);
      console.log('\n📊 Lobby info:');
      console.log('   State:', lobbyInfo.state); // 0=OPEN, 1=STARTED, 2=ENDED, 3=CANCELLED
      console.log('   Players:', lobbyInfo.players.length);
      expect(lobbyInfo.players.length).to.equal(3);
      expect(lobbyInfo.state).to.equal(0); // OPEN

      // Alice cancels the lobby
      console.log('\n❌ Alice cancelling lobby...');
      const cancelTx = await lobby.connect(alice).cancelLobby(lobbyId);
      const cancelReceipt = await cancelTx.wait();
      const gasUsedCancel = cancelReceipt.gasUsed.mul(cancelReceipt.effectiveGasPrice);
      console.log('   Gas used for cancel:', ethers.utils.formatEther(gasUsedCancel), 'ETH');
      
      // Check event
      const cancelEvent = cancelReceipt.events?.find(e => e.event === 'LobbyCancelled');
      expect(cancelEvent).to.not.be.undefined;
      expect(cancelEvent.args.lobbyId).to.equal(lobbyId);
      expect(cancelEvent.args.refundedPlayers).to.equal(3);
      console.log('   ✅ LobbyCancelled event emitted');
      console.log('   Refunded players:', cancelEvent.args.refundedPlayers.toString());

      // Check refund events (Payout events)
      const payoutEvents = cancelReceipt.events?.filter(e => e.event === 'Payout');
      expect(payoutEvents.length).to.equal(3);
      console.log('   ✅', payoutEvents.length, 'Payout events emitted');

      // Verify lobby state is CANCELLED
      const lobbyInfoAfter = await lobby.getLobbyInfo(lobbyId);
      expect(lobbyInfoAfter.state).to.equal(3); // CANCELLED
      console.log('   ✅ Lobby state changed to CANCELLED');

      // Check contract balance (should be 0 after refunds)
      const contractBalanceAfter = await ethers.provider.getBalance(lobby.address);
      console.log('\n💼 Contract balance after cancel:', ethers.utils.formatEther(contractBalanceAfter), 'ETH');
      expect(contractBalanceAfter).to.equal(0);

      // Check player balances AFTER refund
      const aliceBalanceAfter = await ethers.provider.getBalance(alice.address);
      const bobBalanceAfter = await ethers.provider.getBalance(bob.address);
      const carolBalanceAfter = await ethers.provider.getBalance(carol.address);
      
      console.log('\n💰 Balances AFTER cancel:');
      console.log('   Alice:', ethers.utils.formatEther(aliceBalanceAfter), 'ETH');
      console.log('   Bob:', ethers.utils.formatEther(bobBalanceAfter), 'ETH');
      console.log('   Carol:', ethers.utils.formatEther(carolBalanceAfter), 'ETH');

      // Calculate expected balances (original - gas costs for join and cancel)
      const expectedAliceBalance = aliceBalanceBefore.sub(gasUsedAliceJoin).sub(gasUsedCancel);
      const expectedBobBalance = bobBalanceBefore.sub(gasUsedBobJoin);
      const expectedCarolBalance = carolBalanceBefore.sub(gasUsedCarolJoin);
      
      console.log('\n✅ Expected balances (after gas):');
      console.log('   Alice:', ethers.utils.formatEther(expectedAliceBalance), 'ETH');
      console.log('   Bob:', ethers.utils.formatEther(expectedBobBalance), 'ETH');
      console.log('   Carol:', ethers.utils.formatEther(expectedCarolBalance), 'ETH');

      // Verify refunds (allowing small gas price variations)
      const tolerance = ethers.utils.parseEther('0.0001'); // 0.0001 ETH tolerance for gas variations
      
      expect(aliceBalanceAfter).to.be.closeTo(expectedAliceBalance, tolerance);
      expect(bobBalanceAfter).to.be.closeTo(expectedBobBalance, tolerance);
      expect(carolBalanceAfter).to.be.closeTo(expectedCarolBalance, tolerance);
      
      console.log('\n🎉 ALL REFUNDS VERIFIED! Each player got their entry fee back.');
    });
  });

  describe('❌ Cancel Lobby with ERC20 - Full Refund Test', function () {
    it('Should refund all players when lobby is cancelled (ERC20)', async function () {
      const entryFee = ethers.utils.parseEther('10');
      
      console.log('\n📝 Creating lobby with ERC20...');
      console.log('   Token:', token.address);
      console.log('   Entry fee:', ethers.utils.formatEther(entryFee), 'tokens');
      console.log('   Max players: 4');
      console.log('   Creator: Alice');
      
      // Distribute tokens to players
      await token.transfer(alice.address, ethers.utils.parseEther('100'));
      await token.transfer(bob.address, ethers.utils.parseEther('100'));
      await token.transfer(carol.address, ethers.utils.parseEther('100'));
      console.log('   ✅ Tokens distributed to players');

      // Alice creates lobby
      const tx = await lobby.connect(alice).createLobby(
        token.address,
        entryFee,
        4, // max players
        1  // CLASSIC mode
      );
      await tx.wait();
      const lobbyId = 1;
      console.log('✅ Lobby created with ID:', lobbyId);

      // Record balances BEFORE joining
      const aliceBalanceBefore = await token.balanceOf(alice.address);
      const bobBalanceBefore = await token.balanceOf(bob.address);
      const carolBalanceBefore = await token.balanceOf(carol.address);
      
      console.log('\n💰 Token balances BEFORE joining:');
      console.log('   Alice:', ethers.utils.formatEther(aliceBalanceBefore), 'tokens');
      console.log('   Bob:', ethers.utils.formatEther(bobBalanceBefore), 'tokens');
      console.log('   Carol:', ethers.utils.formatEther(carolBalanceBefore), 'tokens');

      // Approve and join
      console.log('\n👥 Players approving and joining...');
      
      await token.connect(alice).approve(lobby.address, entryFee);
      await lobby.connect(alice).joinLobby(lobbyId);
      console.log('   ✅ Alice approved and joined');
      
      await token.connect(bob).approve(lobby.address, entryFee);
      await lobby.connect(bob).joinLobby(lobbyId);
      console.log('   ✅ Bob approved and joined');
      
      await token.connect(carol).approve(lobby.address, entryFee);
      await lobby.connect(carol).joinLobby(lobbyId);
      console.log('   ✅ Carol approved and joined');

      // Check contract token balance
      const contractBalance = await token.balanceOf(lobby.address);
      console.log('\n💼 Contract token balance:', ethers.utils.formatEther(contractBalance), 'tokens');
      expect(contractBalance).to.equal(entryFee.mul(3));

      // Alice cancels the lobby
      console.log('\n❌ Alice cancelling lobby...');
      const cancelTx = await lobby.connect(alice).cancelLobby(lobbyId);
      const cancelReceipt = await cancelTx.wait();
      
      // Check event
      const cancelEvent = cancelReceipt.events?.find(e => e.event === 'LobbyCancelled');
      expect(cancelEvent).to.not.be.undefined;
      console.log('   ✅ LobbyCancelled event emitted');
      console.log('   Refunded players:', cancelEvent.args.refundedPlayers.toString());

      // Check contract balance (should be 0 after refunds)
      const contractBalanceAfter = await token.balanceOf(lobby.address);
      console.log('\n💼 Contract token balance after cancel:', ethers.utils.formatEther(contractBalanceAfter), 'tokens');
      expect(contractBalanceAfter).to.equal(0);

      // Check player balances AFTER refund
      const aliceBalanceAfter = await token.balanceOf(alice.address);
      const bobBalanceAfter = await token.balanceOf(bob.address);
      const carolBalanceAfter = await token.balanceOf(carol.address);
      
      console.log('\n💰 Token balances AFTER cancel:');
      console.log('   Alice:', ethers.utils.formatEther(aliceBalanceAfter), 'tokens');
      console.log('   Bob:', ethers.utils.formatEther(bobBalanceAfter), 'tokens');
      console.log('   Carol:', ethers.utils.formatEther(carolBalanceAfter), 'tokens');

      // Verify full refunds (no gas costs for ERC20)
      expect(aliceBalanceAfter).to.equal(aliceBalanceBefore);
      expect(bobBalanceAfter).to.equal(bobBalanceBefore);
      expect(carolBalanceAfter).to.equal(carolBalanceBefore);
      
      console.log('\n🎉 ALL ERC20 REFUNDS VERIFIED! Each player got their tokens back.');
    });
  });

  describe('🚫 Cancel Restrictions', function () {
    it('Should reject cancel from non-creator', async function () {
      const entryFee = ethers.utils.parseEther('0.1');
      
      await lobby.connect(alice).createLobby(
        ethers.constants.AddressZero,
        entryFee,
        4,
        0
      );
      const lobbyId = 1;
      
      await lobby.connect(alice).joinLobby(lobbyId, { value: entryFee });
      await lobby.connect(bob).joinLobby(lobbyId, { value: entryFee });
      
      // Bob tries to cancel (should fail)
      await expect(
        lobby.connect(bob).cancelLobby(lobbyId)
      ).to.be.revertedWith('Only creator or owner can cancel');
      
      console.log('✅ Non-creator correctly prevented from cancelling');
    });

    it('Should allow owner to cancel any lobby', async function () {
      const entryFee = ethers.utils.parseEther('0.1');
      
      await lobby.connect(alice).createLobby(
        ethers.constants.AddressZero,
        entryFee,
        4,
        0
      );
      const lobbyId = 1;
      
      await lobby.connect(alice).joinLobby(lobbyId, { value: entryFee });
      
      // Owner cancels (should work)
      await lobby.connect(owner).cancelLobby(lobbyId);
      
      const lobbyInfo = await lobby.getLobbyInfo(lobbyId);
      expect(lobbyInfo.state).to.equal(3); // CANCELLED
      
      console.log('✅ Owner successfully cancelled lobby');
    });

    it('Should reject cancel after lobby started', async function () {
      const entryFee = ethers.utils.parseEther('0.1');
      
      await lobby.connect(alice).createLobby(
        ethers.constants.AddressZero,
        entryFee,
        2, // only 2 players to auto-start
        0
      );
      const lobbyId = 1;
      
      await lobby.connect(alice).joinLobby(lobbyId, { value: entryFee });
      await lobby.connect(bob).joinLobby(lobbyId, { value: entryFee });
      
      // Lobby auto-started, try to cancel
      await expect(
        lobby.connect(alice).cancelLobby(lobbyId)
      ).to.be.revertedWithCustomError(lobby, 'LobbyNotOpen');
      
      console.log('✅ Cancel correctly prevented after lobby started');
    });
  });
});
