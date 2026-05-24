import type { Provider } from 'ethers'
import {
  getBlock,
  insertBlock,
  deleteBlocksFrom,
  rollbackSubscriptionsFrom,
} from './db/queries.js'
import { log } from './logger.js'

// How many blocks behind the tip we follow.
// Blocks at depth >= CONFIRMATION_DEPTH are considered final on Arc testnet.
const CONFIRMATION_DEPTH = 6

// How far back we walk when searching for the common ancestor during a reorg.
const MAX_REORG_DEPTH = 64

export class ReorgDetector {
  private provider: Provider

  constructor(provider: Provider) {
    this.provider = provider
  }

  /**
   * Returns the safe block number to process (tip - CONFIRMATION_DEPTH).
   */
  async safeBlock(): Promise<number> {
    const latest = await this.provider.getBlockNumber()
    return Math.max(0, latest - CONFIRMATION_DEPTH)
  }

  /**
   * Validate block N against the stored parent hash of block N-1.
   * If the hashes match, record block N and return true (safe to process).
   * If they don't match, a reorg has occurred — run rollback and return false.
   * The caller should re-sync from the common ancestor after a false return.
   */
  async validate(blockNumber: number): Promise<boolean> {
    if (blockNumber === 0) {
      await this.recordBlock(BigInt(blockNumber))
      return true
    }

    const [onChain, stored] = await Promise.all([
      this.provider.getBlock(blockNumber),
      getBlock(BigInt(blockNumber - 1)),
    ])

    if (!onChain) {
      log('warn', 'Block not found on RPC — skipping', { blockNumber })
      return false
    }

    // First time seeing this block height — no stored parent to compare against
    if (!stored) {
      await this.recordBlock(BigInt(blockNumber))
      return true
    }

    // Happy path: parent hash matches our stored record
    if (onChain.parentHash.toLowerCase() === stored.block_hash.toLowerCase()) {
      await this.recordBlock(BigInt(blockNumber))
      return true
    }

    // Mismatch — reorg detected
    log('warn', 'Reorg detected', {
      blockNumber,
      storedParentHash: stored.block_hash,
      onChainParentHash: onChain.parentHash,
    })

    const commonAncestor = await this.findCommonAncestor(blockNumber)

    if (commonAncestor === null) {
      log('error', 'Could not find common ancestor — full resync required', { blockNumber })
      await deleteBlocksFrom(0n)
      await rollbackSubscriptionsFrom(0n)
      return false
    }

    log('info', 'Rolling back to common ancestor', {
      from: blockNumber,
      to: commonAncestor,
      depth: blockNumber - commonAncestor,
    })

    await this.rollback(BigInt(commonAncestor + 1))
    return false
  }

  /**
   * Walk backward from blockNumber until we find a block whose hash matches
   * what we have stored. Returns the common ancestor block number, or null
   * if we exhaust MAX_REORG_DEPTH without finding one.
   */
  private async findCommonAncestor(blockNumber: number): Promise<number | null> {
    for (let depth = 1; depth <= MAX_REORG_DEPTH; depth++) {
      const checkBlock = blockNumber - depth
      if (checkBlock < 0) return null

      const [onChain, stored] = await Promise.all([
        this.provider.getBlock(checkBlock),
        getBlock(BigInt(checkBlock)),
      ])

      if (!onChain || !stored) continue

      if (onChain.hash?.toLowerCase() === stored.block_hash.toLowerCase()) {
        log('info', 'Common ancestor found', { blockNumber: checkBlock, depth })
        return checkBlock
      }
    }

    return null
  }

  /**
   * Delete orphaned blocks and revert subscription state changes
   * that came from those blocks.
   */
  private async rollback(fromBlock: bigint): Promise<void> {
    await rollbackSubscriptionsFrom(fromBlock)
    await deleteBlocksFrom(fromBlock)
    log('info', 'Rollback complete', { fromBlock: fromBlock.toString() })
  }

  private async recordBlock(blockNumber: bigint): Promise<void> {
    const block = await this.provider.getBlock(Number(blockNumber))
    if (!block?.hash) return
    await insertBlock(blockNumber, block.hash)
  }
}
