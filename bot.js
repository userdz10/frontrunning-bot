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
  "wss://burned-wiser-meme.bsc-testnet.discover.quiknode.pro/c7145822c49d6cbaa84a79e6962f7968293ffba8/"
);

var wss =
  "wss://burned-wiser-meme.bsc-testnet.discover.quiknode.pro/c7145822c49d6cbaa84a79e6962f7968293ffba8/";

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
    const amounts = router(account).getAmountsOut(amountIn, [wbnbAddr,tokenAddr]);
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

}
const init = async () => {
  var wsProvider = new ethers.providers.WebSocketProvider(wss);

  const interface = new ethers.utils.Interface([
    "function swapExactEthForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)",
    "function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] calldata path,address to,uint deadline)",
  ]);

  wsProvider.on("pending", (tx) => {
    wsProvider.getTransaction(tx).then(async function (transaction) {
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

        if (value > 10) {
          console.log(`value: ${value}`);
          console.log(`gasPrice: ${gasPrice}`);
          console.log(`gasLimit: ${gasLimit}`);
          console.log(`from ${transaction.from}`);

          let result = [];

          //decode the data of the function used to swap the token

          try {
            result = interface.decodeFunctionData(
              "swapExactETHForTokens",
              transaction.data
            );
          } catch (error) {
            try {
              result = interface.decodeFunctionData(
                "swapExactETHForTokensSupportingFeeOnTransferTokens",
                transaction.data
              );
            } catch (error) {
              try {
                result = interface.decodeFunctionData(
                  "swapETHForExactTokens",
                  transaction.data
                );
              } catch (error) {
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
            console.log(`result: ${result}`);
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
