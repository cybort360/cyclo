import type { PublicClient } from 'viem'

const CHUNK_SIZE = 99_999n

type ContractEventsParams = Parameters<PublicClient['getContractEvents']>[0]
type LogsParams = Parameters<PublicClient['getLogs']>[0]

/**
 * Fetches contract events in 99,999-block chunks to stay within the Arc
 * testnet RPC limit of 100,000 blocks per eth_getLogs request.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getContractEventsChunked(client: PublicClient, params: ContractEventsParams): Promise<any[]> {
    const fromBlock = params.fromBlock != null ? BigInt(params.fromBlock as bigint) : 0n
    const latestBlock = await client.getBlockNumber()
    const toBlock = params.toBlock === 'latest' || params.toBlock == null ? latestBlock : BigInt(params.toBlock as bigint)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = []
    for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE + 1n) {
        const end = start + CHUNK_SIZE > toBlock ? toBlock : start + CHUNK_SIZE
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chunk = await client.getContractEvents({ ...params, fromBlock: start, toBlock: end } as any)
        all.push(...chunk)
    }
    return all
}

/**
 * Fetches raw logs in 99,999-block chunks to stay within the Arc
 * testnet RPC limit of 100,000 blocks per eth_getLogs request.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLogsChunked(client: PublicClient, params: LogsParams): Promise<any[]> {
    const fromBlock = params?.fromBlock != null ? BigInt(params.fromBlock as bigint) : 0n
    const latestBlock = await client.getBlockNumber()
    const toBlock = params?.toBlock === 'latest' || params?.toBlock == null ? latestBlock : BigInt(params.toBlock as bigint)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all: any[] = []
    for (let start = fromBlock; start <= toBlock; start += CHUNK_SIZE + 1n) {
        const end = start + CHUNK_SIZE > toBlock ? toBlock : start + CHUNK_SIZE
        const chunk = await client.getLogs({ ...params, fromBlock: start, toBlock: end } as LogsParams)
        all.push(...chunk)
    }
    return all
}
