import { ethers } from 'ethers'

export function buildMessage(address: string, timestamp: number): string {
    return `Sign this message to set up your Cyclo merchant profile.\n\nWallet: ${address}\nTimestamp: ${timestamp}`
}

export function verifySignature(address: string, message: string, signature: string): boolean {
    try {
        const recovered = ethers.verifyMessage(message, signature)
        return recovered.toLowerCase() === address.toLowerCase()
    } catch {
        return false
    }
}
