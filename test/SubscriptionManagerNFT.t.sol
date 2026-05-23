// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SubscriptionManager}    from "../contracts/core/SubscriptionManager.sol";
import {ISubscriptionManager}   from "../contracts/interfaces/ISubscriptionManager.sol";
import {MockUSDC}               from "../contracts/mocks/MockUSDC.sol";
import {MockSubscriptionNFT}    from "../contracts/mocks/MockSubscriptionNFT.sol";

/// @dev Integration tests for SubscriptionManager's NFT integration:
///      setSubscriptionNFT, subscribe with NFT, cancelSubscription with NFT,
///      and the isSubscribed view.
contract SubscriptionManagerNFTTest is Test {

    // Mirror events from SubscriptionManager (0.8.20 cannot reference external event syntax).
    event SubscriptionCreated(uint256 indexed planId, address indexed subscriber, uint256 nextChargeTimestamp);
    event SubscriptionCancelled(uint256 indexed planId, address indexed subscriber);
    event SubscriptionNFTSet(address indexed nft);
    event NFTMintFailed(address indexed subscriber, uint256 indexed planId);
    event NFTBurnFailed(address indexed subscriber, uint256 indexed planId);

    SubscriptionManager internal manager;
    MockUSDC            internal usdc;
    MockSubscriptionNFT internal nft;

    address internal owner       = makeAddr("owner");
    address internal merchant    = makeAddr("merchant");
    address internal subscriber  = makeAddr("subscriber");
    address internal stranger    = makeAddr("stranger");
    address internal feeRecipient = makeAddr("feeRecipient");

    uint256 internal constant PRICE    = 10_000_000; // 10 USDC (6 decimals)
    uint256 internal constant INTERVAL = 30 days;
    uint256 internal constant T0       = 1_000;

    function setUp() public {
        usdc    = new MockUSDC();
        vm.prank(owner);
        manager = new SubscriptionManager(address(usdc), feeRecipient);
        nft     = new MockSubscriptionNFT();
        usdc.mint(subscriber, 100_000_000); // 100 USDC
        vm.warp(T0);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    function _createPlan() internal returns (uint256) {
        vm.prank(merchant);
        return manager.createPlan(PRICE, INTERVAL, 0);
    }

    function _subscribe(uint256 planId) internal {
        vm.startPrank(subscriber);
        usdc.approve(address(manager), type(uint256).max);
        manager.subscribe(planId);
        vm.stopPrank();
    }

    function _setNFT() internal {
        vm.prank(owner);
        manager.setSubscriptionNFT(address(nft));
    }

    // ── setSubscriptionNFT ────────────────────────────────────────────────────

    function test_setSubscriptionNFT_success() public {
        vm.expectEmit(true, false, false, false);
        emit SubscriptionNFTSet(address(nft));

        vm.prank(owner);
        manager.setSubscriptionNFT(address(nft));

        assertEq(manager.subscriptionNFT(), address(nft));
    }

    function test_setSubscriptionNFT_revert_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        manager.setSubscriptionNFT(address(nft));
    }

    function test_setSubscriptionNFT_revert_nftAlreadySet() public {
        _setNFT();

        vm.prank(owner);
        vm.expectRevert(SubscriptionManager.NFTAlreadySet.selector);
        manager.setSubscriptionNFT(address(nft));
    }

    function test_setSubscriptionNFT_stateUnchanged_afterRevert() public {
        _setNFT();

        MockSubscriptionNFT secondNft = new MockSubscriptionNFT();
        vm.prank(owner);
        vm.expectRevert(SubscriptionManager.NFTAlreadySet.selector);
        manager.setSubscriptionNFT(address(secondNft));

        // Original NFT address is still set.
        assertEq(manager.subscriptionNFT(), address(nft));
    }

    // ── subscribe + NFT ───────────────────────────────────────────────────────

    function test_subscribe_callsMint_whenNFTSet() public {
        uint256 planId = _createPlan();
        _setNFT();
        _subscribe(planId);

        assertEq(nft.mintCallCount(), 1);
        assertEq(nft.mintSubscribers(0), subscriber);
        assertEq(nft.mintPlanIds(0), planId);
        assertTrue(nft.isSubscribed(subscriber, planId));
    }

    function test_subscribe_doesNotCallMint_whenNFTNotSet() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        assertEq(nft.mintCallCount(), 0);
    }

    function test_subscribe_succeedsEvenIfMintReverts() public {
        uint256 planId = _createPlan();
        _setNFT();
        nft.setRevertMint(true);

        // Subscription must succeed despite the NFT revert.
        vm.startPrank(subscriber);
        usdc.approve(address(manager), type(uint256).max);
        manager.subscribe(planId); // must not revert
        vm.stopPrank();

        assertTrue(manager.getSubscription(planId, subscriber).active);
    }

    function test_subscribe_emitsNFTMintFailed_whenMintReverts() public {
        uint256 planId = _createPlan();
        _setNFT();
        nft.setRevertMint(true);

        // Pre-approve so that the next external call after vm.expectEmit is
        // manager.subscribe(), not usdc.approve() — Foundry checks the next call tree.
        vm.prank(subscriber);
        usdc.approve(address(manager), type(uint256).max);

        // subscribe() emits SubscriptionCreated first, then NFTMintFailed.
        // Declare both in order so Foundry's sequential expectEmit check passes.
        vm.expectEmit(true, true, false, false);
        emit SubscriptionCreated(planId, subscriber, T0);
        vm.expectEmit(true, true, false, false);
        emit NFTMintFailed(subscriber, planId);

        vm.prank(subscriber);
        manager.subscribe(planId);
    }

    function test_subscribe_emitsSubscriptionCreated_evenIfMintReverts() public {
        uint256 planId = _createPlan();
        _setNFT();
        nft.setRevertMint(true);

        // Pre-approve so the next call after vm.expectEmit is manager.subscribe().
        vm.prank(subscriber);
        usdc.approve(address(manager), type(uint256).max);

        vm.expectEmit(true, true, false, false);
        emit SubscriptionCreated(planId, subscriber, T0);

        vm.prank(subscriber);
        manager.subscribe(planId);
    }

    function test_subscribe_mintNotCalled_whenNFTNotSet() public {
        uint256 planId = _createPlan();

        // NFT not set — subscriber.active should be false in the mock.
        _subscribe(planId);

        assertFalse(nft.isSubscribed(subscriber, planId));
    }

    // ── cancelSubscription + NFT ──────────────────────────────────────────────

    function test_cancelSubscription_callsBurn_whenNFTSet() public {
        uint256 planId = _createPlan();
        _setNFT();
        _subscribe(planId);

        assertEq(nft.burnCallCount(), 0);

        vm.prank(subscriber);
        manager.cancelSubscription(planId);

        assertEq(nft.burnCallCount(), 1);
        assertEq(nft.burnSubscribers(0), subscriber);
        assertEq(nft.burnPlanIds(0), planId);
        assertFalse(nft.isSubscribed(subscriber, planId));
    }

    function test_cancelSubscription_doesNotCallBurn_whenNFTNotSet() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        vm.prank(subscriber);
        manager.cancelSubscription(planId);

        assertEq(nft.burnCallCount(), 0);
    }

    function test_cancelSubscription_succeedsEvenIfBurnReverts() public {
        uint256 planId = _createPlan();
        _setNFT();
        _subscribe(planId);
        nft.setRevertBurn(true);

        // Cancellation must succeed despite the NFT revert.
        vm.prank(subscriber);
        manager.cancelSubscription(planId); // must not revert

        assertFalse(manager.getSubscription(planId, subscriber).active);
    }

    function test_cancelSubscription_emitsNFTBurnFailed_whenBurnReverts() public {
        uint256 planId = _createPlan();
        _setNFT();
        _subscribe(planId);
        nft.setRevertBurn(true);

        vm.expectEmit(true, true, false, false);
        emit NFTBurnFailed(subscriber, planId);

        vm.prank(subscriber);
        manager.cancelSubscription(planId);
    }

    function test_cancelSubscription_emitsSubscriptionCancelled_evenIfBurnReverts() public {
        uint256 planId = _createPlan();
        _setNFT();
        _subscribe(planId);
        nft.setRevertBurn(true);

        vm.expectEmit(true, true, false, false);
        emit SubscriptionCancelled(planId, subscriber);

        vm.prank(subscriber);
        manager.cancelSubscription(planId);
    }

    // ── isSubscribed ──────────────────────────────────────────────────────────

    function test_isSubscribed_returnsFalse_whenNoNFTSet() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        assertFalse(manager.isSubscribed(subscriber, planId));
    }

    function test_isSubscribed_returnsFalse_beforeSubscribe() public {
        uint256 planId = _createPlan();
        _setNFT();

        assertFalse(manager.isSubscribed(subscriber, planId));
    }

    function test_isSubscribed_returnsTrueAfterSubscribe() public {
        uint256 planId = _createPlan();
        _setNFT();
        _subscribe(planId);

        assertTrue(manager.isSubscribed(subscriber, planId));
    }

    function test_isSubscribed_returnsFalseAfterCancel() public {
        uint256 planId = _createPlan();
        _setNFT();
        _subscribe(planId);

        vm.prank(subscriber);
        manager.cancelSubscription(planId);

        assertFalse(manager.isSubscribed(subscriber, planId));
    }

    function test_isSubscribed_delegatesToNFTContract() public {
        uint256 planId = _createPlan();
        _setNFT();

        // Manually call mock's mint (bypassing SubscriptionManager) to verify delegation.
        nft.mint(subscriber, planId);

        assertTrue(manager.isSubscribed(subscriber, planId));
    }
}
