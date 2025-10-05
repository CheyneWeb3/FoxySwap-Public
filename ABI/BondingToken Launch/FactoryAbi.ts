// Factory (PumpFunLikeFactory) ABI — includes setLaunchMeta + views used in UI
export const FactoryAbi =
[
	{
		"inputs": [],
		"name": "Disabled",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "EthSendFailed",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "FeeRequired",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "FeeSendFailed",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "LpRecipientZero",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NoLiquidity",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "RefundFailed",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "ZeroAddress",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "feeWei",
				"type": "uint256"
			}
		],
		"name": "DeployFeeChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "uint256",
				"name": "id",
				"type": "uint256"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "creator",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "pool",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "initialToken",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "initialReserve",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "targetMarketCap18",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "lpRecipient",
				"type": "address"
			}
		],
		"name": "Launched",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "bool",
				"name": "enabled",
				"type": "bool"
			}
		],
		"name": "LaunchesEnabled",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "by",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "logoURI",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "description",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "telegram",
				"type": "string"
			},
			{
				"indexed": false,
				"internalType": "string",
				"name": "twitter",
				"type": "string"
			}
		],
		"name": "MetadataSet",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "bool",
				"name": "status",
				"type": "bool"
			}
		],
		"name": "Paused",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "creator",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "pool",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "reserveToken",
				"type": "address"
			}
		],
		"name": "PoolReady",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "r",
				"type": "address"
			}
		],
		"name": "RouterChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "t",
				"type": "address"
			}
		],
		"name": "TreasuryChanged",
		"type": "event"
	},
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "string",
						"name": "name_",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "sym_",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "initialTokenSupply",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "initialReserveAmt",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "targetMarketCap18",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "lpRecipient",
						"type": "address"
					}
				],
				"internalType": "struct LaunchInput",
				"name": "I",
				"type": "tuple"
			},
			{
				"components": [
					{
						"internalType": "address",
						"name": "permit2",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "nonceWord",
						"type": "uint256"
					},
					{
						"internalType": "uint8",
						"name": "nonceBit",
						"type": "uint8"
					},
					{
						"internalType": "uint256",
						"name": "deadline",
						"type": "uint256"
					},
					{
						"internalType": "bytes",
						"name": "signature",
						"type": "bytes"
					}
				],
				"internalType": "struct Permit2Auth",
				"name": "P",
				"type": "tuple"
			},
			{
				"internalType": "bytes32",
				"name": "saltUser",
				"type": "bytes32"
			}
		],
		"name": "launchWithPermit2",
		"outputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "pool",
				"type": "address"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "string",
						"name": "name_",
						"type": "string"
					},
					{
						"internalType": "string",
						"name": "sym_",
						"type": "string"
					},
					{
						"internalType": "uint256",
						"name": "initialTokenSupply",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "initialReserveAmt",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "targetMarketCap18",
						"type": "uint256"
					},
					{
						"internalType": "address",
						"name": "lpRecipient",
						"type": "address"
					}
				],
				"internalType": "struct LaunchInput",
				"name": "I",
				"type": "tuple"
			},
			{
				"components": [
					{
						"internalType": "address",
						"name": "permit2",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "nonceWord",
						"type": "uint256"
					},
					{
						"internalType": "uint8",
						"name": "nonceBit",
						"type": "uint8"
					},
					{
						"internalType": "uint256",
						"name": "deadline",
						"type": "uint256"
					},
					{
						"internalType": "bytes",
						"name": "signature",
						"type": "bytes"
					}
				],
				"internalType": "struct Permit2Auth",
				"name": "PFund",
				"type": "tuple"
			},
			{
				"components": [
					{
						"internalType": "uint256",
						"name": "amountInMaxOrExact",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "minOut",
						"type": "uint256"
					}
				],
				"internalType": "struct TradeArgs",
				"name": "TFirstBuy",
				"type": "tuple"
			},
			{
				"components": [
					{
						"internalType": "address",
						"name": "permit2",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "nonceWord",
						"type": "uint256"
					},
					{
						"internalType": "uint8",
						"name": "nonceBit",
						"type": "uint8"
					},
					{
						"internalType": "uint256",
						"name": "deadline",
						"type": "uint256"
					},
					{
						"internalType": "bytes",
						"name": "signature",
						"type": "bytes"
					}
				],
				"internalType": "struct Permit2Auth",
				"name": "PFirstBuy",
				"type": "tuple"
			},
			{
				"internalType": "bytes32",
				"name": "saltUser",
				"type": "bytes32"
			}
		],
		"name": "launchWithPermit2AndFirstBuy",
		"outputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "pool",
				"type": "address"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "w",
				"type": "uint256"
			}
		],
		"name": "setDeployFeeWei",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bool",
				"name": "e",
				"type": "bool"
			}
		],
		"name": "setLaunchesEnabled",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "logoURI",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "description",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "telegram",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "twitter",
				"type": "string"
			}
		],
		"name": "setLaunchMeta",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bool",
				"name": "s",
				"type": "bool"
			}
		],
		"name": "setPaused",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "r",
				"type": "address"
			}
		],
		"name": "setRouter",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "t",
				"type": "address"
			}
		],
		"name": "setTreasury",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "sweepETH",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_reserveToken",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_treasury",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_uniV2Router",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_deployFeeWei",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_childDeployer",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "childDeployer",
		"outputs": [
			{
				"internalType": "contract IChildDeployer",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "deployFeeWei",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "deployFeeWeiView",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "launches",
		"outputs": [
			{
				"internalType": "address",
				"name": "creator",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "pool",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "symbol",
				"type": "string"
			},
			{
				"internalType": "uint256",
				"name": "initialToken",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "initialReserve",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "targetMarketCap18",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "lpRecipient",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "launchesCount",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "launchesEnabled",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "launchesLength",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "paused",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "poolForToken",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "creator",
				"type": "address"
			},
			{
				"internalType": "string",
				"name": "name_",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "sym_",
				"type": "string"
			},
			{
				"internalType": "address",
				"name": "lpRecipient",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "targetMarketCap18_",
				"type": "uint256"
			},
			{
				"internalType": "bytes32",
				"name": "saltUser",
				"type": "bytes32"
			}
		],
		"name": "previewAddresses",
		"outputs": [
			{
				"internalType": "address",
				"name": "tokenPred",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "poolPred",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "reserveToken",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "tokenMeta",
		"outputs": [
			{
				"internalType": "string",
				"name": "logoURI",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "description",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "telegram",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "twitter",
				"type": "string"
			},
			{
				"internalType": "bool",
				"name": "set",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "tokensByCreator",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "creator",
				"type": "address"
			}
		],
		"name": "tokensOf",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalDeployFeesCollected",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "treasury",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "uniV2Router",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];
