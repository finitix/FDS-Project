require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Web3 = require('web3');
const Document = require('./models/Document');
const ContractArtifact = require('./DocumentRegistry.json'); // Contract ABI and Bytecode

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Web3 Setup ---
const web3 = new Web3(process.env.GANACHE_RPC_URL);
const contractAddress = process.env.CONTRACT_ADDRESS;
const contractABI = ContractArtifact.abi;
const documentRegistry = new web3.eth.Contract(contractABI, contractAddress);

// Step 1: Add the private key to the wallet object.
web3.eth.accounts.wallet.add(process.env.SERVER_PRIVATE_KEY);

// Step 2: Retrieve the newly added account (which is now the first element, index 0).
const signerAccount = web3.eth.accounts.wallet[0];

console.log('Server Signer Address:', signerAccount.address);

// Helper to convert frontend SHA-256 hash (string) to bytes32 format
const hashToBytes32 = (hash) => {
    // SHA-256 hash is 64 hex characters (32 bytes). Web3.js needs '0x' prefix.
    if (hash.length === 64) {
        return '0x' + hash;
    }
    throw new Error("Invalid hash format. Expected 64 characters.");
};

// --- API Endpoints ---

// 1. REGISTER document and record on-chain
app.post('/api/documents/register', async (req, res) => {
    const { docHash, filename, filesize, mimeType, uploader } = req.body;

    if (!docHash) return res.status(400).send('Document hash is required.');

    try {
        const bytes32Hash = hashToBytes32(docHash);

        // **A. Check MongoDB for Duplicates**
        const existingDoc = await Document.findOne({ docHash });
        if (existingDoc && existingDoc.isRegistered) {
            return res.status(409).json({ message: 'Document already registered (on-chain and off-chain).', doc: existingDoc });
        }

        // **B. Register on-chain**
        console.log(`Attempting to register hash: ${bytes32Hash}`);
        const tx = documentRegistry.methods.register(bytes32Hash);
        const gasEstimate = await tx.estimateGas({ from: signerAccount.address });

        const receipt = await tx.send({
            from: signerAccount.address,
            gas: gasEstimate
        });

        const proof = await documentRegistry.methods.getProof(bytes32Hash).call();

        // **C. Save Metadata to MongoDB**
        const newDocData = {
            docHash,
            filename,
            filesize,
            mimeType,
            uploader,
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            ownerAddress: proof.owner,
            timestamp: parseInt(proof.blockTimestamp),
            isRegistered: true
        };

        const doc = existingDoc 
            ? await Document.findOneAndUpdate({ docHash }, newDocData, { new: true })
            : await Document.create(newDocData);

        res.status(201).json({ 
            message: 'Document successfully registered and metadata saved.', 
            doc, 
            receipt 
        });

    } catch (error) {
        console.error('Registration Error:', error.message);
        // Ganache/Web3 errors often contain "revert" message for contract failures
        res.status(500).json({ 
            message: 'Failed to register document.', 
            error: error.message.includes('revert') ? 'Contract call failed (e.g., hash already registered on-chain).' : error.message 
        });
    }
});

// 2. VERIFY document integrity by checking on-chain
app.post('/api/documents/verify', async (req, res) => {
    const { docHash } = req.body;

    if (!docHash) return res.status(400).send('Document hash is required.');

    try {
        const bytes32Hash = hashToBytes32(docHash);

        // **A. Query on-chain registry**
        const proof = await documentRegistry.methods.getProof(bytes32Hash).call();
        const owner = proof.owner;
        
        let status;
        let docMetadata = null;

        if (owner === '0x0000000000000000000000000000000000000000') {
            // Address(0) means 'not found' in our contract
            status = 'NOT_FOUND';
        } else {
            // Hash found on-chain!
            docMetadata = await Document.findOne({ docHash });
            if (docMetadata) {
                // Found on-chain AND off-chain (original file details)
                status = 'VERIFIED_OK';
            } else {
                // Found on-chain but NOT off-chain (registered by another system/user not tracking metadata)
                status = 'VERIFIED_ON_CHAIN_ONLY'; 
            }
        }
        
        res.json({
            status, // 'NOT_FOUND', 'VERIFIED_OK', 'VERIFIED_ON_CHAIN_ONLY'
            onChainData: {
                owner: proof.owner,
                blockTimestamp: parseInt(proof.blockTimestamp),
                blockNumber: docMetadata ? docMetadata.blockNumber : null,
                txHash: docMetadata ? docMetadata.txHash : null,
            },
            offChainData: docMetadata
        });

    } catch (error) {
        console.error('Verification Error:', error.message);
        res.status(500).json({ message: 'Failed to perform on-chain verification.', error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});