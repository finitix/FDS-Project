// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentRegistry {
    // Structure to hold registration details
    struct DocumentProof {
        address owner;
        uint256 blockTimestamp;
    }

    // Mapping: SHA-256 Hash (bytes32) -> DocumentProof
    mapping(bytes32 => DocumentProof) private proofs;

    // Event for successful registration
    event DocumentRegistered(bytes32 indexed docHash, address owner, uint256 blockTimestamp);

    // Function to register a document hash
    function register(bytes32 docHash) public {
        // Check if the hash is already registered
        require(proofs[docHash].owner == address(0), "Hash already registered.");

        // Record the proof details
        proofs[docHash] = DocumentProof(msg.sender, block.timestamp);

        // Emit event
        emit DocumentRegistered(docHash, msg.sender, block.timestamp);
    }

    // Function to retrieve registration details
    function getProof(bytes32 docHash) public view returns (address owner, uint256 blockTimestamp) {
        // Retrieve the proof
        DocumentProof storage proof = proofs[docHash];
        return (proof.owner, proof.blockTimestamp);
    }
}