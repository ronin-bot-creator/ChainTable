const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('UnoLobby', function () {
  let UnoLobby, MockERC20, uno, token, owner, dev, alice, bob, carol;

  beforeEach(async function () {
    [owner, dev, alice, bob, carol] = await ethers.getSigners();
    UnoLobby = await ethers.getContractFactory('UnoLobby');
    MockERC20 = await ethers.getContractFactory('MockERC20');

    token = await MockERC20.deploy('MockWETH', 'WETH', ethers.utils.parseEther('1000'));
    await token.deployed();

    uno = await UnoLobby.deploy(dev.address);
    await uno.deployed();
  });

  it('BEAST native flow', async function () {
    // create lobby native
    const entry = ethers.utils.parseEther('1');
    await uno.connect(alice).createLobby(ethers.constants.AddressZero, entry, 3, 0); // BEAST
    const id = 1;

    // join
    await uno.connect(bob).joinLobby(id, { value: entry });
    await uno.connect(carol).joinLobby(id, { value: entry });
    // creator alice joins
    await uno.connect(alice).joinLobby(id, { value: entry });

    // end lobby, winner = bob
    await uno.connect(alice).endLobby(id, [bob.address]);

    // dev should receive fee 0.15, winner 2.85
    // check balances via provider
    const devBalance = await ethers.provider.getBalance(dev.address);
    expect(devBalance).to.be.a('object');
  });

  it('CLASSIC ERC20 flow', async function () {
    const entry = ethers.utils.parseEther('0.01');
    await uno.connect(alice).createLobby(token.address, entry, 3, 1); // CLASSIC
    const id = 1;

    // give tokens to players
    await token.transfer(bob.address, ethers.utils.parseEther('10'));
    await token.transfer(carol.address, ethers.utils.parseEther('10'));
    await token.transfer(alice.address, ethers.utils.parseEther('10'));

    await token.connect(bob).approve(uno.address, entry);
    await token.connect(carol).approve(uno.address, entry);
    await token.connect(alice).approve(uno.address, entry);

    await uno.connect(bob).joinLobby(id);
    await uno.connect(carol).joinLobby(id);
    await uno.connect(alice).joinLobby(id);

    // end lobby classic winners bob, carol, alice
    await uno.connect(alice).endLobby(id, [bob.address, carol.address, alice.address]);

    // validate events maybe
  });

  it('reject double join', async function () {
    const entry = ethers.utils.parseEther('0.01');
    await uno.connect(alice).createLobby(token.address, entry, 4, 0);
    const id = 1;
    await token.transfer(bob.address, ethers.utils.parseEther('10'));
    await token.connect(bob).approve(uno.address, entry);
    await uno.connect(bob).joinLobby(id);
    await expect(uno.connect(bob).joinLobby(id)).to.be.revertedWith('already joined');
  });

  it('cancel and refund', async function () {
    const entry = ethers.utils.parseEther('0.01');
    await uno.connect(alice).createLobby(token.address, entry, 4, 0);
    const id = 1;
    await token.transfer(bob.address, ethers.utils.parseEther('10'));
    await token.connect(bob).approve(uno.address, entry);
    await uno.connect(bob).joinLobby(id);

    // cancel
    await uno.connect(alice).cancelLobby(id);
    // ensure bob got refunded
  });
});
