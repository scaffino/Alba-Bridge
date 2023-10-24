pragma solidity ^0.8.9;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import "./ECDSA.sol";
import "./BTC.sol";
import "./BTCUtils.sol";
import "./SECP256K1.sol";
import "./BTCUtils.sol";

// TODO GIULIA: convert console.log into console.logBytes and console.logBytes32 when necessary

// N.B.: this library is tailored to the Lightning Network transactions and to the transactions used in our bridge protocol. Be careful when using it for general purpose transactions.

library ParseBTCLib {

    struct LightningHTLCData {
        uint value;
        bytes32 pk1; // V
        bytes32 pk2; // P
        bytes32 rev_secret;
    }

    struct P2PKHData {
        uint value;
        bytes20 pkhash;
    }

    struct OpReturnData {
        uint value;
        bytes32 data;
    }

    struct Input {
        uint number_of_inputs;
        bytes32 txid;
        bytes4 inputIndex;
    }

    struct ExtractOutputAux {
        uint pos; // skip version
        uint[] input_script_lens; 
        uint[] output_script_lens;
        uint[] script_starts;
        uint[] output_values;
    }

    struct Signature {
        uint8 v;
        bytes r;
        bytes s;
    }

    function getOutputsDataLNB(bytes memory _txBytes) internal pure returns(LightningHTLCData memory, P2PKHData memory, OpReturnData memory) {

        LightningHTLCData memory htlc;
        OpReturnData memory opreturn;
        P2PKHData memory p2pkh;
        ExtractOutputAux memory out_aux;

        out_aux.pos = 4;

        (out_aux.input_script_lens, out_aux.pos) = BTC.scanInputs(_txBytes, out_aux.pos, 0);

        (out_aux.output_values, out_aux.script_starts, out_aux.output_script_lens, out_aux.pos) = BTC.scanOutputs(_txBytes, out_aux.pos, 0);

        {
            for (uint i = 0; i < 3; i++) {
                if (i==0) {
                    (htlc.pk1, htlc.rev_secret, htlc.pk2) = BTC.parseOutputScriptHTLC(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i]);
                    htlc.value = out_aux.output_values[i];
                }
                if (i == 1) {
                    p2pkh.pkhash = BTC.sliceBytes20(abi.encodePacked(BTC.parseOutputScript(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i])),0);
                    p2pkh.value = out_aux.output_values[i];
                }
                if (i == 2) {
                    opreturn.data = BTC.parseOutputScript(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i]);
                    opreturn.value = out_aux.output_values[i];
                }
            }
        }

        /*
        console.log("Check value_output_1:", htlc.value);
        console.log("Check pk1_Output1:", BytesLib.toHexString(uint(htlc.pk1), 32));
        console.log("Check rev_sec:", BytesLib.toHexString(uint(htlc.rev_secret), 32));
        console.log("Check pk2_Output1:", BytesLib.toHexString(uint(htlc.pk2), 32));

        console.log("Check value_output_2:", p2pkh.value);
        console.log("Check script_data_2:", BytesLib.toHexString(p2pkh.pkhash));
        console.log("Check value_output_3:", opreturn.value);
        console.log("Check script_data_3:", BytesLib.toHexString(uint(opreturn.data), 32));       
        */

        return (htlc, p2pkh, opreturn);
    }

    function getOutputsData_2(bytes memory _txBytes) internal pure returns(LightningHTLCData memory, P2PKHData memory) {

        LightningHTLCData memory htlc;
        P2PKHData memory p2pkh;
        ExtractOutputAux memory out_aux;

        out_aux.pos = 4;

        (out_aux.input_script_lens, out_aux.pos) = BTC.scanInputs(_txBytes, out_aux.pos, 0);

        (out_aux.output_values, out_aux.script_starts, out_aux.output_script_lens, out_aux.pos) = BTC.scanOutputs(_txBytes, out_aux.pos, 0);

        {
            for (uint i = 0; i < 2; i++) {
                if (i==0) {
                    (htlc.pk1, htlc.rev_secret, htlc.pk2) = BTC.parseOutputScriptHTLC(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i]);
                    htlc.value = out_aux.output_values[i];
                }
                else if (i == 1) {
                    p2pkh.pkhash = BTC.sliceBytes20(abi.encodePacked(BTC.parseOutputScript(_txBytes, out_aux.script_starts[i], out_aux.output_script_lens[i])),0);
                    p2pkh.value = out_aux.output_values[i];
                }
            }
        }

        /*
        console.log("Check value_output_1:", htlc.value);
        console.log("Check pk1_Output1:", BytesLib.toHexString(uint(htlc.pk1), 32));
        console.log("Check rev_sec:", BytesLib.toHexString(uint(htlc.rev_secret), 32));
        console.log("Check pk2_Output1:", BytesLib.toHexString(uint(htlc.pk2), 32));

        console.log("Check value_output_2:", p2pkh.value);
        console.log("Check script_data_2:", BytesLib.toHexString(p2pkh.pkhash));   
        */

        return (htlc, p2pkh);
    }

    function getTimelock(bytes memory _txBytes) internal pure returns(bytes4) {
        uint256 rawTxSize = _txBytes.length;
        //console.log("Tx Size: ", rawTxSize);
        bytes4 timelock = (bytes4(BytesLib.slice(_txBytes, rawTxSize-4, uint256(4))));
        //console.log("Timelock: ", BytesLib.toHexString(timelock));
        return timelock;
    }

    function getInputsData(bytes memory _txBytes) internal pure returns(Input memory) {

        Input memory input;

        (input.number_of_inputs, ) = BTC.parseVarInt(_txBytes, uint(4));
        input.inputIndex = bytes4(BytesLib.slice(_txBytes, 37, uint256(4)));
        input.txid = BytesLib.flipBytes32(bytes32(BytesLib.slice(_txBytes, 5, uint256(37))));

        require(input.number_of_inputs == 1, "Tx has too many inputs (>1)");
        
        //console.log("inputIndex: ", BytesLib.toHexString(inputIndex));
        //console.log("txid: ", BytesLib.toHexString(uint(txid), 32));
        //console.log("number_of_inputs: ", number_of_inputs);
        
        return input;
    }

    function getSignatures(bytes memory _txBytes) internal pure returns(Signature memory, Signature memory) {

        Signature memory sigP;
        Signature memory sigV;

        // extract signature of V
        sigV.v = 27;
        sigV.s = BytesLib.toBytes(BTC.sliceBytes32(_txBytes, 81));

        if (_txBytes[42] == 0x47) { 
            sigV.r = BytesLib.toBytes(BTC.sliceBytes32(_txBytes, 47));
        } else if (_txBytes[42] == 0x46) {
            sigV.r = BTC.sliceBytes31(_txBytes, 47);
        }

        // extract signature of P
        sigP.v = 27; 
        sigP.s = BytesLib.toBytes(BTC.sliceBytes32(_txBytes, 152));

        if (_txBytes[114] == 0x47) { 
            sigP.r = BytesLib.toBytes(BTC.sliceBytes32(_txBytes, 119));
        } else if (_txBytes[114] == 0x46) {
            sigP.r = BTC.sliceBytes31(_txBytes, 119);
        }

        //console.log("this is pos 114 ", BytesLib.toHexString(uint256(uint8(_txBytes[114])), 1));

        return (sigP, sigV);


        /////////////
        // 30 # DER Sequence tag
        // 44 # Sequence length 0x44 (68) bytes
        // 02 # Integer element
        // 20 # Element length 0x20 (32) bytes
        // 3ff7162d6635246dbf59b7fa9e72e3023e959a73b1fbc51edbaaa5a8dbc6d2f7 # ECDSA r value
        // 02 # Integer element
        // 20 # Element length 0x20 (32) bytes
        // 776e2fa5740df01cc0ac47bda713e87fc59044960122ba45abb11c949655c584 # ECDSA s value
        //  DER encoding completed
        // 01  # this is the sighas flag (SIGHASH ALL, in this case)
        /////////////

        //Check this https://bitcoin.stackexchange.com/questions/92680/what-are-the-der-signature-and-sec-format
    }

    function getSignature(bytes memory _txBytes) internal pure returns(Signature memory) {

        Signature memory sig;

        // extract signature 
        // 27 - 0x1B = first key with even y
        // 28 - 0x1C = first key with odd y
        sig.v = 27; 
        sig.s = BytesLib.toBytes(BTC.sliceBytes32(_txBytes, 81));

        if (_txBytes[42] == 0x47) { 
            sig.r = BytesLib.toBytes(BTC.sliceBytes32(_txBytes, 47));
        } else if (_txBytes[42] == 0x46) {
            sig.r = BTC.sliceBytes31(_txBytes, 47);
        }

        return sig;
}

    /*
    // this function returns the Ethereum address
    function verifyETHSignature(bytes32 message, bytes memory signature) internal pure returns(address){
        address mytestaddr = ECDSA.recover(message, signature);
        return mytestaddr;
    }
    */

    //this function returns the signing Public Key 
    function verifyBTCSignature(uint256 digest, uint8 v, uint256 r, uint256 s) internal pure returns (bytes memory) {
        (uint256 x, uint256 y) = SECP256K1.recover(uint256(digest), v - 27, uint256(r), uint256(s));
        return abi.encodePacked(x, y);
    }

    function getTxDigest(bytes memory _txBytes, bytes memory fundingTxLockingScript, bytes memory sighash) internal pure returns (bytes32) {

        //console.log(_txBytes.length);
        bytes memory chunk1 = BytesLib.slice(_txBytes, 0, 41);
        bytes memory chunk2 = BytesLib.slice(_txBytes, 114, (_txBytes.length)-114);
        //console.logBytes(chunk2);
        bytes memory message = bytes.concat(chunk1, fundingTxLockingScript, chunk2, sighash);
        /* console.log("message");
        console.logBytes(message); */
        bytes32 digest = BTCUtils.hash256(message);
        return digest;
        
    }
}