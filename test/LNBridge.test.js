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

    describe("Call Setup", function () {

        it("Populate Setup", async function () {
            let tx = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed);
            const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        }) 
    });

    describe("Test SubmitProof", function () {

        it("Is Proof valid?", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed);

            let txSubmitProof = await LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked);

        }) 

        it("Revert if P's transaction is locked", async function () {

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Commitment transaction of P is locked");
        })
        
        it("Revert if V's transaction is locked", async function () {

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Locked)).to.be.revertedWith("Commitment transaction of V is locked");
        })

        it("Revert if P's commitment transaction does not hardcode V's revocation key", async function () {

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongRevSecret, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("P's commitment transaction does not hardcode V's revocation key");
        })

        /* it("Revert if the pk in P's unlocked commitment transaction (p2pkh output) is not Prover's one", async function () {

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Locked_WrongP2pkh, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("The pk in P's unlocked commitment transaction (p2pkh output) is not Prover's one");
        })  */

    });

})