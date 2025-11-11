const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    docHash: { type: String, required: true, unique: true }, // The on-chain hash
    filename: { type: String, required: true },
    filesize: { type: Number, required: true },
    mimeType: { type: String },
    uploader: { type: String }, // Can be an email or a wallet address
    // On-chain transaction details
    txHash: { type: String },
    blockNumber: { type: Number },
    ownerAddress: { type: String },
    timestamp: { type: Number }, // Block timestamp
    isRegistered: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Document', DocumentSchema);