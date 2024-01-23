import { ethers } from "hardhat";
import { expect } from "chai";

import { GalaxyFox, GalaxyFox__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const wethJson = require("@uniswap/v2-periphery/build/WETH9.json");
import uniswapFactory from "@uniswap/v2-core/build/UniswapV2Factory.json";
import uniswapRouter from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import uniswapPair from "@uniswap/v2-core/build/UniswapV2Pair.json";
import { Contract, ContractFactory } from "ethers";

const creaditEthTOAdress = async (address: string) => {
  await ethers.provider.send("hardhat_setBalance", [
    address,
    "0x" + ethers.parseEther("1000").toString(16), // 100 ETH
  ]);
};

const INITIAL_SUPPLY = 5000000000n * 10n ** 18n;

const TAX_DENOMINATOR = 10000n;

const SELL_TAX = {
  liquidity: 1000n,
  marketing: 500n,
  ecosystem: 500n,
};

const BUY_TAX = {
  liquidity: 1000n,
  marketing: 500n,
  ecosystem: 500n,
};

const VALID_TAX = {
  liquidity: 666n,
  marketing: 666n,
  ecosystem: 666n,
};

const badTax = {
  liquidity: 1000n,
  marketing: 751n,
  ecosystem: 750n,
};

describe("GalaxyFox", () => {
  let weth: Contract;
  let uniFactory: Contract;
  let uniRouter: Contract;
  let gfox: GalaxyFox;
  let pairAddress: string;

  before(async function () {
    const [owner, ecosystem, autoLP, marketing] = await ethers.getSigners();

    const UniswapV2Factory = await ethers.getContractFactory(
      uniswapFactory.abi,
      uniswapFactory.bytecode
    );
    uniFactory = (await UniswapV2Factory.deploy(owner.address)) as Contract;
    await uniFactory.waitForDeployment();

    const WETH9 = (await ethers.getContractFactory(
      wethJson.abi,
      wethJson.bytecode
    )) as ContractFactory;

    weth = (await WETH9.deploy()) as Contract;
    await weth.waitForDeployment();

    const UniswapV2Router02 = await ethers.getContractFactory(
      uniswapRouter.abi,
      uniswapRouter.bytecode
    );

    uniRouter = (await UniswapV2Router02.deploy(
      await uniFactory.getAddress(),
      await weth.getAddress()
    )) as Contract;

    await uniRouter.waitForDeployment();

    const GalaxyFoxFactory = await ethers.getContractFactory("GalaxyFox");

    gfox = await GalaxyFoxFactory.deploy(
      owner.address,
      ecosystem.address,
      autoLP.address,
      marketing.address,
      await uniRouter.getAddress(),
      await uniFactory.getAddress()
    );

    gfox = await gfox.waitForDeployment();

    pairAddress = await uniFactory.getPair(
      await gfox.getAddress(),
      await weth.getAddress()
    );

    const signers = await ethers.getSigners();

    // credit eth to each signer
    for (let i = 0; i < signers.length; i++) {
      await creaditEthTOAdress(signers[i].address);
    }
  });

  it("should have the correct taxes", async () => {
    const sellTax = await gfox.sellTax();
    const buyTax = await gfox.buyTax();

    expect(sellTax.liquidity).to.equal(SELL_TAX.liquidity);
    expect(sellTax.marketing).to.equal(SELL_TAX.marketing);
    expect(sellTax.ecosystem).to.equal(SELL_TAX.ecosystem);

    expect(buyTax.liquidity).to.equal(BUY_TAX.liquidity);
    expect(buyTax.marketing).to.equal(BUY_TAX.marketing);
    expect(buyTax.ecosystem).to.equal(BUY_TAX.ecosystem);
  });

  it("should have the right default  info", async () => {
    const [owner, ecosystem, autoLP, marketing] = await ethers.getSigners();

    const factoryAddress = await gfox.uniFactory();
    const routerAddress = await gfox.uniRouter();
    const pairAddress = await gfox.uniPair();

    expect(factoryAddress).to.equal(await uniFactory.getAddress());
    expect(routerAddress).to.equal(await uniRouter.getAddress());
    expect(pairAddress).to.equal(pairAddress);

    const totalSupply = await gfox.totalSupply();

    expect(totalSupply).to.equal(INITIAL_SUPPLY);

    expect(await gfox.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);

    expect(await gfox.isExcludedFromFee(owner.address)).to.equal(true);
    expect(await gfox.isExcludedFromFee(await gfox.getAddress())).to.equal(
      true
    );

    expect(await gfox.isPair(pairAddress)).to.equal(true);
  });

  it("should not allow a bad tax", async () => {
    await expect(
      gfox.setSellTax(badTax.liquidity, badTax.marketing, badTax.ecosystem)
    ).to.be.revertedWith("GalaxyFox: tax too high");

    await expect(
      gfox.setBuyTax(badTax.liquidity, badTax.marketing, badTax.ecosystem)
    ).to.be.revertedWith("GalaxyFox: tax too high");
  });

  it("should allow owner only to change the tax", async () => {
    const [owner, ecosystem, autoLP, marketing] = await ethers.getSigners();

    await expect(
      gfox
        .connect(ecosystem)
        .setSellTax(
          VALID_TAX.liquidity,
          VALID_TAX.marketing,
          VALID_TAX.ecosystem
        )
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await expect(
      gfox
        .connect(ecosystem)
        .setBuyTax(
          VALID_TAX.liquidity,
          VALID_TAX.marketing,
          VALID_TAX.ecosystem
        )
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await gfox
      .connect(owner)
      .setSellTax(
        VALID_TAX.liquidity,
        VALID_TAX.marketing,
        VALID_TAX.ecosystem
      );

    await gfox
      .connect(owner)
      .setBuyTax(VALID_TAX.liquidity, VALID_TAX.marketing, VALID_TAX.ecosystem);

    const sellTax = await gfox.sellTax();
    const buyTax = await gfox.buyTax();

    expect(sellTax.liquidity).to.equal(VALID_TAX.liquidity);
    expect(sellTax.marketing).to.equal(VALID_TAX.marketing);
    expect(sellTax.ecosystem).to.equal(VALID_TAX.ecosystem);

    expect(buyTax.liquidity).to.equal(VALID_TAX.liquidity);
    expect(buyTax.marketing).to.equal(VALID_TAX.marketing);
    expect(buyTax.ecosystem).to.equal(VALID_TAX.ecosystem);

    await gfox
      .connect(owner)
      .setSellTax(SELL_TAX.liquidity, SELL_TAX.marketing, SELL_TAX.ecosystem);

    await gfox
      .connect(owner)
      .setBuyTax(BUY_TAX.liquidity, BUY_TAX.marketing, BUY_TAX.ecosystem);
  });

  it("should transfer without tax ", async () => {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl] =
      await ethers.getSigners();

    await gfox.transfer(alice.address, 1000n * 10n ** 18n);

    expect(await gfox.balanceOf(alice.address)).to.equal(1000n * 10n ** 18n);

    await gfox.connect(alice).transfer(bob.address, 100n * 10n ** 18n);

    expect(await gfox.balanceOf(bob.address)).to.equal(100n * 10n ** 18n);

    await gfox.connect(bob).transfer(carl.address, 10n * 10n ** 18n);

    expect(await gfox.balanceOf(carl.address)).to.equal(10n * 10n ** 18n);
  });

  it("should create LP ", async function () {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl] =
      await ethers.getSigners();

    // approve 10000 token to uniswap router

    await gfox.approve(await uniRouter.getAddress(), 100000n * 10n ** 18n);

    // owner creates lp
    await uniRouter
      .connect(owner)
      //@ts-ignore
      .addLiquidityETH(
        await gfox.getAddress(),
        100000n * 10n ** 18n,
        0,
        0,
        owner.address,
        1000000000000000000n,
        { value: 100n * 10n ** 18n }
      );

    // expect balance of pair to be 10000 token and 100 weth
    const pair = await uniFactory.getPair(gfox.getAddress(), weth.getAddress());

    const pairContract = await ethers.getContractAt(uniswapPair.abi, pair);

    const [token0, token1] = await pairContract.getReserves();

    if (Number(weth.address) < Number(gfox.getAddress())) {
      expect(token0).to.equal(100n * 10n ** 18n);
      expect(token1).to.equal(10000n * 10n ** 18n);
    } else {
      expect(token0).to.equal(100000n * 10n ** 18n);
      expect(token1).to.equal(100n * 10n ** 18n);
    }
  });

  it("should allow only owner to enable taxes", async () => {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl] =
      await ethers.getSigners();

    await expect(
      gfox.connect(alice).setTaxEnabled(true)
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await gfox.connect(owner).setTaxEnabled(true);

    expect(await gfox.taxEnabled()).to.equal(true);
  });

  it("allows owner to change marketing, autoLP, and ecosystem addresses", async () => {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl] =
      await ethers.getSigners();

    await expect(
      gfox.connect(alice).setMarketingHolder(carl.address)
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await gfox.connect(owner).setMarketingHolder(carl.address);

    expect(await gfox.marketingHolder()).to.equal(carl.address);

    // fails for address 0
    await expect(
      gfox.connect(owner).setMarketingHolder(ethers.ZeroAddress)
    ).to.be.revertedWith("GalaxyFox: zero address");

    await expect(
      gfox.connect(alice).setLiquidityHolder(carl.address)
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await gfox.connect(owner).setLiquidityHolder(carl.address);

    expect(await gfox.liquidityHolder()).to.equal(carl.address);

    // fails for address 0
    await expect(
      gfox.connect(owner).setLiquidityHolder(ethers.ZeroAddress)
    ).to.be.revertedWith("GalaxyFox: zero address");

    await expect(
      gfox.connect(alice).setEcosystemHolder(carl.address)
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await gfox.connect(owner).setEcosystemHolder(carl.address);

    expect(await gfox.ecosystemHolder()).to.equal(carl.address);

    // fails for address 0
    await expect(
      gfox.connect(owner).setEcosystemHolder(ethers.ZeroAddress)
    ).to.be.revertedWith("GalaxyFox: zero address");

    await gfox.connect(owner).setMarketingHolder(marketing.address);
    await gfox.connect(owner).setLiquidityHolder(autoLP.address);
    await gfox.connect(owner).setEcosystemHolder(ecosystem.address);
  });

  it("only owner can exclude users from tax", async () => {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl] =
      await ethers.getSigners();

    await expect(
      gfox.connect(alice).setExcludedFromFee(alice.address, true)
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await gfox.connect(owner).setExcludedFromFee(alice.address, true);

    expect(await gfox.isExcludedFromFee(alice.address)).to.equal(true);

    await gfox.connect(owner).setExcludedFromFee(alice.address, false);
  });

  it("only owner can add a new pair", async () => {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl, fakeLP] =
      await ethers.getSigners();

    await expect(
      gfox.connect(alice).setPair(fakeLP.address, true)
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await gfox.connect(owner).setPair(fakeLP.address, true);

    expect(await gfox.isPair(fakeLP.address)).to.equal(true);

    // fails to remove pair
    await expect(
      gfox.connect(alice).setPair(fakeLP.address, false)
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");
  });

  it("fails to receive ETH", async function () {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl, fakeLP] =
      await ethers.getSigners();

    // expect sending eth from owner to contract address to fail
    await expect(
      owner.sendTransaction({
        to: gfox.getAddress(),
        value: ethers.parseEther("1.0"),
      })
    ).to.be.revertedWith("Invalid sender");
  });

  it("burns tokens", async function () {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl, fakeLP] =
      await ethers.getSigners();

    const initialSupply = await gfox.totalSupply();

    await gfox.connect(owner).burn(100n * 10n ** 18n);

    const newSupply = await gfox.totalSupply();

    expect(newSupply).to.equal(initialSupply - 100n * 10n ** 18n);
  });

  it("only owner can set miniBeforeLiquify", async function () {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl, fakeLP] =
      await ethers.getSigners();

    await expect(
      gfox.connect(alice).setMiniBeforeLiquify(100n * 10n ** 18n)
    ).to.be.revertedWithCustomError(gfox, "OwnableUnauthorizedAccount");

    await gfox.connect(owner).setMiniBeforeLiquify(100n * 10n ** 18n);

    expect(await gfox.miniBeforeLiquify()).to.equal(100n * 10n ** 18n);
  });

  it("should pay no tax on transfer", async function () {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl, fakeLP] =
      await ethers.getSigners();

    await expect(gfox.connect(owner).setTaxEnabled(true)).to.be.revertedWith(
      "GalaxyFox: already set"
    );

    // burn all alice tokens
    await gfox.connect(alice).burn(await gfox.balanceOf(alice.address));
    // burn all bob tokens
    await gfox.connect(bob).burn(await gfox.balanceOf(bob.address));
    // burn all carl tokens
    await gfox.connect(carl).burn(await gfox.balanceOf(carl.address));

    await gfox.connect(owner).transfer(alice.address, 100n * 10n ** 18n);

    expect(await gfox.balanceOf(alice.address)).to.equal(100n * 10n ** 18n);

    await gfox.connect(alice).transfer(bob.address, 100n * 10n ** 18n);

    expect(await gfox.balanceOf(bob.address)).to.equal(100n * 10n ** 18n);

    await gfox.connect(bob).transfer(carl.address, 10n * 10n ** 18n);

    expect(await gfox.balanceOf(carl.address)).to.equal(10n * 10n ** 18n);
  });

  it("should pay buy tax on buy", async function () {
    const [owner, ecosystem, autoLP, marketing, alice, bob, carl, fakeLP] =
      await ethers.getSigners();

    // burn all alice, bob, and carl tokens
    await gfox.connect(alice).burn(await gfox.balanceOf(alice.address));
    await gfox.connect(bob).burn(await gfox.balanceOf(bob.address));
    await gfox.connect(carl).burn(await gfox.balanceOf(carl.address));

    const amountsOut = await uniRouter.getAmountsOut(1n * 10n ** 18n, [
      await weth.getAddress(),
      await gfox.getAddress(),
    ]);

    await uniRouter
      .connect(alice)
      //@ts-ignore
      .swapExactETHForTokensSupportingFeeOnTransferTokens(
        0,
        [await weth.getAddress(), await gfox.getAddress()],
        alice.address,
        999999999999999999n,
        { value: 1n * 10n ** 18n }
      );

    const expectedAmount =
      amountsOut[1] -
      (amountsOut[1] *
        (BUY_TAX.liquidity + BUY_TAX.marketing + BUY_TAX.ecosystem)) /
        TAX_DENOMINATOR;

    const balanceOfAlice = await gfox.balanceOf(alice.address);

    expect(balanceOfAlice).to.closeTo(expectedAmount, 1n);
  });

  it("should pay sell tax on sell", async function () {
    const [
      owner,
      ecosystem,
      autoLP,
      marketing,
      alice,
      bob1,
      carl,
      fakeLP,
      bob,
    ] = await ethers.getSigners();

    // burn all alice, bob, and carl tokens
    await gfox.connect(alice).burn(await gfox.balanceOf(alice.address));
    await gfox.connect(bob).burn(await gfox.balanceOf(bob.address));
    await gfox.connect(carl).burn(await gfox.balanceOf(carl.address));

    await gfox.connect(owner).transfer(bob.address, 100n * 10n ** 18n);

    const pairBalanceBefore = await gfox.balanceOf(pairAddress);

    const amountsOut2 = await uniRouter.getAmountsOut(100n * 10n ** 18n, [
      await gfox.getAddress(),
      await weth.getAddress(),
    ]);

    await gfox
      .connect(bob)
      .approve(await uniRouter.getAddress(), 100n * 10n ** 18n);

    await uniRouter
      .connect(bob)
      //@ts-ignore
      .swapExactTokensForETHSupportingFeeOnTransferTokens(
        100n * 10n ** 18n,
        0,
        [await gfox.getAddress(), await weth.getAddress()],
        bob.address,
        999999999999999999n
      );

    const expectedAmount2 =
      amountsOut2[0] -
      (amountsOut2[0] *
        (SELL_TAX.liquidity + SELL_TAX.marketing + SELL_TAX.ecosystem)) /
        TAX_DENOMINATOR;

    const lpBalanceAfter = await gfox.balanceOf(pairAddress);

    // expect bob to have no balance
    expect(await gfox.balanceOf(bob.address)).to.equal(0);

    expect(lpBalanceAfter - pairBalanceBefore).to.closeTo(expectedAmount2, 1n);
  });

  it("should still work if taxes are set to zero", async () => {
    const [
      owner,
      ecosystem,
      autoLP,
      marketing,
      alice,
      bob1,
      carl,
      fakeLP,
      bob,
    ] = await ethers.getSigners();

    await gfox.connect(owner).setSellTax(0, 0, 0);
    await gfox.connect(owner).setBuyTax(0, 0, 0);

    // burn all alice, bob, and carl tokens
    await gfox.connect(alice).burn(await gfox.balanceOf(alice.address));
    await gfox.connect(bob).burn(await gfox.balanceOf(bob.address));
    await gfox.connect(carl).burn(await gfox.balanceOf(carl.address));

    await gfox.connect(owner).transfer(bob.address, 100n * 10n ** 18n);
    await gfox.connect(owner).transfer(carl.address, 100n * 10n ** 18n);
    await gfox.connect(owner).transfer(alice.address, 100n * 10n ** 18n);

    // bob, alice and carl buy 1eth worth of gfox each
    const users = [bob, alice, carl];

    for (let i = 0; i < users.length; i++) {
      await uniRouter
        .connect(users[i])
        //@ts-ignore
        .swapExactETHForTokensSupportingFeeOnTransferTokens(
          0,
          [await weth.getAddress(), await gfox.getAddress()],
          bob.address,
          999999999999999999n,
          { value: 1n * 10n ** 18n }
        );
    }

    // bob, alice and carl sell 1eth worth of gfox each
    for (let i = 0; i < users.length; i++) {
      await gfox
        .connect(users[i])
        .approve(await uniRouter.getAddress(), 100n * 10n ** 18n);

      await uniRouter
        .connect(users[i])
        //@ts-ignore
        .swapExactTokensForETHSupportingFeeOnTransferTokens(
          100n * 10n ** 18n,
          0,
          [await gfox.getAddress(), await weth.getAddress()],
          bob.address,
          999999999999999999n
        );
    }

    // transfer between users
    for (let i = 0; i < users.length - 1; i++) {
      await gfox
        .connect(users[i])
        .transfer(users[i + 1].address, 1n * 10n ** 18n);
    }
  });

  it("should swap and liquify", async () => {
    const [
      owner,
      ecosystem,
      autoLP,
      marketing,
      alice,
      bob1,
      carl,
      fakeLP,
      bob,
    ] = await ethers.getSigners();

    // owner balance
    const ownerBalance = await gfox.balanceOf(owner.address);

    // set taxes back
    await gfox
      .connect(owner)
      .setSellTax(SELL_TAX.liquidity, SELL_TAX.marketing, SELL_TAX.ecosystem);
    await gfox
      .connect(owner)
      .setBuyTax(BUY_TAX.liquidity, BUY_TAX.marketing, BUY_TAX.ecosystem);

    // burn all alice, bob, and carl tokens
    await gfox.connect(alice).burn(await gfox.balanceOf(alice.address));
    await gfox.connect(bob).burn(await gfox.balanceOf(bob.address));
    await gfox.connect(carl).burn(await gfox.balanceOf(carl.address));

    await gfox.connect(owner).transfer(alice.address, 100n * 10n ** 18n);

    // set miniBeforeLiquify to 0
    await gfox.connect(owner).setMiniBeforeLiquify(0);

    // alice sells her 100 tokens
    await gfox
      .connect(alice)
      .approve(await uniRouter.getAddress(), 100n * 10n ** 18n);

    const liquidityReserves = await gfox.liquidityReserves();

    const lpPairBalanceBefore = await gfox.balanceOf(pairAddress);

    await uniRouter
      .connect(alice)
      //@ts-ignore
      .swapExactTokensForETHSupportingFeeOnTransferTokens(
        100n * 10n ** 18n,
        0,
        [await gfox.getAddress(), await weth.getAddress()],
        alice.address,
        999999999999999999n
      );

    const lpPairBalanceAfter = await gfox.balanceOf(pairAddress);

    const expectedOut = 100n * 10n ** 18n - (100n * 10n ** 18n * 20n) / 100n;

    expect(lpPairBalanceAfter - lpPairBalanceBefore).to.closeTo(
      expectedOut + liquidityReserves,
      3n * 10n ** 16n
    );
  });

  it("should honor maxVolume", async () => {
    const [
      owner,
      ecosystem,
      autoLP,
      marketing,
      alice,
      bob1,
      carl,
      fakeLP,
      bob,
      newUser,
    ] = await ethers.getSigners();

    const totalSupply = await gfox.totalSupply();
    const blockTime = (await ethers.provider.getBlock("latest"))?.timestamp;

    const day = BigInt(blockTime) / 86400n;

    const maxVolume = totalSupply / 1000n;

    // set max volume to 0.1% of total supply
    await gfox.connect(owner).setMaxDailyVolume(maxVolume);

    // owner can transfer 0.1% of total supply
    await gfox.connect(owner).transfer(newUser.address, maxVolume + 1n);

    // newUser fails to transfer 0.1% of total supply
    await expect(
      gfox.connect(newUser).transfer(owner.address, maxVolume + 1n)
    ).to.be.revertedWith("GalaxyFox: max daily volume exceeded");

    // new user can transfer 0.1% of total supply
    await gfox.connect(newUser).transfer(owner.address, maxVolume);

    // fails to transfer 1n
    await expect(
      gfox.connect(newUser).transfer(owner.address, 1n)
    ).to.be.revertedWith("GalaxyFox: max daily volume exceeded");

    // move time by 1 day
    await ethers.provider.send("evm_increaseTime", [86400]);

    // mine
    await ethers.provider.send("evm_mine", []);

    // newUser can transfer 1n
    await gfox.connect(newUser).transfer(owner.address, 1n);
  });
});
