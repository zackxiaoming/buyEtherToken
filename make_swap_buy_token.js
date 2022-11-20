// How to run
// 1. install dependencies: npm install ethers
// 2. run: node example.js

var this_priv_key = process.argv[2];
var this_contract = process.argv[3];
var this_amount = process.argv[4];

//console.log("Private key " + this_priv_key);
//console.log("Contract " + this_contract);
//console.log("Amount " + this_amount);


const { ethers } = require("ethers");

const RPC_ENDPOINT = "https://bsc-dataseed.binance.org/";
const PRIVATE_KEY = this_priv_key;

const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; // router address of pancakeswap
const BUY_TOKEN = this_contract // what token to buy
const BUY_AMOUNT = this_amount // how many to buy Token OR BNB
const slippage = 0.025 // slippage 40%

const provider = new ethers.providers.JsonRpcProvider(RPC_ENDPOINT);

const buyTokenWithTokenAmount = async (tokenAmount, tokenAddress, account, routerAddress) => {
    const router = new ethers.Contract(
        routerAddress,
        [
            "function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)",
            "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
            "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        ],
        account
    );

    const tokenIn = WBNB; // WBNB
    const tokenOut = tokenAddress;

    const amountOutMin = ethers.utils.parseUnits(tokenAmount, await getDecimal(tokenAddress));
    const amounts = await router.getAmountsIn(amountOutMin.toString(), [tokenIn, tokenOut]);
    const amountIn = amounts[0].add(amounts[0].div(1 / slippage))


    await buyTokenWithBNB(tokenIn, amountIn, tokenOut, amountOutMin, account, router);
}

const buyTokenWithBNBAmount = async (bnbAmount, tokenAddress, account, routerAddress) => {
    const router = new ethers.Contract(
        routerAddress,
        [
            "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
            "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
        ],
        account
    );

    const tokenIn = WBNB; // WBNB
    const tokenOut = tokenAddress;

    const amountIn = ethers.utils.parseEther(bnbAmount);
    const amounts = await router.getAmountsOut(amountIn.toString(), [tokenIn, tokenOut]);
    const amountOutMin = amounts[1].sub(amounts[1].div(1 / slippage));

    await buyTokenWithBNB(tokenIn, amountIn, tokenOut, amountOutMin, account, router);
}

const buyTokenWithBNB = async (tokenIn, tokenInAmount, tokenOut, tokenOutAmount, account, router) => {
    const tx = await router.swapExactETHForTokens(
        tokenOutAmount.toString(),
        [tokenIn, tokenOut],
        account.address,
        Date.now() + 1000 * 60 * 10, // this txn will be reverted after 10 minutes if not successed
        {
            gasLimit: "300000",
            gasPrice: await provider.getGasPrice(),
            value: tokenInAmount.toString(),
            nonce: null,
        }
    );

    const receipt = await tx.wait();
   // console.log("Transaction Has", receipt.transactionHash)

    const PANCAKE_SWAP_TOPIC = ethers.utils.id("Swap(address,uint256,uint256,uint256,uint256,address)");
    const PANCAKE_SWAP_EVENT = "event Swap (address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)";
    const swapLogs = receipt.logs.filter(log => log.topics[0] === PANCAKE_SWAP_TOPIC);
    const lastSwapEvent = swapLogs.slice(-1)[0];
    const swapInterface = new ethers.utils.Interface([PANCAKE_SWAP_EVENT]);
    const parsed = swapInterface.parseLog(lastSwapEvent);
    const sendTokens = parsed.args.amount0In.isZero() ?  parsed.args.amount1In : parsed.args.amount0In;
    const receivedTokens = parsed.args.amount0Out.isZero() ?  parsed.args.amount1Out : parsed.args.amount0Out;
    //console.log("BNB Amount: ", ethers.utils.formatEther(sendTokens).toString(),
    //   "; Received Amount: ", ethers.utils.formatUnits(receivedTokens, await getDecimal(tokenOut)).toString())

   console.log(receipt.transactionHash + "###" + ethers.utils.formatEther(sendTokens).toString() + "###"
        + ethers.utils.formatUnits(receivedTokens, await getDecimal(tokenOut)).toString());


};

const getDecimal = async (tokenAddress) => {
    const contract = new ethers.Contract(
        tokenAddress,
        [
            "function decimals() view returns (uint256)"
        ]
        ,provider
    );
    try {
        return await contract.decimals();
    } catch (e) {
        return 18;
    }
}


(async () => {
    const account = new ethers.Wallet(PRIVATE_KEY, provider);
    //console.log("public key: ", account.address);

    await buyTokenWithBNBAmount(BUY_AMOUNT, BUY_TOKEN, account, PANCAKE_ROUTER);
    //await buyTokenWithTokenAmount(BUY_AMOUNT, BUY_TOKEN, account, PANCAKE_ROUTER);
})()
