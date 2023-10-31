const { expect } = require("chai");
//const SHA256 = require('crypto-js/sha256')
const testdata = require("../data/jsonTestData.json");
const { ethers } = require("hardhat");
const EthCrypto = require('eth-crypto');

describe("LNBridge", function(account) {
    let LNBridgeContractFactory;
    let LNBridge;

    beforeEach(async () => {

        // create identities for Prover and Verifier
        const [prover, verifier] = await ethers.getSigners(); // returns an array of addresses, I keep only the first two
        //const proverBalance = await ethers.provider.getBalance(prover.address); // 10000000000000000000000
        //const verifierBalance = await ethers.provider.getBalance(verifier.address); // 10000000000000000000000

        LNBridgeContractFactory = await ethers.getContractFactory("LNBridge");
        LNBridge = await LNBridgeContractFactory.deploy(prover.address, verifier.address);
        await LNBridge.deployed();

        // Prover locks coins
        await prover.sendTransaction({
            to: LNBridge.address,
            value: ethers.utils.parseEther("0.5"), // Sends 0.5 ether
        });

        // Verifier locks coins
        await verifier.sendTransaction({
            to: LNBridge.address,
            value: ethers.utils.parseEther("0.5"), // Sends 0.5 ether
        }); 

    });

    describe("Call Setup", function () {

        it("Populate Setup", async function () {
            let tx = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);
            const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        }) 
    }); 

    describe("Call Receive", async () => {

        it("Should emit event lockCoinsEvent(address addr, uint amount) when coins are successfully deposited", async function () {

            const [prover, verifier] = await ethers.getSigners();

            const initialBalance = await ethers.provider.getBalance(LNBridge.address)

            // Send Ether to the contract using a simple Ether transfer
            const amountToSend = ethers.utils.parseEther("0.1")
            await prover.sendTransaction({ to: LNBridge.address, value: amountToSend })
            await verifier.sendTransaction({ to: LNBridge.address, value: amountToSend })

            // Check if the contract's balance increased by the sent amount
            const finalBalance = await ethers.provider.getBalance(LNBridge.address)
            const totalAmountSent = ethers.utils.parseEther("0.2")
            expect(finalBalance).to.equal(initialBalance.add(totalAmountSent))

            // Check if the Log event was emitted with the correct data
            const logs = await LNBridge.queryFilter("lockCoinsEvent")
            expect(logs.length).to.equal(4)
            // I pick the third event, as the first two are emitted in the BeforeEach at the beginning
            const logP = logs[2]
            expect(logP.args.label).to.equal("Coins locked by P!")
            expect(logP.args.addr).to.equal(prover.address)
            expect(logP.args.amount).to.equal(ethers.utils.parseEther("0.1"))
            // I pick the fourth event
            const logV = logs[3]
            expect(logV.args.label).to.equal("Coins locked by V!")
            expect(logV.args.addr).to.equal(verifier.address)
            expect(logV.args.amount).to.equal(ethers.utils.parseEther("0.1"))

        })

        it("Should emit event Failed to lock coins: msg.sender is not P nor V", async function () {

            const [prover, verifier, other] = await ethers.getSigners();

            const amountToSend = ethers.utils.parseEther("0.1")
            await other.sendTransaction({ to: LNBridge.address, value: amountToSend })

            // Check if the Log event was emitted with the correct data
            const logs = await LNBridge.queryFilter("stateEvent")
            expect(logs.length).to.equal(1)
            // I pick the third event, as the first two are emitted in the BeforeEach at the beginning
            const logP = logs[0]
            expect(logP.args.label).to.equal("Failed to lock coins: msg.sender is not P nor V")
            expect(logP.args.stateStatus).to.equal(false)
        })
    });

    describe("Test SubmitProof", function () {

        it("Is Proof valid?", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let txSubmitProof = await LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked);

        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Proof successfully verified: state.validProofSubmitted = true", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Proof successfully verified: state.validProofSubmitted = true", true);
        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Proof submitted too late: state.validProofSubmitted = false", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.smallTimelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Proof submitted too late: state.validProofSubmitted = false", false);
        })

        it("Revert if P's transaction is locked", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Commitment transaction of P is locked");
        })
        
        it("Revert if V's transaction is locked", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Locked)).to.be.revertedWith("Commitment transaction of V is locked");
        })

        it("Revert if P's commitment transaction does not hardcode V's revocation key", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongRevSecret, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("P's commitment transaction does not hardcode V's revocation key");
        })

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V (wrong P2PKH of P)", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongAmountP2PKH, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Amount mismatch between p2pkh of P and lightning HTLC of V");

        }) 

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V (wrong HTLC of V)", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked_WrongAmountHTLC)).to.be.revertedWith("Amount mismatch between p2pkh of P and lightning HTLC of V");

        }) 

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongAmountHTLC, testdata.CT_V_withPsig_Unlocked_WrongAmountP2PKH)).to.be.revertedWith("Amount mismatch between p2pkh of V and lightning HTLC of P");

        }) 

        it("Revert if the p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongP2pkh, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("The p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one");
        }) 

        it("Revert if the p2pkh in V's unlocked commitment transaction does not correspond to Prover's one", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked_WrongP2pkh)).to.be.revertedWith("The p2pkh in V's unlocked commitment transaction does not correspond to Prover's one");
        }) 

        it("Revert if P's commitment transaction does not spend the funding transaction", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_WrongFund, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("P's commitment transaction does not spend the funding transaction");
        })

        it("Revert if V's commitment transaction does not spend the funding transaction", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_WrongFund)).to.be.revertedWith("V's commitment transaction does not spend the funding transaction");
        })

        it("Revert if verification of signature of P failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withWrongPsig_Unlocked)).to.be.revertedWith("Invalid signature of P over commitment transaction of V");

        }) 

        it("Revert if verification of signature of V failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.submitProof(testdata.CT_P_withWrongVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Invalid signature of V over commitment transaction of P");

        })  

    }); 

    describe("Test Dispute", function () {

        it("Call Dispute", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let tx = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);
        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Dispute successfully opened", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Dispute successfully opened: state.disputeOpened = true", true);
        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Dispute not opened", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.smallTimelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Dispute not opened: state.disputeOpened = false", false);
        })

        it("Check timelocked TxCP has timelock larger than Timelock T + Relative Timelock T_rel (false)", async function () {
            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.dispute(testdata.CT_P_withVsig_LockedOct29, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Commitment transaction of P is unlocked or timelock of the timelocked Tx is smaller or equal than Timelock T + Relative Timelock T_rel"); // tests with timelock run in October/Novemeber 2023. Testdata with timelock must be changed is tests are run later on. 
        }) 
        
        it("Check timelocked TxCP has timelock larger than Timelock T + Relative Timelock T_rel (true)", async function () {
            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let tx = await LNBridge.dispute(testdata.CT_P_withVsig_LockedDec24, testdata.CT_V_withPsig_Unlocked);
        }) 

        it("Revert if verification of signature of P failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withWrongPsig_Unlocked)).to.be.revertedWith("Invalid signature of P over commitment transaction of V");

        }) 

        it("Revert if verification of signature of V failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            await expect(LNBridge.dispute(testdata.CT_P_withWrongVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Invalid signature of V over commitment transaction of P");
        }) 

    }); 

    describe("Test ResolveValidDispute", function () {

        it("Call resolveValidDispute", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            let tx = await LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Unlocked);
        }) 

        it("Emit event: Resolve Valid Dispute successfully executed: state.disputeClosedP = true", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Resolve Valid Dispute successfully executed: state.disputeClosedP = true", true);
        }) 

        it("Emit event: Resolve Valid Dispute failed: state.disputeClosedP = false", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            //let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Resolve Valid Dispute failed: state.disputeClosedP = false", false);
        }) 

        it("Revert if transaction submitted is locked", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Locked)).to.be.revertedWith("Commitment transaction of P is locked");
        })

        it("Revert if verification of signature of V failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveValidDispute(testdata.CT_P_withWrongVsig_Unlocked)).to.be.revertedWith("Invalid signature of V over commitment transaction of P");
        })


    });

    describe("Test ResolveInvalidDispute", function () {

        it("Call resolveInvalidDispute", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            let tx = await LNBridge.resolveInvalidDispute(testdata.revSecretP);
        }) 

        it("Emit event: Resolve Invalid Dispute successfully executed: state.disputeClosedV = true", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveInvalidDispute(testdata.revSecretP)).to.emit(LNBridge, "stateEvent").withArgs("Resolve Invalid Dispute successfully executed: state.disputeClosedV = true", true);
        }) 

        it("Emit event: Resolve Invalid Dispute failed: state.disputeClosedV = false", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.balanceDistributionConstant);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveInvalidDispute(testdata.WrongRevSecretP)).to.emit(LNBridge, "stateEvent").withArgs("Resolve Invalid Dispute failed: state.disputeClosedV = false", false);
        }) 

    });   

})