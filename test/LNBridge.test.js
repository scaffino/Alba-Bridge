const { expect } = require("chai");
//const SHA256 = require('crypto-js/sha256')
const testdata = require("../data/jsonTestData.json");
const { ethers } = require("hardhat");
const EthCrypto = require('eth-crypto');

describe("LNBridge", function(account) {
    let LNBridgeContractFactory;
    let LNBridge;

    beforeEach(async () => {
        LNBridgeContractFactory = await ethers.getContractFactory("LNBridge");
        LNBridge = await LNBridgeContractFactory.deploy();
        await LNBridge.deployed();

    });

    describe("Test LNBridge", function () {

        it("Setup", async function () {
         let tx = await LNBridge.setup(testdata.fundingTxId, testdata.pkProver, testdata.pkVerifier, testdata.index, testdata.timestamp);
         const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        }) 

    });

})