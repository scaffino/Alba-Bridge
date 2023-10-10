from bitcoinutils.transactions import Transaction, TxInput, TxOutput
from bitcoinutils.script import Script
from bitcoinutils.keys import P2pkhAddress, PrivateKey, PublicKey
from identity import Id
from helper import hash256, gen_secret
import init
import scripts
import txs
import hashlib
import struct
from bitcoinutils.constants import SIGHASH_ALL

init.init_network()

#ids chosen at random
id_P = Id('d44348ff037a7f65bcf9b7c86181828f5e05dbfe6cf2efe9af6362c8d53a00b0') #address is mhdTzofrDHXF18US18Y6ZfV5JhqCxa13yh
id_V = Id('b45349ff037a7f65bcf9b7c86181828f5e05dbfe6cf2efe9af6362c8d53a00b0') #address is my6e3Kf7vUEW9dvdhS9jrMHUjsL1k95csk 

#print(verifier.addr)
#bob =   Id('d32048ff037a0f15bcf977c86181828f5e05dbfe6cf2efe9af6362c8d53a00b1')
#faucet = P2pkhAddress('mohjSavDdQYHRYXcS3uS6ttaHP8amyvX78')

"""
# # # # # # # #
# Funding transaction
# # # # # # # #

#inputs
tx_in_P = TxInput('601ee0f8fc9f953044440a81c9bdf688db859ecbf12d4ff64864a1df7d287085', 0) #8210
tx_in_V = TxInput('ec139f9c964158ef3eeb6c135f5a79a4c5a47efb3dd9104375729d0e2c74ba56', 1) #9553
#outputs
tx_out_multisig = TxOutput(8210, scripts.get_script_ft_output(id_P, id_V)) 
tx_out_payback = TxOutput(9100, id_P.p2pkh)
#construct tx
tx = Transaction([tx_in_P, tx_in_V], [tx_out_multisig, tx_out_payback])
#compute signatures
sig_P = id_P.sk.sign_input(tx, 0 , id_P.p2pkh) 
sig_V = id_V.sk.sign_input(tx, 1 , id_V.p2pkh) 
# unlocking script for the input
tx_in_P.script_sig = Script([sig_P, id_P.pk.to_hex()])
tx_in_V.script_sig = Script([sig_V, id_V.pk.to_hex()])

print(tx.serialize())
"""

"""
# # # # # # # #
# Spend funding tx!
# # # # # # # #
 
#inputs 
tx_in_forfees = TxInput('d7a751512420e267ad5abbfdca6c2f9133ab61e7952d728db868d3bc50d89110', 0)
tx_in_ft = TxInput('d7a751512420e267ad5abbfdca6c2f9133ab61e7952d728db868d3bc50d89110', 1) 
#outputs
tx_out = TxOutput(25880, scripts.get_script_ft_output(id_P, id_V))
# construct tx
tx = Transaction([tx_in_forfees, tx_in_ft], [tx_out])
scriptFToutput = scripts.get_script_ft_output(id_P, id_V)

print(tx.serialize())

#compute signatures
sig_P = id_P.sk.sign_input(tx, 1 , scriptFToutput) 
sig_V = id_V.sk.sign_input(tx, 1 , scriptFToutput) 
#print("SigV: ", sig_V)
sig_P_forfees = id_P.sk.sign_input(tx, 0 , id_P.p2pkh) 
# unlocking script for the input
tx_in_ft.script_sig = Script([sig_V, sig_P]) #note P and V are reversed!
tx_in_forfees.script_sig = Script([sig_P_forfees, id_P.pk.to_hex()])

print(tx.serialize())
"""


# # # # # # # #
# Create unlocked commitment transaction P 
# # # # # # # #

secret_rev = gen_secret() #52

# P is owner and V is punisher. Secret_rev is from P (V knows it)
ct_P = txs.get_LNBridge_ct(TxInput('9976352b89ece6bbe86484a22cc1fb8bab696a1f64d9f77480cb9341296202fc', 0), id_P, id_V, hash256(secret_rev), 4105, 4105, 420, l=True, timelock=0x2)

ct_V = txs.get_LNBridge_ct(TxInput('9976352b89ece6bbe86484a22cc1fb8bab696a1f64d9f77480cb9341296202fc', 0), id_P, id_V, hash256(secret_rev), 4105, 4105, 420, l=False, timelock=0x2)

print(ct_P.serialize())
print("")
print(ct_V.serialize())

# # # # # # # #
# for locked txs, remove the final 00000000 and replace it with 06665666 
# # # # # # # #

######### DATA #########

# Hash Revocation Secret: a99843c5b0e2290f3bac80d8845f718095c6af84092f449ccf10769647095bca

# Breakdown Bitcoin Raw Transaction: https://rsbondi.github.io/btc-adventure/
# bitcoin transactino decoder https://live.blockcypher.com/btc/decodetx/