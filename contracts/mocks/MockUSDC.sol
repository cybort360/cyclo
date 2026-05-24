// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Test-only USDC mock with 6 decimals. Never deployed to testnet.
/// transferFrom returns false instead of reverting on insufficient allowance
/// so SubscriptionManager's `if (!success) revert TransferFailed(...)` path is testable.
contract MockUSDC {
    string public constant name     = "Mock USD Coin";
    string public constant symbol   = "USDC";
    uint8  public constant decimals = 6;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        _totalSupply   += amount;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (_balances[msg.sender] < amount) return false;
        _balances[msg.sender] -= amount;
        _balances[to]         += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (_allowances[from][msg.sender] < amount) return false;
        if (_balances[from] < amount) return false;
        _allowances[from][msg.sender] -= amount;
        _balances[from]               -= amount;
        _balances[to]                 += amount;
        return true;
    }
}
