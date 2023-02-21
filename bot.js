const express = require("express");
const http = require("http");
const Web3 = require("web3");
const ethers = require("ethers");
require("dotenv").config();
const swapabi = require("./abis/swapabi.json");
const abi = require("./abis/abi.json");
const routerAbi = require("./abis/router.json");
const erc20Abi = require("./abis/erc20.json");
const { setTimeout } = require("timers/promises");

const app = express();
const port = process.env.PORT || 3000;

const routerAddr = process.env.PANCAKE_SWAP_ROUTER;
const wbnbAddr = process.env.WBNB_TOKEN;

const web3 = new Web3(
  "wss://tiniest-dawn-fire.bsc.discover.quiknode.pro/16f04cf44b8d071a7fc54f9bde78cde8093fa12e/"
);

var wss =
  "wss://tiniest-dawn-fire.bsc.discover.quiknode.pro/16f04cf44b8d071a7fc54f9bde78cde8093fa12e/";

  //function to calculate gas prices
const calculateGasPrice = () => {
  if (action == "buy") {
    return ethers.utils.formatUnits(amount.add(1), "gwei");
  } else {
    return ethers.utils.formatUnits(amount.sub(1), "gwei");
  }
};

const router = (account) => {
   return new ethers.Contract(routerAddr, routerAbi, account )
}

const erc20Token = (tokenAddr,account) => {
   return new ethers.Contract(tokenAddr,erc20Abi, account);
}

const buyToken = async(account, tokenAddr, gasPrice, gasLimit) => {
  //amount of tokens to buy, here 0.1 BNB
   const buyAmount =  0.1;
  //slippage is difference b/w expected price and the actual trade price
   const slippage = 0;
  //amount of token we will receive
  const amountOutMin = 0;
  const amountIn = ethers.utils.parseUnits(buyAmount.toString(),'ether');

  if(parseInt(slippage !== 0)){
    const amounts = await router(account).getAmountsOut(amountIn, [wbnbAddr,tokenAddr]);
    amountOutMin = amounts[1].sub(amounts[1].div(100).mul(`${slippage}`));
  }
  //sending buy order to router
  const tx = await router(account).swapExactETHForTokensSupportingFeeOnTransferTokens (
    amountOutMin,
    [wbnbAddr, tokenAddr],
    account.address,
    (Date.now() + 1000 * 60 * 10),
    {
      'value': amountIn,
      'gasLimit': gasLimit,
      'gasPrice': gasPrice
    }

  );
// tx receipt
  const receipt = await tx.wait();

  if (receipt && receipt.blockNumber && receipt.status === 1){ //0 failed | 1 success
    console.log(`Transaction https://bscscan.com/tx/${receipt.transactionHash} mined status success`);
  }
  else if (receipt && receipt.blockNumber && receipt.status === 0){ 
    console.log(`Transaction https://bscscan.com/tx/${receipt.transactionHash} mined status failed`);
  }
  else {
    console.log(`Transaction https://bscscan.com/tx/${receipt.transactionHash} not mined `);
  }
}

const sellToken = async(account,tokenAddr,gasPrice,gasLimit,value = 99) =>{

   const sellContract = new ethers.Contract(account, tokenAddr, swapabi);
   const accountAddr = account.address;
   const tokenBalance = await erc20Token(accountAddr,tokenAddr).balanceOf(accountAddr);

   let amountOutMin = 0;
   const amountIn = tokenBalance.mul(value).div(100);

   const amounts = await router(account).getAmountsOut(amountIn, [tokenAddr,wbnbAddr]);

   if (parseInt(slippage) !== 0) {
    amountOutMin = amounts[1].sub(amounts[1].mul(`${slippage}`.div(100)));
   } else {
    amountOutMin = amounts[1];
   }
   //approve the selling contract on PancakeSwapRouter
   const approve = await sellContract.approve(routerAddr,amountIn);

   const approvalTxReceipt = await approve.wait();

   if( approvalTxReceipt && approvalTxReceipt.blockNumber && approvalTxReceipt.status === 1){
    console.log(`Transaction https://bscscan.com/tx/${approvalTxReceipt.transactionHash} mined status success`);

    const swapTx = router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      amountIn,amountOutMin,
      [tokenAddr,wbnbAddr],
      accountAddr,
      (Date.now() + 1000 * 60 * 10),
      {
        'gasLimit': gasLimit,
        'gasPrice': gasPrice
      }
    );

    const swapTxReceipt =  await swapTx.wait();

    if( swapTxReceipt && swapTxReceipt.blockNumber && swapTxReceipt.status === 1){
      console.log(`Transaction https://bscscan.com/tx/${swapTxReceipt.transactionHash} mined status success`);
   }
   else if(swapTxReceipt && swapTxReceipt.blockNumber && swapTxReceipt.status === 0){
    console.log(`Transaction https://bscscan.com/tx/${swapTxReceipt.transactionHash} mined status failed`);
   }
   else{
    console.log(`Transaction https://bscscan.com/tx/${swapTxReceipt.transactionHash} not mined `);
   }
 }
}


const init = async () => {

  var wsProvider = new ethers.providers.WebSocketProvider(wss);
  //use wallet code here to get wallet instance 
  //use account code to connect wallet to connect to wsProvider

  const interface = new ethers.utils.Interface([
    "function swapExactEthForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)",
    "function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] calldata path,address to,uint deadline)",
  ]);

  wsProvider.on("pending", async(tx) => {
    wsProvider.getTransaction(tx).await(async function (transaction) {
      //listen on pending transactions on pancakeswap factory

      if (transaction && transaction.to === routerAddr) {
        const value = ethers.utils.formatEther(transaction.value.toString());

        const gasPrice = ethers.utils.formatEther(
          transaction.gasPrice.toNumber()
        );

        const gasLimit = ethers.utils.formatEther(
          transaction.gasLimit.toString()
        );

        // only show transactions greater than 30 bnb

        if (value > 1) {
          console.log('----------------------------')
          console.log(`value: ${value}`);
          console.log(`gasPrice: ${gasPrice}`);
          console.log(`gasLimit: ${gasLimit}`);
          console.log(`from ${transaction.from}\n`);

          let result = [];

          //decode the data of the function used to swap the token

          try {
            console.log("first try \n");
            result = interface.decodeFunctionData(
              "swapExactETHForTokens",
              transaction.data
            );
          } catch (error) {
            console.log("first catch \n")
            try {
              console.log("second try \n");
              result = interface.decodeFunctionData(
                "swapExactETHForTokensSupportingFeeOnTransferTokens",
                transaction.data
              );
            } catch (error) {
              console.log("second catch \n");
              try {
                console.log("third try \n");
                result = interface.decodeFunctionData(
                  "swapETHForExactTokens",
                  transaction.data
                );
              } catch (error) {
                console.log("third try \n");
                console.log(`final error: ${transaction}`);
              }
            }
          }
          if (result.length > 0) {
            let tokenAddr = "";
            if (result[1].length > 0) {
              tokenAddr = result[1][1];
            }
            console.log(`token addresses: ${tokenAddr}`);
            //caculating gas prices for buying and selling
            const buyGasPrice = calculateGasPrice("buy", transaction.gasPrice);
            const sellGasPrice = calculateGasPrice("sell",transaction.gasPrice);

            //buying tokens
            console.log('Time to buy bitch, hold your pants');
            await buyToken(account,tokenAddr, transaction.gasLimit, buyGasPrice);
          }
        }
      }
    });
  });

  wsProvider._websocket.on("error", async (ep) => {
    console.log(`unable to connect to ${ep.subdomain} retrying in 3s...`);
    setTimeout(init, 3000);
  });

  wsProvider._websocket.on("close", async (code) => {
    console.log(
      `connection lost with code ${code}! Attempting reconnect in 3s...`
    );

    wsProvider._websocket.terminate();
    setTimeout(init, 3000);
  });
};

init();

//create server
const server = http.createServer(app);

//launch server
server.listen(port, () => {
  console.log(`listening on port ${port}`);
});
