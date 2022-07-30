// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

// import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
// import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "hardhat/console.sol";

interface IVerifier {
    function verify(bytes calldata, bytes calldata) external view returns (bool);
}

contract PrivateTransfer {
    // amount deposited for each commitment
    uint256 public amount;
    bytes32 public root;

    mapping(bytes32 => bool) public nullifierHashes;
    // we store all commitments just to prevent accidental deposits with the same commitment
    // these have been switched to an array 
    mapping(uint256 => bool) public commitments;
    // uint256[] public commitments;

    IVerifier public verifier;

    event Deposit(bytes32 indexed commitments, uint32 leafIndex, uint256 timestamp);
    event Withdrawal(address to, bytes32 nullifierHashes);

    constructor(
        IVerifier _verifier,
        uint256 _amount,
        bytes32 _root,
        uint256[] memory _commitments
        // Hasher _hasher Will need a hasher to switch to an on-chain merkle tree
    ) public payable {
        require(_amount > 0, "denomination should be greater than zero");
        require(msg.value > 0, "value of commitments to withdraw must be greater than zero");
        console.log(
            'msg.value on deploy',
            msg.value
        );
        verifier = _verifier;
        amount = _amount;
        root = _root;
        for (uint i = 0; i < _commitments.length; i++) {
            commitments[_commitments[i]] = true;
                    console.log(
                "checking commitment passed on deployment",
                _commitments[i]
            );
        }
    }

    // function initialize(
    //     IVerifier _verifier,
    //     uint256 _amount,
    //     bytes32 _root,
    //     uint256[] memory _commitments
    // ) public initializer {
    //     require(_amount > 0, "denomination should be greater than zero");
    //     verifier = _verifier;
    //     amount = _amount;
    //     root = _root;
    //     commitments = _commitments;
    // }

    function withdraw(
        bytes calldata proof,
        bytes calldata public_inputs,
        bytes32 _root,
        uint256 _commitment,
        bytes32 _nullifierHash,
        address payable _recipient
    ) external payable {
        require(!nullifierHashes[_nullifierHash], "The note has been already spent");
        console.log(
            "nullifier hash passed into withdraw function"
        );
        console.logBytes32(
            _nullifierHash
        );
        require(root == _root, "Cannot find your merkle root");
        console.log(
        "checking commitment passed into withdraw function",
            _commitment
        );
        require(commitments[_commitment], "Commitment is not found in the set!");
        // console.log(
        //     "proof calldata passed into withdraw function"
        // );
        // console.logBytes(
        //     proof
        // );
        // console.log(
        //     "public_inputs calldata passed into withdraw function"
        // );
        // console.logBytes(
        //     public_inputs
        // );
        bool proofResult = verifier.verify(proof, public_inputs);
        require(proofResult, "Invalid withdraw proof");
        console.log('verified withdrawal: ', proofResult);
        // Set nullifier hash to true
        nullifierHashes[_nullifierHash] = true;

        require(msg.value == 0, "msg.value is supposed to be zero");
        console.log('amount: ', amount);

        console.log('contract balance: ', address(this).balance);
        (bool success, ) = _recipient.call{value: amount}("");
        require(success, "payment to _recipient did not go thru");
        console.log('successful withdrawal: ', success);
        console.log('recipient balance: ', _recipient.balance);


        emit Withdrawal(_recipient, _nullifierHash);
    }
}