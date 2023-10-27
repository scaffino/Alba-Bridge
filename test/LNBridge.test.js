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
            let tx = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);
            const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        }) 
    });

    describe("Test SubmitProof", function () {

        it("Is Proof valid?", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            let txSubmitProof = await LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked);

        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Proof successfully verified: state.validProofSubmitted = true", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Proof successfully verified: state.validProofSubmitted = true", true);
        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Proof submitted too late: state.validProofSubmitted = false", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.smallTimelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Proof submitted too late: state.validProofSubmitted = false", false);
        })

        it("Revert if P's transaction is locked", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Commitment transaction of P is locked");
        })
        
        it("Revert if V's transaction is locked", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Locked)).to.be.revertedWith("Commitment transaction of V is locked");
        })

        it("Revert if P's commitment transaction does not hardcode V's revocation key", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongRevSecret, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("P's commitment transaction does not hardcode V's revocation key");
        })

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V (wrong P2PKH of P)", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongAmountP2PKH, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Amount mismatch between p2pkh of P and lightning HTLC of V");

        }) 

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V (wrong HTLC of V)", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked_WrongAmountHTLC)).to.be.revertedWith("Amount mismatch between p2pkh of P and lightning HTLC of V");

        }) 

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongAmountHTLC, testdata.CT_V_withPsig_Unlocked_WrongAmountP2PKH)).to.be.revertedWith("Amount mismatch between p2pkh of V and lightning HTLC of P");

        }) 

        it("Revert if the p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongP2pkh, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("The p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one");
        }) 

        it("Revert if the p2pkh in V's unlocked commitment transaction does not correspond to Prover's one", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked_WrongP2pkh)).to.be.revertedWith("The p2pkh in V's unlocked commitment transaction does not correspond to Prover's one");
        }) 

        it("Revert if P's commitment transaction does not spend the funding transaction", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_WrongFund, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("P's commitment transaction does not spend the funding transaction");
        })

        it("Revert if V's commitment transaction does not spend the funding transaction", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_WrongFund)).to.be.revertedWith("V's commitment transaction does not spend the funding transaction");
        })

        it("Revert if verification of signature of P failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withWrongPsig_Unlocked)).to.be.revertedWith("Invalid signature of P over commitment transaction of V");

        }) 

        it("Revert if verification of signature of V failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withWrongVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Invalid signature of V over commitment transaction of P");

        }) 

    });

    /* describe("Test Dispute", function () {

        it("Call Dispute", async function () {
            let tx = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_P_withVsig_Unlocked);
            const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        }) 
    }); */

})