const { expect } = require("chai");
//const SHA256 = require('crypto-js/sha256')
const testdata = require("../data/jsonTestData.json");
const { ethers } = require("hardhat");

describe("LNBridge", function() {
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

        it("Get the three outputs", async function () {
            let tx = await LNBridge.readThreeOutputs(testdata.new_CT_P_unlocked);
            const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
           })

    });

    

})