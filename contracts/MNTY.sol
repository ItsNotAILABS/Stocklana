// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MNTY Fixed Supply
/// @notice Self-contained ERC-20 style token for the Stocklana dual-chain launch lane.
///         Supply is minted once to the deployer. There is no mint function after construction.
contract MNTY {
    string public constant name = "MNTY";
    string public constant symbol = "MNTY";
    uint8 public constant decimals = 18;
    uint256 public immutable totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from,address indexed to,uint256 value);
    event Approval(address indexed owner,address indexed spender,uint256 value);
    constructor(uint256 wholeSupply,address recipient){
        require(recipient!=address(0),"recipient");
        totalSupply=wholeSupply*10**decimals;
        balanceOf[recipient]=totalSupply;
        emit Transfer(address(0),recipient,totalSupply);
    }
    function transfer(address to,uint256 amount) external returns(bool){_transfer(msg.sender,to,amount);return true;}
    function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;emit Approval(msg.sender,spender,amount);return true;}
    function transferFrom(address from,address to,uint256 amount) external returns(bool){uint256 a=allowance[from][msg.sender];require(a>=amount,"allowance");if(a!=type(uint256).max)allowance[from][msg.sender]=a-amount;_transfer(from,to,amount);return true;}
    function _transfer(address from,address to,uint256 amount) internal {require(to!=address(0),"to");uint256 b=balanceOf[from];require(b>=amount,"balance");unchecked{balanceOf[from]=b-amount;}balanceOf[to]+=amount;emit Transfer(from,to,amount);}
}
