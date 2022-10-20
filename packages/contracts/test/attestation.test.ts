// @ts-ignore
import { ethers } from 'hardhat'
import { expect } from 'chai'
import {
    IncrementalMerkleTree,
    SparseMerkleTree,
    hash2,
    ZkIdentity,
    stringifyBigInts,
} from '@unirep/crypto'
import {
    EPOCH_TREE_DEPTH,
    GLOBAL_STATE_TREE_DEPTH,
    NUM_EPOCH_KEY_NONCE_PER_EPOCH,
    Circuit,
} from '@unirep/circuits'
import { defaultProver } from '@unirep/circuits/provers/defaultProver'

import { EPOCH_LENGTH, AggregateEpochKeysProof } from '../src'
import { deployUnirep } from '../deploy'

describe('Attestations', function () {
    this.timeout(120000)
    let unirepContract

    before(async () => {
        const accounts = await ethers.getSigners()
        unirepContract = await deployUnirep(accounts[0])
    })

    it('should have the correct config value', async () => {
        const config = await unirepContract.config()
        expect(NUM_EPOCH_KEY_NONCE_PER_EPOCH).equal(
            config.numEpochKeyNoncePerEpoch
        )
        expect(EPOCH_TREE_DEPTH).equal(config.epochTreeDepth)
        expect(GLOBAL_STATE_TREE_DEPTH).equal(config.globalStateTreeDepth)
        const tree = new SparseMerkleTree(EPOCH_TREE_DEPTH, hash2([0, 0]))
        expect(tree.root.toString()).equal(config.emptyEpochTreeRoot.toString())
    })

    it('attester sign up', async () => {
        const accounts = await ethers.getSigners()
        await unirepContract
            .connect(accounts[1])
            .attesterSignUp(EPOCH_LENGTH)
            .then((t) => t.wait())
    })

    it('should fail to submit attestation with wrong epoch', async () => {
        const accounts = await ethers.getSigners()
        const id = new ZkIdentity()
        const epochRoot = await unirepContract.attesterEpochRoot(
            accounts[1].address,
            0
        )
        const epochKey = BigInt(24910)
        const epochTree = new SparseMerkleTree(EPOCH_TREE_DEPTH, hash2([0, 0]))
        await expect(
            unirepContract
                .connect(accounts[1])
                .submitAttestation(444444, epochKey, 1, 1)
        ).to.be.revertedWithCustomError(unirepContract, 'EpochNotMatch')
    })

    it('should fail to submit attestation after epoch ends', async () => {
        const accounts = await ethers.getSigners()
        const id = new ZkIdentity()
        const epochRoot = await unirepContract.attesterEpochRoot(
            accounts[1].address,
            0
        )
        const epochKey = BigInt(24910)
        const epochTree = new SparseMerkleTree(EPOCH_TREE_DEPTH, hash2([0, 0]))
        await ethers.provider.send('evm_increaseTime', [EPOCH_LENGTH])
        await expect(
            unirepContract
                .connect(accounts[1])
                .submitAttestation(0, epochKey, 1, 1)
        ).to.be.revertedWithCustomError(unirepContract, 'EpochNotMatch')
    })

    it('should fail to submit from non-attester', async () => {
        const accounts = await ethers.getSigners()
        const id = new ZkIdentity()
        const epochRoot = await unirepContract.attesterEpochRoot(
            accounts[1].address,
            0
        )
        const epochKey = BigInt(24910)
        const epochTree = new SparseMerkleTree(EPOCH_TREE_DEPTH, hash2([0, 0]))
        await expect(
            unirepContract
                .connect(accounts[5])
                .submitAttestation(1, epochKey, 1, 1)
        ).to.be.revertedWithCustomError(unirepContract, 'AttesterNotSignUp')
    })

    it('should submit attestation', async () => {
        const accounts = await ethers.getSigners()
        const id = new ZkIdentity()
        const epochRoot = await unirepContract.attesterEpochRoot(
            accounts[1].address,
            0
        )
        const epochKey = BigInt(24910)
        const posRep = 1
        const negRep = 5
        const tx = await unirepContract
            .connect(accounts[1])
            .submitAttestation(1, epochKey, posRep, negRep)
        await tx.wait()

        expect(tx)
            .to.emit(unirepContract, 'AttestationSubmitted')
            .withArgs(1, epochKey, accounts[1].address, posRep, negRep)
    })
})
