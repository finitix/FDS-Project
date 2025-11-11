// smart-contract/truffle-config.js (Simplified)
module.exports = {
    networks: {
        development: {
            host: "127.0.0.1", // Localhost (Ganache default)
            port: 8545,      // Ganache port
            network_id: "*", // Match any network id
        }
    },
    compilers: {
        solc: {
            version: "^0.8.0" // Use the same version as in the contract
        }
    }
};