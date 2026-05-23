// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SubscriptionManager}    from "../contracts/core/SubscriptionManager.sol";
import {ISubscriptionManager}   from "../contracts/interfaces/ISubscriptionManager.sol";
import {MockUSDC}               from "../contracts/mocks/MockUSDC.sol";
import {SubscriptionNFT}        from "../contracts/src/SubscriptionNFT.sol";
import {MockSubscriptionNFT}    from "../contracts/mocks/MockSubscriptionNFT.sol";

/// @dev Tests for charge() fee split, pay(), batchCharge(), and updateFeeRecipient().
contract SubscriptionManagerExtensionsTest is Test {

    // Solidity 0.8.20 does not support `emit IFoo.Event(...)` — local mirrors required.
    event PaymentCharged(uint256 indexed planId, address indexed subscriber, address indexed merchant, uint256 amount, uint256 nextChargeTimestamp);
    event FeeCollected(uint256 indexed planId, address indexed subscriber, uint256 feeAmount);
    event PaymentSent(address indexed sender, address indexed recipient, uint256 amount, uint256 fee);
    event SubscriptionCreated(uint256 indexed planId, address indexed subscriber, uint256 nextChargeTimestamp);
    event SubscriptionCancelled(uint256 indexed planId, address indexed subscriber);
    event PlanMigrated(uint256 indexed fromPlanId, uint256 indexed toPlanId, address indexed subscriber);

    SubscriptionManager internal manager;
    MockUSDC           internal usdc;

    address internal owner        = address(this);
    address internal merchant     = makeAddr("merchant");
    address internal subscriber   = makeAddr("subscriber");
    address internal payer        = makeAddr("payer");
    address internal recipient    = makeAddr("recipient");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal stranger     = makeAddr("stranger");

    uint256 internal constant PRICE    = 10_000_000; // 10 USDC
    uint256 internal constant INTERVAL = 30 days;
    uint256 internal constant T0       = 1000;

    function setUp() public {
        usdc    = new MockUSDC();
        manager = new SubscriptionManager(address(usdc), feeRecipient);
        usdc.mint(subscriber, 100_000_000);
        usdc.mint(payer, 100_000_000);
        vm.warp(T0);
    }

    function _createPlan() internal returns (uint256) {
        vm.prank(merchant);
        return manager.createPlan(PRICE, INTERVAL, 0);
    }

    function _createPlanWithTrial(uint48 trialDuration) internal returns (uint256) {
        vm.prank(merchant);
        return manager.createPlan(PRICE, INTERVAL, trialDuration);
    }

    function _subscribe(uint256 planId) internal {
        vm.startPrank(subscriber);
        usdc.approve(address(manager), type(uint256).max);
        manager.subscribe(planId);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // charge() — fee split
    // -------------------------------------------------------------------------

    function test_charge_fee_merchantReceives99Percent() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        uint256 fee              = PRICE / 100;
        uint256 merchantAmount   = PRICE - fee;
        uint256 merchantBefore   = usdc.balanceOf(merchant);
        uint256 feeBefore        = usdc.balanceOf(feeRecipient);
        uint256 subscriberBefore = usdc.balanceOf(subscriber);

        vm.expectEmit(true, true, true, true);
        emit PaymentCharged(planId, subscriber, merchant, PRICE, T0 + INTERVAL);
        vm.expectEmit(true, true, false, true);
        emit FeeCollected(planId, subscriber, fee);
        manager.charge(planId, subscriber);

        assertEq(usdc.balanceOf(merchant), merchantBefore + merchantAmount);
        assertEq(usdc.balanceOf(feeRecipient), feeBefore + fee);
        assertEq(usdc.balanceOf(subscriber), subscriberBefore - PRICE);
    }

    // -------------------------------------------------------------------------
    // pay()
    // -------------------------------------------------------------------------

    function test_pay_success() public {
        uint256 amount           = 5_000_000; // 5 USDC
        uint256 fee              = amount / 100;
        uint256 recipientAmount  = amount - fee;

        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);

        vm.expectEmit(true, true, false, true);
        emit PaymentSent(payer, recipient, amount, fee);
        manager.pay(recipient, amount);
        vm.stopPrank();

        assertEq(usdc.balanceOf(recipient), recipientAmount);
        assertEq(usdc.balanceOf(feeRecipient), fee);
        assertEq(usdc.balanceOf(payer), 100_000_000 - amount);
    }

    function test_pay_revert_zeroAddress() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        vm.expectRevert(ISubscriptionManager.ZeroAddress.selector);
        manager.pay(address(0), 1_000_000);
        vm.stopPrank();
    }

    function test_pay_revert_zeroAmount() public {
        vm.startPrank(payer);
        usdc.approve(address(manager), type(uint256).max);
        vm.expectRevert(ISubscriptionManager.InvalidAmount.selector);
        manager.pay(recipient, 0);
        vm.stopPrank();
    }

    function test_pay_revert_transferFails() public {
        uint256 amount          = 5_000_000;
        uint256 recipientAmount = amount - amount / 100;
        // payer has no allowance — MockUSDC returns false
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.TransferFailed.selector, payer, recipient, recipientAmount));
        manager.pay(recipient, amount);
    }

    // -------------------------------------------------------------------------
    // batchCharge()
    // -------------------------------------------------------------------------

    function test_batchCharge_allSucceed() public {
        address sub2   = makeAddr("subscriber2");
        usdc.mint(sub2, 100_000_000);

        uint256 planId = _createPlan();
        _subscribe(planId);

        vm.startPrank(sub2);
        usdc.approve(address(manager), type(uint256).max);
        manager.subscribe(planId);
        vm.stopPrank();

        uint256[] memory planIds      = new uint256[](2);
        address[] memory subscribers  = new address[](2);
        planIds[0] = planId; subscribers[0] = subscriber;
        planIds[1] = planId; subscribers[1] = sub2;

        uint256 successCount = manager.batchCharge(planIds, subscribers);
        assertEq(successCount, 2);
    }

    function test_batchCharge_mixedValidInvalid() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        // second entry: stranger has no subscription — will fail
        uint256[] memory planIds     = new uint256[](2);
        address[] memory subscribers = new address[](2);
        planIds[0] = planId; subscribers[0] = subscriber; // valid
        planIds[1] = planId; subscribers[1] = stranger;   // no subscription

        uint256 successCount = manager.batchCharge(planIds, subscribers);
        assertEq(successCount, 1);

        // valid subscriber's state advanced; stranger unaffected
        assertEq(manager.getSubscription(planId, subscriber).nextChargeTimestamp, T0 + INTERVAL);
        assertFalse(manager.getSubscription(planId, stranger).active);
    }

    function test_batchCharge_revert_arrayLengthMismatch() public {
        uint256[] memory planIds     = new uint256[](2);
        address[] memory subscribers = new address[](1);
        vm.expectRevert(ISubscriptionManager.ArrayLengthMismatch.selector);
        manager.batchCharge(planIds, subscribers);
    }

    function test_batchCharge_emptyArrays_returnsZero() public {
        uint256[] memory planIds     = new uint256[](0);
        address[] memory subscribers = new address[](0);
        uint256 successCount = manager.batchCharge(planIds, subscribers);
        assertEq(successCount, 0);
    }

    // -------------------------------------------------------------------------
    // updateFeeRecipient()
    // -------------------------------------------------------------------------

    function test_updateFeeRecipient_success() public {
        address newRecipient = makeAddr("newFeeRecipient");
        // test contract deployed manager so it is the owner
        manager.updateFeeRecipient(newRecipient);

        // verify fees now flow to the new recipient
        uint256 planId = _createPlan();
        _subscribe(planId);
        manager.charge(planId, subscriber);

        assertEq(usdc.balanceOf(newRecipient), PRICE / 100);
        assertEq(usdc.balanceOf(feeRecipient), 0); // old recipient got nothing
    }

    function test_updateFeeRecipient_revert_zeroAddress() public {
        vm.expectRevert(ISubscriptionManager.ZeroAddress.selector);
        manager.updateFeeRecipient(address(0));
    }

    function test_updateFeeRecipient_revert_notOwner() public {
        vm.prank(stranger);
        // Ownable reverts with OwnableUnauthorizedAccount — not our custom error
        vm.expectRevert();
        manager.updateFeeRecipient(makeAddr("x"));
    }

    // -------------------------------------------------------------------------
    // Trial periods
    // -------------------------------------------------------------------------

    function test_subscribe_withTrial_setsCorrectNextCharge() public {
        uint48 trialDuration = 7 days;
        uint256 planId = _createPlanWithTrial(trialDuration);

        vm.startPrank(subscriber);
        usdc.approve(address(manager), type(uint256).max);
        vm.expectEmit(true, true, false, true);
        emit SubscriptionCreated(planId, subscriber, T0 + trialDuration);
        manager.subscribe(planId);
        vm.stopPrank();

        uint48 expected = uint48(T0) + trialDuration;
        assertEq(manager.getSubscription(planId, subscriber).nextChargeTimestamp, expected);
        // charge must not be due until trial expires
        assertFalse(manager.isChargeDue(planId, subscriber));
    }

    function test_subscribe_noTrial_chargeImmediatelyDue() public {
        uint256 planId = _createPlan(); // trialDuration = 0
        _subscribe(planId);
        assertTrue(manager.isChargeDue(planId, subscriber));
    }

    // -------------------------------------------------------------------------
    // migratePlan
    // -------------------------------------------------------------------------

    function test_migratePlan_success() public {
        uint256 planA = _createPlan();
        uint256 planB = _createPlan();
        _subscribe(planA);

        vm.startPrank(subscriber);
        vm.expectEmit(true, true, false, false);
        emit SubscriptionCancelled(planA, subscriber);
        vm.expectEmit(true, true, false, true);
        emit SubscriptionCreated(planB, subscriber, T0);
        vm.expectEmit(true, true, true, false);
        emit PlanMigrated(planA, planB, subscriber);
        manager.migratePlan(planA, planB);
        vm.stopPrank();

        assertFalse(manager.getSubscription(planA, subscriber).active);
        assertTrue(manager.getSubscription(planB, subscriber).active);
        assertEq(manager.getSubscription(planB, subscriber).nextChargeTimestamp, T0);
    }

    function test_migratePlan_withTrial_appliesNewPlanTrial() public {
        uint256 planA = _createPlan();
        uint48  trial = 14 days;
        uint256 planB = _createPlanWithTrial(trial);
        _subscribe(planA);

        vm.prank(subscriber);
        manager.migratePlan(planA, planB);

        assertEq(manager.getSubscription(planB, subscriber).nextChargeTimestamp, uint48(T0) + trial);
        assertFalse(manager.isChargeDue(planB, subscriber));
    }

    function test_migratePlan_revert_samePlan() public {
        uint256 planId = _createPlan();
        _subscribe(planId);

        vm.prank(subscriber);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.SamePlan.selector, planId));
        manager.migratePlan(planId, planId);
    }

    function test_migratePlan_revert_noCurrentSub() public {
        uint256 planA = _createPlan();
        uint256 planB = _createPlan();

        vm.prank(subscriber);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.SubscriptionInactive.selector, planA, subscriber));
        manager.migratePlan(planA, planB);
    }

    function test_migratePlan_revert_newPlanInactive() public {
        uint256 planA = _createPlan();
        uint256 planB = _createPlan();
        _subscribe(planA);
        vm.prank(merchant);
        manager.deactivatePlan(planB);

        vm.prank(subscriber);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.PlanInactive.selector, planB));
        manager.migratePlan(planA, planB);
    }

    function test_migratePlan_revert_alreadySubscribedToTarget() public {
        uint256 planA = _createPlan();
        uint256 planB = _createPlan();

        address sub2 = makeAddr("sub2");
        usdc.mint(sub2, 100_000_000);

        // subscriber joins both plans directly
        vm.startPrank(subscriber);
        usdc.approve(address(manager), type(uint256).max);
        manager.subscribe(planA);
        manager.subscribe(planB);
        vm.stopPrank();

        vm.prank(subscriber);
        vm.expectRevert(abi.encodeWithSelector(ISubscriptionManager.AlreadySubscribed.selector, planB, subscriber));
        manager.migratePlan(planA, planB);
    }

    // -------------------------------------------------------------------------
    // NFT integration — real SubscriptionNFT
    // -------------------------------------------------------------------------

    /// @dev Deploys a real SubscriptionNFT, transfers its ownership to the manager,
    ///      and registers it with setSubscriptionNFT. Returns the deployed NFT.
    ///      The test contract owns the manager (owner = address(this)), so both
    ///      transferOwnership and setSubscriptionNFT are callable without pranking.
    function _deployAndSetRealNFT() internal returns (SubscriptionNFT) {
        SubscriptionNFT nft = new SubscriptionNFT("Cyclo Subscription", "CYCLO-SUB");
        nft.transferOwnership(address(manager));
        manager.setSubscriptionNFT(address(nft));
        return nft;
    }

    function test_NFTMintedOnSubscribe() public {
        uint256 planId = _createPlan();
        SubscriptionNFT nft = _deployAndSetRealNFT();

        _subscribe(planId);

        assertTrue(nft.isSubscribed(subscriber, planId));
    }

    function test_NFTBurnedOnCancel() public {
        uint256 planId = _createPlan();
        SubscriptionNFT nft = _deployAndSetRealNFT();

        _subscribe(planId);

        vm.prank(subscriber);
        manager.cancelSubscription(planId);

        assertFalse(nft.isSubscribed(subscriber, planId));
    }

    function test_NFTIsSoulbound() public {
        uint256 planId = _createPlan();
        SubscriptionNFT nft = _deployAndSetRealNFT();

        _subscribe(planId);

        // Token IDs start at 1; subscriber holds the first minted token.
        uint256 tokenId = nft.tokenOfSubscriber(subscriber, planId);

        vm.prank(subscriber);
        vm.expectRevert(SubscriptionNFT.Soulbound.selector);
        nft.transferFrom(subscriber, stranger, tokenId);
    }

    function test_SubscriptionSucceedsIfNFTNotSet() public {
        uint256 planId = _createPlan();
        // Deliberately skip setSubscriptionNFT — subscriptionNFT remains address(0).
        _subscribe(planId);

        assertTrue(manager.getSubscription(planId, subscriber).active);
    }

    function test_SubscriptionSucceedsIfNFTMintReverts() public {
        uint256 planId = _createPlan();

        MockSubscriptionNFT mockNft = new MockSubscriptionNFT();
        mockNft.setRevertMint(true);
        manager.setSubscriptionNFT(address(mockNft));

        _subscribe(planId);

        assertTrue(manager.getSubscription(planId, subscriber).active);
    }
}
