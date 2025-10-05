// Pool (LaunchPool) ABI — includes buyAndFinalize
export const PoolAbi =
[
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_reserveToken",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_launchToken",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_treasury",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_targetMarketCap18",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_router",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_lpRecipient",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "pair",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountReserve",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountToken",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "lpMinted",
				"type": "uint256"
			}
		],
		"name": "Listed",
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
				"indexed": false,
				"internalType": "address",
				"name": "router",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "lpRecipient",
				"type": "address"
			}
		],
		"name": "RouterSet",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "user",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "buyToken",
				"type": "bool"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountIn",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amountOut",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "feeReserve",
				"type": "uint256"
			}
		],
		"name": "Swap",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "target18",
				"type": "uint256"
			}
		],
		"name": "TargetMarketCapSet",
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
		"inputs": [],
		"name": "FEE_BPS",
		"outputs": [
			{
				"internalType": "uint16",
				"name": "",
				"type": "uint16"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
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
				"name": "T",
				"type": "tuple"
			},
			{
				"internalType": "uint256",
				"name": "minReserveOnAdd",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "minTokenOnAdd",
				"type": "uint256"
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
			}
		],
		"name": "buyAndFinalizeWithPermit2",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
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
				"name": "T",
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
			}
		],
		"name": "buyWithPermit2",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
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
				"name": "T",
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
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			}
		],
		"name": "buyWithPermit2FromFor",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "currentMarketCap",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "mc18",
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
				"name": "minReserve",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "minToken",
				"type": "uint256"
			}
		],
		"name": "finalizeToUniV2",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "launchToken",
		"outputs": [
			{
				"internalType": "contract IERC20Ext",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "listed",
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
		"name": "lpRecipient",
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
		"inputs": [],
		"name": "reserveToken",
		"outputs": [
			{
				"internalType": "contract IERC20Ext",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "reserves",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "r",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "t",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "router",
		"outputs": [
			{
				"internalType": "contract IUniswapV2Router02",
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
				"name": "T",
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
			}
		],
		"name": "sellWithPermit2",
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
				"name": "_router",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_lpRecipient",
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
				"internalType": "uint256",
				"name": "target18",
				"type": "uint256"
			}
		],
		"name": "setTargetMarketCap",
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
				"name": "token",
				"type": "address"
			},
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
		"name": "sweepToken",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "targetMarketCap18",
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
		"stateMutability": "payable",
		"type": "receive"
	}
] as const;
