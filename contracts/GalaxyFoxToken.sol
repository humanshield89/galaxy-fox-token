// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

uint256 constant INITIAL_SUPPLY = 5000000000 * 10 ** 18;

uint256 constant TAX_BASE = 10000;

uint256 constant MAX_TAX = 2000; // 20%

uint256 constant DAY = 1 days;

struct Tax {
    uint16 liquidity;
    uint16 marketing;
    uint16 ecosystem;
}

interface IUniFactory {
    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair);
}

contract GalaxyFox is ERC20, Ownable {
    Tax public buyTax = Tax(1000, 500, 500); // 6 bytes
    Tax public sellTax = Tax(1000, 500, 500); // 6 bytes

    address payable public liquidityHolder; // 20 bytes
    address payable public marketingHolder; // 20 bytes
    address payable public ecosystemHolder; // 20 bytes
    bool public taxEnabled = false;

    IUniFactory public immutable uniFactory; // 20 bytes
    IUniswapV2Router02 public immutable uniRouter; // 20 bytes
    address public immutable weth; // 20 bytes
    address public immutable uniPair; // 20 bytes

    mapping(address => bool) public isExcludedFromFee;

    mapping(address => bool) public isPair;

    mapping(address => mapping(uint256 => uint256)) public volume;
    mapping(address => bool) public isExcludedFromDailyVolume;

    uint256 public maxDailyVolume = INITIAL_SUPPLY / 1000;

    uint256 public liquidityReserves;
    uint256 public miniBeforeLiquify;

    event TaxEnabled(bool enabled);
    event ExeededFromFee(address account, bool excluded);
    event Pair(address pair, bool isPair);
    event EcosystemHolder(address oldHolder, address holder);
    event MarketingHolder(address oldHolder, address holder);
    event LiquidityHolder(address oldHolder, address holder);
    event SellTaxChanged(uint16 liquidity, uint16 marketing, uint16 ecosystem);
    event BuyTaxChanged(uint16 liquidity, uint16 marketing, uint16 ecosystem);
    event ExcludedFromDailyVolume(address account, bool excluded);
    event MaxDailyVolumeChanged(uint256 maxDailyVolume);
    event MiniBeforeLiquifyChanged(uint256 miniBeforeLiquifyArg);

    constructor(
        // to allow for easy testing/deploy on behalf of someone else
        address _ownerArg,
        address payable _ecosystemHolder,
        address payable _marketingHolder,
        address payable _liquidityHolder,
        IUniswapV2Router02 _uniswapV2Router,
        IUniFactory _uniswapV2Factory
    ) ERC20("Galaxy Fox", "GFOX") Ownable(_ownerArg) {
        _mint(_ownerArg, INITIAL_SUPPLY);

        ecosystemHolder = _ecosystemHolder;
        marketingHolder = _marketingHolder;
        liquidityHolder = _liquidityHolder;

        uniRouter = _uniswapV2Router;
        uniFactory = _uniswapV2Factory;

        weth = _uniswapV2Router.WETH();

        // Create a uniswap pair for this new token
        uniPair = _uniswapV2Factory.createPair(address(this), weth);

        // approve token transfer to cover all future transfereFrom calls
        _approve(address(this), address(_uniswapV2Router), type(uint256).max);

        isPair[uniPair] = true;

        isExcludedFromFee[address(this)] = true;

        isExcludedFromFee[_ownerArg] = true;

        isExcludedFromDailyVolume[_ownerArg] = true;

        isExcludedFromDailyVolume[uniPair] = true;

        isExcludedFromDailyVolume[address(this)] = true;
    }

    receive() external payable {
        // only receive from router
        require(msg.sender == address(uniRouter), "Invalid sender");
    }

    /**
     * @notice Transfers tokens to a recipient
     * @param recipient address to send the tokens to
     * @param amount  amount of tokens to send
     */
    function transfer(
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        _customTransfer(_msgSender(), recipient, amount);
        return true;
    }

    /**
     * @notice Transfers tokens from a sender to a recipient (requires approval)
     * @param sender address to send the tokens from
     * @param recipient address to send the tokens to
     * @param amount  amount of tokens to send
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 allowance = allowance(sender, _msgSender());
        require(amount <= allowance, "Transfer amount exceeds allowance");

        // overflow is checked above
        unchecked {
            // decrease allowance if not max approved
            if (allowance < type(uint256).max)
                _approve(sender, _msgSender(), allowance - amount, true);
        }

        _customTransfer(sender, recipient, amount);

        return true;
    }

    function _customTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        if (sender != uniPair) _liquify();

        if (
            !taxEnabled ||
            isExcludedFromFee[sender] ||
            isExcludedFromFee[recipient] ||
            (!isPair[recipient] && !isPair[sender]) ||
            inswap == 1
        ) {
            _transfer(sender, recipient, amount);
        } else {
            Tax memory tax = isPair[recipient] ? buyTax : sellTax;

            // buy
            uint256 marketingTax = (amount * tax.marketing) / TAX_BASE;
            uint256 ecosystemTax = (amount * tax.ecosystem) / TAX_BASE;
            uint256 liquidityTax = (amount * tax.liquidity) / TAX_BASE;

            if (ecosystemTax > 0)
                _transfer(sender, ecosystemHolder, ecosystemTax);
            if (marketingTax > 0)
                _transfer(sender, marketingHolder, marketingTax);

            _transfer(
                sender,
                recipient,
                amount - marketingTax - ecosystemTax - liquidityTax
            );

            if (liquidityTax > 0) {
                liquidityReserves += liquidityTax;
                _transfer(sender, address(this), liquidityTax);
            }
        }

        // loss of precision is wanted here
        volume[sender][block.timestamp / DAY] += amount;
        require(
            volume[sender][block.timestamp / DAY] <= maxDailyVolume ||
                isExcludedFromDailyVolume[sender],
            "GalaxyFox: max daily volume exceeded"
        );
    }

    /**
     * @notice Enable or disable taxes
     * @param taxEnabledArg true to enable tax, false to disable
     */
    function setTaxEnabled(bool taxEnabledArg) public onlyOwner {
        taxEnabled = taxEnabledArg;

        emit TaxEnabled(taxEnabledArg);
    }

    /**
     * @notice Sets the minimum amount of tokens that must be in the contract before liquifying
     * @param miniBeforeLiquifyArg  The minimum amount of tokens that must be in the contract before liquifying
     */
    function setMiniBeforeLiquify(
        uint256 miniBeforeLiquifyArg
    ) public onlyOwner {
        miniBeforeLiquify = miniBeforeLiquifyArg;

        emit MiniBeforeLiquifyChanged(miniBeforeLiquifyArg);
    }

    /**
     * @notice sets whether an address is excluded  from fees or not
     * @param account The address to exclude/include from fees
     * @param excluded  true to exclude, false to include
     */
    function setExcludedFromFee(
        address account,
        bool excluded
    ) public onlyOwner {
        isExcludedFromFee[account] = excluded;

        emit ExeededFromFee(account, excluded);
    }

    /**
     *  @notice declare if an address is an lp pair or not
     * @param pair address of the LP Pool
     * @param isPairArg  true if the address is a pair, false otherwise
     */
    function setPair(address pair, bool isPairArg) public onlyOwner {
        isPair[pair] = isPairArg;

        emit Pair(pair, isPairArg);
    }

    /**
     * @dev sets the ecosystem holder address
     * @param _ecosystemHolder The address of the ecosystem holder
     */
    function setEcosystemHolder(
        address payable _ecosystemHolder
    ) public onlyOwner {
        require(_ecosystemHolder != address(0), "GalaxyFox: zero address");
        ecosystemHolder = _ecosystemHolder;

        emit EcosystemHolder(ecosystemHolder, _ecosystemHolder);
    }

    /**
     * @dev Sets the marketing holder address
     * @param _marketingHolder The address of the marketing holder
     */
    function setMarketingHolder(
        address payable _marketingHolder
    ) public onlyOwner {
        require(_marketingHolder != address(0), "GalaxyFox: zero address");
        marketingHolder = _marketingHolder;

        emit MarketingHolder(marketingHolder, _marketingHolder);
    }

    /**
     * @dev Sets the liquidity holder address
     * @param _liquidityHolder The address of the liquidity holder
     */
    function setLiquidityHolder(
        address payable _liquidityHolder
    ) public onlyOwner {
        require(_liquidityHolder != address(0), "GalaxyFox: zero address");
        liquidityHolder = _liquidityHolder;
        emit LiquidityHolder(liquidityHolder, _liquidityHolder);
    }

    /**
     * @dev Changes the tax on buys
     * @param _liquidity liquidity tax in basis points
     * @param _marketing marketing tax in basis points
     * @param _ecosystem ecosystem tax in basis points
     */
    function setSellTax(
        uint16 _liquidity,
        uint16 _marketing,
        uint16 _ecosystem
    ) public onlyOwner {
        require(
            _liquidity + _marketing + _ecosystem <= MAX_TAX,
            "GalaxyFox: tax too high"
        );
        sellTax = Tax(_liquidity, _marketing, _ecosystem);

        emit SellTaxChanged(_liquidity, _marketing, _ecosystem);
    }

    /**
     * @dev Changes the tax on sells
     * @param _liquidity liquidity tax in basis points
     * @param _marketing marketing tax in basis points
     * @param _ecosystem ecosystem tax in basis points
     */
    function setBuyTax(
        uint16 _liquidity,
        uint16 _marketing,
        uint16 _ecosystem
    ) public onlyOwner {
        require(
            _liquidity + _marketing + _ecosystem <= MAX_TAX,
            "GalaxyFox: tax too high"
        );
        buyTax = Tax(_liquidity, _marketing, _ecosystem);

        emit BuyTaxChanged(_liquidity, _marketing, _ecosystem);
    }

    /**
     * @notice Burns tokens from the caller
     * @param amount amount of tokens to burn
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Recovers lost tokens or ETH, doesn't include the liquidity reserves
     * @param tokenAddress address of the token to recover
     */
    function recoverLostTokens(address tokenAddress) public onlyOwner {
        if (tokenAddress != address(this)) {
            uint256 tokenAmount = tokenAddress != address(0)
                ? IERC20(tokenAddress).balanceOf(address(this))
                : address(this).balance;

            if (tokenAmount > 0 && tokenAddress != address(0)) {
                IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
            } else if (tokenAmount > 0) {
                (bool success, ) = payable(msg.sender).call{value: tokenAmount}(
                    ""
                );
                require(success, "Failed to send Ether");
            }
        } else {
            uint256 tokenAmount = balanceOf(address(this)) - liquidityReserves;
            _transfer(address(this), msg.sender, tokenAmount);
        }
    }

    /**
     * @notice Sets whether an address is excluded from maxDailyVolume or not
     * @param account account to be included/excluded from maxDailyVolume
     * @param excluded true to exclude, false to include
     */
    function setExludedFromDailyVolume(
        address account,
        bool excluded
    ) public onlyOwner {
        isExcludedFromDailyVolume[account] = excluded;

        emit ExcludedFromDailyVolume(account, excluded);
    }

    /**
     * @notice Sets the max daily volume max is 0.1% of the total supply
     * @param maxDailyVolumeArg The new max daily volume
     */
    function setMaxDailyVolume(uint256 maxDailyVolumeArg) public onlyOwner {
        // require that the max daily volume is at least 0.1% of the total supply
        require(
            maxDailyVolumeArg >= totalSupply() / 1000,
            "GalaxyFox: max daily volume too low"
        );
        maxDailyVolume = maxDailyVolumeArg;

        emit MaxDailyVolumeChanged(maxDailyVolumeArg);
    }

    // using uint256 is cheaper than using bool
    // because there will be no extra work to read it
    // sunce when used we always return it back to 0
    // it will trigger a refund
    uint256 inswap = 0;

    /**
     * @notice creates lp from the liquidity reserves
     */
    function liquify() external onlyOwner {
        _liquify();
    }

    function _liquify() private {
        if (inswap == 1) return;
        inswap = 1;
        if (liquidityReserves > miniBeforeLiquify) {
            uint256 half = liquidityReserves / 2;
            // avoids precision loss
            uint256 otherHalf = liquidityReserves - half;

            _swapTokensForEth(half);

            uint256 newBalance = address(this).balance;

            _addLiquidity(otherHalf, newBalance);

            liquidityReserves = 0;
        }
        inswap = 0;
    }

    function _swapTokensForEth(uint256 tokenAmount) internal {
        // generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = weth;

        // make the swap
        uniRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this),
            block.timestamp
        );
    }

    function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) internal {
        uniRouter.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0,
            0,
            liquidityHolder,
            block.timestamp
        );
    }
}
