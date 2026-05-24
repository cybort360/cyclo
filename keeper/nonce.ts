import { type Provider, type Signer } from 'ethers'
import { log } from './logger.js'

export class NonceManager {
  private signer: Signer
  private provider: Provider
  private nonce: number | null = null
  private lock: Promise<void> = Promise.resolve()

  constructor(signer: Signer, provider: Provider) {
    this.signer = signer
    this.provider = provider
  }

  async init(): Promise<void> {
    const address = await this.signer.getAddress()
    this.nonce = await this.provider.getTransactionCount(address, 'pending')
    log('info', 'Nonce manager initialised', { nonce: this.nonce, address })
  }

  /**
   * Acquire the next nonce. Serialises callers so concurrent workers
   * each get a unique, incrementing value without hitting the RPC.
   */
  async next(): Promise<number> {
    // Chain onto the lock so concurrent callers queue up
    let resolve!: () => void
    const prev = this.lock
    this.lock = new Promise(r => { resolve = r })

    await prev

    try {
      if (this.nonce === null) await this.init()
      return this.nonce!++
    } finally {
      resolve()
    }
  }

  /**
   * Called after a transaction is confirmed. If the on-chain nonce
   * has jumped ahead (e.g. a manual tx was sent), resync to avoid gaps.
   */
  async sync(): Promise<void> {
    const address = await this.signer.getAddress()
    const onChain = await this.provider.getTransactionCount(address, 'pending')

    if (this.nonce === null || onChain > this.nonce) {
      log('warn', 'Nonce resynced', { local: this.nonce, onChain })
      this.nonce = onChain
    }
  }

  /**
   * Called when a transaction fails with a nonce error.
   * Forces a full resync from the RPC before the next attempt.
   */
  async reset(): Promise<void> {
    this.nonce = null
    await this.init()
  }
}
