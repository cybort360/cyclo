import { PublicClient, WalletClient } from 'viem';

interface CycloClientConfig {
    contractAddress: `0x${string}`;
    usdcAddress: `0x${string}`;
    publicClient: PublicClient;
    walletClient?: WalletClient;
    /**
     * Address of the deployed SubscriptionNFT contract.
     * When provided, isSubscribed() and getSubscriberTokenId() use this directly
     * without an extra RPC call to read it from the SubscriptionManager.
     * When omitted, the address is read from subscriptionManager.subscriptionNFT()
     * on first use and cached for subsequent calls.
     */
    subscriptionNFTAddress?: `0x${string}`;
}
interface Plan {
    id: bigint;
    merchant: `0x${string}`;
    price: bigint;
    priceUsdc: number;
    interval: bigint;
    intervalDays: number;
    trialDuration: bigint;
    trialDays: number;
    active: boolean;
}
interface Subscription {
    planId: bigint;
    subscriber: `0x${string}`;
    nextChargeTimestamp: bigint;
    active: boolean;
}
interface CreatePlanParams {
    price: number;
    intervalDays: number;
    trialDays?: number;
}
type CycloEventName = 'PaymentCharged' | 'SubscriptionCreated' | 'SubscriptionCancelled' | 'PlanCreated' | 'PlanDeactivated' | 'PlanMigrated';
type CycloEventCallback<T = unknown> = (data: T) => void;

declare class CycloClient {
    private contractAddress;
    private usdcAddress;
    private publicClient;
    private walletClient;
    private listeners;
    private unwatchers;
    /**
     * Cached NFT contract address. Set from config on construction when provided,
     * otherwise populated on first RPC fetch. Only non-zero addresses are cached —
     * a zero return means the NFT is not yet configured and is re-read each call
     * in case setSubscriptionNFT() is called between client initialisation and use.
     */
    private _resolvedNftAddress;
    constructor(config: CycloClientConfig);
    setWalletClient(walletClient: WalletClient): void;
    getPlan(planId: bigint): Promise<Plan>;
    createPlan(params: CreatePlanParams): Promise<bigint>;
    deactivatePlan(planId: bigint): Promise<void>;
    getSubscribeLink(planId: bigint, baseUrl: string): string;
    getSubscription(subscriber: `0x${string}`, planId: bigint): Promise<Subscription>;
    subscribe(planId: bigint): Promise<void>;
    cancelSubscription(planId: bigint): Promise<void>;
    migratePlan(currentPlanId: bigint, newPlanId: bigint): Promise<void>;
    /**
     * Returns true if `subscriber` holds an active soulbound NFT for `planId`.
     *
     * If the SubscriptionNFT contract is not yet configured on the SubscriptionManager
     * (i.e. subscriptionNFT() returns the zero address), this returns false without
     * making a second RPC call. The NFT address is cached after the first successful
     * read so subsequent calls are a single RPC round-trip.
     */
    isSubscribed(subscriber: `0x${string}`, planId: bigint): Promise<boolean>;
    /**
     * Returns the tokenId of the soulbound NFT held by `subscriber` for `planId`,
     * or null if the subscriber does not hold a token (not subscribed, or NFT not configured).
     */
    getSubscriberTokenId(subscriber: `0x${string}`, planId: bigint): Promise<bigint | null>;
    on<T = unknown>(event: CycloEventName, callback: CycloEventCallback<T>): () => void;
    destroy(): void;
    private requireWallet;
    /**
     * Resolves the SubscriptionNFT contract address.
     * Uses the config-provided address when available. Otherwise reads from the
     * SubscriptionManager and caches any non-zero result for subsequent calls.
     */
    private resolveNftAddress;
    private ensureAllowance;
    private watchEvent;
}

declare function toUsdcUnits(amount: number): bigint;
declare function fromUsdcUnits(amount: bigint): number;
declare function daysToSeconds(days: number): bigint;
declare function secondsToDays(seconds: bigint): number;

declare const SUBSCRIPTION_MANAGER_ABI: readonly [{
    readonly type: "constructor";
    readonly inputs: readonly [{
        readonly name: "usdcAddress";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "feeRecipient";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "cancelSubscription";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "charge";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "createPlan";
    readonly inputs: readonly [{
        readonly name: "price";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "interval";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "trialDuration";
        readonly type: "uint48";
        readonly internalType: "uint48";
    }];
    readonly outputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "deactivatePlan";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "batchCharge";
    readonly inputs: readonly [{
        readonly name: "planIds";
        readonly type: "uint256[]";
        readonly internalType: "uint256[]";
    }, {
        readonly name: "subscribers";
        readonly type: "address[]";
        readonly internalType: "address[]";
    }];
    readonly outputs: readonly [{
        readonly name: "successCount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "pay";
    readonly inputs: readonly [{
        readonly name: "recipient";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "updateFeeRecipient";
    readonly inputs: readonly [{
        readonly name: "newFeeRecipient";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "getPlan";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct SubscriptionLib.Plan";
        readonly components: readonly [{
            readonly name: "merchant";
            readonly type: "address";
            readonly internalType: "address";
        }, {
            readonly name: "active";
            readonly type: "bool";
            readonly internalType: "bool";
        }, {
            readonly name: "trialDuration";
            readonly type: "uint48";
            readonly internalType: "uint48";
        }, {
            readonly name: "price";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }, {
            readonly name: "interval";
            readonly type: "uint256";
            readonly internalType: "uint256";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "migratePlan";
    readonly inputs: readonly [{
        readonly name: "currentPlanId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "newPlanId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "getSubscription";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly internalType: "struct SubscriptionLib.Subscription";
        readonly components: readonly [{
            readonly name: "nextChargeTimestamp";
            readonly type: "uint48";
            readonly internalType: "uint48";
        }, {
            readonly name: "active";
            readonly type: "bool";
            readonly internalType: "bool";
        }];
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "isChargeDue";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "subscriptionNFT";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "isSubscribed";
    readonly inputs: readonly [{
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "subscribe";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "event";
    readonly name: "PaymentCharged";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "merchant";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "nextChargeTimestamp";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "FeeCollected";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "feeAmount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PaymentSent";
    readonly inputs: readonly [{
        readonly name: "sender";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "recipient";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "fee";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PlanCreated";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "merchant";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "price";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }, {
        readonly name: "interval";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PlanDeactivated";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "merchant";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "SubscriptionCancelled";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "PlanMigrated";
    readonly inputs: readonly [{
        readonly name: "fromPlanId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "toPlanId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "SubscriptionCreated";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "nextChargeTimestamp";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "AlreadySubscribed";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ArrayLengthMismatch";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SamePlan";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "InsufficientAllowance";
    readonly inputs: readonly [{
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "required";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "actual";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "InvalidAmount";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidInterval";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "InvalidPrice";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "PaymentNotDue";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "nextChargeTimestamp";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "PlanInactive";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "PlanNotFound";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "ReentrancyGuardReentrantCall";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "SubscriptionInactive";
    readonly inputs: readonly [{
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }, {
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "TransferFailed";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
}, {
    readonly type: "error";
    readonly name: "Unauthorized";
    readonly inputs: readonly [{
        readonly name: "caller";
        readonly type: "address";
        readonly internalType: "address";
    }];
}, {
    readonly type: "error";
    readonly name: "ZeroAddress";
    readonly inputs: readonly [];
}];
declare const SUBSCRIPTION_NFT_ABI: readonly [{
    readonly type: "function";
    readonly name: "owner";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "isSubscribed";
    readonly inputs: readonly [{
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
        readonly internalType: "bool";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "tokenOfSubscriber";
    readonly inputs: readonly [{
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "tokenURI";
    readonly inputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "ownerOf";
    readonly inputs: readonly [{
        readonly name: "tokenId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "name";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "symbol";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "string";
        readonly internalType: "string";
    }];
    readonly stateMutability: "view";
}, {
    readonly type: "function";
    readonly name: "mint";
    readonly inputs: readonly [{
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "burn";
    readonly inputs: readonly [{
        readonly name: "subscriber";
        readonly type: "address";
        readonly internalType: "address";
    }, {
        readonly name: "planId";
        readonly type: "uint256";
        readonly internalType: "uint256";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "function";
    readonly name: "transferOwnership";
    readonly inputs: readonly [{
        readonly name: "newOwner";
        readonly type: "address";
        readonly internalType: "address";
    }];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}, {
    readonly type: "event";
    readonly name: "Minted";
    readonly inputs: readonly [{
        readonly name: "subscriber";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "planId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "tokenId";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "Burned";
    readonly inputs: readonly [{
        readonly name: "subscriber";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "planId";
        readonly type: "uint256";
        readonly indexed: true;
        readonly internalType: "uint256";
    }, {
        readonly name: "tokenId";
        readonly type: "uint256";
        readonly indexed: false;
        readonly internalType: "uint256";
    }];
    readonly anonymous: false;
}, {
    readonly type: "event";
    readonly name: "OwnershipTransferred";
    readonly inputs: readonly [{
        readonly name: "previousOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }, {
        readonly name: "newOwner";
        readonly type: "address";
        readonly indexed: true;
        readonly internalType: "address";
    }];
    readonly anonymous: false;
}, {
    readonly type: "error";
    readonly name: "AlreadySubscribed";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "NotSubscribed";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "Soulbound";
    readonly inputs: readonly [];
}, {
    readonly type: "error";
    readonly name: "Unauthorized";
    readonly inputs: readonly [];
}];

export { type CreatePlanParams, CycloClient, type CycloClientConfig, type CycloEventCallback, type CycloEventName, type Plan, SUBSCRIPTION_MANAGER_ABI, SUBSCRIPTION_NFT_ABI, type Subscription, daysToSeconds, fromUsdcUnits, secondsToDays, toUsdcUnits };
