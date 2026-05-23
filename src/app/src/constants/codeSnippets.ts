/**
 * Shared code snippets referenced by more than one page.
 * Import the constant you need rather than copying the string.
 */

/**
 * Solidity example showing how any on-chain contract can gate access using
 * the Cyclo soulbound NFT. Used in ArcEconomicsPage and ComposabilitySection.
 */
export const COMPOSABILITY_SOLIDITY_CODE = `\
import { ISubscriptionNFT } from "@cyclo/contracts";

contract MyProtocol {
    ISubscriptionNFT public cyclo;
    uint256 public planId;

    constructor(address _cyclo, uint256 _planId) {
        cyclo = ISubscriptionNFT(_cyclo);
        planId = _planId;
    }

    modifier onlySubscribers() {
        require(
            cyclo.isSubscribed(msg.sender, planId),
            "Active Cyclo subscription required"
        );
        _;
    }

    function premiumFeature() external onlySubscribers {
        // gated logic here
    }
}`
