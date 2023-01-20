const express = require("express");
const http = require("http");
const Web3 = require("web3");
const ethers = require("ethers");
const { setTimeout } = require("timers/promises");

const app = express();
const port = process.env.PORT || 3000;

const web3 = new Web3(
  "wss://burned-wiser-meme.bsc-testnet.discover.quiknode.pro/c7145822c49d6cbaa84a79e6962f7968293ffba8/"
);

var wss = 
   "wss://burned-wiser-meme.bsc-testnet.discover.quiknode.pro/c7145822c49d6cbaa84a79e6962f7968293ffba8/";

const init = async function () {
  var wsProvider = new ethers.providers.WebSocketProvider(wss);
  

  const interface = new ethers.utils.Interface([
    "function swapExactEthForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)",
    "function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] calldata path,address to,uint deadline)",
  ]);

  wsProvider.on("pending", (tx) => {
    wsProvider.getTransaction(tx).then(async function (transaction) {
      //listen on pending transactions on pancakeswap factory

      if (
        transaction &&
        transaction.to === "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" //change address to testnet
      ) {
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
    setTimeout(init,3000);
  });

};

init();

//create server
const server = http.createServer(app);

//launch server
server.listen(port, () => {
  console.log(`listening on port ${port}`)  
})
