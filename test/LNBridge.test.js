const { expect } = require("chai");
//const SHA256 = require('crypto-js/sha256')
const testdata = require("../data/jsonTestData.json");
const { ethers } = require("hardhat");
const EthCrypto = require('eth-crypto');
const { sha256 } = require("ethers/lib/utils");

describe("LNBridge", function(account) {
    let LNBridgeContractFactory;
    let LNBridge;

    beforeEach(async () => {

        // create identities for Prover and Verifier
        // const [prover, verifier] = await ethers.getSigners(); // returns an array of addresses, I keep only the first two

        //const proverBalance = await ethers.provider.getBalance(prover.address); // 10000000000000000000000
        //const verifierBalance = await ethers.provider.getBalance(verifier.address); // 10000000000000000000000

        //create identity P
        const entropyP = Buffer.from('ciaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociao', 'utf-8');
        const identityP = EthCrypto.createIdentity(entropyP); //create identity
        const publicKeyP = EthCrypto.publicKeyByPrivateKey(identityP.privateKey);
        const addressP = EthCrypto.publicKey.toAddress(publicKeyP);
        //create identity V
        const entropyV = Buffer.from('ciaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaohallo', 'utf-8');
        const identityV = EthCrypto.createIdentity(entropyV); //create identity
        const publicKeyV = EthCrypto.publicKeyByPrivateKey(identityV.privateKey);
        const addressV = EthCrypto.publicKey.toAddress(publicKeyV); 


        LNBridgeContractFactory = await ethers.getContractFactory("LNBridge");
        LNBridge = await LNBridgeContractFactory.deploy(addressP, addressV);
        await LNBridge.deployed();

        const [prover, verifier] = await ethers.getSigners();

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

    describe("Test Setup", function () {

        it("Populate Setup", async function () {

            //recall identity P
            const entropyP = Buffer.from('ciaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociao', 'utf-8');
            const identityP = EthCrypto.createIdentity(entropyP); //create identity
            const publicKeyP = EthCrypto.publicKeyByPrivateKey(identityP.privateKey);
            const addressP = EthCrypto.publicKey.toAddress(publicKeyP);
            //recall identity V
            const entropyV = Buffer.from('ciaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaociaohallo', 'utf-8');
            const identityV = EthCrypto.createIdentity(entropyV); //create identity
            const publicKeyV = EthCrypto.publicKeyByPrivateKey(identityV.privateKey);
            const addressV = EthCrypto.publicKey.toAddress(publicKeyV); 

            const digest = testdata.setupMessageDigest;
            const signatureP = EthCrypto.sign(identityP.privateKey, digest);
            const signatureV = EthCrypto.sign(identityV.privateKey, digest);

            let tx = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, signatureP, signatureV);
            const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
        }) 

        
        it("Revert if signature of P over the setup data is invalid", async function () {

            await expect(LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigPWrong, testdata.setupSigV)).to.be.revertedWith("Invalid signature of P over the setup data");

        }) 

        it("Revert if signature of V over the setup data is invalid", async function () {

            await expect(LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigVWrong)).to.be.revertedWith("Invalid signature of V over the setup data");

        })  
        
    }); 

    describe("Test Receive", async () => {

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
            expect(logP.args.label).to.equal("Coins locked!")
            expect(logP.args.addr).to.equal(prover.address)
            expect(logP.args.amount).to.equal(ethers.utils.parseEther("0.1"))
            // I pick the fourth event
            const logV = logs[3]
            expect(logV.args.label).to.equal("Coins locked!")
            expect(logV.args.addr).to.equal(verifier.address)
            expect(logV.args.amount).to.equal(ethers.utils.parseEther("0.1"))

        })

        /* it("Should emit event Failed to lock coins: msg.sender is not P nor V", async function () {

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
        }) */
    }); 

    describe("Test SubmitProof", function () {

        it("Is Proof valid?", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txSubmitProof = await LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked);

        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Proof successfully verified", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Proof successfully verified", true);
        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Proof submitted too late", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.smallTimelock, testdata.RelTimelock, testdata.setupSigPSmallTimelock, testdata.setupSigVSmallTimelock);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Proof submitted too late", false);
        })

        it("Revert if P's transaction is locked", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Commitment transaction of P is locked");
        })
        
        it("Revert if V's transaction is locked", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Locked)).to.be.revertedWith("Commitment transaction of V is locked");
        })

        it("Revert if P's commitment transaction does not hardcode V's revocation key", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongRevSecret, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("P's commitment transaction does not hardcode V's revocation key");
        })

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V (wrong P2PKH of P)", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongAmountP2PKH, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Amount mismatch between p2pkh of P and lightning HTLC of V");

        }) 

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V (wrong HTLC of V)", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked_WrongAmountHTLC)).to.be.revertedWith("Amount mismatch between p2pkh of P and lightning HTLC of V");

        }) 

        it("Revert if there is an mismatch between the amounts in p2pkh of P and in lightning HTLC of V", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongAmountHTLC, testdata.CT_V_withPsig_Unlocked_WrongAmountP2PKH)).to.be.revertedWith("Amount mismatch between p2pkh of V and lightning HTLC of P");

        }) 

        it("Revert if the p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked_WrongP2pkh, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("The p2pkh in P's unlocked commitment transaction does not correspond to Verifier's one");
        }) 

        it("Revert if the p2pkh in V's unlocked commitment transaction does not correspond to Prover's one", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_Unlocked_WrongP2pkh)).to.be.revertedWith("The p2pkh in V's unlocked commitment transaction does not correspond to Prover's one");
        }) 

        it("Revert if P's commitment transaction does not spend the funding transaction", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_WrongFund, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("P's commitment transaction does not spend the funding transaction");
        })

        it("Revert if V's commitment transaction does not spend the funding transaction", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withPsig_WrongFund)).to.be.revertedWith("V's commitment transaction does not spend the funding transaction");
        })

        it("Revert if verification of signature of P failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withVsig_Unlocked, testdata.CT_V_withWrongPsig_Unlocked)).to.be.revertedWith("Invalid signature of P over commitment transaction of V");

        }) 

        it("Revert if verification of signature of V failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.submitProof(testdata.CT_P_withWrongVsig_Unlocked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Invalid signature of V over commitment transaction of P");

        })  

    }); 

    describe("Test Dispute", function () {

        it("Call Dispute", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let tx = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);
        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Dispute successfully opened", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Dispute successfully opened", true);
        }) 

        it("Revert if current time is smaller than the time in the timelock. Event: Dispute not opened", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.smallTimelock, testdata.RelTimelock, testdata.setupSigPSmallTimelock, testdata.setupSigVSmallTimelock);

            await expect(LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Dispute not opened", false);
        })

        it("Check timelocked TxCP has timelock larger than Timelock T + Relative Timelock T_rel (false)", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.dispute(testdata.CT_P_withVsig_LockedOct29, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Commitment transaction of P is unlocked or timelock of the timelocked Tx is smaller or equal than Timelock T + Relative Timelock T_rel"); // tests with timelock run in October/Novemeber 2023. Testdata with timelock must be changed is tests are run later on. 
        }) 
        
        it("Check timelocked TxCP has timelock larger than Timelock T + Relative Timelock T_rel (true)", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let tx = await LNBridge.dispute(testdata.CT_P_withVsig_LockedDec24, testdata.CT_V_withPsig_Unlocked);
        }) 

        it("Revert if verification of signature of P failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withWrongPsig_Unlocked)).to.be.revertedWith("Invalid signature of P over commitment transaction of V");

        }) 

        it("Revert if verification of signature of V failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            await expect(LNBridge.dispute(testdata.CT_P_withWrongVsig_Locked, testdata.CT_V_withPsig_Unlocked)).to.be.revertedWith("Invalid signature of V over commitment transaction of P");
        }) 

    }); 

    describe("Test ResolveValidDispute", function () {

        it("Call resolveValidDispute", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            let tx = await LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Unlocked);
        }) 

        it("Emit event: Resolve Valid Dispute successfully executed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Resolve Valid Dispute successfully executed", true);
        }) 

        it("Emit event: Resolve Valid Dispute failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            //let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Unlocked)).to.emit(LNBridge, "stateEvent").withArgs("Resolve Valid Dispute failed", false);
        }) 

        it("Revert if transaction submitted is locked", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Locked)).to.be.revertedWith("Commitment transaction of P is locked");
        })

        it("Revert if verification of signature of V failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveValidDispute(testdata.CT_P_withWrongVsig_Unlocked)).to.be.revertedWith("Invalid signature of V over commitment transaction of P");
        })


    });

    describe("Test ResolveInvalidDispute", function () {

        it("Call resolveInvalidDispute", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            let tx = await LNBridge.resolveInvalidDispute(testdata.revSecretP);
        }) 

        it("Emit event: Resolve Invalid Dispute successfully executed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveInvalidDispute(testdata.revSecretP)).to.emit(LNBridge, "stateEvent").withArgs("Resolve Invalid Dispute successfully executed", true);
        }) 

        it("Emit event: Resolve Invalid Dispute failed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.resolveInvalidDispute(testdata.WrongRevSecretP)).to.emit(LNBridge, "stateEvent").withArgs("Resolve Invalid Dispute failed", false);
        }) 

    }); 

    describe("Test Settle", function () {

        it("Call settle right after locking coins", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            let txResolveDispute = await LNBridge.resolveInvalidDispute(testdata.revSecretP);

            let settle = await LNBridge.settle();
        }) 

        it("Valid proof submitted and funds distributed", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            let txResolveDispute = await LNBridge.resolveValidDispute(testdata.CT_P_withVsig_Unlocked);

            await expect(LNBridge.settle()).to.emit(LNBridge, "stateEvent").withArgs("Valid proof submitted and funds distributed", true);
        }) 

        it("Emit event: Contract instance closed: invalid dispute opened, all funds given to V", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            let txResolveDispute = await LNBridge.resolveInvalidDispute(testdata.revSecretP);

            await expect(LNBridge.settle()).to.emit(LNBridge, "stateEvent").withArgs("All funds given to V", true);
        }) 

        it("Emit event: Contract instance closed: dispute was not closed, all funds given to P", async function () {

            let txSetup = await LNBridge.setup(testdata.fundingTxId, testdata.fundingTx_LockingScript, testdata.fundingTxIndex, testdata.sighash_all, testdata.pkProverUnprefixedUncompressed, testdata.pkVerifierUnprefixedUncompressed, testdata.timelock, testdata.RelTimelock, testdata.setupSigP, testdata.setupSigV);

            let txDispute = await LNBridge.dispute(testdata.CT_P_withVsig_Locked, testdata.CT_V_withPsig_Unlocked);

            await expect(LNBridge.settle()).to.emit(LNBridge, "stateEvent").withArgs("All funds given to P", true);       
        }) 

        it("Emit event: Contract instance closed: Funds distributed as for initial distribution", async function () {

            await expect(LNBridge.settle()).to.emit(LNBridge, "stateEvent").withArgs("Funds distributed as for initial distribution", true);       
        }) 

        // TODO: test balance distributions

    });

 
})