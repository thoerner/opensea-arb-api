import dotenv from 'dotenv'
import { ethers } from 'ethers'

dotenv.config()

export default {
    provider: new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL),
    privateKey: process.env.PRIVATE_KEY,
    offerer: process.env.PUBLIC_ADDRESS,
    apiKey: process.env.API_KEY,
    apiV2Url: 'https://api.opensea.io/v2',
    wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    conduitKey: '0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000',
    protocolAddress: '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC',
    seaportContractAddress: '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC',
    domain: {
        name: 'Seaport',
        version: '1.5',
        chainId: 1,
        verifyingContract: '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC',
    },
    sigTypes: {
        OrderComponents: [
          {
            name: "offerer",
            type: "address",
          },
          {
            name: "zone",
            type: "address",
          },
          {
            name: "offer",
            type: "OfferItem[]",
          },
          {
            name: "consideration",
            type: "ConsiderationItem[]",
          },
          {
            name: "orderType",
            type: "uint8",
          },
          {
            name: "startTime",
            type: "uint256",
          },
          {
            name: "endTime",
            type: "uint256",
          },
          {
            name: "zoneHash",
            type: "bytes32",
          },
          {
            name: "salt",
            type: "uint256",
          },
          {
            name: "conduitKey",
            type: "bytes32",
          },
          {
            name: "counter",
            type: "uint256",
          },
        ],
        OfferItem: [
          {
            name: "itemType",
            type: "uint8",
          },
          {
            name: "token",
            type: "address",
          },
          {
            name: "identifierOrCriteria",
            type: "uint256",
          },
          {
            name: "startAmount",
            type: "uint256",
          },
          {
            name: "endAmount",
            type: "uint256",
          },
        ],
        ConsiderationItem: [
          {
            name: "itemType",
            type: "uint8",
          },
          {
            name: "token",
            type: "address",
          },
          {
            name: "identifierOrCriteria",
            type: "uint256",
          },
          {
            name: "startAmount",
            type: "uint256",
          },
          {
            name: "endAmount",
            type: "uint256",
          },
          {
            name: "recipient",
            type: "address",
          },
        ],
    }
}