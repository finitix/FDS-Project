import React, { useState } from 'react';
import axios from 'axios';
import './App.css'; // You can use the default App.css

const API_URL = 'http://localhost:5000/api/documents'; // Backend URL

// --- Client-Side SHA-256 Hashing Logic ---
const calculateSha256 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        // The SubtleCrypto API is used for security-oriented tasks
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
        
        // Convert the ArrayBuffer to a hexadecimal string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

function App() {
  const [file, setFile] = useState(null);
  const [docHash, setDocHash] = useState('');
  const [status, setStatus] = useState('Select a file to begin...');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setErrorMessage('');
      setStatus(`Calculating SHA-256 for: ${selectedFile.name}...`);
      setLoading(true);

      try {
        const hash = await calculateSha256(selectedFile);
        setDocHash(hash);
        setStatus(`Hash calculated: ${hash.substring(0, 10)}...`);
      } catch (error) {
        setStatus('Error calculating hash.');
        setErrorMessage(error.message);
      } finally {
        setLoading(false);
      }
    } else {
      setFile(null);
      setDocHash('');
      setStatus('Select a file to begin...');
    }
  };

  // --- REGISTRATION Flow ---
  const handleRegister = async () => {
    if (!docHash || !file) {
      alert('Please select a file and compute the hash first.');
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMessage('');
    setStatus('Attempting to register on-chain...');

    const payload = {
      docHash,
      filename: file.name,
      filesize: file.size,
      mimeType: file.type,
      uploader: 'ClientDemoUser', // Simplified owner tracking
    };

    try {
      const response = await axios.post(`${API_URL}/register`, payload);
      setStatus(`✅ Registered! TX: ${response.data.receipt.transactionHash.substring(0, 10)}...`);
      setResult(response.data);
    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      setErrorMessage(`Registration Failed: ${msg}`);
      setStatus('Registration failed.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- VERIFICATION Flow ---
  const handleVerify = async () => {
    if (!docHash || !file) {
      alert('Please select a file and compute the hash first.');
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMessage('');
    setStatus('Checking integrity against on-chain record...');

    try {
      const response = await axios.post(`${API_URL}/verify`, { docHash });
      const data = response.data;
      
      let newStatus;
      if (data.status === 'VERIFIED_OK') {
        newStatus = `✅ Integrity **VERIFIED**. Document is original and registered on-chain.`;
      } else if (data.status === 'VERIFIED_ON_CHAIN_ONLY') {
        newStatus = `⚠️ Hash found on-chain, but off-chain metadata is missing. Integrity check **OK**.`;
      } else { // NOT_FOUND
        newStatus = `❌ Not found on-chain. Document is UNREGISTERED or TAMPERED.`;
      }

      setStatus(newStatus);
      setResult(data);

    } catch (error) {
      const msg = error.response?.data?.message || error.message;
      setErrorMessage(`Verification Failed: ${msg}`);
      setStatus('Verification failed.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (currentStatus) => {
    if (currentStatus.includes('VERIFIED_OK')) return { color: 'green', fontWeight: 'bold' };
    if (currentStatus.includes('UNREGISTERED') || currentStatus.includes('TAMPERED')) return { color: 'red', fontWeight: 'bold' };
    if (currentStatus.includes('failed') || currentStatus.includes('Error')) return { color: 'darkred' };
    return { color: 'gray' };
  };

  return (
    <div className="App">
      <h1>📄 Blockchain Document Verifier</h1>
      <p>MERN Stack + Ethereum/Ganache</p>
      
      <div className="file-input-section">
        <h3>1. Select Document & Compute Hash (Client-Side)</h3>
        <input type="file" onChange={handleFileChange} disabled={loading} />
        {file && <p>File: **{file.name}** ({file.size} bytes)</p>}
        {docHash && <p>Computed SHA-256 Hash: <code style={{wordBreak:'break-all'}}>{docHash}</code></p>}
      </div>

      <hr />

      <div className="actions-section">
        <h3>2. Perform Action</h3>
        <button 
          onClick={handleRegister} 
          disabled={loading || !docHash}
          style={{ marginRight: '10px', backgroundColor: '#007bff', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px' }}
        >
          {loading && status.includes('register') ? '⏳ Registering...' : '📝 Register Document'}
        </button>
        <button 
          onClick={handleVerify} 
          disabled={loading || !docHash}
          style={{ backgroundColor: '#28a745', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px' }}
        >
          {loading && status.includes('integrity') ? '⏳ Verifying...' : '🔍 Verify Integrity'}
        </button>
      </div>

      <hr />

      <div className="status-section">
        <h3>3. Status & Results</h3>
        {loading && <p>Loading...</p>}
        <p>Current Status: <span style={getStatusStyle(status)}>{status}</span></p>
        {errorMessage && <p style={{ color: 'red' }}>Error: {errorMessage}</p>}
        
        {result && (
          <div className="verification-details" style={{ border: '1px solid #ccc', padding: '15px', marginTop: '15px', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
            <h4>Verification Result Details:</h4>
            {result.offChainData && (
              <p>Off-Chain Filename: **{result.offChainData.filename}**</p>
            )}

            {result.onChainData && (
              <>
                <p>Status: **{result.status}**</p>
                <p>Owner Address: <code style={{wordBreak:'break-all'}}>{result.onChainData.owner}</code></p>
                {result.onChainData.txHash && <p>Transaction Hash: <code style={{wordBreak:'break-all'}}>{result.onChainData.txHash}</code></p>}
                {result.onChainData.blockNumber && <p>Block Number: **{result.onChainData.blockNumber}**</p>}
                {result.onChainData.blockTimestamp && (
                    <p>Timestamp: **{new Date(result.onChainData.blockTimestamp * 1000).toLocaleString()}**</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;