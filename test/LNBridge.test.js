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

        it("Verify function getOutputsData correctly extracts output data", async function () {
            const returnedValues = await LNBridge.getOutputsData(testdata.new_CT_P_unlocked);
            const htlc = returnedValues[0];
            const p2pkh = returnedValues[1];
            const opreturn = returnedValues[2];
            expect(htlc.value).to.equal(18085); 
            expect(htlc.pk1).to.equal("0x13f17fa639f9cf2108e9dc9a14df8a9d5b9f1df1a91efe3d2830e08edd71e182");
            expect(htlc.rev_secret).to.equal("0x6016ad000e6033da466b4a085361bdb66bd6ce199198f1f4b46bf5317e86f95c"); 
            expect(htlc.pk2).to.equal("0x40602913fbabf074554d1db1c9a108978167734826e36bddfb8830852de2137f"); 
            expect(p2pkh.value).to.equal(18085);
            expect(p2pkh.pkhash).to.equal("0xc0d90b19a448b569bd0cc77b3da2dd5bb41d2c9f"); 
            expect(opreturn.value).to.equal(0); 
            expect(opreturn.data).to.equal("0xf0f0427c47433d9d440fc105e7d61d1520b5c889ac6405596362fdce95658a35"); 
        })

        it("Revert if Commitment Tx has more than one input", async function () {
             await expect(LNBridge.getInputsData(testdata.rawFundingTransaction)).to.be.revertedWith("Tx has too many inputs (>1)");
        })

        it("Verify function getInputsData correctly extracts number of inputs, txid, and index", async function () {
            const returnedValues = await LNBridge.getInputsData(testdata.new_CT_P_locked);
            expect(returnedValues.number_of_inputs).to.equal(1); // number of inputs
            expect(returnedValues.txid).to.equal("0xf6617e14ee663db4eed1cc0367c2d770e4eb95e56b97d7785b13e5b57dcf9674"); // txid
            expect(returnedValues.inputIndex).to.equal("0x00000000"); // index of the input (4 bytes)
        })

        it("Verify timelock is correctly extracted", async function () {
            const timelock = await LNBridge.getTimelock(testdata.new_CT_P_locked);
            expect(timelock).to.equal("0x16997891");
        })

        it("Verify signature", async function () {
            let tx = await LNBridge.verifySignature(testdata.pkProverUnprefixedUncompressed, testdata.TxUnsigned, testdata.v, testdata.r, testdata.s);
            const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        })



    });

    

})